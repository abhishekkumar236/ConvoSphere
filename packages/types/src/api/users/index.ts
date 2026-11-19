import { db, usersTable } from "db";

export type CreateUserRequest = typeof usersTable.$inferInsert;
export type UpdateUserRequest = Partial<CreateUserRequest>;
/**
 * The only user fields that may leave the api. An allow-list on purpose: a column added to
 * the users table later (e.g. a reset token) stays private until it is added here.
 */
export type PublicUser = Pick<
  typeof usersTable.$inferSelect,
  "id" | "username" | "email" | "created_at" | "updated_at"
>;
export interface UserAuthResponse {
  user: PublicUser;
  access_token: string;
}
export type UserLoginRequest = Pick<CreateUserRequest, "email" | "password">;
