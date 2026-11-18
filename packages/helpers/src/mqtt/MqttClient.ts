import mqtt, {
  type IClientOptions,
  type MqttClient,
  type IClientPublishOptions,
  type IClientSubscribeOptions,
} from "mqtt";

import { EventEmitter } from "node:events";

export interface ConnectionOptions extends IClientOptions {
  clientId: string;
  username: string;
  password: string;
}

export class MqttClientWrapper extends EventEmitter {
  private static instance: MqttClientWrapper | null = null;
  private readonly client: MqttClient;

  private constructor(url: string, options: ConnectionOptions) {
    super();

    this.client = mqtt.connect(url, {
      ...options,
      clean: options.clean ?? true,
      keepalive: options.keepalive ?? 60,
      reconnectPeriod: options.reconnectPeriod ?? 3000,
      connectTimeout: options.connectTimeout ?? 30000,
    });

    this.registerEvents();
  }

  public static getInstance(
    url: string,
    options: ConnectionOptions,
  ): MqttClientWrapper {
    if (!MqttClientWrapper.instance) {
      MqttClientWrapper.instance = new MqttClientWrapper(url, options);
    }

    return MqttClientWrapper.instance;
  }

  private registerEvents(): void {
    this.client.on("connect", (packet) => {
      this.emit("connect", packet);
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
      this.emit("message", topic, payload, packet);
    });
  }

  public getClient(): MqttClient {
    return this.client;
  }

  public async publish(
    topic: string,
    message: string | Buffer,
    options?: IClientPublishOptions,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.client.publish(topic, message, options ?? {}, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public async subscribe(
    topic: string,
    options?: IClientSubscribeOptions,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.client.subscribe(topic, options ?? {}, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.client.connected && !this.client.reconnecting) {
      return;
    }

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
