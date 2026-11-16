export class AppError extends Error {
    status;
    constructor(message, status = 500) {
        super(message);
        this.status = status;
        this.name = new.target.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class BadRequest extends AppError {
    constructor(message = "Bad Request") {
        super(message, 400);
    }
}
export class Unauthorized extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401);
    }
}
export class Forbidden extends AppError {
    constructor(message = "Forbidden") {
        super(message, 403);
    }
}
export class NotFound extends AppError {
    constructor(message = "Not Found") {
        super(message, 404);
    }
}
export class Conflict extends AppError {
    constructor(message = "Conflict") {
        super(message, 409);
    }
}
export class InternalServerError extends AppError {
    constructor(message = "Internal Server Error") {
        super(message, 500);
    }
}
//# sourceMappingURL=index.js.map