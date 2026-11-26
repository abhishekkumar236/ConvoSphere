/** Someone in the room right now. enteredAt is server time (UTC, ISO 8601). */
export interface Participant {
  id: number;
  username: string;
  enteredAt: string;
}

/**
 * One chat message. Kept 48 h after sentAt, then gone. id orders messages (compare the two
 * numbers of "<ms>-<n>"); the username is the one the sender had when sending.
 */
export interface ChatMessage {
  id: string;
  sender: { id: number; username: string };
  text: string;
  sentAt: string;
}

/** data of a successful send-message reply. */
export interface SendMessageResult {
  id: string;
  sentAt: string;
}

/** data of a successful get-messages reply. Order: see GetMessagesCommandSchema. */
export interface GetMessagesResult {
  messages: ChatMessage[];
  hasMore: boolean;
}

/**
 * What every app in a room receives on MQTT rooms/{roomId}/events.
 * Built from what's stored, so the same command processed twice sends the same event. Apps key
 * participants by user.id: an entered event for someone already listed changes nothing (it
 * also comes when they send enter-room again to renew their room token). Messages are keyed by
 * message.id.
 *   { "event": "participant-entered", "roomId": 7, "commandId": "…",
 *     "user": { "id": 42, "username": "asha" }, "enteredAt": "2026-11-25T10:00:00.000Z" }
 *   { "event": "participant-exited", "roomId": 7, "commandId": "…", "user": { "id": 42 } }
 *   { "event": "message-sent", "roomId": 7, "commandId": "…", "message": { ChatMessage } }
 */
export type RoomEvent =
  | {
      event: "participant-entered";
      roomId: number;
      commandId: string;
      user: { id: number; username: string };
      enteredAt: string;
    }
  | {
      event: "participant-exited";
      roomId: number;
      commandId: string;
      user: { id: number };
    }
  | {
      event: "message-sent";
      roomId: number;
      commandId: string;
      message: ChatMessage;
    };
