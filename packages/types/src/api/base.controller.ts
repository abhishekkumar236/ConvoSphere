import type { Response } from "express";

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
}
