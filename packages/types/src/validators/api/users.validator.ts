import { z } from "zod";
import type { usersTable } from "db";

export const CreateUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.email().toLowerCase(),
  // bcrypt reads only the first 72 bytes and ignores the rest, so longer passwords are
  // rejected rather than silently cut. Bytes, not characters: "é" is 2 bytes, an emoji 4.
  password: z
    .string()
    .min(8, "Minimum password length is 8 characters")
    .refine(
      (password) => new TextEncoder().encode(password).length <= 72,
      "Maximum password length is 72 bytes",
    ),
});

export const UserLoginSchema = CreateUserSchema.pick({
  email: true,
  password: true,
});

// Password changes get their own endpoint (one that checks the old password). strict(): a body
// with `password` (or any unknown field) is a 400, not silently ignored.
export const UpdateUserSchema = CreateUserSchema.omit({ password: true })
  .partial()
  .strict();

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

/**
 * POST /users/handshake. The client connects to MQTT with clientId + mqttUsername +
 * mqttPassword, and sends mqttPassword as token.password in every command.
 */
export interface HandshakeResponse {
  clientId: string;
  mqttUsername: string;
  mqttPassword: string;
}
