-- The <prefix>_sync_date columns, WITHOUT the cloud-sync machinery.
--
-- The prisma fragments declare these 24 columns, but until now only the
-- local-only migration 20260923120000_offline_cloud_sync (kept out of git)
-- created them. Every database that never ran it (live) failed every query on
-- these tables with "column ... does not exist" (e.g. item_master.item_sync_date).
--
-- This adds the bare columns only: nullable, no default, no triggers, no
-- sync_deleted_rows. They stay NULL and unused unless the local cloud-sync
-- module is installed. IF NOT EXISTS makes this a no-op on databases where the
-- cloud-sync migration already ran, and lets that migration still run after it.

ALTER TABLE accounts.acc_ledger_role      ADD COLUMN IF NOT EXISTS alr_sync_date    timestamptz(6);
ALTER TABLE accounts.acc_opening_balance  ADD COLUMN IF NOT EXISTS op_sync_date     timestamptz(6);
ALTER TABLE accounts.acc_opening_run      ADD COLUMN IF NOT EXISTS aor_sync_date    timestamptz(6);
ALTER TABLE accounts.acc_tcs_register     ADD COLUMN IF NOT EXISTS atc_sync_date    timestamptz(6);
ALTER TABLE accounts.acc_tds_register     ADD COLUMN IF NOT EXISTS atd_sync_date    timestamptz(6);
ALTER TABLE accounts.acc_voucher_seq      ADD COLUMN IF NOT EXISTS seq_sync_date    timestamptz(6);
ALTER TABLE audit.audit_log               ADD COLUMN IF NOT EXISTS log_sync_date    timestamptz(6);
ALTER TABLE audit.audit_screen            ADD COLUMN IF NOT EXISTS screen_sync_date timestamptz(6);
ALTER TABLE fixed.gsp_provider_master     ADD COLUMN IF NOT EXISTS gsp_sync_date    timestamptz(6);
ALTER TABLE fixed.hsn_master              ADD COLUMN IF NOT EXISTS hsn_sync_date    timestamptz(6);
ALTER TABLE fixed.stock_adj_reasons       ADD COLUMN IF NOT EXISTS sar_sync_date    timestamptz(6);
ALTER TABLE inventory.godown_locations    ADD COLUMN IF NOT EXISTS gdl_sync_date    timestamptz(6);
ALTER TABLE inventory.item_batch_master   ADD COLUMN IF NOT EXISTS btm_sync_date    timestamptz(6);
ALTER TABLE inventory.item_batch_stock    ADD COLUMN IF NOT EXISTS ibs_sync_date    timestamptz(6);
ALTER TABLE inventory.item_ean_codes      ADD COLUMN IF NOT EXISTS ean_sync_date    timestamptz(6);
ALTER TABLE inventory.item_master         ADD COLUMN IF NOT EXISTS item_sync_date   timestamptz(6);
ALTER TABLE inventory.item_reorders       ADD COLUMN IF NOT EXISTS ir_sync_date     timestamptz(6);
ALTER TABLE inventory.item_tax_history    ADD COLUMN IF NOT EXISTS ith_sync_date    timestamptz(6);
ALTER TABLE public.app_theme_master       ADD COLUMN IF NOT EXISTS thm_sync_date    timestamptz(6);
ALTER TABLE public.company_aato           ADD COLUMN IF NOT EXISTS caa_sync_date    timestamptz(6);
ALTER TABLE public.fiscal_years           ADD COLUMN IF NOT EXISTS fy_sync_date     timestamptz(6);
ALTER TABLE public.print_log              ADD COLUMN IF NOT EXISTS plg_sync_date    timestamptz(6);
ALTER TABLE sales.cust_groups             ADD COLUMN IF NOT EXISTS cgr_sync_date    timestamptz(6);
ALTER TABLE sales.cust_item_rates         ADD COLUMN IF NOT EXISTS csr_sync_date    timestamptz(6);
