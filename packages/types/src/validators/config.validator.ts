import { z } from "zod";

export const ConfigSchema = z.object({
  ACCESS_TOKEN_SECRET: z.string().min(1, "ACCESS_TOKEN_SECRET is required"),
  ACCESS_TOKEN_EXPIRY: z.number().min(1, "ACCESS_TOKEN_EXPIRY is required"),
});

export type Config = z.infer<typeof ConfigSchema>;
