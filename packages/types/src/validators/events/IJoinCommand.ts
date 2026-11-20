import { z } from "zod";
import { BaseCommandSchema } from "./IBaseCommand.js";

export const JoinCommandSchema = BaseCommandSchema.extend({
  command: z.literal("enter-room"),
  data: z.object({
    roomId: z.number().int().positive(),
  }),
});

export type IJoinCommand = z.infer<typeof JoinCommandSchema>;
