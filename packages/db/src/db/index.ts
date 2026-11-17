import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";

// Load packages/db/.env whichever folder the app is started from (plain "dotenv/config" reads
// the current folder, so apps/api found nothing). Variables already set (Docker, production) win.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set: add it to packages/db/.env or the environment");
}

export const db = drizzle(databaseUrl);
