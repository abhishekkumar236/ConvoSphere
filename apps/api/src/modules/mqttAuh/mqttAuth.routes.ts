import { Router } from "express";
import { MqttAuthService } from "./mqttAuth.service.js";
import { MqttAuthController } from "./mqttAuth.controller.js";
import {
  ResourcePathSchema,
  TopicPathSchema,
  UserPathSchema,
  VhostPathSchema,
} from "types";
import { validate } from "../../middlewares/validator.middleware.js";

const router = Router();

const mqttAuthService = new MqttAuthService();
const mqttAuthController = new MqttAuthController(mqttAuthService);

router.post(
  "/auth/mqtt/vhost",
  validate(VhostPathSchema),
  mqttAuthController.vhostPath,
);
router.post(
  "/auth/mqtt/resource",
  validate(ResourcePathSchema),
  mqttAuthController.resourcePath,
);
router.post(
  "/auth/mqtt/user",
  validate(UserPathSchema),
  mqttAuthController.userPath,
);
router.post(
  "/auth/mqtt/topic",
  validate(TopicPathSchema),
  mqttAuthController.topicPath,
);

export default router;
