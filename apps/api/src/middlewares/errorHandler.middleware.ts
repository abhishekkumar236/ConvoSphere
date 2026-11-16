import type { Request, Response, NextFunction } from "express";
import { AppError } from "types";
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      message: err.message,
      status: err.status,
    });
  }

  console.error(err);

  return res.status(500).json({
    message: "Internal Server Error",
    status: 500,
  });
};
