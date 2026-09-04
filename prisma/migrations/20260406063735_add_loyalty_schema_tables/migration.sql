-- CreateTable
CREATE TABLE "loyaltysch_gift" (
    "gift_ls_id" INTEGER NOT NULL,
    "gift_slno" INTEGER NOT NULL,
    "gift_item_id" INTEGER NOT NULL,
    "gift_unit_id" INTEGER NOT NULL,
    "gift_qty" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "gift_points" DECIMAL(18,2) NOT NULL,
    "gift_repeat" BOOLEAN NOT NULL DEFAULT false,
    "gift_is_active" BOOLEAN NOT NULL DEFAULT true,
    "gift_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "modified_on" TIMESTAMPTZ(6),
    "modified_by" INTEGER,

    CONSTRAINT "pkey_loyaltysch_gift" PRIMARY KEY ("gift_ls_id","gift_slno")
);

-- CreateTable
CREATE TABLE "loyaltysch_list" (
    "ls_id" SERIAL NOT NULL,
    "ls_code" VARCHAR(30),
    "ls_name" VARCHAR(150) NOT NULL,
    "ls_type" VARCHAR(20) NOT NULL,
    "ls_apply_on" VARCHAR(20) NOT NULL DEFAULT 'BILL_AMOUNT',
    "ls_bill_type" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "ls_cust_type" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "ls_item_type" VARCHAR(20) NOT NULL DEFAULT 'ALL',
    "ls_start_date" DATE NOT NULL,
    "ls_end_date" DATE NOT NULL,
    "ls_comp_id" INTEGER NOT NULL,
    "ls_branch_id" INTEGER,
    "ls_points_per_inr" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ls_points_per_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ls_min_bill_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ls_max_points_per_bill" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ls_recur_apl" BOOLEAN NOT NULL DEFAULT false,
    "ls_bal_apl" BOOLEAN NOT NULL DEFAULT false,
    "ls_allow_point_earn" BOOLEAN NOT NULL DEFAULT true,
    "ls_allow_point_redeem" BOOLEAN NOT NULL DEFAULT false,
    "ls_allow_gift_redeem" BOOLEAN NOT NULL DEFAULT false,
    "ls_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ls_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "modified_on" TIMESTAMPTZ(6),
    "modified_by" INTEGER,

    CONSTRAINT "loyaltysch_list_pkey" PRIMARY KEY ("ls_id")
);

-- CreateTable
CREATE TABLE "loyaltysch_points" (
    "lspt_id" SERIAL NOT NULL,
    "lspt_ls_id" INTEGER NOT NULL,
    "lspt_slno" INTEGER NOT NULL,
    "lspt_item_id" INTEGER,
    "lspt_unit_id" INTEGER,
    "lspt_exceeds" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lspt_each" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "lspt_factor" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "lspt_points" DECIMAL(18,2) NOT NULL,
    "lspt_is_active" BOOLEAN NOT NULL DEFAULT true,
    "lspt_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "modified_on" TIMESTAMPTZ(6),
    "modified_by" INTEGER,

    CONSTRAINT "loyaltysch_points_pkey" PRIMARY KEY ("lspt_id")
);

-- CreateIndex
CREATE INDEX "idx_loyaltysch_gift_item" ON "loyaltysch_gift"("gift_item_id");

-- CreateIndex
CREATE INDEX "idx_loyaltysch_gift_unit" ON "loyaltysch_gift"("gift_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_loyaltysch_gift" ON "loyaltysch_gift"("gift_ls_id", "gift_item_id", "gift_unit_id", "gift_points");

-- CreateIndex
CREATE INDEX "idx_loyaltysch_list_active" ON "loyaltysch_list"("ls_comp_id", "ls_branch_id", "ls_is_active");

-- CreateIndex
CREATE INDEX "idx_loyaltysch_list_dates" ON "loyaltysch_list"("ls_start_date", "ls_end_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_loyaltysch_list_code" ON "loyaltysch_list"("ls_code");

-- CreateIndex
CREATE INDEX "idx_loyaltysch_points_scheme" ON "loyaltysch_points"("lspt_ls_id");

-- CreateIndex
CREATE INDEX "idx_loyaltysch_points_item" ON "loyaltysch_points"("lspt_item_id");

-- CreateIndex
CREATE INDEX "idx_loyaltysch_points_unit" ON "loyaltysch_points"("lspt_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_loyaltysch_points_scheme_slno" ON "loyaltysch_points"("lspt_ls_id", "lspt_slno");

-- AddForeignKey
ALTER TABLE "loyaltysch_gift" ADD CONSTRAINT "loyaltysch_gift_gift_ls_id_fkey" FOREIGN KEY ("gift_ls_id") REFERENCES "loyaltysch_list"("ls_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyaltysch_points" ADD CONSTRAINT "loyaltysch_points_lspt_ls_id_fkey" FOREIGN KEY ("lspt_ls_id") REFERENCES "loyaltysch_list"("ls_id") ON DELETE CASCADE ON UPDATE CASCADE;
