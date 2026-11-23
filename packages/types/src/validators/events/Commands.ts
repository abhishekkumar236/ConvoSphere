import { z } from "zod";

// enter-room: opening a room's screen (returns the room token). exit-room: closing it.
// Joining and leaving a room as a member are REST (POST /rooms/:id/join, /leave).
export const CommandTypeSchema = z.enum(["enter-room", "exit-room"]);

export type CommandType = z.infer<typeof CommandTypeSchema>;

/**
 * Commands that act on one room: they must carry token.roomId and a valid room token in
 * token.session for that room (issued by enter-room). enter-room itself is not one: it's how
 * the room token is obtained. Typed, so a misspelled command is a compile error.
 */
export const ROOM_COMMANDS: ReadonlySet<CommandType> = new Set<CommandType>([
  "exit-room",
]);
