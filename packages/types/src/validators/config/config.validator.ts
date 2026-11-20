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
  // Signs the MQTT session and room tokens (api signs, media-service verifies: same value in
  // both). Separate from ACCESS_TOKEN_SECRET, so a leak of one doesn't expose the other.
  MQTT_TOKEN_SECRET: z.string().min(32, "MQTT_TOKEN_SECRET must be at least 32 characters"),
  // Seconds an MQTT session/room token stays valid: 3600 = 1 hour.
  MQTT_TOKEN_EXPIRY: z.coerce.number().int().min(1),
});

export const ApiConfigSchema = ConfigSchema.pick({
  ACCESS_TOKEN_EXPIRY: true,
  ACCESS_TOKEN_SECRET: true,
  SERVICE_NAME: true,
  REDIS_URL: true,
  MQTT_TOKEN_SECRET: true,
  MQTT_TOKEN_EXPIRY: true,
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
  MQTT_TOKEN_SECRET: true,
});

export type MediaServiceConfig = z.infer<typeof MediaServiceConfigSchema>;
