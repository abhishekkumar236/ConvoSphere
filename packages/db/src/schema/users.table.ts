import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "../helper/common.schema.js";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: varchar({ length: 255 }).notNull().unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 500 }).notNull(),
  ...timestamps,
});
