import { NotFound } from "types";
import { UserService } from "./user.service.js";
import { BaseController } from "../../shared/base.controller.js";
import type { Request, Response, NextFunction } from "express";

export class UserController extends BaseController {
  private userService: UserService;

  constructor(userService: UserService) {
    super();
    this.userService = userService;
  }

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.ownAccountId(req);
      const data = await this.userService.findById(id);

      if (!data) {
        throw new NotFound("Resource not found");
      }

      return this.sendResponse(res, this.userService.toPublic(data));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.ownAccountId(req);
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
      const id = this.ownAccountId(req);
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

  /**
   * The :id of a request about the caller's own account. Someone else's id gets 404, the same as
   * an id that doesn't exist, so the answer doesn't reveal which accounts exist.
   */
  private ownAccountId(req: Request): number {
    const id = this.parseId(req);
    if (id !== this.currentUser(req).id) {
      throw new NotFound("Resource not found");
    }
    return id;
  }

  // The user comes from the login token, never from the URL: you can only get your own credentials.
  handshake = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.currentUser(req).id;
      const result = await this.userService.handshake(id);

      return this.sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  };
}
