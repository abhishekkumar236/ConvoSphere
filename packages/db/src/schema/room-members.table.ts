import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "../helper/common.schema.js";
import { roomTable } from "./rooms.table.js";
import { usersTable } from "./users.table.js";

export const roomMemberRoleEnum = pgEnum("room_member_role", ["host", "member"]);
/** "left" and "banned" rows are kept (not deleted), so rejoining is an update of the same row. */
export const roomMemberStatusEnum = pgEnum("room_member_status", [
  "active",
  "left",
  "banned",
]);

/** Who belongs to which room (long-lived). Who is online right now lives in Redis, not here. */
export const roomMembersTable = pgTable(
  "room_members",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    room_id: integer()
      .notNull()
      .references(() => roomTable.id, { onDelete: "cascade" }),
    user_id: integer()
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: roomMemberRoleEnum().notNull().default("member"),
    status: roomMemberStatusEnum().notNull().default("active"),
    // The latest join: moves on every rejoin. created_at stays the first-ever join.
    joined_at: timestamp().defaultNow().notNull(),
    // null while active.
    left_at: timestamp(),
    ...timestamps,
  },
  (table) => [
    // One row per user per room: joining twice can't create a second row.
    unique("room_members_room_user_unique").on(table.room_id, table.user_id),
    // At most one active host per room, enforced by Postgres even when two requests race.
    uniqueIndex("room_members_one_active_host")
      .on(table.room_id)
      .where(sql`${table.role} = 'host' AND ${table.status} = 'active'`),
    // "Rooms I'm a member of", and the cascade when a user is deleted.
    index("room_members_user_id_idx").on(table.user_id),
  ],
);
