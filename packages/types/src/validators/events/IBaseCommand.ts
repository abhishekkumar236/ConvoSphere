import { z } from "zod";
import { CommandTypeSchema } from "./Commands.js";

export const BaseCommandSchema = z.object({
  token: z.object({
    // "user-<id>", as given by the handshake.
    clientId: z.string().regex(/^user-[1-9]\d*$/, "clientId must look like user-<id>"),
    // The handshake's mqttPassword: a signed session token, checked on every command.
    password: z.string().min(1),
    // Room commands only (see ROOM_COMMANDS): the room, and in session the room token from
    // POST /rooms/:id/join.
    roomId: z.string().optional(),
    session: z.string().optional(),
  }),

  command: CommandTypeSchema,
  data: z.unknown(),
});

export type IBaseCommand = z.infer<typeof BaseCommandSchema>;
