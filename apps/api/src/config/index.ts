import "dotenv/config";
import { ApiConfigSchema, type ApiConfig } from "types";

function loadConfig(): ApiConfig {
  const config = ApiConfigSchema.safeParse(process.env);
  if (!config.success) {
    // Names each bad key and why, never the value (values can be secrets):
    // "Invalid config: SERVICE_NAME: Invalid input: expected string, received undefined"
    const problems = config.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid config: ${problems}`);
  }

  return config.data;
}

export const config = loadConfig();
