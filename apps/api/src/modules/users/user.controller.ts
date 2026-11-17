import { BadRequest, BaseController, NotFound } from "types";
import { UserService } from "./user.service.js";
import type { Request, Response, NextFunction } from "express";

export class UserController extends BaseController {
  private userService: UserService;

  constructor(userService: UserService) {
    super();
    this.userService = userService;
  }

  findMany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.page) || 1;
      const offset = Number(req.query.pageSize) || 20;
      const filter = {};

      const data = await this.userService.findMany({
        limit,
        offset,
        filter,
      });

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

      const data = await this.userService.findById(id);

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
      const data = await this.userService.create(req.body);

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

      const data = await this.userService.update(id, req.body);

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

      const deleted = await this.userService.delete(id);

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
