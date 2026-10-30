-- ════════════════════════════════════════════════════════════════════════════
-- 20260926190000_payment_cheques — notes (55): the Payment Voucher issues cheques
--
-- The Payment Voucher (PmtV) takes instruments like the Receipt Voucher does
-- (notes 54), but on the PAYING side: a supplier line carries a cheque drawn
-- on one of our bank accounts, and the leaf comes from a cheque book the
-- server hands out in order — the client never sends a leaf number.
--
--   1. accounts.acc_cheque_book           our cheque books, leaf by leaf (P4)
--   2. acc_tender_detail.td_beneficiary_* who a payment is made out to (P9)
--      acc_pdc_register.apd_cheque_book_id / apd_favouring / apd_ac_payee /
--      apd_printed_on / apd_print_count                        (P9 + Q8)
--   3. ck_apd_cleared, loosened: an ISSUED cheque is posted when it is
--      written (CR bank), so its clearing moves no money and posts no
--      voucher (P11b)
--      ux_apd_instrument → received cheques only; an issued leaf is unique
--      per bank account instead (ux_apd_issued_leaf)
--      fn_cheques_in_hand_reconcile, fn_is_cheques_in_hand_ledger → received
--      cheques only
--   4. vchr_instruments = true on PmtV; menu 52 (Issued Cheques) made visible
--   5. grids 120 (cheque books) and 121 (issued cheques)
--
-- Re-runnable: every step is guarded.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the cheque book ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts.acc_cheque_book (
  acb_id             uuid          NOT NULL DEFAULT uuidv7(),
  acb_company_id     uuid          NOT NULL,
  -- NULL = usable from every branch
  acb_branch_id      uuid,
  -- the bank account the leaves are drawn on
  acb_bank_ledger_id uuid          NOT NULL,
  -- the book's own number, as printed on its cover
  acb_book_no        varchar(30)   NOT NULL,
  acb_leaf_from      bigint        NOT NULL,
  acb_leaf_to        bigint        NOT NULL,
  -- the next leaf the server will hand out; leaf_to + 1 = finished
  acb_next_leaf      bigint        NOT NULL,
  -- leaves are printed zero-padded to this many digits (000123)
  acb_leaf_width     smallint      NOT NULL DEFAULT 6,
  -- the print layout the leaves take (printing is a later phase)
  acb_format         varchar(30),
  -- ACTIVE → FINISHED (the last leaf went) | CLOSED (put away by hand)
  acb_status         varchar(10)   NOT NULL DEFAULT 'ACTIVE',
  acb_closed_on      timestamptz,
  acb_close_reason   varchar(250),
  acb_remarks        varchar(250),
  acb_is_active      boolean       NOT NULL DEFAULT true,
  acb_is_deleted     boolean       NOT NULL DEFAULT false,
  acb_created_on     timestamptz   NOT NULL DEFAULT now(),
  acb_created_by     varchar(50),
  acb_modified_on    timestamptz,
  acb_modified_by    varchar(50),
  CONSTRAINT pk_acc_cheque_book PRIMARY KEY (acb_id),
  CONSTRAINT fk_acb_bank_ledger FOREIGN KEY (acb_bank_ledger_id)
    REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_acb_range   CHECK (acb_leaf_from > 0 AND acb_leaf_to >= acb_leaf_from),
  CONSTRAINT ck_acb_next    CHECK (acb_next_leaf BETWEEN acb_leaf_from AND acb_leaf_to + 1),
  CONSTRAINT ck_acb_width   CHECK (acb_leaf_width BETWEEN 1 AND 12),
  CONSTRAINT ck_acb_status  CHECK (acb_status IN ('ACTIVE', 'FINISHED', 'CLOSED')),
  CONSTRAINT ck_acb_finished CHECK ((acb_status = 'FINISHED') = (acb_next_leaf > acb_leaf_to)
                                    OR acb_status = 'CLOSED'),
  CONSTRAINT ck_acb_closed  CHECK (acb_status <> 'CLOSED' OR acb_closed_on IS NOT NULL)
);
COMMENT ON TABLE accounts.acc_cheque_book IS
  'notes (55): our cheque books. The server hands out acb_next_leaf under FOR UPDATE when a Payment Voucher posts a cheque; a leaf once taken stays taken (a cancel or a void does not give it back).';

