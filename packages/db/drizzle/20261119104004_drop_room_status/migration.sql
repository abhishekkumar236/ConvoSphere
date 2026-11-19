-- Closed rooms would look open once "status" is gone; under the new rule they no longer exist.
DELETE FROM "rooms" WHERE "status" = 'closed';--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "closed_at";--> statement-breakpoint
DROP TYPE "room_status";