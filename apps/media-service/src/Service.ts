import { MqttClientWrapper, MqttTokenService } from "helpers";
import { BaseCommandSchema } from "types";
import { config } from "./config/index.js";
import { EventFactory } from "./services/EventFactory.js";
import { CommandGuard, CommandRejected } from "./services/CommandGuard.js";

export class Service {
  private readonly mqtt: MqttClientWrapper;
  private readonly guard: CommandGuard;
  private shuttingDown = false;

  constructor() {
    // Verifies only (the api signs), so no expiry is needed here.
    this.guard = new CommandGuard(new MqttTokenService(config.MQTT_TOKEN_SECRET));

    this.mqtt = MqttClientWrapper.initialize(config.MQTT_URL, {
      username: config.MQTT_USERNAME,
      password: config.MQTT_PASSWORD,
      clientId: config.MQTT_CLIENT_ID,
      clean: config.MQTT_CLEAN_SESSION,
      reconnectPeriod: config.MQTT_RECONNECT_PERIOD,
      connectTimeout: config.MQTT_CONNECTION_TIMEOUT,
      keepalive: 60,
    });

    this.registerListeners();
    this.registerShutdownHandlers();
  }

  /**
   * Starts the service. Subscribes once: the wrapper re-sends subscriptions after every
   * reconnect, and before the first connect it sends them as soon as the broker is reached.
   */
  public async init(): Promise<void> {
    console.info("[SERVICE] Starting MQTT service...");

    await this.mqtt.subscribe("rooms/+/events", this.onCommand, { qos: 1 });

    console.info("[MQTT] Application subscriptions registered");
  }

  /**
   * One command message: JSON → checked against BaseCommandSchema → tokens checked by
   * CommandGuard → its event handles it. Throwing is fine: the wrapper logs it and keeps going.
   */
  private onCommand = async (topic: string, payload: Buffer): Promise<void> => {
    const parsed = BaseCommandSchema.safeParse(JSON.parse(payload.toString()));
    if (!parsed.success) {
      console.warn(`[MQTT] Ignored invalid command on "${topic}":`, parsed.error.issues);
      return;
    }

    const command = parsed.data;
    try {
      this.guard.check(command);
    } catch (error) {
      if (error instanceof CommandRejected) {
        // The claimed clientId, never the tokens.
        console.warn(
          `[MQTT] Rejected "${command.command}" claiming ${command.token.clientId} on "${topic}": ${error.message}`,
        );
        return;
      }
      throw error;
    }

    await EventFactory.create(command.command).process(command);
  };

  private registerListeners(): void {
    this.mqtt.on("connect", () => {
      console.info("[MQTT] Connected successfully");
    });

    this.mqtt.on("reconnect", () => {
      console.info("[MQTT] Attempting to reconnect...");
    });

    this.mqtt.on("offline", () => {
      console.warn("[MQTT] Broker connection is offline");
    });

    this.mqtt.on("close", () => {
      console.warn("[MQTT] Broker connection closed");
    });

    this.mqtt.on("error", (error: Error) => {
      console.error("[MQTT] Connection error:", error.message);
    });
  }

  private registerShutdownHandlers(): void {
    process.once("SIGINT", () => void this.deinit());
    process.once("SIGTERM", () => void this.deinit());
  }

  public async deinit(): Promise<void> {
    if (this.shuttingDown) return;

    this.shuttingDown = true;

    console.info("[SERVICE] Shutting down...");

    try {
      await this.mqtt.disconnect();
      console.info("[SERVICE] Shutdown completed");
    } catch (error) {
      console.error("[SERVICE] Shutdown failed:", error);
      process.exitCode = 1;
    }
  }
}
