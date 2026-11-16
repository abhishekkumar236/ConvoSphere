import { db, usersTable } from "db";
import { BaseService } from "types";

export class UserService extends BaseService<typeof usersTable> {
  constructor() {
    super(usersTable);
  }
}
