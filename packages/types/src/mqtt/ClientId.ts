/**
 * A user's MQTT client id. The only place that knows its format: the number stays inside the
 * system (Postgres, services), the string is what clients get and send back.
 *   ClientId.fromUserId(1)       → "user-1"   (once, in the handshake)
 *   ClientId.toUserId("user-1")  → 1          (once, when a command comes in)
 */
export class ClientId {
  private static readonly PREFIX = "user-";
  private static readonly PATTERN = /^user-([1-9]\d*)$/;

  static fromUserId(userId: number): string {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error(`Not a user id: ${userId}`);
    }
    return `${ClientId.PREFIX}${userId}`;
  }

  /** Throws on anything that isn't "user-<positive number>" ("1", "user-abc", "media-1"). */
  static toUserId(clientId: string): number {
    const match = ClientId.PATTERN.exec(clientId);
    if (!match?.[1]) {
      throw new Error(`Not a user client id: ${clientId}`);
    }
    return Number(match[1]);
  }

  static isValid(clientId: string): boolean {
    return ClientId.PATTERN.test(clientId);
  }
}
