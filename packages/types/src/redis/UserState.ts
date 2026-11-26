import { z } from "zod";
import type { PublicUser, RoomAccess } from "../validators/index.js";

/**
 * user:{id} in Redis. Written whole by the handshake (rooms from Postgres: active memberships);
 * join and leave add or remove one room id. room-service checks membership here, without
 * Postgres. Can be stale (TD-39).
 *   { "id": 42, "username": "asha", …, "rooms": [7, 9] }
 */
export interface IUserState extends PublicUser {
  rooms: number[];
}

/** The part of user:{id} room-service reads. Other fields are dropped. */
export const UserStateSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  rooms: z.array(z.number().int().positive()),
});

/**
 * One value of the hash room:{id}:participants (field = user id). Written once on enter-room
 * (HSETNX), so a repeat keeps the first enteredAt; removed on exit-room or leave.
 *   room:7:participants  "42" → {"username":"asha","enteredAt":"2026-11-25T10:00:00.000Z"}
 */
export const ParticipantSchema = z.object({
  username: z.string(),
  enteredAt: z.iso.datetime(),
});

export type IParticipantState = z.infer<typeof ParticipantSchema>;

const ROOM_ACCESS = ["open", "invite_only"] as const satisfies readonly RoomAccess[];

/** The part of room:{id} (IRoomState) room-service reads. Other fields are dropped. */
export const RoomStateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  image: z.string().nullable(),
  host_id: z.number().int().positive(),
  access: z.enum(ROOM_ACCESS),
});
