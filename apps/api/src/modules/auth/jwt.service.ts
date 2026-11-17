import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { config } from "../../config/index.js";

export class JWTService {
  private readonly secret: string;
  private readonly options: SignOptions;

  constructor() {
    this.secret = config.ACCESS_TOKEN_SECRET;

    const expiresIn: NonNullable<SignOptions["expiresIn"]> =
      config.ACCESS_TOKEN_EXPIRY;

    this.options = {
      expiresIn,
      algorithm: "HS256",
    };
  }

  sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, this.options);
  }

  verify<T extends JwtPayload = JwtPayload>(token: string): T {
    return jwt.verify(token, this.secret, {
      algorithms: ["HS256"],
    }) as T;
  }
}
