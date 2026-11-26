import { z } from "zod";
import { BaseCommandSchema } from "./IBaseCommand.js";

/** Longest chat message, in characters, after trimming. */
export const CHAT_MAX_LENGTH = 4000;
/** Messages per get-messages reply: default and most. */
export const CHAT_PAGE_DEFAULT = 50;
export const CHAT_PAGE_MAX = 100;

/** A chat message id: the Redis Stream id, "<ms since 1970>-<n>", e.g. "1764064800000-0". */
export const ChatMessageIdSchema = z.string().regex(/^\d{1,15}-\d{1,15}$/, "must be a message id");

/** { "text": "hello" }. The room is token.roomId (send-message is a room command). */
export const SendMessageCommandSchema = BaseCommandSchema.extend({
  command: z.literal("send-message"),
  data: z.object({
    text: z.string().trim().min(1).max(CHAT_MAX_LENGTH),
  }),
});

/**
 * { "limit": 50 }                          newest first (opening the room)
 * { "before": "1764064800000-0" }          older than that, newest first (scrolling up)
 * { "after": "1764064800000-0" }           newer than that, OLDEST first (catching up after a
 *                                          reconnect: page forward until hasMore is false)
 */
export const GetMessagesCommandSchema = BaseCommandSchema.extend({
  command: z.literal("get-messages"),
  data: z
    .object({
      before: ChatMessageIdSchema.optional(),
      after: ChatMessageIdSchema.optional(),
      limit: z.number().int().min(1).max(CHAT_PAGE_MAX).default(CHAT_PAGE_DEFAULT),
    })
    .refine((data) => !(data.before && data.after), "send before or after, not both"),
});

export type ISendMessageCommand = z.infer<typeof SendMessageCommandSchema>;
export type IGetMessagesCommand = z.infer<typeof GetMessagesCommandSchema>;
