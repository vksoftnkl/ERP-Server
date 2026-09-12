-- ═══════════════════════════════════════════════════════════════════════════
--  22_retire_ledger_gst_columns.sql
--
--  The CONTRACT phase. Runs LAST, and only after the client and the API have
--  both shipped. Files 19-21 are additive and safe to run at any time; this
--  one drops columns, so it refuses to run until nothing needs them.
--
--  ── Where files 19-21 live in this repo ──────────────────────────────────
--    19/20  20260912050000_add_line_tax_id    sales lines + txn_charge_detail
--    21 §1.2a 20260912060000_add_led_tax_id   accounts.acc_ledger_master.led_tax_id
--    21 §1.2b 20260912070000_add_chg_tax_id   charge_master.chg_tax_id, ck_chg_tax_id
--           20260912090000_add_acc_ledger_map  role -> ledger map
--
--  Two deviations from the prose below, both because the repo shipped the
--  EXPAND migrations without the pieces §1 and §4 expect to find:
--    · 20260912060000 added led_tax_id but ran NO backfill. Section 0 does it
--      here, immediately before the guard that proves it worked.
--    · public.vw_charge_tax_setup was never created — it is a diagnostic view
--      from the external file set. Section 4 uses it when it exists and falls
--      back to the same test written out inline when it does not.
--  ck_chg_tax_id was added already VALID, so §4's VALIDATE is a no-op here.
--
--  ── The three phases ─────────────────────────────────────────────────────
--    1. EXPAND   — 21_accounts_posting_setup.sql §1.2b adds led_tax_id and
--                  chg_tax_id. Nothing is removed; every old column still
--                  works, so the API and client can ship whenever they like.
--
--    2. MIGRATE  — the client release that:
--                    · charge_grid_controller.cpp:343-344 stops reading
--                      ledHsnSac / ledGstRate onto the row and instead takes
--                      the rate resolved by public.fn_charge_tax_id()
--                    · applyTax() drops the hand-rolled "/2" and reads the
--                      GENERATED tax_cgst_perc / tax_sgst_perc, which also
--                      makes cess on a charge possible for the first time
--                    · ledger_entry.cpp replaces the "GST Rate %" number and
--                      the "Taxability" combo with ONE Tax Rate picker bound
--                      to led_tax_id, and removes "Percentage of Calculation"
--                      (led_tax_rate, unused). "Party Type" and "Registration
--                      Type" both stay — see below.
--                    · the NestJS ledger DTO stops writing the four columns
--
--                  Keep "HSN / SAC" and "Duty Head" on the form. Section 1
--                  below explains why they survive.
--
--    3. CONTRACT — this file.
--
--  ── What is NOT dropped, and why ─────────────────────────────────────────
--    led_gst_duty_head   ONE 18% rate row becomes Central Tax 9 + State Tax 9
--                        locally, or Integrated Tax 18 inter-state: one rate,
--                        five duty heads. The rate says HOW MUCH, the duty head
--                        says WHICH BUCKET a ledger is, and a tax_id can only
--                        answer the first. accounts.fn_check_role_ledger also
--                        compares acc_ledger_role.alr_want_duty against it —
--                        without it nothing stops the Output SGST ledger being
--                        mapped to the OUTPUT_CGST role.
--
--    led_hsn_sac         inventory.tax_rate_master deliberately has no HSN
--                        column: many services share 18% under different SACs,
--                        so the SAC belongs to the service a ledger represents.
--                        GSTR-1 reports by HSN/SAC.
--
--    led_gst_party_type  KEEP. Not a duplicate of led_gst_party_reg_type, which
--                        is what it looks like from the names and the row
--                        counts. They are Tally's two separate fields and only
--                        overlap on 'Regular' and 'SEZ':
--                          Registration Type  Regular, Composition, Consumer,
--                                             Unregistered, SEZ, Overseas
--                          Party Type         Regular, SEZ, Deemed Export,
--                                             Embassy/UN Body
--                        'Deemed Export' and 'Embassy/UN Body' exist only in
--                        Party Type — they are GST treatments, not registration
--                        statuses, and neither can be expressed by the other
--                        column. Dropping it would lose both.
--
--    led_gst_party_reg_type / led_gstin_no
--                        party identity, unrelated to any rate.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  0 · The backfill 21 §1.2b was supposed to have run
--
--  Percentage + taxability -> the one rate row that says the same thing. The
--  ledger spelled taxability 'Taxable', the rate master spells it 'TAXABLE',
--  and a ledger that left it NULL while carrying a rate meant 'Taxable' — so
--  the match folds case and defaults. Only live, undeleted rates are eligible,
--  and the pick is ordered so a tie resolves the same way on every database.
-- ═══════════════════════════════════════════════════════════════════════════
DO $do$
DECLARE
    v_done int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'accounts' AND table_name = 'acc_ledger_master'
                      AND column_name  = 'led_gst_rate') THEN
        RAISE NOTICE 'led_gst_rate is already gone — nothing to backfill.';
        RETURN;
    END IF;

    EXECUTE $q$
        UPDATE accounts.acc_ledger_master l
           SET led_tax_id = t.tax_id
          FROM (SELECT DISTINCT ON (tax_rate_perc, upper(tax_taxability))
                       tax_id, tax_rate_perc, upper(tax_taxability) AS taxability
                  FROM inventory.tax_rate_master
                 WHERE tax_is_deleted = false AND tax_is_active = true
                 ORDER BY tax_rate_perc, upper(tax_taxability), tax_sort_order, tax_name) t
         WHERE l.led_tax_id IS NULL
           AND l.led_gst_rate IS NOT NULL
           AND t.tax_rate_perc = l.led_gst_rate
           AND t.taxability    = upper(coalesce(nullif(btrim(l.led_taxability), ''), 'TAXABLE'))
    $q$;
    GET DIAGNOSTICS v_done = ROW_COUNT;

    RAISE NOTICE 'Backfilled led_tax_id on % ledger(s).', v_done;
