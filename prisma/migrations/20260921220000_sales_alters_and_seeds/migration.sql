-- ═══════════════════════════════════════════════════════════════════════════
--  SALES ALTERS — what the six-transaction plan changes on tables that ALREADY
--  EXIST, plus the seeds (roles, ledger map, voucher types, settings, rights).
--
--  Runs AFTER 20260921200000_add_sales_documents; the FKs here point at
--  public.vehicle_master, which that migration creates.
--
--   §0  BACKFILL public.txn_status_log before §1b drops its source columns
--   §1  sales.sale_bill        mode, DC caches, delivery status, PAN/Form 60
--                              stamp, TCS infra, loyalty caches, revision,
--                              status CHECK; the transition stamps come OFF
--   §2  sales.sale_bill_item   lot + bucket, source line id, COGS cache
--   §3  sales.sale_order       revision, user ref date
--   §4  public.txn_charge_detail  charges across part deliveries
--   §5  stock / hold / status-log vocabularies gain the DC pair
--   §6  four timestamptz columns that are really dates
--   §7  masters: unit UQC, customer Form 60, company AATO class, four rights
--   §8  roles + ledgers + map: COGS, INVENTORY, LOYALTY_REDEMPTION,
--                              SCHEME_DISCOUNT
--   §9  voucher types + number series: DCh, DCR, SRt
--   §10 settings
--
--  NOT here, on purpose: nothing else on acc_voucher_doc_register — its live
--  enums already carry DELIVERY_CHALLAN / CREDIT_NOTE / INWARD / sign -1.
--
--  ── DEVIATIONS FROM THE SOURCE PLAN, AND WHY ────────────────────────────
--
--   1. §0 IS NEW, AND IT IS THE REASON THIS MIGRATION IS SAFE TO RUN.
--      §1b drops sb_posted_on, sb_cancelled_on, sb_cancelled_by and
--      sb_cancel_reason on the grounds that public.txn_status_log is the home
--      for that history. On THIS database that is very nearly true and not
--      quite: of the 20 bills carrying sb_posted_on, 19 have a matching
--      POSTED row in the log and ONE — bil00005, posted 2026-08-06 — does
--      not. Dropping the column as written would have destroyed the only
--      record of when that bill was posted, irreversibly, on a live table.
--
--      So the log is BACKFILLED from the columns first, and only then are
--      they dropped. The plan's premise is made true before it is relied on.
--
--   2. THE CREW FOREIGN KEYS ARE VALIDATED, not NOT VALID. The plan marks
--      fk_sb_vehicle NOT VALID. Checked first: sale_bill holds zero
--      sb_vehicle_id values and zero sb_driver_id / sb_supervisor_id values
--      that are not in employee_master, so there is nothing to tiptoe around
--      and a permanently NOT VALID constraint is an asterisk nobody revisits.
--
--   3. NO BEGIN/COMMIT and no trailing verify SELECTs — Prisma wraps the file
--      in its own transaction, and an explicit COMMIT would end it early.
--
--  ── WHAT WAS CHECKED BEFORE WRITING THIS ────────────────────────────────
--  Every enum label used below exists (VoucherCategory BOTH, VoucherNature
--  SALES / CREDIT_NOTE, VoucherNumberingMode AUTO, VoucherResetFreq YEARLY);
--  ck_alr_group admits REVENUE; the three account-group names resolve
--  globally; acc_voucher_types.vchr_type_id has a sequence default that is IN
--  SYNC with the max id in use (14/14), so the three new types get 15-17
--  without collision; no view depends on any column this file drops or
--  retypes; none of the constraint names added below already exist; and every
--  value in use in the four vocabularies §5 rewrites is inside the new list.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  §0  BACKFILL public.txn_status_log FROM THE COLUMNS §1b IS ABOUT TO DROP
--
--  This must run BEFORE the drops. It is idempotent — every insert is guarded
--  by a NOT EXISTS on the log — and it is a no-op on a database whose log is
--  already complete.
-- ═══════════════════════════════════════════════════════════════════════════

-- The POST event. tsl_seq_no is unique per (doc type, doc id, year), so the
-- backfilled row takes the next free number rather than assuming 1.
INSERT INTO public.txn_status_log
    (tsl_company_id, tsl_branch_id, tsl_acc_year, tsl_src_module, tsl_src_doc_type,
     tsl_src_doc_id, tsl_src_doc_refno, tsl_seq_no, tsl_event, tsl_to_status,
     tsl_changed_on, tsl_changed_by, tsl_remarks, tsl_created_by)
SELECT b.sb_company_id, b.sb_branch_id, b.sb_acc_year, 'SALES', 'SALE_BILL',
       b.sb_id, b.sb_bill_refno,
       COALESCE((SELECT max(l.tsl_seq_no) FROM public.txn_status_log l
                  WHERE l.tsl_src_doc_type = 'SALE_BILL' AND l.tsl_src_doc_id = b.sb_id
                    AND l.tsl_acc_year = b.sb_acc_year), 0) + 1,
       'POSTED', 'POSTED',
       b.sb_posted_on, b.sb_user_id,
       'Backfilled from sale_bill.sb_posted_on before that column was dropped.',
       'MIGRATION'
  FROM sales.sale_bill b
 WHERE b.sb_posted_on IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.txn_status_log l
                    WHERE l.tsl_src_doc_type = 'SALE_BILL' AND l.tsl_src_doc_id = b.sb_id
                      AND l.tsl_to_status = 'POSTED');

