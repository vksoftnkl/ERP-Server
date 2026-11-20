-- ═══════════════════════════════════════════════════════════════════════════
--  Mobile app: sale return upload (/mobile/returns)               2026-11-20
--  Folder: prisma/migrations/20261120170000_mobile_sale_returns/
--
--  The React Native salesman app (VKSMAN, canvas page 6b) uploads sale
--  returns it made offline. An upload whose answer was lost is sent again, so
--  the return carries the phone's own uuid and the server answers a resend
--  with the return it already has (or re-saves its DRAFT) instead of saving a
--  second one. The same pattern as sb_client_uuid / avh_client_uuid in
--  20261118120000_mobile_bills_receipts, which this sorts after.
--
--   1 · sales.sale_return.sr_client_uuid uuid NULL: the phone's id for the
--       return. NULL on every desktop return.
--       ux_sr_client_uuid UNIQUE (sr_company_id, sr_client_uuid, sr_acc_year).
--   2 · sales.sale_return.sr_mobile_refno varchar(30) NULL: the phone's own
--       number for the return (e.g. R3F9A/2627/00005), shown beside VK Nex's
--       SRT number. sr_usr_refno keeps its desktop meaning (the shop's own
--       debit note number), so the phone's number gets a column of its own
--       (plan-mobile-sales-return-2026-11-20 D12).
--
--  sale_return is LIST-partitioned by acc_year, and a unique index on a
--  partitioned table must hold the partition key, so the year is in the key.
--  The server's duplicate check reads across every year under a transaction
--  lock on (company, client uuid); the index is the backstop within a year.
--  Not partial (as ux_sb_client_uuid): NULLs are distinct, so every desktop
--  row coexists, and Prisma can declare a non-partial index.
--
--  No new table, so no db_table_master row and no partition helper change.
--  No business-logic function or trigger. Additive only; every statement is
--  re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · sale_return.sr_client_uuid ─────────────────────────────────────────
ALTER TABLE sales.sale_return ADD COLUMN IF NOT EXISTS sr_client_uuid uuid;

COMMENT ON COLUMN sales.sale_return.sr_client_uuid IS
    'The phone''s own id for a sale return uploaded from the mobile app (/mobile/returns/create). A resend with the same (company, client uuid) answers the return already saved, or re-saves its DRAFT. NULL on desktop returns.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_sr_client_uuid
    ON sales.sale_return (sr_company_id, sr_client_uuid, sr_acc_year);


-- ── 2 · sale_return.sr_mobile_refno ────────────────────────────────────────
ALTER TABLE sales.sale_return ADD COLUMN IF NOT EXISTS sr_mobile_refno varchar(30);

COMMENT ON COLUMN sales.sale_return.sr_mobile_refno IS
    'The phone''s own number for a sale return uploaded from the mobile app (e.g. R3F9A/2627/00005). sr_usr_refno keeps the desktop meaning (the shop''s own debit note number). NULL on desktop returns.';