END $do$;


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · Refuse if any percentage never became a tax_id
--
--  21 §1.2b already ran the backfill. This is the proof it worked — a row here
--  means a ledger carries a percentage with no matching row in the rate master,
--  and dropping led_gst_rate would lose it.
-- ═══════════════════════════════════════════════════════════════════════════
--  Dynamic SQL on purpose: on a second run led_gst_rate is already gone, and a
--  static reference to it would fail to parse even inside an IF that is never
--  taken. This way the whole file stays re-runnable.
DO $do$
DECLARE
    v_left text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'accounts' AND table_name = 'acc_ledger_master'
                      AND column_name  = 'led_gst_rate') THEN
        RAISE NOTICE 'led_gst_rate is already gone — nothing to check.';
        RETURN;
    END IF;

    EXECUTE $q$
        SELECT string_agg(format('%s (%s%%)', led_name, led_gst_rate), ', ' ORDER BY led_name)
          FROM accounts.acc_ledger_master
         WHERE led_gst_rate IS NOT NULL AND led_tax_id IS NULL
    $q$ INTO v_left;

    IF v_left IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot drop led_gst_rate: these ledgers have a rate with no matching row in inventory.tax_rate_master — %. Add the rate there (or set led_tax_id by hand), then re-run 21 to backfill.',
            v_left USING ERRCODE = '23514';
    END IF;
END $do$;


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · Refuse while anything still reads the columns
--
--  A view or generated column built on one of them would be dropped silently
--  by CASCADE, or block the ALTER. Neither should happen quietly.
-- ═══════════════════════════════════════════════════════════════════════════
DO $do$
DECLARE
    v_dep text;
