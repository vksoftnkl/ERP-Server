-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase fidelity: the DB needs of the mockup rebuild (2026-10-29)
--  (audits in share/purchase/audit/; listed by nestjs-backend)
--
--  1. Menu 297 "Supplier Dues" under Purchase (2): claims + shortages on one
--     page (user-approved). Verbs VIEW CREATE EDIT PRINT EXPORT POST CANCEL.
--     Position 4.50: after Return / Shortage Receipt / GRN (4.00), before
--     Procurement (4.90). Guarded on menu 2: on a fresh database the menu tree
--     is a seed that runs after migrations, so prisma/seed/Menu_Master.sql
--     carries 297 too. Nobody is granted it here; rights are given in User
--     Administration.
--  2. Seven shared purchase-return reasons (company NULL, direction OUT,
--     allowed {PURCHASE_RETURN}). PRET_ prefix: EXPIRY and DAMAGE already exist
--     as shared codes (ux_srm_code is per company scope). Same NOT EXISTS guard
--     as 20261026110000; prisma/seed/Stock_Reason_Master.sql carries them too.
--  3. pur_shortage_receipt.psr_supervisor_id -> employee_master, as
--     fk_grn_supervisor (ON UPDATE CASCADE ON DELETE RESTRICT), with a partial
--     index covering the FK (the column is mostly NULL).
--  4. pur_return.pr_memo_ref varchar(60): the free-text "Our ref" (pr_our_ref
--     already holds the source refno).
--  5. pur_invoice.pi_vehicle_no varchar(20), pi_driver_name varchar(100), as
--     grn_vehicle_no / grn_driver_name.
--  6. purchase.pur_terms (pte_): PO terms master. Company NULL = shared. Code
--     unique per company scope among live rows. Sync triggers + pending index
--     written out for this table (what sync_install_triggers() does per table).
--     pur_order.po_terms_id -> pur_terms, partial index covering the FK.
--     po_terms_text stays: the PO keeps its own copy of the text.
--     Dropdown 73 PO TERMS (shape of 70/71). Registry row 803 in
--     prisma/seed/Db_Table_Master.sql. No master screen / menu yet.
--  7. Menu 196 (GRN) gets OVERRIDE (the PUR_SHELF_LIFE override on post).
--     24 already has it.
--  8. Shortage claims get a real settlement row (user-approved 2026-10-29):
--     pur_claim_settlement (partitioned by pcs_acc_year) now settles EITHER a
--     return claim line OR a shortage close of kind CLAIM (transporter /
--     insurer). pcs_return_item_id / _acc_year become nullable; new
--     pcs_shortage_close_id / _acc_year -> pur_shortage_close (CASCADE /
--     RESTRICT) with a partial index covering the FK; ck_pcs_source: exactly
--     one source, both halves of its key set. Same actions, amounts, CN,
--     voucher and reversal columns, so one table answers "what was settled".
--     Replaces the txn_status_log stop-gap (CLAIM_SETTLEMENT step + voucher
--     SHORTAGE_CLAIM_SETTLEMENT); its 6 test settlements on this box are all
--     cancelled, so no data moves.
--
--  The four purchase document tables are partitioned by acc_year: ADD COLUMN,
--  the FKs and the indexes on the parent reach every partition.
--  Dropdown SQL holds no comment (the runner refuses -- and /*).
--  Re-runnable: every step is guarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, ', ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', menu_id, menu_name) AS x FROM fixed.menu_master
         WHERE menu_id = 297 AND menu_name <> 'Supplier Dues'
        UNION ALL
        SELECT format('dropdown %s (%s)', dropdown_id, dropdown_name) FROM fixed.dropdown_details
         WHERE dropdown_id = 73 AND dropdown_name <> 'PO TERMS') c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Purchase fidelity: ids already taken: %. Pick free ids here and in the seed files.', v_clash;
    END IF;
END $$;


-- ── 1 · menu 297 Supplier Dues ─────────────────────────────────────────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs)
SELECT 297, 2, 'Supplier Dues', true, 4.50, true, false,
       '{VIEW,CREATE,EDIT,PRINT,EXPORT,POST,CANCEL}'::text[]
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 2)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 297);

-- ── 7 · menu 196 GRN: OVERRIDE ─────────────────────────────────────────────
UPDATE fixed.menu_master
   SET menu_verbs = menu_verbs || ARRAY['OVERRIDE']::text[],
       menu_modified_on = now()
 WHERE menu_id = 196
   AND NOT ('OVERRIDE' = ANY (menu_verbs));

-- keep the serial ahead of the hand-picked id
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── 2 · purchase-return reasons ────────────────────────────────────────────
INSERT INTO stock.stock_reason_master
    (srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types,
     srm_require_remarks, srm_sort_order, srm_remarks)
SELECT v.company, v.code, v.name, 'OUT', ARRAY['PURCHASE_RETURN']::text[], false, v.sort_order, v.note
  FROM (VALUES
    (NULL::uuid, 'PRET_EXPIRY'::varchar,     'Expired'::varchar,         310,
     'Purchase return: past its expiry date, sent back to the supplier.'::varchar),
    (NULL, 'PRET_BREAKAGE',   'Breakage',         320, 'Purchase return: broken in transit or on receipt.'),
    (NULL, 'PRET_DAMAGE',     'Damaged',          330, 'Purchase return: damaged or unsaleable.'),
    (NULL, 'PRET_WRONG_ITEM', 'Wrong item',       340, 'Purchase return: not what was ordered.'),
    (NULL, 'PRET_EXCESS',     'Excess supply',    350, 'Purchase return: more than was ordered.'),
    (NULL, 'PRET_QUALITY',    'Quality',          360, 'Purchase return: below the agreed quality.'),
    (NULL, 'PRET_RATE',       'Rate difference',  370, 'Purchase return / claim: billed at a rate other than agreed.')
  ) AS v(company, code, name, sort_order, note)
 WHERE NOT EXISTS (
        SELECT 1 FROM stock.stock_reason_master e
         WHERE e.srm_company_id IS NULL AND e.srm_code = v.code AND e.srm_is_deleted = false);


-- ── 3 · shortage receipt supervisor ────────────────────────────────────────
ALTER TABLE purchase.pur_shortage_receipt ADD COLUMN IF NOT EXISTS psr_supervisor_id uuid;
COMMENT ON COLUMN purchase.pur_shortage_receipt.psr_supervisor_id IS
    'The supervisor who checked the late goods in (employee_master), as grn_supervisor_id.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'purchase.pur_shortage_receipt'::regclass
                      AND conname = 'fk_psr_supervisor') THEN
        ALTER TABLE purchase.pur_shortage_receipt
            ADD CONSTRAINT fk_psr_supervisor FOREIGN KEY (psr_supervisor_id)
            REFERENCES public.employee_master (emp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_psr_supervisor ON purchase.pur_shortage_receipt (psr_supervisor_id)
 WHERE psr_supervisor_id IS NOT NULL;


-- ── 4 · purchase return memo ref ───────────────────────────────────────────
ALTER TABLE purchase.pur_return ADD COLUMN IF NOT EXISTS pr_memo_ref character varying(60);
COMMENT ON COLUMN purchase.pur_return.pr_memo_ref IS
    'Our ref: free text typed on the return (a memo / debit-note number of our own). pr_our_ref holds the source document refno.';


-- ── 5 · purchase invoice vehicle / driver ──────────────────────────────────
ALTER TABLE purchase.pur_invoice ADD COLUMN IF NOT EXISTS pi_vehicle_no character varying(20);
ALTER TABLE purchase.pur_invoice ADD COLUMN IF NOT EXISTS pi_driver_name character varying(100);
COMMENT ON COLUMN purchase.pur_invoice.pi_vehicle_no IS 'Vehicle the goods came in, as grn_vehicle_no.';
COMMENT ON COLUMN purchase.pur_invoice.pi_driver_name IS 'Driver of that vehicle, as grn_driver_name.';


-- ── 6 · PO terms master ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase.pur_terms (
    pte_id          uuid DEFAULT uuidv7() NOT NULL,
    pte_company_id  uuid,
    pte_code        character varying(30) NOT NULL,
    pte_name        character varying(100) NOT NULL,
    pte_terms_text  text NOT NULL,
    pte_sort        integer DEFAULT 0 NOT NULL,
    pte_is_active   boolean DEFAULT true NOT NULL,
    pte_is_deleted  boolean DEFAULT false NOT NULL,
    pte_sync_date   timestamp(6) with time zone,
    pte_created_on  timestamp(6) with time zone DEFAULT now() NOT NULL,
    pte_created_by  character varying(50) NOT NULL,
    pte_modified_on timestamp(6) with time zone,
    pte_modified_by character varying(50),
    CONSTRAINT pk_pur_terms PRIMARY KEY (pte_id),
    CONSTRAINT ck_pte_code CHECK ((pte_code)::text ~ '^[A-Za-z0-9_-]+$'),
    CONSTRAINT ck_pte_name CHECK (length(btrim((pte_name)::text)) > 0),
    CONSTRAINT fk_pte_company FOREIGN KEY (pte_company_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT
);
COMMENT ON TABLE purchase.pur_terms IS
    'Purchase order terms (payment / delivery / other conditions) picked on a PO. Company NULL = shared with every company. The PO copies the text into po_terms_text, so editing a master row never rewrites an old PO.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_pte_code ON purchase.pur_terms
    (COALESCE(pte_company_id, '00000000-0000-0000-0000-000000000000'::uuid), upper((pte_code)::text))
 WHERE pte_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pte_list ON purchase.pur_terms (pte_company_id, pte_sort)
 WHERE pte_is_deleted = false;

ALTER TABLE purchase.pur_order ADD COLUMN IF NOT EXISTS po_terms_id uuid;
COMMENT ON COLUMN purchase.pur_order.po_terms_id IS
    'The pur_terms row the PO terms were taken from (NULL = typed). po_terms_text keeps the PO''s own copy of the text.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'purchase.pur_order'::regclass
                      AND conname = 'fk_po_terms') THEN
        ALTER TABLE purchase.pur_order
            ADD CONSTRAINT fk_po_terms FOREIGN KEY (po_terms_id)
            REFERENCES purchase.pur_terms (pte_id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_po_terms ON purchase.pur_order (po_terms_id)
 WHERE po_terms_id IS NOT NULL;

-- sync triggers + the pending index for the new table: the three statements
-- public.sync_install_triggers() runs per table, for this one table only.
-- (Calling the installer re-creates triggers on every synced table and took a
-- lock on each; the dry run deadlocked against the running API.)
CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON purchase.pur_terms
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty('pte_sync_date');
CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON purchase.pur_terms
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete('purchase', 'pur_terms', 'pte_id');
CREATE INDEX IF NOT EXISTS ix_sync_pending_pur_terms ON purchase.pur_terms (pte_id)
 WHERE pte_sync_date IS NULL;

-- dropdown 73 PO TERMS
INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT 73, 'PO TERMS',
       'Purchase order terms (purchase.pur_terms): live and active, this company''s and the shared ones, by sort then name. pte_terms_text (hidden) fills the PO terms box. Param icompany_id, always sent.',
$d$SELECT pte_id,
       pte_name,
       pte_code,
       pte_terms_text
  FROM purchase.pur_terms
 WHERE pte_is_deleted = false
   AND pte_is_active = true
   AND (pte_company_id IS NULL OR pte_company_id::text = 'icompany_id')
 ORDER BY pte_sort, pte_name$d$,
       'Ascending', NULL, 'pte_name', 12, true, 0, 'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = 73);

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT max(dropdown_id) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT v.dd, v.no, 'text', v.name, v.name, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM (VALUES
    (73, 0, '#',     10.00, false, false, 'pte_id'),
    (73, 1, 'Terms', 65.00, true,  true,  'pte_name'),
    (73, 2, 'Code',  25.00, true,  true,  'pte_code'),
    (73, 3, 'Text',  NULL,  false, false, 'pte_terms_text')
  ) AS v(dd, no, name, width, visible, filter, field)
 WHERE EXISTS (SELECT 1 FROM fixed.dropdown_details d WHERE d.dropdown_id = v.dd)
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = v.dd);


-- ── 8 · claim settlement: return line OR shortage close ────────────────────
ALTER TABLE purchase.pur_claim_settlement ALTER COLUMN pcs_return_item_id DROP NOT NULL;
ALTER TABLE purchase.pur_claim_settlement ALTER COLUMN pcs_return_item_acc_year DROP NOT NULL;
ALTER TABLE purchase.pur_claim_settlement ADD COLUMN IF NOT EXISTS pcs_shortage_close_id uuid;
ALTER TABLE purchase.pur_claim_settlement ADD COLUMN IF NOT EXISTS pcs_shortage_close_acc_year character(9);
COMMENT ON COLUMN purchase.pur_claim_settlement.pcs_return_item_id IS
    'The return claim line settled (with pcs_return_item_acc_year). NULL when the row settles a shortage claim.';
COMMENT ON COLUMN purchase.pur_claim_settlement.pcs_shortage_close_id IS
    'The pur_shortage_close row of kind CLAIM settled (with pcs_shortage_close_acc_year): a transporter / insurer claim. NULL when the row settles a return claim line. Exactly one source is set (ck_pcs_source).';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'purchase.pur_claim_settlement'::regclass
                      AND conname = 'ck_pcs_source') THEN
        ALTER TABLE purchase.pur_claim_settlement ADD CONSTRAINT ck_pcs_source CHECK (
            (pcs_return_item_id IS NOT NULL AND pcs_return_item_acc_year IS NOT NULL
             AND pcs_shortage_close_id IS NULL AND pcs_shortage_close_acc_year IS NULL)
         OR (pcs_return_item_id IS NULL AND pcs_return_item_acc_year IS NULL
             AND pcs_shortage_close_id IS NOT NULL AND pcs_shortage_close_acc_year IS NOT NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'purchase.pur_claim_settlement'::regclass
                      AND conname = 'fk_pcs_shortage_close') THEN
        ALTER TABLE purchase.pur_claim_settlement
            ADD CONSTRAINT fk_pcs_shortage_close FOREIGN KEY (pcs_shortage_close_id, pcs_shortage_close_acc_year)
            REFERENCES purchase.pur_shortage_close (psc_id, psc_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_pcs_shortage_close ON purchase.pur_claim_settlement
    (pcs_shortage_close_id, pcs_shortage_close_acc_year)
 WHERE pcs_shortage_close_id IS NOT NULL;
