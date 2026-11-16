import { BaseController } from "types";
import type { usersTable } from "db";
import { UserService } from "./user.service.js";

export class UserController extends BaseController<typeof usersTable> {
  constructor() {
    super(new UserService());
  }
}
