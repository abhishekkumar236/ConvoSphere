import { MqttTokenError, type MqttTokenService } from "helpers";
import { ROOM_COMMANDS, type IBaseCommand } from "types";

/** Why a command was refused. Logged with the claimed clientId, never with the tokens. */
export class CommandRejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "CommandRejected";
  }
}

/**
 * Checks that a command really comes from who it claims, before any handler runs:
 *   1. token.password is a valid session token (the handshake's mqttPassword) issued to
 *      token.clientId
 *   2. room commands (ROOM_COMMANDS): token.session is a valid room token (from the
 *      enter-room reply) issued to the same client for token.roomId
 * Throws CommandRejected otherwise. Rejected commands are dropped and logged, never blocked
 * (until the broker verifies who is connected, a fake command could get someone else blocked).
 */
export class CommandGuard {
  private tokens: MqttTokenService;

  constructor(tokens: MqttTokenService) {
    this.tokens = tokens;
  }

  check(command: IBaseCommand): void {
    const { clientId, password, roomId, session } = command.token;

    const sessionOwner = this.verified(() => this.tokens.verifySession(password), "password");
    if (sessionOwner !== clientId) {
      throw new CommandRejected("session token was issued to another client");
    }

    if (!ROOM_COMMANDS.has(command.command)) return;

    if (!roomId || !session) {
      throw new CommandRejected(`"${command.command}" needs token.roomId and token.session`);
    }
    const room = this.verified(() => this.tokens.verifyRoom(session), "room (session)");
    if (room.clientId !== clientId) {
      throw new CommandRejected("room token was issued to another client");
    }
    if (String(room.roomId) !== roomId) {
      throw new CommandRejected("room token is for another room");
    }
  }

  private verified<T>(verify: () => T, kind: string): T {
    try {
      return verify();
    } catch (error) {
      if (error instanceof MqttTokenError) {
        throw new CommandRejected(`${kind} token: ${error.message}`);
      }
      throw error;
    }
  }
}
