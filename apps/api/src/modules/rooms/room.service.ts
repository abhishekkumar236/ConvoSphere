import { roomTable } from "db";
import { BaseService } from "types";

export class RoomService extends BaseService<typeof roomTable> {
  constructor() {
    super(roomTable);
  }
}
