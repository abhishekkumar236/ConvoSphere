import type { Request, Response, NextFunction } from "express";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { BaseService } from "./base.service.js";
import { BadRequest, NotFound } from "../errors/index.js";

export abstract class BaseController<Table extends AnyPgTable & { id: any }> {
  constructor(protected readonly service: BaseService<Table>) {}

  sendResponse(res: Response, data: unknown, status: number = 200) {
    return res.status(status).json({
      success: true,
      data,
    });
  }

  sendError(res: Response, message: string, status: number = 500) {
    return res.status(status).json({
      success: false,
      message,
    });
  }

  findMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;

      const data = await this.service.findMany(page, pageSize);

      return this.sendResponse(res, data);
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw new BadRequest("Invalid resource ID");
      }

      const data = await this.service.findById(id);

      if (!data) {
        throw new NotFound("Resource not found");
      }

      return this.sendResponse(res, data);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(req.body);

      return this.sendResponse(res, data, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw new BadRequest("Invalid resource ID");
      }

      const data = await this.service.update(id, req.body);

      if (!data) {
        throw new NotFound("Resource not found");
      }

      return this.sendResponse(res, data);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw new BadRequest("Invalid resource ID");
      }

      const deleted = await this.service.delete(id);

      if (!deleted) {
        throw new NotFound("Resource not found");
      }

      return this.sendResponse(res, {
        message: "Resource deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}
