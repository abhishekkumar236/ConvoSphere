import type { MqttTokenService, RedisClient } from "helpers";
import {
  ClientId,
  JoinCommandSchema,
  RedisKeyFactory,
  RoomStateSchema,
  UserStateSchema,
  type EnterRoomResult,
  type IBaseCommand,
} from "types";
import { PermanentError } from "../../errors.js";
import type { IEvent, IResult } from "../IEvent.js";

/** A zod schema, seen only through safeParse (room-service doesn't depend on zod itself). */
interface SafeParser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/**
 * Opening a room's screen. Checks membership in Redis only (no Postgres):
 *   user:{id} missing or unreadable              → HANDSHAKE_REQUIRED (the handshake writes it)
 *   room not in user:{id}.rooms, or no room:{id} → ROOM_NOT_FOUND (one error: no probing)
 *   otherwise → a room token for this room, the room's data and the topics to subscribe to
 * Only reads and signs, so a retry just returns a fresh token.
 */
export class EnterRoom implements IEvent {
  private readonly redis: RedisClient;
  private readonly tokens: MqttTokenService;
  private readonly tokenExpirySeconds: number;

  constructor(redis: RedisClient, tokens: MqttTokenService, tokenExpirySeconds: number) {
    this.redis = redis;
    this.tokens = tokens;
    this.tokenExpirySeconds = tokenExpirySeconds;
  }

  async process(command: IBaseCommand): Promise<IResult> {
    const parsed = JoinCommandSchema.safeParse(command);
    if (!parsed.success) {
      throw new PermanentError("INVALID_COMMAND", "data.roomId must be a positive integer");
    }
    const { roomId } = parsed.data.data;
    const clientId = command.token.clientId;
    const userId = ClientId.toUserId(clientId);

    const [user, room] = await Promise.all([
      this.read(RedisKeyFactory.User(String(userId)), UserStateSchema),
      this.read(RedisKeyFactory.room(String(roomId)), RoomStateSchema),
    ]);
    if (!user) {
      throw new PermanentError("HANDSHAKE_REQUIRED", "Call POST /users/handshake again");
    }
    if (!room || !user.rooms.includes(roomId)) {
      throw new PermanentError("ROOM_NOT_FOUND", "Room not found");
    }

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
    };
    return { data: result };
  }

  /**
   * The value at `key`, or null when it's missing or has the wrong shape (logged: e.g. a
   * user:{id} written before `rooms` existed). A wrong shape won't fix itself, so it isn't
   * retried. Redis being down still throws, and that is retried.
   */
  private async read<T>(key: string, schema: SafeParser<T>): Promise<T | null> {
    return this.redis.get(key, {
      parse: (value: unknown): T | null => {
        const result = schema.safeParse(value);
        if (result.success) return result.data;
        console.error(`[ENTER] ${key} in Redis has an unexpected shape`);
        return null;
      },
    });
  }
}
