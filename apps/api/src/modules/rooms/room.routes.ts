import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validator.middleware.js";
import { CreateRoomSchema, LeaveRoomSchema, UpdateRoomSchema } from "types";
import { RoomController } from "./room.controller.js";
import { RoomService } from "./room.service.js";
import { joinPolicies } from "./join-policies.js";

const router = Router();

const roomService = new RoomService(joinPolicies);
const roomController = new RoomController(roomService);

router.post(
  "/rooms",
  authenticate,
  validate(CreateRoomSchema),
  roomController.create,
);
router.get("/rooms", authenticate, roomController.findMany);
router.get("/rooms/:id", authenticate, roomController.findById);
router.patch(
  "/rooms/:id",
  authenticate,
  validate(UpdateRoomSchema),
  roomController.update,
);
router.delete("/rooms/:id", authenticate, roomController.delete);
router.post("/rooms/:id/join", authenticate, roomController.join);
router.post(
  "/rooms/:id/leave",
  authenticate,
  validate(LeaveRoomSchema),
  roomController.leave,
);

export default router;
