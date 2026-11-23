import amqp, {
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
  type Options,
  type RecoveringChannelModel,
} from "amqplib";
import { EventEmitter } from "node:events";

export interface AmqpConnectionOptions {
  /** Shown in the RabbitMQ management UI, e.g. "room-service-host1-1234". */
  connectionName: string;
  /** Failed attempts allowed before the very first connection gives up. Default 10. */
  startupRetries?: number;
}

export interface ExchangeSpec {
  name: string;
  type: "topic" | "direct" | "fanout" | "headers";
  options?: Options.AssertExchange;
}

export interface QueueSpec {
  name: string;
  options?: Options.AssertQueue;
  /** Routing patterns this queue receives from each exchange. */
  bindings?: { exchange: string; pattern: string }[];
}

/** Exchanges first, then queues with their bindings. Applied again after every reconnect. */
export interface Topology {
  exchanges?: ExchangeSpec[];
  queues?: QueueSpec[];
}

/** One delivered message: no amqplib types leak to the handler. */
export interface AmqpMessage {
  exchange: string;
  /** e.g. "users.user-42.cmd" (an MQTT topic users/user-42/cmd, with "/" turned into "."). */
  routingKey: string;
  body: Buffer;
  headers: Record<string, unknown>;
  /**
   * 1 on the first try. Counts both retries after a thrown error (the x-attempt header on retry
   * copies) and redeliveries after a consumer crash (quorum queue x-delivery-count).
   */
  attempt: number;
  /** True when a failure now is final (dead-lettered, no more retries): time to tell the user. */
  isLastAttempt: boolean;
}

/**
 * Resolve → ack. Throw RejectMessage → dead-letter now (no retry). Throw anything else →
 * retried (see ConsumeOptions.retry), or dead-lettered once the attempts are used up.
 */
export type AmqpMessageHandler = (message: AmqpMessage) => Promise<void>;

/** Throw from a handler when retrying can't help (bad input, not allowed): dead-letter at once. */
export class RejectMessage extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "RejectMessage";
  }
}

/**
 * Retry after a thrown error by publishing a copy to `exchange` (with x-attempt + 1) and acking
 * the original. That exchange's queue should hold the copy for a while (x-message-ttl) and then
 * dead-letter it back to where it came from, keeping its routing key.
 * Why not nack + requeue: RabbitMQ 4 doesn't count a requeue towards x-delivery-limit, so a
 * failing message comes straight back forever (measured: 1,300+ times in 4 s).
 */
export interface RetryOptions {
  exchange: string;
  /** Attempts in total, the first one included. After the last, the message is dead-lettered. */
  maxAttempts: number;
}

export interface ConsumeOptions {
  /** Unacked messages this consumer may hold at once. Default 10. */
  prefetch?: number;
  /**
   * How thrown errors are retried. Without it a failed message is dead-lettered right away
   * (never requeued: see RetryOptions for why).
   */
  retry?: RetryOptions;
}

export interface AmqpPublishOptions {
  /** Survives a broker restart (delivery mode 2). Default true. */
  persistent?: boolean;
  headers?: Record<string, unknown>;
  /** Dropped if not delivered within this many ms. */
  expirationMs?: number;
  messageId?: string;
}

/** A string or Buffer is sent as is; anything else as JSON. */
export type AmqpPayload = string | Buffer | object;

interface ConsumerEntry {
  handler: AmqpMessageHandler;
  prefetch: number;
  retry: RetryOptions | undefined;
  channel: Channel | null;
  consumerTag: string | null;
}

/** Our own attempt counter, carried on retry copies. */
const ATTEMPT_HEADER = "x-attempt";
/** Headers RabbitMQ adds per delivery/dead-lettering: not copied onto a retry copy. */
const BROKER_HEADERS = [
  "x-delivery-count",
  "x-death",
  "x-first-death-exchange",
  "x-first-death-queue",
  "x-first-death-reason",
  "x-last-death-exchange",
  "x-last-death-queue",
  "x-last-death-reason",
];

