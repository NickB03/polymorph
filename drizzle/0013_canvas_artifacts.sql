CREATE TABLE "canvas_artifact_versions" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"artifact_id" varchar(191) NOT NULL,
	"version_number" integer NOT NULL,
	"source_snapshot" jsonb NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_artifact_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "canvas_artifacts" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"chat_id" varchar(191) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"status" varchar(256) DEFAULT 'compiling' NOT NULL,
	"draft_source" jsonb NOT NULL,
	"draft_compiled_html" text,
	"draft_diagnostics" jsonb,
	"draft_revision" integer DEFAULT 0 NOT NULL,
	"current_version_id" varchar(191),
	"last_compiled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "canvas_artifact_versions" ADD CONSTRAINT "canvas_artifact_versions_artifact_id_canvas_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."canvas_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_artifacts" ADD CONSTRAINT "canvas_artifacts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_artifact_versions_artifact_id_version_number_idx" ON "canvas_artifact_versions" USING btree ("artifact_id","version_number");--> statement-breakpoint
CREATE INDEX "canvas_artifact_versions_artifact_id_created_at_idx" ON "canvas_artifact_versions" USING btree ("artifact_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "canvas_artifacts_chat_id_idx" ON "canvas_artifacts" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "canvas_artifacts_user_id_updated_at_idx" ON "canvas_artifacts" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "users_manage_own_canvas_artifact_versions" ON "canvas_artifact_versions" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
        SELECT 1 FROM "canvas_artifacts"
        WHERE "canvas_artifacts".id = artifact_id
        AND "canvas_artifacts".user_id = current_setting('app.current_user_id', true)
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM "canvas_artifacts"
        WHERE "canvas_artifacts".id = artifact_id
        AND "canvas_artifacts".user_id = current_setting('app.current_user_id', true)
      ));--> statement-breakpoint
CREATE POLICY "users_manage_own_canvas_artifacts" ON "canvas_artifacts" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.current_user_id', true)) WITH CHECK (user_id = current_setting('app.current_user_id', true));