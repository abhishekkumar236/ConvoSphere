import { db, usersTable } from "db";

export type CreateUserRequest = typeof usersTable.$inferInsert;
export type UpdateUserRequest = Partial<CreateUserRequest>;
export type PublicUser = Omit<typeof usersTable.$inferSelect, "password">;
export interface UserAuthResponse {
  user: PublicUser;
  access_token: string;
}
export type UserLoginRequest = Pick<CreateUserRequest, "email" | "password">;