CREATE UNIQUE INDEX IF NOT EXISTS ux_acb_book_no
  ON accounts.acc_cheque_book (acb_company_id, acb_bank_ledger_id, acb_book_no)
  WHERE acb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_acb_open
  ON accounts.acc_cheque_book (acb_company_id, acb_bank_ledger_id, acb_leaf_from)
  WHERE acb_is_deleted = false AND acb_status = 'ACTIVE';

-- ── 2 · who the money goes to, and the cheque's print facts ─────────────────
ALTER TABLE accounts.acc_tender_detail
  ADD COLUMN IF NOT EXISTS td_beneficiary_name       varchar(150),
  ADD COLUMN IF NOT EXISTS td_beneficiary_account_no varchar(34),
  ADD COLUMN IF NOT EXISTS td_beneficiary_ifsc       varchar(11);
COMMENT ON COLUMN accounts.acc_tender_detail.td_beneficiary_name IS
  'notes (55): a PAID tender — the name the cheque / transfer is made out to (the favouring)';

ALTER TABLE accounts.acc_pdc_register
  ADD COLUMN IF NOT EXISTS apd_cheque_book_id uuid,
  ADD COLUMN IF NOT EXISTS apd_favouring      varchar(150),
  ADD COLUMN IF NOT EXISTS apd_ac_payee       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS apd_printed_on     timestamptz,
  ADD COLUMN IF NOT EXISTS apd_print_count    integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN accounts.acc_pdc_register.apd_cheque_book_id IS
  'notes (55): an ISSUED cheque — the book its leaf (apd_instrument_no) came from';
