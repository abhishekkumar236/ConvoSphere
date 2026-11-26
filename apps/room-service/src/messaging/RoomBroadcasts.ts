import type { RoomEvent } from "types";
import type { Publish } from "./CommandReplies.js";

/**
 * Sends room events to everyone in the room: published to amq.topic as "rooms.7.events", which
 * apps subscribed to MQTT rooms/7/events receive.
 * Throws when it can't send (unlike CommandReplies): the command then fails and is retried, and
 * since handlers are safe to repeat, the retry sends the same event again. A missed event would
 * leave the others with a wrong participant list.
 */
export class RoomBroadcasts {
  private readonly publish: Publish;

  constructor(publish: Publish) {
    this.publish = publish;
  }

  async send(event: RoomEvent): Promise<void> {
    await this.publish("amq.topic", `rooms.${event.roomId}.events`, event);
  }
}
