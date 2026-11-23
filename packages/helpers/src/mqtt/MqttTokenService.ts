import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

/**
 * Signs and checks the two MQTT tokens (JWT, HMAC-SHA256 with MQTT_TOKEN_SECRET; stored nowhere):
 *   session: { sub: "user-1" }           issued by the handshake, sent in every command
 *   room:    { sub: "user-1", room: 7 }  issued by enter-room (room-service), sent in room commands
 * Each kind has its own audience, so a session token can't pass as a room token (or the other
 * way round), and an api login token (other secret) passes as neither.
 * The content is readable (base64) but can't be changed or forged without the secret.
 */
export class MqttTokenService {
  private static readonly SESSION_AUDIENCE = "mqtt-session";
  private static readonly ROOM_AUDIENCE = "mqtt-room";

  private readonly secret: string;
  private readonly expirySeconds: number | undefined;

  /** expirySeconds is only needed to sign (the api); a service that only verifies can omit it. */
  constructor(secret: string, expirySeconds?: number) {
    this.secret = secret;
    this.expirySeconds = expirySeconds;
  }

  signSession(clientId: string): string {
    return this.sign({}, clientId, MqttTokenService.SESSION_AUDIENCE);
  }

  /** The clientId the session token was issued to. Throws MqttTokenError if not valid. */
  verifySession(token: string): string {
    return this.verify(token, MqttTokenService.SESSION_AUDIENCE).clientId;
  }

  signRoom(clientId: string, roomId: number): string {
    return this.sign({ room: roomId }, clientId, MqttTokenService.ROOM_AUDIENCE);
  }

  /** Who the room token was issued to, for which room. Throws MqttTokenError if not valid. */
  verifyRoom(token: string): { clientId: string; roomId: number } {
    const { clientId, payload } = this.verify(token, MqttTokenService.ROOM_AUDIENCE);
    const roomId = payload.room;
    if (typeof roomId !== "number" || !Number.isInteger(roomId) || roomId <= 0) {
      throw new MqttTokenError("room token has no valid room");
    }
    return { clientId, roomId };
  }

  private sign(payload: object, clientId: string, audience: string): string {
    if (this.expirySeconds === undefined) {
      throw new Error("MqttTokenService was created without expirySeconds, so it can't sign");
    }
    return jwt.sign(payload, this.secret, {
      algorithm: "HS256",
      subject: clientId,
      audience,
      expiresIn: this.expirySeconds,
      // A random id per token: without it, two tokens for the same user in the same second are
      // identical. Unique ≠ revoked: older tokens stay valid until they expire.
      jwtid: randomUUID(),
    });
  }

  /** Signature, algorithm, audience and expiry are all checked by jwt.verify. */
  private verify(
    token: string,
    audience: string,
  ): { clientId: string; payload: jwt.JwtPayload } {
    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.secret, { algorithms: ["HS256"], audience });
    } catch (error) {
      throw new MqttTokenError(error instanceof Error ? error.message : "invalid token");
    }
    if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub) {
      throw new MqttTokenError("token has no subject");
    }
    return { clientId: payload.sub, payload };
  }
}

/** Any reason a token was refused: bad signature, expired, wrong audience, malformed. */
export class MqttTokenError extends Error {
  constructor(reason: string) {
    super(`MQTT token refused: ${reason}`);
    this.name = "MqttTokenError";
  }
}
