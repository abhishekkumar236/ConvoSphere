import { Router } from "express";
import { validate } from "../../middlewares/validator.middleware.js";
import { CreateUserSchema, UpdateUserSchema } from "types";
import { UserController } from "./user.controller.js";

const router = Router();
const controller = new UserController();
router.post("/users", validate(CreateUserSchema), controller.create);
router.patch("/users", validate(UpdateUserSchema), controller.update);

export default router;
