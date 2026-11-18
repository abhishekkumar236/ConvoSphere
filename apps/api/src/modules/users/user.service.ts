import { eq } from "drizzle-orm";
import { db, usersTable } from "db";
import { BaseService } from "types";

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
}
