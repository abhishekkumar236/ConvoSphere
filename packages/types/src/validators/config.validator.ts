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
  // Env values are always strings: "3000" → 3000. stringbool reads "true"/"false" (also 1/0,
  // yes/no); z.coerce.boolean() would turn "false" into true.
  MQTT_RECONNECT_PERIOD: z.coerce.number().int().min(0),
  MQTT_CONNECTION_TIMEOUT: z.coerce.number().int().min(1),
  MQTT_CLEAN_SESSION: z.stringbool(),
  MQTT_CLIENT_ID: z.string().min(1, "MQTT_CLIENT_ID is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
});

export const ApiConfigSchema = ConfigSchema.pick({
  ACCESS_TOKEN_EXPIRY: true,
  ACCESS_TOKEN_SECRET: true,
  SERVICE_NAME: true,
  REDIS_URL: true,
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
