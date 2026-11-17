-- ═══════════════════════════════════════════════════════════════════════════
--  Mobile app: bill upload (/mobile/bills) and receipt upload
--  (/mobile/receipts)                                            2026-11-17
--  Folder: prisma/migrations/20261118120000_mobile_bills_receipts/
--
--  The React Native salesman app uploads bills and receipts it made offline.
--  An upload whose answer was lost is sent again, so both writes carry the
--  phone's own uuid and the server answers a resend with the row it already
--  has instead of saving it twice. The same pattern as so_client_uuid in
--  20261118110000_mobile_orders_visits, which this sorts after.
--
--   1 · sales.sale_bill.sb_client_uuid uuid NULL: the phone's id for the
--       bill. NULL on every desktop bill.
--       ux_sb_client_uuid UNIQUE (sb_company_id, sb_client_uuid, sb_acc_year).
--   2 · accounts.acc_voucher_header.avh_client_uuid uuid NULL: the phone's id
--       for the receipt. NULL on everything else: desktop receipts, payments,
--       journals, a bill's posted voucher, and a receipt's own post-dated
--       cheque and reversal vouchers.
--       ux_avh_client_uuid UNIQUE (avh_company_id, avh_client_uuid, avh_acc_year).
--
--  Both tables are LIST-partitioned by acc_year, and a unique index on a
--  partitioned table must hold the partition key, so the year is in each key.
--  The server's duplicate check reads across every year under a transaction
--  lock on (company, client uuid), so a resend after the year turns is still
--  found. The index is the backstop within a year.
--
--  NOT partial: a deleted or cancelled bill or receipt still holds its uuid,
--  so a resend of one the office cancelled is not saved again. That is safe
--  for amend because no path copies a header row into a new one: bill amend,
--  void and retender and receipt amend update the same row in place; receipt
--  cancel's reversal, the PDC child vouchers and the shared reversal in
--  VoucherPostingService name their columns, so the new column stays NULL on
--  every row they insert. Only the uploaded document's own header may carry
--  the uuid; stamping it on a child voucher would collide with the parent (or,
--  after a receipt amend, with the soft-deleted child it replaced).
--
--  NULLs are distinct (the default), so every desktop row coexists.
--  No new table, so no db_table_master row and no partition helper change.
--  No business-logic function or trigger. Every statement is re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · sale_bill.sb_client_uuid ───────────────────────────────────────────
ALTER TABLE sales.sale_bill ADD COLUMN IF NOT EXISTS sb_client_uuid uuid;

COMMENT ON COLUMN sales.sale_bill.sb_client_uuid IS
    'The phone''s own id for a bill uploaded from the mobile app (/mobile/bills/create). A resend with the same (company, client uuid) answers the bill already saved. NULL on desktop bills.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_sb_client_uuid
    ON sales.sale_bill (sb_company_id, sb_client_uuid, sb_acc_year);


-- ── 2 · acc_voucher_header.avh_client_uuid ─────────────────────────────────
ALTER TABLE accounts.acc_voucher_header ADD COLUMN IF NOT EXISTS avh_client_uuid uuid;

COMMENT ON COLUMN accounts.acc_voucher_header.avh_client_uuid IS
    'The phone''s own id for a receipt uploaded from the mobile app (/mobile/receipts/create). A resend with the same (company, client uuid) answers the receipt already saved. NULL on everything else, including the receipt''s own post-dated cheque and reversal vouchers.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_avh_client_uuid
    ON accounts.acc_voucher_header (avh_company_id, avh_client_uuid, avh_acc_year);
