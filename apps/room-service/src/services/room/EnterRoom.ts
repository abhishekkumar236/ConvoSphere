import type { MqttTokenService, Parser, RedisClient } from "helpers";
import {
  ClientId,
  JoinCommandSchema,
  ParticipantSchema,
  RedisKeyFactory,
  RoomStateSchema,
  UserStateSchema,
  type EnterRoomResult,
  type IBaseCommand,
  type Participant,
} from "types";
import { PermanentError } from "../../errors.js";
import type { RoomBroadcasts } from "../../messaging/RoomBroadcasts.js";
import type { IEvent, IResult } from "../IEvent.js";

/** A zod schema, seen only through safeParse (room-service doesn't depend on zod itself). */
interface SafeParser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/**
 * Opening a room's screen. Checks membership in Redis only (no Postgres):
 *   user:{id} missing or unreadable              → HANDSHAKE_REQUIRED (the handshake writes it)
 *   room not in user:{id}.rooms, or no room:{id} → ROOM_NOT_FOUND (one error: no probing)
 *   otherwise:
 *     1. adds the user to room:{id}:participants, unless already there (keeps the first enteredAt)
 *     2. tells the room: participant-entered on rooms/{id}/events
 *     3. replies with a room token, the room's data, the topics and who is in the room
 * Safe to repeat: the same list, the same event; only the token is fresh.
 */
export class EnterRoom implements IEvent {
  private readonly redis: RedisClient;
  private readonly tokens: MqttTokenService;
  private readonly tokenExpirySeconds: number;
  private readonly broadcasts: RoomBroadcasts;

  constructor(
    redis: RedisClient,
    tokens: MqttTokenService,
    tokenExpirySeconds: number,
    broadcasts: RoomBroadcasts,
  ) {
    this.redis = redis;
    this.tokens = tokens;
    this.tokenExpirySeconds = tokenExpirySeconds;
    this.broadcasts = broadcasts;
  }

  async process(command: IBaseCommand): Promise<IResult> {
    const parsed = JoinCommandSchema.safeParse(command);
    if (!parsed.success) {
      throw new PermanentError(
        "INVALID_COMMAND",
        "data.roomId must be a positive integer",
      );
    }
    const { roomId } = parsed.data.data;
    const clientId = command.token.clientId;
    const userId = ClientId.toUserId(clientId);
    const userKey = RedisKeyFactory.User(String(userId));
    const roomKey = RedisKeyFactory.room(String(roomId));
    const participantsKey = RedisKeyFactory.roomParticipants(String(roomId));

    const [user, room] = await Promise.all([
      this.redis.get(userKey, this.lenient(UserStateSchema, userKey)),
      this.redis.get(roomKey, this.lenient(RoomStateSchema, roomKey)),
    ]);
    if (!user) {
      throw new PermanentError(
        "HANDSHAKE_REQUIRED",
        "Call POST /users/handshake again",
      );
    }
    if (!room || !user.rooms.includes(roomId)) {
      throw new PermanentError("ROOM_NOT_FOUND", "Room not found");
    }

    const added = await this.redis.setFieldIfAbsent(
      participantsKey,
      String(userId),
      { username: user.username, enteredAt: new Date().toISOString() },
      roomKey,
    );
    if (added === "missing") {
      // Deleted after the read above.
      throw new PermanentError("ROOM_NOT_FOUND", "Room not found");
    }

    const participants = await this.participants(participantsKey);
    const me = participants.find((participant) => participant.id === userId);
    if (!me) {
      // Removed between the two calls above (a REST leave, or the room deleted): retry decides.
      throw new Error(`user ${userId} left room ${roomId} while entering`);
    }

    await this.broadcasts.send({
      event: "participant-entered",
      roomId,
      commandId: command.commandId,
      user: { id: me.id, username: me.username },
      enteredAt: me.enteredAt,
    });

    const result: EnterRoomResult = {
      roomToken: this.tokens.signRoom(clientId, roomId),
      expiresIn: this.tokenExpirySeconds,
      room: {
        id: room.id,
        title: room.title,
        description: room.description,
        image: room.image,
        hostId: room.host_id,
        access: room.access,
      },
      membership: { role: room.host_id === userId ? "host" : "member" },
      topics: { events: `rooms/${roomId}/events` },
      participants,
    };
    return { data: result };
  }

  /** room:{id}:participants as a list, oldest first. Unreadable entries are logged and skipped. */
  private async participants(key: string): Promise<Participant[]> {
    const entries = await this.redis.getAllFields(
      key,
      this.lenient(ParticipantSchema, key),
    );

    return Object.entries(entries)
      .flatMap(([id, entry]) => (entry ? [{ id: Number(id), ...entry }] : []))
      .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt) || a.id - b.id);
  }

  /**
   * A parser that returns null for a wrong shape (logged: e.g. a user:{id} written before
   * `rooms` existed) instead of throwing. A wrong shape won't fix itself, so it isn't retried.
   * Redis being down still throws, and that is retried.
   */
  private lenient<T>(schema: SafeParser<T>, what: string): Parser<T | null> {
    return {
      parse: (value: unknown): T | null => {
        const result = schema.safeParse(value);
        if (result.success) return result.data;
        console.error(`[ENTER] ${what} in Redis has an unexpected shape`);
        return null;
      },
    };
  }
}
