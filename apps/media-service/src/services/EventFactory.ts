import type { CommandType } from "types";
import type { IEvent } from "./IEvent.js";
import { EnterRoom } from "./room/EnterRoom.js";

export class EventFactory {
  private static readonly events: Record<string, () => IEvent> = {
    "enter-room": () => new EnterRoom(),
  };

  public static create(command: CommandType): IEvent {
    const event = this.events[command];

    if (!event) {
      throw new Error(`No handler registered for: ${command}`);
    }

    return event();
  }
}
