import { RejectMessage, type AmqpMessage } from "helpers";
import { BaseCommandSchema, type CommandType, type IBaseCommand } from "types";
import { PermanentError } from "../errors.js";
import type { IEvent } from "../services/IEvent.js";
import {
  CommandRejected,
  type CommandGuard,
} from "../services/CommandGuard.js";
import type { CommandReplies } from "./CommandReplies.js";

/** "users.user-42.cmd" → "user-42". The topic the command was published on: who sent it. */
const SENDER_PATTERN = /^users\.(user-[1-9]\d*)\.cmd$/;

/**
 * Decides what happens to one command delivery. Knows nothing about queues beyond
 * AmqpMessage: throwing RejectMessage = dead-letter now, throwing anything else = retry.
 *
 *   unreadable (not JSON / wrong shape)    → error reply INVALID_COMMAND, dead-letter, no retry
 *   token.clientId ≠ sender from the topic → log, dead-letter, no reply (someone else's name)
 *   tokens refused (CommandGuard)          → log, dead-letter, no reply
 *   handler throws PermanentError          → error reply with its code, ack
 *   handler throws anything else           → retry; on the last attempt also TEMPORARY_FAILURE
 *   handler succeeds                       → ok reply, ack
 */
export class CommandProcessor {
  private readonly guard: CommandGuard;
  private readonly replies: CommandReplies;
  private readonly createEvent: (command: CommandType) => IEvent;

  constructor(
    guard: CommandGuard,
    replies: CommandReplies,
    createEvent: (command: CommandType) => IEvent,
  ) {
    this.guard = guard;
    this.replies = replies;
    this.createEvent = createEvent;
  }

  process = async (message: AmqpMessage): Promise<void> => {
    const sender = SENDER_PATTERN.exec(message.routingKey)?.[1];
    if (!sender) {
      // The queue only binds users.*.cmd, so this means a wrong binding or a bad client id.
      throw new RejectMessage(
        `not a command routing key: ${message.routingKey}`,
      );
    }

    const command = await this.parse(sender, message.body);
    const where = `"${command.command}" ${command.commandId} from ${sender}`;

    if (command.token.clientId !== sender) {
      console.warn(
        `[CMD] Rejected ${where}: token claims ${command.token.clientId}`,
      );
      throw new RejectMessage("token.clientId doesn't match the sender topic");
    }

    try {
      this.guard.check(command);
    } catch (error) {
      if (error instanceof CommandRejected) {
        // The claimed clientId, never the tokens.
        console.warn(`[CMD] Rejected ${where}: ${error.message}`);
        throw new RejectMessage(error.message);
      }
      throw error;
    }

    let result: { data: unknown };
    try {
      result = await this.createEvent(command.command).process(command);
    } catch (error) {
      if (error instanceof PermanentError) {
        await this.replies.error(
          sender,
          command.commandId,
          command.command,
          error.code,
          error.message,
        );
        return; // acked: retrying can't help
      }
      console.error(
        `[CMD] ${where} failed on attempt ${message.attempt}:`,
        error,
      );
      if (message.isLastAttempt) {
        await this.replies.error(
          sender,
          command.commandId,
          command.command,
          "TEMPORARY_FAILURE",
          "The command couldn't be processed. Please try again.",
        );
      }
      throw error; // retried, or dead-lettered if this was the last attempt
    }

    await this.replies.ok(
      sender,
      command.commandId,
      command.command,
      result.data,
    );
  };

  /** The command, or an INVALID_COMMAND reply and RejectMessage. */
  private async parse(sender: string, body: Buffer): Promise<IBaseCommand> {
    let raw: unknown;
    try {
      raw = JSON.parse(body.toString());
    } catch {
      await this.replies.error(
        sender,
        null,
        null,
        "INVALID_COMMAND",
        "The command is not valid JSON",
      );
      throw new RejectMessage("not JSON");
    }

    const parsed = BaseCommandSchema.safeParse(raw);
    if (!parsed.success) {
      // Echo what can be read, so the app can match the error to what it sent.
      const fields =
        typeof raw === "object" && raw !== null
          ? (raw as Record<string, unknown>)
          : {};
      const commandId =
        typeof fields.commandId === "string" ? fields.commandId : null;
      const commandName =
        typeof fields.command === "string" ? fields.command : null;
      const problems = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      await this.replies.error(
        sender,
        commandId,
        commandName,
        "INVALID_COMMAND",
        problems,
      );
      throw new RejectMessage(`invalid command: ${problems}`);
    }
    return parsed.data;
  }
}