-- The CANCEL event, carrying the reason into tsl_remarks — which is exactly
-- where the plan says a cancel reason belongs.
INSERT INTO public.txn_status_log
    (tsl_company_id, tsl_branch_id, tsl_acc_year, tsl_src_module, tsl_src_doc_type,
     tsl_src_doc_id, tsl_src_doc_refno, tsl_seq_no, tsl_event, tsl_to_status,
     tsl_changed_on, tsl_changed_by, tsl_remarks, tsl_created_by)
SELECT b.sb_company_id, b.sb_branch_id, b.sb_acc_year, 'SALES', 'SALE_BILL',
       b.sb_id, b.sb_bill_refno,
       COALESCE((SELECT max(l.tsl_seq_no) FROM public.txn_status_log l
                  WHERE l.tsl_src_doc_type = 'SALE_BILL' AND l.tsl_src_doc_id = b.sb_id
                    AND l.tsl_acc_year = b.sb_acc_year), 0) + 1,
       'CANCELLED', 'CANCELLED',
       b.sb_cancelled_on, COALESCE(b.sb_cancelled_by, b.sb_user_id),
       COALESCE(b.sb_cancel_reason,
                'Backfilled from sale_bill before the cancel columns were dropped.'),
       'MIGRATION'
  FROM sales.sale_bill b
 WHERE b.sb_cancelled_on IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.txn_status_log l
                    WHERE l.tsl_src_doc_type = 'SALE_BILL' AND l.tsl_src_doc_id = b.sb_id
                      AND l.tsl_to_status = 'CANCELLED');

-- Anything left that the backfill cannot rehome is named out loud rather than
-- discarded quietly. A cancel REASON with no cancel DATE is the one shape that
-- has nowhere to go: there is no event to hang it on, and inventing one to
-- carry leftover text would pollute a vocabulary the whole product reads.
DO $orphans$
DECLARE r record; n int := 0;
BEGIN
    FOR r IN SELECT sb_bill_refno, sb_status, sb_cancel_reason
               FROM sales.sale_bill
              WHERE sb_cancel_reason IS NOT NULL AND sb_cancelled_on IS NULL
    LOOP
        RAISE NOTICE 'DISCARDING orphan cancel reason on % (status %): %',
                     r.sb_bill_refno, r.sb_status, r.sb_cancel_reason;
        n := n + 1;
    END LOOP;
    IF n = 0 THEN
        RAISE NOTICE 'No orphan cancel reasons; the column drops below lose nothing.';
    END IF;
END
$orphans$;


