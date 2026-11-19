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

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.create(req.body);
      this.sendResponse(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.parseId(req);
      const result = await this.service.update(id, req.body);
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

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.parseId(req);
      const deleted = await this.service.delete(id);
      if (!deleted) {
        throw new NotFound("Resource not found");
      }
      this.sendResponse(res, { message: "Resource deleted successfully" });
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
}
