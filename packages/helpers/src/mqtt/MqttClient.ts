import mqtt, {
  type IClientOptions,
  type IClientPublishOptions,
  type IPublishPacket,
  type MqttClient,
} from "mqtt";

import { EventEmitter } from "node:events";

export interface MqttConnectionOptions extends IClientOptions {
  clientId: string;
  username: string;
  password: string;
}

/**
 * No QoS 2: RabbitMQ doesn't support it. A QoS 2 publish makes it close the connection
 * (reason 155, "QoS not supported"), and mqtt.js re-sends it after every reconnect → the
 * connection drops forever and the publish never finishes. Tested against RabbitMQ 4.4.
 */
export type QoS = 0 | 1;

/** Called for every message whose topic matches the filter it was subscribed with. */
export type MessageHandler = (
  topic: string,
  payload: Buffer,
  packet: IPublishPacket,
) => void | Promise<void>;

export interface SubscribeOptions {
  /** Default 1. */
  qos?: QoS;
}

export interface PublishOptions {
  /** Default 0. */
  qos?: QoS;
  /** The broker keeps the last retained message per topic and gives it to new subscribers. */
  retain?: boolean;
  /**
   * Seconds the message stays deliverable (MQTT 5 message expiry). Not delivered yet when it
   * runs out (e.g. waiting for an offline subscriber) → dropped. Needs protocolVersion 5.
   */
  ttl?: number;
}

/** A string or Buffer is sent as is; anything else as JSON. */
export type PublishPayload = string | Buffer | object;

/** Kept for a session when `clean: false` and no sessionExpiryInterval is given (= broker max). */
const DEFAULT_SESSION_EXPIRY_SECONDS = 86_400;

export class MqttClientWrapper extends EventEmitter {
  private static instance: MqttClientWrapper | null = null;

  private readonly client: MqttClient;
  /** filter → its QoS and handlers. Re-subscribed on every connect, so callers subscribe once. */
  private readonly subscriptions = new Map<
    string,
    { qos: QoS; handlers: Set<MessageHandler> }
  >();

  private constructor(url: string, options: MqttConnectionOptions) {
    super();

    const protocolVersion = options.protocolVersion ?? 5;
    const clean = options.clean ?? true;

    this.client = mqtt.connect(url, {
      ...options,
      protocolVersion,
      clean,
      keepalive: options.keepalive ?? 60,
      reconnectPeriod: options.reconnectPeriod ?? 3000,
      connectTimeout: options.connectTimeout ?? 30000,
      // This class re-subscribes itself on every connect (see onConnect).
      resubscribe: false,
      // MQTT 5: clean: false alone no longer keeps the session after a disconnect; it also needs
      // a session expiry interval. Without this, clean: false would silently stop working.
      ...(protocolVersion === 5 && !clean
        ? {
            properties: {
              sessionExpiryInterval: DEFAULT_SESSION_EXPIRY_SECONDS,
              ...options.properties,
            },
          }
        : {}),
    });

    this.registerEvents();
  }

  // Initialize MQTT only once. A second call throws: its url/options would otherwise be
  // silently ignored. Use getInstance() to reach the existing client.
  public static initialize(
    url: string,
    options: MqttConnectionOptions,
  ): MqttClientWrapper {
    if (MqttClientWrapper.instance) {
      throw new Error(
        "MQTT is already initialized. Use MqttClientWrapper.getInstance().",
      );
    }

    MqttClientWrapper.instance = new MqttClientWrapper(url, options);
    return MqttClientWrapper.instance;
  }

  // Access existing MQTT instance anywhere
  public static getInstance(): MqttClientWrapper {
    if (!MqttClientWrapper.instance) {
      throw new Error(
        "MQTT is not initialized. Call MqttClientWrapper.initialize() first.",
      );
    }

    return MqttClientWrapper.instance;
  }

  /**
   * MQTT wildcard match: "+" = exactly one level, "#" = this level and everything below.
   *   matches("rooms/+/events", "rooms/7/events") → true
   *   matches("rooms/#", "rooms")                 → true  ("#" includes the parent)
   *   matches("rooms/+", "rooms/7/events")        → false
   */
  public static matches(filter: string, topic: string): boolean {
    const filterLevels = filter.split("/");
    const topicLevels = topic.split("/");

    // Topics starting with "$" (broker topics) never match a leading wildcard.
    if (topic.startsWith("$") && (filter.startsWith("+") || filter.startsWith("#"))) {
      return false;
    }

    for (let i = 0; i < filterLevels.length; i++) {
      const level = filterLevels[i];
      if (level === "#") return true;
      if (i >= topicLevels.length) return false;
      if (level !== "+" && level !== topicLevels[i]) return false;
    }
    return filterLevels.length === topicLevels.length;
  }

