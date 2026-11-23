import type { CommandType } from "types";
import type { IEvent } from "./IEvent.js";
import { PermanentError } from "../errors.js";

/** The handler for each command. Handlers are built once, with their dependencies, in Service. */
export class EventFactory {
  private readonly events: Partial<Record<CommandType, IEvent>>;

  constructor(events: Partial<Record<CommandType, IEvent>>) {
    this.events = events;
  }

  public create(command: CommandType): IEvent {
    const event = this.events[command];

    if (!event) {
      // Permanent: retrying won't make a handler appear. The sender gets NOT_SUPPORTED.
      throw new PermanentError("NOT_SUPPORTED", `No handler registered for: ${command}`);
    }

    return event;
  }
}
