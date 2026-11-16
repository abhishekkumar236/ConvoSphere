import { db, usersTable } from "db";

export type CreateUserRequest = typeof usersTable.$inferInsert;
export type UpdateUserRequest = Partial<CreateUserRequest>;
export type User = Omit<typeof usersTable.$inferSelect, "password">;
