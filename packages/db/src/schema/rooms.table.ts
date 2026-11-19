import {
  index,
  integer,
  pgEnum,
  pgTable,
  varchar,
  text
} from "drizzle-orm/pg-core";
import { timestamps } from "../helper/common.schema.js";
import { usersTable } from "./users.table.js";

// How users get in. Each value has a JoinPolicy in apps/api (rooms/join-policies.ts).
export const roomAccessEnum = pgEnum("room_access", ["open", "invite_only"]);

export const roomTable = pgTable(
  "rooms",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 2000 }).notNull(),
    image: varchar({ length: 500 }),
    host_id: integer()
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    access: roomAccessEnum().notNull().default("open"),
    // No status: a room exists until the host deletes it (or leaves without a successor), then
    // the row and everything that cascades from it are deleted.
    ...timestamps,
  },
  (table) => [
    // "Rooms this user hosts", and the check Postgres runs when a user is deleted.
    index("rooms_host_id_idx").on(table.host_id),
  ],
);
