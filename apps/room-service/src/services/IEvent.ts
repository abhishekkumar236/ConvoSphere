import type { IBaseCommand } from "types";

export interface IResult {
  data: any;
}

export interface IEvent {
  process(payload: IBaseCommand): Promise<IResult>;
}
