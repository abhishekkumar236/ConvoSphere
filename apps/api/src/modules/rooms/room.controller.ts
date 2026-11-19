import {
  BadRequest,
  BaseController,
  PaginationQuerySchema,
  type CreateRoom,
} from "types";
import type { RoomService } from "./room.service.js";
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
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.update(id, req.body);
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.findById(id);
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.delete(id);
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  findMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = PaginationQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new BadRequest(
          "page must be 1 or more, pageSize between 1 and 100",
        );
      }
      const result = await this.service.findMany(query.data);
      this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };
}
