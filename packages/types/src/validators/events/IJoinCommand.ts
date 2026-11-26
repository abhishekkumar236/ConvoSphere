import { z } from "zod";
import { BaseCommandSchema } from "./IBaseCommand.js";
import type { RoomAccess } from "../api/rooms.validator.js";
import type { Participant } from "./RoomEvents.js";

export const JoinCommandSchema = BaseCommandSchema.extend({
  command: z.literal("enter-room"),
  data: z.object({
    roomId: z.number().int().positive(),
  }),
});

export type IJoinCommand = z.infer<typeof JoinCommandSchema>;

/**
 * data of a successful enter-room reply. roomToken goes into token.session (and roomId into
 * token.roomId) of every room command; send enter-room again before expiresIn (seconds) runs out.
 */
export interface EnterRoomResult {
  roomToken: string;
  expiresIn: number;
  room: {
    id: number;
    title: string;
    description: string;
    image: string | null;
    hostId: number;
    access: RoomAccess;
  };
  membership: { role: "host" | "member" };
  /** MQTT topics to subscribe to while in the room. */
  topics: { events: string };
  /** Who is in the room now, the sender included, oldest first. Later changes come as RoomEvents. */
  participants: Participant[];
}
