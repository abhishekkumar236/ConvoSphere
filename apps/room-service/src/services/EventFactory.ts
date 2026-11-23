import type { CommandType } from "types";
import type { IEvent } from "./IEvent.js";
import { EnterRoom } from "./room/EnterRoom.js";
import { PermanentError } from "../errors.js";

export class EventFactory {
  private static readonly events: Record<string, () => IEvent> = {
    "enter-room": () => new EnterRoom(),
  };

  public static create(command: CommandType): IEvent {
    const event = this.events[command];

    if (!event) {
      // Permanent: retrying won't make a handler appear. The sender gets NOT_SUPPORTED.
      throw new PermanentError("NOT_SUPPORTED", `No handler registered for: ${command}`);
    }

    return event();
  }
}
