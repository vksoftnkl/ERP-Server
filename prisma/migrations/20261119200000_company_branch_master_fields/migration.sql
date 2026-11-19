-- ═══════════════════════════════════════════════════════════════════════════
--  Company + Branch master rework (menus 56 / 191): new company fields and
--  the new refusal wording                                        2026-11-18
--  Folder: prisma/migrations/20261119200000_company_branch_master_fields/
--  (share copy: Shared/Prathap/admin/sql/company-branch-migration.sql).
--
--  Plan: Shared/Prathap/admin/plan-company-branch-master-2026-11-18.md §2,
--  user 18/11 "all recommended". Sorts after
--  20261119190000_whatsapp_on_post_company.
--
--   0 · guard: the three new column names are free on public.companys, or
--       already there with the type this file gives them.
--   1 · public.companys gets three NULL columns:
--         comp_udyam_no       varchar(19)  Udyam (MSME) No, UDYAM-XX-00-0000000
--         comp_logo           text         logo image, base64 (a data URL),
--                                          the same checks as the signature
--         comp_signatory_name varchar(100) Authorised Signatory, free text
--                                          ("R. Kumar, Proprietor")
--       No CHECK on any of them: the server validates (a CHECK that fires is a
--       raw 500). Existing rows stay NULL.
--   2 · comp_currency_symbol DEFAULT 'Rs.' (plan C5). New rows only: no
--       existing row is updated (on dev 14 are NULL, one is a rupee sign, one '1').
--   3 · fixed.error_message: the plain wording of the new refusal codes. Nine
--       new codes (17 rows: COMPANY_ADDRESS_REQUIRED and BRANCH_ADDRESS_REQUIRED
--       carry one field= row per missing box). BRANCH_BILL_PREFIX_INVALID is
--       already there (20261104100000, "up to 10" and "-" allowed, no code
--       raises it yet); plan B5 makes it 4 letters or digits, so its wording is
--       rewritten in place. The same rows go into prisma/seed/Error_Messages.json
--       (version 2026-11-18.2), which owns the catalogue.
--
--  companys keeps its db_table_master row (101, comp_sync_date): no table is
--  created or dropped. The audit screen labels of the new columns live in
--  src/modules/audit-log/audit-screen-sql.constants.ts; the audit service
--  rewrites audit.audit_screen.screen_audit_sql from that map on the next
--  write, so no audit row is needed here. No business-logic function or
--  trigger. Re-runnable: ADD COLUMN IF NOT EXISTS, SET DEFAULT is idempotent,
--  the wording is ON CONFLICT DO NOTHING (the rewritten row only changes while
--  its text differs), the catalogue bump only while its version is older.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · the new column names are free, or already ours ────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('%s is %s', a.attname,
                             format_type(a.atttypid, a.atttypmod)), '; ')
      INTO v_clash
      FROM pg_attribute a
      JOIN (VALUES ('comp_udyam_no',       'character varying(19)'),
                   ('comp_logo',           'text'),
                   ('comp_signatory_name', 'character varying(100)')) AS w(col, typ)
        ON w.col = a.attname
     WHERE a.attrelid = 'public.companys'::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND format_type(a.atttypid, a.atttypmod) <> w.typ;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Company master fields: % (expected varchar(19) / text / varchar(100)). Check the column first.', v_clash;
    END IF;
END $$;


-- ── 1 · the three new columns ─────────────────────────────────────────────
ALTER TABLE public.companys
    ADD COLUMN IF NOT EXISTS comp_udyam_no       varchar(19)  NULL,
    ADD COLUMN IF NOT EXISTS comp_logo           text         NULL,
    ADD COLUMN IF NOT EXISTS comp_signatory_name varchar(100) NULL;

COMMENT ON COLUMN public.companys.comp_udyam_no IS
    'Udyam (MSME) registration no, UDYAM-XX-00-0000000, upper case. Optional; the server checks the form (COMPANY_UDYAM_INVALID).';
COMMENT ON COLUMN public.companys.comp_logo IS
    'Company logo as a data URL (base64), at most 512 KB decoded, kind read from the bytes: the same checks as comp_authorize_signature (COMPANY_LOGO_*).';
COMMENT ON COLUMN public.companys.comp_signatory_name IS
    'Authorised signatory name and designation as printed, e.g. "R. Kumar, Proprietor". The signature image is comp_authorize_signature.';


-- ── 2 · currency symbol default for new companies ─────────────────────────
ALTER TABLE public.companys ALTER COLUMN comp_currency_symbol SET DEFAULT 'Rs.';