  private registerEvents(): void {
    this.client.on("connect", (packet) => {
      this.emit("connect", packet);
      void this.resubscribeAll();
    });

    this.client.on("reconnect", () => {
      this.emit("reconnect");
    });

    this.client.on("close", () => {
      this.emit("close");
    });

    this.client.on("offline", () => {
      this.emit("offline");
    });

    this.client.on("error", (error) => {
      this.emit("error", error);
    });

    this.client.on("message", (topic, payload, packet) => {
      this.dispatch(topic, payload, packet);
      // Still emitted, for code that listens to every message.
      this.emit("message", topic, payload, packet);
    });
  }

  /** Runs every handler whose filter matches. One failing handler doesn't stop the others. */
  private dispatch(topic: string, payload: Buffer, packet: IPublishPacket): void {
    for (const [filter, { handlers }] of this.subscriptions) {
      if (!MqttClientWrapper.matches(filter, topic)) continue;

      for (const handler of handlers) {
        Promise.resolve()
          .then(() => handler(topic, payload, packet))
          .catch((error: unknown) => {
            console.error(`[MQTT] Handler for "${filter}" failed on "${topic}":`, error);
          });
      }
    }
  }

  /** After a (re)connect the broker may have no subscriptions for us: send them all again. */
  private async resubscribeAll(): Promise<void> {
    for (const [filter, { qos }] of this.subscriptions) {
      try {
        await this.sendSubscribe(filter, qos);
      } catch (error) {
        this.emit("error", error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async sendSubscribe(filter: string, qos: QoS): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.client.subscribe(filter, { qos }, (error, granted) => {
        if (error) {
          reject(error);
          return;
        }
        // 128 (0x80) or higher = the broker refused it, e.g. not allowed for this user.
        const refused = granted?.find((grant) => grant.qos >= 128);
        if (refused) {
          reject(new Error(`Subscription to "${filter}" refused by the broker`));
          return;
        }
        resolve();
      });
    });
  }

  public getClient(): MqttClient {
    return this.client;
  }

  // PUBLISH
  public async publish(
    topic: string,
    payload: PublishPayload,
    options: PublishOptions = {},
  ): Promise<void> {
    const body =
      typeof payload === "string" || Buffer.isBuffer(payload)
        ? payload
        : JSON.stringify(payload);

    const qos = options.qos ?? 0;
    // The type already excludes 2; this catches callers that get past it (casts, plain JS).
    if (qos !== 0 && qos !== 1) {
      throw new Error(`qos must be 0 or 1 (RabbitMQ has no QoS 2), got ${String(qos)}`);
    }

    const publishOptions: IClientPublishOptions = {
      qos,
      retain: options.retain ?? false,
    };

    if (options.ttl !== undefined) {
      if (!Number.isInteger(options.ttl) || options.ttl <= 0) {
        throw new Error(`ttl must be a whole number of seconds above 0, got ${options.ttl}`);
      }
      if (this.client.options.protocolVersion !== 5) {
        throw new Error("ttl needs MQTT 5 (protocolVersion: 5)");
      }
      publishOptions.properties = { messageExpiryInterval: options.ttl };
    }

    await new Promise<void>((resolve, reject) => {
      this.client.publish(topic, body, publishOptions, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  /**
   * Calls `handler` for every message matching `filter` (wildcards allowed), as long as the
   * subscription lasts, reconnects included: subscribe once at startup.
   *   await mqtt.subscribe("users/+/cmd", async (topic, payload) => { ... }, { qos: 1 });
   * While connected, resolves once the broker accepted (rejects if refused, and the handler is
   * not kept). While offline, resolves at once; the subscription is sent on connect.
   */
  public async subscribe(
    filter: string,
    handler: MessageHandler,
    options: SubscribeOptions = {},
  ): Promise<void> {
    const qos = options.qos ?? 1;
    const existing = this.subscriptions.get(filter);

    if (existing) {
      existing.handlers.add(handler);
      return;
    }

    this.subscriptions.set(filter, { qos, handlers: new Set([handler]) });
    if (!this.client.connected) return;

    try {
      await this.sendSubscribe(filter, qos);
    } catch (error) {
      this.subscriptions.delete(filter);
      throw error;
    }
  }

  /**
   * Removes one handler, or all handlers when none is given. When the filter has no handlers
   * left, the broker subscription is removed too.
   */
  public async unsubscribe(filter: string, handler?: MessageHandler): Promise<void> {
    const existing = this.subscriptions.get(filter);
    if (!existing) return;

    if (handler) existing.handlers.delete(handler);
    if (handler && existing.handlers.size > 0) return;

    this.subscriptions.delete(filter);
    if (!this.client.connected) return;

    await new Promise<void>((resolve, reject) => {
      this.client.unsubscribe(filter, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  // DISCONNECT. Always calls end(), also while offline between reconnect attempts: end() is
  // what stops the reconnect timer, which otherwise keeps the process alive after shutdown.
  public async disconnect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.client.end(false, {}, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    if (MqttClientWrapper.instance === this) {
      MqttClientWrapper.instance = null;
    }
  }
}
