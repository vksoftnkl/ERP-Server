CREATE TABLE "godowns" (
    "godown_id" UUID NOT NULL DEFAULT uuidv7(),
    "godown_name" VARCHAR,
    "godown_short" VARCHAR,
    "godown_is_del_sheet" BOOLEAN DEFAULT false,
    "godown_split_stock" BOOLEAN DEFAULT false,
    "godown_default_godown" BOOLEAN DEFAULT false,
    "godown_volume" NUMERIC,
    "godown_sort" INTEGER,
    "godown_active" CHAR(1) DEFAULT 'Y',
    "godown_is_active" BOOLEAN DEFAULT true,
    "godown_is_deleted" BOOLEAN DEFAULT false,
    "godown_negative_stock" BOOLEAN DEFAULT true,
    "godown_group" INTEGER,

    CONSTRAINT "godowns_pkey" PRIMARY KEY ("godown_id")
);

CREATE INDEX "idx_godown_id" ON "godowns"("godown_id");
