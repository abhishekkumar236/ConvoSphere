export class RedisKeyFactory {
  private static readonly LOCK_PREFIX = "lock";

  public static room(id: string): string {
    return `room:${id}`;
  }

  /** Hash of who is in the room right now: field = user id, value = Participant JSON. */
  public static roomParticipants(id: string): string {
    return `room:${id}:participants`;
  }

  /** Stream of the room's chat (48 h). Entries: s = sender id, u = username, t = text. */
  public static roomMessages(id: string): string {
    return `room:${id}:messages`;
  }

  /** Duplicate check for one send-message: → the message id it created. Expires after 48 h. */
  public static chatCommand(roomId: string, userId: string, commandId: string): string {
    return `chat:cmd:${roomId}:${userId}:${commandId}`;
  }

  public static roomLock(id: string): string {
    return `${this.LOCK_PREFIX}:room:${id}`;
  }

  public static User(id: string): string {
    return `user:${id}`;
  }
}
