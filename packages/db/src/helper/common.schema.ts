import { timestamp } from "drizzle-orm/pg-core";

export const timestamps = {
  // Set by Drizzle on every update() (app side, so no migration): null until the first change.
  updated_at: timestamp().$onUpdate(() => new Date()),
  created_at: timestamp().defaultNow().notNull(),
};
