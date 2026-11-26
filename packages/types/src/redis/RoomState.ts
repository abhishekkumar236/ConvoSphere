import type { Room } from "../validators/index.js";

/**
 * room:{id} in Redis: the room's row. Who is in the room right now lives in its own hash,
 * room:{id}:participants (ParticipantSchema), so enter/exit never rewrite this value.
 */
export type IRoomState = Room;