-- ═══════════════════════════════════════════════════════════════════════════
--  §1  sales.sale_bill
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE sales.sale_bill
    -- One table, two modes; the MODE owns the number series (POS = per
    -- device, WHOLESALE = the branch MAIN series).
    ADD COLUMN IF NOT EXISTS sb_bill_mode          character varying(10) NOT NULL DEFAULT 'WHOLESALE',

    ADD COLUMN IF NOT EXISTS sb_usr_refdate        date,

    -- Ship-to, dispatch and transport are NOT added here. They belong to
    -- public.txn_transport_detail — one band for every goods-moving document.
    -- The five crew/vehicle columns sale_bill already has STAY; see §1b2.

    -- How much of this bill came in under a challan. Stock and COGS for that
    -- part were posted AT THE DC; the bill posts them only for the direct
    -- lines.
    ADD COLUMN IF NOT EXISTS sb_has_dc             boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sb_dc_taxable_amt     numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sb_cogs_amt           numeric(15,2) NOT NULL DEFAULT 0,

    -- Delivery status is a CACHE; the events are txn_status_log rows.
    ADD COLUMN IF NOT EXISTS sb_delivery_status    character varying(20) NOT NULL DEFAULT 'NA',
    ADD COLUMN IF NOT EXISTS sb_delivered_on       timestamptz,

    -- The identity stamp on a cash sale over the rule 114B limit: what was
    -- shown at the counter, kept WITH the bill and never re-derived.
    ADD COLUMN IF NOT EXISTS sb_cust_pan           character varying(10),
    ADD COLUMN IF NOT EXISTS sb_form60_ref         character varying(50),

    -- TCS infrastructure kept, rate 0 today (206C(1H) removed 2025-04-01).
    ADD COLUMN IF NOT EXISTS sb_tcs_perc           numeric(6,3)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sb_tcs_amt            numeric(15,2) NOT NULL DEFAULT 0,

    -- Loyalty caches; the detail is the loyalty_ledger rows keyed by this bill.
    ADD COLUMN IF NOT EXISTS sb_loyalty_member_id  uuid,
    ADD COLUMN IF NOT EXISTS sb_loyalty_earned     numeric(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sb_loyalty_redeemed   numeric(15,2) NOT NULL DEFAULT 0,

    ADD COLUMN IF NOT EXISTS sb_revision_no        integer NOT NULL DEFAULT 1,

    -- The register row this bill owns. Server-owned, like sb_posted_voucher_id
    -- — the DTO never carries either.
    ADD COLUMN IF NOT EXISTS sb_doc_register_id    uuid;

ALTER TABLE sales.sale_bill
    ADD CONSTRAINT ck_sb_bill_mode CHECK (sb_bill_mode::text = ANY (ARRAY['POS'::text, 'WHOLESALE'::text])),
    ADD CONSTRAINT ck_sb_delivery_status CHECK (sb_delivery_status::text = ANY (ARRAY[
        'NA'::text, 'PENDING'::text, 'PACKED'::text, 'DISPATCHED'::text, 'DELIVERED'::text, 'RETURNED'::text])),
    -- There is NO status CHECK on sale_bill live. This one is validated
    -- against what actually exists: 20 POSTED and 10 DRAFT rows, both admitted.
    ADD CONSTRAINT ck_sb_status CHECK (sb_status::text = ANY (ARRAY[
        'DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text]));

CREATE INDEX IF NOT EXISTS ix_sb_delivery_status
    ON sales.sale_bill USING btree (sb_company_id, sb_branch_id, sb_delivery_status, sb_bill_date DESC)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE sb_is_deleted = false AND sb_status = 'POSTED' AND sb_delivery_status NOT IN ('NA','DELIVERED');


-- ── §1b  The transition stamps come OFF the header ───────────────────────
--
-- WHEN, WHO and WHY a status changed belong in public.txn_status_log, which
-- already carries tsl_changed_on, tsl_changed_by and tsl_remarks (the cancel
-- reason), with from-status, device and session besides. A second copy on the
-- header means the reason is written twice and the two can disagree, and it
-- means an amendment OVERWRITES the previous cancel instead of leaving a trail.
--
-- It matters for the offline push too: a log row is APPENDED, and two devices
-- appending cannot conflict the way two devices UPDATEing one header row can.
--
-- sale_bill keeps sb_status (filtering, the CHECK, the badge) and
-- sb_posted_voucher_id, which is a RELATIONSHIP to the voucher rather than an
-- event — and is how a document reaches its voucher without scanning the log.
--
-- §0 above has already rehomed everything these columns held.
ALTER TABLE sales.sale_bill
    DROP COLUMN IF EXISTS sb_posted_on,
    DROP COLUMN IF EXISTS sb_cancelled_on,
    DROP COLUMN IF EXISTS sb_cancelled_by,
    DROP COLUMN IF EXISTS sb_cancel_reason;

-- Same for the quotation, which carries only the cancel stamp (and holds none
-- on this database — verified zero non-null before dropping).
ALTER TABLE sales.sale_quotation
    DROP COLUMN IF EXISTS sq_cancelled_on;


-- ── §1b2  The bill KEEPS its crew and vehicle; only the band leaves ──────
--
-- sb_driver_id, sb_supervisor_id, sb_vehicle_id, sb_vehicle_no and
-- sb_loadman_id STAY. They are "who of OURS did it", and they exist whenever
-- goods move, even with no consignment — a home delivery has a driver and a
-- van and no transporter, no LR, no e-way bill. Only the addresses and the
-- carriage belong to the shared transport band.
--
-- They are NOT duplicated into that band. One home per fact: the e-way builder
-- reads the vehicle off the document it has loaded anyway, and the rest from
-- the band. Two copies of a vehicle number would diverge and no report would
-- know which to trust.
--
-- The foreign keys these columns have never had, now that vehicle_master
-- exists. Declared VALID rather than NOT VALID: sale_bill holds zero
-- sb_vehicle_id values, and zero driver/supervisor values absent from
-- employee_master, so there is nothing to defer.
ALTER TABLE sales.sale_bill
    ADD CONSTRAINT fk_sb_driver FOREIGN KEY (sb_driver_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_sb_supervisor FOREIGN KEY (sb_supervisor_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_sb_vehicle FOREIGN KEY (sb_vehicle_id)
        REFERENCES public.vehicle_master (veh_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK-covering for the three above.
CREATE INDEX IF NOT EXISTS ix_sb_driver ON sales.sale_bill USING btree (sb_driver_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sb_driver_id IS NOT NULL AND sb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sb_supervisor ON sales.sale_bill USING btree (sb_supervisor_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sb_supervisor_id IS NOT NULL AND sb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sb_vehicle ON sales.sale_bill USING btree (sb_vehicle_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sb_vehicle_id IS NOT NULL AND sb_is_deleted = false;

-- An EARLIER draft of this plan put the ship / dispatch / transport block on
-- the header before that band moved out. Never deployed here, but a database
-- where that draft ran would hold those columns AND a transport row — two
-- copies, and the stale one is the kind a report reads quietly. Self-healing;
-- a no-op where they never existed.
ALTER TABLE sales.sale_bill
    DROP COLUMN IF EXISTS sb_ship_addr_id,
    DROP COLUMN IF EXISTS sb_ship_name,
    DROP COLUMN IF EXISTS sb_ship_addr,
    DROP COLUMN IF EXISTS sb_ship_place,
    DROP COLUMN IF EXISTS sb_ship_pin,
    DROP COLUMN IF EXISTS sb_ship_phone,
    DROP COLUMN IF EXISTS sb_ship_stcd,
    DROP COLUMN IF EXISTS sb_ship_gstin,
    DROP COLUMN IF EXISTS sb_dispatch_godown_id,
    DROP COLUMN IF EXISTS sb_dispatch_branch_id,
    DROP COLUMN IF EXISTS sb_transport_mode,
    DROP COLUMN IF EXISTS sb_transporter_id,
    DROP COLUMN IF EXISTS sb_transporter_name,
    DROP COLUMN IF EXISTS sb_transporter_gstin,
    DROP COLUMN IF EXISTS sb_lr_no,
    DROP COLUMN IF EXISTS sb_lr_date,
    DROP COLUMN IF EXISTS sb_distance_km;


-- ── §1c  sale_quotation: the salesman becomes a TEAM, like every other doc ──
--
-- sale_bill.sb_salesman_id, sale_order.so_salesman_id and sale_dc's are
-- already uuid[]. The quotation and the return were the two left singular, so
-- a dual-salesman quote could not be recorded and the second name was lost the
-- moment it converted. The sale return was fixed when it was created; this
-- fixes the quotation.
--
-- The LINE tables stay a single uuid on purpose: the DOCUMENT is credited to a
-- team, a LINE to one person.
--
-- No share percentage. uuid[] records WHO, not how much each — commission is
-- parked, and when it is built it needs its own home rather than a number
-- smuggled into this column.
--
-- The FK has to go FIRST: PostgreSQL cannot put a foreign key on the ELEMENTS
-- of an array, which is why sale_bill and sale_order have never had one. That
-- integrity moves to the service, which validates every id against
-- public.employee_master before it writes.
ALTER TABLE sales.sale_quotation DROP CONSTRAINT IF EXISTS fk_sq_salesman;
ALTER TABLE sales.sale_quotation
    ALTER COLUMN sq_salesman_id TYPE uuid[]
    USING CASE WHEN sq_salesman_id IS NULL THEN NULL ELSE ARRAY[sq_salesman_id] END;

-- Lookup by salesman needs GIN once the column is an array: a btree cannot
-- answer "is this id in the array". Without these, "documents for salesman X"
-- is a sequential scan — fine at 30 rows and not at 300,000.
CREATE INDEX IF NOT EXISTS ix_sb_salesman_gin
    ON sales.sale_bill USING gin (sb_salesman_id) WHERE sb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_so_salesman_gin
    ON sales.sale_order USING gin (so_salesman_id) WHERE so_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sq_salesman_gin
    ON sales.sale_quotation USING gin (sq_salesman_id) WHERE sq_is_deleted = false;

-- The query shape every report and grid must use, now and for a third
-- salesman later, with no change when the count grows:
--     WHERE sb_salesman_id @> ARRAY[:salesman]::uuid[]


-- ── §1d  The collection side stays SINGULAR, deliberately ────────────────
--
-- accounts.acc_bill_balance.abl_salesman_id, acc_pdc_register.apd_salesman_id
-- and acc_voucher_cheques.chq_salesman_id remain ONE uuid. abl_salesman_id
-- carries a btree (ix_abl_salesman) that drives outstanding-by-salesman, and
-- an array would cost it that index for a GIN and rewrite every query to @>.
--
-- So the posting service writes the PRIMARY salesman there:
--
--     abl_salesman_id = sb_salesman_id[1]     -- Postgres arrays are 1-based
--
-- and the client must therefore put the primary FIRST in the array. That is a
-- CONVENTION the schema cannot enforce, so it is written in all three places
-- it has to live: here, in the backend plan, and in the client that builds the
-- array.
--
-- A second or third salesman is recorded on the DOCUMENT and is NOT credited
-- in outstanding-by-salesman. A deliberate limit, written down so it is not
-- later discovered as a bug: if collection must credit all of them,
-- abl_salesman_id becomes uuid[] with a GIN index and ix_abl_salesman is
-- rebuilt. Nothing else changes, which is the point of the array — a third
-- salesman needs no migration on the document side at all.


-- ═══════════════════════════════════════════════════════════════════════════
--  §2  sales.sale_bill_item
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE sales.sale_bill_item
    -- The stock engine keys on the LOT, not the legacy sbi_stock_id.
    ADD COLUMN IF NOT EXISTS sbi_lot_id            uuid,
    ADD COLUMN IF NOT EXISTS sbi_bucket            character varying(20) NOT NULL DEFAULT 'SALEABLE',
    -- The source LINE (soi_id or sdi_id): sbi_src_doc_id is the HEADER, and
    -- sbi_src_doc_line_no is not a key across an amend.
    ADD COLUMN IF NOT EXISTS sbi_src_item_id       uuid,
    -- What this line posted as COGS — zero on a line that came via a DC,
    -- because the challan already posted it.
    ADD COLUMN IF NOT EXISTS sbi_cogs_amt          numeric(15,2) NOT NULL DEFAULT 0,
    -- The free-item claw-back needs to know which promotion gave it.
    ADD COLUMN IF NOT EXISTS sbi_promo_usage_id    uuid;

ALTER TABLE sales.sale_bill_item
    ADD CONSTRAINT ck_sbi_bucket CHECK (sbi_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text, 'EXPIRED'::text, 'SAMPLE'::text])),
    ADD CONSTRAINT fk_sbi_lot FOREIGN KEY (sbi_lot_id)
        REFERENCES stock.stock_lot (slt_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_sbi_src_item
    ON sales.sale_bill_item USING btree (sbi_src_item_id, sbi_src_doc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sbi_is_deleted = false AND sbi_src_item_id IS NOT NULL;
-- FK-covering for fk_sbi_lot.
CREATE INDEX IF NOT EXISTS ix_sbi_lot ON sales.sale_bill_item USING btree (sbi_lot_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sbi_lot_id IS NOT NULL AND sbi_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §3  sales.sale_order — the reservation columns already exist
--      (soi_is_reserved, soi_reserved_qty, soi_reserve_expires_on and the
--      stock.stock_reservation table). Only the amend counter is missing.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE sales.sale_order
    ADD COLUMN IF NOT EXISTS so_revision_no        integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS so_usr_refdate        date;


-- ═══════════════════════════════════════════════════════════════════════════
--  §4  public.txn_charge_detail — charges across part deliveries
--
--  An ORDER's charge row is the SOURCE. Each bill raised against the order
--  carries its own charge rows that point back at the source and say how much
--  of it they took. PRORATA (the default): the bill's share of the order's
--  delivered value, with the final bill taking the remainder so the sum closes
--  exactly. MANUAL: the operator typed it. NONE: the bill declined the charge.
--  FULL: the first bill took it all.
--
--  cd_doc_type is varchar(12) and holds ORDER / INVOICE / QUOTATION today;
--  'DELIVERY_CHALLAN' does not fit in twelve characters. Widened.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.txn_charge_detail
    ALTER COLUMN cd_doc_type TYPE character varying(30);

ALTER TABLE public.txn_charge_detail
    ADD COLUMN IF NOT EXISTS cd_src_cd_id          uuid,
    ADD COLUMN IF NOT EXISTS cd_src_acc_year       character(9),
    ADD COLUMN IF NOT EXISTS cd_carry_basis        character varying(10),
    -- On the SOURCE row: how much has been taken so far. A cache.
    ADD COLUMN IF NOT EXISTS cd_carried_amt        numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.txn_charge_detail
    ADD CONSTRAINT ck_cd_carry_basis CHECK (cd_carry_basis IS NULL OR cd_carry_basis::text = ANY (ARRAY[
        'PRORATA'::text, 'FULL'::text, 'MANUAL'::text, 'NONE'::text])),
    ADD CONSTRAINT ck_cd_src_pair CHECK ((cd_src_cd_id IS NULL) = (cd_src_acc_year IS NULL)),
    ADD CONSTRAINT fk_cd_src FOREIGN KEY (cd_src_cd_id, cd_src_acc_year)
        REFERENCES public.txn_charge_detail (cd_id, cd_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_cd_src
    ON public.txn_charge_detail USING btree (cd_src_cd_id, cd_src_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE cd_is_deleted = false AND cd_src_cd_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §5  Vocabularies: the DC pair, everywhere a document type is listed.
--
--  Every value currently in use was checked against the new lists first.
-- ═══════════════════════════════════════════════════════════════════════════
-- The stock ledger: DC_ISSUE (−) and DC_RETURN (+) are their own txn types, so
-- a stock report can show "goods out, not yet billed" without joining sales.
ALTER TABLE stock.stock_ledger DROP CONSTRAINT IF EXISTS ck_sml_txn_type;
ALTER TABLE stock.stock_ledger ADD CONSTRAINT ck_sml_txn_type CHECK (sml_txn_type::text = ANY (ARRAY[
    'OPENING'::text, 'PURCHASE'::text, 'PURCHASE_RETURN'::text, 'SALE'::text, 'SALE_RETURN'::text,
    'DC_ISSUE'::text, 'DC_RETURN'::text,
    'TRANSFER_OUT'::text, 'TRANSFER_IN'::text, 'ADJUST_PLUS'::text, 'ADJUST_MINUS'::text,
    'PHYSICAL_PLUS'::text, 'PHYSICAL_MINUS'::text, 'DAMAGE'::text, 'EXPIRY_WRITEOFF'::text,
    'REPACK_IN'::text, 'REPACK_OUT'::text, 'BUCKET_IN'::text, 'BUCKET_OUT'::text,
    'GIFT_ISSUE'::text, 'SAMPLE_ISSUE'::text]));

-- Hold and status log: DC_RETURN was not a document type in either.
ALTER TABLE public.txn_hold DROP CONSTRAINT IF EXISTS ck_txh_doc_type;
ALTER TABLE public.txn_hold ADD CONSTRAINT ck_txh_doc_type CHECK (txh_doc_type::text = ANY (ARRAY[
    'QUOTATION'::text, 'SALES_ORDER'::text, 'DELIVERY_CHALLAN'::text, 'DC_RETURN'::text, 'SALE_BILL'::text,
    'SALE_RETURN'::text, 'PURCHASE_ORDER'::text, 'PURCHASE_BILL'::text, 'PURCHASE_RETURN'::text,
    'STOCK_TRANSFER'::text, 'STOCK_ADJUSTMENT'::text, 'RECEIPT'::text, 'PAYMENT'::text, 'JOURNAL'::text, 'OTHER'::text]));

ALTER TABLE public.txn_status_log DROP CONSTRAINT IF EXISTS ck_tsl_src_doc_type;
ALTER TABLE public.txn_status_log ADD CONSTRAINT ck_tsl_src_doc_type CHECK (tsl_src_doc_type::text = ANY (ARRAY[
    'QUOTATION'::text, 'SALES_ORDER'::text, 'DELIVERY_CHALLAN'::text, 'DC_RETURN'::text, 'SALE_BILL'::text,
    'SALE_RETURN'::text, 'PURCHASE_ORDER'::text, 'PURCHASE_BILL'::text, 'PURCHASE_RETURN'::text,
    'STOCK_TRANSFER'::text, 'STOCK_ADJUSTMENT'::text, 'RECEIPT'::text, 'PAYMENT'::text, 'JOURNAL'::text, 'OTHER'::text]));

-- Tender detail is unchanged: a DC never carries money, and a DC return never
-- refunds.

-- The one TranDtls flag the live register lacks: IGST charged on an
-- intra-state supply (an SEZ unit in the same state, and the s.10(1)(b)
-- bill-to/ship-to cases).
ALTER TABLE accounts.acc_voucher_doc_register
    ADD COLUMN IF NOT EXISTS gdr_igst_on_intra boolean NOT NULL DEFAULT false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §6  Four columns that hold a DATE in a timestamptz.
--
--  A voucher dated 2026-04-01 stored as 2026-03-31T18:30Z lands in the WRONG
--  DAY of every date-bounded report — and, for the first day of a financial
--  year, in the wrong YEAR. Converted through Asia/Kolkata, which is the zone
--  they were written in. Changed on the PARENT; the partitions follow.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE accounts.acc_voucher_header ALTER COLUMN avh_voucher_date TYPE date USING (avh_voucher_date AT TIME ZONE 'Asia/Kolkata')::date;
ALTER TABLE accounts.acc_vouchers       ALTER COLUMN av_voucher_date  TYPE date USING (av_voucher_date  AT TIME ZONE 'Asia/Kolkata')::date;
ALTER TABLE accounts.acc_vouchers       ALTER COLUMN av_doc_date      TYPE date USING (av_doc_date      AT TIME ZONE 'Asia/Kolkata')::date;
ALTER TABLE sales.sale_quotation        ALTER COLUMN sq_src_doc_date  TYPE date USING (sq_src_doc_date  AT TIME ZONE 'Asia/Kolkata')::date;
-- In Prisma these become DateTime @db.Date, and the services that write them
-- must stop passing a midnight timestamptz.


-- ═══════════════════════════════════════════════════════════════════════════
--  §7  Masters
-- ═══════════════════════════════════════════════════════════════════════════
-- UQC for the e-invoice / e-way / GSTR-1 HSN summary. item_unit_master has a
-- Tally name and no UQC; this is the three-letter code from the GST UQC list.
ALTER TABLE inventory.item_unit_master
    ADD COLUMN IF NOT EXISTS unit_uqc              character(3);
ALTER TABLE inventory.item_unit_master
    ADD CONSTRAINT ck_unit_uqc CHECK (unit_uqc IS NULL OR unit_uqc ~ '^[A-Z]{3}$');

-- Form 60 on the customer (PAN already exists as cus_pan_no).
ALTER TABLE sales.customers
    ADD COLUMN IF NOT EXISTS cus_form60_on         date,
    ADD COLUMN IF NOT EXISTS cus_pan_verified_on   date;

-- The company's turnover class, set by the accountant each April from
-- public.company_aato. It picks the HSN digits, the IRN reporting window and
-- the e-invoice applicability rows in public.statutory_limits.
ALTER TABLE public.companys
    ADD COLUMN IF NOT EXISTS comp_aato_class       character varying(10) NOT NULL DEFAULT 'LE_5CR',
    ADD COLUMN IF NOT EXISTS comp_dc_purposes      character varying(20)[] NOT NULL DEFAULT ARRAY['SUPPLY','APPROVAL','JOB_WORK','OTHER']::character varying(20)[];
ALTER TABLE public.companys
    ADD CONSTRAINT ck_comp_aato_class CHECK (comp_aato_class::text = ANY (ARRAY[
        'LE_1_5CR'::text, 'LE_5CR'::text, 'LE_10CR'::text, 'GT_10CR'::text]));

-- Four rights user_menus does not have. view/create/edit/delete/print/export
-- exist; a TRANSACTION screen also asks "may this user POST, CANCEL a posted
-- document, AMEND one, and OVERRIDE a WARN-level guard" (discount cap, credit
-- limit, back-date, rate below minimum). Default FALSE: these are GRANTED,
-- never assumed. Note that a user_menus save is a full replace — the client
-- must send all ten flags or it will silently revoke the four new ones.
ALTER TABLE public.user_menus
    ADD COLUMN IF NOT EXISTS um_can_post           boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS um_can_cancel         boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS um_can_amend          boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS um_can_override       boolean NOT NULL DEFAULT false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §8  Roles, ledgers, map — every leg a sales document writes is found by
--      ROLE. The live roles already cover SALES, SALES_RETURN, OUTPUT_*,
--      ROUND_OFF, DISCOUNT_ALLOWED, ADVANCE_RECEIVED and TCS_PAYABLE. Missing:
--      the perpetual-COGS pair and the two sales-side expenses.
--
--      alr_group is NOT NULL and CHECKed; the live vocabulary is REVENUE /
--      PURCHASE / INPUT_TAX / OUTPUT_TAX / RECEIPT / SHARED / FUTURE, and
--      admits no new word. All four go under REVENUE — they are legs of a
--      sales voucher.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO accounts.acc_ledger_role (alr_role, alr_label, alr_group, alr_want_nature, alr_want_type)
VALUES ('COGS',               'Cost of goods sold (perpetual)',      'REVENUE', 'Expenses', 'EXPENSE'),
       ('INVENTORY',          'Stock in hand (perpetual)',           'REVENUE', 'Assets',   NULL),
       ('LOYALTY_REDEMPTION', 'Loyalty points redeemed',             'REVENUE', 'Expenses', 'EXPENSE'),
       ('SCHEME_DISCOUNT',    'Promotion / scheme discount allowed', 'REVENUE', 'Expenses', 'EXPENSE')
ON CONFLICT (alr_role) DO NOTHING;

-- The four global ledgers, created only where this installation lacks them.
-- Group names are looked up BY NAME; all three resolve on this database
-- (Direct Expenses, Stock-in-Hand, Indirect Expenses).
INSERT INTO accounts.acc_ledger_master (led_id, led_group_id, led_name, led_short, led_category, led_ledger_type, led_company_id, led_created_by)
SELECT uuidv7(), g.acc_group_id, v.led_name, v.led_short, 'GENERAL', v.led_type, NULL, 'system'
FROM (VALUES ('Cost of Goods Sold',     'COGS',   'EXPENSE', 'Direct Expenses'),
             ('Stock in Hand',          'STKHND', NULL,      'Stock-in-Hand'),
             ('Loyalty Points Redeemed','LOYRED', 'EXPENSE', 'Indirect Expenses'),
             ('Scheme Discount Allowed','SCHDSC', 'EXPENSE', 'Indirect Expenses')) AS v(led_name, led_short, led_type, group_name)
JOIN accounts.acc_group_master g
  ON lower(g.acc_group_name) = lower(v.group_name) AND g.acc_group_is_deleted = false AND g.acc_group_company_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_ledger_master l
                   WHERE lower(l.led_name) = lower(v.led_name) AND l.led_is_deleted = false AND l.led_company_id IS NULL);

INSERT INTO accounts.acc_ledger_map (alm_role, alm_ledger_id, alm_remarks, alm_created_by)
SELECT v.role, l.led_id, 'seeded by 20260921220000_sales_alters_and_seeds', 'system'
FROM (VALUES ('COGS',               'Cost of Goods Sold'),
             ('INVENTORY',          'Stock in Hand'),
             ('LOYALTY_REDEMPTION', 'Loyalty Points Redeemed'),
             ('SCHEME_DISCOUNT',    'Scheme Discount Allowed')) AS v(role, ledger_name)
JOIN accounts.acc_ledger_master l
  ON lower(l.led_name) = lower(v.ledger_name) AND l.led_is_deleted = false AND l.led_company_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM accounts.acc_ledger_map m
   WHERE m.alm_role = v.role AND m.alm_company_id IS NULL AND m.alm_branch_id IS NULL
     AND m.alm_supply_nature IS NULL AND m.alm_is_deleted = false);


-- ═══════════════════════════════════════════════════════════════════════════
--  §9  Voucher types — three new rows, modelled on Bil (type 3). The Tally
--      names are the base types the export maps to: the DC pair export as
--      inventory vouchers, the return as a Credit Note. A reversal voucher
--      (the cancel of any of these) reuses the SAME type with the reversal
--      link set, and the exporter skips a pair whose original is CANCELLED.
--
--      vchr_type_id is not supplied: the column has a sequence default which
--      was verified in sync with the max id in use, so these take the next
--      free numbers.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT * FROM (VALUES
 ('DCh', 'Delivery Challan',        'DCh', 'BOTH'::accounts."VoucherCategory", 'SALES'::accounts."VoucherNature",       'AUTO'::accounts."VoucherNumberingMode",
         'dc',  '', 5, 'YEARLY'::accounts."VoucherResetFreq", false, true,  true, false, false,
         'DELIVERY CHALLAN', 310, true,  true, 'Delivery Note',  'Delivery Note',  'system'),
 ('DCR', 'Delivery Challan Return', 'DCR', 'BOTH'::accounts."VoucherCategory", 'SALES'::accounts."VoucherNature",       'AUTO'::accounts."VoucherNumberingMode",
         'dcr', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false, true,  true, false, false,
         'CHALLAN RETURN',   311, true,  true, 'Rejections In',  'Rejections In',  'system'),
 ('SRt', 'Sales Return',            'SRt', 'BOTH'::accounts."VoucherCategory", 'CREDIT_NOTE'::accounts."VoucherNature", 'AUTO'::accounts."VoucherNumberingMode",
         'srt', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false, true,  true, false, false,
         'CREDIT NOTE',      320, true,  true, 'Credit Note',    'Credit Note',    'system')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.column1);

-- The number series: one row per (company, branch, year, device) that Bil
-- already has, cloned for each new type. seq_last_no starts at 0.
INSERT INTO accounts.acc_voucher_seq
    (seq_vchr_type_id, seq_company_id, seq_branch_id, seq_acc_year, seq_device_id, seq_device_code, seq_period_key,
     seq_last_no, seq_voucher_prefix, seq_company_code, seq_branch_code, seq_voucher_suffix, seq_no_width)
SELECT t.vchr_type_id, s.seq_company_id, s.seq_branch_id, s.seq_acc_year, s.seq_device_id, s.seq_device_code, s.seq_period_key,
       0, t.vchr_no_prefix, s.seq_company_code, s.seq_branch_code, t.vchr_no_suffix, t.vchr_no_width
FROM accounts.acc_voucher_seq s
JOIN accounts.acc_voucher_types b ON b.vchr_type_id = s.seq_vchr_type_id AND b.vchr_type_code = 'Bil'
CROSS JOIN accounts.acc_voucher_types t
WHERE t.vchr_type_code IN ('DCh','DCR','SRt')
  AND s.seq_is_deleted = false
  AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_seq x
                   WHERE x.seq_vchr_type_id = t.vchr_type_id AND x.seq_company_id = s.seq_company_id
                     AND x.seq_branch_id = s.seq_branch_id AND x.seq_acc_year = s.seq_acc_year
                     AND x.seq_device_id IS NOT DISTINCT FROM s.seq_device_id);


-- ═══════════════════════════════════════════════════════════════════════════
--  §10 Settings. Every one carries the default the plan was written to.
--      LAW figures are NOT settings — those are public.statutory_limits rows.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT v.asd_key, v.asd_module, v.asd_group, v.asd_data_type, v.asd_default_value, v.asd_allowed_values::jsonb,
       v.asd_max_scope, v.asd_label, v.asd_description, v.asd_sort_order, 'system' FROM (VALUES
 ('accounts.cogs_mode',              'ACCOUNTS', 'Posting',    'TEXT',    'PERPETUAL', '["PERPETUAL","PERIODIC"]', 'COMPANY',
  'Cost of goods sold', 'PERPETUAL: every stock movement posts DR COGS / CR Stock in Hand at cost (DC, direct bill, returns). PERIODIC: no COGS legs; the year-end closing-stock journal does it.', 10),
 ('sales.allow_posted_amend',        'SALES',    'Posting',    'BOOL',    'true',  NULL, 'COMPANY',
  'Amend a posted document in place', 'Bill / return / DC / order: the create+post payload against the same number, revision +1. Refused when an IRN or e-way bill is live, a return or receipt allocation exists, or the day is closed.', 20),
 ('sales.return_window_days',        'SALES',    'Return',     'INT',     '0',     NULL, 'COMPANY',
  'Return window (days)', '0 = no limit. Otherwise a return against a bill older than this WARNs; um_can_override passes it.', 30),
 ('sales.free_return_allowed',       'SALES',    'Return',     'BOOL',    'true',  NULL, 'COMPANY',
  'Allow a return with no bill', 'A free return is priced at the current selling price, posts no COGS reversal, and is flagged on every report.', 31),
 ('sales.return_settle_default',     'SALES',    'Return',     'TEXT',    'ADJUST', '["CASH","ADJUST","ADVANCE"]', 'BRANCH',
  'Default settlement of a return', 'CASH refund now; ADJUST against the original bill first then other open bills, remainder a credit note; ADVANCE the whole amount as a credit note.', 32),
 ('sales.backdate_mode',             'SALES',    'Posting',    'TEXT',    'WARN',  '["ALLOW","WARN","REFUSE"]', 'COMPANY',
  'Back-dated documents', 'A document dated before today (within the open year). WARN needs um_can_override; REFUSE never. Dates after today are always refused.', 40),
 ('sales.max_line_disc_perc',        'SALES',    'Pricing',    'DECIMAL', '0',     NULL, 'COMPANY',
  'Line discount cap (%)', '0 = no cap. Above it the post WARNs; um_can_override passes.', 50),
 ('sales.max_bill_disc_perc',        'SALES',    'Pricing',    'DECIMAL', '0',     NULL, 'COMPANY',
  'Bill-level discount cap (%)', '0 = no cap.', 51),
 ('sales.rate_below_min_mode',       'SALES',    'Pricing',    'TEXT',    'WARN',  '["ALLOW","WARN","REFUSE"]', 'COMPANY',
  'Rate below the item minimum', 'The rate is editable; below sbi_min_price it WARNs.', 52),
 ('sales.credit_limit_mode',         'SALES',    'Credit',     'TEXT',    'REFUSE', '["WARN","REFUSE"]', 'COMPANY',
  'Credit limit breach on a credit bill', 'Checked on the SERVER at post against cus_credit_amt_limit / cus_credit_bill_limit / cus_credit_days. REFUSE unless um_can_override with a remark.', 60),
 ('sales.pos_series_per_device',     'SALES',    'Numbering',  'BOOL',    'true',  NULL, 'COMPANY',
  'POS bills numbered per device', 'POS mode draws from the device series; WHOLESALE from the branch MAIN series.', 70),
 ('sales.multi_order_bill',          'SALES',    'Import',     'BOOL',    'true',  NULL, 'COMPANY',
  'Several orders on one bill', 'Append lines from more than one confirmed order of the SAME customer.', 80),
 ('sales.dc_requires_order',         'SALES',    'Challan',    'BOOL',    'false', NULL, 'COMPANY',
  'A challan must come from an order', 'false: a DC can be raised directly.', 90),
 ('sales.bill_against_dc_reprice',   'SALES',    'Challan',    'TEXT',    'WARN',  '["ALLOW","WARN","REFUSE"]', 'COMPANY',
  'Re-pricing a challan line on the bill', 'The bill may change the DC rate; WARN shows the difference.', 91),
 ('sales.post_scheme_disc_separately','SALES',   'Posting',    'BOOL',    'false', NULL, 'COMPANY',
  'Post scheme discounts to their own ledger', 'false: line and scheme discounts net into Sales (the Tally default). true: DR Scheme Discount Allowed for sb_sch_disc + sb_bill_sch_disc.', 100),
 ('sales.loyalty_redeem_as_tender',  'SALES',    'Loyalty',    'BOOL',    'true',  NULL, 'COMPANY',
  'Loyalty redemption is a tender', 'Tender type 10 LOYALTY, leg DR Loyalty Points Redeemed / CR Party.', 110),
 ('sales.loyalty_auto_enrol',        'SALES',    'Loyalty',    'BOOL',    'true',  NULL, 'COMPANY',
  'Enrol a customer on the first earning bill', 'A customer with no loyalty wallet gets one when a scheme first awards points; the walk-in ledger never earns.', 111),
 ('sales.einvoice_auto_fire',        'SALES',    'GST',        'BOOL',    'true',  NULL, 'BRANCH',
  'Generate the IRN at post', 'When the company and the party make the bill e-invoice applicable, the worker fires at post; the bill is POSTED regardless and the register shows PENDING until the IRN lands.', 120),
 ('sales.eway_auto_fire',            'SALES',    'GST',        'BOOL',    'true',  NULL, 'BRANCH',
  'Generate the e-way bill at post', 'Fires when transport details are complete and the consignment value exceeds EWAY_VALUE_LIMIT for the company/state.', 121),
 ('sales.weight_barcode',            'SALES',    'Entry',      'JSON',    '{"prefix":"2","itemLen":5,"valueLen":5,"valueKind":"WEIGHT","divisor":1000}', NULL, 'BRANCH',
  'Weight / price-embedded barcode', 'EAN-13 from a weighing scale: prefix, item code length, value length, whether the value is WEIGHT or PRICE, divisor.', 130),
 ('sales.delivery_status_tracking',  'SALES',    'Delivery',   'BOOL',    'false', NULL, 'BRANCH',
  'Track delivery status on bills', 'PENDING to PACKED to DISPATCHED to DELIVERED events on the delivery screen.', 140),
 ('sales.require_verification_before_dispatch', 'SALES', 'Delivery', 'BOOL', 'false', NULL, 'BRANCH',
  'Verify a bill before it is packed', 'Delivery events PENDING to VERIFIED to PACKED and on; the verifier needs um_can_post on the delivery menu.', 141),
 ('sales.quick_add_customer',        'SALES',    'Entry',      'BOOL',    'true',  NULL, 'BRANCH',
  'Quick-add a customer from the bill', 'Name + phone + GSTIN; the customer create writes the ledger.', 150),
 ('sales.stock_from_any_godown',     'SALES',    'Stock',      'BOOL',    'false', NULL, 'BRANCH',
  'Take stock from any godown of the branch', 'When the line''s godown is short the engine takes FIFO across the branch''s godowns.', 160)
) AS v(asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order)
ON CONFLICT (asd_key) DO NOTHING;
