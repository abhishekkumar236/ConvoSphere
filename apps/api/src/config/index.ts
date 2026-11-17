import "dotenv/config";
import { AppError, ConfigSchema, type Config } from "types";

function loadConfig(): Config {
  const config = ConfigSchema.safeParse(process.env);
  if (!config.success) {
    throw new Error("Config not found");
  }

  return config.data;
}

export const config = loadConfig();
