import { roomTable } from "db";
import { BaseService } from "../../shared/base.service.js";

export class RoomService extends BaseService<typeof roomTable> {
  constructor() {
    super(roomTable);
  }
}
