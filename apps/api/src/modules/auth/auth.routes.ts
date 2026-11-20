import { Router } from "express";
import { AuthService } from "./auth.service.js";
import { UserService } from "../users/user.service.js";
import { JWTService } from "./jwt.service.js";
import { AuthController } from "./auth.controller.js";
import { mqttTokenService } from "./mqtt-token.js";
import { validate } from "../../middlewares/validator.middleware.js";
import { CreateUserSchema, UserLoginSchema } from "types";

const router = Router();

const authService = new AuthService(
  new UserService(mqttTokenService),
  new JWTService(),
);
const authController = new AuthController(authService);

router.post("/auth/signup", validate(CreateUserSchema), authController.register);
router.post("/auth/login", validate(UserLoginSchema), authController.login);

export default router;
