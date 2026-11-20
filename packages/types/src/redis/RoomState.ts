import type { PublicUser, Room } from "../validators/index.js";

export interface IUser extends PublicUser {
  status: "online" | "offline";
}

export interface IRoomState extends Room {
  participants: Record<string, IUser>;
}
