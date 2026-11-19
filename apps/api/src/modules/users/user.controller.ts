import {
  BadRequest,
  BaseController,
  NotFound,
  PaginationQuerySchema,
} from "types";
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
      const query = PaginationQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new BadRequest(
          "page must be 1 or more, pageSize between 1 and 100",
        );
      }

      // → { items: [...], meta: { page, pageSize, totalItems, totalPages } }
      const page = await this.userService.findMany(query.data);

      return this.sendResponse(res, {
        items: page.items.map((user) => this.userService.toPublic(user)),
        meta: page.meta,
      });
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

      return this.sendResponse(res, this.userService.toPublic(data));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.userService.create(req.body);

      return this.sendResponse(res, this.userService.toPublic(data), 201);
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

      return this.sendResponse(res, this.userService.toPublic(data));
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

  handshake = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw new BadRequest("Invalid resource ID");
      }

      const result = await this.userService.handshake(id);

      return this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };
}
