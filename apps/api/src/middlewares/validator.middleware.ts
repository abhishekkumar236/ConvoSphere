import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { BadRequest } from "types";

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw BadRequest.fromZod(result.error);
    }

    req.body = result.data;

    return next();
  };
};
