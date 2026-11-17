import {
  BadRequest,
  Conflict,
  InternalServerError,
  type CreateUserRequest,
  type UserAuthResponse,
  type UserLoginRequest,
} from "types";
import type { UserService } from "../users/user.service.js";
import type { JWTService } from "./jwt.service.js";
import bcrypt from "bcrypt";

export class AuthService {
  private userService: UserService;
  private jwtService: JWTService;
  constructor(userService: UserService, jwtService: JWTService) {
    this.userService = userService;
    this.jwtService = jwtService;
  }

  async register(data: CreateUserRequest): Promise<UserAuthResponse> {
    const [existingUser] = await this.userService.findMany({
      limit: 1,
      offset: 1,
      filter: {},
    });

    if (existingUser) {
      throw new Conflict("User already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.userService.create({
      email: data.email,
      password: hashedPassword,
      username: data.username,
    });

    if (!user) {
      throw new InternalServerError();
    }

    const access_token = this.jwtService.sign({
      id: user.id,
      email: user.email,
    });
    const { password, ...rest } = user;
    return {
      user: rest,
      access_token,
    };
  }

  async login(data: UserLoginRequest): Promise<UserAuthResponse> {
    const [user] = await this.userService.findMany({
      limit: 1,
      offset: 1,
      filter: {},
    });

    if (!user) {
      throw new BadRequest("User not found");
    }

    const isValidPassword = await bcrypt.compare(user.password, data.password);

    if (!isValidPassword) {
      throw new BadRequest("Invalid credentials");
    }

    const access_token = await this.jwtService.sign({
      id: user.id,
      email: user.email,
    });
    const { password, ...rest } = user;

    return {
      user: rest,
      access_token,
    };
  }
}
