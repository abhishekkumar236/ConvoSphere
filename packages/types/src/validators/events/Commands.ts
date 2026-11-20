import { z } from "zod";

export const CommandTypeSchema = z.enum(["enter-room", "leave-room"]);

export type CommandType = z.infer<typeof CommandTypeSchema>;

/**
 * Commands that act on one room: they must carry token.roomId and a valid room token in
 * token.session for that room (issued by POST /rooms/:id/join). Typed, so a misspelled command is a compile error.
 */
export const ROOM_COMMANDS: ReadonlySet<CommandType> = new Set<CommandType>([
  "enter-room",
  "leave-room",
]);
