import { Forbidden, type Room, type RoomAccess, type RoomMember } from "types";

/**
 * Decides whether a user may join a room of one access type. Only the decision: RoomService does
 * the checks every room shares (exists, banned, already a member) before, and the writing after.
 * A new access type = a new enum value + a class here; the map below won't compile without it.
 */
export interface JoinPolicy {
  /** Throws (403) when not allowed. `membership` is the user's earlier row (left), or null. */
  check(room: Room, membership: RoomMember | null): void;
}

/** Anyone logged in may join. */
export class OpenJoinPolicy implements JoinPolicy {
  check(): void {}
}

/**
 * Only invited users may join. Invites don't exist yet, so for now this refuses everyone who
 * isn't already an active member (active members never reach a policy).
 */
export class InviteOnlyJoinPolicy implements JoinPolicy {
  check(): void {
    throw new Forbidden("This room is invite-only");
  }
}

export const joinPolicies: Record<RoomAccess, JoinPolicy> = {
  open: new OpenJoinPolicy(),
  invite_only: new InviteOnlyJoinPolicy(),
};
