import { z } from "zod";
import type { roomTable } from "db";

// Lengths match the columns in rooms.table.ts, so a too-long value is a 400, not a database error.
export const CreateRoomSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().min(1, "Description is required").max(255),
  image: z.string().max(500).optional(),
});

// strict(): unknown fields (id, created_at, ...) are a 400 instead of being silently dropped.
export const UpdateRoomSchema = CreateRoomSchema.partial().strict();

export type CreateRoom = z.infer<typeof CreateRoomSchema>;
export type UpdateRoom = z.infer<typeof UpdateRoomSchema>;
export type Room = typeof roomTable.$inferSelect;
