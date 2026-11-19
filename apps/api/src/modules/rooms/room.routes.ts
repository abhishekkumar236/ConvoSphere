import { Router } from "express";
import { RoomController } from "./room.controller.js";
import { RoomService } from "./room.service.js";

const router = Router();

const roomService = new RoomService();
const roomController = new RoomController(roomService);

router.post("/", roomController.create);
router.get("/", roomController.findMany);
router.get("/:id", roomController.findById);
router.patch("/:id", roomController.update);
router.delete("/:id", roomController.delete);

export default router;
