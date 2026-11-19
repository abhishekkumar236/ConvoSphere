import { eq } from "drizzle-orm";
import { db, usersTable } from "db";
import { BaseService, type PublicUser } from "types";

type UserRow = typeof usersTable.$inferSelect;

export class UserService extends BaseService<typeof usersTable> {
  constructor() {
    super(usersTable);
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
   * What may be sent to a client. Every response containing a user goes through here, so the
   * password hash never leaves the api. Copies named fields only (see PublicUser).
   */
  toPublic(user: UserRow): PublicUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
