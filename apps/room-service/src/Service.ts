import { hostname } from "node:os";
import { AmqpClientWrapper, MqttTokenService } from "helpers";
import { config } from "./config/index.js";
import { EventFactory } from "./services/EventFactory.js";
import { CommandGuard } from "./services/CommandGuard.js";
import { CommandProcessor } from "./messaging/CommandProcessor.js";
import { CommandReplies } from "./messaging/CommandReplies.js";
import {
  COMMANDS_PREFETCH,
  COMMANDS_QUEUE,
  MAX_ATTEMPTS,
  RETRY_EXCHANGE,
  roomServiceTopology,
} from "./messaging/topology.js";

/**
 * room-service talks to RabbitMQ over AMQP only. Commands come from the shared quorum queue
 * (each to exactly one instance); replies and broadcasts are published to amq.topic, which
 * delivers them to the apps' MQTT subscriptions. See docs/room-service-plan.md.
 */
export class Service {
  private readonly amqp: AmqpClientWrapper;
  private readonly processor: CommandProcessor;
  /** Which instance handled what, in logs and in the RabbitMQ management UI. */
  private readonly instanceId = `${config.SERVICE_NAME}-${hostname()}-${process.pid}`;
  private shuttingDown = false;

  constructor() {
    this.amqp = AmqpClientWrapper.initialize(config.AMQP_URL, {
      connectionName: this.instanceId,
    });

    // Verifies only (the api signs), so no expiry is needed here.
    const guard = new CommandGuard(new MqttTokenService(config.MQTT_TOKEN_SECRET));
    const replies = new CommandReplies((exchange, routingKey, payload) =>
      this.amqp.publish(exchange, routingKey, payload),
    );
    this.processor = new CommandProcessor(guard, replies, (command) => EventFactory.create(command));

    this.registerListeners();
    this.registerShutdownHandlers();
  }

  public async init(): Promise<void> {
    console.info(`[SERVICE] Starting ${this.instanceId}...`);

    await this.amqp.connect();
    await this.amqp.declare(roomServiceTopology);
    await this.amqp.consume(COMMANDS_QUEUE, this.processor.process, {
      prefetch: COMMANDS_PREFETCH,
      retry: { exchange: RETRY_EXCHANGE, maxAttempts: MAX_ATTEMPTS },
    });

    console.info(`[AMQP] Consuming ${COMMANDS_QUEUE} (prefetch ${COMMANDS_PREFETCH}, ${MAX_ATTEMPTS} attempts)`);
  }

  private registerListeners(): void {
    this.amqp.on("connect", () => console.info("[AMQP] Connected"));
    this.amqp.on("disconnect", (error: Error) => console.warn("[AMQP] Disconnected:", error.message));
    this.amqp.on("reconnect", ({ attempt, delay }: { attempt: number; delay: number }) =>
      console.info(`[AMQP] Reconnect attempt ${attempt} in ${delay}ms`),
    );
    this.amqp.on("error", (error: Error) => console.error("[AMQP] Error:", error.message));
    // One line per failed delivery: where it goes next. Never the body (it carries tokens).
    this.amqp.on(
      "handler-failed",
      ({ message, outcome }: { message: { routingKey: string; attempt: number }; outcome: string }) =>
        console.warn(`[AMQP] ${message.routingKey} attempt ${message.attempt} failed → ${outcome}`),
    );
  }

  private registerShutdownHandlers(): void {
    process.once("SIGINT", () => void this.deinit());
    process.once("SIGTERM", () => void this.deinit());
  }

  /** Stops taking commands, lets the ones in progress finish and ack, then disconnects. */
  public async deinit(): Promise<void> {
    if (this.shuttingDown) return;

    this.shuttingDown = true;

    console.info("[SERVICE] Shutting down...");

    try {
      await this.amqp.disconnect();
      console.info("[SERVICE] Shutdown completed");
    } catch (error) {
      console.error("[SERVICE] Shutdown failed:", error);
      process.exitCode = 1;
    }
  }
}
