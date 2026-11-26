import type { RedisClient } from "helpers";
import { RedisKeyFactory, type ChatMessage, type GetMessagesResult } from "types";
import { PermanentError } from "../../errors.js";

/**
 * Lua, shared by both scripts: is user KEYS[1] a member of room ARGV[1], and does room KEYS[2]
 * exist? Returns an error reply when not. The same checks and codes as enter-room.
 */
const CHECK_MEMBER = `
  local rawUser = redis.call("GET", KEYS[1])
  if not rawUser then return {"error", "HANDSHAKE_REQUIRED"} end
  local decoded, user = pcall(cjson.decode, rawUser)
  if not decoded or type(user) ~= "table" or type(user.rooms) ~= "table"
     or type(user.username) ~= "string" then
    return {"error", "HANDSHAKE_REQUIRED"}
  end
  local roomId, member = tonumber(ARGV[1]), false
  for _, id in ipairs(user.rooms) do
    if id == roomId then member = true break end
  end
  if not member or redis.call("EXISTS", KEYS[2]) == 0 then return {"error", "ROOM_NOT_FOUND"} end
  local time = redis.call("TIME")
  local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
`;

/**
 * KEYS: user:{id}, room:{id}, room:{id}:messages, chat:cmd:{room}:{user}:{commandId}
 * ARGV: roomId, userId, text, ttlMs
 * → {"ok", id, {fields}} (new, or the one this command already created) | {"error", code}
 */
const SEND = `${CHECK_MEMBER}
  local existing = redis.call("GET", KEYS[4])
  if existing then
    local entries = redis.call("XRANGE", KEYS[3], existing, existing)
    if #entries == 0 then return {"error", "MESSAGE_EXPIRED"} end
    return {"ok", existing, entries[1][2]}
  end
  local ttl = tonumber(ARGV[4])
  local fields = {"s", ARGV[2], "u", user.username, "t", ARGV[3]}
  local id = redis.call("XADD", KEYS[3], "MINID", tostring(now - ttl), "*", unpack(fields))
  redis.call("PEXPIRE", KEYS[3], ttl)
  redis.call("SET", KEYS[4], id, "PX", ttl)
  return {"ok", id, fields}
`;

/**
 * KEYS: user:{id}, room:{id}, room:{id}:messages
 * ARGV: roomId, before ("" = none), after ("" = none), count, ttlMs
 * → {"ok", entries} | {"error", code}. Entries younger than ttl only, even if not trimmed yet.
 *   after  → oldest first, from just after `after`
 *   before → newest first, from just before `before` (or the newest)
 */
const LIST = `${CHECK_MEMBER}
  local oldest = now - tonumber(ARGV[5])
  local count = tonumber(ARGV[4])
  if ARGV[3] ~= "" then
    local afterMs = tonumber(string.match(ARGV[3], "^(%d+)-"))
    local from = afterMs < oldest and tostring(oldest) or "(" .. ARGV[3]
    return {"ok", redis.call("XRANGE", KEYS[3], from, "+", "COUNT", count)}
  end
  local to = ARGV[2] ~= "" and "(" .. ARGV[2] or "+"
  return {"ok", redis.call("XREVRANGE", KEYS[3], to, tostring(oldest), "COUNT", count)}
`;

const MESSAGES = {
  HANDSHAKE_REQUIRED: "Call POST /users/handshake again",
  ROOM_NOT_FOUND: "Room not found",
  MESSAGE_EXPIRED: "This message has expired",
} as const;

/**
 * The room's temporary chat in Redis: the only code that reads or writes chat keys.
 *   room:{id}:messages                  stream, entries {s: sender id, u: username, t: text}
 *   chat:cmd:{room}:{user}:{commandId}  → the message id that command created
 * Both live 48 h: each send drops messages older than that and resets the stream's expiry, so a
 * quiet room's chat is gone 48 h after its last message. Each call is one Lua script (atomic):
 * the membership check, the duplicate check and the write can't interleave with another call.
 */
