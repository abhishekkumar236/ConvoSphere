export class RedisKeyFactory {
  private static readonly LOCK_PREFIX = "lock";

  public static room(id: string): string {
    return `room:${id}`;
  }

  public static roomLock(id: string): string {
    return `${this.LOCK_PREFIX}:room:${id}`;
  }

  public static User(id: string): string {
    return `user:${id}`;
  }
}
