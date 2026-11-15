-- ═══════════════════════════════════════════════════════════════════════════
--  Voucher Types master + Sales Bill series by child type, phase P1 (DB)
--                                                                 2026-11-14
--  Folder: prisma/migrations/20261116100000_voucher_types_master/ (share copy:
--  Shared/Prathap/accounts/sql/voucher-types-p1-migration.sql).
--
--  Plan: Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md §6, the
--  VT-ids tagged P1 (VT-01..03, 05, 11..14, 16, 17, 20, 21, 26, 27, 30, 35,
--  36); binding UI mockup v2 (approved 2026-11-14); the user's answers
--  "Q1-Q27 all recommended", then "go". Sorts after
--  20261115180000_app_theme_template_v65. Checked against the live dev DB
--  2026-11-14 (47 voucher types, 57 counters, 903 bills, menu max 302,
--  catalogue 2026-11-14.4 / 668 rows).
--
--  1 · accounts.acc_voucher_types, new columns (VT-01/02/05/13/14):
--        vchr_parent_id        integer NULL  FK fk_vchr_parent -> itself
--        vchr_company_id       uuid    NULL  FK fk_vchr_company -> companys
--        vchr_start_no         integer NOT NULL DEFAULT 1
--        vchr_print_purpose_id uuid    NULL  FK fk_vchr_print_purpose -> print_purpose
--        vchr_print_after_post boolean NOT NULL DEFAULT false
--      all ON UPDATE CASCADE ON DELETE RESTRICT; index ix_vchr_parent.
--      CHECKs ck_vchr_child_company (a child names its company, a base none),
--      ck_vchr_parent_not_self, ck_vchr_start_no (>= 1). One level only is a
--      service rule (no DB check).
--  2 · uniqueness (VT-03): the global UNIQUE constraint uq_acc_voucher_types_name
--      is dropped; in its place two partial unique indexes, the same rule as
--      the plan's single NULLS NOT DISTINCT index, split so Prisma does not
--      see them (it ignores partial indexes; they stay DB-only):
--        ux_vchr_base_name    (vchr_type_name)                  WHERE company IS NULL
--        ux_vchr_company_name (vchr_company_id, vchr_type_name)  WHERE company IS NOT NULL
--      plus ux_vchr_company_short (vchr_company_id, upper(vchr_type_short))
--      WHERE company IS NOT NULL. uq_acc_voucher_types_code stays global
--      (decision 32: the server makes a child's code, e.g. Bil-RT).
--  3 · VT-11: the always-true CHECK chk_acc_voucher_types_manual_mode_consistency
--      and the column vchr_allow_manual_no are dropped. Checked 2026-11-14: all
--      47 rows false; no view, grid, dropdown, function or print dataset reads
--      it; Method (vchr_numbering_mode) "Automatic, may be typed over"
--      (AUTO_MANUAL) replaces the tick. The migration stops if a row still
--      says true on an AUTO type (that answer would be lost).
--  4 · data on the base types:
--      VT-12  Opening Stock (id 1, code OPENING or Opn) and Physical Stock (Phy)
--             MANUAL -> AUTO. Both draw from the counter today (OPN0061,
--             PHY0036); the allocator does not read the Method yet.
--      VT-17  true accounting flags, party side KEPT 'ANY' (/vouchers/get marks
--             the party leg by it for any type, and Received Cheques opens
--             Sales Bill vouchers there):
--               Bil  ONE / RAISE / SALES    / GSTR1    / OUTPUT
--               SRt  ONE / RAISE / JOURNAL  / GSTR1_9B / OUTPUT
--               PUR  ONE / RAISE / PURCHASE / GSTR2    / INPUT
--             RULE for every later migration (plan §5.1): a change to a base's
--             accounting columns is made to its children in the same statement
--             (a child carries a server-written mirror, decision 31). The
--             update below is written that way although no child exists yet.
--      VT-20  12 Rct 'Receipt' -> 'Receipt (Bill-wise)';
--             33 Pmt 'Payment' -> 'Payment (Bill-wise)'.
--      VT-21  61-67 (PO, SV-ADJ, SV-ISS, SV-DMG, SV-EXP, SV-TRF, SV-TRI) made
--             inactive, only where no counter and no voucher uses them (none on
--             2026-11-14). THE BRANCH-SERIAL BUILD (BSN-01..03, BSN-10)
--             RE-ACTIVATES THEM in its own first migration step, before any code
--             looks them up by code. The allocator loads a type by id and does
--             not read vchr_is_active, so they still draw numbers meanwhile.
--  5 · sales.sale_bill (LIST-partitioned by sb_acc_year) (VT-30):
--      sb_vchr_type_id integer NOT NULL DEFAULT <id of code 'Bil'> (3 here; 3,
--      the id bill.service.ts pins, on a fresh database where the type is
--      seeded after the migrations). Constant default: existing rows take it
--      with no rewrite; added on the parent it reaches every partition. FK
--      fk_sb_vchr_type ON UPDATE CASCADE ON DELETE RESTRICT, index
--      ix_sb_vchr_type (not in the plan: it serves the type's bill count, the
--      "in use" check and the FK's RESTRICT check, which otherwise scan every
--      partition). No new partitioned table, so ensure_acc_year_partitions is
--      not touched. No unique index on the bill number (none today).
--  6 · menu 303 'Voucher Types' under 60 Configuration at 75.00 (between 62
--      Print Templates 70.00 and 248 Print Assignments 80.00), verbs = the
--      column default {VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT} (VT-26). Rights
--      (Q10): every live menu-248 row -> a 303 row with the same view / create /
--      edit / delete / print / export / visibility flags, posting rights false.
--      Dev 2026-11-14: VIJAY, VKPOS (all six), VKPOS1 (none).
--  7 · public.db_table_master 408 (accounts.acc_voucher_types): menu 303 (only
--      while NULL) and the description; the same in Db_Table_Master.sql.
--  8 · settings (VT-16 / VT-35), SALES / Entry:
--        sales.bill_voucher_type     INT  DEVICE  default empty  (sort 170)
--        sales.offer_base_bill_type  BOOL COMPANY default false  (sort 171)
--  9 · fixed.error_message (VT-27), catalogue 2026-11-14.5: the 27 VT_ refusal
--      codes of plan §6.6, the two VT_ warnings (VT_FORMAT_NEXT_COUNTER,
--      VT_NO_OVER_16), SEQUENCE_NUMBER_REQUIRED and SEQUENCE_REFNO_TOO_LONG
--      variant rule=GST16 (ck_erm_variant needs key=value: the server puts
--      rule: 'GST16' on the error). The VT_NO_TOO_LONG and VT_BR_REQUIRED
--      to-do lines name the codes without braces: the wording filler drops
--      every {NAME} it cannot fill, so "{YY}" would print as nothing.
--      prisma/seed/Error_Messages.json carries the same rows.
-- 10 · grid 86 "TXN MAIN LIST - BILLS" (VT-36): two new fields,
--        sb_vchr_type        vt.vchr_type_short, shown, after Bill No
--                            (heading "Vch Type": the grid already has a
--                            "Type" column, sb_bill_type CASH / CREDIT)
--        print_purpose_code  child's design, else the base's, else
--                            SALE_INVOICE (hidden; the list prints with it)
--      The SQL moves only while it is still the shipped text (white space
--      folded). The columns after Bill No move one place right only while the
--      layout is as shipped; otherwise the two new columns go to the end. The
--      grid SQL holds no comment marker. Grid_Details.sql / Grid_Columns.sql
--      carry the same.
--
--  Not here: no grid, ui_table or dropdown is added (plan §6.7); no function
--  or trigger; no print purpose (decision 36). Pinned ids and names are checked
--  free (or already ours) first. Re-runnable: every statement is guarded. On a
--  fresh database menus, grids and types 1-5 are seeded after migrations, so
--  those parts no-op here and the seed files carry the same rows.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids / names free, and nothing to lose ──────────────────────
DO $$
DECLARE
    v_clash text;
    v_lost  integer := 0;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s under %s)', m.menu_id, m.menu_name, m.menu_parent) AS x
          FROM fixed.menu_master m
         WHERE (m.menu_id = 303 AND m.menu_name IS DISTINCT FROM 'Voucher Types')
            OR (m.menu_id <> 303 AND m.menu_parent = 60 AND lower(m.menu_name) = 'voucher types')
        UNION ALL
        SELECT format('db_table_master 408 is %s.%s', d.dtm_schema, d.dtm_table)
          FROM public.db_table_master d
         WHERE d.dtm_id = 408
           AND (d.dtm_schema, d.dtm_table) IS DISTINCT FROM ('accounts', 'acc_voucher_types')
        UNION ALL
        SELECT format('setting %s (%s, %s)', s.asd_key, s.asd_data_type, s.asd_max_scope)
          FROM public.app_setting_def s
         WHERE (s.asd_key = 'sales.bill_voucher_type' AND (s.asd_data_type, s.asd_max_scope) IS DISTINCT FROM ('INT', 'DEVICE'))
            OR (s.asd_key = 'sales.offer_base_bill_type' AND (s.asd_data_type, s.asd_max_scope) IS DISTINCT FROM ('BOOL', 'COMPANY'))
        UNION ALL
        SELECT format('grid column %s (grid %s, %s)', c.grid_column_id, c.grid_id, c.grid_column_sql_field_name)
          FROM fixed.grid_columns c
         WHERE c.grid_column_id IN ('01a1da95-cae5-75b1-a435-e6d36b8d40b6', '01a1da95-cae5-75d1-bcec-9e7b89a4c22c')
           AND (c.grid_id, c.grid_column_sql_field_name) NOT IN ((86, 'sb_vchr_type'), (86, 'print_purpose_code'))
        UNION ALL
        SELECT format('voucher type name %s already on type %s', v.new_name, t.vchr_type_id)
          FROM (VALUES ('Rct', 'Receipt (Bill-wise)'), ('Pmt', 'Payment (Bill-wise)')) AS v(code, new_name)
          JOIN accounts.acc_voucher_types t ON t.vchr_type_name = v.new_name AND t.vchr_type_code <> v.code
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Voucher Types P1: ids or names already taken: %. Pick free ones here, in the seed files and in the server / Qt code.', v_clash;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'accounts' AND table_name = 'acc_voucher_types'
                  AND column_name = 'vchr_allow_manual_no') THEN
        EXECUTE $q$SELECT count(*) FROM accounts.acc_voucher_types
                    WHERE vchr_allow_manual_no AND vchr_numbering_mode = 'AUTO'$q$ INTO v_lost;
        IF v_lost > 0 THEN
            RAISE EXCEPTION 'Voucher Types P1: % AUTO voucher type(s) still allow a typed number (vchr_allow_manual_no = true). Set their Method to AUTO_MANUAL first, or the answer is lost with the column.', v_lost;
        END IF;
    END IF;
