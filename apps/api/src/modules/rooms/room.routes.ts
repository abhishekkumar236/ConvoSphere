import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validator.middleware.js";
import { CreateRoomSchema, UpdateRoomSchema } from "types";
import { RoomController } from "./room.controller.js";
import { RoomService } from "./room.service.js";

const router = Router();

const roomService = new RoomService();
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

export default router;
