import "dotenv/config";
import { MediaServiceConfigSchema, type MediaServiceConfig } from "types";

function loadConfig(): MediaServiceConfig {
  const config = MediaServiceConfigSchema.safeParse(process.env);
  if (!config.success) {
    throw new Error("Config not found");
  }

  return config.data;
}

export const config = loadConfig();
