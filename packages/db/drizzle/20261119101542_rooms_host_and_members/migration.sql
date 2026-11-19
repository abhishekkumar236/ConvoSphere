CREATE TYPE "room_member_role" AS ENUM('host', 'member');--> statement-breakpoint
CREATE TYPE "room_member_status" AS ENUM('active', 'left', 'banned');--> statement-breakpoint
CREATE TYPE "room_access" AS ENUM('open', 'invite_only');--> statement-breakpoint
CREATE TYPE "room_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "room_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "room_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "room_member_role" DEFAULT 'member'::"room_member_role" NOT NULL,
	"status" "room_member_status" DEFAULT 'active'::"room_member_status" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "room_members_room_user_unique" UNIQUE("room_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_title_key";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "host_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "access" "room_access" DEFAULT 'open'::"room_access" NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "status" "room_status" DEFAULT 'active'::"room_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "description" SET DATA TYPE varchar(2000) USING "description"::varchar(2000);--> statement-breakpoint
CREATE UNIQUE INDEX "room_members_one_active_host" ON "room_members" ("room_id") WHERE "role" = 'host' AND "status" = 'active';--> statement-breakpoint
CREATE INDEX "room_members_user_id_idx" ON "room_members" ("user_id");--> statement-breakpoint
CREATE INDEX "rooms_host_id_idx" ON "rooms" ("host_id");--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_id_users_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT;