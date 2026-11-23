import type { Topology } from "helpers";

/**
 * room-service's queues (docs/room-service-plan.md):
 *   app ─MQTT─► users/user-42/cmd ─► amq.topic "users.user-42.cmd" ─► room-service.commands
 *   temporary failure ─► room-service.retry ─► room-service.commands.retry (held RETRY_DELAY_MS)
 *                        ─► back to amq.topic with the same routing key ─► room-service.commands
 *   last attempt failed, or bad input ─► room-service.dlx ─► room-service.commands.dlq
 * Every instance declares these at startup; an identical declaration is a no-op for RabbitMQ.
 * Queue arguments can't be changed on an existing queue (PRECONDITION_FAILED): changing them
 * means deleting and recreating the queue.
 */
export const COMMANDS_QUEUE = "room-service.commands";
export const RETRY_EXCHANGE = "room-service.retry";
export const RETRY_QUEUE = "room-service.commands.retry";
export const DEAD_LETTER_EXCHANGE = "room-service.dlx";
export const DEAD_LETTER_QUEUE = "room-service.commands.dlq";

/** Attempts per command after a thrown error: the first try + 2 retries, RETRY_DELAY_MS apart. */
export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;
/**
 * Broker-side guard against a command that crashes every instance that takes it: deliveries
 * lost to a crash are counted, and after this many it's dead-lettered. (A thrown error is
 * handled by the retry queue instead: RabbitMQ 4 doesn't count a requeue towards this limit.)
 */
export const CRASH_DELIVERY_LIMIT = 3;
/** Unacked commands one instance holds at once. */
export const COMMANDS_PREFETCH = 20;

const quorumDeadLettering = {
  "x-queue-type": "quorum",
  // Dead-letter without losing messages if the target can't take them yet;
  // RabbitMQ requires reject-publish overflow for this strategy.
  "x-dead-letter-strategy": "at-least-once",
  "x-overflow": "reject-publish",
};

export const roomServiceTopology: Topology = {
  exchanges: [
    { name: DEAD_LETTER_EXCHANGE, type: "topic", options: { durable: true } },
    { name: RETRY_EXCHANGE, type: "topic", options: { durable: true } },
  ],
  queues: [
    {
      name: DEAD_LETTER_QUEUE,
      options: { durable: true, arguments: { "x-queue-type": "quorum" } },
      // Dead-lettered messages keep their routing key ("users.user-42.cmd"): "#" takes them all.
      bindings: [{ exchange: DEAD_LETTER_EXCHANGE, pattern: "#" }],
    },
    {
      name: RETRY_QUEUE,
      options: {
        durable: true,
        arguments: {
          ...quorumDeadLettering,
          // Held this long, then dead-lettered to amq.topic with its original routing key,
          // which lands it back in room-service.commands.
          "x-message-ttl": RETRY_DELAY_MS,
          "x-dead-letter-exchange": "amq.topic",
        },
      },
      bindings: [{ exchange: RETRY_EXCHANGE, pattern: "#" }],
    },
    {
      name: COMMANDS_QUEUE,
      options: {
        durable: true,
        arguments: {
          ...quorumDeadLettering,
          "x-delivery-limit": CRASH_DELIVERY_LIMIT,
          "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
        },
      },
      // MQTT publishes land on amq.topic with "/" turned into ".".
      bindings: [{ exchange: "amq.topic", pattern: "users.*.cmd" }],
    },
  ],
};
