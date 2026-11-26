import { Redis } from "ioredis";
import { EventEmitter } from "node:events";

export interface SetOptions {
  EX?: number;
  PX?: number;
}

/** Anything with parse(), e.g. a zod schema: get("user:7", PublicUserSchema). */
export interface Parser<T> {
  parse(value: unknown): T;
}

export class RedisClient extends EventEmitter {
  private static instance: RedisClient;
  private client: Redis;

  /** Longest wait for one Redis reply. Then the call throws, and the caller retries or fails. */
  private static readonly COMMAND_TIMEOUT_MS = 1000;

  private constructor(url: string) {
    super();

    // Fail fast, never late (room-service plan step 3). ioredis's defaults park commands while Redis is away and
    // send them when it returns: a request waited 151 s, and a write landed after its room was
    // deleted. Now:
    //   not connected → the call throws at once (no offline queue)
    //   no reply in 1 s → the call throws
    //   connection lost mid-command → the call throws; it is not re-sent after reconnecting
    // A command Redis already received can still run after the caller gave up (a timeout can't
    // take it back), so writes should be safe to repeat.
    // Reconnecting itself goes on in the background (default retryStrategy).
    this.client = new Redis(url, {
      commandTimeout: RedisClient.COMMAND_TIMEOUT_MS,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      autoResendUnfulfilledCommands: false,
    });

    this.client.on("connect", () => {
      this.emit("connect");
    });

    this.client.on("ready", () => {
      this.emit("ready");
    });

    this.client.on("error", (error) => {
      this.emit("error", error);
    });

    this.client.on("close", () => {
      this.emit("close");
    });

    this.client.on("reconnecting", (delay: number) => {
      this.emit("reconnecting", delay);
    });
  }

