import { and, eq } from "drizzle-orm";
import { db, roomMembersTable, roomTable } from "db";
import {
  BadRequest,
  Forbidden,
  NotFound,
  type CreateRoom,
  type LeaveResult,
  type Room,
  type RoomAccess,
  type RoomMember,
  type UpdateRoom,
} from "types";
import { BaseService } from "../../shared/base.service.js";
import type { JoinPolicy } from "./join-policies.js";

/** Transaction handle, so private helpers can run inside the caller's transaction. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class RoomService extends BaseService<typeof roomTable> {
  private joinPolicies: Record<RoomAccess, JoinPolicy>;

  constructor(joinPolicies: Record<RoomAccess, JoinPolicy>) {
    super(roomTable);
    this.joinPolicies = joinPolicies;
  }

  /**
   * Creates the room and makes `hostId` its host, in one transaction: either both rows exist or
   * neither does (no room without a host).
   */
  async createRoom(hostId: number, data: CreateRoom): Promise<Room> {
    return db.transaction(async (tx) => {
      const [room] = await tx
        .insert(roomTable)
        .values({ ...data, host_id: hostId })
        .returning();
      if (!room) throw new Error("Insert into rooms returned no row");

      await tx
        .insert(roomMembersTable)
        .values({ room_id: room.id, user_id: hostId, role: "host" });

      return room;
    });
  }

  /**
   * Makes the user an active member. Safe to repeat: an active member gets their row back.
   *   1. room exists (locked until commit, so the host can't delete it halfway) → else 404
   *   2. banned → 403, in every room type
   *   3. already active → returned as is
   *   4. the room's JoinPolicy decides → 403 if not allowed
   *   5. earlier row (left) → reactivated; no row → inserted
   */
  async join(roomId: number, userId: number): Promise<RoomMember> {
    return db.transaction(async (tx) => {
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
          .set({ status: "active", role: "member", joined_at: new Date(), left_at: null })
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
  }

  /**
   * Member: status → left (the row stays, so rejoining is an update).
   * Host with newHostId: hands the room over, then leaves. Host without: deletes the room.
   * 404 when the room doesn't exist or the user isn't an active member of it.
   */
  async leave(
    roomId: number,
    userId: number,
    newHostId: number | undefined,
  ): Promise<LeaveResult> {
    return db.transaction(async (tx) => {
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
        return { outcome: "left" };
      }

      // The host.
      if (newHostId === undefined) {
        // room_members (and anything else pointing at the room) cascades.
        await tx.delete(roomTable).where(eq(roomTable.id, roomId));
        return { outcome: "room_deleted" };
      }
      if (newHostId === userId) {
        throw new BadRequest("You are already the host");
      }

      const successor = await this.findMembership(tx, roomId, newHostId);
      if (successor?.status !== "active") {
        throw new BadRequest("The new host must be an active member of this room");
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

      return { outcome: "host_transferred", newHostId };
    });
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
    const isRoomOfHost = and(eq(roomTable.id, id), eq(roomTable.host_id, hostId));
    const fields = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );

    // Nothing to change: still answer as host-only, so a non-host can't probe with {}.
    if (Object.keys(fields).length === 0) {
      const [room] = await db.select().from(roomTable).where(isRoomOfHost).limit(1);
      return room ?? null;
    }

    const [room] = await db
      .update(roomTable)
      .set(fields)
      .where(isRoomOfHost)
      .returning();
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
    return deleted.length > 0;
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
