import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "../helper/common.schema.js";

export const roomTable = pgTable("rooms", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }).notNull().unique(),
  description: varchar({ length: 255 }).notNull().unique(),
  image: varchar({ length: 500 }),
  ...timestamps,
});
