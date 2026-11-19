import { MqttClientWrapper } from "helpers";
import { config } from "./config/index.js";

export class Service {
  private readonly mqtt: MqttClientWrapper;
  private shuttingDown = false;

  constructor() {
    this.mqtt = MqttClientWrapper.getInstance(config.MQTT_URL, {
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
   * Initialize the MQTT service.
   */
  public async init(): Promise<void> {
    console.info("[SERVICE] Starting MQTT service...");

    await this.registerMqttSubscriptions();

    console.info("[SERVICE] MQTT service initialized");
  }

  private registerListeners(): void {
    this.mqtt.on("connect", () => {
      console.info("[MQTT] Connected successfully");
      void this.onConnectHandler();
    });

    this.mqtt.on("message", (topic: string, payload: Buffer) => {
      void this.onMessageHandler(topic, payload);
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

  private async onConnectHandler(): Promise<void> {
    if (this.shuttingDown) return;

    try {
      console.info("[MQTT] Restoring subscriptions...");

      await this.initializeMqtt();

      console.info("[SERVICE] MQTT initialization completed");
    } catch (error) {
      console.error("[SERVICE] MQTT initialization failed:", error);
    }
  }

  private async initializeMqtt(): Promise<void> {
    await this.registerMqttSubscriptions();
  }

  private async registerMqttSubscriptions(): Promise<void> {
    await this.mqtt.subscribe("rooms/+/events", { qos: 1 });

    console.info("[MQTT] Application subscriptions registered");
  }

  /**
   * Handle incoming MQTT messages.
   */
  private async onMessageHandler(
    topic: string,
    payload: Buffer,
  ): Promise<void> {
    try {
      const message = JSON.parse(payload.toString());

      console.info("[MQTT] Message received:", {
        topic,
        message,
      });

      // Process your incoming request here.
      await this.processMessage(topic, message);
    } catch (error) {
      console.error("[MQTT] Message processing failed:", error);
    }
  }

  private async processMessage(topic: string, message: unknown): Promise<void> {
    // Implement your business logic here.
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
