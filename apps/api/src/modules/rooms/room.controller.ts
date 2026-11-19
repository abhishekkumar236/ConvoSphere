import {
  BadRequest,
  BaseController,
  PaginationQuerySchema,
  type CreateRoom,
} from "types";
import type { RoomService } from "./room.service.js";
import type { Request, Response } from "express";

export class RoomController extends BaseController {
  private service: RoomService;
  constructor(service: RoomService) {
    super();
    this.service = service;
  }

  create = async (req: Request, res: Response) => {
    try {
      const result = await this.service.create(req.body);
      this.sendResponse(res, result);
    } catch (error: any) {
      this.sendError(res, error.message, error.status);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.update(id, req.body);
      this.sendResponse(res, result);
    } catch (error: any) {
      this.sendError(res, error.message, error.status);
    }
  };

  findById = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.findById(id);
      this.sendResponse(res, result);
    } catch (error: any) {
      this.sendError(res, error.message, error.status);
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const result = await this.service.delete(id);
      this.sendResponse(res, result);
    } catch (error: any) {
      this.sendError(res, error.message, error.status);
    }
  };

  findMany = async (req: Request, res: Response) => {
    try {
      const query = PaginationQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new BadRequest("page must be 1 or more, pageSize between 1 and 100");
      }
      const result = await this.service.findMany(query.data);
      this.sendResponse(res, result);
    } catch (error: any) {
      this.sendError(res, error.message, error.status);
    }
  };
}
