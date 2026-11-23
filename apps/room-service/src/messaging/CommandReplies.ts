/** Publishes one message to an exchange (AmqpClientWrapper.publish, or a fake in tests). */
export type Publish = (exchange: string, routingKey: string, payload: object) => Promise<void>;

/**
 * What the sender receives on MQTT users/{clientId}/inbox:
 *   { commandId, command, ok: true,  data }
 *   { commandId, command, ok: false, error: { code, message } }
 * commandId/command are null when the message was too broken to read them.
 */
export type CommandReply =
  | { commandId: string | null; command: string | null; ok: true; data: unknown }
  | {
      commandId: string | null;
      command: string | null;
      ok: false;
      error: { code: string; message: string };
    };

/**
 * Sends replies to the sender's inbox. Published to amq.topic over AMQP: an MQTT app
 * subscribed to users/user-42/inbox receives what's published to "users.user-42.inbox".
 * Never throws: a reply that can't be sent is logged, and must not make the command run again.
 */
export class CommandReplies {
  private readonly publish: Publish;

  constructor(publish: Publish) {
    this.publish = publish;
  }

  async ok(clientId: string, commandId: string, command: string, data: unknown): Promise<void> {
    await this.send(clientId, { commandId, command, ok: true, data });
  }

  async error(
    clientId: string,
    commandId: string | null,
    command: string | null,
    code: string,
    message: string,
  ): Promise<void> {
    await this.send(clientId, { commandId, command, ok: false, error: { code, message } });
  }

  private async send(clientId: string, reply: CommandReply): Promise<void> {
    try {
      await this.publish("amq.topic", `users.${clientId}.inbox`, reply);
    } catch (error) {
      console.error(`[REPLY] Could not reply to ${clientId} (command ${reply.commandId}):`, error);
    }
  }
}
