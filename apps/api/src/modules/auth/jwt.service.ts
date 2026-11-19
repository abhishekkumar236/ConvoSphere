import jwt, { type SignOptions } from "jsonwebtoken";
import {
  AccessTokenPayloadSchema,
  Unauthorized,
  type AccessTokenPayload,
} from "types";
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

  sign(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.secret, this.options);
  }

  /**
   * The payload of a valid token, or 401. Bad signature, expired, malformed or an unexpected
   * payload shape all give the same answer, so the client learns nothing about why.
   */
  verify(token: string): AccessTokenPayload {
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, this.secret, { algorithms: ["HS256"] });
    } catch {
      throw new Unauthorized("Invalid or expired token");
    }

    const payload = AccessTokenPayloadSchema.safeParse(decoded);
    if (!payload.success) {
      throw new Unauthorized("Invalid or expired token");
    }
    return payload.data;
  }
}
