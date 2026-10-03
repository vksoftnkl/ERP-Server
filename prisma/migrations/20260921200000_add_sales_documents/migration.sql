-- ═══════════════════════════════════════════════════════════════════════════
--  SALES DOCUMENTS — the tables the six-transaction plan needs and the live
--  database does not have.
--
--   §1  public.transporter_master, public.vehicle_master
--       (sale_bill.sb_vehicle_id exists live with NO referenced table)
--   §2  sales.sale_return / sale_return_item
--   §3  sales.sale_dc / sale_dc_item                (delivery challan)
--   §4  sales.sale_dc_return / sale_dc_return_item
--   §5  public.statutory_limits, public.company_aato,
--       accounts.acc_party_tax_certificate + the shipped law pack
--   §6  ensure_acc_year_partitions restated with the six new tables
--
--  NOT here: loyalty (20260921140000), coupons (20260921160000),
--  promotion_usage (20260921180000) and the GST provider layer
--  (20260921120000) are already deployed.
--
--  ── RULES THIS FILE FOLLOWS ─────────────────────────────────────────────
--   * every transaction table LIST-partitioned by acc_year, PK (id, acc_year)
--   * varchar + CHECK, never an enum
--   * uuidv7 ids generated at the counter; the server never mints a doc id
--   * cancel is a reversal row, never a delete
--   * NULL company on a master row = shared by every company
--
--  ── DEVIATIONS FROM THE SOURCE DESIGN NOTE, AND WHY ─────────────────────
--
--   1. THE UNIT FOREIGN KEY. The note points sri_item_unit_id,
--      sdi_item_unit_id and sdri_item_unit_id at
--      inventory.item_unit_master (unit_id). Every transaction LINE in this
--      database points at inventory.item_unit_conversion (iuc_id) instead —
--      sale_bill_item, sale_order_item, sale_quotation_item and
--      loyalty_gift_redeem_item, without exception.
--
--      This is the dangerous kind of wrong, because item_unit_master DOES
--      exist and the constraint would have been created without complaint.
--      It is a different table with a different id space (22 rows against
--      171). The whole design here is that "a DC line becomes a bill line and
--      a return line reverses one" — so a DC line carrying a unit_id copied
--      into sbi_item_unit_id, which is constrained against iuc_id, is
--      rejected at the counter at the moment of billing. All three now point
--      at item_unit_conversion, like everything else.
--
--   2. PARTITIONS. The note creates a SECOND helper
--      (ensure_sales_doc_partitions) and then leaves a by-hand instruction to
--      add one call to the live public.ensure_acc_year_partitions. A manual
--      step in a deployment is a step that gets skipped, and a second
--      function is a second place to forget a table. The six new tables go
--      straight into ensure_acc_year_partitions, which is where the four
--      preceding migrations put theirs, and existing years are backfilled by
--      reading them off sale_bill's own partitions.
--
--      The note's helper also re-lists promotion_usage, loyalty_ledger and
--      gst_api_log; all three are already in ensure_acc_year_partitions and
--      are not repeated.
--
--   3. NO BEGIN/COMMIT. Prisma wraps a migration file in its own transaction;
--      an explicit COMMIT mid-file ends it early.
--
--   4. ORDERING. The masters come FIRST, so the crew and vehicle foreign keys
--      are declared inline in each CREATE TABLE rather than bolted on
--      afterwards by a dynamic DO block. Same end state, and the whole file
--      becomes re-runnable like every statement in it already was.
--
--   5. FK-COVERING INDEXES are added for the new foreign keys, the house rule
--      the preceding four migrations follow. Without them, re-keying or
--      retiring a master sequentially scans a partitioned transaction table.
--
--  ── A NOTE ON WHAT IS DELIBERATELY ABSENT ───────────────────────────────
--  Transport, ship-to and dispatch are NOT on these documents. They belong to
--  public.txn_transport_detail, keyed by (doc_type, doc_id, acc_year) — that
--  band was 22 columns repeated on four tables and had already drifted. That
--  table is a later file and is not created here; nothing below depends on it.
--
--  The delivery CREW and VEHICLE do stay on the document, on purpose: they
--  exist whenever goods move, even with no consignment at all. A home
--  delivery has a driver and a van and no transporter, no LR and no e-way
--  bill, and forcing a transport row just to record who drove is worse than
--  five columns repeated deliberately.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  §1  TRANSPORTER + VEHICLE MASTERS
--
--  sale_bill.sb_vehicle_id exists live with NO referenced table (confirmed:
--  zero foreign keys on it, and on sb_driver_id / sb_supervisor_id /
--  sb_loadman_id too). The e-way bill needs a transporter id — a GSTIN or a
--  15-character enrolment id — and a vehicle number validated once rather
--  than typed on every document.
--
--  Both are MASTERS: not partitioned, NULL company = shared by every company.
--  Created before the documents so the crew keys can be declared inline.
--
--  NOTE: this migration does NOT add those foreign keys to sales.sale_bill.
--  That table has live rows and its crew columns have never been constrained;
--  pointing them at these masters is a data-cleanup exercise, not a schema
--  one, and belongs in its own migration.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.transporter_master
(
    trn_id                uuid           NOT NULL DEFAULT uuidv7(),
    trn_company_id        uuid,                          -- NULL = every company
    trn_code              character varying(30),
    trn_name              character varying(200) NOT NULL,
    trn_gstin             character varying(15),         -- GSTIN or 15-char enrolment id (TRANSIN)
    trn_is_enrolment_id   boolean        NOT NULL DEFAULT false,
    trn_mode              character varying(10) NOT NULL DEFAULT 'ROAD',
    trn_ledger_id         uuid,                          -- freight payable ledger, optional
    trn_phone             character varying(20),
    trn_email             character varying(150),
    trn_addr              character varying(500),
    trn_place             character varying(100),
    trn_pin               character varying(10),
    trn_state_code        character(2),
    trn_remarks           character varying(250),
    trn_is_active         boolean        NOT NULL DEFAULT true,
    trn_is_deleted        boolean        NOT NULL DEFAULT false,
    trn_sync_date         timestamptz,
    trn_created_on        timestamptz    NOT NULL DEFAULT now(),
    trn_created_by        character varying(50),
    trn_modified_on       timestamptz,
    trn_modified_by       character varying(50),
    CONSTRAINT pk_transporter_master PRIMARY KEY (trn_id),
    CONSTRAINT ck_trn_mode CHECK (trn_mode::text = ANY (ARRAY['ROAD'::text,'RAIL'::text,'AIR'::text,'SHIP'::text])),
    CONSTRAINT ck_trn_gstin_len CHECK (trn_gstin IS NULL OR char_length(trn_gstin) = 15)
);
ALTER TABLE IF EXISTS public.transporter_master OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_trn_name
    ON public.transporter_master USING btree (trn_company_id, lower(trn_name)) NULLS NOT DISTINCT
    WHERE trn_is_deleted = false;