-- ── 3 · refusal wording ───────────────────────────────────────────────────
-- Screen words: Legal Name, Address Line 1, City, State, Pin Code, Bill Prefix,
-- Branch Code (company_entry.cpp / branch_entry.cpp). "GST-registered" = GST
-- Reg Type Regular, Composition or SEZ (plan C8 / I1).
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('COMPANY_LEGAL_NAME_REQUIRED', '', 'en', 'Legal name needed', 'A Regular, Composition or SEZ company must have a Legal Name.', 'Type the Legal Name as on the GST certificate.')
    ,('COMPANY_ADDRESS_REQUIRED', '', 'en', 'Address needed', 'A GST-registered company needs Address Line 1, City, State and Pin Code for e-invoices and e-way bills.', 'Fill in the empty address boxes.')
    ,('COMPANY_ADDRESS_REQUIRED', 'field=compAddr1', 'en', 'Address needed', 'Address Line 1 is empty. A GST-registered company needs it for e-invoices and e-way bills.', 'Type Address Line 1.')
    ,('COMPANY_ADDRESS_REQUIRED', 'field=compCity', 'en', 'City needed', 'City is empty. A GST-registered company needs it for e-invoices and e-way bills.', 'Type the city.')
    ,('COMPANY_ADDRESS_REQUIRED', 'field=compStateCode', 'en', 'State needed', 'State is empty. A GST-registered company needs it for e-invoices and e-way bills.', 'Pick the state.')
    ,('COMPANY_ADDRESS_REQUIRED', 'field=compPin', 'en', 'Pin Code needed', 'Pin Code is empty. A GST-registered company needs it for e-invoices and e-way bills.', 'Type the 6-digit Pin Code.')
    ,('COMPANY_PIN_INVALID', '', 'en', 'Wrong Pin Code', 'Pin Code must have 6 digits and must not start with 0.', 'Type the 6-digit Pin Code, like 641001.')
    ,('COMPANY_UDYAM_INVALID', '', 'en', 'Wrong Udyam No', 'The Udyam No is not in the right form.', 'Type it like UDYAM-TN-01-0012345, as on the Udyam certificate.')
    ,('COMPANY_LOGO_NOT_BASE64', '', 'en', 'Logo not read', 'The logo picture could not be read.', 'Pick the picture again. If it repeats, call support.')
    ,('COMPANY_LOGO_TOO_LARGE', '', 'en', 'Logo too big', 'The logo picture is bigger than 512 KB.', 'Make it smaller (512 KB at most), then pick it again.')
    ,('COMPANY_LOGO_NOT_IMAGE', '', 'en', 'Not a picture', 'The logo must be a PNG, JPEG, GIF or WebP picture.', 'Save it as PNG or JPEG, then pick it again.')
    ,('BRANCH_ADDRESS_REQUIRED', '', 'en', 'Address needed', 'A GST-registered branch needs Address Line 1, City, State and Pin Code for e-invoices and e-way bills.', 'Fill in the empty address boxes.')
    ,('BRANCH_ADDRESS_REQUIRED', 'field=brAddr1', 'en', 'Address needed', 'Address Line 1 is empty. A GST-registered branch needs it for e-invoices and e-way bills.', 'Type Address Line 1.')
    ,('BRANCH_ADDRESS_REQUIRED', 'field=brCity', 'en', 'City needed', 'City is empty. A GST-registered branch needs it for e-invoices and e-way bills.', 'Type the city.')
    ,('BRANCH_ADDRESS_REQUIRED', 'field=brStateCode', 'en', 'State needed', 'State is empty. A GST-registered branch needs it for e-invoices and e-way bills.', 'Pick the state.')
    ,('BRANCH_ADDRESS_REQUIRED', 'field=brPin', 'en', 'Pin Code needed', 'Pin Code is empty. A GST-registered branch needs it for e-invoices and e-way bills.', 'Type the 6-digit Pin Code.')
    ,('BRANCH_PIN_INVALID', '', 'en', 'Wrong Pin Code', 'Pin Code must have 6 digits and must not start with 0.', 'Type the 6-digit Pin Code, like 641001.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

-- Plan B5: Bill Prefix is 4 letters or digits at most (blank = the Branch Code).
INSERT INTO fixed.error_message AS e
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
    ('BRANCH_BILL_PREFIX_INVALID', '', 'en', 'Wrong bill prefix', 'Bill Prefix may have only letters and numbers, 4 at most.', 'Type a short prefix like CBE, or leave it blank to use the Branch Code.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO UPDATE
   SET erm_title       = EXCLUDED.erm_title,
       erm_line        = EXCLUDED.erm_line,
       erm_todo        = EXCLUDED.erm_todo,
       erm_is_active   = true,
       erm_modified_on = now()
 WHERE (e.erm_title, e.erm_line, e.erm_todo, e.erm_is_active)
       IS DISTINCT FROM (EXCLUDED.erm_title, EXCLUDED.erm_line, EXCLUDED.erm_todo, true);

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-18.2',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-18.2';


-- Checks after deploy (read-only):
-- SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companys' AND column_name IN ('comp_udyam_no', 'comp_logo', 'comp_signatory_name', 'comp_currency_symbol');
-- SELECT erm_code, erm_variant, erm_title FROM fixed.error_message WHERE erm_code IN ('COMPANY_LEGAL_NAME_REQUIRED', 'COMPANY_ADDRESS_REQUIRED', 'COMPANY_PIN_INVALID', 'COMPANY_UDYAM_INVALID', 'COMPANY_LOGO_NOT_BASE64', 'COMPANY_LOGO_TOO_LARGE', 'COMPANY_LOGO_NOT_IMAGE', 'BRANCH_ADDRESS_REQUIRED', 'BRANCH_PIN_INVALID', 'BRANCH_BILL_PREFIX_INVALID') ORDER BY 1, 2;
-- SELECT emc_version, emc_row_count FROM fixed.error_message_catalogue;
-- SELECT * FROM public.v_db_table_master_drift;
