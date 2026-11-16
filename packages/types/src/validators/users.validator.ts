import { z } from "zod";

export const CreateUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.email(),
  password: z
    .string()
    .min(8, "Minimum password length is 8 characters")
    .max(24, "Maximum password length in 24 characters"),
});

export const UpdateUserSchema = CreateUserSchema.partial();
