import {
  Unauthorized,
  type CreateUserRequest,
  type UserAuthResponse,
  type UserLoginRequest,
} from "types";
import type { UserService } from "../users/user.service.js";
import type { JWTService } from "./jwt.service.js";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

export class AuthService {
  private userService: UserService;
  private jwtService: JWTService;
  /**
   * Compared against when the email is unknown, so "no such user" takes as long as
   * "wrong password" and response times don't reveal which emails are registered.
   */
  private readonly dummyHash = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

  constructor(userService: UserService, jwtService: JWTService) {
    this.userService = userService;
    this.jwtService = jwtService;
  }

  /**
   * No "does it exist?" check first: the unique indexes on email and username decide, so two
   * signups at the same moment can't both succeed. A duplicate makes create() throw, and the
   * error handler answers 409.
   */
  async register(data: CreateUserRequest): Promise<UserAuthResponse> {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await this.userService.create({
      email: data.email,
      password: hashedPassword,
      username: data.username,
    });

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
    const user = await this.userService.findByEmail(data.email);

    // bcrypt.compare(plain text, stored hash): the order matters.
    const isValidPassword = await bcrypt.compare(
      data.password,
      user?.password ?? this.dummyHash,
    );

    // Same answer for "unknown email" and "wrong password", so the response doesn't reveal
    // which emails have accounts.
    if (!user || !isValidPassword) {
      throw new Unauthorized("Invalid email or password");
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
}
