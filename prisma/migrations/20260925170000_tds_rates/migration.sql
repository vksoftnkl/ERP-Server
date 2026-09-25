-- ════════════════════════════════════════════════════════════════════════════
-- 20260925170000_tds_rates — the TDS rate master, and the ledger fields that key into it
--
-- Spec:   share/payment/plan-backend-payment.md §2.9 (the table), notes.txt (37)
--         (a) the table, (c) the ledger constraints + widths.
--         Needed by BOTH Payment (menu 100) and the Voucher Register
--         (accounts/voucher_register.md §7.3 step 5: the TDS leg on PurA / PmtV).
-- Source: handed over as 40_tds_rates.sql, written 2026-09-25 against the live
--         schema on 192.168.0.106; dry-run on erp_dry before hand-over.
-- Runs:   once, in one transaction. Re-runnable.
--
-- Where this departs from the handed-over file, and why:
--   · the two sync triggers are created only when fn_sync_mark_dirty /
--     fn_sync_log_delete exist. They come from 20260923120000_offline_cloud_sync,
--     which is kept out of git (.gitignore) and so is absent on the VPS; an
--     unconditional CREATE TRIGGER would fail the deploy there (P3009).
--
-- ┌─ READ BEFORE LOADING THE SEED (§3) ──────────────────────────────────────┐
-- │ The rates below are the SHAPE, not the authority. Two reasons to have    │
-- │ the company's CA confirm them first:                                      │
-- │  · the Income-tax Act, 2025 replaces the 1961 Act from 1 April 2026 and   │
-- │    renumbers the TDS provisions — the section CODES the ledger screen     │
-- │    stores ('194C' …) may need to become the new Act's references;         │
-- │  · rates / thresholds moved in 2024-25 (194H 5 % → 2 %; higher 194J /     │
-- │    194H / 194I thresholds). The payment plan's seed predates that.        │
-- │ The table is effective-dated, so a correction is a new row, never an edit.│
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- NOT here (code, not SQL — notes (37) b): GET /tds-rates/sections
--   → [{ tdrSection, tdrSectionName }], DISTINCT live rows effective on a date,
--   company rows over the NULL-company defaults. The ledger screen swaps its
--   INTERIM static section list for it the day it answers.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── 1. accounts.tds_rates ────────────────────────────────────────────────────
-- Lookup at the document date: the party ledger's led_tds_nature_of_payment gives
-- the SECTION, led_tds_deductee_type the DEDUCTEE TYPE (falling back to the ANY
-- row), and the row whose period holds the date gives the rate. No PAN →
-- tdr_no_pan_rate (206AA). A company's own row wins over the NULL-company default.
-- Thresholds are CHECKED by the service, not stored per party: single = this
-- payment, annual = the party's total in the financial year.
CREATE TABLE IF NOT EXISTS accounts.tds_rates (
  tdr_id                uuid          PRIMARY KEY DEFAULT uuidv7(),
  tdr_company_id        uuid          NULL REFERENCES public.companys(comp_id)
                                        ON UPDATE CASCADE ON DELETE RESTRICT,  -- NULL = every company
  tdr_section           varchar(16)   NOT NULL,              -- '194C', '194J' … (the ledger's nature of payment)
  tdr_section_name      varchar(120)  NOT NULL,              -- 'Payment to contractors'
  tdr_deductee_type     varchar(16)   NOT NULL,              -- COMPANY | INDIVIDUAL | HUF | FIRM | AOP | ANY
  tdr_rate              numeric(6,3)  NOT NULL,              -- percent
  tdr_no_pan_rate       numeric(6,3)  NOT NULL DEFAULT 20,   -- 206AA
  tdr_threshold_single  numeric(14,2) NOT NULL DEFAULT 0,    -- per payment; 0 = none
  tdr_threshold_annual  numeric(14,2) NOT NULL DEFAULT 0,    -- per financial year; 0 = none
  tdr_effective_from    date          NOT NULL,
  tdr_effective_to      date          NULL,                  -- NULL = open ended
  tdr_is_active         boolean       NOT NULL DEFAULT true,
  tdr_remarks           varchar(250),
  tdr_is_deleted        boolean       NOT NULL DEFAULT false,
  tdr_sync_date         timestamptz,
  tdr_created_on        timestamptz   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tdr_created_by        varchar(50),
  tdr_modified_on       timestamptz,
  tdr_modified_by       varchar(50),
  CONSTRAINT ck_tdr_rate     CHECK (tdr_rate >= 0 AND tdr_rate <= 100
                                    AND tdr_no_pan_rate >= 0 AND tdr_no_pan_rate <= 100),
  CONSTRAINT ck_tdr_threshold CHECK (tdr_threshold_single >= 0 AND tdr_threshold_annual >= 0),
  CONSTRAINT ck_tdr_dates    CHECK (tdr_effective_to IS NULL OR tdr_effective_to >= tdr_effective_from),
  CONSTRAINT ck_tdr_deductee CHECK (tdr_deductee_type IN ('COMPANY','INDIVIDUAL','HUF','FIRM','AOP','ANY')),
  CONSTRAINT ck_tdr_section  CHECK (tdr_section = btrim(tdr_section) AND tdr_section <> '')
);

-- One rate for one section × deductee × company × day. Overlapping live periods
-- are refused (the promotion schemes' EXCLUDE discipline; btree_gist is installed).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_tdr_overlap') THEN
    ALTER TABLE accounts.tds_rates ADD CONSTRAINT ex_tdr_overlap
      EXCLUDE USING gist (
        (coalesce(tdr_company_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        tdr_section       WITH =,
        tdr_deductee_type WITH =,
        daterange(tdr_effective_from, coalesce(tdr_effective_to, 'infinity'::date), '[]') WITH &&
      ) WHERE (tdr_is_deleted = false AND tdr_is_active = true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_tdr_lookup
    ON accounts.tds_rates (tdr_section, tdr_deductee_type, tdr_effective_from)
 WHERE tdr_is_deleted = false AND tdr_is_active = true;

-- Offline sync — the same two triggers every synced accounts table carries
-- (acc_tds_register has exactly these). They use the existing sync functions;
-- nothing new is added to the database's logic. Skipped where those functions
-- are absent (see the header).
DO $$
BEGIN
  IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
     OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
    RAISE NOTICE 'tds_rates: sync functions absent, sync triggers skipped';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'zz_sync_mark_dirty'
                   AND tgrelid = 'accounts.tds_rates'::regclass) THEN
    CREATE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON accounts.tds_rates
      FOR EACH ROW EXECUTE FUNCTION fn_sync_mark_dirty('tdr_sync_date');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'zz_sync_log_delete'
                   AND tgrelid = 'accounts.tds_rates'::regclass) THEN
    CREATE TRIGGER zz_sync_log_delete AFTER DELETE ON accounts.tds_rates
      FOR EACH ROW EXECUTE FUNCTION fn_sync_log_delete('accounts', 'tds_rates', 'tdr_id');
  END IF;
END $$;


-- ── 2. The ledger fields that key into it (notes (37) c) ─────────────────────
-- Widths: ledger varchar(40)/(80) vs register (20) vs master (16) — a value that
-- fits the ledger could not be stamped into the register. Bring both to 16.
-- (No row on the box holds a non-NULL value today; the ALTER fails loudly if one
-- longer than 16 has appeared since — fix that row, do not widen back.)
ALTER TABLE accounts.acc_ledger_master
  ALTER COLUMN led_tds_deductee_type     TYPE varchar(16),
  ALTER COLUMN led_tds_nature_of_payment TYPE varchar(16);

DO $$
BEGIN
  -- the deductee list is CLOSED: the same six as ck_tdr_deductee, so the two cannot drift
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_led_tds_deductee') THEN
    ALTER TABLE accounts.acc_ledger_master ADD CONSTRAINT ck_led_tds_deductee
      CHECK (led_tds_deductee_type IS NULL
             OR led_tds_deductee_type IN ('COMPANY','INDIVIDUAL','HUF','FIRM','AOP','ANY'));
  END IF;
  -- TDS applicable ⇒ both keys present, else the lookup finds nothing and the
  -- payment silently deducts zero. NOT VALID: the box has one ledger flagged
  -- with both blank — fix it, then VALIDATE CONSTRAINT.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_led_tds_pair') THEN
    ALTER TABLE accounts.acc_ledger_master ADD CONSTRAINT ck_led_tds_pair
      CHECK (led_is_tds_applicable = false
             OR (led_tds_deductee_type IS NOT NULL AND led_tds_nature_of_payment IS NOT NULL))
      NOT VALID;
  END IF;
END $$;


-- ── 3. Seed — FY 2026-27, every company (tdr_company_id NULL) ────────────────
-- ⚠ CONFIRM WITH THE CA BEFORE LOADING (see the box at the top). The section
-- codes are the five the ledger screen offers today (ledger_entry.cpp
-- kTdsSections). Where a section has two rates by nature (194I land/building
-- 10 % vs plant/machinery 2 %; 194J professional 10 % vs technical 2 %) only
-- the first is seeded — the second needs its own code ('194I-PM', '194J-TS')
-- on the ledger list before it can be keyed.
INSERT INTO accounts.tds_rates
       (tdr_section, tdr_section_name, tdr_deductee_type, tdr_rate, tdr_no_pan_rate,
        tdr_threshold_single, tdr_threshold_annual, tdr_effective_from, tdr_remarks, tdr_created_by)
SELECT v.* FROM (VALUES
  ('194C', 'Payment to contractors',              'INDIVIDUAL', 1.000, 20.000,   30000.00,  100000.00, DATE '2026-04-01', 'individual / HUF 1 %',            '40_tds_rates'),
  ('194C', 'Payment to contractors',              'HUF',        1.000, 20.000,   30000.00,  100000.00, DATE '2026-04-01', 'individual / HUF 1 %',            '40_tds_rates'),
  ('194C', 'Payment to contractors',              'ANY',        2.000, 20.000,   30000.00,  100000.00, DATE '2026-04-01', 'others 2 %',                      '40_tds_rates'),
  ('194H', 'Commission or brokerage',             'ANY',        2.000, 20.000,       0.00,   20000.00, DATE '2026-04-01', '2 % from 1-Oct-2024; annual 20,000', '40_tds_rates'),
  ('194I', 'Rent — land, building, furniture',    'ANY',       10.000, 20.000,   50000.00,       0.00, DATE '2026-04-01', 'threshold is per MONTH (50,000)', '40_tds_rates'),
  ('194J', 'Professional fees',                   'ANY',       10.000, 20.000,       0.00,   50000.00, DATE '2026-04-01', 'annual 50,000',                   '40_tds_rates'),
  ('194Q', 'Purchase of goods',                   'ANY',        0.100,  5.000,       0.00, 5000000.00, DATE '2026-04-01', 'above 50 lakh in the year; 206AA 5 %', '40_tds_rates')
) AS v(sec, nm, ded, rate, nopan, single, annual, efrom, rmk, cby)
WHERE NOT EXISTS (
  SELECT 1 FROM accounts.tds_rates t
   WHERE t.tdr_company_id IS NULL AND t.tdr_section = v.sec AND t.tdr_deductee_type = v.ded
     AND t.tdr_is_deleted = false);

COMMIT;

-- ── After running ────────────────────────────────────────────────────────────
-- SELECT tdr_section, tdr_deductee_type, tdr_rate, tdr_no_pan_rate, tdr_threshold_single,
--        tdr_threshold_annual, tdr_effective_from FROM accounts.tds_rates ORDER BY 1, 2;
-- The flagged-but-blank ledger, then validate:
-- SELECT led_id, led_name FROM accounts.acc_ledger_master
--  WHERE led_is_tds_applicable AND (led_tds_deductee_type IS NULL OR led_tds_nature_of_payment IS NULL);
-- ALTER TABLE accounts.acc_ledger_master VALIDATE CONSTRAINT ck_led_tds_pair;
