-- sale_charge_detail: promote the reference columns that were left FK-less on
-- creation (20260728130000_create_sale_charge_detail) into real foreign keys.
--   cd_ledger_code -> accounts.acc_ledger_master.led_id  (GL ledger posted to)
--   cd_comp_id     -> public.companys.comp_id
--   cd_branch_id   -> public.branch_master.br_id
-- All three are RESTRICT on delete: a master that a saved charge line points at
-- must not vanish from under it. cd_tax_code stays FK-less (snapshot value, no
-- module writes it from a tax master).

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_sale_charge_detail_chg"
    ON "public"."sale_charge_detail" ("cd_chg_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_sale_charge_detail_ledger"
    ON "public"."sale_charge_detail" ("cd_ledger_code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_sale_charge_detail_comp"
    ON "public"."sale_charge_detail" ("cd_comp_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_sale_charge_detail_branch"
    ON "public"."sale_charge_detail" ("cd_branch_id");

-- AddForeignKey
ALTER TABLE "public"."sale_charge_detail" ADD CONSTRAINT "fk_cd_ledger" FOREIGN KEY ("cd_ledger_code") REFERENCES "accounts"."acc_ledger_master"("led_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sale_charge_detail" ADD CONSTRAINT "fk_cd_company" FOREIGN KEY ("cd_comp_id") REFERENCES "public"."companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sale_charge_detail" ADD CONSTRAINT "fk_cd_branch" FOREIGN KEY ("cd_branch_id") REFERENCES "public"."branch_master"("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;
