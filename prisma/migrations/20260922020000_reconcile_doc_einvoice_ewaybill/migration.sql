-- ═══════════════════════════════════════════════════════════════════════════
--  accounts.acc_voucher_doc_einvoice / _ewaybill — bring the DEPLOYED tables
--  back to what the doc-register design declares, and drop the register's
--  ship / dispatch blocks.
--
--  Runs AFTER 20260921200000_add_sales_documents (it needs
--  public.vehicle_master for one foreign key).
--
--  ── Why this exists ─────────────────────────────────────────────────────
--  These two tables were deployed from an older revision and then diverged.
--  Because the source file creates them with CREATE TABLE IF NOT EXISTS,
--  re-running it does NOTHING — the drift is invisible and permanent until
--  something like this reconciles it.
--
--  Verified before writing: all three tables hold ZERO rows, so every
--  statement below is free of data loss, and nothing in src/ reads any column
--  this file renames or drops.
--
--  Three kinds of difference:
--
--   1. SPELLING.  The design says *_cancelled_on (two l's), which is what
--                 every other table in this schema uses — sale_dc, the
--                 loyalty tables, the vouchers. The deployed tables say
--                 *_canceled_on. Renamed to the house spelling, because two
--                 spellings of one word in one schema is a bug waiting for
--                 whoever types the wrong one.
--   2. NAMING.    The design says *_modified_on / *_modified_by, the house
--                 audit pair. The deployed tables say *_updated_on / _by.
--   3. MISSING.   Columns the design declares that were never deployed —
--                 including the two that started this: the e-way bill's
--                 Part-B TRANSPORT DOCUMENT number and date (the LR), sent to
--                 the portal on every vehicle update, with nowhere to record
--                 what was declared. And the pair that matters most in a
--                 dispute: *_request_payload / *_response_payload.
--
--  NOT touched: gde_gcc_id, gde_gpv_code, gde_irp_code, gde_next_attempt_on,
--  gdw_generated_via and the rest. Those came from
--  20260921120000_add_gst_provider_integration; they are correct, and it is
--  the older design file that is behind.
--
--  ── THE SPELLING RENAME HAS A CONSEQUENCE IN DATA, NOT JUST SCHEMA ──────
--  public.gst_provider_field_map.gfm_target_column stores a PHYSICAL COLUMN
--  NAME that the mapping engine reads straight into an UPDATE. The GSP seed
--  writes 'gde_canceled_on' there, because that is what the table spelled it
--  when that seed was written. Renaming the column without fixing that row
--  would leave a map entry pointing at a column that no longer exists — and
--  it would fail only on a cancellation, the one path nobody exercises until
--  a bill has to be pulled back. §4 below fixes it, and the seed file was
--  updated to match.
--
--  ── ONE THING TO KNOW ABOUT §3 ──────────────────────────────────────────
--  The 18 ship / dispatch columns are dropped on the grounds that those
--  addresses now live in public.txn_transport_detail. THAT TABLE DOES NOT
--  EXIST YET — it belongs to a later file that has not been run here. The
--  drop is still safe (the register holds zero rows, and nothing in src/
--  reads the columns), but until that file lands there is NO home for
--  e-invoice ShipDtls / DispDtls. Re-adding 18 empty columns is trivial if
--  that file never comes; this is flagged rather than assumed.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Renames, each guarded so the file is safe to run twice ────────────
--
-- A column RENAME carries its dependent CHECK constraints with it, so the
-- ck_* expressions that mention *_canceled_on follow automatically.
DO $renames$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('acc_voucher_doc_einvoice', 'gde_canceled_on', 'gde_cancelled_on'),
        ('acc_voucher_doc_einvoice', 'gde_updated_on',  'gde_modified_on'),
        ('acc_voucher_doc_einvoice', 'gde_updated_by',  'gde_modified_by'),
        ('acc_voucher_doc_ewaybill', 'gdw_canceled_on', 'gdw_cancelled_on'),
        ('acc_voucher_doc_ewaybill', 'gdw_updated_on',  'gdw_modified_on'),
        ('acc_voucher_doc_ewaybill', 'gdw_updated_by',  'gdw_modified_by')
    ) AS v(tbl, from_col, to_col)
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='accounts' AND table_name=r.tbl AND column_name=r.from_col)
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='accounts' AND table_name=r.tbl AND column_name=r.to_col)
        THEN
            EXECUTE format('ALTER TABLE accounts.%I RENAME COLUMN %I TO %I', r.tbl, r.from_col, r.to_col);
            RAISE NOTICE 'renamed %.% -> %', r.tbl, r.from_col, r.to_col;
        END IF;
    END LOOP;
END
$renames$;


-- ── 2. The columns the design declares and the deployed tables never had ──
ALTER TABLE accounts.acc_voucher_doc_einvoice
    ADD COLUMN IF NOT EXISTS gde_tenant_id        uuid,
    ADD COLUMN IF NOT EXISTS gde_attempt_count    integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gde_last_attempt_on  timestamp(6) with time zone,
    ADD COLUMN IF NOT EXISTS gde_request_payload  jsonb,
    ADD COLUMN IF NOT EXISTS gde_response_payload jsonb;

