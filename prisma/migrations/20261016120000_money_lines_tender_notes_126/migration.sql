-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 126 — every line on a cash or bank ledger carries a tender
--  (2026-10-16). The rule itself lives in NestJS (common/posting/
--  money-lines.ts); this is the schema it needs.
--
--    1. acc_tender_master.tnd_ledger_id is optional for the tender types that
--       post no tender leg — TEMP_CR (8), CREDIT (9), LOYALTY (10): the
--       customer or the LOYALTY_REDEMPTION role takes their money, so a ledger
--       on them was unused and misleading (TEMP.CR → Kvb, LOYALTY → Cash In
--       Hand). Required for every other type (ck_tnd_ledger_required).
--    2. acc_tender_detail takes the rows the server writes itself for a money
--       line no document row covers: td_src_doc_type 'VOUCHER' (td_src_doc_id =
--       td_voucher_id = the voucher), td_src_module 'TILL' for the till's own
--       transfers (TFlt / TDrp / TRcv / TVar / TPIn / CRem). The till's drawer
--       and safe readers skip 'VOUCHER' rows: the movement already counts them.
--    3. ix_td_voucher, ix_td_src_doc: the coverage lookup and the reports join
--       a voucher to its tender rows by either.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the ledger on a tender that posts no leg ────────────────────────────
ALTER TABLE accounts.acc_tender_master ALTER COLUMN tnd_ledger_id DROP NOT NULL;
ALTER TABLE accounts.acc_tender_master
  ADD CONSTRAINT ck_tnd_ledger_required
  CHECK (tnd_ledger_id IS NOT NULL OR tnd_type_id IN (8, 9, 10));

-- ── 2 · the server's own tender rows ────────────────────────────────────────
ALTER TABLE accounts.acc_tender_detail DROP CONSTRAINT ck_td_src_doc_type;
ALTER TABLE accounts.acc_tender_detail
  ADD CONSTRAINT ck_td_src_doc_type CHECK (td_src_doc_type::text = ANY (ARRAY[
    'SALES_ORDER', 'SALE_BILL', 'SALE_RETURN', 'RECEIPT', 'PAYMENT', 'OTHER', 'EXPENSE',
    'VOUCHER']::text[]));
ALTER TABLE accounts.acc_tender_detail DROP CONSTRAINT ck_td_src_module;
ALTER TABLE accounts.acc_tender_detail
  ADD CONSTRAINT ck_td_src_module CHECK (td_src_module::text = ANY (ARRAY[
    'SALES', 'ACCOUNTS', 'POS', 'SERVICE', 'OTHER', 'TILL']::text[]));

-- ── 3 · voucher ↔ tender rows ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_td_voucher ON accounts.acc_tender_detail (td_voucher_id)
  WHERE td_voucher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_td_src_doc ON accounts.acc_tender_detail (td_src_doc_id);
