import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validator.middleware.js";
import { UpdateUserSchema } from "types";
import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";

const router = Router();

const userService = new UserService();
const controller = new UserController(userService);

// Accounts are created only through POST /auth/signup, which hashes the password. No list of
// all users: a user can reach only their own account.
router.get("/users/:id", authenticate, controller.findById);
router.patch(
  "/users/:id",
  authenticate,
  validate(UpdateUserSchema),
  controller.update,
);
router.delete("/users/:id", authenticate, controller.delete);

export default router;