/**
 * RabbitMQ over AMQP 0-9-1, the same style as MqttClientWrapper and RedisClient.
 *   const amqp = AmqpClientWrapper.initialize(url, { connectionName: "room-service-1" });
 *   await amqp.connect();
 *   await amqp.declare({ queues: [{ name: "jobs", options: { durable: true } }] });
 *   await amqp.consume("jobs", async (message) => { ... }, { prefetch: 20 });
 *   await amqp.publish("amq.topic", "rooms.7.events", { type: "hello" });
 * Reconnects by itself (amqplib recovery); declarations and consumers are restored each time.
 */
export class AmqpClientWrapper extends EventEmitter {
  private static instance: AmqpClientWrapper | null = null;
  /** Delay before reopening a channel that closed while the connection stayed up. */
  private static readonly CHANNEL_REOPEN_DELAY_MS = 1000;
  private static readonly DEFAULT_PREFETCH = 10;

  private readonly url: string;
  private readonly options: AmqpConnectionOptions;
  private connection: RecoveringChannelModel | null = null;
  /** The live connection underneath; null while disconnected. */
  private model: ChannelModel | null = null;
  private publishChannel: ConfirmChannel | null = null;
  private readonly topologies: Topology[] = [];
  private readonly consumers = new Map<string, ConsumerEntry>();
  private readonly inFlight = new Set<Promise<void>>();
  private stopping = false;

  private constructor(url: string, options: AmqpConnectionOptions) {
    super();
    this.url = url;
    this.options = options;
  }

  // Initialize only once. A second call throws: its url/options would otherwise be ignored.
  public static initialize(
    url: string,
    options: AmqpConnectionOptions,
  ): AmqpClientWrapper {
    if (AmqpClientWrapper.instance) {
      throw new Error(
        "AMQP is already initialized. Use AmqpClientWrapper.getInstance().",
      );
    }
    AmqpClientWrapper.instance = new AmqpClientWrapper(url, options);
    return AmqpClientWrapper.instance;
  }

  public static getInstance(): AmqpClientWrapper {
    if (!AmqpClientWrapper.instance) {
      throw new Error(
        "AMQP is not initialized. Call AmqpClientWrapper.initialize() first.",
      );
    }
    return AmqpClientWrapper.instance;
  }

  /** Resolves once connected. Rejects if the broker stays unreachable through startupRetries. */
  public async connect(): Promise<void> {
    this.connection = await amqp.connect(this.url, {
      clientProperties: { connection_name: this.options.connectionName },
      recovery: {
        initialDelay: 500,
        maxDelay: 10_000,
        initialMaxRetries: this.options.startupRetries ?? 10,
        maxRetries: Infinity,
        // Runs after every (re)connect: channels and consumers from before are gone.
        setup: (model: ChannelModel) => this.onConnected(model),
      },
    });

    this.connection.on("disconnect", (error: Error) => {
      this.model = null;
      this.publishChannel = null;
      for (const entry of this.consumers.values()) {
        entry.channel = null;
        entry.consumerTag = null;
      }
      this.emit("disconnect", error);
    });
    this.connection.on(
      "reconnect-scheduled",
      (info: { attempt: number; delay: number }) => {
        this.emit("reconnect", info);
      },
    );
    this.connection.on("error", (error: Error) => this.emit("error", error));
    this.connection.on("handler-error", (error: Error) =>
      this.emit("error", error),
    );
  }

  /** Declares now (if connected) and again after every reconnect. Safe to repeat. */
  public async declare(topology: Topology): Promise<void> {
    this.topologies.push(topology);
    if (this.model) await this.applyTopology(this.model, topology);
  }

  /**
   * Consumes `queue` until disconnect(). One consumer per queue per client; resumed by itself
   * after a reconnect. See AmqpMessageHandler for how the handler's outcome is acknowledged.
   */
  public async consume(
    queue: string,
    handler: AmqpMessageHandler,
    options: ConsumeOptions = {},
  ): Promise<void> {
    if (this.consumers.has(queue)) {
      throw new Error(`Already consuming "${queue}"`);
    }
    if (
      options.retry &&
      (!Number.isInteger(options.retry.maxAttempts) ||
        options.retry.maxAttempts < 1)
    ) {
      throw new Error(`retry.maxAttempts must be a whole number of at least 1`);
    }
    const entry: ConsumerEntry = {
      handler,
      prefetch: options.prefetch ?? AmqpClientWrapper.DEFAULT_PREFETCH,
      retry: options.retry,
      channel: null,
      consumerTag: null,
    };
    this.consumers.set(queue, entry);
    if (this.model) await this.startConsumer(this.model, queue, entry);
  }

