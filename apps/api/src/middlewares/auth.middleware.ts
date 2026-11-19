import type { Request, Response, NextFunction } from "express";
import { Unauthorized, type AccessTokenPayload } from "types";
import { JWTService } from "../modules/auth/jwt.service.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by AuthMiddleware.authenticate; read it with BaseController.currentUser(req). */
      user?: AccessTokenPayload;
    }
  }
}

export class AuthMiddleware {
  private jwtService: JWTService;

  constructor(jwtService: JWTService) {
    this.jwtService = jwtService;
  }

  /** Requires "Authorization: Bearer <access_token>"; otherwise 401. */
  authenticate = (req: Request, _res: Response, next: NextFunction) => {
    const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw new Unauthorized("Missing access token");
    }

    req.user = this.jwtService.verify(token);
    next();
  };
}

export const authenticate = new AuthMiddleware(new JWTService()).authenticate;
