-- Note: Snapshots 0011-0014 were retroactively updated to rename the provider
-- enum value 'e2b' → 'sandbox'. The artifact_runtime_sessions table was introduced
-- as part of the e2b sandbox system, which was replaced by canvas artifacts before
-- production deployment. No production database contains 'e2b' provider data.

CREATE TABLE "artifact_revisions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"artifact_id" varchar(191) NOT NULL,
	"triggering_message_id" varchar(191) NOT NULL,
	"prompt_summary" text NOT NULL,
	"title" text NOT NULL,
	"sandbox_snapshot_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artifact_runtime_sessions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"artifact_id" varchar(191) NOT NULL,
	"provider" varchar(256) DEFAULT 'sandbox' NOT NULL,
	"sandbox_id" text NOT NULL,
	"preview_url" text,
	"status" varchar(256) DEFAULT 'building' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_heartbeat_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "artifact_runtime_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"chat_id" varchar(191) NOT NULL,
	"user_id" varchar(255),
	"current_revision_id" varchar(191),
	"current_runtime_session_id" varchar(191),
	"title" text NOT NULL,
	"framework" varchar(256) DEFAULT 'react-spa' NOT NULL,
	"status" varchar(256) DEFAULT 'building' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_triggering_message_id_messages_id_fk" FOREIGN KEY ("triggering_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_runtime_sessions" ADD CONSTRAINT "artifact_runtime_sessions_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_revisions_artifact_id_created_at_idx" ON "artifact_revisions" USING btree ("artifact_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "artifact_runtime_sessions_artifact_id_started_at_idx" ON "artifact_runtime_sessions" USING btree ("artifact_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "artifacts_chat_id_idx" ON "artifacts" USING btree ("chat_id");--> statement-breakpoint
CREATE POLICY "users_manage_own_artifact_revisions" ON "artifact_revisions" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
        SELECT 1 FROM "artifacts"
        WHERE "artifacts".id = artifact_id
        AND "artifacts".user_id = current_setting('app.current_user_id', true)
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM "artifacts"
        WHERE "artifacts".id = artifact_id
        AND "artifacts".user_id = current_setting('app.current_user_id', true)
      ));--> statement-breakpoint
CREATE POLICY "users_manage_own_artifact_runtime_sessions" ON "artifact_runtime_sessions" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
        SELECT 1 FROM "artifacts"
        WHERE "artifacts".id = artifact_id
        AND "artifacts".user_id = current_setting('app.current_user_id', true)
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM "artifacts"
        WHERE "artifacts".id = artifact_id
        AND "artifacts".user_id = current_setting('app.current_user_id', true)
      ));--> statement-breakpoint
CREATE POLICY "users_manage_own_artifacts" ON "artifacts" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.current_user_id', true)) WITH CHECK (user_id = current_setting('app.current_user_id', true));