export class ChatStore {
  /** How long a message lives. Fixed in the code (decision 2026-11-25). */
  static readonly TTL_MS = 48 * 60 * 60 * 1000;

  private readonly redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  /**
   * Stores `text` from `userId` in `roomId`, or returns the message this command already
   * stored (a retry). Throws PermanentError HANDSHAKE_REQUIRED / ROOM_NOT_FOUND.
   */
  async send(roomId: number, userId: number, commandId: string, text: string): Promise<ChatMessage> {
    const room = String(roomId);
    const reply = await this.redis.runScript(
      SEND,
      [
        RedisKeyFactory.User(String(userId)),
        RedisKeyFactory.room(room),
        RedisKeyFactory.roomMessages(room),
        RedisKeyFactory.chatCommand(room, String(userId), commandId),
      ],
      [room, String(userId), text, String(ChatStore.TTL_MS)],
    );

    const [id, fields] = this.okReply(reply);
    const message = typeof id === "string" ? this.toMessage(id, fields) : null;
    if (!message) throw new Error(`Unexpected send-message reply from Redis for room ${roomId}`);
    return message;
  }

  /** Up to `limit` messages (see the LIST script for the order) and whether there are more. */
  async list(
    roomId: number,
    userId: number,
    page: { before?: string | undefined; after?: string | undefined; limit: number },
  ): Promise<GetMessagesResult> {
    // Nothing is older than "0-0", and Redis refuses "(0-0" as a range end.
    if (page.before === "0-0") return { messages: [], hasMore: false };

    const room = String(roomId);
    const reply = await this.redis.runScript(
      LIST,
      [
        RedisKeyFactory.User(String(userId)),
        RedisKeyFactory.room(room),
        RedisKeyFactory.roomMessages(room),
      ],
      [room, page.before ?? "", page.after ?? "", String(page.limit + 1), String(ChatStore.TTL_MS)],
    );

    const [entries] = this.okReply(reply);
    if (!Array.isArray(entries)) throw new Error(`Unexpected get-messages reply from Redis for room ${roomId}`);
    const messages = entries.flatMap((entry: unknown) => {
      const message = Array.isArray(entry) && typeof entry[0] === "string"
        ? this.toMessage(entry[0], entry[1])
        : null;
      if (!message) console.error(`[CHAT] Skipped an unreadable message in room ${roomId}`);
      return message ? [message] : [];
    });

    return { messages: messages.slice(0, page.limit), hasMore: entries.length > page.limit };
  }

  /** {"ok", ...rest} → rest. {"error", code} → PermanentError. Anything else → a retryable Error. */
  private okReply(reply: unknown): unknown[] {
    if (!Array.isArray(reply)) throw new Error("Unexpected reply from a chat script");
    const [status, ...rest] = reply;
    if (status === "ok") return rest;
    const code = rest[0];
    if (status === "error" && typeof code === "string" && code in MESSAGES) {
      throw new PermanentError(code, MESSAGES[code as keyof typeof MESSAGES]);
    }
    throw new Error("Unexpected reply from a chat script");
  }

  /** A stream entry → ChatMessage, or null when it doesn't have the expected fields. */
  private toMessage(id: string, fields: unknown): ChatMessage | null {
    if (!Array.isArray(fields)) return null;
    const values = new Map<unknown, unknown>();
    for (let i = 0; i + 1 < fields.length; i += 2) values.set(fields[i], fields[i + 1]);
    const senderId = values.get("s");
    const username = values.get("u");
    const text = values.get("t");
    const sentMs = Number(id.split("-")[0]);
    if (
      typeof senderId !== "string" || !/^[1-9]\d*$/.test(senderId) ||
      typeof username !== "string" || typeof text !== "string" || !Number.isSafeInteger(sentMs)
    ) {
      return null;
    }

    return {
      id,
      sender: { id: Number(senderId), username },
      text,
      sentAt: new Date(sentMs).toISOString(),
    };
  }
}
