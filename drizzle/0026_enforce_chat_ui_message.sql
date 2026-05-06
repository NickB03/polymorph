DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "messages" WHERE "ui_message" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce messages.ui_message NOT NULL: null rows remain';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "ui_message" SET NOT NULL;
