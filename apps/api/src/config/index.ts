import "dotenv/config";
import { ApiConfigSchema, type ApiConfig } from "types";

function loadConfig(): ApiConfig {
  const config = ApiConfigSchema.safeParse(process.env);
  if (!config.success) {
    throw new Error("Config not found");
  }

  return config.data;
}

export const config = loadConfig();
