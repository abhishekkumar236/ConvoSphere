// Applies every pending migration in packages/db/drizzle to the database, then exits.
// Runs as the one-shot "migrate" container (docker-compose.yml) before the api starts.
// It is the ONLY thing that changes the database structure; services never run migrations.
//
// Forward-only: nothing is ever rolled back by this tool. To undo a change, generate a NEW
// migration that reverses it, and ship it like any other migration.
//
// Exit 0 = the database is up to date (migrations applied, or nothing was pending).
// Exit 1 = a migration failed. Drizzle runs the whole batch in ONE transaction, so the failure
//          rolls everything back: the database is exactly as it was before this run.
//
// Run: docker compose up migrate        (needs DATABASE_URL; inside Docker the host is "postgres")

import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

class Migrator {
  /**
   * Any fixed number. Every migrator takes this Postgres advisory lock first, so if two start
   * at once (two servers deploying, a retry overlapping a slow run) the second waits for the
   * first, then finds nothing pending. Drizzle itself has no lock.
   */
  private static readonly LOCK_KEY = 728_190_431;

  /** The SQL folders created by `drizzle-kit generate` (packages/db/drizzle). */
  private static readonly MIGRATIONS_FOLDER = fileURLToPath(
    new URL("../drizzle", import.meta.url),
  );

  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({
      connectionString: databaseUrl,
      // One connection holds the lock, one runs the migrations.
      max: 2,
      // Fail instead of hanging forever when the database can't be reached.
      connectionTimeoutMillis: 10_000,
      // If a table is busy, give up after 10 s instead of waiting: while an ALTER TABLE waits for
      // its lock, every new query on that table queues behind it and the app freezes. A failed
      // run is safe (it rolls back) and can simply be run again at a quieter moment.
      options: "-c lock_timeout=10s",
    });
  }

  async run(): Promise<void> {
    const lockClient = await this.pool.connect();
    try {
      // Waits here while another migrator holds the lock.
      await lockClient.query("SELECT pg_advisory_lock($1)", [
        Migrator.LOCK_KEY,
      ]);

      const before = await this.appliedNames();
      await migrate(drizzle({ client: this.pool }), {
        migrationsFolder: Migrator.MIGRATIONS_FOLDER,
      });
      const applied = [...(await this.appliedNames())].filter(
        (name) => !before.has(name),
      );

      console.log(
        applied.length === 0
          ? "Database is up to date, no pending migrations"
          : `Applied ${applied.length} migration(s): ${applied.join(", ")}`,
      );
    } finally {
      // release(true) closes this connection, which also releases the advisory lock, even if a
      // migration failed above.
      lockClient.release(true);
      await this.pool.end();
    }
  }

  /** Names of migrations already recorded in Drizzle's tracking table (empty on a new database). */
  private async appliedNames(): Promise<Set<string>> {
    const table = await this.pool.query<{ exists: string | null }>(
      "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS exists",
    );
    if (!table.rows[0]?.exists) return new Set();
    const { rows } = await this.pool.query<{ name: string }>(
      "SELECT name FROM drizzle.__drizzle_migrations",
    );
    return new Set(rows.map((row) => row.name));
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

try {
  await new Migrator(databaseUrl).run();
} catch (error) {
  console.error(
    "Migration failed. All migrations in this run were rolled back.",
    error,
  );
  process.exit(1);
}