ALTER TABLE accounts.acc_voucher_doc_ewaybill
    ADD COLUMN IF NOT EXISTS gdw_tenant_id        uuid,
    ADD COLUMN IF NOT EXISTS gdw_attempt_count    integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gdw_last_attempt_on  timestamp(6) with time zone,
    ADD COLUMN IF NOT EXISTS gdw_request_payload  jsonb,
    ADD COLUMN IF NOT EXISTS gdw_response_payload jsonb,
    -- Part-B, the two that started this file.
    ADD COLUMN IF NOT EXISTS gdw_transport_doc_no   character varying(50),
    ADD COLUMN IF NOT EXISTS gdw_transport_doc_date date,
    -- The vehicle as OUR master knows it, beside the plate as the portal got it.
    ADD COLUMN IF NOT EXISTS gdw_vehicle_id       uuid,
    -- An e-way bill may be extended; the portal returns a new validity.
    ADD COLUMN IF NOT EXISTS gdw_extended_upto    timestamp(6) with time zone;

COMMENT ON COLUMN accounts.acc_voucher_doc_ewaybill.gdw_transport_doc_no IS
    'Part-B transDocNo — the LR / consignment note, from the document''s *_lr_no. What was DECLARED, so it is not re-derived from a document that may since have been amended.';
COMMENT ON COLUMN accounts.acc_voucher_doc_ewaybill.gdw_transport_doc_date IS
    'Part-B transDocDate, from the document''s *_lr_date.';
COMMENT ON COLUMN accounts.acc_voucher_doc_ewaybill.gdw_transporter_id IS
    'The portal''s transporterId, which IS a 15-character GSTIN — NOT our transporter_master uuid. The document''s *_transporter_id (uuid) maps to *_transporter_gstin, and THAT is what lands here.';
COMMENT ON COLUMN accounts.acc_voucher_doc_ewaybill.gdw_vehicle_id IS
    'Our public.vehicle_master row, beside gdw_vehicle_no which is the plate exactly as the portal received it. Two columns because the portal takes a string and we want the master.';
COMMENT ON COLUMN accounts.acc_voucher_doc_ewaybill.gdw_request_payload IS
    'Exactly what was sent to the portal. With gdw_response_payload this is the only answer to "what did we declare on that date" once the document has been amended.';
COMMENT ON COLUMN accounts.acc_voucher_doc_einvoice.gde_request_payload IS
    'Exactly what was sent to the IRP. With gde_response_payload this is the only answer to "what did we declare on that date" once the document has been amended.';

-- vehicle_master comes from 20260921200000, so this file must run after it.
DO $veh$
BEGIN
    IF to_regclass('public.vehicle_master') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_gdw_vehicle')
    THEN
        ALTER TABLE accounts.acc_voucher_doc_ewaybill
            ADD CONSTRAINT fk_gdw_vehicle FOREIGN KEY (gdw_vehicle_id)
            REFERENCES public.vehicle_master (veh_id) MATCH SIMPLE
            ON UPDATE CASCADE ON DELETE RESTRICT;
        RAISE NOTICE 'added fk_gdw_vehicle';
    END IF;
END
$veh$;

