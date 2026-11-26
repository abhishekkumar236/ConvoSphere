import type { RedisClient } from "helpers";
import { ClientId, RedisKeyFactory, type IBaseCommand } from "types";
import type { RoomBroadcasts } from "../../messaging/RoomBroadcasts.js";
import type { IEvent, IResult } from "../IEvent.js";
import { RoomCommand } from "./RoomCommand.js";

/**
 * Closing a room's screen. The room is token.roomId, which CommandGuard has already matched
 * against the room token (exit-room is a room command), so no membership check is needed:
 *   1. removes the user from room:{id}:participants (not there → nothing changes)
 *   2. tells the room: participant-exited on rooms/{id}/events
 * Safe to repeat: the same state, the same event. The room token stays valid until it expires
 * (TD-4); the app discards it.
 */
export class ExitRoom implements IEvent {
  private readonly redis: RedisClient;
  private readonly broadcasts: RoomBroadcasts;

  constructor(redis: RedisClient, broadcasts: RoomBroadcasts) {
    this.redis = redis;
    this.broadcasts = broadcasts;
  }

  async process(command: IBaseCommand): Promise<IResult> {
    const roomId = RoomCommand.roomId(command);
    const userId = ClientId.toUserId(command.token.clientId);

    await this.redis.deleteField(
      RedisKeyFactory.roomParticipants(String(roomId)),
      String(userId),
    );
    await this.broadcasts.send({
      event: "participant-exited",
      roomId,
      commandId: command.commandId,
      user: { id: userId },
    });

    return { data: {} };
  }
}
