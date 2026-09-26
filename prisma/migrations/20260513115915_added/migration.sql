-- CreateTable
CREATE TABLE "sales"."sale_agent_groups" (
    "sa_grp_id" UUID NOT NULL DEFAULT uuidv7(),
    "sa_grp_name" VARCHAR(150) NOT NULL,
    "sa_grp_code" VARCHAR(50) NOT NULL,
    "sa_grp_pos" INTEGER DEFAULT 0,
    "sa_grp_desc" VARCHAR(250),
    "sa_grp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "sa_grp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "sa_grp_sync_date" TIMESTAMPTZ,
    "sa_grp_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sa_grp_created_by" UUID NOT NULL,
    "sa_grp_modified_on" TIMESTAMPTZ,
    "sa_grp_modified_by" UUID,

    CONSTRAINT "sale_agent_groups_pkey" PRIMARY KEY ("sa_grp_id")
);

-- CreateIndex
CREATE INDEX "idx_sale_agent_groups_active_deleted" ON "sales"."sale_agent_groups"("sa_grp_is_active", "sa_grp_is_deleted");

-- CreateIndex
CREATE INDEX "idx_sale_agent_groups_id" ON "sales"."sale_agent_groups"("sa_grp_id");

-- CreateIndex
CREATE INDEX "idx_sale_agent_groups_name" ON "sales"."sale_agent_groups"("sa_grp_name");
