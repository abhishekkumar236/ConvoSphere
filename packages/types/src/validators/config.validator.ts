import { z } from "zod";

export const ConfigSchema = z.object({
  ACCESS_TOKEN_SECRET: z.string().min(1, "ACCESS_TOKEN_SECRET is required"),
  ACCESS_TOKEN_EXPIRY: z.coerce
    .number()
    .int()
    .min(1, "ACCESS_TOKEN_EXPIRY is required"),
  MQTT_URL: z.string().min(1, "MQTT_URL is required"),
  MQTT_USERNAME: z.string().min(1, "MQTT_USERNAME is required"),
  MQTT_PASSWORD: z.string().min(1, "MQTT_PASSWORD is required"),
  SERVICE_NAME: z.string().min(1, "SERVICE_NAME is required"),
  MQTT_RECONNECT_PERIOD: z.number(),
  MQTT_CONNECTION_TIMEOUT: z.number(),
  MQTT_CLEAN_SESSION: z.boolean(),
  MQTT_CLIENT_ID: z.string().min(1, "MQTT_CLIENT_ID is required"),
});

export const ApiConfigSchema = ConfigSchema.pick({
  ACCESS_TOKEN_EXPIRY: true,
  ACCESS_TOKEN_SECRET: true,
  SERVICE_NAME: true,
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

export const MediaServiceConfigSchema = ConfigSchema.pick({
  MQTT_URL: true,
  MQTT_USERNAME: true,
  MQTT_PASSWORD: true,
  SERVICE_NAME: true,
  MQTT_RECONNECT_PERIOD: true,
  MQTT_CONNECTION_TIMEOUT: true,
  MQTT_CLEAN_SESSION: true,
  MQTT_CLIENT_ID: true,
});

export type MediaServiceConfig = z.infer<typeof MediaServiceConfigSchema>;