END $$;


-- ── 1 · acc_voucher_types: parent, company, starting no, print ────────────
ALTER TABLE accounts.acc_voucher_types
    ADD COLUMN IF NOT EXISTS vchr_parent_id        integer,
    ADD COLUMN IF NOT EXISTS vchr_company_id       uuid,
    ADD COLUMN IF NOT EXISTS vchr_start_no         integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS vchr_print_purpose_id uuid,
    ADD COLUMN IF NOT EXISTS vchr_print_after_post boolean NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_voucher_types'::regclass AND conname = 'fk_vchr_parent') THEN
        ALTER TABLE accounts.acc_voucher_types
            ADD CONSTRAINT fk_vchr_parent FOREIGN KEY (vchr_parent_id)
                REFERENCES accounts.acc_voucher_types (vchr_type_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_voucher_types'::regclass AND conname = 'fk_vchr_company') THEN
        ALTER TABLE accounts.acc_voucher_types
            ADD CONSTRAINT fk_vchr_company FOREIGN KEY (vchr_company_id)
                REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_voucher_types'::regclass AND conname = 'fk_vchr_print_purpose') THEN
        ALTER TABLE accounts.acc_voucher_types
            ADD CONSTRAINT fk_vchr_print_purpose FOREIGN KEY (vchr_print_purpose_id)
                REFERENCES public.print_purpose (ppo_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_voucher_types'::regclass AND conname = 'ck_vchr_child_company') THEN
        ALTER TABLE accounts.acc_voucher_types
            ADD CONSTRAINT ck_vchr_child_company CHECK (
                (vchr_parent_id IS NULL AND vchr_company_id IS NULL)
             OR (vchr_parent_id IS NOT NULL AND vchr_company_id IS NOT NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_voucher_types'::regclass AND conname = 'ck_vchr_parent_not_self') THEN
        ALTER TABLE accounts.acc_voucher_types
            ADD CONSTRAINT ck_vchr_parent_not_self CHECK (vchr_parent_id IS NULL OR vchr_parent_id <> vchr_type_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_voucher_types'::regclass AND conname = 'ck_vchr_start_no') THEN
        ALTER TABLE accounts.acc_voucher_types
            ADD CONSTRAINT ck_vchr_start_no CHECK (vchr_start_no >= 1);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_vchr_parent ON accounts.acc_voucher_types (vchr_parent_id);


-- ── 2 · names unique per company (children) / among bases ────────────────
ALTER TABLE accounts.acc_voucher_types DROP CONSTRAINT IF EXISTS uq_acc_voucher_types_name;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vchr_base_name
    ON accounts.acc_voucher_types (vchr_type_name)
    WHERE vchr_company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vchr_company_name
    ON accounts.acc_voucher_types (vchr_company_id, vchr_type_name)
    WHERE vchr_company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vchr_company_short
    ON accounts.acc_voucher_types (vchr_company_id, upper(vchr_type_short))
    WHERE vchr_company_id IS NOT NULL;


-- ── 3 · VT-11: the manual-number tick and its always-true CHECK ──────────
ALTER TABLE accounts.acc_voucher_types DROP CONSTRAINT IF EXISTS chk_acc_voucher_types_manual_mode_consistency;
ALTER TABLE accounts.acc_voucher_types DROP COLUMN IF EXISTS vchr_allow_manual_no;


-- ── 4 · data on the base types ────────────────────────────────────────────
-- VT-12: Opening (id 1; its code is OPENING here, Opn from the seed) and Phy.
UPDATE accounts.acc_voucher_types
   SET vchr_numbering_mode = 'AUTO',
       vchr_updated_on     = now(),
       vchr_updated_by     = '20261116100000_voucher_types_master'
 WHERE ((vchr_type_id = 1 AND vchr_type_code IN ('OPENING', 'Opn')) OR vchr_type_code = 'Phy')
   AND vchr_numbering_mode = 'MANUAL';

-- VT-17: the base and (rule §5.1) its children, party side untouched.
UPDATE accounts.acc_voucher_types t
   SET vchr_party_mode      = v.party_mode,
       vchr_billwise_mode   = v.billwise_mode,
       vchr_raise_bill_type = v.raise_type,
       vchr_gst_register    = v.gst_register,
       vchr_gst_side        = v.gst_side,
       vchr_updated_on      = now(),
       vchr_updated_by      = '20261116100000_voucher_types_master'
  FROM (VALUES ('Bil', 'ONE', 'RAISE', 'SALES',    'GSTR1',    'OUTPUT'),
               ('SRt', 'ONE', 'RAISE', 'JOURNAL',  'GSTR1_9B', 'OUTPUT'),
               ('PUR', 'ONE', 'RAISE', 'PURCHASE', 'GSTR2',    'INPUT')
       ) AS v(code, party_mode, billwise_mode, raise_type, gst_register, gst_side)
  JOIN accounts.acc_voucher_types b ON b.vchr_type_code = v.code AND b.vchr_parent_id IS NULL
 WHERE (t.vchr_type_id = b.vchr_type_id OR t.vchr_parent_id = b.vchr_type_id)
   AND (t.vchr_party_mode, t.vchr_billwise_mode, t.vchr_raise_bill_type, t.vchr_gst_register, t.vchr_gst_side)
       IS DISTINCT FROM (v.party_mode, v.billwise_mode, v.raise_type, v.gst_register, v.gst_side);

-- VT-20: the two bill-wise screens' types.
UPDATE accounts.acc_voucher_types t
   SET vchr_type_name  = v.new_name,
       vchr_updated_on = now(),
       vchr_updated_by = '20261116100000_voucher_types_master'
  FROM (VALUES ('Rct', 'Receipt', 'Receipt (Bill-wise)'),
               ('Pmt', 'Payment', 'Payment (Bill-wise)')
       ) AS v(code, old_name, new_name)
 WHERE t.vchr_type_code = v.code
   AND t.vchr_type_name = v.old_name
   AND t.vchr_parent_id IS NULL;

-- VT-21: inactive until the branch-serial build re-activates them.
UPDATE accounts.acc_voucher_types t
   SET vchr_is_active  = false,
       vchr_updated_on = now(),
       vchr_updated_by = '20261116100000_voucher_types_master'
 WHERE t.vchr_type_code IN ('PO', 'SV-ADJ', 'SV-ISS', 'SV-DMG', 'SV-EXP', 'SV-TRF', 'SV-TRI')
   AND t.vchr_is_active
   AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_seq s WHERE s.seq_vchr_type_id = t.vchr_type_id)
   AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_header h WHERE h.avh_voucher_type_id = t.vchr_type_id);


-- ── 5 · sales.sale_bill.sb_vchr_type_id ────────────────────────────────────
DO $$
DECLARE
    v_bil integer;
BEGIN
    SELECT vchr_type_id INTO v_bil
      FROM accounts.acc_voucher_types
     WHERE vchr_type_code = 'Bil' AND vchr_parent_id IS NULL;
    IF v_bil IS NULL THEN
        v_bil := 3;
    ELSIF v_bil <> 3 THEN
        RAISE NOTICE 'Voucher Types P1: Sales Bill (Bil) is type % here, not 3; sb_vchr_type_id defaults to %, but bill.service.ts pins 3.', v_bil, v_bil;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'sales' AND table_name = 'sale_bill'
                      AND column_name = 'sb_vchr_type_id') THEN
        EXECUTE format('ALTER TABLE sales.sale_bill ADD COLUMN sb_vchr_type_id integer NOT NULL DEFAULT %s', v_bil);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'sales.sale_bill'::regclass AND conname = 'fk_sb_vchr_type') THEN
        ALTER TABLE sales.sale_bill
            ADD CONSTRAINT fk_sb_vchr_type FOREIGN KEY (sb_vchr_type_id)
                REFERENCES accounts.acc_voucher_types (vchr_type_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_sb_vchr_type ON sales.sale_bill (sb_vchr_type_id);


-- ── 6 · menu 303 "Voucher Types" and its rights ───────────────────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 303, 60, 'Voucher Types', NULL, true, 75.00, true, false,
       '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 60)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 303);

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 303 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 1) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- Q10: the holders of 248 Print Assignments, same six flags, no posting rights.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 303, u.um_can_view, u.um_can_create, u.um_can_edit, u.um_can_delete,
       u.um_can_print, u.um_can_export, u.um_visibility, false, false,
       0, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 248
   AND u.um_is_deleted = false
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 303 AND m.menu_name = 'Voucher Types')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 7 · table registry row 408 ─────────────────────────────────────────────
UPDATE public.db_table_master
   SET dtm_menu_id     = 303,
       dtm_description = 'Base types are seeded and shared by every company; a child type (vchr_parent_id, one level, under Sales Bill only) belongs to one company and is kept on Voucher Types (menu 303). vchr_menu_id names the menu whose rights judge the type.',
       dtm_modified_on = now()
 WHERE dtm_id = 408
   AND dtm_schema = 'accounts' AND dtm_table = 'acc_voucher_types'
   AND dtm_menu_id IS NULL
   AND EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 303);


