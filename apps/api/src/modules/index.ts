import { Router } from "express";
import userRoutes from "./users/user.routes.js";
import authRoutes from "./auth/auth.routes.js";
import mqttAuthRoutes from "./mqttAuh/mqttAuth.routes.js";
const router = Router();

router.use(userRoutes);
router.use(authRoutes);
router.use(mqttAuthRoutes);
export default router;