  /**
   * Resolves once the broker confirmed it has the message. Rejects while disconnected (fail
   * fast; the caller decides whether to retry) or if the broker refuses it.
   */
  public async publish(
    exchange: string,
    routingKey: string,
    payload: AmqpPayload,
    options: AmqpPublishOptions = {},
  ): Promise<void> {
    const channel = await this.getPublishChannel();
    const body =
      typeof payload === "string"
        ? Buffer.from(payload)
        : Buffer.isBuffer(payload)
          ? payload
          : Buffer.from(JSON.stringify(payload));
    const isJson = !(typeof payload === "string" || Buffer.isBuffer(payload));

    const publishOptions: Options.Publish = {
      persistent: options.persistent ?? true,
      ...(isJson ? { contentType: "application/json" } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.expirationMs !== undefined
        ? { expiration: String(options.expirationMs) }
        : {}),
      ...(options.messageId ? { messageId: options.messageId } : {}),
    };

    await new Promise<void>((resolve, reject) => {
      channel.publish(exchange, routingKey, body, publishOptions, (error) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Stops taking new messages, waits for those in progress (they ack themselves), then closes.
   * Anything not acked by then goes back to the queue for another consumer.
   */
  public async disconnect(): Promise<void> {
    this.stopping = true;
    for (const entry of this.consumers.values()) {
      if (entry.channel && entry.consumerTag) {
        try {
          await entry.channel.cancel(entry.consumerTag);
        } catch {
          // Channel already gone: nothing more will arrive on it.
        }
      }
    }
    await Promise.allSettled(this.inFlight);
    await this.connection?.close();

    if (AmqpClientWrapper.instance === this) {
      AmqpClientWrapper.instance = null;
    }
  }

  private async onConnected(model: ChannelModel): Promise<void> {
    for (const topology of this.topologies) {
      await this.applyTopology(model, topology);
    }
    this.model = model;
    this.publishChannel = null; // opened on the next publish
    for (const [queue, entry] of this.consumers) {
      await this.startConsumer(model, queue, entry);
    }
    this.emit("connect");
  }

  private async applyTopology(
    model: ChannelModel,
    topology: Topology,
  ): Promise<void> {
    // A short-lived channel: a declaration error (e.g. different queue arguments) closes it,
    // and must not take a consumer channel down with it.
    const channel = await model.createChannel();
    try {
      for (const exchange of topology.exchanges ?? []) {
        await channel.assertExchange(
          exchange.name,
          exchange.type,
          exchange.options,
        );
      }
      for (const queue of topology.queues ?? []) {
        await channel.assertQueue(queue.name, queue.options);
        for (const binding of queue.bindings ?? []) {
          await channel.bindQueue(
            queue.name,
            binding.exchange,
            binding.pattern,
          );
        }
      }
    } finally {
      await channel.close().catch(() => undefined);
    }
  }

  private async startConsumer(
    model: ChannelModel,
    queue: string,
    entry: ConsumerEntry,
  ): Promise<void> {
    const channel = await model.createChannel();
    channel.on("error", (error: Error) => this.emit("error", error));
    channel.on("handler-error", (error: Error) => this.emit("error", error));
    // A channel can close on its own (e.g. a protocol error) while the connection stays up;
    // amqplib's recovery only reacts to lost connections, so reopen it here.
    channel.on("close", () => {
      if (entry.channel === channel) {
        entry.channel = null;
        entry.consumerTag = null;
      }
      if (this.stopping) return;
      setTimeout(() => {
        if (this.stopping || entry.channel || this.model !== model) return;
        this.startConsumer(model, queue, entry).catch((error: unknown) => {
          this.emit(
            "error",
            error instanceof Error ? error : new Error(String(error)),
          );
        });
      }, AmqpClientWrapper.CHANNEL_REOPEN_DELAY_MS);
    });

    await channel.prefetch(entry.prefetch);
    const { consumerTag } = await channel.consume(
      queue,
      (message) => {
        if (message) this.track(this.handle(channel, entry, message));
      },
      { noAck: false },
    );
    entry.channel = channel;
    entry.consumerTag = consumerTag;
  }

  /**
   *   resolved                         → ack
   *   RejectMessage                    → dead-letter (nack, no requeue)
   *   other error, attempts left       → copy to the retry exchange with x-attempt + 1, then ack
   *   other error, last attempt / no retry configured → dead-letter
   */

 
  private async handle(
    channel: Channel,
    entry: ConsumerEntry,
    message: ConsumeMessage,
  ): Promise<void> {
    const headers = (message.properties.headers ?? {}) as Record<
      string,
      unknown
    >;
    // Retry copies carry x-attempt; a crash redelivery adds to x-delivery-count on top of it.
    const attempt =
      Number(headers[ATTEMPT_HEADER] ?? 1) +
      Number(headers["x-delivery-count"] ?? 0);
    const maxAttempts = entry.retry?.maxAttempts ?? 1;
    const delivered: AmqpMessage = {
      exchange: message.fields.exchange,
      routingKey: message.fields.routingKey,
      body: message.content,
      headers,
      attempt,
      isLastAttempt: attempt >= maxAttempts,
    };

    let outcome: "ack" | "dead-letter" | "retry";
    try {
      await entry.handler(delivered);
      outcome = "ack";
    } catch (error) {
      outcome =
        error instanceof RejectMessage ||
        delivered.isLastAttempt ||
        !entry.retry
          ? "dead-letter"
          : "retry";
      this.emit("handler-failed", { message: delivered, error, outcome });
    }

    if (outcome === "retry" && entry.retry) {
      try {
        await this.publishRetryCopy(
          entry.retry.exchange,
          message,
          headers,
          attempt + 1,
        );
      } catch (error) {
        // Couldn't park the copy: put the original back instead, so it isn't lost.
        this.emit(
          "error",
          error instanceof Error ? error : new Error(String(error)),
        );
        this.settle(channel, message, "requeue");
        return;
      }
    }
    this.settle(
      channel,
      message,
      outcome === "dead-letter" ? "dead-letter" : "ack",
    );
  }

  /** Same body, properties and routing key; broker headers dropped; x-attempt set. */
  private async publishRetryCopy(
    exchange: string,
    message: ConsumeMessage,
    headers: Record<string, unknown>,
    nextAttempt: number,
  ): Promise<void> {
    const copyHeaders: Record<string, unknown> = {
      ...headers,
      [ATTEMPT_HEADER]: nextAttempt,
    };
    for (const name of BROKER_HEADERS) delete copyHeaders[name];

    const channel = await this.getPublishChannel();
    const { properties } = message;
    await new Promise<void>((resolve, reject) => {
      channel.publish(
        exchange,
        message.fields.routingKey,
        message.content,
        {
          persistent: true,
          headers: copyHeaders,
          ...(properties.contentType
            ? { contentType: properties.contentType }
            : {}),
          ...(properties.messageId ? { messageId: properties.messageId } : {}),
        },
        (error) =>
          error
            ? reject(error instanceof Error ? error : new Error(String(error)))
            : resolve(),
      );
    });
  }

  private settle(
    channel: Channel,
    message: ConsumeMessage,
    how: "ack" | "dead-letter" | "requeue",
  ): void {
    try {
      if (how === "ack") channel.ack(message);
      else channel.nack(message, false, how === "requeue");
    } catch (error) {
      // The channel closed while the handler ran: RabbitMQ redelivers the message to someone.
      this.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async getPublishChannel(): Promise<ConfirmChannel> {
    if (this.publishChannel) return this.publishChannel;
    const model = this.model;
    if (!model) throw new Error("AMQP is not connected");

    const channel = await model.createConfirmChannel();
    channel.on("error", (error: Error) => this.emit("error", error));
    channel.on("close", () => {
      if (this.publishChannel === channel) this.publishChannel = null;
    });
    this.publishChannel = channel;
    return channel;
  }

  private track(work: Promise<void>): void {
    this.inFlight.add(work);
    void work.finally(() => this.inFlight.delete(work));
  }
}
