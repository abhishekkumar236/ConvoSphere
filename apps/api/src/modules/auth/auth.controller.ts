import { BaseController } from "types";
import { AuthService } from "./auth.service.js";
import type { Request, Response } from "express";

export class AuthController extends BaseController {
  private authService: AuthService;
  constructor(authService: AuthService) {
    super();
    this.authService = authService;
  }

  register = async (req: Request, res: Response) => {
    try {
      const result = await this.authService.register(req.body);
      this.sendResponse(res, result, 201);
    } catch (error: any) {
      this.sendError(res, error.message, error.status);
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const result = await this.authService.login(req.body);
      this.sendResponse(res, result, 201);
    } catch (error: any) {
      this.sendError(res, error.message, error.status);
    }
  };
}
