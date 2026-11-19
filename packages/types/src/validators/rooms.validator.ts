import { z } from "zod";
import type { roomMembersTable, roomTable } from "db";

// Lengths match the columns in rooms.table.ts, so a too-long value is a 400, not a database error.
// strict(): host_id, access... come from the server, so sending them is a 400.
export const CreateRoomSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().min(1, "Description is required").max(2000),
    image: z.string().max(500).optional(),
  })
  .strict();

// strict(): unknown fields (id, created_at, ...) are a 400 instead of being silently dropped.
export const UpdateRoomSchema = CreateRoomSchema.partial().strict();

/**
 * Body of POST /rooms/:id/leave. Only the host uses newHostId: { newHostId: 7 } hands the room
 * to member 7 before leaving; without it the host's leave deletes the room. An empty body = {}.
 */
export const LeaveRoomSchema = z
  .object({
    newHostId: z.number().int().positive().optional(),
  })
  .strict()
  .default({});

export type CreateRoom = z.infer<typeof CreateRoomSchema>;
export type UpdateRoom = z.infer<typeof UpdateRoomSchema>;
export type LeaveRoom = z.infer<typeof LeaveRoomSchema>;
export type Room = typeof roomTable.$inferSelect;
export type RoomAccess = Room["access"];
export type RoomMember = typeof roomMembersTable.$inferSelect;

/** What POST /rooms/:id/leave did. */
export type LeaveResult =
  | { outcome: "left" }
  | { outcome: "host_transferred"; newHostId: number }
  | { outcome: "room_deleted" };
