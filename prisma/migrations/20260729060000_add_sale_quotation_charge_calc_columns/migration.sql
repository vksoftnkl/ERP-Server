-- Charge-calculation inputs on the quotation header and the resulting
-- per-line charge split on the item.
--
--   sq_freight_calc_type / sq_loading_calc_type
--       how the freight / loading charge is computed for this quote. Values are
--       a snapshot of charge_master.chg_method (ChargeMethod: FIXED, QTY,
--       NET_QTY, KG, QTL, TON, PERCENT). Left FK-less and check-less, matching
--       how the other chg_*/cd_* method columns are stored (the enums in
--       src/modules/master/charge-master/types/charge-enum.ts are the
--       definition of what is allowed).
--   sq_disc_alter_base
--       whether discounts change the basis the charges are computed on.
--   sqi_net_gross
--       the line's net/gross basis the charges are applied to.
--   sqi_chrg_before_tax / sqi_chrg_after_tax
--       the line's charge amount split by where it lands relative to tax
--       (before tax => part of the taxable amount, after tax => added on top).
--
-- All six are nullable with no default: a quote saved before this migration has
-- no answer for them, and NULL says so rather than implying a zero/false that
-- was never chosen.

-- AlterTable
ALTER TABLE "sales"."sale_quotation"
    ADD COLUMN "sq_freight_calc_type" VARCHAR(12),
    ADD COLUMN "sq_loading_calc_type" VARCHAR(12),
    ADD COLUMN "sq_disc_alter_base" BOOLEAN;

-- AlterTable
ALTER TABLE "sales"."sale_quotation_item"
    ADD COLUMN "sqi_net_gross" DECIMAL(14,4),
    ADD COLUMN "sqi_chrg_before_tax" DECIMAL(14,4),
    ADD COLUMN "sqi_chrg_after_tax" DECIMAL(14,4);