  // Initialize Redis only once
  public static initialize(url: string): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient(url);
    }

    return RedisClient.instance;
  }

  // Get existing Redis instance anywhere
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      throw new Error(
        "Redis is not initialized. Call RedisClient.initialize(url) first.",
      );
    }

    return RedisClient.instance;
  }

  /**
   * Resolves once Redis accepts commands. Without an offline queue, a command sent before that
   * fails, so a service awaits this before taking work.
   */
  public async ready(): Promise<void> {
    if (this.client.status === "ready") return;
    await new Promise<void>((resolve) => this.client.once("ready", () => resolve()));
  }

  // SET. Every value is stored as JSON, strings too ("123" is stored as "\"123\""), so get()
  // returns exactly the type that was stored: set("otp", "123") → get → "123", not 123.
  public async set(
    key: string,
    value: unknown,
    options?: SetOptions,
  ): Promise<"OK" | null> {
    const serializedValue = JSON.stringify(value);

    if (options?.EX !== undefined) {
      return this.client.set(key, serializedValue, "EX", options.EX);
    }

    if (options?.PX !== undefined) {
      return this.client.set(key, serializedValue, "PX", options.PX);
    }

    return this.client.set(key, serializedValue);
  }

  // GET. The value is checked with `schema`, not just cast, so a wrong shape throws here
  // instead of surfacing later. null when the key doesn't exist.
  public async get<T>(key: string, schema: Parser<T>): Promise<T | null> {
    const value = await this.client.get(key);

    if (value === null) return null;

    return schema.parse(JSON.parse(value));
  }

  // UPDATE (atomic, preserves TTL)
  public async update(key: string, value: unknown): Promise<"OK" | null> {
    const serializedValue = JSON.stringify(value);

    const result = await this.client.eval(
      `
        if redis.call("EXISTS", KEYS[1]) == 1 then
          redis.call("SET", KEYS[1], ARGV[1], "KEEPTTL")
          return 1
        end
        return 0
      `,
      1,
      key,
      serializedValue,
    );

    return result === 1 ? "OK" : null;
  }

  /**
   * Overwrites the given top-level fields of the JSON value at `key`, keeping the others,
   * atomically. false = the key doesn't exist (nothing is created). Keeps the TTL.
   *   room:7 = {"id":7,"title":"Old","host_id":42}  mergeJson("room:7", {title:"New"})
   *   → {"id":7,"title":"New","host_id":42}
   * Not for values holding lists: Redis's cjson writes an empty list back as {}.
   */
  public async mergeJson(key: string, fields: Record<string, unknown>): Promise<boolean> {
    const result = await this.client.eval(
      `
        local raw = redis.call("GET", KEYS[1])
        if not raw then return 0 end
        local value = cjson.decode(raw)
        for name, field in pairs(cjson.decode(ARGV[1])) do value[name] = field end
        redis.call("SET", KEYS[1], cjson.encode(value), "KEEPTTL")
        return 1
      `,
      1,
      key,
      JSON.stringify(fields),
    );

    return result === 1;
  }

  /**
   * Adds `item` to the number list `field` of the JSON value at `key`, atomically (one Lua
   * script, so two changes at once can't overwrite each other). Already there → unchanged.
   * false = the key doesn't exist (nothing is created). Keeps the TTL.
   *   user:42 = {"id":42,"rooms":[7]}  addToJsonList("user:42", "rooms", 9) → {"id":42,"rooms":[7,9]}
   */
  public async addToJsonList(key: string, field: string, item: number): Promise<boolean> {
    return this.changeJsonList(key, field, item, "add");
  }

  /** The opposite of addToJsonList. Not in the list → unchanged. false = the key doesn't exist. */
  public async removeFromJsonList(key: string, field: string, item: number): Promise<boolean> {
    return this.changeJsonList(key, field, item, "remove");
  }

  private async changeJsonList(
    key: string,
    field: string,
    item: number,
    change: "add" | "remove",
  ): Promise<boolean> {
    // The field name is put into a Lua string pattern below; letters and _ only keeps that safe.
    if (!/^[A-Za-z_]+$/.test(field)) {
      throw new Error(`Invalid JSON list field name: ${field}`);
    }
    // Redis's cjson encodes an empty Lua table as {} (proven on Redis 8, and it has no switch
    // for it), so an emptied list is written back as [] by hand.
    const result = await this.client.eval(
      `
        local raw = redis.call("GET", KEYS[1])
        if not raw then return 0 end
        local value = cjson.decode(raw)
        local field, item, change = ARGV[1], tonumber(ARGV[2]), ARGV[3]
        local list = value[field]
        if type(list) ~= "table" then list = {} end
        local out, found = {}, false
        for _, existing in ipairs(list) do
          if existing == item then
            found = true
            if change == "add" then table.insert(out, existing) end
          else
            table.insert(out, existing)
          end
        end
        if change == "add" and not found then table.insert(out, item) end
        value[field] = out
        local encoded = cjson.encode(value)
        if #out == 0 then
          encoded = string.gsub(encoded, '"' .. field .. '":{}', '"' .. field .. '":[]', 1)
        end
        redis.call("SET", KEYS[1], encoded, "KEEPTTL")
        return 1
      `,
      1,
      key,
      field,
      String(item),
      change,
    );

    return result === 1;
  }

  /**
   * HSETNX: sets `field` of the hash `key` to `value` (as JSON) only if the field isn't there,
   * and only while `requiredKey` exists, in one step (a Lua script). Safe to repeat.
   *   "added"   = it wasn't there, now it is
   *   "kept"    = already there; the stored value wins, `value` is ignored
   *   "missing" = `requiredKey` doesn't exist; nothing written
   *   setFieldIfAbsent("room:7:participants", "42", {...}, "room:7")
   * requiredKey stops a write for something deleted a moment earlier (room:7 deleted between
   * the caller's check and this call) from creating a hash nobody will ever delete.
   */
  public async setFieldIfAbsent(
    key: string,
    field: string,
    value: unknown,
    requiredKey: string,
  ): Promise<"added" | "kept" | "missing"> {
    const result = await this.client.eval(
      `
        if redis.call("EXISTS", KEYS[2]) == 0 then return -1 end
        return redis.call("HSETNX", KEYS[1], ARGV[1], ARGV[2])
      `,
      2,
      key,
      requiredKey,
      field,
      JSON.stringify(value),
    );

    if (result === -1) return "missing";
    return result === 1 ? "added" : "kept";
  }

  /** HDEL. false = the field (or the hash) wasn't there. */
  public async deleteField(key: string, field: string): Promise<boolean> {
    return (await this.client.hdel(key, field)) === 1;
  }

  /**
   * HGETALL. Each value is JSON, checked with `schema` like get(). {} when the hash doesn't exist.
   *   getAllFields("room:7:participants", ParticipantSchema) → { "42": {...}, "43": {...} }
   */
  public async getAllFields<T>(key: string, schema: Parser<T>): Promise<Record<string, T>> {
    const raw = await this.client.hgetall(key);

    return Object.fromEntries(
      Object.entries(raw).map(([field, value]) => [field, schema.parse(JSON.parse(value))]),
    );
  }

  /**
   * Runs a Lua script atomically (EVAL): nothing else runs in Redis until it ends. For logic
   * that belongs to one service (e.g. room-service's chat), so it stays in that service.
   * The reply is unknown: the caller checks its shape.
   *   runScript('return redis.call("GET", KEYS[1])', ["room:7"], [])
   */
  public async runScript(script: string, keys: string[], args: string[]): Promise<unknown> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }

  // DELETE: one call for several keys. Returns how many existed.
  public async delete(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  // EXISTS
  public async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  // EXPIRE
  public async expire(key: string, seconds: number): Promise<boolean> {
    return (await this.client.expire(key, seconds)) === 1;
  }

  // GET RAW REDIS CLIENT
  public getClient(): Redis {
    return this.client;
  }

  // DISCONNECT
  public async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
