-- Drops three tables nothing reads any more.
--
--   accounts.acc_voucher_cheques      — R1 left ONE cheque table. fk_abj_cheque
--                                       was repointed to accounts.acc_pdc_register
--                                       by 20260915120000 and no row was ever
--                                       written here afterwards; the table is empty.
--   accounts.acc_voucher_doc_api_log  — the per-document "last exchange" log. Never
--                                       written: public.gst_api_log records every
--                                       exchange instead. Empty.
--   public.configs                    — the generic key/value settings table behind
--                                       the Configs API. The module, its two routes
--                                       and grid 64 go with it.
--
-- Nothing references any of the three: no inbound foreign keys, no views, no
-- functions. The six enum types below exist only for the two dropped columns
-- each, so they go too.

-- Grid 64 ("configs") selected from public.configs, so it cannot outlive it.
DELETE FROM fixed.grid_columns WHERE grid_id = 64;
DELETE FROM fixed.grid_details WHERE grid_id = 64;

DROP TABLE IF EXISTS accounts.acc_voucher_doc_api_log;
DROP TYPE IF EXISTS accounts."GdlApiName";
DROP TYPE IF EXISTS accounts."GdlActionName";
DROP TYPE IF EXISTS accounts."GdlStatus";

DROP TABLE IF EXISTS accounts.acc_voucher_cheques;
DROP TYPE IF EXISTS accounts."ChequeTraType";
DROP TYPE IF EXISTS accounts."ChequeInstrumentType";
DROP TYPE IF EXISTS accounts."ChequeStatus";

DROP TABLE IF EXISTS public.configs;
