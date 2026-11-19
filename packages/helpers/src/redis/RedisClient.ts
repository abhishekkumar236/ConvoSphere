import { Redis } from "ioredis";
import { EventEmitter } from "node:events";

export interface SetOptions {
  EX?: number;
  PX?: number;
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

  // SET
  public async set(
    key: string,
    value: unknown,
    options?: SetOptions,
  ): Promise<"OK" | null> {
    const serializedValue =
      typeof value === "string" ? value : JSON.stringify(value);

    if (options?.EX !== undefined) {
      return this.client.set(key, serializedValue, "EX", options.EX);
    }

    if (options?.PX !== undefined) {
      return this.client.set(key, serializedValue, "PX", options.PX);
    }

    return this.client.set(key, serializedValue);
  }

  // GET
  public async get<T = string>(key: string): Promise<T | null> {
    const value = await this.client.get(key);

    if (value === null) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  // UPDATE (atomic, preserves TTL)
  public async update(key: string, value: unknown): Promise<"OK" | null> {
    const serializedValue =
      typeof value === "string" ? value : JSON.stringify(value);

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
