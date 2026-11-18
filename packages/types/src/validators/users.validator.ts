import { z } from "zod";

export const CreateUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.email().toLowerCase(),
  password: z
    .string()
    .min(8, "Minimum password length is 8 characters")
    .max(24, "Maximum password length in 24 characters"),
});

// Log in with email + password (matches UserLoginRequest).
export const UserLoginSchema = CreateUserSchema.pick({
  email: true,
  password: true,
});

export const UpdateUserSchema = CreateUserSchema.partial();