-- FK-covering, the house rule the preceding migrations follow.
CREATE INDEX IF NOT EXISTS ix_gdw_vehicle
    ON accounts.acc_voucher_doc_ewaybill USING btree (gdw_vehicle_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gdw_vehicle_id IS NOT NULL AND gdw_is_deleted = false;


-- ── 3. The register stops keeping ship / dispatch addresses ──────────────
--
-- acc_voucher_doc_register has THREE address blocks. Only one is its own work:
--
--   gdr_party_*      13 cols  the recipient — GSTR-1 B2B needs it. STAYS.
--   gdr_ship_*        9 cols  e-invoice ShipDtls only
--   gdr_dispatch_*    9 cols  e-invoice DispDtls only
--
-- Ship-to and dispatch-from appear in NEITHER GSTR-1 NOR GSTR-3B. They exist
-- only to build the e-invoice and e-way payloads, and those are moving to
-- public.txn_transport_detail — one row per goods-moving document, whichever
-- way the goods went.
--
-- What would make this safe in the long run is the LOCK RULE: that band
-- FREEZES the moment an IRN or an e-way bill is generated, so it is not a
-- working copy that may have moved on — it IS the declared copy, and a second
-- frozen copy on the register earns nothing.
--
-- SEE THE HEADER: that table does not exist on this database yet. The drop is
-- safe (zero rows, no reader in src/) but it leaves e-invoice ShipDtls /
-- DispDtls without a home until the file that creates it is run.
ALTER TABLE accounts.acc_voucher_doc_register
    DROP COLUMN IF EXISTS gdr_ship_name,           DROP COLUMN IF EXISTS gdr_ship_addr1,
    DROP COLUMN IF EXISTS gdr_ship_addr2,          DROP COLUMN IF EXISTS gdr_ship_addr3,
    DROP COLUMN IF EXISTS gdr_ship_location,       DROP COLUMN IF EXISTS gdr_ship_pin,
    DROP COLUMN IF EXISTS gdr_ship_state_code,     DROP COLUMN IF EXISTS gdr_ship_state_name,
    DROP COLUMN IF EXISTS gdr_ship_gstin,
    DROP COLUMN IF EXISTS gdr_dispatch_name,       DROP COLUMN IF EXISTS gdr_dispatch_addr1,
    DROP COLUMN IF EXISTS gdr_dispatch_addr2,      DROP COLUMN IF EXISTS gdr_dispatch_addr3,
    DROP COLUMN IF EXISTS gdr_dispatch_location,   DROP COLUMN IF EXISTS gdr_dispatch_pin,
    DROP COLUMN IF EXISTS gdr_dispatch_state_code, DROP COLUMN IF EXISTS gdr_dispatch_state_name,
    DROP COLUMN IF EXISTS gdr_dispatch_gstin;


-- ── 4. The rename, carried into DATA ─────────────────────────────────────
--
-- gfm_target_column holds a physical column name that the mapping engine
-- reads straight into an UPDATE, so a rename in the schema is a rename in
-- this table too. Without it the CANCEL_IRN map entry points at a column that
-- no longer exists and fails on the one path nobody exercises until a bill
-- has to be pulled back.
--
-- Guarded on the table existing so this file does not depend on the GSP
-- migration having run.
DO $fieldmap$
DECLARE n int := 0;
BEGIN
    IF to_regclass('public.gst_provider_field_map') IS NOT NULL THEN
        UPDATE public.gst_provider_field_map
           SET gfm_target_column = 'gde_cancelled_on',
               gfm_modified_on   = now(),
               gfm_modified_by   = 'MIGRATION'
         WHERE gfm_target_column = 'gde_canceled_on';
        GET DIAGNOSTICS n = ROW_COUNT;
        RAISE NOTICE 'gst_provider_field_map: % row(s) repointed to gde_cancelled_on', n;

        UPDATE public.gst_provider_field_map
           SET gfm_target_column = 'gdw_cancelled_on',
               gfm_modified_on   = now(),
               gfm_modified_by   = 'MIGRATION'
         WHERE gfm_target_column = 'gdw_canceled_on';
    END IF;
END
$fieldmap$;


-- ── 5. Assert the reconciliation actually landed ─────────────────────────
DO $verify$
DECLARE
    missing text;
BEGIN
    SELECT string_agg(t.tbl || '.' || t.col, ', ')
      INTO missing
      FROM (VALUES
        ('acc_voucher_doc_einvoice','gde_cancelled_on'),('acc_voucher_doc_einvoice','gde_modified_on'),
        ('acc_voucher_doc_einvoice','gde_modified_by'),('acc_voucher_doc_einvoice','gde_tenant_id'),
        ('acc_voucher_doc_einvoice','gde_attempt_count'),('acc_voucher_doc_einvoice','gde_last_attempt_on'),
        ('acc_voucher_doc_einvoice','gde_request_payload'),('acc_voucher_doc_einvoice','gde_response_payload'),
        ('acc_voucher_doc_ewaybill','gdw_cancelled_on'),('acc_voucher_doc_ewaybill','gdw_modified_on'),
        ('acc_voucher_doc_ewaybill','gdw_modified_by'),('acc_voucher_doc_ewaybill','gdw_tenant_id'),
        ('acc_voucher_doc_ewaybill','gdw_attempt_count'),('acc_voucher_doc_ewaybill','gdw_last_attempt_on'),
        ('acc_voucher_doc_ewaybill','gdw_request_payload'),('acc_voucher_doc_ewaybill','gdw_response_payload'),
        ('acc_voucher_doc_ewaybill','gdw_transport_doc_no'),('acc_voucher_doc_ewaybill','gdw_transport_doc_date'),
        ('acc_voucher_doc_ewaybill','gdw_vehicle_id'),('acc_voucher_doc_ewaybill','gdw_extended_upto')
      ) AS t(tbl, col)
     WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                        WHERE c.table_schema = 'accounts' AND c.table_name = t.tbl
                          AND c.column_name = t.col);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'reconciliation incomplete, still missing: %', missing;
    END IF;

    -- And the old spellings are gone, so nothing can write to both.
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='accounts'
                  AND table_name IN ('acc_voucher_doc_einvoice','acc_voucher_doc_ewaybill')
                  AND column_name IN ('gde_canceled_on','gdw_canceled_on',
                                      'gde_updated_on','gde_updated_by',
                                      'gdw_updated_on','gdw_updated_by')) THEN
        RAISE EXCEPTION 'an old-spelling column survived the rename';
    END IF;

    RAISE NOTICE 'einvoice/ewaybill reconciled: 20 columns present, old spellings gone.';
END
$verify$;
