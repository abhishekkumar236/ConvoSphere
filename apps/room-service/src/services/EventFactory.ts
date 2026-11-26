import type { CommandType } from "types";
import type { IEvent } from "./IEvent.js";

/**
 * The handler for each command. Handlers are built once, with their dependencies, in Service.
 * Every CommandType must have one: a new command without a handler is a compile error.
 */
export class EventFactory {
  private readonly events: Record<CommandType, IEvent>;

  constructor(events: Record<CommandType, IEvent>) {
    this.events = events;
  }

  public create(command: CommandType): IEvent {
    return this.events[command];
  }
}