BEGIN
    SELECT string_agg(DISTINCT dependent.relname, ', ')
      INTO v_dep
      FROM pg_depend d
      JOIN pg_rewrite r        ON r.oid = d.objid
      JOIN pg_class dependent  ON dependent.oid = r.ev_class
      JOIN pg_class src        ON src.oid = d.refobjid
      JOIN pg_namespace n      ON n.oid = src.relnamespace
      JOIN pg_attribute a      ON a.attrelid = src.oid AND a.attnum = d.refobjsubid
     WHERE n.nspname = 'accounts'
       AND src.relname = 'acc_ledger_master'
       AND a.attname IN ('led_gst_rate','led_tax_rate','led_taxability')
       AND dependent.relname <> 'acc_ledger_master';

    IF v_dep IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot drop the ledger GST columns: still referenced by %. Drop or redefine those first.',
            v_dep USING ERRCODE = '2BP01';
    END IF;
END $do$;


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · Drop
--
--  led_gst_rate        -> led_tax_id -> tax_rate_master.tax_rate_perc, which
--                         also carries cess and the GENERATED cgst/sgst split.
--  led_taxability      -> tax_rate_master.tax_taxability. (The ledger spelled
--                         it 'Taxable', the rate master spells it 'TAXABLE' —
--                         one fact, two spellings, which is the argument.)
--  led_tax_rate        -> Tally's "Percentage of Calculation". Never populated,
--                         and the new model computes tax from the rate row.
-- ═══════════════════════════════════════════════════════════════════════════
--  The bridge trigger goes first: it reads the columns being dropped, and it
--  existed only while two client builds were in the field.
DROP TRIGGER IF EXISTS tr_ledger_tax_bridge ON accounts.acc_ledger_master;
DROP FUNCTION IF EXISTS accounts.fn_ledger_tax_bridge();

ALTER TABLE accounts.acc_ledger_master
    DROP COLUMN IF EXISTS led_gst_rate,
    DROP COLUMN IF EXISTS led_tax_rate,
    DROP COLUMN IF EXISTS led_taxability;


-- ═══════════════════════════════════════════════════════════════════════════
--  4 · Validate the charge rule that was left NOT VALID in 21 §1.2b
--
--  'purchase' and 'FREIGHT QTY BASED' were live with chg_tax_apl = true and no
--  rate anywhere. By now they must have one, either their own chg_tax_id or
--  their ledger's led_tax_id. This is the point that proves it.
--
--  vw_charge_tax_setup is the diagnostic view from the external file set and
--  may not exist here; when it does not, the same test is written out inline.
--  A before-tax charge is excluded either way — it is taxed at the ITEM's rate
--  inside the item line, so no rate of its own is expected.
-- ═══════════════════════════════════════════════════════════════════════════
DO $do$
DECLARE
    v_bad text;
BEGIN
    IF to_regclass('public.vw_charge_tax_setup') IS NOT NULL THEN
        SELECT string_agg(chg_name, ', ' ORDER BY chg_name)
          INTO v_bad
          FROM public.vw_charge_tax_setup
         WHERE status LIKE '%NO RATE RESOLVES%';
    ELSE
        SELECT string_agg(c.chg_name, ', ' ORDER BY c.chg_name)
          INTO v_bad
          FROM public.charge_master c
          LEFT JOIN accounts.acc_ledger_master l ON l.led_id = c.chg_ledger_code
         WHERE c.chg_tax_apl
           AND NOT c.chg_before_tax
           AND c.chg_tax_id IS NULL
           AND l.led_tax_id IS NULL;
    END IF;

    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION
            'These charges carry their own GST but no rate resolves: %. Set chg_tax_id, or led_tax_id on their posting ledger.',
            v_bad USING ERRCODE = '23514';
    END IF;
END $do$;

ALTER TABLE public.charge_master VALIDATE CONSTRAINT ck_chg_tax_id;


-- ── Verify ────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='accounts' AND table_name='acc_ledger_master'
--    AND (column_name LIKE 'led_%tax%' OR column_name LIKE 'led_gst%'
--         OR column_name IN ('led_hsn_sac','led_ecommerce_gstin'))
--  ORDER BY 1;
--   -> led_gst_duty_head, led_gst_party_type, led_gst_party_reg_type,
--      led_gstin_no, led_ecommerce_gstin, led_hsn_sac, led_tax_id
--
-- SELECT * FROM public.vw_charge_tax_setup;
