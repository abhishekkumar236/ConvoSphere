import {
  CHAT_MAX_LENGTH,
  ClientId,
  SendMessageCommandSchema,
  type IBaseCommand,
  type SendMessageResult,
} from "types";
import { PermanentError } from "../../errors.js";
import type { RoomBroadcasts } from "../../messaging/RoomBroadcasts.js";
import type { IEvent, IResult } from "../IEvent.js";
import { RoomCommand } from "../room/RoomCommand.js";
import type { ChatStore } from "./ChatStore.js";

/**
 * A chat message to the room in token.roomId (48 h, Redis only):
 *   1. stored, unless this command already stored one (a retry returns that one)
 *   2. message-sent on rooms/{id}/events, built from what's stored
 *   3. reply { id, sentAt }
 * Safe to repeat: one message, the same event. A broadcast that fails is retried.
 */
export class SendMessage implements IEvent {
  private readonly chat: ChatStore;
  private readonly broadcasts: RoomBroadcasts;

  constructor(chat: ChatStore, broadcasts: RoomBroadcasts) {
    this.chat = chat;
    this.broadcasts = broadcasts;
  }

  async process(command: IBaseCommand): Promise<IResult> {
    const parsed = SendMessageCommandSchema.safeParse(command);
    if (!parsed.success) {
      throw new PermanentError(
        "INVALID_COMMAND",
        `data.text must be 1 to ${CHAT_MAX_LENGTH} characters (spaces at the ends don't count)`,
      );
    }
    const roomId = RoomCommand.roomId(command);
    const userId = ClientId.toUserId(command.token.clientId);

    const message = await this.chat.send(roomId, userId, command.commandId, parsed.data.data.text);
    await this.broadcasts.send({
      event: "message-sent",
      roomId,
      commandId: command.commandId,
      message,
    });

    const result: SendMessageResult = { id: message.id, sentAt: message.sentAt };
    return { data: result };
  }
}
