/**
 * Thrown by a command handler when retrying can't help: not a member, room deleted, text too
 * long… The sender gets an error reply with `code`; the command is acked, not retried.
 * Anything else a handler throws counts as temporary (Redis/Postgres down) and is retried.
 *   throw new PermanentError("NOT_A_MEMBER", "You are not a member of this room");
 */
export class PermanentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PermanentError";
    this.code = code;
  }
}
