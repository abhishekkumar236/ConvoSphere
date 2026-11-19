import { z } from "zod";
import { roomTable } from "db";
export const CreateRoomSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Title is required"),
  image: z.string().optional(),
});

export const UpdateRoomSchema = CreateRoomSchema.partial();

export type CreateRoom = z.infer<typeof CreateRoomSchema>;
export type UpdateRoom = z.infer<typeof UpdateRoomSchema>;
export type Room = typeof roomTable.$inferSelect;
