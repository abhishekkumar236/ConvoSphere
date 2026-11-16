export declare class AppError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export declare class BadRequest extends AppError {
    constructor(message?: string);
}
export declare class Unauthorized extends AppError {
    constructor(message?: string);
}
export declare class Forbidden extends AppError {
    constructor(message?: string);
}
export declare class NotFound extends AppError {
    constructor(message?: string);
}
export declare class Conflict extends AppError {
    constructor(message?: string);
}
export declare class InternalServerError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=index.d.ts.map