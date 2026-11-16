export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = new.target.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequest extends AppError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
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