CREATE TABLE IF NOT EXISTS public.vehicle_master
(
    veh_id                uuid           NOT NULL DEFAULT uuidv7(),
    veh_company_id        uuid,
    veh_branch_id         uuid,
    veh_vehicle_no        character varying(20) NOT NULL,   -- as printed on the e-way bill: no spaces, upper
    veh_type              character varying(10) NOT NULL DEFAULT 'REGULAR',   -- REGULAR | ODC
    veh_description       character varying(150),
    veh_capacity_kg       numeric(12,3),
    veh_is_own            boolean        NOT NULL DEFAULT true,
    veh_transporter_id    uuid,
    veh_driver_id         uuid,
    veh_is_active         boolean        NOT NULL DEFAULT true,
    veh_is_deleted        boolean        NOT NULL DEFAULT false,
    veh_sync_date         timestamptz,
    veh_created_on        timestamptz    NOT NULL DEFAULT now(),
    veh_created_by        character varying(50),
    veh_modified_on       timestamptz,
    veh_modified_by       character varying(50),
    CONSTRAINT pk_vehicle_master PRIMARY KEY (veh_id),
    CONSTRAINT fk_veh_transporter FOREIGN KEY (veh_transporter_id)
        REFERENCES public.transporter_master (trn_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_veh_driver FOREIGN KEY (veh_driver_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_veh_type CHECK (veh_type::text = ANY (ARRAY['REGULAR'::text,'ODC'::text])),
    -- The e-way bill wants the number exactly as the portal stores it.
    CONSTRAINT ck_veh_no CHECK (veh_vehicle_no = upper(replace(veh_vehicle_no, ' ', '')))
);
ALTER TABLE IF EXISTS public.vehicle_master OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_veh_no
    ON public.vehicle_master USING btree (veh_company_id, veh_vehicle_no) NULLS NOT DISTINCT
    WHERE veh_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_veh_transporter ON public.vehicle_master USING btree (veh_transporter_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE veh_transporter_id IS NOT NULL AND veh_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_veh_driver ON public.vehicle_master USING btree (veh_driver_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE veh_driver_id IS NOT NULL AND veh_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §2  SALE RETURN — the credit note.
--
--  sr_is_against_bill = false is the FREE return: allowed, flagged, priced at
--  the current selling price, no COGS reversal (there is no cost to reverse),
--  and it is the row every audit report lists first.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sales.sale_return
(
    sr_id                 uuid           NOT NULL DEFAULT uuidv7(),
    sr_company_id         uuid           NOT NULL,
    sr_branch_id          uuid           NOT NULL,
    sr_tenant_id          uuid,
    sr_acc_year           character(9)   NOT NULL,

    sr_session_id         uuid,
    sr_counter_id         uuid           NOT NULL,
    sr_device_type        character varying(20),
    sr_device_id          text,

    -- ── Document identity ────────────────────────────────────────────────
    sr_doc_type           character varying(30) NOT NULL DEFAULT 'CREDIT_NOTE',
    sr_bill_mode          character varying(10) NOT NULL DEFAULT 'WHOLESALE',  -- inherited from the bill
    sr_return_slno        bigint         NOT NULL,
    sr_return_refno       character varying(100) NOT NULL,
    sr_usr_refno          character varying(100),
    sr_usr_refdate        date,
    sr_return_date        date           NOT NULL,
    sr_return_datetime    timestamp(6) with time zone NOT NULL DEFAULT now(),

    -- ── Source invoice ───────────────────────────────────────────────────
    sr_is_against_bill    boolean        NOT NULL DEFAULT true,
    sr_bill_id            uuid,
    sr_bill_acc_year      character(9),
    sr_bill_refno         character varying(100),
    sr_bill_date          date,
    sr_reason_id          uuid,
    sr_return_reason      character varying(250),

    -- ── Customer, snapshotted ────────────────────────────────────────────
    sr_cust_id            uuid NOT NULL,
    sr_cust_name          character varying(200) NOT NULL,
    sr_cust_addr          character varying(500),
    sr_cust_place         character varying(100),
    sr_cust_pin           character varying(10),
    sr_cust_phone         character varying(20),
    sr_cust_gstin         character varying(15),
    sr_cust_gst_type      character varying(20),
    sr_cust_stcd          character(2),
    sr_pos_stcd           character(2),
    sr_state_name         character varying(100),

    sr_price_level        integer,

    sr_user_id            uuid           NOT NULL,
    -- uuid[], like sale_bill / sale_order / sale_dc: a document is credited to
    -- a TEAM. A return inherits its salesmen from the bill it returns, and the
    -- bill already carries an array, so a singular column here silently
    -- dropped the second name. The LINE (sri_salesman_id) stays one person.
    sr_salesman_id        uuid[],

    sr_tot_items          integer        NOT NULL DEFAULT 0,
    sr_tot_weight         numeric(15,3)  NOT NULL DEFAULT 0,

    -- ── Money ────────────────────────────────────────────────────────────
    sr_gross_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sr_disc_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sr_taxable_amt        numeric(15,2)  NOT NULL DEFAULT 0,
    sr_cgst_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sr_sgst_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sr_igst_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sr_cess_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sr_tax_amt            numeric(15,2)  NOT NULL DEFAULT 0,
    sr_other_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sr_round_off          numeric(15,2)  NOT NULL DEFAULT 0,
    sr_return_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sr_total_cost         numeric(15,2)  NOT NULL DEFAULT 0,   -- the COGS reversed (perpetual)

    -- ── Settlement: three modes ──────────────────────────────────────────
    --  CASH     refund now; rows in accounts.acc_tender_detail
    --  ADJUST   against the party's open bills — the ORIGINAL bill first,
    --           then the rest by due date; remainder becomes a credit note
    --  ADVANCE  the whole amount becomes a credit note the party holds
    sr_settle_mode        character varying(10) NOT NULL DEFAULT 'ADJUST',
    sr_refund_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sr_adjusted_amt       numeric(15,2)  NOT NULL DEFAULT 0,
    sr_credit_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sr_settle_status      character varying(20) NOT NULL DEFAULT 'PENDING',

    -- ── Loyalty / promotion claw-back — caches; the detail is the loyalty
    --    ledger and promotion_usage rows this return writes ────────────────
    -- POINTS, so numeric(18,4) like every other points column — not money's
    -- (15,2). This migration owns the column because this migration CREATES
    -- sale_return: the loyalty migration's ALTERs were written against a
    -- sale_return that did not exist, and it deliberately skipped them.
    sr_loyalty_reverse_points numeric(18,4) NOT NULL DEFAULT 0,
    sr_promo_clawback_amt numeric(15,2)  NOT NULL DEFAULT 0,

    -- ── Roll-ups from sales.sale_bill that a credit note reverses ────────
    sr_has_load           boolean NOT NULL DEFAULT false,
    sr_has_unload         boolean NOT NULL DEFAULT false,
    sr_has_freight        boolean NOT NULL DEFAULT false,
    sr_has_promo          boolean NOT NULL DEFAULT false,
    sr_has_loyalty        boolean NOT NULL DEFAULT false,
    sr_agent_id           uuid,
    sr_agent_comm_amt     numeric(15,2),

    -- ── Delivery crew and vehicle — OURS, and on the document on purpose ──
    -- These exist whenever goods move, even with no consignment at all.
    -- Identical on all four goods-moving documents.
    sr_driver_id          uuid,
    sr_supervisor_id      uuid,
    sr_loadman_id         uuid[],                  -- open-ended crew; no FK on array elements
    sr_vehicle_id         uuid,
    sr_vehicle_no         character varying(20),

    sr_tot_bags           numeric(15,3) NOT NULL DEFAULT 0,
    sr_item_disc          numeric(15,2) NOT NULL DEFAULT 0,
    sr_spl_disc           numeric(15,2) NOT NULL DEFAULT 0,
    sr_sch_disc           numeric(15,2) NOT NULL DEFAULT 0,
    sr_bill_sch_disc      numeric(15,2) NOT NULL DEFAULT 0,
    sr_cash_disc          numeric(15,2) NOT NULL DEFAULT 0,
    sr_freight_amt        numeric(15,2) NOT NULL DEFAULT 0,
    sr_load_amt           numeric(15,2) NOT NULL DEFAULT 0,
    sr_unload_amt         numeric(15,2) NOT NULL DEFAULT 0,
    sr_disc_alter_base    boolean,
    sr_round_off_step     numeric(15,2) NOT NULL DEFAULT 1,

    sr_remarks            character varying(500),

    -- ── Lifecycle ────────────────────────────────────────────────────────
    sr_status             character varying(20) NOT NULL DEFAULT 'DRAFT',
    -- WHEN / WHO / WHY a status changed lives in public.txn_status_log, one
    -- appended row per transition. The header keeps only the CURRENT status.
    sr_posted_voucher_id  uuid,                    -- accounts.acc_voucher_header, SERVER-owned
    sr_revision_no        integer NOT NULL DEFAULT 1,
    sr_print_count        integer NOT NULL DEFAULT 0,

    sr_is_deleted         boolean NOT NULL DEFAULT false,
    sr_sync_date          timestamp(6) with time zone,
    sr_created_on         timestamp(6) with time zone NOT NULL DEFAULT now(),
    sr_created_by         character varying(50) NOT NULL,
    sr_modified_on        timestamp(6) with time zone,
    sr_modified_by        character varying(50),

    CONSTRAINT pk_sale_return PRIMARY KEY (sr_id, sr_acc_year),

    CONSTRAINT fk_sr_bill FOREIGN KEY (sr_bill_id, sr_bill_acc_year)
        REFERENCES sales.sale_bill (sb_id, sb_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sr_cust FOREIGN KEY (sr_cust_id)
        REFERENCES sales.customers (cus_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sr_pos_state FOREIGN KEY (sr_pos_stcd)
        REFERENCES fixed.state_codes (state_code) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- NO fk on sr_salesman_id: PostgreSQL cannot put a foreign key on the
    -- ELEMENTS of an array, which is the price of uuid[] and the reason
    -- sale_bill and sale_order have never had one either. The service
    -- validates every id against public.employee_master before it writes.
    -- Do not "fix" this by making the column singular; a company may credit
    -- two salesmen, and a third later.
    CONSTRAINT fk_sr_reason FOREIGN KEY (sr_reason_id)
        REFERENCES stock.stock_reason_master (srm_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sr_driver FOREIGN KEY (sr_driver_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sr_supervisor FOREIGN KEY (sr_supervisor_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sr_vehicle FOREIGN KEY (sr_vehicle_id)
        REFERENCES public.vehicle_master (veh_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_sr_doc_type CHECK (sr_doc_type::text = ANY (ARRAY[
        'CREDIT_NOTE'::text])),
    CONSTRAINT ck_sr_bill_mode CHECK (sr_bill_mode::text = ANY (ARRAY[
        'POS'::text, 'WHOLESALE'::text])),
    CONSTRAINT ck_sr_status CHECK (sr_status::text = ANY (ARRAY[
        'DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])),
    CONSTRAINT ck_sr_settle_mode CHECK (sr_settle_mode::text = ANY (ARRAY[
        'CASH'::text, 'ADJUST'::text, 'ADVANCE'::text])),
    CONSTRAINT ck_sr_settle_status CHECK (sr_settle_status::text = ANY (ARRAY[
        'PENDING'::text, 'REFUNDED'::text, 'ADJUSTED'::text, 'CREDITED'::text, 'PARTIAL'::text])),
    CONSTRAINT ck_sr_against_bill CHECK (
        sr_is_against_bill = false OR
        (sr_bill_id IS NOT NULL AND sr_bill_acc_year IS NOT NULL)),
    CONSTRAINT ck_sr_settle_sum CHECK (
        sr_refund_amt + sr_adjusted_amt + sr_credit_amt <= sr_return_amt + 0.01)
) PARTITION BY LIST (sr_acc_year);

ALTER TABLE IF EXISTS sales.sale_return OWNER to postgres;

CREATE TABLE IF NOT EXISTS sales.sale_return_item
(
    sri_id                uuid           NOT NULL DEFAULT uuidv7(),
    sri_return_id         uuid           NOT NULL,
    sri_company_id        uuid           NOT NULL,
    sri_branch_id         uuid           NOT NULL,
    sri_tenant_id         uuid,
    sri_acc_year          character(9)   NOT NULL,
    sri_line_no           integer        NOT NULL,
    sri_split_no          integer        NOT NULL DEFAULT 1,

    -- ── The bill line this comes back against (NULL on a free return) ────
    sri_bill_item_id      uuid,
    sri_bill_acc_year     character(9),
    sri_bill_line_no      integer,

    sri_item_id           uuid           NOT NULL,
    -- item_unit_CONVERSION, exactly as sale_bill_item.sbi_item_unit_id does.
    -- The design note said item_unit_master; see the file header.
    sri_item_unit_id      uuid           NOT NULL,
    sri_to_base_factor    numeric(15,6)  NOT NULL DEFAULT 0,
    sri_hsn_code          character varying(8),
    sri_tax_id            uuid,

    -- ── Where it goes back, and in what state ────────────────────────────
    sri_godown_id         uuid NOT NULL,
    sri_lot_id            uuid,                       -- the ORIGINAL lot when known
    sri_batch_no          character varying(100),
    sri_batch_date        date,
    sri_expiry_date       date,
    sri_serial_no         character varying(100),
    sri_condition         character varying(20) NOT NULL DEFAULT 'RESTOCK',
    sri_bucket            character varying(20) NOT NULL DEFAULT 'SALEABLE',

    sri_case_qty          numeric(15,3)  NOT NULL DEFAULT 0,
    sri_return_qty        numeric(15,3)  NOT NULL DEFAULT 0,
    sri_free_qty          numeric(15,3)  NOT NULL DEFAULT 0,
    sri_net_qty           numeric(15,3)  NOT NULL DEFAULT 0,
    sri_weight_qty        numeric(15,3)  DEFAULT 0,

    sri_rate              numeric(15,4)  NOT NULL DEFAULT 0,
    sri_rate_pre_tax      numeric(15,4)  NOT NULL DEFAULT 0,
    sri_max_price         numeric(15,4),
    sri_cost_price        numeric(15,4),      -- the bill line's cost: what COGS reverses at
    sri_gross_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sri_disc_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sri_taxable_amt       numeric(15,2)  NOT NULL DEFAULT 0,
    sri_tax_perc          numeric(15,4)  NOT NULL DEFAULT 0,
    sri_cgst_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sri_cgst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sri_sgst_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sri_sgst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sri_igst_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sri_igst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sri_cess_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sri_cess_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sri_tax_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sri_round_off         numeric(15,2)  NOT NULL DEFAULT 0,
    sri_net_amt           numeric(15,2)  NOT NULL DEFAULT 0,

    -- ── Pricing: the essentials of sale_bill_item, tier by tier ──────────
    sri_price_level       integer NOT NULL,
    sri_ean_code          character varying(100),
    sri_is_tax_incl       boolean NOT NULL DEFAULT false,
    sri_is_promo          boolean NOT NULL DEFAULT false,
    sri_is_free           boolean NOT NULL DEFAULT false,
    sri_free_type         character varying(20),
    sri_is_service        boolean NOT NULL DEFAULT false,
    sri_act_price         numeric(15,4),
    sri_min_price         numeric(15,4),
    sri_item_disc_perc    numeric(15,4) NOT NULL DEFAULT 0,
    sri_item_disc_amt     numeric(15,2) NOT NULL DEFAULT 0,
    sri_spl_disc_perc     numeric(15,4) NOT NULL DEFAULT 0,
    sri_spl_disc_amt      numeric(15,2) NOT NULL DEFAULT 0,
    sri_sch_disc_perc     numeric(15,4) NOT NULL DEFAULT 0,
    sri_sch_disc_amt      numeric(15,2) NOT NULL DEFAULT 0,
    sri_bill_sch_amt      numeric(15,2) NOT NULL DEFAULT 0,
    sri_chrg_before_tax   numeric(14,4),
    sri_chrg_after_tax    numeric(14,4),
    sri_cess_per_unit     numeric(15,4) NOT NULL DEFAULT 0,
    sri_salesman_id       uuid,
    sri_scheme_id         uuid,
    sri_scheme_name       character varying(150),
    -- The per-line points the bill awarded, so the claw-back share can be
    -- worked out line by line. Owned here for the same reason as the header's
    -- sr_loyalty_reverse_points.
    sri_loyalty_points    numeric(18,4)  NOT NULL DEFAULT 0,
    sri_size              character varying(50),
    sri_size_uom          character varying(20),

    sri_remarks           character varying(250),

    sri_is_deleted        boolean NOT NULL DEFAULT false,
    sri_sync_date         timestamp(6) with time zone,
    sri_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    sri_created_by        character varying(50) NOT NULL,
    sri_modified_on       timestamp(6) with time zone,
    sri_modified_by       character varying(50),

    CONSTRAINT pk_sale_return_item PRIMARY KEY (sri_id, sri_acc_year),
    CONSTRAINT fk_sri_return FOREIGN KEY (sri_return_id, sri_acc_year)
        REFERENCES sales.sale_return (sr_id, sr_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sri_bill_item FOREIGN KEY (sri_bill_item_id, sri_bill_acc_year)
        REFERENCES sales.sale_bill_item (sbi_id, sbi_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sri_item FOREIGN KEY (sri_item_id)
        REFERENCES inventory.item_master (item_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sri_item_unit FOREIGN KEY (sri_item_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sri_godown FOREIGN KEY (sri_godown_id)
        REFERENCES inventory.godown_locations (gdl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sri_lot FOREIGN KEY (sri_lot_id)
        REFERENCES stock.stock_lot (slt_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_sri_split_no CHECK (sri_split_no >= 1),
    CONSTRAINT ck_sri_condition CHECK (sri_condition::text = ANY (ARRAY[
        'RESTOCK'::text, 'DAMAGED'::text, 'EXPIRED'::text, 'SCRAP'::text])),
    CONSTRAINT ck_sri_bucket CHECK (sri_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text, 'EXPIRED'::text, 'SAMPLE'::text])),
    CONSTRAINT ck_sri_return_qty CHECK (sri_return_qty >= 0 AND sri_free_qty >= 0)
) PARTITION BY LIST (sri_acc_year);

ALTER TABLE IF EXISTS sales.sale_return_item OWNER to postgres;

CREATE INDEX IF NOT EXISTS ix_sr_company_branch_date
    ON sales.sale_return USING btree (sr_company_id, sr_branch_id, sr_return_date DESC)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sr_bill
    ON sales.sale_return USING btree (sr_bill_id, sr_bill_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sr_cust
    ON sales.sale_return USING btree (sr_cust_id, sr_return_date DESC)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sr_refno
    ON sales.sale_return USING btree (sr_company_id, sr_branch_id, sr_acc_year, sr_return_refno);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sr_counter_slno
    ON sales.sale_return USING btree (sr_company_id, sr_branch_id, sr_acc_year, sr_counter_id, sr_return_slno);
-- FK-covering.
CREATE INDEX IF NOT EXISTS ix_sr_pos_state ON sales.sale_return USING btree (sr_pos_stcd)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_pos_stcd IS NOT NULL AND sr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sr_reason ON sales.sale_return USING btree (sr_reason_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_reason_id IS NOT NULL AND sr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sr_driver ON sales.sale_return USING btree (sr_driver_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_driver_id IS NOT NULL AND sr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sr_supervisor ON sales.sale_return USING btree (sr_supervisor_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_supervisor_id IS NOT NULL AND sr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sr_vehicle ON sales.sale_return USING btree (sr_vehicle_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sr_vehicle_id IS NOT NULL AND sr_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_sri_return
    ON sales.sale_return_item USING btree (sri_return_id, sri_acc_year, sri_line_no)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sri_bill_item
    ON sales.sale_return_item USING btree (sri_bill_item_id, sri_bill_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sri_item ON sales.sale_return_item USING btree (sri_item_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sri_item_unit ON sales.sale_return_item USING btree (sri_item_unit_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sri_godown ON sales.sale_return_item USING btree (sri_godown_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sri_lot ON sales.sale_return_item USING btree (sri_lot_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sri_lot_id IS NOT NULL AND sri_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §3  DELIVERY CHALLAN — goods OUT before the invoice.
--
--   * a STOCK document: posting writes DC_ISSUE stock rows and, under
--     PERPETUAL costing, DR COGS / CR INVENTORY at cost;
--   * a GST document with NO tax liability: a doc-register row of type
--     DELIVERY_CHALLAN, an e-way bill when the value says so (rule 138(1)
--     reads the value of the goods, which is why a challan carries prices and
--     GST columns at all), never an IRN;
--   * the SOURCE of a bill: a bill against a DC consumes sdi_billed_qty and
--     posts revenue only, because the stock already left. Many DCs to one
--     bill, one DC to many bills, and mixed DC + direct lines on one bill are
--     all allowed.
--   * its PURPOSE decides its GST reading: SUPPLY converts into a bill; the
--     others may only come back via a DC Return or be converted after the
--     fact.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sales.sale_dc
(
    sdc_id                uuid           NOT NULL DEFAULT uuidv7(),
    sdc_company_id        uuid           NOT NULL,
    sdc_branch_id         uuid           NOT NULL,
    sdc_tenant_id         uuid,
    sdc_acc_year          character(9)   NOT NULL,

    sdc_session_id        uuid,
    sdc_counter_id        uuid           NOT NULL,
    sdc_device_type       character varying(20),
    sdc_device_id         text,

    -- ── Identity ─────────────────────────────────────────────────────────
    sdc_doc_type          character varying(30) NOT NULL DEFAULT 'DELIVERY_CHALLAN',
    sdc_purpose           character varying(20) NOT NULL DEFAULT 'SUPPLY',
    sdc_dc_slno           bigint         NOT NULL,
    sdc_dc_refno          character varying(100) NOT NULL,
    sdc_usr_refno         character varying(100),
    sdc_usr_refdate       date,
    sdc_dc_date           date           NOT NULL,
    sdc_dc_datetime       timestamp(6) with time zone NOT NULL DEFAULT now(),
    sdc_price_level       integer        NOT NULL DEFAULT 1,

    -- ── Source: a sales order (line-level in sale_dc_item) ───────────────
    sdc_src_doc_type      character varying(30),
    sdc_src_doc_id        uuid,
    sdc_src_doc_acc_year  character(9),
    sdc_src_doc_refno     character varying(100),
    sdc_src_doc_date      date,

    -- ── Customer, snapshotted (bill-to) ──────────────────────────────────
    sdc_cust_id           uuid NOT NULL,
    sdc_cust_name         character varying(200) NOT NULL,
    sdc_cust_addr         character varying(500),
    sdc_cust_place        character varying(100),
    sdc_cust_pin          character varying(10),
    sdc_cust_phone        character varying(20),
    sdc_cust_gstin        character varying(15),
    sdc_cust_gst_type     character varying(20),
    sdc_cust_stcd         character(2),
    sdc_pos_stcd          character(2),
    sdc_state_name        character varying(100),

    -- ── Delivery crew and vehicle — OURS, and on the document on purpose ──
    sdc_driver_id         uuid,
    sdc_supervisor_id     uuid,
    sdc_loadman_id        uuid[],
    sdc_vehicle_id        uuid,
    sdc_vehicle_no        character varying(20),

    -- ── People ───────────────────────────────────────────────────────────
    sdc_user_id           uuid           NOT NULL,
    sdc_salesman_id       uuid[],
    sdc_agent_id          uuid,

    -- ── Quantities / money. The prices are for the e-way bill and the print;
    --    NO tax liability is posted from them. ─────────────────────────────
    sdc_tot_items         integer        NOT NULL DEFAULT 0,
    sdc_tot_weight        numeric(15,3)  NOT NULL DEFAULT 0,
    sdc_tot_bags          numeric(15,3)  NOT NULL DEFAULT 0,
    sdc_gross_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_disc_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_taxable_amt       numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_cgst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_sgst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_igst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_cess_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_tax_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_other_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_round_off         numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_dc_amt            numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_total_cost        numeric(15,2)  NOT NULL DEFAULT 0,   -- the COGS posted at DC

    -- ── Fulfilment caches (detail on the lines) ──────────────────────────
    sdc_billed_amt        numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_returned_amt      numeric(15,2)  NOT NULL DEFAULT 0,
    sdc_fulfil_status     character varying(20) NOT NULL DEFAULT 'OPEN',

    -- ── Roll-ups from sales.sale_bill that a challan carries ─────────────
    sdc_has_load          boolean NOT NULL DEFAULT false,
    sdc_has_unload        boolean NOT NULL DEFAULT false,
    sdc_has_freight       boolean NOT NULL DEFAULT false,
    sdc_has_promo         boolean NOT NULL DEFAULT false,
    sdc_packed_id         uuid[],
    sdc_item_disc         numeric(15,2) NOT NULL DEFAULT 0,
    sdc_spl_disc          numeric(15,2) NOT NULL DEFAULT 0,
    sdc_sch_disc          numeric(15,2) NOT NULL DEFAULT 0,
    sdc_freight_amt       numeric(15,2) NOT NULL DEFAULT 0,
    sdc_load_amt          numeric(15,2) NOT NULL DEFAULT 0,
    sdc_unload_amt        numeric(15,2) NOT NULL DEFAULT 0,
    sdc_freight_calc_type character varying(12),
    sdc_loading_calc_type character varying(12),
    sdc_disc_alter_base   boolean,
    sdc_round_off_step    numeric(15,2) NOT NULL DEFAULT 1,

    sdc_payment_terms     character varying(250),
    sdc_delivery_terms    character varying(250),
    sdc_remarks           character varying(500),

    -- ── Lifecycle ────────────────────────────────────────────────────────
    sdc_status            character varying(20) NOT NULL DEFAULT 'DRAFT',
    -- WHEN / WHO / WHY a status changed is NOT here. public.txn_status_log
    -- holds every transition, one row per step, appended and never updated —
    -- which is also the only shape that survives an offline push, because two
    -- devices appending cannot conflict the way two devices UPDATEing one
    -- header row can. The header keeps the CURRENT status for filtering and
    -- the badge, and the voucher link below, which is a relationship and not
    -- an event.
    sdc_posted_voucher_id uuid,                    -- the COGS voucher, SERVER-owned
    sdc_revision_no       integer NOT NULL DEFAULT 1,
    sdc_print_count       integer NOT NULL DEFAULT 0,

    sdc_is_deleted        boolean NOT NULL DEFAULT false,
    sdc_sync_date         timestamp(6) with time zone,
    sdc_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    sdc_created_by        character varying(50) NOT NULL,
    sdc_modified_on       timestamp(6) with time zone,
    sdc_modified_by       character varying(50),

    CONSTRAINT pk_sale_dc PRIMARY KEY (sdc_id, sdc_acc_year),
    CONSTRAINT fk_sdc_cust FOREIGN KEY (sdc_cust_id)
        REFERENCES sales.customers (cus_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdc_pos_state FOREIGN KEY (sdc_pos_stcd)
        REFERENCES fixed.state_codes (state_code) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdc_driver FOREIGN KEY (sdc_driver_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdc_supervisor FOREIGN KEY (sdc_supervisor_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdc_vehicle FOREIGN KEY (sdc_vehicle_id)
        REFERENCES public.vehicle_master (veh_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_sdc_doc_type CHECK (sdc_doc_type::text = ANY (ARRAY[
        'DELIVERY_CHALLAN'::text])),
    CONSTRAINT ck_sdc_purpose CHECK (sdc_purpose::text = ANY (ARRAY[
        'SUPPLY'::text, 'JOB_WORK'::text, 'APPROVAL'::text, 'EXHIBITION'::text,
        'OWN_USE'::text, 'LINE_SALES'::text, 'OTHER'::text])),
    CONSTRAINT ck_sdc_status CHECK (sdc_status::text = ANY (ARRAY[
        'DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text])),
    CONSTRAINT ck_sdc_fulfil_status CHECK (sdc_fulfil_status::text = ANY (ARRAY[
        'OPEN'::text, 'PARTIAL'::text, 'BILLED'::text, 'RETURNED'::text, 'CLOSED'::text]))
) PARTITION BY LIST (sdc_acc_year);

ALTER TABLE IF EXISTS sales.sale_dc OWNER to postgres;

CREATE TABLE IF NOT EXISTS sales.sale_dc_item
(
    sdi_id                uuid           NOT NULL DEFAULT uuidv7(),
    sdi_dc_id             uuid           NOT NULL,
    sdi_company_id        uuid           NOT NULL,
    sdi_branch_id         uuid           NOT NULL,
    sdi_tenant_id         uuid,
    sdi_acc_year          character(9)   NOT NULL,
    sdi_line_no           integer        NOT NULL,
    sdi_split_no          integer        NOT NULL DEFAULT 1,

    -- ── Source order line (partial delivery of an order) ─────────────────
    sdi_src_doc_type      character varying(30),
    sdi_src_doc_id        uuid,
    sdi_src_doc_acc_year  character(9),
    sdi_src_doc_refno     character varying(100),
    sdi_src_line_no       integer,
    sdi_src_item_id       uuid,           -- sale_order_item.soi_id

    sdi_item_id           uuid           NOT NULL,
    -- item_unit_CONVERSION, so the bill line can inherit it unchanged.
    sdi_item_unit_id      uuid           NOT NULL,
    sdi_to_base_factor    numeric(15,6)  NOT NULL DEFAULT 0,
    sdi_hsn_code          character varying(8),
    sdi_tax_id            uuid,
    sdi_price_level       integer,
    sdi_ean_code          character varying(100),
    sdi_size              character varying(50),
    sdi_size_uom          character varying(20),

    -- ── Stock identity: the lot leaves HERE, the bill inherits it ────────
    sdi_godown_id         uuid           NOT NULL,
    sdi_lot_id            uuid,
    sdi_bucket            character varying(20) NOT NULL DEFAULT 'SALEABLE',
    sdi_batch_no          character varying(100),
    sdi_batch_date        date,
    sdi_expiry_date       date,
    sdi_serial_no         character varying(100),

    sdi_is_free           boolean        NOT NULL DEFAULT false,
    sdi_free_type         character varying(20),
    sdi_is_service        boolean        NOT NULL DEFAULT false,

    sdi_case_qty          numeric(15,3)  NOT NULL DEFAULT 0,
    sdi_dc_qty            numeric(15,3)  NOT NULL DEFAULT 0,
    sdi_free_qty          numeric(15,3)  NOT NULL DEFAULT 0,
    sdi_net_qty           numeric(15,3)  NOT NULL DEFAULT 0,
    sdi_weight_qty        numeric(15,3)  DEFAULT 0,

    -- ── Fulfilment, line level (the bill and the DC return write these) ──
    sdi_billed_qty        numeric(15,3)  NOT NULL DEFAULT 0,
    sdi_returned_qty      numeric(15,3)  NOT NULL DEFAULT 0,
    -- GENERATED: the service writes the two inputs and Postgres subtracts.
    -- A whole-row INSERT must leave this out of the column list.
    sdi_open_qty          numeric(15,3)  GENERATED ALWAYS AS (sdi_dc_qty - sdi_billed_qty - sdi_returned_qty) STORED,
    sdi_line_status       character varying(20) NOT NULL DEFAULT 'OPEN',

    -- ── Prices (e-way bill + print; the bill may re-price, with a warning) ─
    sdi_rate              numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_rate_pre_tax      numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_max_price         numeric(15,4),
    sdi_cost_price        numeric(15,4),                     -- resolved lot cost at post: the COGS rate
    sdi_is_tax_incl       boolean        NOT NULL DEFAULT false,
    sdi_disc_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_disc_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_gross_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_taxable_amt       numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_tax_perc          numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_cgst_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_cgst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_sgst_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_sgst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_igst_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_igst_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_cess_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sdi_cess_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_tax_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sdi_net_amt           numeric(15,2)  NOT NULL DEFAULT 0,

    -- ── Pricing: the essentials of sale_bill_item, same name/type/default,
    --    so the bill line inherits them ─────────────────────────────────────
    sdi_is_promo          boolean NOT NULL DEFAULT false,
    sdi_act_price         numeric(15,4),
    sdi_min_price         numeric(15,4),
    sdi_item_disc_perc    numeric(15,4) NOT NULL DEFAULT 0,
    sdi_item_disc_amt     numeric(15,2) NOT NULL DEFAULT 0,
    sdi_spl_disc_perc     numeric(15,4) NOT NULL DEFAULT 0,
    sdi_spl_disc_amt      numeric(15,2) NOT NULL DEFAULT 0,
    sdi_sch_disc_perc     numeric(15,4) NOT NULL DEFAULT 0,
    sdi_sch_disc_amt      numeric(15,2) NOT NULL DEFAULT 0,
    sdi_chrg_before_tax   numeric(14,4),
    sdi_chrg_after_tax    numeric(14,4),
    sdi_cess_per_unit     numeric(15,4) NOT NULL DEFAULT 0,
    sdi_salesman_id       uuid,
    sdi_scheme_id         uuid,
    sdi_scheme_name       character varying(150),

    sdi_remarks           character varying(250),

    sdi_is_deleted        boolean NOT NULL DEFAULT false,
    sdi_sync_date         timestamp(6) with time zone,
    sdi_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    sdi_created_by        character varying(50) NOT NULL,
    sdi_modified_on       timestamp(6) with time zone,
    sdi_modified_by       character varying(50),

    CONSTRAINT pk_sale_dc_item PRIMARY KEY (sdi_id, sdi_acc_year),
    CONSTRAINT fk_sdi_dc FOREIGN KEY (sdi_dc_id, sdi_acc_year)
        REFERENCES sales.sale_dc (sdc_id, sdc_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdi_item FOREIGN KEY (sdi_item_id)
        REFERENCES inventory.item_master (item_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdi_item_unit FOREIGN KEY (sdi_item_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdi_godown FOREIGN KEY (sdi_godown_id)
        REFERENCES inventory.godown_locations (gdl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdi_lot FOREIGN KEY (sdi_lot_id)
        REFERENCES stock.stock_lot (slt_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_sdi_split_no CHECK (sdi_split_no >= 1),
    -- The challan's OWN quantities are typed on this document and may be
    -- guarded. Billed and returned are written by OTHER documents — a bill
    -- and a DC return, either of which may have been raised offline — so
    -- "billed + returned <= dc qty" is not something this row can refuse
    -- without aborting a sync batch for goods that already moved.
    -- sdi_open_qty is allowed to go negative; ix_sdi_overdrawn finds it.
    CONSTRAINT ck_sdi_qty CHECK (sdi_dc_qty >= 0 AND sdi_free_qty >= 0),
    CONSTRAINT ck_sdi_bucket CHECK (sdi_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text, 'EXPIRED'::text, 'SAMPLE'::text])),
    CONSTRAINT ck_sdi_line_status CHECK (sdi_line_status::text = ANY (ARRAY[
        'OPEN'::text, 'PARTIAL'::text, 'BILLED'::text, 'RETURNED'::text, 'CLOSED'::text]))
) PARTITION BY LIST (sdi_acc_year);

ALTER TABLE IF EXISTS sales.sale_dc_item OWNER to postgres;

CREATE INDEX IF NOT EXISTS ix_sdc_company_branch_date
    ON sales.sale_dc USING btree (sdc_company_id, sdc_branch_id, sdc_dc_date DESC)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdc_is_deleted = false;
-- The "what is still out on challan for this customer" lookup, which is what
-- the billing screen asks before it offers DC lines to pull in.
CREATE INDEX IF NOT EXISTS ix_sdc_cust_open
    ON sales.sale_dc USING btree (sdc_cust_id, sdc_fulfil_status)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE sdc_is_deleted = false AND sdc_status = 'POSTED' AND sdc_fulfil_status IN ('OPEN','PARTIAL');
CREATE UNIQUE INDEX IF NOT EXISTS ux_sdc_refno
    ON sales.sale_dc USING btree (sdc_company_id, sdc_branch_id, sdc_acc_year, sdc_dc_refno);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sdc_counter_slno
    ON sales.sale_dc USING btree (sdc_company_id, sdc_branch_id, sdc_acc_year, sdc_counter_id, sdc_dc_slno);
-- FK-covering.
CREATE INDEX IF NOT EXISTS ix_sdc_pos_state ON sales.sale_dc USING btree (sdc_pos_stcd)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdc_pos_stcd IS NOT NULL AND sdc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdc_driver ON sales.sale_dc USING btree (sdc_driver_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdc_driver_id IS NOT NULL AND sdc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdc_supervisor ON sales.sale_dc USING btree (sdc_supervisor_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdc_supervisor_id IS NOT NULL AND sdc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdc_vehicle ON sales.sale_dc USING btree (sdc_vehicle_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdc_vehicle_id IS NOT NULL AND sdc_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_sdi_dc
    ON sales.sale_dc_item USING btree (sdi_dc_id, sdi_acc_year, sdi_line_no)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdi_src_item
    ON sales.sale_dc_item USING btree (sdi_src_item_id, sdi_src_doc_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdi_is_deleted = false AND sdi_src_item_id IS NOT NULL;
-- The billing screen's own read: challan lines with something still open.
CREATE INDEX IF NOT EXISTS ix_sdi_open
    ON sales.sale_dc_item USING btree (sdi_company_id, sdi_item_id)
    INCLUDE (sdi_dc_id, sdi_open_qty, sdi_lot_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE sdi_is_deleted = false AND sdi_open_qty > 0;
-- Reconciliation: a challan line billed and returned past what it carried.
-- Reachable offline (the bill and the DC return are separate documents, and
-- either may sync late), so it is RECORDED rather than refused — this index
-- is what the dropped clause of ck_sdi_qty became.
CREATE INDEX IF NOT EXISTS ix_sdi_overdrawn
    ON sales.sale_dc_item USING btree (sdi_company_id, sdi_branch_id, sdi_dc_id)
    WHERE sdi_is_deleted = false AND sdi_open_qty < 0;
-- FK-covering.
CREATE INDEX IF NOT EXISTS ix_sdi_item ON sales.sale_dc_item USING btree (sdi_item_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdi_item_unit ON sales.sale_dc_item USING btree (sdi_item_unit_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdi_godown ON sales.sale_dc_item USING btree (sdi_godown_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdi_lot ON sales.sale_dc_item USING btree (sdi_lot_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdi_lot_id IS NOT NULL AND sdi_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §4  DELIVERY CHALLAN RETURN — un-billed goods coming back.
--
--  Only the DC's OPEN quantity (sdi_open_qty) may return here; billed goods
--  come back through a Sale Return. Posting writes DC_RETURN stock rows,
--  reverses COGS at the DC line's cost, writes an INWARD challan register row
--  and an e-way bill when the goods travel by a transporter. NO party leg —
--  nothing was ever owed.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sales.sale_dc_return
(
    sdr_id                uuid           NOT NULL DEFAULT uuidv7(),
    sdr_company_id        uuid           NOT NULL,
    sdr_branch_id         uuid           NOT NULL,
    sdr_tenant_id         uuid,
    sdr_acc_year          character(9)   NOT NULL,

    sdr_session_id        uuid,
    sdr_counter_id        uuid           NOT NULL,
    sdr_device_type       character varying(20),
    sdr_device_id         text,

    sdr_doc_type          character varying(30) NOT NULL DEFAULT 'DC_RETURN',
    sdr_return_slno       bigint         NOT NULL,
    sdr_return_refno      character varying(100) NOT NULL,
    sdr_usr_refno         character varying(100),
    sdr_usr_refdate       date,
    sdr_return_date       date           NOT NULL,
    sdr_return_datetime   timestamp(6) with time zone NOT NULL DEFAULT now(),

    -- ── The challan it reverses (ONE challan per DC return) ──────────────
    sdr_dc_id             uuid           NOT NULL,
    sdr_dc_acc_year       character(9)   NOT NULL,
    sdr_dc_refno          character varying(100),
    sdr_dc_date           date,
    sdr_reason_id         uuid,
    sdr_return_reason     character varying(250),

    sdr_cust_id           uuid NOT NULL,
    sdr_cust_name         character varying(200) NOT NULL,
    sdr_cust_gstin        character varying(15),
    sdr_cust_stcd         character(2),
    sdr_pos_stcd          character(2),

    -- ── Delivery crew and vehicle — OURS, and on the document on purpose ──
    sdr_driver_id         uuid,
    sdr_supervisor_id     uuid,
    sdr_loadman_id        uuid[],
    sdr_vehicle_id        uuid,
    sdr_vehicle_no        character varying(20),

    sdr_user_id           uuid           NOT NULL,
    -- The challan this reverses carries sdc_salesman_id, so the return of it
    -- carries the same team — otherwise a delivery and its reversal cannot be
    -- put side by side in any salesman report. uuid[], no FK (array elements).
    sdr_salesman_id       uuid[],

    sdr_tot_items         integer        NOT NULL DEFAULT 0,
    sdr_tot_weight        numeric(15,3)  NOT NULL DEFAULT 0,
    sdr_gross_amt         numeric(15,2)  NOT NULL DEFAULT 0,
    sdr_taxable_amt       numeric(15,2)  NOT NULL DEFAULT 0,
    sdr_tax_amt           numeric(15,2)  NOT NULL DEFAULT 0,
    sdr_return_amt        numeric(15,2)  NOT NULL DEFAULT 0,
    sdr_total_cost        numeric(15,2)  NOT NULL DEFAULT 0,   -- the COGS reversed

    sdr_remarks           character varying(500),

    sdr_status            character varying(20) NOT NULL DEFAULT 'DRAFT',
    -- Transitions live in public.txn_status_log — see sale_dc above.
    sdr_posted_voucher_id uuid,
    sdr_print_count       integer NOT NULL DEFAULT 0,

    sdr_is_deleted        boolean NOT NULL DEFAULT false,
    sdr_sync_date         timestamp(6) with time zone,
    sdr_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    sdr_created_by        character varying(50) NOT NULL,
    sdr_modified_on       timestamp(6) with time zone,
    sdr_modified_by       character varying(50),

    CONSTRAINT pk_sale_dc_return PRIMARY KEY (sdr_id, sdr_acc_year),
    CONSTRAINT fk_sdr_dc FOREIGN KEY (sdr_dc_id, sdr_dc_acc_year)
        REFERENCES sales.sale_dc (sdc_id, sdc_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdr_cust FOREIGN KEY (sdr_cust_id)
        REFERENCES sales.customers (cus_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdr_reason FOREIGN KEY (sdr_reason_id)
        REFERENCES stock.stock_reason_master (srm_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdr_driver FOREIGN KEY (sdr_driver_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdr_supervisor FOREIGN KEY (sdr_supervisor_id)
        REFERENCES public.employee_master (emp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdr_vehicle FOREIGN KEY (sdr_vehicle_id)
        REFERENCES public.vehicle_master (veh_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_sdr_doc_type CHECK (sdr_doc_type::text = ANY (ARRAY['DC_RETURN'::text])),
    CONSTRAINT ck_sdr_status CHECK (sdr_status::text = ANY (ARRAY[
        'DRAFT'::text, 'POSTED'::text, 'CANCELLED'::text]))
) PARTITION BY LIST (sdr_acc_year);

ALTER TABLE IF EXISTS sales.sale_dc_return OWNER to postgres;

CREATE TABLE IF NOT EXISTS sales.sale_dc_return_item
(
    sdri_id               uuid           NOT NULL DEFAULT uuidv7(),
    sdri_return_id        uuid           NOT NULL,
    sdri_company_id       uuid           NOT NULL,
    sdri_branch_id        uuid           NOT NULL,
    sdri_tenant_id        uuid,
    sdri_acc_year         character(9)   NOT NULL,
    sdri_line_no          integer        NOT NULL,

    -- ── The DC line (mandatory — a DC return is never free) ──────────────
    sdri_dc_item_id       uuid           NOT NULL,
    sdri_dc_acc_year      character(9)   NOT NULL,
    sdri_dc_line_no       integer,

    sdri_item_id          uuid           NOT NULL,
    -- item_unit_CONVERSION, matching the DC line it reverses.
    sdri_item_unit_id     uuid           NOT NULL,
    sdri_to_base_factor   numeric(15,6)  NOT NULL DEFAULT 0,
    sdri_hsn_code         character varying(8),

    sdri_godown_id        uuid           NOT NULL,
    sdri_lot_id           uuid,                       -- the DC line's lot: it goes back where it came from
    sdri_condition        character varying(20) NOT NULL DEFAULT 'RESTOCK',
    sdri_bucket           character varying(20) NOT NULL DEFAULT 'SALEABLE',
    sdri_batch_no         character varying(100),
    sdri_expiry_date      date,
    sdri_serial_no        character varying(100),

    sdri_return_qty       numeric(15,3)  NOT NULL DEFAULT 0,
    sdri_free_qty         numeric(15,3)  NOT NULL DEFAULT 0,
    sdri_net_qty          numeric(15,3)  NOT NULL DEFAULT 0,
    sdri_weight_qty       numeric(15,3)  DEFAULT 0,

    sdri_rate             numeric(15,4)  NOT NULL DEFAULT 0,
    sdri_cost_price       numeric(15,4),              -- the DC line's cost: what COGS reverses at
    sdri_taxable_amt      numeric(15,2)  NOT NULL DEFAULT 0,
    sdri_tax_perc         numeric(15,4)  NOT NULL DEFAULT 0,
    sdri_tax_amt          numeric(15,2)  NOT NULL DEFAULT 0,
    sdri_net_amt          numeric(15,2)  NOT NULL DEFAULT 0,

    -- ── Value of the goods coming back (inward e-way bill) ───────────────
    sdri_price_level      integer NOT NULL,
    sdri_ean_code         character varying(100),
    sdri_is_tax_incl      boolean NOT NULL DEFAULT false,
    sdri_is_service       boolean NOT NULL DEFAULT false,
    sdri_rate_pre_tax     numeric(15,4) NOT NULL DEFAULT 0,
    sdri_max_price        numeric(15,4),
    sdri_item_disc_perc   numeric(15,4) NOT NULL DEFAULT 0,
    sdri_item_disc_amt    numeric(15,2) NOT NULL DEFAULT 0,
    sdri_sch_disc_amt     numeric(15,2) NOT NULL DEFAULT 0,
    sdri_gross_amt        numeric(15,2) NOT NULL DEFAULT 0,
    sdri_cgst_perc        numeric(15,4) NOT NULL DEFAULT 0,
    sdri_cgst_amt         numeric(15,2) NOT NULL DEFAULT 0,
    sdri_sgst_perc        numeric(15,4) NOT NULL DEFAULT 0,
    sdri_sgst_amt         numeric(15,2) NOT NULL DEFAULT 0,
    sdri_igst_perc        numeric(15,4) NOT NULL DEFAULT 0,
    sdri_igst_amt         numeric(15,2) NOT NULL DEFAULT 0,
    sdri_cess_perc        numeric(15,4) NOT NULL DEFAULT 0,
    sdri_cess_per_unit    numeric(15,4) NOT NULL DEFAULT 0,
    sdri_cess_amt         numeric(15,2) NOT NULL DEFAULT 0,
    sdri_size             character varying(50),
    sdri_size_uom         character varying(20),
    sdri_tax_id           uuid,

    sdri_remarks          character varying(250),

    sdri_is_deleted       boolean NOT NULL DEFAULT false,
    sdri_sync_date        timestamp(6) with time zone,
    sdri_created_on       timestamp(6) with time zone NOT NULL DEFAULT now(),
    sdri_created_by       character varying(50) NOT NULL,
    sdri_modified_on      timestamp(6) with time zone,
    sdri_modified_by      character varying(50),

    CONSTRAINT pk_sale_dc_return_item PRIMARY KEY (sdri_id, sdri_acc_year),
    CONSTRAINT fk_sdri_return FOREIGN KEY (sdri_return_id, sdri_acc_year)
        REFERENCES sales.sale_dc_return (sdr_id, sdr_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdri_dc_item FOREIGN KEY (sdri_dc_item_id, sdri_dc_acc_year)
        REFERENCES sales.sale_dc_item (sdi_id, sdi_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdri_item FOREIGN KEY (sdri_item_id)
        REFERENCES inventory.item_master (item_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdri_item_unit FOREIGN KEY (sdri_item_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdri_godown FOREIGN KEY (sdri_godown_id)
        REFERENCES inventory.godown_locations (gdl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sdri_lot FOREIGN KEY (sdri_lot_id)
        REFERENCES stock.stock_lot (slt_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_sdri_qty CHECK (sdri_return_qty >= 0 AND sdri_free_qty >= 0),
    CONSTRAINT ck_sdri_condition CHECK (sdri_condition::text = ANY (ARRAY[
        'RESTOCK'::text, 'DAMAGED'::text, 'EXPIRED'::text, 'SCRAP'::text])),
    CONSTRAINT ck_sdri_bucket CHECK (sdri_bucket::text = ANY (ARRAY[
        'SALEABLE'::text, 'DAMAGED'::text, 'QUARANTINE'::text, 'EXPIRED'::text, 'SAMPLE'::text]))
) PARTITION BY LIST (sdri_acc_year);

ALTER TABLE IF EXISTS sales.sale_dc_return_item OWNER to postgres;

CREATE INDEX IF NOT EXISTS ix_sdr_dc
    ON sales.sale_dc_return USING btree (sdr_dc_id, sdr_dc_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdr_company_branch_date
    ON sales.sale_dc_return USING btree (sdr_company_id, sdr_branch_id, sdr_return_date DESC)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdr_is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sdr_refno
    ON sales.sale_dc_return USING btree (sdr_company_id, sdr_branch_id, sdr_acc_year, sdr_return_refno);
-- FK-covering.
CREATE INDEX IF NOT EXISTS ix_sdr_cust ON sales.sale_dc_return USING btree (sdr_cust_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdr_reason ON sales.sale_dc_return USING btree (sdr_reason_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdr_reason_id IS NOT NULL AND sdr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdr_driver ON sales.sale_dc_return USING btree (sdr_driver_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdr_driver_id IS NOT NULL AND sdr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdr_supervisor ON sales.sale_dc_return USING btree (sdr_supervisor_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdr_supervisor_id IS NOT NULL AND sdr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdr_vehicle ON sales.sale_dc_return USING btree (sdr_vehicle_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdr_vehicle_id IS NOT NULL AND sdr_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_sdri_return
    ON sales.sale_dc_return_item USING btree (sdri_return_id, sdri_acc_year, sdri_line_no)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdri_dc_item
    ON sales.sale_dc_return_item USING btree (sdri_dc_item_id, sdri_dc_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdri_is_deleted = false;
-- FK-covering.
CREATE INDEX IF NOT EXISTS ix_sdri_item ON sales.sale_dc_return_item USING btree (sdri_item_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdri_item_unit ON sales.sale_dc_return_item USING btree (sdri_item_unit_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdri_godown ON sales.sale_dc_return_item USING btree (sdri_godown_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_sdri_lot ON sales.sale_dc_return_item USING btree (sdri_lot_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE sdri_lot_id IS NOT NULL AND sdri_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §5  THE LAW, PER COMPANY, ON A DATE.
--
--  Nothing in code holds a rupee figure or a date from an Act. Every guard
--  reads StatutoryService.limit(...).
--
--   L0  applicability            -> companys.comp_* flags (+ comp_aato_class,
--                                   which a later migration adds)
--   L1  the figure               -> public.statutory_limits: shipped pack rows
--                                   (stl_company_id NULL) and company
--                                   overrides, each with an effective window
--   L2  the party's certificate  -> accounts.acc_party_tax_certificate
--   L3  the stamp                -> the document row itself — never re-derived
--
--  ── THE RESOLVER IS NOT A DATABASE FUNCTION. ────────────────────────────
--  StatutoryService.limit() in NestJS owns it. It is a read, so it is not
--  dangerous the way a trigger is — but it is the ONE piece of law the
--  OFFLINE TILL must also apply, by itself, with no server in reach: the cash
--  limit under 269ST, the PAN / Form 60 threshold, the e-way bill floor. The
--  till has to answer those while disconnected, so the resolution order has to
--  exist in TypeScript no matter what. A second copy in plpgsql means two
--  implementations of one statute, drifting, with the server silently
--  overruling what the counter told the customer.
--
--  limit(companyId, code, onDate, appliesTo = 'ALL', aatoClass = null)
--    -> the single best row, or null (and "null" means NOT APPLICABLE, which
--       the guard must say out loud rather than defaulting to a number).
--
--  FILTER  stl_code = code
--      AND NOT stl_is_deleted AND stl_is_active
--      AND (stl_company_id IS NULL OR stl_company_id = companyId)
--      AND (stl_applies_to = 'ALL' OR stl_applies_to = appliesTo)
--      AND (stl_aato_class IS NULL OR stl_aato_class = aatoClass)
--      AND stl_effective_from <= onDate
--      AND (stl_effective_to IS NULL OR stl_effective_to >= onDate)
--
--  ORDER BY — and this precedence IS the rule, so keep it exactly:
--      1  stl_company_id IS NOT NULL  DESC   -- a company override beats the pack
--      2  stl_applies_to <> 'ALL'     DESC   -- a specific applies_to beats ALL
--      3  stl_aato_class IS NOT NULL  DESC   -- a turnover-class row beats any-class
--      4  stl_effective_from          DESC   -- the latest in force on that date
--     LIMIT 1
--
--  Cache per REQUEST, never per process: stl_effective_from means the answer
--  changes with the DOCUMENT's date, not with today's.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.statutory_limits
(
    stl_id                uuid           NOT NULL DEFAULT uuidv7(),
    stl_company_id        uuid,                          -- NULL = shipped pack, every company
    stl_code              character varying(40) NOT NULL,
    stl_law               character varying(10) NOT NULL,        -- GST | IT | COMPANIES | OTHER
    stl_section           character varying(40),                 -- '269ST', '206C(1H)', 'R138(1)', ...
    stl_label             character varying(200) NOT NULL,
    stl_value_type        character varying(10) NOT NULL,        -- AMOUNT | PERCENT | DAYS | HOURS | KM | BOOL | TEXT
    stl_value             numeric(18,4),
    stl_value_text        character varying(100),
    stl_applies_to        character varying(20) NOT NULL DEFAULT 'ALL',   -- ALL | INTRA_STATE | INTER_STATE | B2B | B2C | state code
    stl_aato_class        character varying(10),                 -- NULL = any; else LE_1_5CR | LE_5CR | LE_10CR | GT_10CR
    stl_effective_from    date           NOT NULL,
    stl_effective_to      date,                                  -- NULL = still in force
    stl_enforce           character varying(10) NOT NULL DEFAULT 'WARN',   -- WARN | REFUSE | INFO
    stl_source_ref        character varying(250),                -- notification / Finance Act citation
    stl_remarks           character varying(250),
    stl_is_active         boolean        NOT NULL DEFAULT true,
    stl_is_deleted        boolean        NOT NULL DEFAULT false,
    stl_sync_date         timestamptz,
    stl_created_on        timestamptz    NOT NULL DEFAULT now(),
    stl_created_by        character varying(50),
    stl_modified_on       timestamptz,
    stl_modified_by       character varying(50),
    CONSTRAINT pk_statutory_limits PRIMARY KEY (stl_id),
    CONSTRAINT ck_stl_law CHECK (stl_law::text = ANY (ARRAY['GST'::text,'IT'::text,'COMPANIES'::text,'OTHER'::text])),
    CONSTRAINT ck_stl_value_type CHECK (stl_value_type::text = ANY (ARRAY[
        'AMOUNT'::text,'PERCENT'::text,'DAYS'::text,'HOURS'::text,'KM'::text,'BOOL'::text,'TEXT'::text])),
    CONSTRAINT ck_stl_enforce CHECK (stl_enforce::text = ANY (ARRAY['WARN'::text,'REFUSE'::text,'INFO'::text])),
    CONSTRAINT ck_stl_window CHECK (stl_effective_to IS NULL OR stl_effective_to >= stl_effective_from)
);
ALTER TABLE IF EXISTS public.statutory_limits OWNER to postgres;

CREATE INDEX IF NOT EXISTS ix_stl_lookup
    ON public.statutory_limits USING btree (stl_code, stl_company_id, stl_applies_to, stl_effective_from DESC)
    WITH (fillfactor=100, deduplicate_items=True) WHERE stl_is_deleted = false AND stl_is_active = true;
-- One row per (code, company, applies_to, class, from) — which is what makes
-- the shipped pack below re-runnable.
CREATE UNIQUE INDEX IF NOT EXISTS ux_stl_row
    ON public.statutory_limits USING btree (stl_code, stl_company_id, stl_applies_to, stl_aato_class, stl_effective_from)
    NULLS NOT DISTINCT WHERE stl_is_deleted = false;

-- Aggregate annual turnover per company per FY: the figure e-invoice
-- applicability and the AATO class read. Kept by the year-end job and
-- editable by the accountant — a figure somebody signs, not a running total.
CREATE TABLE IF NOT EXISTS public.company_aato
(
    caa_id                uuid           NOT NULL DEFAULT uuidv7(),
    caa_company_id        uuid           NOT NULL,
    caa_fin_year          character(9)   NOT NULL,       -- the year the turnover BELONGS to
    caa_aato_amount       numeric(18,2)  NOT NULL DEFAULT 0,
    caa_source            character varying(10) NOT NULL DEFAULT 'COMPUTED',   -- COMPUTED | DECLARED
    caa_declared_by       character varying(50),
    caa_declared_on       date,
    caa_remarks           character varying(250),
    caa_is_deleted        boolean        NOT NULL DEFAULT false,
    caa_created_on        timestamptz    NOT NULL DEFAULT now(),
    caa_created_by        character varying(50),
    caa_modified_on       timestamptz,
    caa_modified_by       character varying(50),
    CONSTRAINT pk_company_aato PRIMARY KEY (caa_id),
    CONSTRAINT ux_company_aato UNIQUE (caa_company_id, caa_fin_year),
    CONSTRAINT fk_caa_company FOREIGN KEY (caa_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_caa_source CHECK (caa_source::text = ANY (ARRAY['COMPUTED'::text,'DECLARED'::text])),
    CONSTRAINT ck_caa_fin_year CHECK (
        caa_fin_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(caa_fin_year, 4)::int = LEFT(caa_fin_year, 4)::int + 1)
);
ALTER TABLE IF EXISTS public.company_aato OWNER to postgres;

-- The party's paper: what the party has shown us that changes a rate or a
-- refusal. One row per certificate, windowed. Read by the TDS/TCS rate
-- resolver and by the PAN / Form-60 guard on a large cash sale.
CREATE TABLE IF NOT EXISTS accounts.acc_party_tax_certificate
(
    ptc_id                uuid           NOT NULL DEFAULT uuidv7(),
    ptc_company_id        uuid           NOT NULL,
    ptc_party_id          uuid           NOT NULL,        -- accounts.acc_ledger_master
    ptc_kind              character varying(20) NOT NULL, -- PAN | FORM60 | LDC_197 | NO_DEDUCTION_206C | LUT | COMPOSITION | TAN
    ptc_number            character varying(50),
    ptc_rate_perc         numeric(6,3),                   -- for LDC: the lower rate certified
    ptc_limit_amount      numeric(18,2),                  -- for LDC: the certified ceiling
    ptc_issued_on         date,
    ptc_valid_from        date           NOT NULL,
    ptc_valid_to          date,
    ptc_verified_on       date,
    ptc_verified_by       character varying(50),
    ptc_file_ref          character varying(250),
    ptc_remarks           character varying(250),
    ptc_is_active         boolean        NOT NULL DEFAULT true,
    ptc_is_deleted        boolean        NOT NULL DEFAULT false,
    ptc_sync_date         timestamptz,
    ptc_created_on        timestamptz    NOT NULL DEFAULT now(),
    ptc_created_by        character varying(50),
    ptc_modified_on       timestamptz,
    ptc_modified_by       character varying(50),
    CONSTRAINT pk_acc_party_tax_certificate PRIMARY KEY (ptc_id),
    CONSTRAINT fk_ptc_party FOREIGN KEY (ptc_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptc_company FOREIGN KEY (ptc_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_ptc_kind CHECK (ptc_kind::text = ANY (ARRAY[
        'PAN'::text,'FORM60'::text,'LDC_197'::text,'NO_DEDUCTION_206C'::text,'LUT'::text,'COMPOSITION'::text,'TAN'::text])),
    CONSTRAINT ck_ptc_window CHECK (ptc_valid_to IS NULL OR ptc_valid_to >= ptc_valid_from)
);
ALTER TABLE IF EXISTS accounts.acc_party_tax_certificate OWNER to postgres;

CREATE INDEX IF NOT EXISTS ix_ptc_party_kind
    ON accounts.acc_party_tax_certificate USING btree (ptc_company_id, ptc_party_id, ptc_kind, ptc_valid_from DESC)
    WITH (fillfactor=100, deduplicate_items=True) WHERE ptc_is_deleted = false AND ptc_is_active = true;

-- FK-covering. ix_ptc_party_kind LEADS on the company, so it does not cover
-- fk_ptc_party — retiring a ledger would seq-scan this table looking for
-- certificates.
CREATE INDEX IF NOT EXISTS ix_ptc_party ON accounts.acc_party_tax_certificate USING btree (ptc_party_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE ptc_is_deleted = false;

-- ── The shipped pack: every figure a sales document reads today ──────────
--  stl_company_id NULL. A company that differs adds ITS row; it never edits
--  these. The 206C(1H) rows are CLOSED (removed by Finance Act 2025 w.e.f.
--  2025-04-01) and kept so a bill dated before that still resolves.
INSERT INTO public.statutory_limits
    (stl_code, stl_law, stl_section, stl_label, stl_value_type, stl_value, stl_value_text,
     stl_applies_to, stl_aato_class, stl_effective_from, stl_effective_to, stl_enforce, stl_source_ref)
VALUES
 ('CASH_TXN_LIMIT_269ST',   'IT',  '269ST',    'Cash received from one person in a day / per transaction / per event',
                            'AMOUNT', 200000, NULL, 'ALL', NULL, '2017-04-01', NULL, 'REFUSE', 'Finance Act 2017, s.269ST'),
 ('PAN_REQUIRED_CASH_SALE', 'IT',  'R114B',    'PAN (or Form 60) required on a cash sale above this',
                            'AMOUNT', 200000, NULL, 'ALL', NULL, '2016-01-01', NULL, 'REFUSE', 'Rule 114B, Sl.18'),
 ('TCS_206C1H_THRESHOLD',   'IT',  '206C(1H)', 'TCS on sale of goods — receipts above this from one buyer in the FY',
                            'AMOUNT', 5000000, NULL, 'ALL', NULL, '2020-10-01', '2025-03-31', 'INFO', 'Removed by Finance Act 2025 w.e.f. 2025-04-01'),
 ('TCS_206C1H_RATE',        'IT',  '206C(1H)', 'TCS rate on sale of goods',
                            'PERCENT', 0.1, NULL, 'ALL', NULL, '2020-10-01', '2025-03-31', 'INFO', 'Removed by Finance Act 2025'),
 ('EWAY_VALUE_LIMIT',       'GST', 'R138(1)',  'E-way bill required when consignment value exceeds this (inter-state)',
                            'AMOUNT', 50000, NULL, 'INTER_STATE', NULL, '2018-04-01', NULL, 'REFUSE', 'CGST Rules, r.138(1)'),
 ('EWAY_VALUE_LIMIT',       'GST', 'R138(1)',  'E-way bill required when consignment value exceeds this (intra-state, default)',
                            'AMOUNT', 50000, NULL, 'INTRA_STATE', NULL, '2018-04-01', NULL, 'REFUSE', 'State notifications vary — override per company/state'),
 ('EWAY_VALUE_LIMIT',       'GST', 'R138(1)',  'E-way bill intra-state — Tamil Nadu',
                            'AMOUNT', 100000, NULL, '33', NULL, '2018-06-02', NULL, 'REFUSE', 'TN Notification 9/2018'),
 ('EWAY_VALIDITY_KM_PER_DAY','GST','R138(10)', 'E-way bill validity: one day per this many km (regular cargo)',
                            'KM', 200, NULL, 'ALL', NULL, '2021-01-01', NULL, 'INFO', 'Notification 94/2020'),
 ('EWAY_ODC_KM_PER_DAY',    'GST', 'R138(10)', 'E-way bill validity: one day per this many km (over-dimensional cargo)',
                            'KM', 20, NULL, 'ALL', NULL, '2018-04-01', NULL, 'INFO', 'CGST Rules, r.138(10)'),
 ('EWAY_CANCEL_HOURS',      'GST', 'R138(9)',  'E-way bill may be cancelled within this many hours of generation',
                            'HOURS', 24, NULL, 'ALL', NULL, '2018-04-01', NULL, 'REFUSE', 'CGST Rules, r.138(9)'),
 ('EINV_CANCEL_HOURS',      'GST', 'R48(4)',   'IRN may be cancelled within this many hours of generation',
                            'HOURS', 24, NULL, 'ALL', NULL, '2020-10-01', NULL, 'REFUSE', 'IRP terms'),
 ('EINV_AATO_THRESHOLD',    'GST', 'R48(4)',   'E-invoicing mandatory when AATO in any FY from 2017-18 exceeds this',
                            'AMOUNT', 50000000, NULL, 'ALL', NULL, '2023-08-01', NULL, 'REFUSE', 'Notification 10/2023-CT'),
 ('EINV_REPORT_DAYS',       'GST', 'IRP',      'IRN must be reported within this many days of the invoice date (AATO >= 10 cr)',
                            'DAYS', 30, NULL, 'ALL', 'GT_10CR', '2025-04-01', NULL, 'WARN', 'GSTN advisory 2024-09'),
 ('HSN_DIGITS',             'GST', 'R46',      'HSN digits on an invoice (AATO up to 5 cr)',
                            'TEXT', NULL, '4', 'ALL', 'LE_1_5CR', '2021-04-01', NULL, 'WARN', 'Notification 78/2020-CT'),
 ('HSN_DIGITS',             'GST', 'R46',      'HSN digits on an invoice (AATO up to 5 cr)',
                            'TEXT', NULL, '4', 'ALL', 'LE_5CR', '2021-04-01', NULL, 'WARN', 'Notification 78/2020-CT'),
 ('HSN_DIGITS',             'GST', 'R46',      'HSN digits on an invoice (AATO above 5 cr)',
                            'TEXT', NULL, '6', 'ALL', 'LE_10CR', '2021-04-01', NULL, 'WARN', 'Notification 78/2020-CT'),
 ('HSN_DIGITS',             'GST', 'R46',      'HSN digits on an invoice (AATO above 5 cr)',
                            'TEXT', NULL, '6', 'ALL', 'GT_10CR', '2021-04-01', NULL, 'WARN', 'Notification 78/2020-CT'),
 ('CREDIT_NOTE_CUTOFF',     'GST', 's34(2)',   'Credit note for an FY must be declared by 30 Nov of the next FY (or the annual return, if earlier)',
                            'TEXT', NULL, '11-30', 'ALL', NULL, '2022-10-01', NULL, 'WARN', 'Finance Act 2022, s.34(2)'),
 ('DC_RETURN_WINDOW_DAYS',  'GST', 's143',     'Goods sent on approval / job work must return or be invoiced within this many days',
                            'DAYS', 180, NULL, 'ALL', NULL, '2017-07-01', NULL, 'WARN', 'CGST Act s.31(7) six months; s.143 one year for job work — override per purpose')
ON CONFLICT (stl_code, stl_company_id, stl_applies_to, stl_aato_class, stl_effective_from)
    WHERE stl_is_deleted = false DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
--  Comments
-- ═══════════════════════════════════════════════════════════════════════════
COMMENT ON TABLE sales.sale_dc IS
    'Delivery challan: goods OUT before the invoice. A stock document and a GST document with NO tax liability — it carries prices and GST columns only because rule 138(1) reads the VALUE of the goods for the e-way bill. Never an IRN. Its purpose decides its GST reading: SUPPLY converts into a bill, the rest come back via a DC return or are converted after the fact.';
COMMENT ON COLUMN sales.sale_dc_item.sdi_open_qty IS
    'GENERATED: dc_qty - billed_qty - returned_qty. Allowed to go negative — billed and returned are written by OTHER documents that may sync late, so an over-draw is RECORDED (ix_sdi_overdrawn) rather than refused. A whole-row INSERT must omit this column.';
COMMENT ON COLUMN sales.sale_dc_item.sdi_item_unit_id IS
    'inventory.item_unit_conversion(iuc_id), exactly as sale_bill_item.sbi_item_unit_id — the bill line inherits this value unchanged, so the two must share an id space.';
COMMENT ON TABLE sales.sale_return IS
    'The credit note. sr_is_against_bill = false is the FREE return: allowed, flagged, priced at the current selling price, no COGS reversal, and the row every audit report lists first.';
COMMENT ON COLUMN sales.sale_return.sr_loyalty_reverse_points IS
    'POINTS, numeric(18,4) like every other points column — not money''s (15,2). A cache; the detail is the loyalty_ledger rows this return writes.';
COMMENT ON COLUMN sales.sale_return.sr_salesman_id IS
    'uuid[]: a document is credited to a TEAM, and a return inherits its salesmen from the bill. PostgreSQL cannot FK the elements of an array, so the service validates each id against employee_master. Do not make this singular.';
COMMENT ON TABLE sales.sale_dc_return IS
    'Un-billed goods coming back off a challan. Only the DC''s OPEN quantity may return here; billed goods come back through a sale return. No party leg — nothing was ever owed.';
COMMENT ON TABLE public.statutory_limits IS
    'Every rupee figure, percentage, day count and hour count that comes from an Act, per company, with an effective window. Nothing in code may hard-code one of these, and nothing may read this table without a DATE. The RESOLVER is StatutoryService.limit() in NestJS, not a database function: the offline till must apply the same law with no server in reach, and two implementations of one statute would drift.';
COMMENT ON COLUMN public.statutory_limits.stl_company_id IS
    'NULL = the shipped pack, applying to every company. A company that differs adds its OWN row; it never edits a pack row. A company row outranks the pack in the resolver.';
COMMENT ON TABLE public.transporter_master IS
    'The transporter on an e-way bill: a GSTIN or a 15-character enrolment id (TRANSIN). NULL company = shared by every company.';
COMMENT ON TABLE public.vehicle_master IS
    'Vehicle numbers validated once rather than typed on every document. ck_veh_no keeps the number in the form the e-way bill portal stores it: upper case, no spaces.';


-- ═══════════════════════════════════════════════════════════════════════════
--  §6  Partitions.
--
--  The six new transaction tables go into public.ensure_acc_year_partitions —
--  the function the April 1st ritual actually calls — rather than into a
--  second helper with a by-hand instruction to wire it up. Parent BEFORE
--  child in every case: sale_dc before sale_dc_item (fk_sdi_dc), sale_return
--  before sale_return_item, sale_dc_return before its item, and sale_dc
--  before sale_dc_return (fk_sdr_dc).
--
--  Re-stated in full because that is how every earlier migration has extended
--  it; the body is 20260921180000's, plus six EXECUTEs.
-- ═══════════════════════════════════════════════════════════════════════════
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

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

-- Catch the six new tables up with the years that already have partitions,
-- read off sale_bill's own — the documents below all hang off a bill's year.
DO $backfill$
DECLARE
    v_year text;
    v_tbl  text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT replace(substring(c.relname from '([0-9]{4}_[0-9]{4})$'), '_', '-')
          FROM pg_class c
          JOIN pg_inherits i ON i.inhrelid  = c.oid
          JOIN pg_class    p ON p.oid       = i.inhparent
         WHERE p.relname = 'sale_bill'
           AND c.relname ~ '[0-9]{4}_[0-9]{4}$'
         ORDER BY 1
    LOOP
        FOREACH v_tbl IN ARRAY ARRAY['sale_return', 'sale_return_item',
                                     'sale_dc', 'sale_dc_item',
                                     'sale_dc_return', 'sale_dc_return_item'] LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.%I FOR VALUES IN (%L)',
                v_tbl || '_' || replace(v_year, '-', '_'), v_tbl, v_year);
        END LOOP;
        RAISE NOTICE 'sales document partitions ensured for %', v_year;
    END LOOP;
END
$backfill$;
