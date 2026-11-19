import type { Request, Response, NextFunction } from "express";
import { AppError, type FieldError } from "types";

/** Postgres "unique_violation", e.g. the username is already taken. */
const PG_UNIQUE_VIOLATION = "23505";
/** Postgres "foreign_key_violation": a row still referenced (NO ACTION), or a missing parent. */
const PG_FOREIGN_KEY_VIOLATION = "23503";
/** Postgres "restrict_violation": ON DELETE RESTRICT, e.g. deleting a user who hosts a room. */
const PG_RESTRICT_VIOLATION = "23001";

/** Drizzle wraps the Postgres error and keeps the original in `cause`. */
const hasPgCode = (err: unknown, code: string): boolean => {
  if (!(err instanceof Error)) return false;
  const cause = err.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === code
  );
};

/**
 * Errors from Express's own middleware (body parser): malformed JSON → status 400, body too
 * large → 413. They follow the http-errors convention: `expose: true` = safe to show the client.
 */
const isClientHttpError = (
  err: unknown,
): err is { status: number; message: string } =>
  typeof err === "object" &&
  err !== null &&
  "status" in err &&
  typeof err.status === "number" &&
  err.status >= 400 &&
  err.status < 500 &&
  "expose" in err &&
  err.expose === true &&
  "message" in err &&
  typeof err.message === "string";

const send = (
  res: Response,
  status: number,
  message: string,
  details?: FieldError[],
) =>
  res.status(status).json({
    success: false,
    message,
    status,
    ...(details ? { details } : {}),
  });

// `unknown`: anything can be thrown, not only Error objects.
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return send(res, err.status, err.message, err.details);
  }

  if (hasPgCode(err, PG_UNIQUE_VIOLATION)) {
    return send(res, 409, "A record with this value already exists");
  }

  if (
    hasPgCode(err, PG_FOREIGN_KEY_VIOLATION) ||
    hasPgCode(err, PG_RESTRICT_VIOLATION)
  ) {
    return send(res, 409, "This record is still in use by other data");
  }

  if (isClientHttpError(err)) {
    return send(res, err.status, err.message);
  }

  console.error(err);

  return send(res, 500, "Internal Server Error");
};
