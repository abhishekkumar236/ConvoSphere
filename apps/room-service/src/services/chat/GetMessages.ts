import { ClientId, GetMessagesCommandSchema, type IBaseCommand } from "types";
import { PermanentError } from "../../errors.js";
import type { IEvent, IResult } from "../IEvent.js";
import { RoomCommand } from "../room/RoomCommand.js";
import type { ChatStore } from "./ChatStore.js";

/**
 * A page of the room's chat (members only, messages younger than 48 h), replied on the inbox:
 *   { messages: ChatMessage[], hasMore }. Order: see GetMessagesCommandSchema.
 * Only reads, so a retry just reads again.
 */
export class GetMessages implements IEvent {
  private readonly chat: ChatStore;

  constructor(chat: ChatStore) {
    this.chat = chat;
  }

  async process(command: IBaseCommand): Promise<IResult> {
    const parsed = GetMessagesCommandSchema.safeParse(command);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "data"}: ${issue.message}`)
        .join("; ");
      throw new PermanentError("INVALID_COMMAND", problems);
    }
    const roomId = RoomCommand.roomId(command);
    const userId = ClientId.toUserId(command.token.clientId);

    return { data: await this.chat.list(roomId, userId, parsed.data.data) };
  }
}
