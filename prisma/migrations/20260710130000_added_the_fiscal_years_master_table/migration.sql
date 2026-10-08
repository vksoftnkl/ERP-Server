-- CreateTable
CREATE TABLE "public"."fiscal_years" (
    "fy_id" UUID NOT NULL DEFAULT uuidv7(),
    "comp_id" UUID NOT NULL,
    "fy_year_name" CHAR(9) NOT NULL,
    "fy_begin_date" DATE NOT NULL,
    "fy_end_date" DATE NOT NULL,
    "fy_books_begin_date" DATE,
    "fy_status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "fy_is_current" BOOLEAN NOT NULL DEFAULT false,
    "fy_lock_date" DATE,
    "fy_closed_at" TIMESTAMPTZ(6),
    "fy_closed_by" UUID,
    "fy_is_carried_forward" BOOLEAN NOT NULL DEFAULT false,
    "fy_carried_forward_at" TIMESTAMPTZ(6),
    "fy_prev_fy_id" UUID,
    "fy_detached" BOOLEAN NOT NULL DEFAULT false,
    "fy_remarks" VARCHAR(500),
    "tally_guid" VARCHAR(64),
    "tally_master_id" BIGINT,
    "tally_alter_id" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6),
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "pkey_fiscal_years" PRIMARY KEY ("fy_id")
);

-- CreateIndex
CREATE INDEX "idx_fiscal_years_comp" ON "public"."fiscal_years"("comp_id", "is_deleted");

-- AddForeignKey (self-relation: previous fiscal year chain)
ALTER TABLE "public"."fiscal_years"
    ADD CONSTRAINT "fiscal_years_fy_prev_fy_id_fkey"
    FOREIGN KEY ("fy_prev_fy_id") REFERENCES "public"."fiscal_years"("fy_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Partial indexes (Prisma cannot express WHERE predicates — keep DB-only, do NOT declare in the model)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fiscal_years_comp_name"
    ON "public"."fiscal_years" ("comp_id", "fy_year_name")
    WHERE "is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_fiscal_years_current"
    ON "public"."fiscal_years" ("comp_id")
    WHERE "fy_is_current" = true AND "is_deleted" = false;

-- CHECK constraint (raw SQL)
ALTER TABLE "public"."fiscal_years"
    ADD CONSTRAINT "chk_fy_dates" CHECK ("fy_end_date" > "fy_begin_date");
