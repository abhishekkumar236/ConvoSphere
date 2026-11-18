import { BaseController } from "types";
import { AuthService } from "./auth.service.js";
import type { NextFunction, Request, Response } from "express";

export class AuthController extends BaseController {
  private authService: AuthService;
  constructor(authService: AuthService) {
    super();
    this.authService = authService;
  }

  // Errors go to the error handler (next), which answers AppErrors with their status, a
  // duplicate email/username with 409, and anything else with a plain 500 that never shows
  // internal details such as SQL.
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.body);
      this.sendResponse(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);
      // 200: logging in reads an account, it doesn't create one.
      this.sendResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  };
}
