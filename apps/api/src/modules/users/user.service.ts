import { and, eq } from "drizzle-orm";
import { db, roomMembersTable, usersTable } from "db";
import {
  ClientId,
  Forbidden,
  RedisKeyFactory,
  type HandshakeResponse,
  type IUserState,
  type PublicUser,
  type User,
} from "types";
import { BaseService } from "../../shared/base.service.js";
import { RedisClient, type MqttTokenService } from "helpers";

export class UserService extends BaseService<typeof usersTable> {
  private mqttTokenService: MqttTokenService;

  constructor(mqttTokenService: MqttTokenService) {
    super(usersTable);
    this.mqttTokenService = mqttTokenService;
  }

  /**
   * Looked up on first use, not in the constructor: route files create this service when they
   * are imported, which is before Service has called RedisClient.initialize().
   */
  private get redis(): RedisClient {
    return RedisClient.getInstance();
  }

  /** Returns null when no user has this email. Uses the unique index on email. */
  async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.email, email))
      .limit(1);
    return user ?? null;
  }

  /**
   * MQTT credentials for the logged-in user: their client id ("user-<id>") and a signed session
   * token as the password. The token is stored nowhere; a new handshake issues a new one (older
   * ones stay valid until they expire, revoking them comes later).
   * Also writes user:{id} to Redis with the rooms the user is an active member of: room-service
   * checks enter-room against it without Postgres. Join and leave keep `rooms` up to date.
   */
  async handshake(id: number): Promise<HandshakeResponse> {
    const user = await this.findById(id);
    if (!user) {
      throw new Forbidden("User not found");
    }

    const state: IUserState = { ...this.toPublic(user), rooms: await this.activeRoomIds(id) };
    await this.redis.set(RedisKeyFactory.User(String(id)), state);

    const clientId = ClientId.fromUserId(user.id);
    return {
      clientId,
      mqttUsername: clientId,
      mqttPassword: this.mqttTokenService.signSession(clientId),
    };
  }

  /**
   * Ids of the rooms the user is an active member of. Once per handshake; uses
   * room_members_user_id_idx (then filters on status).
   */
  private async activeRoomIds(userId: number): Promise<number[]> {
    const rows = await db
      .select({ roomId: roomMembersTable.room_id })
      .from(roomMembersTable)
      .where(and(eq(roomMembersTable.user_id, userId), eq(roomMembersTable.status, "active")));
    return rows.map((row) => row.roomId);
  }

  /**
   * What may be sent to a client. Every response containing a user goes through here, so the
   * password hash never leaves the api. Copies named fields only (see PublicUser).
   */
  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
