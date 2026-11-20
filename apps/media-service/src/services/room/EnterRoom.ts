import type { IEvent, IResult } from "../IEvent.js";

export class EnterRoom implements IEvent {
  async process(): Promise<IResult> {
    try {
      return {
        data: {},
      };
    } catch (error) {
      throw error;
    }
  }
}
