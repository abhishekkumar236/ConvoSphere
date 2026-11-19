import { BadRequest, NotFound, PaginationQuerySchema } from "types";
import type { RoomService } from "./room.service.js";
import { BaseController } from "../../shared/base.controller.js";
import type { NextFunction, Request, Response } from "express";

export class RoomController extends BaseController {
  private service: RoomService;
  constructor(service: RoomService) {
    super();
    this.service = service;
  }

  // The caller becomes the host; host_id is never taken from the body.
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hostId = this.currentUser(req).id;
      const result = await this.service.createRoom(hostId, req.body);
      this.sendResponse(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  // Host only. Anyone else gets 404, the same as a missing room.
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.parseId(req);
      const hostId = this.currentUser(req).id;
      const result = await this.service.updateAsHost(id, hostId, req.body);
      if (!result) {
        throw new NotFound("Resource not found");
      }
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.parseId(req);
      const result = await this.service.findById(id);
      if (!result) {
        throw new NotFound("Resource not found");
      }
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  // Host only. Deletes the room and its memberships for good.
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.parseId(req);
      const hostId = this.currentUser(req).id;
      const deleted = await this.service.deleteAsHost(id, hostId);
      if (!deleted) {
        throw new NotFound("Resource not found");
      }
      this.sendResponse(res, { message: "Room deleted" });
    } catch (error) {
      next(error);
    }
  };

  findMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Not through validate(): Express 5 doesn't allow replacing req.query, so it's parsed here.
      const query = PaginationQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw BadRequest.fromZod(query.error);
      }
      const result = await this.service.findMany(query.data);
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  // 200 with the membership, also when already a member (safe to repeat).
  join = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.parseId(req);
      const userId = this.currentUser(req).id;
      const membership = await this.service.join(id, userId);
      this.sendResponse(res, membership);
    } catch (error) {
      next(error);
    }
  };

  // Body (validated by LeaveRoomSchema): {} or, for the host, { newHostId }.
  leave = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.parseId(req);
      const userId = this.currentUser(req).id;
      const result = await this.service.leave(id, userId, req.body.newHostId);
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };
}
