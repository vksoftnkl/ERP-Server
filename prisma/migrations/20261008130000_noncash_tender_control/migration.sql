-- ═══════════════════════════════════════════════════════════════════════════
--  49 · NON-CASH TENDER CONTROL — card / UPI / wallet: reference at billing,
--       one figure per machine at close, statement matching the next day
--                                                                  2026-10-08
--
--  The 49_noncash_tender_control.sql file of the share, made a migration the
--  way 20261008100000 / 20261008110000 shipped 47 / 48.
--
--  Plan: till/plan-noncash-tender-control.md. Runs AFTER
--  20261008110000_till_money_docs. Restates 48's CHECK lists on till_reason /
--  till_approval_rule / till_approval / till_event with the new codes added
--  (checked against the live constraints: every value 48 left is kept).
--
--  WHY THE TWO NEW TABLES (house rule: a new table only for information no
--  existing row can hold): a provider statement line is the PROVIDER's fact —
--  what the acquirer / PSP says it paid, net of its fee. A tender row is OUR
--  fact. Money that arrived with no bill behind it has no tender row to sit
--  on, and a payout (one bank credit, many lines) has no row anywhere. So:
--    acc_settlement_import  one payout (one bank credit) — the file it came in
--    acc_settlement_line    one provider line, and what it was matched to
--  Everything else rides on existing columns: acc_tender_detail.td_settle_*,
--  acc_tender_master.tnd_terminal_id / tnd_settlement_ledger_id / _days /
--  tnd_needs_ref.
--
--  REVIEW 2026-10-07 (till/plan-till-review-rev2.md): tvr_rows on till_variance,
--  the closed-session pairing (asl_tvr_*), BANK source, GST-on-charges role,
--  ck_tap_event restated.
--
--  HOUSE RULES KEPT
--   * No new function, trigger or view. Matching and posting are NestJS
--     (TenderSettlementService). (Two EXISTING functions are restated — below.)
--   * ONE WRITER PER ROW: acc_tender_detail rows are written by the STORE
--     server, so the statement is imported, matched and posted THROUGH THE
--     STORE SERVER'S API (as a remote till approval is). HO uploading a chain
--     file splits it by terminal / VPA and sends each part to its store. The
--     cloud never writes td_settle_* — its push would be overwritten.
--   * Partitioned by acc_year, PK (id, acc_year); amounts positive, the
--     direction is asl_kind.
--
--  DIFFERENCES FROM THE SHARE FILE (the same three 47 needed)
--   1. No BEGIN / COMMIT: Prisma runs the migration in its own transaction.
--   2. §8 — GST_ON_CHARGES_PENDING is added to fn_ledger_map_catalogue(),
--      restated in full, or fn_seed_ledger_map() refuses every boot. Its home:
--        GST on Payment Charges (Pending)   GENERAL   Current Assets
--      NOT 'Duties & Taxes' (a Liabilities group here — the role wants Assets)
--      and NOT a TAX-type ledger: this is tax that is not yet input credit, and
--      the GST returns read TAX ledgers. The map is then seeded. The TSet
--      serial is kept ahead of any pinned id, as 47 / 48 do.
--   3. §10 — public.ensure_acc_year_partitions (the helper deploy.sh calls) is
--      restated from the live definition with the two settlement tables added,
--      and partitions are made for 2026-2027 and every year that already has
--      them — not 2026-2027 alone.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · tender master: how its statement file reads ───────────────────────
--  One acc_tender_master row PER TERMINAL / PER VPA (CARD-T1, CARD-T2, UPI-QR1)
--  is a SET-UP rule, not a schema change: tnd_terminal_id already exists and
--  the close counts one line per tender (till_count_line.tcl_tender_id).
ALTER TABLE accounts.acc_tender_master
    ADD COLUMN IF NOT EXISTS tnd_statement_format jsonb;   -- column map of the provider's file; NULL = no import

-- ── 1b · which tender rows a close-time NON-CASH variance covers ──────────
--  The slip check (plan §4.2) finds the rows behind a card gap; the close parks
--  them in Tender suspense. Without this list a later TSet would credit the
--  clearing ledger for a row already credited by the close TVar (clearing −x,
--  suspense +x forever), and a write-off could not tell which ledger to credit.
--  [{"td_id": …, "td_acc_year": "2026-2027", "amount": 160.00}] — same store writes both.
ALTER TABLE accounts.till_variance
    ADD COLUMN IF NOT EXISTS tvr_rows jsonb;