-- ── 8 · settings ───────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values,
     asd_min_value, asd_max_value, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES
    ('sales.bill_voucher_type', 'SALES', 'Entry', 'INT', NULL, NULL,
     1, NULL, 'DEVICE', 'Default voucher type on new bills',
     'The voucher type (vchr_type_id) a new Sales Bill starts on at this counter: Sales Bill itself or one of the company''s child types (Retail, Wholesale ...). Empty = the user''s last pick on this PC, else the first type offered. A type that is not offered (inactive, another company''s, or Sales Bill while child types exist and "Offer Sales Bill itself" is off) is passed over.',
     170, 'system'),
    ('sales.offer_base_bill_type', 'SALES', 'Entry', 'BOOL', 'false', NULL,
     NULL, NULL, 'COMPANY', 'Offer Sales Bill itself when child types exist',
     'Once the company has active child types of Sales Bill, new bills are offered only those children. On, Sales Bill itself is offered as well. A company with no child type bills as Sales Bill. Bills already made keep their type.',
     171, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 9 · plain wording rows (notes 120), catalogue 2026-11-14.5 ──────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('VT_NAME_REQUIRED', '', 'en', 'Name needed', 'A voucher type needs a name.', 'Type a name.')
    ,('VT_NAME_TAKEN', '', 'en', 'Name already used', 'Another voucher type of this company (or a base type) has this name.', 'Use another name.')
    ,('VT_ABBR_REQUIRED', '', 'en', 'Abbreviation needed', 'A child type needs an abbreviation.', 'Type 1 to 6 letters.')
    ,('VT_ABBR_INVALID', '', 'en', 'Abbreviation not right', 'An abbreviation has 1 to 6 letters or digits.', 'Shorten it.')
    ,('VT_ABBR_TAKEN', '', 'en', 'Abbreviation already used', 'Another type of this company uses this abbreviation.', 'Use another.')
    ,('VT_NOT_FOUND', '', 'en', 'Not found', 'This voucher type is not there any more.', 'Refresh the list.')
    ,('VT_PARENT_NOT_ALLOWED', '', 'en', 'Cannot add a child here', 'Only Sales Bill can have child types now. A child cannot have children.', 'Pick Sales Bill.')
    ,('VT_PARENT_LOCKED', '', 'en', 'Parent fixed', 'This type has bills, so its parent cannot change.', 'Make a new type instead.')
    ,('VT_BASE_FIELD_LOCKED', '', 'en', 'Cannot change this', 'The name, code and accounting of a base type are set by the app.', 'Change only numbering and print.')
    ,('VT_COMPANY_MISMATCH', '', 'en', 'Other company', 'This voucher type belongs to another company.', 'Log in to that company.')
    ,('VT_METHOD_GST_AUTO_ONLY', '', 'en', 'Must be automatic', 'A GST invoice or note must be numbered automatically.', 'Set Method to Automatic.')
    ,('VT_NO_TOO_LONG', '', 'en', 'Number too long for a GST invoice', '{sample} has {len} characters; a GST invoice number may have 16 at most.', 'Use the YY code in place of FY, or a shorter prefix or width.')
    ,('VT_NO_BAD_CHAR', '', 'en', 'Character not allowed', 'A GST invoice number may have only letters, digits, / and -.', 'Remove the other characters.')
    ,('VT_BR_REQUIRED', '', 'en', 'Branch code needed', 'Branches of this company share one GSTIN, so each needs its own numbers.', 'Put the BR code in the prefix.')
    ,('VT_PREFIX_TAKEN', '', 'en', 'Prefix already used', '{other} already prints {prefix} in this company.', 'Pick another prefix.')
    ,('VT_WIDTH_INVALID', '', 'en', 'Width not right', 'The number has 1 to 9 digits.', 'Pick a width from 1 to 9.')
    ,('VT_START_NO_INVALID', '', 'en', 'Starting number not right', 'The starting number is 1 or more.', 'Type 1 or more.')
    ,('VT_PURPOSE_INVALID', '', 'en', 'Print design not right', 'This print design is not for bills of this company.', 'Pick one from the list.')
    ,('VT_IN_USE', '', 'en', 'Cannot delete', '{name} has bills or a counter.', 'Make it inactive instead.')
    ,('VT_OFFLINE', '', 'en', 'Only at the head office', 'Voucher types are made and changed only on the main server.', 'Do it when connected.')
    ,('VT_RIGHT_VIEW', '', 'en', 'Not allowed', 'You have no right to open voucher types.', 'Call manager.')
    ,('VT_RIGHT_CREATE', '', 'en', 'Not allowed', 'You have no right to make voucher types.', 'Call manager.')
    ,('VT_RIGHT_EDIT', '', 'en', 'Not allowed', 'You have no right to change voucher types.', 'Call manager.')
    ,('VT_RIGHT_DELETE', '', 'en', 'Not allowed', 'You have no right to delete voucher types.', 'Call manager.')
    ,('VT_BILL_TYPE_REQUIRED', '', 'en', 'Voucher type needed', 'Pick Retail, Wholesale or another type for this bill.', 'Pick one.')
    ,('VT_BILL_TYPE_INVALID', '', 'en', 'Voucher type not right', 'This type is not one of this company''s bill types, or it is inactive.', 'Pick one from the list.')
    ,('VT_BILL_TYPE_LOCKED', '', 'en', 'Type fixed', 'The bill already has its number, so its type cannot change.', 'Cancel it and bill again.')
    ,('VT_FORMAT_NEXT_COUNTER', '', 'en', 'New prefix from the next counter', 'The new prefix starts with the next counter: next year, or a branch that has not started yet.', 'Press OK to save.')
    ,('VT_NO_OVER_16', '', 'en', 'Over 16 characters', 'Over 16 characters. Fine for this type, but not for a GST invoice.', 'Save if this type is not a GST invoice.')
    ,('SEQUENCE_NUMBER_REQUIRED', '', 'en', 'Number needed', 'This document type is numbered by hand.', 'Type the number.')
    ,('SEQUENCE_REFNO_TOO_LONG', 'rule=GST16', 'en', 'Number too long for GST', 'The first number at this branch would have more than 16 characters.', 'Change the voucher type''s prefix.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-14.5',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-14.5';


-- ── 10 · grid 86 "TXN MAIN LIST - BILLS": type and print design ───────────
UPDATE fixed.grid_details g
   SET grid_sql = $new86$SELECT
       b.sb_id,
       b.sb_company_id,
       b.sb_branch_id,
       b.sb_acc_year,
       b.sb_bill_date,
       b.sb_bill_refno,
       vt.vchr_type_short AS sb_vchr_type,
       b.sb_bill_type,
       c.cus_name,
       b.sb_tot_items,
       b.sb_bill_amt,
       b.sb_status,
       b.sb_print_count,
       b.sb_created_by,
       COALESCE(cpp.ppo_code, bpp.ppo_code, 'SALE_INVOICE') AS print_purpose_code
  FROM
	sales.sale_bill b
	INNER JOIN sales.customers c on c.cus_id = b.sb_cust_id
	INNER JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = b.sb_vchr_type_id
	LEFT JOIN accounts.acc_voucher_types bt ON bt.vchr_type_id = vt.vchr_parent_id
	LEFT JOIN public.print_purpose cpp ON cpp.ppo_id = vt.vchr_print_purpose_id AND cpp.ppo_is_deleted = false
	LEFT JOIN public.print_purpose bpp ON bpp.ppo_id = bt.vchr_print_purpose_id AND bpp.ppo_is_deleted = false
 WHERE
 	b.sb_company_id = 'icompany_id'::uuid
  	AND b.sb_branch_id  = 'ibranch_id'::uuid
  	AND b.sb_acc_year   = 'iacc_year'
  	AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date >= 'ifrom_date'::date)
  	AND (NULLIF('ito_date',   '') IS NULL OR b.sb_bill_date <= 'ito_date'::date)
ORDER BY
	b.sb_bill_date DESC, b.sb_bill_slno DESC$new86$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE g.grid_id = 86
   AND g.grid_name = 'TXN MAIN LIST - BILLS'
   AND regexp_replace(g.grid_sql, '\s+', ' ', 'g') = regexp_replace($old86$SELECT
       b.sb_id,
       b.sb_company_id,
       b.sb_branch_id,
       b.sb_acc_year,
       b.sb_bill_date,
       b.sb_bill_refno,
       b.sb_bill_type,
       c.cus_name,
       b.sb_tot_items,
       b.sb_bill_amt,
       b.sb_status,
       b.sb_print_count,
       b.sb_created_by
  FROM
	sales.sale_bill b
	INNER JOIN sales.customers c on c.cus_id = b.sb_cust_id
 WHERE
 	b.sb_company_id = 'icompany_id'::uuid
  	AND b.sb_branch_id  = 'ibranch_id'::uuid
  	AND b.sb_acc_year   = 'iacc_year'
  	AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date >= 'ifrom_date'::date)
  	AND (NULLIF('ito_date',   '') IS NULL OR b.sb_bill_date <= 'ito_date'::date)
ORDER BY
	b.sb_bill_date DESC, b.sb_bill_slno DESC$old86$, '\s+', ' ', 'g');

