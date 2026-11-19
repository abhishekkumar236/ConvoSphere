import type { Request, Response } from "express";
import { BadRequest, Unauthorized, type AccessTokenPayload } from "types";

export abstract class BaseController {
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

  /** The :id route parameter as a positive whole number, or 400. "12" → 12, "abc" → 400. */
  protected parseId(req: Request): number {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequest("Invalid resource ID");
    }
    return id;
  }

  /** The logged-in user. Only valid on routes behind `authenticate`; otherwise 401. */
  protected currentUser(req: Request): AccessTokenPayload {
    if (!req.user) {
      throw new Unauthorized();
    }
    return req.user;
  }
}
