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
  rooms: z.array(z.number().int().positive()),
});

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
