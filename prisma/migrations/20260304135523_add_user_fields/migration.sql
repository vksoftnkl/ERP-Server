-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "public"."user_code_seq";

-- AlterTable
ALTER TABLE "public"."users"
ADD COLUMN "user_code" VARCHAR(20),
ADD COLUMN "user_phone" VARCHAR(20),
ADD COLUMN "created_at" TIMESTAMP(3),
ADD COLUMN "updated_at" TIMESTAMP(3);

-- Backfill existing rows before adding NOT NULL + UNIQUE constraints
UPDATE "public"."users"
SET
  "user_code" = COALESCE("user_code", ('us' || nextval('"public"."user_code_seq"'::regclass))),
  "user_phone" = COALESCE("user_phone", ('PH' || right(replace("user_id"::text, '-', ''), 18))),
  "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "updated_at" = COALESCE("updated_at", CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "public"."users"
ALTER COLUMN "user_code" SET DEFAULT ('us' || nextval('"public"."user_code_seq"'::regclass)),
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "user_code" SET NOT NULL,
ALTER COLUMN "user_phone" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_user_code_key" ON "public"."users"("user_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_phone_key" ON "public"."users"("user_phone");
