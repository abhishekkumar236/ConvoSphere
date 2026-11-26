import type { IBaseCommand } from "types";
import { PermanentError } from "../../errors.js";

/** What every room command (ROOM_COMMANDS) needs from its token. */
export class RoomCommand {
  /**
   * token.roomId as a number. CommandGuard only lets a room command through when token.roomId
   * equals the room token's room, so a bad value here means a bug, not a user mistake.
   *   { token: { roomId: "7", … } } → 7
   */
  static roomId(command: IBaseCommand): number {
    const roomId = Number(command.token.roomId);
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      throw new PermanentError("INVALID_COMMAND", "token.roomId must be a room id");
    }
    return roomId;
  }
}
