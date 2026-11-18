import { MqttClientWrapper } from "helpers";
import { config } from "./config/index.js";

export class Service {
  private readonly mqtt: MqttClientWrapper;

  private isConnected = false;
  private isShuttingDown = false;

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
  }

  private registerListeners(): void {
    this.mqtt.on("connect", () => {
      void this.connected();
    });

    this.mqtt.on("reconnect", () => {
      this.isConnected = false;
      console.info("[MQTT] Attempting to reconnect...");
    });

    this.mqtt.on("offline", () => {
      this.isConnected = false;
      console.warn("[MQTT] Broker connection is offline");
    });

    this.mqtt.on("close", () => {
      this.isConnected = false;
      console.warn("[MQTT] Broker connection closed");
    });

    this.mqtt.on("error", (error: Error) => {
      console.error("[MQTT] Connection error:", error.message);
    });
  }

  private async connected(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isConnected = true;

    console.info("[MQTT] Connected successfully");

    try {
      await this.initializeMqtt();

      console.info("[SERVICE] MQTT initialization completed");
    } catch (error) {
      console.error("[SERVICE] MQTT initialization failed:", error);
    }
  }

  private async initializeMqtt(): Promise<void> {
    await this.registerMqttSubscriptions();

    // Initialize other MQTT-dependent application components here.
  }

  private async registerMqttSubscriptions(): Promise<void> {
    await this.mqtt.subscribe("rooms/+/events", { qos: 1 });

    console.info("[MQTT] Application subscriptions registered");
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    this.isConnected = false;

    console.info("[SERVICE] Shutting down services...");

    await this.mqtt.disconnect();

    console.info("[SERVICE] Services shutdown completed");
  }
}