-- The columns: only once the grid's SQL returns the new fields. As shipped
-- (Bill No at 6, Type at 7), the columns from 7 on move one place right and
-- "Vch Type" takes 7; otherwise both new columns go to the end.
DO $$
DECLARE
    v_shipped boolean;
    v_type_pos numeric(12,2);
    v_pp_pos   numeric(12,2);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM fixed.grid_details
                    WHERE grid_id = 86 AND grid_name = 'TXN MAIN LIST - BILLS'
                      AND position('AS sb_vchr_type' IN grid_sql) > 0
                      AND position('AS print_purpose_code' IN grid_sql) > 0)
       OR EXISTS (SELECT 1 FROM fixed.grid_columns
                   WHERE grid_column_id IN ('01a1da95-cae5-75b1-a435-e6d36b8d40b6', '01a1da95-cae5-75d1-bcec-9e7b89a4c22c')) THEN
        RETURN;
    END IF;

    v_shipped := EXISTS (SELECT 1 FROM fixed.grid_columns
                          WHERE grid_id = 86 AND grid_column_sql_field_name = 'sb_bill_refno'
                            AND grid_column_position = 6 AND grid_column_is_deleted = false)
             AND EXISTS (SELECT 1 FROM fixed.grid_columns
                          WHERE grid_id = 86 AND grid_column_sql_field_name = 'sb_bill_type'
                            AND grid_column_position = 7 AND grid_column_is_deleted = false);

    IF v_shipped THEN
        UPDATE fixed.grid_columns
           SET grid_column_position    = grid_column_position + 1,
               grid_column_modified_by = 'system',
               grid_column_modified_on = now()
         WHERE grid_id = 86
           AND grid_column_position >= 7;
        v_type_pos := 7;
    ELSE
        SELECT COALESCE(max(grid_column_position), 0) + 1 INTO v_type_pos
          FROM fixed.grid_columns WHERE grid_id = 86;
        RAISE NOTICE 'Voucher Types P1: grid 86 layout is not as shipped; Vch Type goes to position %.', v_type_pos;
    END IF;
    SELECT GREATEST(COALESCE(max(grid_column_position), 0), v_type_pos) + 1 INTO v_pp_pos
      FROM fixed.grid_columns WHERE grid_id = 86;

    INSERT INTO fixed.grid_columns
        (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
         grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
         grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
         grid_column_notes, grid_column_is_deleted, grid_column_created_by, grid_column_created_on)
    VALUES
        ('01a1da95-cae5-75b1-a435-e6d36b8d40b6', 86, 14, 'Vch Type', 'sb_vchr_type',
         'Text', 5.00, v_type_pos, 'left',
         true, false, false, false,
         'sb_vchr_type', false, 'system', now()),
        ('01a1da95-cae5-75d1-bcec-9e7b89a4c22c', 86, 15, 'Print design', 'print_purpose_code',
         'Text', 10.00, v_pp_pos, 'left',
         false, false, false, false,
         'print_purpose_code', false, 'system', now());
END $$;


-- Checks after deploy (read-only):
-- SELECT vchr_type_id, vchr_type_code, vchr_type_name, vchr_numbering_mode, vchr_is_active, vchr_party_mode,
--        vchr_party_side, vchr_billwise_mode, vchr_raise_bill_type, vchr_gst_register, vchr_gst_side
--   FROM accounts.acc_voucher_types WHERE vchr_type_id IN (1,3,6,12,18,33,53,61,62,63,64,65,66,67) ORDER BY 1;
-- SELECT sb_vchr_type_id, count(*) FROM sales.sale_bill GROUP BY 1;
-- SELECT menu_id, menu_parent, menu_position FROM fixed.menu_master WHERE menu_id = 303;
-- SELECT um_user_id, um_can_view, um_can_edit FROM public.user_menus WHERE um_menu_id = 303;
-- SELECT emc_version, emc_row_count FROM fixed.error_message_catalogue;
-- SELECT * FROM public.v_db_table_master_drift;
