import { and, eq } from "drizzle-orm";
import { db, roomMembersTable, roomTable, usersTable } from "db";
import {
  BadRequest,
  Forbidden,
  NotFound,
  RedisKeyFactory,
  type CreateRoom,
  type IRoomState,
  type JoinResult,
  type LeaveResult,
  type PublicUser,
  type Room,
  type RoomAccess,
  type RoomMember,
  type UpdateRoom,
} from "types";
import { BaseService } from "../../shared/base.service.js";
import type { JoinPolicy } from "./join-policies.js";
import { RedisClient } from "helpers";

/** Transaction handle, so private helpers can run inside the caller's transaction. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class RoomService extends BaseService<typeof roomTable> {
  private joinPolicies: Record<RoomAccess, JoinPolicy>;

  constructor(joinPolicies: Record<RoomAccess, JoinPolicy>) {
    super(roomTable);
    this.joinPolicies = joinPolicies;
  }

  /**
   * Looked up on first use, not in the constructor: route files create this service when they
   * are imported, which is before Service has called RedisClient.initialize().
   */
  private get redis(): RedisClient {
    return RedisClient.getInstance();
  }

  /**
   * Creates the room and makes `hostId` its host, in one transaction: either both rows exist or
   * neither does (no room without a host). After the commit, the room state goes to Redis.
   */
  async createRoom(hostId: number, data: CreateRoom): Promise<Room> {
    const { room, host } = await db.transaction(async (tx) => {
      const [room] = await tx
        .insert(roomTable)
        .values({ ...data, host_id: hostId })
        .returning();
      if (!room) throw new Error("Insert into rooms returned no row");

      await tx
        .insert(roomMembersTable)
        .values({ room_id: room.id, user_id: hostId, role: "host" });

      // Public fields only: this goes into Redis, never the password hash.
      const [host] = await tx
        .select({
          id: usersTable.id,
          username: usersTable.username,
          email: usersTable.email,
          created_at: usersTable.created_at,
          updated_at: usersTable.updated_at,
        })
        .from(usersTable)
        .where(eq(usersTable.id, hostId))
        .limit(1);
      if (!host) throw new Error(`Host ${hostId} not found`);

      return { room, host };
    });

    await this.cacheNewRoom(room, host);
    await this.afterCommit(room.id, "add the room to the host's rooms", () =>
      this.redis.addToJsonList(RedisKeyFactory.User(String(hostId)), "rooms", room.id),
    );
    return room;
  }

  /**
   * Writes the new room to Redis as IRoomState, with the host as the first participant
   * ("offline" until presence sees them connect). Runs after the commit, so Redis never holds a
   * room Postgres doesn't. A failure is logged, not thrown: the room exists (Postgres is the
   * truth), and an error here would make the client retry and create a duplicate room.
   */
  private async cacheNewRoom(room: Room, host: PublicUser): Promise<void> {
    const state: IRoomState = {
      ...room,
      participants: { [String(host.id)]: { ...host, status: "online" } },
    };

    try {
      await this.redis.set(RedisKeyFactory.room(String(room.id)), state);
    } catch (error) {
      console.error(
        `Room ${room.id} created, but writing it to Redis failed:`,
        error,
      );
    }
  }

  /**
   * Makes the user an active member. Safe to repeat: an active member gets their row back.
   *   1. room exists (locked until commit, so the host can't delete it halfway) → else 404
   *   2. banned → 403, in every room type
   *   3. already active → returned as is
   *   4. the room's JoinPolicy decides → 403 if not allowed
   *   5. earlier row (left) → reactivated; no row → inserted
   * After the commit, the room is added to user:{id}.rooms in Redis (if the user did a
   * handshake), which is what enter-room checks. Also on "already active", so joining again
   * repairs a copy that's missing.
   */
  async join(roomId: number, userId: number): Promise<JoinResult> {
    const membership = await db.transaction(async (tx) => {
      const room = await this.lockRoom(tx, roomId);
      const membership = await this.findMembership(tx, roomId, userId);

      if (membership?.status === "banned") {
        throw new Forbidden("You can't join this room");
      }
      if (membership?.status === "active") {
        return membership;
      }

      this.joinPolicies[room.access].check(room, membership);

      if (membership) {
        const [rejoined] = await tx
          .update(roomMembersTable)
          .set({
            status: "active",
            role: "member",
            joined_at: new Date(),
            left_at: null,
          })
          .where(eq(roomMembersTable.id, membership.id))
          .returning();
        if (!rejoined) throw new Error("Rejoin returned no row");
        return rejoined;
      }

      const [created] = await tx
        .insert(roomMembersTable)
        .values({ room_id: roomId, user_id: userId })
        .returning();
      if (!created) throw new Error("Insert into room_members returned no row");
      return created;
    });

    await this.afterCommit(roomId, `add the room to user ${userId}'s rooms`, () =>
      this.redis.addToJsonList(RedisKeyFactory.User(String(userId)), "rooms", roomId),
    );
    return { membership };
  }

  /**
   * Member: status → left (the row stays, so rejoining is an update).
   * Host with newHostId: hands the room over, then leaves. Host without: deletes the room.
   * 404 when the room doesn't exist or the user isn't an active member of it.
   * After the commit, Redis follows: the room leaves user:{id}.rooms; room:{id} gets the new
   * host, or is deleted with the room.
   */
  async leave(
    roomId: number,
    userId: number,
    newHostId: number | undefined,
  ): Promise<LeaveResult> {
    const result = await db.transaction(async (tx): Promise<LeaveResult> => {
      await this.lockRoom(tx, roomId);
      const membership = await this.findMembership(tx, roomId, userId);
      if (membership?.status !== "active") {
        throw new NotFound("Resource not found");
      }

      if (membership.role === "member") {
        if (newHostId !== undefined) {
          throw new BadRequest("Only the host can name a new host");
        }
        await this.markLeft(tx, membership.id);
        return { outcome: "left", discardRoomToken: true };
      }

      // The host.
      if (newHostId === undefined) {
        // room_members (and anything else pointing at the room) cascades.
        await tx.delete(roomTable).where(eq(roomTable.id, roomId));
        return { outcome: "room_deleted", discardRoomToken: true };
      }
      if (newHostId === userId) {
        throw new BadRequest("You are already the host");
      }

      const successor = await this.findMembership(tx, roomId, newHostId);
      if (successor?.status !== "active") {
        throw new BadRequest(
          "The new host must be an active member of this room",
        );
      }

      // Order matters: "one active host per room" is checked after every statement, so the old
      // host steps down before the new one is promoted.
      await this.markLeft(tx, membership.id, "member");
      await tx
        .update(roomMembersTable)
        .set({ role: "host" })
        .where(eq(roomMembersTable.id, successor.id));
      await tx
        .update(roomTable)
        .set({ host_id: newHostId })
        .where(eq(roomTable.id, roomId));

      return { outcome: "host_transferred", newHostId, discardRoomToken: true };
    });

    await this.afterCommit(roomId, `remove the room from user ${userId}'s rooms`, () =>
      this.redis.removeFromJsonList(RedisKeyFactory.User(String(userId)), "rooms", roomId),
    );
    if (result.outcome === "room_deleted") {
      await this.afterCommit(roomId, "delete the room", () =>
        this.redis.delete(RedisKeyFactory.room(String(roomId))),
      );
    }
    if (result.outcome === "host_transferred") {
      await this.afterCommit(roomId, "set the new host", () =>
        this.redis.mergeJson(RedisKeyFactory.room(String(roomId)), { host_id: result.newHostId }),
      );
    }
    return result;
  }

  /**
   * Changes the room only if `hostId` is its host, decided in the UPDATE's WHERE, so a host
   * change happening at the same moment can't slip through.
   * null = not found or not the host (the caller can't tell which).
   */
  async updateAsHost(
    id: number,
    hostId: number,
    changes: UpdateRoom,
  ): Promise<Room | null> {
    const isRoomOfHost = and(
      eq(roomTable.id, id),
      eq(roomTable.host_id, hostId),
    );
    const fields = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );

    // Nothing to change: still answer as host-only, so a non-host can't probe with {}.
    if (Object.keys(fields).length === 0) {
      const [room] = await db
        .select()
        .from(roomTable)
        .where(isRoomOfHost)
        .limit(1);
      return room ?? null;
    }

    const [room] = await db
      .update(roomTable)
      .set(fields)
      .where(isRoomOfHost)
      .returning();
    if (room) {
      await this.afterCommit(room.id, "update the room", () =>
        this.redis.mergeJson(RedisKeyFactory.room(String(room.id)), {
          title: room.title,
          description: room.description,
          image: room.image,
          updated_at: room.updated_at,
        }),
      );
    }
    return room ?? null;
  }

  /**
   * Deletes the room and everything that cascades from it (memberships).
   * false = not found or not the host. Two deletes at once: only one succeeds.
   */
  async deleteAsHost(id: number, hostId: number): Promise<boolean> {
    const deleted = await db
      .delete(roomTable)
      .where(and(eq(roomTable.id, id), eq(roomTable.host_id, hostId)))
      .returning({ id: roomTable.id });
    if (deleted.length === 0) return false;

    // Members' user:{id}.rooms keep the id; enter-room also needs room:{id}, so this is enough.
    await this.afterCommit(id, "delete the room", () =>
      this.redis.delete(RedisKeyFactory.room(String(id))),
    );
    return true;
  }

  /**
   * A Redis write that follows a Postgres commit. Logged, not thrown: the change is already
   * committed (Postgres is the truth), and an error would make the client retry it. The cost is
   * a stale copy (TD-39).
   */
  private async afterCommit(
    roomId: number,
    what: string,
    write: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await write();
    } catch (error) {
      console.error(`Room ${roomId}: committed, but Redis failed to ${what}:`, error);
    }
  }

  /**
   * The room, locked (SELECT … FOR UPDATE) until the transaction ends. Every join, leave and
   * host change of one room goes through here, so they run one after another, never interleaved.
   */
  private async lockRoom(tx: Tx, roomId: number): Promise<Room> {
    const [room] = await tx
      .select()
      .from(roomTable)
      .where(eq(roomTable.id, roomId))
      .for("update");
    if (!room) throw new NotFound("Resource not found");
    return room;
  }

  private async findMembership(
    tx: Tx,
    roomId: number,
    userId: number,
  ): Promise<RoomMember | null> {
    const [membership] = await tx
      .select()
      .from(roomMembersTable)
      .where(
        and(
          eq(roomMembersTable.room_id, roomId),
          eq(roomMembersTable.user_id, userId),
        ),
      )
      .limit(1);
    return membership ?? null;
  }

  private async markLeft(
    tx: Tx,
    membershipId: number,
    role?: "member",
  ): Promise<void> {
    await tx
      .update(roomMembersTable)
      .set({ status: "left", left_at: new Date(), ...(role ? { role } : {}) })
      .where(eq(roomMembersTable.id, membershipId));
  }
}
