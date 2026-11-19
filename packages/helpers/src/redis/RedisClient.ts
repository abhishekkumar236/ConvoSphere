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

  private constructor(url: string) {
    super();

    this.client = new Redis(url);

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

  // DELETE
  public async delete(key: string): Promise<number> {
    return this.client.del(key);
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
