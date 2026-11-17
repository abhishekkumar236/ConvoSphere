import { Router } from "express";
import { validate } from "../../middlewares/validator.middleware.js";
import { CreateUserSchema, UpdateUserSchema } from "types";
import { UserController } from "./user.controller.js";

const router = Router();
const controller = new UserController();
router.get("/users", controller.findMany);
router.get("/users/:id", controller.findById);
router.post("/users", validate(CreateUserSchema), controller.create);
router.patch("/users/:id", validate(UpdateUserSchema), controller.update);
router.delete("/users/:id", controller.delete);

export default router;
