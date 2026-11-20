import { z } from "zod";
import { CommandTypeSchema } from "./Commands.js";

export const BaseCommandResponseSchema = z.object({
  roomId: z.string().min(1),
  data: z.unknown(),
});

export type IBaseCommandResponse = z.infer<typeof BaseCommandResponseSchema>;