-- ── 2 · one payout = one import ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts.acc_settlement_import
(
    asi_id                uuid          NOT NULL DEFAULT uuidv7(),
    asi_company_id        uuid          NOT NULL,
    asi_branch_id         uuid          NOT NULL,
    asi_tenant_id         uuid,
    asi_acc_year          character(9)  NOT NULL,
    asi_source            character varying(12)  NOT NULL,       -- CARD | UPI | WALLET (aggregator payout) · BANK (UPI straight to the current account: one statement period, one credit per line, no fee)
    asi_provider          character varying(60)  NOT NULL,       -- acquirer / PSP as printed on the file
    asi_tender_id         uuid,                                  -- the terminal / VPA tender; NULL = lines carry their own terminal
    asi_file_name         character varying(250) NOT NULL,
    asi_file_hash         character varying(64)  NOT NULL,       -- sha256: the same file twice is refused
    asi_payout_ref        character varying(60),                 -- UTR of the bank credit
    asi_payout_date       date          NOT NULL,                -- = the voucher date
    asi_period_from       date,
    asi_period_to         date,
    asi_line_count        integer       NOT NULL DEFAULT 0,
    asi_total_gross       numeric(15,2) NOT NULL DEFAULT 0,      -- sales − refunds − chargebacks as the provider states
    asi_total_fee         numeric(15,2) NOT NULL DEFAULT 0,      -- MDR / commission
    asi_total_tax         numeric(15,2) NOT NULL DEFAULT 0,      -- GST on the fee (input credit)
    asi_total_net         numeric(15,2) NOT NULL DEFAULT 0,      -- what reached the bank
    asi_status            character varying(10)  NOT NULL DEFAULT 'IMPORTED',  -- IMPORTED | MATCHED | POSTED | VOIDED
    asi_bank_ledger_id    uuid,                                  -- tnd_settlement_ledger_id at import
    asi_voucher_id        uuid,                                  -- the TSet voucher
    asi_voucher_acc_year  character(9),
    asi_imported_by       uuid          NOT NULL,
    asi_imported_on       timestamptz   NOT NULL DEFAULT now(),
    asi_posted_by         uuid,
    asi_posted_on         timestamptz,
    asi_void_reason       character varying(250),
    asi_notes             character varying(500),
    asi_is_deleted        boolean       NOT NULL DEFAULT false,
    asi_sync_date         timestamptz,
    asi_created_on        timestamptz   NOT NULL DEFAULT now(),
    asi_created_by        character varying(50),
    asi_modified_on       timestamptz,
    asi_modified_by       character varying(50),
    CONSTRAINT pk_acc_settlement_import PRIMARY KEY (asi_id, asi_acc_year),
    CONSTRAINT fk_asi_bank FOREIGN KEY (asi_bank_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_asi_source CHECK (asi_source::text = ANY (ARRAY['CARD','UPI','WALLET','BANK'])),
    -- a bank-statement import has no payout of its own and no fee
    CONSTRAINT ck_asi_bank CHECK (asi_source <> 'BANK' OR (asi_payout_ref IS NULL AND asi_total_fee = 0 AND asi_total_tax = 0)),
    CONSTRAINT ck_asi_status CHECK (asi_status::text = ANY (ARRAY['IMPORTED','MATCHED','POSTED','VOIDED'])),
    -- the payout's own arithmetic (one row: allowed under the offline rule)
    CONSTRAINT ck_asi_net CHECK (asi_total_net = asi_total_gross - asi_total_fee - asi_total_tax),
    CONSTRAINT ck_asi_amounts CHECK (asi_total_fee >= 0 AND asi_total_tax >= 0 AND asi_line_count >= 0),
    CONSTRAINT ck_asi_period CHECK (asi_period_to IS NULL OR asi_period_from IS NULL OR asi_period_to >= asi_period_from),
    CONSTRAINT ck_asi_posted CHECK ((asi_status = 'POSTED') =
        (asi_voucher_id IS NOT NULL AND asi_posted_by IS NOT NULL AND asi_posted_on IS NOT NULL)),
    CONSTRAINT ck_asi_voucher_pair CHECK ((asi_voucher_id IS NULL) = (asi_voucher_acc_year IS NULL)),
    CONSTRAINT ck_asi_void CHECK (asi_status <> 'VOIDED' OR asi_void_reason IS NOT NULL)
) PARTITION BY LIST (asi_acc_year);
-- the same file is imported once (single writer: the store that owns the terminal)
CREATE UNIQUE INDEX IF NOT EXISTS ux_asi_file
    ON accounts.acc_settlement_import (asi_company_id, asi_branch_id, asi_file_hash, asi_acc_year)
    WHERE asi_is_deleted = false AND asi_status <> 'VOIDED';
CREATE INDEX IF NOT EXISTS ix_asi_open
    ON accounts.acc_settlement_import (asi_company_id, asi_branch_id, asi_payout_date)
    WHERE asi_is_deleted = false AND asi_status IN ('IMPORTED','MATCHED');

-- ── 3 · one provider line ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts.acc_settlement_line
(
    asl_id                uuid          NOT NULL DEFAULT uuidv7(),
    asl_acc_year          character(9)  NOT NULL,
    asl_import_id         uuid          NOT NULL,
    asl_row_no            integer       NOT NULL,
    asl_kind              character varying(12)  NOT NULL,       -- SALE | REFUND | CHARGEBACK | FEE | ADJUSTMENT
    asl_txn_on            timestamptz,                           -- when the customer paid, as the provider says
    asl_terminal_id       character varying(40),                 -- TID; matched to acc_tender_master.tnd_terminal_id
    asl_vpa               character varying(100),                -- UPI: the payee VPA
    asl_tender_id         uuid,                                  -- resolved from TID / VPA / the import
    asl_ref_no            character varying(60),                 -- RRN / UTR
    asl_auth_code         character varying(20),
    asl_card_last4        character(4),
    asl_payer             character varying(150),                -- payer VPA / card network, as given
    asl_gross_amount      numeric(15,2) NOT NULL,
    asl_fee_amount        numeric(15,2) NOT NULL DEFAULT 0,
    asl_tax_amount        numeric(15,2) NOT NULL DEFAULT 0,
    asl_net_amount        numeric(15,2) NOT NULL,
    -- what it was matched to
    asl_match_status      character varying(10)  NOT NULL DEFAULT 'UNMATCHED',  -- UNMATCHED | SUGGESTED | MATCHED | IGNORED | RESOLVED
    asl_match_rule        character varying(12),                 -- REF | AUTH | AMOUNT_TIME | MANUAL
    asl_td_id             uuid,                                  -- acc_tender_detail (no FK: partitioned, other years)
    asl_td_acc_year       character(9),
    asl_amount_diff       numeric(15,2) NOT NULL DEFAULT 0,      -- gross − the tender row's amount (signed; 0 = exact)
    asl_matched_by        uuid,
    asl_matched_on        timestamptz,
    -- a line nothing of ours explains
    asl_resolution        character varying(12),                 -- LINKED | REFUNDED | INCOME | SUSPENSE
    asl_reason_id         uuid,
    asl_approval_id       uuid,                                  -- SETTLEMENT_RESOLVE
    asl_resolution_voucher_id uuid,
    asl_resolution_acc_year   character(9),
    asl_tvr_id            uuid,                                  -- LINKED to a CLOSED session: the close variance this money explains
    asl_tvr_acc_year      character(9),
    asl_raw               jsonb,                                 -- the provider's row as read, for audit
    asl_notes             character varying(500),
    asl_sync_date         timestamptz,
    asl_created_on        timestamptz   NOT NULL DEFAULT now(),
    asl_modified_on       timestamptz,
    CONSTRAINT pk_acc_settlement_line PRIMARY KEY (asl_id, asl_acc_year),
    CONSTRAINT fk_asl_import FOREIGN KEY (asl_import_id, asl_acc_year)
        REFERENCES accounts.acc_settlement_import (asi_id, asi_acc_year) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_asl_reason FOREIGN KEY (asl_reason_id)
        REFERENCES accounts.till_reason (trs_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_asl_kind CHECK (asl_kind::text = ANY (ARRAY['SALE','REFUND','CHARGEBACK','FEE','ADJUSTMENT'])),
    CONSTRAINT ck_asl_status CHECK (asl_match_status::text = ANY (ARRAY['UNMATCHED','SUGGESTED','MATCHED','IGNORED','RESOLVED'])),
    CONSTRAINT ck_asl_rule CHECK (asl_match_rule IS NULL OR asl_match_rule::text = ANY (ARRAY['REF','AUTH','AMOUNT_TIME','MANUAL'])),
    CONSTRAINT ck_asl_resolution CHECK (asl_resolution IS NULL OR asl_resolution::text = ANY (ARRAY['LINKED','REFUNDED','INCOME','SUSPENSE'])),
    CONSTRAINT ck_asl_amounts CHECK (asl_gross_amount >= 0 AND asl_fee_amount >= 0 AND asl_tax_amount >= 0),
    -- one line's own arithmetic: what reached the bank for it
    CONSTRAINT ck_asl_net CHECK (asl_net_amount = asl_gross_amount - asl_fee_amount - asl_tax_amount),
    CONSTRAINT ck_asl_td_pair CHECK ((asl_td_id IS NULL) = (asl_td_acc_year IS NULL)),
    -- SUGGESTED / MATCHED point at a tender row and say which rule found it;
    -- RESOLVED/LINKED names the bill it turned out to be; the others point nowhere
    CONSTRAINT ck_asl_linked CHECK (
        ((asl_match_status IN ('SUGGESTED','MATCHED'))
          OR (asl_match_status = 'RESOLVED' AND asl_resolution = 'LINKED')) = (asl_td_id IS NOT NULL)),
    CONSTRAINT ck_asl_rule_set CHECK ((asl_match_status IN ('SUGGESTED','MATCHED')) = (asl_match_rule IS NOT NULL)),
    CONSTRAINT ck_asl_tvr_pair CHECK ((asl_tvr_id IS NULL) = (asl_tvr_acc_year IS NULL)),
    -- only a LINKED resolution pairs with a session's variance
    CONSTRAINT ck_asl_tvr_linked CHECK (asl_tvr_id IS NULL OR (asl_match_status = 'RESOLVED' AND asl_resolution = 'LINKED')),
    CONSTRAINT ck_asl_matched CHECK (asl_match_status <> 'MATCHED' OR (asl_matched_by IS NOT NULL AND asl_matched_on IS NOT NULL)),
    CONSTRAINT ck_asl_resolved CHECK ((asl_match_status = 'RESOLVED') = (asl_resolution IS NOT NULL)),
    CONSTRAINT ck_asl_resolution_voucher CHECK ((asl_resolution_voucher_id IS NULL) = (asl_resolution_acc_year IS NULL))
) PARTITION BY LIST (asl_acc_year);
CREATE UNIQUE INDEX IF NOT EXISTS ux_asl_row
    ON accounts.acc_settlement_line (asl_import_id, asl_row_no, asl_acc_year);
-- a tender row is settled by ONE sale line (both written by the same store
-- server). A unique index on a partitioned table must carry the partition key,
-- so this holds within a statement year; a payout crossing 31 March is the
-- service's check (TenderSettlementService refuses a td already MATCHED).
CREATE UNIQUE INDEX IF NOT EXISTS ux_asl_td_matched
    ON accounts.acc_settlement_line (asl_td_id, asl_td_acc_year, asl_acc_year)
    WHERE asl_match_status = 'MATCHED' AND asl_kind = 'SALE';
CREATE INDEX IF NOT EXISTS ix_asl_import
    ON accounts.acc_settlement_line (asl_import_id, asl_acc_year, asl_match_status);
CREATE INDEX IF NOT EXISTS ix_asl_ref
    ON accounts.acc_settlement_line (asl_tender_id, upper(asl_ref_no))
    WHERE asl_ref_no IS NOT NULL;
-- the "money arrived, nothing billed" list
CREATE INDEX IF NOT EXISTS ix_asl_unexplained
    ON accounts.acc_settlement_line (asl_tender_id, asl_txn_on)
    WHERE asl_match_status = 'UNMATCHED' AND asl_kind = 'SALE';

-- ── 4 · acc_tender_detail: the indexes matching and the exception list need ─
--  Duplicate reference: the same UTR / approval code on two bills is the
--  screenshot fraud. A service refusal at save + this RECONCILIATION index —
--  not a unique index, because rows of two stores meet at the cloud.
CREATE INDEX IF NOT EXISTS ix_td_ref
    ON accounts.acc_tender_detail (td_tender_id, upper(td_ref_no))
    WHERE td_ref_no IS NOT NULL AND td_is_deleted = false AND td_is_voided = false;
-- "not received": PENDING past td_expected_settle_on + tender.settle_grace_days
CREATE INDEX IF NOT EXISTS ix_td_settle_pending
    ON accounts.acc_tender_detail (td_company_id, td_branch_id, td_expected_settle_on)
    WHERE td_settle_status IN ('PENDING','PARTIAL') AND td_is_deleted = false AND td_is_voided = false;

-- ── 5 · reasons: NONCASH (restates 48's list + NONCASH) ───────────────────
ALTER TABLE accounts.till_reason DROP CONSTRAINT IF EXISTS ck_trs_category;
ALTER TABLE accounts.till_reason
    ADD CONSTRAINT ck_trs_category CHECK (trs_category::text = ANY (ARRAY[
        'VARIANCE','FLOAT_MISMATCH','EXPENSE','PAID_IN','PICKUP','NO_SALE','SUSPEND',
        'FORCE_CLOSE','REOPEN','SESSION_VOID','MOVEMENT_VOID','DAY_REOPEN','REPRINT',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','REFUND','NONCASH']));
INSERT INTO accounts.till_reason (trs_company_id, trs_category, trs_code, trs_name, trs_needs_note, trs_needs_ref, trs_sort_order, trs_created_by)
SELECT NULL, 'NONCASH', v.k, v.n, v.note, false, v.s, 'system' FROM (VALUES
 ('WRONG_TENDER',     'Wrong tender keyed (fix by re-tender)', false, 10),
 ('NOT_PAID',         'Payment not completed — customer left', true,  20),
 ('DECLINED',         'Card declined / UPI failed, billed anyway', true, 30),
 ('FAKE_PROOF',       'Fake / old payment screenshot',         true,  40),
 ('DUPLICATE_REF',    'Same reference used on two bills',     true,  50),
 ('AMOUNT_KEYED',     'Amount keyed differs from the machine', false, 60),
 ('CHARGEBACK',       'Charged back by the customer''s bank',  true,  70),
 ('PROVIDER_ERROR',   'Provider / bank error',                 true,  80),
 ('UNBILLED_PAYMENT', 'Paid by the customer, no bill raised',  true,  90),
 ('UNKNOWN',          'Unknown',                               true,  99)
) AS v(k, n, note, s)
WHERE NOT EXISTS (SELECT 1 FROM accounts.till_reason r
                  WHERE r.trs_company_id IS NULL AND r.trs_category = 'NONCASH' AND upper(r.trs_code) = v.k AND r.trs_is_deleted = false);

-- ── 6 · approval events (restates 48's list + 2) ──────────────────────────
ALTER TABLE accounts.till_approval_rule DROP CONSTRAINT IF EXISTS ck_tar_event;
ALTER TABLE accounts.till_approval_rule
    ADD CONSTRAINT ck_tar_event CHECK (tar_event_code::text = ANY (ARRAY[
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','EXPENSE','CASH_PAYMENT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK',
        'NONCASH_WRITE_OFF','SETTLEMENT_RESOLVE']));

INSERT INTO accounts.till_approval_rule
    (tar_company_id, tar_branch_id, tar_event_code, tar_mode, tar_threshold_amount, tar_threshold_count,
     tar_channel, tar_min_role, tar_two_person, tar_allow_self, tar_blocks_till, tar_remarks, tar_created_by)
SELECT NULL, NULL, v.e, v.m, v.amt, 0, v.ch, v.r, false, false, false, v.rem, 'system' FROM (VALUES
 ('NONCASH_WRITE_OFF',  'ALWAYS',      0, 'EITHER', 'STORE_MANAGER',
  'a card / UPI amount the statement never paid: booked to suspense, recovery or loss'),
 ('SETTLEMENT_RESOLVE', 'OVER_AMOUNT', 0, 'EITHER', 'STORE_MANAGER',
  'a statement line no bill explains: income, refund or suspense')
) AS v(e, m, amt, ch, r, rem)
WHERE NOT EXISTS (SELECT 1 FROM accounts.till_approval_rule x
                  WHERE x.tar_company_id IS NULL AND x.tar_branch_id IS NULL AND x.tar_event_code = v.e AND x.tar_is_deleted = false);

ALTER TABLE accounts.till_approval DROP CONSTRAINT IF EXISTS ck_tap_event;
ALTER TABLE accounts.till_approval
    ADD CONSTRAINT ck_tap_event CHECK (tap_event_code::text = ANY (ARRAY[
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','EXPENSE','CASH_PAYMENT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK',
        'NONCASH_WRITE_OFF','SETTLEMENT_RESOLVE']));

-- the NONCASH_VARIANCE shipped row: point at the re-tender first (remark only)
UPDATE accounts.till_approval_rule
   SET tar_remarks = 'only what re-tender could not explain; default treatment till.noncash_variance_default (SUSPENSE)'
 WHERE tar_company_id IS NULL AND tar_branch_id IS NULL AND tar_event_code = 'NONCASH_VARIANCE'
   AND tar_remarks = 'non-cash gaps should be re-tendered first';

-- ── 7 · till events (restates 48's list + 5) ──────────────────────────────
ALTER TABLE accounts.till_event DROP CONSTRAINT IF EXISTS ck_tev_code;
ALTER TABLE accounts.till_event
    ADD CONSTRAINT ck_tev_code CHECK (tev_event_code::text = ANY (ARRAY[
        'DAY_OPEN','DAY_CLOSING','DAY_CLOSE','DAY_REOPEN',
        'SESSION_OPEN','SESSION_SUSPEND','SESSION_RESUME','SESSION_END_BILLING','SESSION_COUNT',
        'SESSION_RECOUNT','SESSION_CLOSE','SESSION_FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID','SESSION_IDLE_LOCK',
        'SESSION_DEVICE_MOVE','COUNTER_RELINK',   -- plan-till-counter-claim.md §3.3/§3.4
        'DRAWER_OPEN_SALE','NO_SALE','DRAWER_LEFT_OPEN','X_REPORT','Z_REPORT','REPRINT',
        'CASH_ALERT','CASH_BLOCK','CASH_UNBLOCK',
        'MOVEMENT_POSTED','MOVEMENT_VOIDED','VARIANCE_DECIDED',
        'RECEIPT_POSTED','PAYMENT_POSTED','EXPENSE_POSTED','MONEY_DOC_CANCELLED',
        'APPROVAL_REQUESTED','APPROVAL_DECIDED','APPROVAL_EXPIRED',
        'PRICE_OVERRIDE','LINE_VOID','BILL_VOID','RETENDER','REFUND_CASH',
        'OFFLINE_START','OFFLINE_END','LOGIN','LOGOUT','PIN_FAIL',
        'SYNC_PENDING_AT_CLOSE','LATE_ARRIVAL','SESSION_DAY_ENDED',
        'DUPLICATE_REF_BLOCKED','SLIP_CHECK','SETTLEMENT_IMPORTED','SETTLEMENT_POSTED','NONCASH_WRITTEN_OFF']));

-- ── 8 · TSet — Tender Settlement voucher ──────────────────────────────────
--  Dr Bank (net) · Dr Bank charges (fee) · Dr GST on charges — invoice pending (tax on the fee)
--  Dr Tender suspense (chargebacks + unmatched refunds)
--  Cr the tender's clearing ledger (matched sales − matched refunds), EXCEPT rows a
--     close variance already parked in suspense (tvr_rows) → Cr Tender suspense
--  Cr Tender suspense (unmatched SALE lines: money with no bill, until resolved)
--  JOURNAL: several Dr legs, a bank on one of them. A negative net (rental only)
--  flips the bank leg to Cr.
--  The GST on the fee is NOT input credit yet: ITC is claimed on the acquirer's
--  monthly tax invoice (entered as ExpV / PurA), which moves it to INPUT_*.
INSERT INTO accounts.acc_ledger_role (alr_role, alr_label, alr_group, alr_want_nature, alr_want_type, alr_sort_order)
VALUES ('GST_ON_CHARGES_PENDING', 'GST on payment charges — invoice pending', 'SHARED', 'Assets', NULL, 650)
ON CONFLICT (alr_role) DO NOTHING;

--  The catalogue, restated — character for character as 20261008100000 left
--  it (the live definition agrees), with the GST_ON_CHARGES_PENDING row
--  appended. See difference 2 in the header for where its ledger sits.
CREATE OR REPLACE FUNCTION accounts.fn_ledger_map_catalogue()
 RETURNS TABLE(role_code text, ledger_name text, ledger_type text, duty_head text, group_name text)
 LANGUAGE sql
 IMMUTABLE
AS $$
    SELECT *
      FROM (VALUES
        -- role                 ledger name                       type        duty head         group
        -- ── REVENUE ────────────────────────────────────────────────────────
        ('SALES',              'Sales Account',                  'INCOME',   NULL,             'Sales Accounts'),
        ('SALES_RETURN',       'Sales Return',                   'INCOME',   NULL,             'Sales Accounts'),
        -- ── OUTPUT_TAX ─────────────────────────────────────────────────────
        ('OUTPUT_CGST',        'Output CGST',                    'TAX',      'Central Tax',    'Duties & Taxes'),
        ('OUTPUT_SGST',        'Output SGST',                    'TAX',      'State Tax',      'Duties & Taxes'),
        ('OUTPUT_IGST',        'Output IGST',                    'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('OUTPUT_CESS',        'Output Cess',                    'TAX',      'Cess',           'Duties & Taxes'),
        ('OUTPUT_ACESS',       'Output State Cess',              'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── PURCHASE ───────────────────────────────────────────────────────
        ('PURCHASE',           'Purchase Account',               'EXPENSE',  NULL,             'Purchase Accounts'),
        ('PURCHASE_RETURN',    'Purchase Return',                'EXPENSE',  NULL,             'Purchase Accounts'),
        -- ── INPUT_TAX ──────────────────────────────────────────────────────
        ('INPUT_CGST',         'Input CGST',                     'TAX',      'Central Tax',    'Duties & Taxes'),
        ('INPUT_SGST',         'Input SGST',                     'TAX',      'State Tax',      'Duties & Taxes'),
        ('INPUT_IGST',         'Input IGST',                     'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('INPUT_CESS',         'Input Cess',                     'TAX',      'Cess',           'Duties & Taxes'),
        ('INPUT_ACESS',        'Input State Cess',               'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── SHARED ─────────────────────────────────────────────────────────
        ('ROUND_OFF',          'Round Off',                      'ROUNDOFF', NULL,             'Indirect Expenses'),
        ('DISCOUNT_ALLOWED',   'Discount Allowed',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('WRITE_OFF',          'Bad Debts Written Off',          'EXPENSE',  NULL,             'Indirect Expenses'),
        ('ADVANCE_RECEIVED',   'Customer Advances Received',     'GENERAL',  NULL,             'Current Liabilities'),
        ('OPENING_DIFFERENCE', 'Difference in Opening Balances', 'GENERAL',  NULL,             'Suspense A/c'),
        ('RETAINED_EARNINGS',  'Retained Earnings',              'GENERAL',  NULL,             'Reserves & Surplus'),
        -- ── FUTURE — nothing posts to these yet ────────────────────────────
        ('TCS_PAYABLE',        'TCS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        ('TDS_PAYABLE',        'TDS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        -- ── RECEIPT — 20260915120000 ───────────────────────────────────────
        ('TDS_RECEIVABLE',      'TDS Receivable',              'GENERAL', NULL, 'Current Assets'),
        ('BANK_CHARGES',        'Bank Charges',                'EXPENSE', NULL, 'Indirect Expenses'),
        ('SURCHARGE_RECOVERED', 'Card Surcharge Recovered',    'INCOME',  NULL, 'Indirect Incomes'),
        ('CLAIMS_ALLOWED',      'Customer Claims Allowed',     'EXPENSE', NULL, 'Indirect Expenses'),
        ('INTEREST_INCOME',     'Interest on Overdue',         'INCOME',  NULL, 'Indirect Incomes'),
        -- ── RECEIVED CHEQUES — 20260916120000 ──────────────────────────────
        ('BOUNCE_CHARGES_RECOVERED', 'Cheque Bounce Charges Recovered', 'INCOME', NULL, 'Indirect Incomes'),
        -- ── SALES DOCUMENTS — 20260921220000 §8, catalogued here ───────────
        ('COGS',               'Cost of Goods Sold',            'EXPENSE', NULL, 'Direct Expenses'),
        ('INVENTORY',          'Stock in Hand',                  NULL,     NULL, 'Stock-in-Hand'),
        ('LOYALTY_REDEMPTION', 'Loyalty Points Redeemed',       'EXPENSE', NULL, 'Indirect Expenses'),
        ('SCHEME_DISCOUNT',    'Scheme Discount Allowed',       'EXPENSE', NULL, 'Indirect Expenses'),
        -- ── VOUCHER REGISTER — 20260925160000 §4, catalogued here ──────────
        ('INTEREST_PAID',      'Interest Paid',                 'EXPENSE',  NULL,             'Indirect Expenses'),
        ('RATE_DIFFERENCE',    'Rate Difference',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('RCM_CGST_PAYABLE',   'RCM CGST Payable',              'TAX',      'Central Tax',    'Duties & Taxes'),
        ('RCM_SGST_PAYABLE',   'RCM SGST Payable',              'TAX',      'State Tax',      'Duties & Taxes'),
        ('RCM_IGST_PAYABLE',   'RCM IGST Payable',              'TAX',      'Integrated Tax', 'Duties & Taxes'),
        -- ── STOCK → ACCOUNTS — 20260928100000 §1.9 ─────────────────────────
        ('STOCK_SHORTAGE',     'Stock Shortage',                'EXPENSE',  NULL,             'Indirect Expenses'),
        ('STOCK_EXCESS',       'Stock Excess',                  'INCOME',   NULL,             'Indirect Incomes'),
        -- ── PAYMENT — 20260929090000 ───────────────────────────────────────
        --  The payment's three, the mirrors of ADVANCE_RECEIVED, DISCOUNT_ALLOWED
        --  and WRITE_OFF. ADVANCE_PAID is GENERAL for the reason ADVANCE_RECEIVED
        --  is: it constrains the NATURE (Assets) and lets the chart choose.
        ('ADVANCE_PAID',          'Advances to Suppliers',        'GENERAL',  NULL,             'Loans & Advances (Asset)'),
        ('DISCOUNT_RECEIVED',     'Discount Received',            'INCOME',   NULL,             'Indirect Incomes'),
        ('BALANCES_WRITTEN_BACK', 'Balances Written Back',        'INCOME',   NULL,             'Indirect Incomes'),
        -- ── TILL — 20261008100000 (share file 47 §10.1) ────────────────────
        --  The safe and cash-in-transit are cash: both under Cash-in-Hand, so
        --  TFlt / TDrp / CRem stay valid Tally Contras. TENDER_SUSPENSE wants
        --  Assets, and 'Suspense A/c' is a Liabilities group here — so it
        --  sits under Current Assets.
        ('SAFE_CASH',          'Store Safe Cash',               'CASH',     NULL,             'Cash-in-Hand'),
        ('CASH_IN_TRANSIT',    'Cash in Transit',               'CASH',     NULL,             'Cash-in-Hand'),
        ('CASH_SHORT_EXCESS',  'Cash Short & Excess',           'EXPENSE',  NULL,             'Indirect Expenses'),
        ('TENDER_SUSPENSE',    'Till Variance Suspense',        'GENERAL',  NULL,             'Current Assets'),
        -- ── NON-CASH TENDER CONTROL — 20261008130000 (share file 49 §8) ────
        --  Tax on the acquirer's fee that is NOT input credit until its tax
        --  invoice is entered: an asset, and not a TAX ledger the returns read.
        --  'Duties & Taxes' is a Liabilities group here, so Current Assets.
        ('GST_ON_CHARGES_PENDING', 'GST on Payment Charges (Pending)', 'GENERAL', NULL,         'Current Assets')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

-- p_skip_if_no_chart = true: on a fresh database the chart is a seed that has
-- not run yet; Acc_Ledger_Map.sql maps it at first boot.
SELECT accounts.fn_seed_ledger_map(true, 'migration 20261008130000');

INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT 'TSet', 'Tender Settlement', 'TSet', 'ACCOUNTING'::accounts."VoucherCategory", 'JOURNAL'::accounts."VoucherNature",
       'AUTO'::accounts."VoucherNumberingMode", 'tst', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
       true, false, false, true, 'TENDER SETTLEMENT', 347, true, true, 'Journal', 'Journal', 'system'
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types WHERE vchr_type_code = 'TSet');

-- The serial stays ahead of any pinned id a seed may carry.
SELECT setval(pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
              (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types), true)
 WHERE pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id') IS NOT NULL;

INSERT INTO accounts.acc_voucher_seq
    (seq_vchr_type_id, seq_company_id, seq_branch_id, seq_acc_year, seq_device_id, seq_device_code, seq_period_key,
     seq_last_no, seq_voucher_prefix, seq_company_code, seq_branch_code, seq_voucher_suffix, seq_no_width)
SELECT t.vchr_type_id, s.seq_company_id, s.seq_branch_id, s.seq_acc_year, s.seq_device_id, s.seq_device_code, s.seq_period_key,
       0, t.vchr_no_prefix, s.seq_company_code, s.seq_branch_code, t.vchr_no_suffix, t.vchr_no_width
FROM accounts.acc_voucher_seq s
JOIN accounts.acc_voucher_types b ON b.vchr_type_id = s.seq_vchr_type_id AND b.vchr_type_code = 'Bil'
CROSS JOIN accounts.acc_voucher_types t
WHERE t.vchr_type_code = 'TSet' AND s.seq_is_deleted = false
  AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_seq x
                  WHERE x.seq_vchr_type_id = t.vchr_type_id AND x.seq_company_id = s.seq_company_id
                    AND x.seq_branch_id = s.seq_branch_id AND x.seq_acc_year = s.seq_acc_year
                    AND x.seq_device_code = s.seq_device_code AND x.seq_period_key = s.seq_period_key);

-- ── 9 · settings ──────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT v.asd_key, v.asd_module, v.asd_group, v.asd_data_type, v.asd_default_value, v.asd_allowed_values::jsonb,
       v.asd_max_scope, v.asd_label, v.asd_description, v.asd_sort_order, 'system' FROM (VALUES
 ('tender.duplicate_ref',        'TENDER', 'Billing', 'TEXT',    'BLOCK', '["BLOCK","WARN"]', 'COMPANY',
  'Same card / UPI reference on two bills', 'BLOCK = refused at save (DUPLICATE_REF_BLOCKED event); WARN = allowed, flagged.', 10),
 ('tender.close_by_terminal',    'TENDER', 'Close',   'BOOL',    'true',  NULL, 'BRANCH',
  'Card close: one batch total per terminal', 'The cashier enters each terminal''s settlement total, slip count and batch no. A mismatch opens the slip check.', 11),
 ('tender.match_window_minutes', 'TENDER', 'Matching','INT',     '30',    NULL, 'COMPANY',
  'Amount + time match window (minutes)', 'A line with no reference match is SUGGESTED when exactly one tender row of the same amount on the same terminal falls inside this window. A person confirms.', 12),
 ('tender.match_amount_tolerance','TENDER', 'Matching','DECIMAL', '0',     NULL, 'COMPANY',
  'Accept a reference match differing by up to', '0 = exact. Over it the row settles PARTIAL and the difference goes to the exception list.', 13),
 ('tender.settle_grace_days',    'TENDER', 'Matching','INT',     '2',     NULL, 'COMPANY',
  'Days past the expected settlement before "not received"', 'Expected = bill date + tnd_settlement_days. After expected + grace a PENDING row appears on the Not-received list.', 14),
 ('till.noncash_variance_default','TILL',  'Close',   'TEXT',    'SUSPENSE', '["SUSPENSE","RECOVER","EXPENSE"]', 'COMPANY',
  'Default treatment of an approved NON-cash variance', 'SUSPENSE until the statement proves it; never written off at the counter.', 27)
) AS v(asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order)
ON CONFLICT (asd_key) DO NOTHING;

-- ── 10 · partitions — the year roll, and the years that exist today ───────
--  public.ensure_acc_year_partitions restated from the live definition
--  (= 20261008100000) with the two settlement tables added, import before
--  line (fk_asl_import). See difference 3.
CREATE OR REPLACE FUNCTION public.ensure_acc_year_partitions(p_acc_year character)
 RETURNS void
 LANGUAGE plpgsql
AS $ensure$

DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
BEGIN
    IF v_year !~ '^[0-9]{4}-[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid accounting year %, expected YYYY-YYYY', p_acc_year;
    END IF;

    v_suffix := replace(v_year, '-', '_');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill FOR VALUES IN (%L)',
        'sale_bill_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill_item FOR VALUES IN (%L)',
        'sale_bill_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_tender_detail FOR VALUES IN (%L)',
        'acc_tender_detail_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_status_log FOR VALUES IN (%L)',
        'txn_status_log_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_charge_detail FOR VALUES IN (%L)',
        'txn_charge_detail_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_hold FOR VALUES IN (%L)',
        'txn_hold_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order FOR VALUES IN (%L)',
        'sale_order_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order_item FOR VALUES IN (%L)',
        'sale_order_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation FOR VALUES IN (%L)',
        'sale_quotation_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation_item FOR VALUES IN (%L)',
        'sale_quotation_item_' || v_suffix, v_year);

    -- The bill is partitioned again as of 20260811090000: on the FY it was
    -- RAISED in, which it keeps for life.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_balance FOR VALUES IN (%L)',
        'acc_bill_balance_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_adjustment FOR VALUES IN (%L)',
        'acc_bill_adjustment_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_opening_balance FOR VALUES IN (%L)',
        'acc_opening_balance_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_pdc_register FOR VALUES IN (%L)',
        'acc_pdc_register_' || v_suffix, v_year);

    -- ── Added by 20260915120000 ──────────────────────────────────────────
    --  Header BEFORE lines: acc_vouchers carries fk_av_header into it.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_header FOR VALUES IN (%L)',
        'acc_voucher_header_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_vouchers FOR VALUES IN (%L)',
        'acc_vouchers_' || v_suffix, v_year);

    -- ── Added by 20260921120000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.gst_api_log FOR VALUES IN (%L)',
        'gst_api_log_' || v_suffix, v_year);

    -- ── Added by 20260921140000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_ledger FOR VALUES IN (%L)',
        'loyalty_ledger_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem FOR VALUES IN (%L)',
        'loyalty_gift_redeem_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem_item FOR VALUES IN (%L)',
        'loyalty_gift_redeem_item_' || v_suffix, v_year);

    -- ── Added by 20260921160000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_coupon_txn FOR VALUES IN (%L)',
        'loyalty_coupon_txn_' || v_suffix, v_year);

    -- ── Added by 20260921180000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.promotion_usage FOR VALUES IN (%L)',
        'promotion_usage_' || v_suffix, v_year);

    -- ── Added by 20260921200000 ──────────────────────────────────────────
    --  The six sales documents. Parent before child throughout.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_return FOR VALUES IN (%L)',
        'sale_return_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_return_item FOR VALUES IN (%L)',
        'sale_return_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc FOR VALUES IN (%L)',
        'sale_dc_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_item FOR VALUES IN (%L)',
        'sale_dc_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_return FOR VALUES IN (%L)',
        'sale_dc_return_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_return_item FOR VALUES IN (%L)',
        'sale_dc_return_item_' || v_suffix, v_year);

    -- ── Added by 20260922000000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_temp_credit FOR VALUES IN (%L)',
        'acc_temp_credit_' || v_suffix, v_year);

    -- ── Added by 20260922040000 ──────────────────────────────────────────
    --  The transport band. Written for every goods-moving document that has a
    --  consignment, so a missing partition stops a dispatch.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_transport_detail FOR VALUES IN (%L)',
        'txn_transport_detail_' || v_suffix, v_year);

    -- ── Added by 20260922100000 ──────────────────────────────────
    --  The GST document band. The register carries fk_*_gdr from the other
    --  three, so it is created first.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_register FOR VALUES IN (%L)',
        'acc_voucher_doc_register_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_detail FOR VALUES IN (%L)',
        'acc_voucher_doc_detail_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_einvoice FOR VALUES IN (%L)',
        'acc_voucher_doc_einvoice_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_ewaybill FOR VALUES IN (%L)',
        'acc_voucher_doc_ewaybill_' || v_suffix, v_year);

    -- ── Added by 20261008100000 — till management (share file 47) ────────
    --  Parent before child: day → session → variance, count → count line.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_business_day FOR VALUES IN (%L)',
        'till_business_day_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_session FOR VALUES IN (%L)',
        'till_session_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_count FOR VALUES IN (%L)',
        'till_count_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_count_line FOR VALUES IN (%L)',
        'till_count_line_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_cash_movement FOR VALUES IN (%L)',
        'till_cash_movement_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_variance FOR VALUES IN (%L)',
        'till_variance_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_approval FOR VALUES IN (%L)',
        'till_approval_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_event FOR VALUES IN (%L)',
        'till_event_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_session_review FOR VALUES IN (%L)',
        'till_session_review_' || v_suffix, v_year);

    -- ── Added by 20261008130000 — non-cash tender control (share file 49) ─
    --  Import before line: acc_settlement_line carries fk_asl_import.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_settlement_import FOR VALUES IN (%L)',
        'acc_settlement_import_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_settlement_line FOR VALUES IN (%L)',
        'acc_settlement_line_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000. This is the part the
    -- catalogue-driven helper does not reach.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

DO $partitions$
DECLARE
    v_year text;
    t      text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT y FROM (
            SELECT '2026-2027'::text AS y
            UNION
            SELECT btrim(fy_year_name) FROM public.fiscal_years WHERE is_deleted = false
            UNION
            SELECT replace(substring(c.relname from '([0-9]{4}_[0-9]{4})$'), '_', '-')
              FROM pg_class c
              JOIN pg_inherits i ON i.inhrelid = c.oid
              JOIN pg_class    p ON p.oid      = i.inhparent
             WHERE p.relname = 'sale_bill'
               AND c.relname ~ '[0-9]{4}_[0-9]{4}$'
        ) s
        WHERE y ~ '^[0-9]{4}-[0-9]{4}$'
        ORDER BY 1
    LOOP
        FOREACH t IN ARRAY ARRAY['acc_settlement_import','acc_settlement_line'] LOOP
            EXECUTE format('CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.%I FOR VALUES IN (%L)',
                           t || '_' || replace(v_year, '-', '_'), t, v_year);
        END LOOP;
    END LOOP;
END $partitions$;
