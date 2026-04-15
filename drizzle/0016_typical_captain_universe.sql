CREATE TABLE "user_eval_preferences" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"preferred_layout" varchar(256) DEFAULT 'c' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_eval_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_manage_own_eval_preferences" ON "user_eval_preferences" AS PERMISSIVE FOR ALL TO public USING ("user_eval_preferences"."user_id" = current_setting('app.current_user_id', true)) WITH CHECK ("user_eval_preferences"."user_id" = current_setting('app.current_user_id', true));