COMMENT ON COLUMN accounts.acc_pdc_register.apd_ac_payee IS
  'notes (55) Q8: an ISSUED cheque is crossed "A/c Payee" unless the operator says otherwise';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_apd_print_count') THEN
    ALTER TABLE accounts.acc_pdc_register
      ADD CONSTRAINT ck_apd_print_count CHECK (apd_print_count >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_apd_book_issued') THEN
    ALTER TABLE accounts.acc_pdc_register
      ADD CONSTRAINT ck_apd_book_issued CHECK (apd_cheque_book_id IS NULL OR apd_tra_type = 'P');
  END IF;
END $$;

-- ── 3 · P11b and the two received-only rules ────────────────────────────────
-- A RECEIVED cheque clears through a ChqClr / Rct voucher. An ISSUED one was
-- posted when it was written (DR supplier / CR bank), so the bank honouring
-- it moves nothing: CLEARED needs the date, and the voucher only on 'R'.
ALTER TABLE accounts.acc_pdc_register DROP CONSTRAINT IF EXISTS ck_apd_cleared;
ALTER TABLE accounts.acc_pdc_register ADD CONSTRAINT ck_apd_cleared CHECK (
  apd_status <> 'CLEARED'
  OR (apd_clear_date IS NOT NULL AND (apd_clear_voucher_id IS NOT NULL OR apd_tra_type = 'P'))
);

-- A customer's cheque number is unique per party; our leaf is unique per bank
-- account (two banks' books may share numbers, and one leaf may go to any
-- supplier). The partition key must be in a partitioned unique index.
DROP INDEX IF EXISTS accounts.ux_apd_instrument;
CREATE UNIQUE INDEX ux_apd_instrument
  ON accounts.acc_pdc_register (apd_company_id, apd_party_id, apd_instrument_type, apd_instrument_no, apd_acc_year)
  WHERE apd_is_deleted = false AND apd_status <> 'CANCELLED' AND apd_tra_type = 'R';
CREATE UNIQUE INDEX IF NOT EXISTS ux_apd_issued_leaf
  ON accounts.acc_pdc_register (apd_company_id, apd_bank_ledger_id, apd_instrument_type, apd_instrument_no, apd_acc_year)
  WHERE apd_is_deleted = false AND apd_tra_type = 'P';

-- Cheques In Hand holds the cheques we RECEIVED. An issued cheque never sits
-- on it (it posts straight to the bank), so it must not be counted there.
CREATE OR REPLACE FUNCTION accounts.fn_cheques_in_hand_reconcile(p_company_id uuid, p_ledger_id uuid, p_acc_year character)
 RETURNS TABLE(ledger_bal numeric, register_bal numeric, diff numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH l AS (SELECT accounts.fn_ledger_book_balance(p_company_id, p_ledger_id, p_acc_year) AS bal),
       r AS (SELECT COALESCE(SUM(p.apd_amount), 0) AS bal
               FROM accounts.acc_pdc_register p
               LEFT JOIN accounts.acc_tender_detail t ON t.td_id = p.apd_tender_id
              WHERE p.apd_company_id = p_company_id
                AND p.apd_is_deleted = false
                AND p.apd_tra_type = 'R'
                AND p.apd_status IN ('HELD', 'DEPOSITED')
                AND p.apd_posting_mode = 'ON_RECEIPT'
                AND (t.td_tender_ledger_id = p_ledger_id
                     OR (p.apd_tender_id IS NULL
                         AND EXISTS (SELECT 1 FROM accounts.acc_vouchers v
                                      WHERE v.av_voucher_id = p.apd_voucher_id
                                        AND v.av_acc_year   = p.apd_voucher_acc_year
                                        AND v.av_ledger_id  = p_ledger_id
                                        AND v.av_is_deleted = false))))
  SELECT l.bal, r.bal, l.bal - r.bal FROM l, r;
$function$;

-- An issued cheque's tender row names the BANK it is drawn on (the money left
-- there), with the cheque tender type. "Is this ledger Cheques In Hand?" must
-- look at cheques coming IN only (a received tender is DR), or every bank a
-- cheque was ever written on would be reconciled against the register.
CREATE OR REPLACE FUNCTION accounts.fn_is_cheques_in_hand_ledger(p_ledger_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT EXISTS (SELECT 1 FROM accounts.acc_tender_master m
                  WHERE m.tnd_type_id = 5 AND m.tnd_ledger_id = p_ledger_id
                    AND m.tnd_is_deleted = false)
      OR EXISTS (SELECT 1 FROM accounts.acc_tender_detail t
                  WHERE t.td_tender_type_id = 5 AND t.td_tender_ledger_id = p_ledger_id
                    AND t.td_dr_cr = 'DR');
$function$;

-- ── 4 · PmtV takes instruments; menu 52 is served now ───────────────────────
UPDATE accounts.acc_voucher_types
   SET vchr_instruments = true,
       vchr_updated_on  = now(),
       vchr_updated_by  = '20260926190000_payment_cheques'
 WHERE vchr_type_code = 'PmtV'
   AND vchr_instruments = false;

UPDATE fixed.menu_master
   SET menu_visiblity = true,
       menu_is_active = true
 WHERE menu_id = 52
   AND menu_name = 'Issued Cheques';

-- ── 5 · grids ───────────────────────────────────────────────────────────────
-- Tokens (bare, the grid-runner's convention): SEND EVERY TOKEN, '' = no bound.
--   120: icompany_id, ibank_ledger_id, istatus
--   121: icompany_id, ibranch_id, iacc_year, istatus (CSV), ifrom, ito,
--        ibank_ledger_id, iparty_id, isearch
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT 120,
       'MAIN LIST - CHEQUE BOOKS',
       'notes (55): our cheque books for a company. ibank_ledger_id narrows to one bank, istatus to ACTIVE / FINISHED / CLOSED; '''' = all.',
       'Desktop',
       'Bank', 'Ascending',
       'SELECT b.acb_id,' || E'\n' ||
       '       b.acb_company_id,' || E'\n' ||
       '       b.acb_bank_ledger_id,' || E'\n' ||
       '       l.led_name AS bank_name,' || E'\n' ||
       '       b.acb_book_no,' || E'\n' ||
       '       lpad(b.acb_leaf_from::text, b.acb_leaf_width, ''0'') AS leaf_from,' || E'\n' ||
       '       lpad(b.acb_leaf_to::text,   b.acb_leaf_width, ''0'') AS leaf_to,' || E'\n' ||
       '       CASE WHEN b.acb_next_leaf > b.acb_leaf_to THEN NULL' || E'\n' ||
       '            ELSE lpad(b.acb_next_leaf::text, b.acb_leaf_width, ''0'') END AS next_leaf,' || E'\n' ||
       '       (b.acb_leaf_to - b.acb_next_leaf + 1)::int AS leaves_left,' || E'\n' ||
       '       b.acb_format,' || E'\n' ||
       '       b.acb_status,' || E'\n' ||
       '       b.acb_remarks,' || E'\n' ||
       '       b.acb_created_on' || E'\n' ||
       '  FROM accounts.acc_cheque_book b' || E'\n' ||
       '  JOIN accounts.acc_ledger_master l ON l.led_id = b.acb_bank_ledger_id' || E'\n' ||
       ' WHERE b.acb_company_id = icompany_id::uuid' || E'\n' ||
       '   AND b.acb_is_deleted = false' || E'\n' ||
       '   AND (NULLIF(ibank_ledger_id, '''') IS NULL OR b.acb_bank_ledger_id = NULLIF(ibank_ledger_id, '''')::uuid)' || E'\n' ||
       '   AND (NULLIF(istatus, '''') IS NULL OR b.acb_status = istatus)' || E'\n' ||
       ' ORDER BY l.led_name, b.acb_leaf_from',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - CHEQUE BOOKS')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 120);

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       false, v.total, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        ( 1, '#',          8.00, 'Left',   false, false, false, 'Text',    'acb_id'),
        ( 2, 'Company',    8.00, 'Left',   false, false, false, 'Text',    'acb_company_id'),
        ( 3, 'Bank Id',    8.00, 'Left',   false, false, false, 'Text',    'acb_bank_ledger_id'),
        ( 4, 'Bank',      22.00, 'Left',   true,  true,  false, 'Text',    'bank_name'),
        ( 5, 'Book No',   10.00, 'Left',   true,  true,  false, 'Text',    'acb_book_no'),
        ( 6, 'From',      10.00, 'Center', true,  true,  false, 'Text',    'leaf_from'),
        ( 7, 'To',        10.00, 'Center', true,  true,  false, 'Text',    'leaf_to'),
        ( 8, 'Next Leaf', 10.00, 'Center', true,  false, false, 'Text',    'next_leaf'),
        ( 9, 'Left',       7.00, 'Right',  true,  false, true,  'Number',  'leaves_left'),
        (10, 'Format',    10.00, 'Left',   false, false, false, 'Text',    'acb_format'),
        (11, 'Status',     9.00, 'Center', true,  true,  false, 'Text',    'acb_status'),
        (12, 'Remarks',   15.00, 'Left',   true,  false, false, 'Text',    'acb_remarks'),
        (13, 'Created On',10.00, 'Center', false, false, false, 'Date',    'acb_created_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - CHEQUE BOOKS'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT 121,
       'MAIN LIST - ISSUED CHEQUES',
       'notes (55): our cheques handed to suppliers (apd_tra_type P) for a company / branch / year. istatus is a CSV of HELD, CLEARED, BOUNCED, CANCELLED, REPLACED; every other token '''' = no bound.',
       'Desktop',
       'Cheque Date', 'Descending',
       'SELECT p.apd_id,' || E'\n' ||
       '       p.apd_acc_year,' || E'\n' ||
       '       p.apd_company_id,' || E'\n' ||
       '       p.apd_branch_id,' || E'\n' ||
       '       p.apd_instrument_no,' || E'\n' ||
       '       p.apd_instrument_date,' || E'\n' ||
       '       p.apd_received_on AS issued_on,' || E'\n' ||
       '       p.apd_party_id,' || E'\n' ||
       '       s.led_name AS party_name,' || E'\n' ||
       '       p.apd_favouring,' || E'\n' ||
       '       p.apd_amount,' || E'\n' ||
       '       p.apd_bank_ledger_id,' || E'\n' ||
       '       bk.led_name AS bank_name,' || E'\n' ||
       '       b.acb_book_no,' || E'\n' ||
       '       p.apd_ac_payee,' || E'\n' ||
       '       p.apd_status,' || E'\n' ||
       '       p.apd_clear_date,' || E'\n' ||
       '       p.apd_bounce_date,' || E'\n' ||
       '       p.apd_cancel_reason,' || E'\n' ||
       '       h.avh_voucher_refno,' || E'\n' ||
       '       vt.vchr_type_code,' || E'\n' ||
       '       p.apd_print_count,' || E'\n' ||
       '       CASE WHEN p.apd_status = ''HELD'' AND p.apd_instrument_date > CURRENT_DATE THEN ''POST-DATED''' || E'\n' ||
       '            WHEN p.apd_status = ''HELD'' THEN ''OUTSTANDING''' || E'\n' ||
       '            ELSE p.apd_status END AS state' || E'\n' ||
       '  FROM accounts.acc_pdc_register p' || E'\n' ||
       '  JOIN accounts.acc_ledger_master s ON s.led_id = p.apd_party_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_ledger_master bk ON bk.led_id = p.apd_bank_ledger_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header h' || E'\n' ||
       '         ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id' || E'\n' ||
       ' WHERE p.apd_company_id = icompany_id::uuid' || E'\n' ||
       '   AND (NULLIF(ibranch_id, '''') IS NULL OR p.apd_branch_id = NULLIF(ibranch_id, '''')::uuid)' || E'\n' ||
       '   AND (NULLIF(iacc_year, '''') IS NULL OR p.apd_acc_year = NULLIF(iacc_year, '''')::bpchar)' || E'\n' ||
       '   AND p.apd_tra_type = ''P''' || E'\n' ||
       '   AND p.apd_is_deleted = false' || E'\n' ||
       '   AND (NULLIF(istatus, '''') IS NULL OR p.apd_status = ANY (string_to_array(istatus, '','')))' || E'\n' ||
       '   AND (NULLIF(ifrom, '''') IS NULL OR p.apd_instrument_date >= NULLIF(ifrom, '''')::date)' || E'\n' ||
       '   AND (NULLIF(ito,   '''') IS NULL OR p.apd_instrument_date <= NULLIF(ito,   '''')::date)' || E'\n' ||
       '   AND (NULLIF(ibank_ledger_id, '''') IS NULL OR p.apd_bank_ledger_id = NULLIF(ibank_ledger_id, '''')::uuid)' || E'\n' ||
       '   AND (NULLIF(iparty_id, '''') IS NULL OR p.apd_party_id = NULLIF(iparty_id, '''')::uuid)' || E'\n' ||
       '   AND (NULLIF(isearch, '''') IS NULL OR p.apd_instrument_no ILIKE ''%'' || isearch || ''%''' || E'\n' ||
       '        OR s.led_name ILIKE ''%'' || isearch || ''%'' OR p.apd_favouring ILIKE ''%'' || isearch || ''%'')' || E'\n' ||
       ' ORDER BY p.apd_instrument_date DESC, bk.led_name, p.apd_instrument_no DESC',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - ISSUED CHEQUES')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 121);

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       false, v.total, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        ( 1, '#',            8.00, 'Left',   false, false, false, 'Text',     'apd_id'),
        ( 2, 'Year',         5.00, 'Center', false, false, false, 'Text',     'apd_acc_year'),
        ( 3, 'Company',      8.00, 'Left',   false, false, false, 'Text',     'apd_company_id'),
        ( 4, 'Branch',       8.00, 'Left',   false, false, false, 'Text',     'apd_branch_id'),
        ( 5, 'Cheque No',    9.00, 'Center', true,  true,  false, 'Text',     'apd_instrument_no'),
        ( 6, 'Cheque Date',  9.00, 'Center', true,  true,  false, 'Date',     'apd_instrument_date'),
        ( 7, 'Issued On',    9.00, 'Center', true,  false, false, 'Date',     'issued_on'),
        ( 8, 'Party Id',     8.00, 'Left',   false, false, false, 'Text',     'apd_party_id'),
        ( 9, 'Supplier',    18.00, 'Left',   true,  true,  false, 'Text',     'party_name'),
        (10, 'Favouring',   16.00, 'Left',   true,  true,  false, 'Text',     'apd_favouring'),
        (11, 'Amount',      11.00, 'Right',  true,  false, true,  'Currency', 'apd_amount'),
        (12, 'Bank Id',      8.00, 'Left',   false, false, false, 'Text',     'apd_bank_ledger_id'),
        (13, 'Bank',        14.00, 'Left',   true,  true,  false, 'Text',     'bank_name'),
        (14, 'Book',         8.00, 'Left',   true,  false, false, 'Text',     'acb_book_no'),
        (15, 'A/c Payee',    6.00, 'Center', false, false, false, 'Boolean',  'apd_ac_payee'),
        (16, 'Status',       9.00, 'Center', true,  true,  false, 'Text',     'apd_status'),
        (17, 'Presented',    9.00, 'Center', true,  false, false, 'Date',     'apd_clear_date'),
        (18, 'Returned',     9.00, 'Center', false, false, false, 'Date',     'apd_bounce_date'),
        (19, 'Reason',      14.00, 'Left',   false, false, false, 'Text',     'apd_cancel_reason'),
        (20, 'Voucher',     10.00, 'Left',   true,  true,  false, 'Text',     'avh_voucher_refno'),
        (21, 'Type',         5.00, 'Left',   false, false, false, 'Text',     'vchr_type_code'),
        (22, 'Printed',      5.00, 'Right',  false, false, false, 'Number',   'apd_print_count'),
        (23, 'State',       10.00, 'Center', true,  true,  false, 'Text',     'state')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - ISSUED CHEQUES'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details), 121))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;

COMMIT;
