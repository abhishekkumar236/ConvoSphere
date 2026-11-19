import { z } from "zod";
import { usersTable } from "db";

export const CreateUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.email().toLowerCase(),
  password: z
    .string()
    .min(8, "Minimum password length is 8 characters")
    .max(24, "Maximum password length in 24 characters"),
});

export const UserLoginSchema = CreateUserSchema.pick({
  email: true,
  password: true,
});

export const UpdateUserSchema = CreateUserSchema.partial();

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type UserLogin = z.infer<typeof UserLoginSchema>;
export type User = typeof usersTable.$inferSelect;

/**
 * The only user fields that may leave the api. An allow-list on purpose: a column added to
 * the users table later (e.g. a reset token) stays private until it is added here.
 */
export type PublicUser = Pick<User, "id" | "username" | "email" | "created_at" | "updated_at">;

export interface UserAuthResponse {
  user: PublicUser;
  access_token: string;
}
