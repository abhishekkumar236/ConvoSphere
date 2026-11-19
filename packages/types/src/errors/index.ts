import type { ZodError } from "zod";

/** One invalid field, sent to the client: { path: "email", message: "Invalid email address" } */
export interface FieldError {
  path: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    /** Extra information the client may see, e.g. which fields failed validation. */
    public details?: FieldError[],
  ) {
    super(message);
    this.name = new.target.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequest extends AppError {
  constructor(message: string = "Bad Request", details?: FieldError[]) {
    super(message, 400, details);
  }

  /** A failed zod parse → 400 listing every invalid field (messages only, never the values). */
  static fromZod(error: ZodError): BadRequest {
    return new BadRequest(
      "Validation failed",
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
}

export class Unauthorized extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class Forbidden extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class NotFound extends AppError {
  constructor(message: string = "Not Found") {
    super(message, 404);
  }
}

export class Conflict extends AppError {
  constructor(message: string = "Conflict") {
    super(message, 409);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal Server Error") {
    super(message, 500);
  }
}
