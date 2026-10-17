-- ═══════════════════════════════════════════════════════════════════════════
--  2026-10-06 — the charge-basis amounts were the narrowest money on the line.
--
--  *_net_gross, *_chrg_before_tax, *_chrg_after_tax on the sales item tables
--  and the txn_charge_detail amounts were numeric(14,4): ten integer digits,
--  so any line whose goods value reached 10^10 died on INSERT with SQLSTATE
--  22003 "numeric field overflow" (POST /bills/create, sale_bill_item) while
--  the same figure fitted every sibling column — sbi_gross_amt,
--  sbi_taxable_amt (= net_gross + chrg_before_tax), sbi_net_amt and the header
--  totals are all numeric(15,2), thirteen integer digits.
--
--  numeric(17,4) gives these columns the same thirteen integer digits and
--  keeps scale 4, so no stored value is rounded. A precision-only increase is
--  binary-compatible: Postgres changes the catalog and skips the rewrite. The
--  parents are partitioned by acc_year; ALTER on the parent recurses.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE sales.sale_quotation_item
    ALTER COLUMN sqi_net_gross       TYPE numeric(17,4),
    ALTER COLUMN sqi_chrg_before_tax TYPE numeric(17,4),
    ALTER COLUMN sqi_chrg_after_tax  TYPE numeric(17,4);

ALTER TABLE sales.sale_order_item
    ALTER COLUMN soi_net_gross       TYPE numeric(17,4),
    ALTER COLUMN soi_chrg_before_tax TYPE numeric(17,4),
    ALTER COLUMN soi_chrg_after_tax  TYPE numeric(17,4);

ALTER TABLE sales.sale_dc_item
    ALTER COLUMN sdi_chrg_before_tax TYPE numeric(17,4),
    ALTER COLUMN sdi_chrg_after_tax  TYPE numeric(17,4);

ALTER TABLE sales.sale_bill_item
    ALTER COLUMN sbi_net_gross       TYPE numeric(17,4),
    ALTER COLUMN sbi_chrg_before_tax TYPE numeric(17,4),
    ALTER COLUMN sbi_chrg_after_tax  TYPE numeric(17,4);

ALTER TABLE sales.sale_return_item
    ALTER COLUMN sri_chrg_before_tax TYPE numeric(17,4),
    ALTER COLUMN sri_chrg_after_tax  TYPE numeric(17,4);

ALTER TABLE public.txn_charge_detail
    ALTER COLUMN cd_rate     TYPE numeric(17,4),
    ALTER COLUMN cd_amount   TYPE numeric(17,4),
    ALTER COLUMN cd_tax_amt  TYPE numeric(17,4),
    ALTER COLUMN cd_sgst_amt TYPE numeric(17,4),
    ALTER COLUMN cd_cgst_amt TYPE numeric(17,4),
    ALTER COLUMN cd_igst_amt TYPE numeric(17,4),
    ALTER COLUMN cd_cess_amt TYPE numeric(17,4),
    ALTER COLUMN cd_net_amt  TYPE numeric(17,4);
