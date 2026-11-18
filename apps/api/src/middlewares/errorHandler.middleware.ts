import type { Request, Response, NextFunction } from "express";
import { AppError } from "types";

/** Postgres "unique_violation", e.g. the username is already taken. */
const PG_UNIQUE_VIOLATION = "23505";

/** Drizzle wraps the Postgres error and keeps the original in `cause`. */
const isUniqueViolation = (err: Error): boolean => {
  const cause = err.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === PG_UNIQUE_VIOLATION
  );
};

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

  if (isUniqueViolation(err)) {
    return res.status(409).json({
      message: "A record with this value already exists",
      status: 409,
    });
  }

  console.error(err);

  return res.status(500).json({
    message: "Internal Server Error",
    status: 500,
  });
};
