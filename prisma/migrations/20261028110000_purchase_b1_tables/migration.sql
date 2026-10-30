-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase B1 — the purchase schema (plan-purchase-backend.md §2, addenda 1–2)
--  House rules: every document table LIST-partitioned by acc_year, PK (id, year),
--  uuidv7; per-device serial (UNIQUE company+branch+year+device+slno); no UNIQUE /
--  CHECK over anything two offline branches can both create (the supplier's
--  invoice no is NOT unique — R1); open / pending / status of shortages, claims
--  and PO lines are DERIVED from referencing rows (lines carry src_doc_type / src_doc_id / src_doc_year / src_item_id — the sales pattern; no link table), never stored counters; sync triggers via
--  public.sync_install_triggers(). Additive: new tables + new nullable columns.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · masters ─────────────────────────────────────────────────────────
CREATE TABLE purchase.pur_supplier_item (
    psi_id uuid NOT NULL,
    psi_company_id uuid,
    psi_supplier_id uuid NOT NULL,
    psi_item_id uuid NOT NULL,
    psi_supplier_item_code character varying(60),
    psi_supplier_barcode character varying(60),
    psi_buy_uom_id uuid,
    psi_pack_qty numeric(18,6) DEFAULT 1 NOT NULL,
    psi_moq numeric(18,6),
    psi_lead_days smallint,
    psi_is_preferred boolean DEFAULT false NOT NULL,
    psi_source character varying(10) DEFAULT 'TYPED'::character varying NOT NULL,
    psi_is_active boolean DEFAULT true NOT NULL,
    psi_is_deleted boolean DEFAULT false NOT NULL,
    psi_sync_date timestamp(6) with time zone,
    psi_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    psi_created_by character varying(50) NOT NULL,
    psi_modified_on timestamp(6) with time zone,
    psi_modified_by character varying(50),
    CONSTRAINT ck_psi_source CHECK (psi_source IN ('TYPED', 'AUTO'))
);
ALTER TABLE purchase.pur_supplier_item ADD CONSTRAINT pk_pur_supplier_item PRIMARY KEY (psi_id);
COMMENT ON TABLE purchase.pur_supplier_item IS 'Who sells us what, in which pack, under which code. Id = uuid v5(company, supplier, item). Last rate / date / bill count are NOT columns: read from posted invoice lines (R15).';

ALTER TABLE purchase.pur_supplier_item ADD CONSTRAINT fk_psi_supplier FOREIGN KEY (psi_supplier_id) REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_supplier_item ADD CONSTRAINT fk_psi_item FOREIGN KEY (psi_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_supplier_item ADD CONSTRAINT fk_psi_buy_uom FOREIGN KEY (psi_buy_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_psi_supplier ON purchase.pur_supplier_item (psi_supplier_id) WHERE (psi_is_deleted = false);
CREATE INDEX ix_psi_item ON purchase.pur_supplier_item (psi_item_id) WHERE (psi_is_deleted = false);
CREATE INDEX ix_psi_supplier_code ON purchase.pur_supplier_item (psi_supplier_id, upper(psi_supplier_item_code)) WHERE (psi_supplier_item_code IS NOT NULL AND psi_is_deleted = false);
CREATE INDEX ix_psi_supplier_barcode ON purchase.pur_supplier_item (upper(psi_supplier_barcode)) WHERE (psi_supplier_barcode IS NOT NULL AND psi_is_deleted = false);

CREATE TABLE purchase.pur_agent (
    pag_id uuid NOT NULL,
    pag_company_id uuid,
    pag_branch_id uuid,
    pag_group_id uuid,
    pag_code character varying(30),
    pag_name character varying(150) NOT NULL,
    pag_alias character varying(150),
    pag_mobile1 character varying(20),
    pag_mobile2 character varying(20),
    pag_addr1 character varying(200),
    pag_addr2 character varying(200),
    pag_city character varying(100),
    pag_district character varying(100),
    pag_state character varying(100),
    pag_pincode character varying(10),
    pag_pan_no character varying(10),
    pag_gstin character varying(15),
    pag_default_comm_pct numeric(9,4),
    pag_remarks character varying(250),
    pag_is_active boolean DEFAULT true NOT NULL,
    pag_is_deleted boolean DEFAULT false NOT NULL,
    pag_sync_date timestamp(6) with time zone,
    pag_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    pag_created_by character varying(50) NOT NULL,
    pag_modified_on timestamp(6) with time zone,
    pag_modified_by character varying(50)
);
ALTER TABLE purchase.pur_agent ADD CONSTRAINT pk_pur_agent PRIMARY KEY (pag_id);
COMMENT ON TABLE purchase.pur_agent IS 'Purchase agent. pag_id = led_id: the agent IS its ledger (as sale agent / supplier / customer). The agent save creates / renames the ledger in one transaction; the ledger master refuses to rename or delete it (findLedgerOwners). Commission is a charge-master row.';

ALTER TABLE purchase.pur_agent ADD CONSTRAINT fk_pag_ledger FOREIGN KEY (pag_id) REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT;

--  supplier additions (MST-01) — nullable / defaulted, nothing existing changes
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_msme_category character varying(10);
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_msme_activity character varying(15);
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_msme_agreement boolean DEFAULT false NOT NULL;
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_msme_agreed_days smallint;
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_drug_licence_expiry date;
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_fssai_no character varying(20);
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_fssai_valid_to date;
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_default_godown_id uuid;
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_show_notes_on_entry boolean DEFAULT false NOT NULL;
ALTER TABLE purchase.suppliers ADD COLUMN IF NOT EXISTS sup_is_import boolean DEFAULT false NOT NULL;
ALTER TABLE purchase.suppliers ADD CONSTRAINT ck_sup_msme_category CHECK (sup_msme_category IS NULL OR sup_msme_category IN ('MICRO','SMALL','MEDIUM','NONE'));
ALTER TABLE purchase.suppliers ADD CONSTRAINT ck_sup_msme_activity CHECK (sup_msme_activity IS NULL OR sup_msme_activity IN ('MANUFACTURER','SERVICE','TRADER'));
ALTER TABLE purchase.suppliers ADD CONSTRAINT ck_sup_msme_days CHECK (sup_msme_agreed_days IS NULL OR sup_msme_agreed_days BETWEEN 1 AND 45);
ALTER TABLE purchase.suppliers ADD CONSTRAINT fk_sup_default_godown FOREIGN KEY (sup_default_godown_id) REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT;
--  item additions (MST-03)
ALTER TABLE inventory.item_master ADD COLUMN IF NOT EXISTS item_purchase_uom_id uuid;
ALTER TABLE inventory.item_master ADD COLUMN IF NOT EXISTS item_min_shelf_life_pct numeric(5,2);
ALTER TABLE inventory.item_master ADD COLUMN IF NOT EXISTS item_itc_class character varying(15);
ALTER TABLE inventory.item_master ADD COLUMN IF NOT EXISTS item_shortage_pct numeric(5,2);
ALTER TABLE inventory.item_master ADD COLUMN IF NOT EXISTS item_default_markup_pct numeric(7,3);
ALTER TABLE inventory.item_master ADD CONSTRAINT ck_item_itc_class CHECK (item_itc_class IS NULL OR item_itc_class IN ('ELIGIBLE','INELIGIBLE','BLOCKED_17_5'));
ALTER TABLE inventory.item_master ADD CONSTRAINT ck_item_pur_pcts CHECK ((item_min_shelf_life_pct IS NULL OR item_min_shelf_life_pct BETWEEN 0 AND 100) AND (item_shortage_pct IS NULL OR item_shortage_pct BETWEEN 0 AND 100));
ALTER TABLE inventory.item_master ADD CONSTRAINT fk_item_purchase_uom FOREIGN KEY (item_purchase_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 2 · purchase order ─────────────────────────────────────────────────
CREATE TABLE purchase.pur_order (
    po_id uuid DEFAULT uuidv7() NOT NULL,
    po_company_id uuid NOT NULL,
    po_branch_id uuid NOT NULL,
    po_tenant_id uuid,
    po_acc_year character(9) NOT NULL,
    po_device_id uuid NOT NULL,
    po_session_id uuid,
    po_slno bigint NOT NULL,
    po_refno character varying(40) NOT NULL,
    po_doc_date date NOT NULL,
    po_doc_datetime timestamp(6) with time zone DEFAULT now() NOT NULL,
    po_status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    po_supplier_id uuid NOT NULL,
    po_expected_date date,
    po_deliver_godown_id uuid,
    po_agent_id uuid,
    po_contact character varying(150),
    po_credit_days smallint,
    po_terms_text text,
    po_approval_status character varying(15) DEFAULT 'NOT_REQUIRED'::character varying NOT NULL,
    po_is_short_closed boolean DEFAULT false NOT NULL,
    po_short_close_reason character varying(250),
    po_gross_amt numeric(15,2) DEFAULT 0 NOT NULL,
    po_taxable_amt numeric(15,2) DEFAULT 0 NOT NULL,
    po_tax_amt numeric(15,2) DEFAULT 0 NOT NULL,
    po_charges_amt numeric(15,2) DEFAULT 0 NOT NULL,
    po_net_amt numeric(15,2) DEFAULT 0 NOT NULL,
    po_remarks character varying(500),
    po_revision_no integer DEFAULT 1 NOT NULL,
    po_print_count integer DEFAULT 0 NOT NULL,
    po_posted_voucher_id uuid,
    po_is_deleted boolean DEFAULT false NOT NULL,
    po_sync_date timestamp(6) with time zone,
    po_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    po_created_by character varying(50) NOT NULL,
    po_modified_on timestamp(6) with time zone,
    po_modified_by character varying(50),
    CONSTRAINT ck_po_status CHECK (po_status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    CONSTRAINT ck_po_approval CHECK (po_approval_status IN ('NOT_REQUIRED','AWAITING','APPROVED','REJECTED'))
)
PARTITION BY LIST (po_acc_year);
ALTER TABLE purchase.pur_order ADD CONSTRAINT pk_pur_order PRIMARY KEY (po_id, po_acc_year);
COMMENT ON TABLE purchase.pur_order IS 'Purchase order. Posts nothing. po_terms_text defaults from setting purchase.po_terms_default, editable per PO. Received / pending per line are DERIVED from the GRN / invoice lines whose src_* point at it (sales src pattern) — 3.0 re-added qty on every save.';
CREATE TABLE purchase.pur_order_2024_2025 PARTITION OF purchase.pur_order FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_order_2025_2026 PARTITION OF purchase.pur_order FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_order_2026_2027 PARTITION OF purchase.pur_order FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_order_2027_2028 PARTITION OF purchase.pur_order FOR VALUES IN ('2027-2028');

CREATE UNIQUE INDEX ux_po_device_slno ON purchase.pur_order (po_company_id, po_branch_id, po_acc_year, po_device_id, po_slno);
CREATE UNIQUE INDEX ux_po_refno ON purchase.pur_order (po_company_id, po_branch_id, po_acc_year, po_refno);
CREATE INDEX ix_po_branch_date ON purchase.pur_order (po_company_id, po_branch_id, po_doc_date DESC) WHERE (po_is_deleted = false);
ALTER TABLE purchase.pur_order ADD CONSTRAINT fk_po_company FOREIGN KEY (po_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order ADD CONSTRAINT fk_po_branch FOREIGN KEY (po_branch_id) REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order ADD CONSTRAINT fk_po_device FOREIGN KEY (po_device_id) REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order ADD CONSTRAINT fk_po_supplier FOREIGN KEY (po_supplier_id) REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order ADD CONSTRAINT fk_po_godown FOREIGN KEY (po_deliver_godown_id) REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order ADD CONSTRAINT fk_po_agent FOREIGN KEY (po_agent_id) REFERENCES purchase.pur_agent (pag_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_po_supplier ON purchase.pur_order (po_supplier_id, po_doc_date DESC) WHERE (po_is_deleted = false);

CREATE TABLE purchase.pur_order_item (
    poi_id uuid DEFAULT uuidv7() NOT NULL,
    poi_po_id uuid NOT NULL,
    poi_company_id uuid NOT NULL,
    poi_branch_id uuid NOT NULL,
    poi_acc_year character(9) NOT NULL,
    poi_line_no integer NOT NULL,
    poi_item_id uuid NOT NULL,
    poi_uom_id uuid NOT NULL,
    poi_base_uom_id uuid NOT NULL,
    poi_to_base_factor numeric(18,9) DEFAULT 1 NOT NULL,
    poi_hsn_code character varying(8),
    poi_weight numeric(15,3),
    poi_qty numeric(18,6) DEFAULT 0 NOT NULL,
    poi_free_qty numeric(18,6) DEFAULT 0 NOT NULL,
    poi_rate numeric(18,6) DEFAULT 0 NOT NULL,
    poi_disc_pct numeric(9,4) DEFAULT 0 NOT NULL,
    poi_disc_per_qty numeric(18,6) DEFAULT 0 NOT NULL,
    poi_disc_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_sch_pct numeric(9,4) DEFAULT 0 NOT NULL,
    poi_sch_per_qty numeric(18,6) DEFAULT 0 NOT NULL,
    poi_sch_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_extra_disc_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_chrg_before_tax numeric(15,2) DEFAULT 0 NOT NULL,
    poi_chrg_after_tax numeric(15,2) DEFAULT 0 NOT NULL,
    poi_gross_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_taxable_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_tax_id uuid,
    poi_gst_pct numeric(9,4) DEFAULT 0 NOT NULL,
    poi_cgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_sgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_igst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_cess_pct numeric(9,4) DEFAULT 0 NOT NULL,
    poi_cess_per_unit numeric(18,6) DEFAULT 0 NOT NULL,
    poi_cess_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_total_amt numeric(15,2) DEFAULT 0 NOT NULL,
    poi_mrp numeric(15,2),
    poi_expected_sell numeric(15,2),
    poi_model character varying(60),
    poi_size_id uuid,
    poi_colour_id uuid,
    poi_short_closed_qty numeric(18,6) DEFAULT 0 NOT NULL,
    poi_short_close_reason character varying(250),
    poi_remarks character varying(250),
    poi_is_deleted boolean DEFAULT false NOT NULL,
    poi_sync_date timestamp(6) with time zone,
    poi_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    poi_created_by character varying(50) NOT NULL,
    poi_modified_on timestamp(6) with time zone,
    poi_modified_by character varying(50),
    CONSTRAINT ck_poi_qty CHECK (poi_qty >= 0 AND poi_free_qty >= 0 AND poi_short_closed_qty >= 0)
)
PARTITION BY LIST (poi_acc_year);
ALTER TABLE purchase.pur_order_item ADD CONSTRAINT pk_pur_order_item PRIMARY KEY (poi_id, poi_acc_year);
CREATE TABLE purchase.pur_order_item_2024_2025 PARTITION OF purchase.pur_order_item FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_order_item_2025_2026 PARTITION OF purchase.pur_order_item FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_order_item_2026_2027 PARTITION OF purchase.pur_order_item FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_order_item_2027_2028 PARTITION OF purchase.pur_order_item FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_order_item ADD CONSTRAINT fk_poi_po FOREIGN KEY (poi_po_id, poi_acc_year) REFERENCES purchase.pur_order (po_id, po_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_poi_po ON purchase.pur_order_item (poi_po_id, poi_acc_year, poi_line_no) WHERE (poi_is_deleted = false);
ALTER TABLE purchase.pur_order_item ADD CONSTRAINT fk_poi_item FOREIGN KEY (poi_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order_item ADD CONSTRAINT fk_poi_uom FOREIGN KEY (poi_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order_item ADD CONSTRAINT fk_poi_base_uom FOREIGN KEY (poi_base_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_poi_item ON purchase.pur_order_item (poi_item_id) WHERE (poi_is_deleted = false);
ALTER TABLE purchase.pur_order_item ADD CONSTRAINT fk_poi_size FOREIGN KEY (poi_size_id) REFERENCES inventory.item_size_master (isz_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_order_item ADD CONSTRAINT fk_poi_colour FOREIGN KEY (poi_colour_id) REFERENCES inventory.item_colour_master (icl_id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 3 · GRN ───────────────────────────────────────────────────────────
CREATE TABLE purchase.pur_grn (
    grn_id uuid DEFAULT uuidv7() NOT NULL,
    grn_company_id uuid NOT NULL,
    grn_branch_id uuid NOT NULL,
    grn_tenant_id uuid,
    grn_acc_year character(9) NOT NULL,
    grn_device_id uuid NOT NULL,
    grn_session_id uuid,
    grn_slno bigint NOT NULL,
    grn_refno character varying(40) NOT NULL,
    grn_doc_date date NOT NULL,
    grn_doc_datetime timestamp(6) with time zone DEFAULT now() NOT NULL,
    grn_status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    grn_supplier_id uuid NOT NULL,
    grn_godown_id uuid NOT NULL,
    grn_challan_no character varying(60),
    grn_challan_date date,
    grn_supplier_inv_no character varying(60),
    grn_received_at timestamp(6) with time zone NOT NULL,
    grn_received_by uuid[],
    grn_supervisor_id uuid,
    grn_vehicle_no character varying(20),
    grn_driver_name character varying(100),
    grn_ewb_no character varying(15),
    grn_ewb_date date,
    grn_packages_sent integer,
    grn_packages_received integer,
    grn_provisional_value numeric(15,2) DEFAULT 0 NOT NULL,
    grn_offbill_charges numeric(15,2) DEFAULT 0 NOT NULL,
    grn_remarks character varying(500),
    grn_revision_no integer DEFAULT 1 NOT NULL,
    grn_print_count integer DEFAULT 0 NOT NULL,
    grn_posted_voucher_id uuid,
    grn_is_deleted boolean DEFAULT false NOT NULL,
    grn_sync_date timestamp(6) with time zone,
    grn_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    grn_created_by character varying(50) NOT NULL,
    grn_modified_on timestamp(6) with time zone,
    grn_modified_by character varying(50),
    CONSTRAINT ck_grn_status CHECK (grn_status IN ('DRAFT', 'POSTED', 'CANCELLED'))
)
PARTITION BY LIST (grn_acc_year);
ALTER TABLE purchase.pur_grn ADD CONSTRAINT pk_pur_grn PRIMARY KEY (grn_id, grn_acc_year);
COMMENT ON TABLE purchase.pur_grn IS 'Goods received before the bill. Posts stock (provisional rate) and Dr INVENTORY / Cr GRNI. Bill status is DERIVED from invoice lines whose src_* point at its lines. Crew on the document (house rule): grn_received_by uuid[] = the employees who received / unloaded (the coolie payees); arrays cannot be FKd, the service validates each id against employee_master.';
CREATE TABLE purchase.pur_grn_2024_2025 PARTITION OF purchase.pur_grn FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_grn_2025_2026 PARTITION OF purchase.pur_grn FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_grn_2026_2027 PARTITION OF purchase.pur_grn FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_grn_2027_2028 PARTITION OF purchase.pur_grn FOR VALUES IN ('2027-2028');

CREATE UNIQUE INDEX ux_grn_device_slno ON purchase.pur_grn (grn_company_id, grn_branch_id, grn_acc_year, grn_device_id, grn_slno);
CREATE UNIQUE INDEX ux_grn_refno ON purchase.pur_grn (grn_company_id, grn_branch_id, grn_acc_year, grn_refno);
CREATE INDEX ix_grn_branch_date ON purchase.pur_grn (grn_company_id, grn_branch_id, grn_doc_date DESC) WHERE (grn_is_deleted = false);
ALTER TABLE purchase.pur_grn ADD CONSTRAINT fk_grn_company FOREIGN KEY (grn_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_grn ADD CONSTRAINT fk_grn_branch FOREIGN KEY (grn_branch_id) REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_grn ADD CONSTRAINT fk_grn_device FOREIGN KEY (grn_device_id) REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_grn ADD CONSTRAINT fk_grn_supplier FOREIGN KEY (grn_supplier_id) REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_grn ADD CONSTRAINT fk_grn_godown FOREIGN KEY (grn_godown_id) REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_grn ADD CONSTRAINT fk_grn_supervisor FOREIGN KEY (grn_supervisor_id) REFERENCES public.employee_master (emp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_grn_supplier ON purchase.pur_grn (grn_supplier_id, grn_doc_date DESC) WHERE (grn_is_deleted = false);

CREATE TABLE purchase.pur_grn_item (
    gri_id uuid DEFAULT uuidv7() NOT NULL,
    gri_grn_id uuid NOT NULL,
    gri_company_id uuid NOT NULL,
    gri_branch_id uuid NOT NULL,
    gri_acc_year character(9) NOT NULL,
    gri_line_no integer NOT NULL,
    gri_item_id uuid NOT NULL,
    gri_uom_id uuid NOT NULL,
    gri_base_uom_id uuid NOT NULL,
    gri_to_base_factor numeric(18,9) DEFAULT 1 NOT NULL,
    gri_hsn_code character varying(8),
    gri_weight numeric(15,3),
    gri_src_doc_type character varying(20),
    gri_src_doc_id uuid,
    gri_src_doc_year character(9),
    gri_src_item_id uuid,
    gri_src_doc_line_no integer,
    gri_src_doc_refno character varying(40),
    gri_challan_qty numeric(18,6) DEFAULT 0 NOT NULL,
    gri_received_qty numeric(18,6) DEFAULT 0 NOT NULL,
    gri_damaged_qty numeric(18,6) DEFAULT 0 NOT NULL,
    gri_damage_reason_id uuid,
    gri_free_qty numeric(18,6) DEFAULT 0 NOT NULL,
    gri_excess_qty numeric(18,6) DEFAULT 0 NOT NULL,
    gri_excess_action character varying(15),
    gri_provisional_rate numeric(18,6) DEFAULT 0 NOT NULL,
    gri_offbill_share numeric(15,2) DEFAULT 0 NOT NULL,
    gri_value numeric(15,2) DEFAULT 0 NOT NULL,
    gri_mrp numeric(15,2),
    gri_sell_a numeric(15,2),
    gri_remarks character varying(250),
    gri_is_deleted boolean DEFAULT false NOT NULL,
    gri_sync_date timestamp(6) with time zone,
    gri_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    gri_created_by character varying(50) NOT NULL,
    gri_modified_on timestamp(6) with time zone,
    gri_modified_by character varying(50),
    CONSTRAINT ck_gri_qty CHECK (gri_challan_qty >= 0 AND gri_received_qty >= 0 AND gri_damaged_qty >= 0 AND gri_free_qty >= 0 AND gri_excess_qty >= 0),
    CONSTRAINT ck_gri_src CHECK (((gri_src_doc_type IS NULL) = (gri_src_item_id IS NULL)) AND ((gri_src_doc_type IS NULL) = (gri_src_doc_id IS NULL)) AND ((gri_src_doc_type IS NULL) = (gri_src_doc_year IS NULL)) AND (gri_src_doc_type IS NULL OR gri_src_doc_type IN ('PURCHASE_ORDER'))),
    CONSTRAINT ck_gri_excess_action CHECK (gri_excess_action IS NULL OR gri_excess_action IN ('HOLD_FOR_BILL','RETURN','KEEP_FREE'))
)
PARTITION BY LIST (gri_acc_year);
ALTER TABLE purchase.pur_grn_item ADD CONSTRAINT pk_pur_grn_item PRIMARY KEY (gri_id, gri_acc_year);
CREATE TABLE purchase.pur_grn_item_2024_2025 PARTITION OF purchase.pur_grn_item FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_grn_item_2025_2026 PARTITION OF purchase.pur_grn_item FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_grn_item_2026_2027 PARTITION OF purchase.pur_grn_item FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_grn_item_2027_2028 PARTITION OF purchase.pur_grn_item FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_grn_item ADD CONSTRAINT fk_gri_grn FOREIGN KEY (gri_grn_id, gri_acc_year) REFERENCES purchase.pur_grn (grn_id, grn_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_gri_grn ON purchase.pur_grn_item (gri_grn_id, gri_acc_year, gri_line_no) WHERE (gri_is_deleted = false);
ALTER TABLE purchase.pur_grn_item ADD CONSTRAINT fk_gri_item FOREIGN KEY (gri_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_grn_item ADD CONSTRAINT fk_gri_uom FOREIGN KEY (gri_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_grn_item ADD CONSTRAINT fk_gri_base_uom FOREIGN KEY (gri_base_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_gri_item ON purchase.pur_grn_item (gri_item_id) WHERE (gri_is_deleted = false);
CREATE INDEX ix_gri_src_item ON purchase.pur_grn_item (gri_src_doc_type, gri_src_item_id, gri_src_doc_year) WHERE (gri_src_item_id IS NOT NULL AND gri_is_deleted = false);
ALTER TABLE purchase.pur_grn_item ADD CONSTRAINT fk_gri_damage_reason FOREIGN KEY (gri_damage_reason_id) REFERENCES stock.stock_reason_master (srm_id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 4 · purchase invoice ──────────────────────────────────────────────
CREATE TABLE purchase.pur_invoice (
    pi_id uuid DEFAULT uuidv7() NOT NULL,
    pi_company_id uuid NOT NULL,
    pi_branch_id uuid NOT NULL,
    pi_tenant_id uuid,
    pi_acc_year character(9) NOT NULL,
    pi_device_id uuid NOT NULL,
    pi_session_id uuid,
    pi_slno bigint NOT NULL,
    pi_refno character varying(40) NOT NULL,
    pi_doc_date date NOT NULL,
    pi_doc_datetime timestamp(6) with time zone DEFAULT now() NOT NULL,
    pi_status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    pi_supplier_id uuid NOT NULL,
    pi_supplier_gstin character varying(15),
    pi_supplier_gst_type character varying(20),
    pi_supplier_inv_no character varying(60) NOT NULL,
    pi_supplier_inv_date date NOT NULL,
    pi_goods_received_on date,
    pi_source_kind character varying(15) DEFAULT 'DIRECT'::character varying NOT NULL,
    pi_sister_company_id uuid,
    pi_godown_id uuid NOT NULL,
    pi_invoice_amount_printed numeric(15,2) DEFAULT 0 NOT NULL,
    pi_mode character varying(10) DEFAULT 'CREDIT'::character varying NOT NULL,
    pi_credit_days smallint,
    pi_due_date date,
    pi_msme_due_date date,
    pi_agent_id uuid,
    pi_pos_stcd character(2),
    pi_is_reverse_charge boolean DEFAULT false NOT NULL,
    pi_ewb_no character varying(15),
    pi_ewb_date date,
    pi_irn character varying(64),
    pi_ack_no character varying(20),
    pi_payment_hold boolean DEFAULT false NOT NULL,
    pi_hold_reason character varying(250),
    pi_hold_released_by character varying(50),
    pi_hold_released_on timestamp(6) with time zone,
    pi_gross_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_disc_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_taxable_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_cgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_sgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_igst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_cess_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_charges_on_bill numeric(15,2) DEFAULT 0 NOT NULL,
    pi_tcs_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_round_off numeric(15,2) DEFAULT 0 NOT NULL,
    pi_net_payable numeric(15,2) DEFAULT 0 NOT NULL,
    pi_offbill_charges numeric(15,2) DEFAULT 0 NOT NULL,
    pi_short_value numeric(15,2) DEFAULT 0 NOT NULL,
    pi_itc_eligible_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_itc_pending_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_itc_ineligible_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pi_policy jsonb,
    pi_remarks character varying(500),
    pi_revision_no integer DEFAULT 1 NOT NULL,
    pi_print_count integer DEFAULT 0 NOT NULL,
    pi_posted_voucher_id uuid,
    pi_is_deleted boolean DEFAULT false NOT NULL,
    pi_sync_date timestamp(6) with time zone,
    pi_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    pi_created_by character varying(50) NOT NULL,
    pi_modified_on timestamp(6) with time zone,
    pi_modified_by character varying(50),
    CONSTRAINT ck_pi_status CHECK (pi_status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    CONSTRAINT ck_pi_source CHECK (pi_source_kind IN ('DIRECT','GRN','PO','SISTER_SALE')),
    CONSTRAINT ck_pi_mode CHECK (pi_mode IN ('CREDIT','CASH')),
    CONSTRAINT ck_pi_sister CHECK ((pi_source_kind = 'SISTER_SALE') = (pi_sister_company_id IS NOT NULL))
)
PARTITION BY LIST (pi_acc_year);
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT pk_pur_invoice PRIMARY KEY (pi_id, pi_acc_year);
COMMENT ON TABLE purchase.pur_invoice IS 'The suppliers bill as printed. pi_supplier_inv_no is deliberately NOT unique (offline branches — R1 / P17); duplicates are refused online company-wide and reported. pi_policy = the snapshot of the purchase settings that steer money.';
CREATE TABLE purchase.pur_invoice_2024_2025 PARTITION OF purchase.pur_invoice FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_invoice_2025_2026 PARTITION OF purchase.pur_invoice FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_invoice_2026_2027 PARTITION OF purchase.pur_invoice FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_invoice_2027_2028 PARTITION OF purchase.pur_invoice FOR VALUES IN ('2027-2028');

CREATE UNIQUE INDEX ux_pi_device_slno ON purchase.pur_invoice (pi_company_id, pi_branch_id, pi_acc_year, pi_device_id, pi_slno);
CREATE UNIQUE INDEX ux_pi_refno ON purchase.pur_invoice (pi_company_id, pi_branch_id, pi_acc_year, pi_refno);
CREATE INDEX ix_pi_branch_date ON purchase.pur_invoice (pi_company_id, pi_branch_id, pi_doc_date DESC) WHERE (pi_is_deleted = false);
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_company FOREIGN KEY (pi_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_branch FOREIGN KEY (pi_branch_id) REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_device FOREIGN KEY (pi_device_id) REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_supplier FOREIGN KEY (pi_supplier_id) REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_godown FOREIGN KEY (pi_godown_id) REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_agent FOREIGN KEY (pi_agent_id) REFERENCES purchase.pur_agent (pag_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_pos FOREIGN KEY (pi_pos_stcd) REFERENCES fixed.state_codes (state_code) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice ADD CONSTRAINT fk_pi_sister FOREIGN KEY (pi_sister_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_pi_supplier_inv ON purchase.pur_invoice (pi_company_id, pi_supplier_id, upper(pi_supplier_inv_no)) WHERE (pi_is_deleted = false);
CREATE INDEX ix_pi_supplier ON purchase.pur_invoice (pi_supplier_id, pi_doc_date DESC) WHERE (pi_is_deleted = false);
CREATE INDEX ix_pi_hold ON purchase.pur_invoice (pi_company_id, pi_branch_id) WHERE (pi_payment_hold AND pi_is_deleted = false);

CREATE TABLE purchase.pur_invoice_item (
    pii_id uuid DEFAULT uuidv7() NOT NULL,
    pii_pi_id uuid NOT NULL,
    pii_company_id uuid NOT NULL,
    pii_branch_id uuid NOT NULL,
    pii_acc_year character(9) NOT NULL,
    pii_line_no integer NOT NULL,
    pii_item_id uuid NOT NULL,
    pii_uom_id uuid NOT NULL,
    pii_base_uom_id uuid NOT NULL,
    pii_to_base_factor numeric(18,9) DEFAULT 1 NOT NULL,
    pii_hsn_code character varying(8),
    pii_weight numeric(15,3),
    pii_src_doc_type character varying(20),
    pii_src_doc_id uuid,
    pii_src_doc_year character(9),
    pii_src_item_id uuid,
    pii_src_doc_line_no integer,
    pii_src_doc_refno character varying(40),
    pii_billed_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_received_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_damaged_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_short_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_absorbed_short_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_excess_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_excess_action character varying(15),
    pii_rejected_at_grn_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_free_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_rate numeric(18,6) DEFAULT 0 NOT NULL,
    pii_disc_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pii_disc_per_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_disc_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_sch_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pii_sch_per_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pii_sch_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_extra_disc_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_chrg_before_tax numeric(15,2) DEFAULT 0 NOT NULL,
    pii_chrg_after_tax numeric(15,2) DEFAULT 0 NOT NULL,
    pii_gross_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_taxable_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_tax_id uuid,
    pii_gst_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pii_cgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_sgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_igst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_cess_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pii_cess_per_unit numeric(18,6) DEFAULT 0 NOT NULL,
    pii_cess_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_total_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_itc_eligible_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_itc_pending_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_itc_ineligible_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pii_itc_class character varying(15),
    pii_landed_cost_wot numeric(18,6) DEFAULT 0 NOT NULL,
    pii_markup_a_pct numeric(9,4),
    pii_markup_b_pct numeric(9,4),
    pii_markup_c_pct numeric(9,4),
    pii_markup_d_pct numeric(9,4),
    pii_sell_a numeric(15,2),
    pii_sell_b numeric(15,2),
    pii_sell_c numeric(15,2),
    pii_sell_d numeric(15,2),
    pii_mrp numeric(15,2),
    pii_old_prices jsonb,
    pii_price_update_result character varying(12),
    pii_remarks character varying(250),
    pii_is_deleted boolean DEFAULT false NOT NULL,
    pii_sync_date timestamp(6) with time zone,
    pii_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    pii_created_by character varying(50) NOT NULL,
    pii_modified_on timestamp(6) with time zone,
    pii_modified_by character varying(50),
    CONSTRAINT ck_pii_qty CHECK (pii_billed_qty >= 0 AND pii_received_qty >= 0 AND pii_damaged_qty >= 0 AND pii_short_qty >= 0 AND pii_absorbed_short_qty >= 0 AND pii_excess_qty >= 0 AND pii_free_qty >= 0 AND pii_rejected_at_grn_qty >= 0),
    CONSTRAINT ck_pii_excess_action CHECK (pii_excess_action IS NULL OR pii_excess_action IN ('HOLD_FOR_BILL','RETURN','KEEP_FREE')),
    CONSTRAINT ck_pii_itc_class CHECK (pii_itc_class IS NULL OR pii_itc_class IN ('ELIGIBLE','INELIGIBLE','BLOCKED_17_5','RCM','COMPOSITION','UNREGISTERED')),
    CONSTRAINT ck_pii_src CHECK (((pii_src_doc_type IS NULL) = (pii_src_item_id IS NULL)) AND ((pii_src_doc_type IS NULL) = (pii_src_doc_id IS NULL)) AND ((pii_src_doc_type IS NULL) = (pii_src_doc_year IS NULL)) AND (pii_src_doc_type IS NULL OR pii_src_doc_type IN ('PURCHASE_ORDER', 'GRN', 'SALE_BILL'))),
    CONSTRAINT ck_pii_price_result CHECK (pii_price_update_result IS NULL OR pii_price_update_result IN ('UPDATED','KEPT_NEWER','OFF','NONE'))
)
PARTITION BY LIST (pii_acc_year);
ALTER TABLE purchase.pur_invoice_item ADD CONSTRAINT pk_pur_invoice_item PRIMARY KEY (pii_id, pii_acc_year);
COMMENT ON TABLE purchase.pur_invoice_item IS 'The PRINTED line (HSN, rate, tax as on the suppliers bill — for 2B / IMS). The stock side is in pur_item_alloc.';
CREATE TABLE purchase.pur_invoice_item_2024_2025 PARTITION OF purchase.pur_invoice_item FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_invoice_item_2025_2026 PARTITION OF purchase.pur_invoice_item FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_invoice_item_2026_2027 PARTITION OF purchase.pur_invoice_item FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_invoice_item_2027_2028 PARTITION OF purchase.pur_invoice_item FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_invoice_item ADD CONSTRAINT fk_pii_pi FOREIGN KEY (pii_pi_id, pii_acc_year) REFERENCES purchase.pur_invoice (pi_id, pi_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_pii_pi ON purchase.pur_invoice_item (pii_pi_id, pii_acc_year, pii_line_no) WHERE (pii_is_deleted = false);
CREATE INDEX ix_pii_src_item ON purchase.pur_invoice_item (pii_src_doc_type, pii_src_item_id, pii_src_doc_year) WHERE (pii_src_item_id IS NOT NULL AND pii_is_deleted = false);
ALTER TABLE purchase.pur_invoice_item ADD CONSTRAINT fk_pii_item FOREIGN KEY (pii_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice_item ADD CONSTRAINT fk_pii_uom FOREIGN KEY (pii_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_invoice_item ADD CONSTRAINT fk_pii_base_uom FOREIGN KEY (pii_base_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_pii_item ON purchase.pur_invoice_item (pii_item_id) WHERE (pii_is_deleted = false);

-- ── 5 · stock-side allocation rows (GRN / invoice / return / shortage receipt) ──
CREATE TABLE purchase.pur_item_alloc (
    pia_id uuid DEFAULT uuidv7() NOT NULL,
    pia_company_id uuid NOT NULL,
    pia_branch_id uuid NOT NULL,
    pia_acc_year character(9) NOT NULL,
    pia_doc_type character varying(20) NOT NULL,
    pia_doc_id uuid NOT NULL,
    pia_line_id uuid NOT NULL,
    pia_row_no integer NOT NULL,
    pia_bill_line_no integer,
    pia_godown_id uuid NOT NULL,
    pia_bucket character varying(20) DEFAULT 'SALEABLE'::character varying NOT NULL,
    pia_batch_no character varying(100),
    pia_mfg_date date,
    pia_expiry_date date,
    pia_mrp numeric(15,2),
    pia_sale_price numeric(15,2),
    pia_size_id uuid,
    pia_colour_id uuid,
    pia_model character varying(60),
    pia_serial_no character varying(100),
    pia_warranty_to date,
    pia_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pia_free_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pia_barcode character varying(60),
    pia_lot_id uuid,
    pia_svi_id uuid,
    pia_svi_acc_year character(9),
    pia_is_deleted boolean DEFAULT false NOT NULL,
    pia_sync_date timestamp(6) with time zone,
    pia_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    pia_created_by character varying(50) NOT NULL,
    pia_modified_on timestamp(6) with time zone,
    pia_modified_by character varying(50),
    CONSTRAINT ck_pia_doc_type CHECK (pia_doc_type IN ('GRN','PURCHASE_BILL','PURCHASE_RETURN','SHORTAGE_RECEIPT')),
    CONSTRAINT ck_pia_bucket CHECK (pia_bucket IN ('SALEABLE','DAMAGED','QUARANTINE','EXPIRED','SAMPLE')),
    CONSTRAINT ck_pia_qty CHECK (pia_qty >= 0 AND pia_free_qty >= 0),
    CONSTRAINT ck_pia_serial_one CHECK (pia_serial_no IS NULL OR pia_qty + pia_free_qty = 1)
)
PARTITION BY LIST (pia_acc_year);
ALTER TABLE purchase.pur_item_alloc ADD CONSTRAINT pk_pur_item_alloc PRIMARY KEY (pia_id, pia_acc_year);
COMMENT ON TABLE purchase.pur_item_alloc IS 'The stock side of a purchase line: one row per godown / bucket / batch / serial / size-colour. Typed on the row (one allocation) or in F12 (several) — the same rows. lot / svi filled at post.';
CREATE TABLE purchase.pur_item_alloc_2024_2025 PARTITION OF purchase.pur_item_alloc FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_item_alloc_2025_2026 PARTITION OF purchase.pur_item_alloc FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_item_alloc_2026_2027 PARTITION OF purchase.pur_item_alloc FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_item_alloc_2027_2028 PARTITION OF purchase.pur_item_alloc FOR VALUES IN ('2027-2028');

CREATE INDEX ix_pia_line ON purchase.pur_item_alloc (pia_doc_type, pia_line_id, pia_acc_year, pia_row_no) WHERE (pia_is_deleted = false);
CREATE INDEX ix_pia_doc ON purchase.pur_item_alloc (pia_doc_type, pia_doc_id, pia_acc_year) WHERE (pia_is_deleted = false);
CREATE INDEX ix_pia_lot ON purchase.pur_item_alloc (pia_lot_id) WHERE (pia_lot_id IS NOT NULL AND pia_is_deleted = false);
CREATE INDEX ix_pia_serial ON purchase.pur_item_alloc (pia_company_id, upper(pia_serial_no)) WHERE (pia_serial_no IS NOT NULL AND pia_is_deleted = false);
ALTER TABLE purchase.pur_item_alloc ADD CONSTRAINT fk_pia_godown FOREIGN KEY (pia_godown_id) REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_item_alloc ADD CONSTRAINT fk_pia_lot FOREIGN KEY (pia_lot_id) REFERENCES stock.stock_lot (slt_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_item_alloc ADD CONSTRAINT fk_pia_size FOREIGN KEY (pia_size_id) REFERENCES inventory.item_size_master (isz_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_item_alloc ADD CONSTRAINT fk_pia_colour FOREIGN KEY (pia_colour_id) REFERENCES inventory.item_colour_master (icl_id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 7 · shortages ─────────────────────────────────────────────────────
CREATE TABLE purchase.pur_shortage (
    psh_id uuid DEFAULT uuidv7() NOT NULL,
    psh_company_id uuid NOT NULL,
    psh_branch_id uuid NOT NULL,
    psh_acc_year character(9) NOT NULL,
    psh_supplier_id uuid NOT NULL,
    psh_item_id uuid NOT NULL,
    psh_src_doc_type character varying(20) NOT NULL,
    psh_src_doc_id uuid NOT NULL,
    psh_src_doc_year character(9) NOT NULL,
    psh_src_item_id uuid NOT NULL,
    psh_src_doc_refno character varying(40),
    psh_bill_doc_id uuid,
    psh_bill_doc_year character(9),
    psh_bill_item_id uuid,
    psh_reason character varying(15) NOT NULL,
    psh_qty_base numeric(18,6) DEFAULT 0 NOT NULL,
    psh_value numeric(15,2),
    psh_gst_pending numeric(15,2),
    psh_origin_cost_rate numeric(18,6),
    psh_remarks character varying(250),
    psh_is_deleted boolean DEFAULT false NOT NULL,
    psh_sync_date timestamp(6) with time zone,
    psh_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    psh_created_by character varying(50) NOT NULL,
    psh_modified_on timestamp(6) with time zone,
    psh_modified_by character varying(50),
    CONSTRAINT ck_psh_reason CHECK (psh_reason IN ('SHORT_BILL','SHORT_CHALLAN','REPLACE')),
    CONSTRAINT ck_psh_src_type CHECK (psh_src_doc_type IN ('GRN','PURCHASE_BILL','PURCHASE_RETURN')),
    CONSTRAINT ck_psh_bill CHECK (((psh_bill_doc_id IS NULL) = (psh_bill_item_id IS NULL)) AND ((psh_bill_doc_id IS NULL) = (psh_bill_doc_year IS NULL))),
    CONSTRAINT ck_psh_qty CHECK (psh_qty_base > 0)
)
PARTITION BY LIST (psh_acc_year);
ALTER TABLE purchase.pur_shortage ADD CONSTRAINT pk_pur_shortage PRIMARY KEY (psh_id, psh_acc_year);
COMMENT ON TABLE purchase.pur_shortage IS 'One row per short supplier line, ever (R3). src_* = the line that opened it (GRN challan short / bill short / return Replace), sales src pattern. A bill adopting a GRN shortage sets psh_bill_* + value + pending GST. Open qty / status are DERIVED (receipts + pur_shortage_close).';
CREATE TABLE purchase.pur_shortage_2024_2025 PARTITION OF purchase.pur_shortage FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_shortage_2025_2026 PARTITION OF purchase.pur_shortage FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_shortage_2026_2027 PARTITION OF purchase.pur_shortage FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_shortage_2027_2028 PARTITION OF purchase.pur_shortage FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_shortage ADD CONSTRAINT fk_psh_supplier FOREIGN KEY (psh_supplier_id) REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage ADD CONSTRAINT fk_psh_item FOREIGN KEY (psh_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_psh_supplier ON purchase.pur_shortage (psh_company_id, psh_supplier_id) WHERE (psh_is_deleted = false);
CREATE INDEX ix_psh_src_item ON purchase.pur_shortage (psh_src_doc_type, psh_src_item_id, psh_src_doc_year) WHERE (psh_is_deleted = false);
CREATE INDEX ix_psh_bill_item ON purchase.pur_shortage (psh_bill_item_id, psh_bill_doc_year) WHERE (psh_bill_item_id IS NOT NULL AND psh_is_deleted = false);

CREATE TABLE purchase.pur_shortage_close (
    psc_id uuid DEFAULT uuidv7() NOT NULL,
    psc_company_id uuid NOT NULL,
    psc_branch_id uuid NOT NULL,
    psc_acc_year character(9) NOT NULL,
    psc_shortage_id uuid NOT NULL,
    psc_shortage_acc_year character(9) NOT NULL,
    psc_kind character varying(15) NOT NULL,
    psc_qty_base numeric(18,6) DEFAULT 0 NOT NULL,
    psc_amount numeric(15,2) DEFAULT 0 NOT NULL,
    psc_party_id uuid,
    psc_cn_no character varying(60),
    psc_cn_date date,
    psc_reason character varying(250),
    psc_voucher_id uuid,
    psc_reversal_of_id uuid,
    psc_is_deleted boolean DEFAULT false NOT NULL,
    psc_sync_date timestamp(6) with time zone,
    psc_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    psc_created_by character varying(50) NOT NULL,
    psc_modified_on timestamp(6) with time zone,
    psc_modified_by character varying(50),
    CONSTRAINT ck_psc_kind CHECK (psc_kind IN ('SUPPLIER_CN','CLAIM','WRITE_OFF'))
)
PARTITION BY LIST (psc_acc_year);
ALTER TABLE purchase.pur_shortage_close ADD CONSTRAINT pk_pur_shortage_close PRIMARY KEY (psc_id, psc_acc_year);
COMMENT ON TABLE purchase.pur_shortage_close IS 'How a shortage closes other than by receipt: supplier credit note, a claim on a transporter / insurer, or a write-off. Undo = a reversing row (reversal_of_id), never a delete.';
CREATE TABLE purchase.pur_shortage_close_2024_2025 PARTITION OF purchase.pur_shortage_close FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_shortage_close_2025_2026 PARTITION OF purchase.pur_shortage_close FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_shortage_close_2026_2027 PARTITION OF purchase.pur_shortage_close FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_shortage_close_2027_2028 PARTITION OF purchase.pur_shortage_close FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_shortage_close ADD CONSTRAINT fk_psc_shortage FOREIGN KEY (psc_shortage_id, psc_shortage_acc_year) REFERENCES purchase.pur_shortage (psh_id, psh_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage_close ADD CONSTRAINT fk_psc_party FOREIGN KEY (psc_party_id) REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_psc_shortage ON purchase.pur_shortage_close (psc_shortage_id, psc_shortage_acc_year) WHERE (psc_is_deleted = false);

CREATE TABLE purchase.pur_shortage_receipt (
    psr_id uuid DEFAULT uuidv7() NOT NULL,
    psr_company_id uuid NOT NULL,
    psr_branch_id uuid NOT NULL,
    psr_tenant_id uuid,
    psr_acc_year character(9) NOT NULL,
    psr_device_id uuid NOT NULL,
    psr_session_id uuid,
    psr_slno bigint NOT NULL,
    psr_refno character varying(40) NOT NULL,
    psr_doc_date date NOT NULL,
    psr_doc_datetime timestamp(6) with time zone DEFAULT now() NOT NULL,
    psr_status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    psr_supplier_id uuid NOT NULL,
    psr_godown_id uuid NOT NULL,
    psr_received_at timestamp(6) with time zone NOT NULL,
    psr_challan_no character varying(60),
    psr_received_by uuid[],
    psr_value numeric(15,2) DEFAULT 0 NOT NULL,
    psr_remarks character varying(500),
    psr_revision_no integer DEFAULT 1 NOT NULL,
    psr_print_count integer DEFAULT 0 NOT NULL,
    psr_posted_voucher_id uuid,
    psr_is_deleted boolean DEFAULT false NOT NULL,
    psr_sync_date timestamp(6) with time zone,
    psr_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    psr_created_by character varying(50) NOT NULL,
    psr_modified_on timestamp(6) with time zone,
    psr_modified_by character varying(50),
    CONSTRAINT ck_psr_status CHECK (psr_status IN ('DRAFT', 'POSTED', 'CANCELLED'))
)
PARTITION BY LIST (psr_acc_year);
ALTER TABLE purchase.pur_shortage_receipt ADD CONSTRAINT pk_pur_shortage_receipt PRIMARY KEY (psr_id, psr_acc_year);
COMMENT ON TABLE purchase.pur_shortage_receipt IS 'Receives against open shortage rows (bill short, challan short, Replace). Stock in at the original bill cost.';
CREATE TABLE purchase.pur_shortage_receipt_2024_2025 PARTITION OF purchase.pur_shortage_receipt FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_shortage_receipt_2025_2026 PARTITION OF purchase.pur_shortage_receipt FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_shortage_receipt_2026_2027 PARTITION OF purchase.pur_shortage_receipt FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_shortage_receipt_2027_2028 PARTITION OF purchase.pur_shortage_receipt FOR VALUES IN ('2027-2028');

CREATE UNIQUE INDEX ux_psr_device_slno ON purchase.pur_shortage_receipt (psr_company_id, psr_branch_id, psr_acc_year, psr_device_id, psr_slno);
CREATE UNIQUE INDEX ux_psr_refno ON purchase.pur_shortage_receipt (psr_company_id, psr_branch_id, psr_acc_year, psr_refno);
CREATE INDEX ix_psr_branch_date ON purchase.pur_shortage_receipt (psr_company_id, psr_branch_id, psr_doc_date DESC) WHERE (psr_is_deleted = false);
ALTER TABLE purchase.pur_shortage_receipt ADD CONSTRAINT fk_psr_company FOREIGN KEY (psr_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage_receipt ADD CONSTRAINT fk_psr_branch FOREIGN KEY (psr_branch_id) REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage_receipt ADD CONSTRAINT fk_psr_device FOREIGN KEY (psr_device_id) REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage_receipt ADD CONSTRAINT fk_psr_supplier FOREIGN KEY (psr_supplier_id) REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage_receipt ADD CONSTRAINT fk_psr_godown FOREIGN KEY (psr_godown_id) REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE purchase.pur_shortage_receipt_item (
    psri_id uuid DEFAULT uuidv7() NOT NULL,
    psri_psr_id uuid NOT NULL,
    psri_company_id uuid NOT NULL,
    psri_branch_id uuid NOT NULL,
    psri_acc_year character(9) NOT NULL,
    psri_line_no integer NOT NULL,
    psri_shortage_id uuid NOT NULL,
    psri_shortage_acc_year character(9) NOT NULL,
    psri_item_id uuid NOT NULL,
    psri_uom_id uuid NOT NULL,
    psri_base_uom_id uuid NOT NULL,
    psri_to_base_factor numeric(18,9) DEFAULT 1 NOT NULL,
    psri_hsn_code character varying(8),
    psri_weight numeric(15,3),
    psri_qty numeric(18,6) DEFAULT 0 NOT NULL,
    psri_cost_rate numeric(18,6) DEFAULT 0 NOT NULL,
    psri_value numeric(15,2) DEFAULT 0 NOT NULL,
    psri_gst_released numeric(15,2) DEFAULT 0 NOT NULL,
    psri_remarks character varying(250),
    psri_is_deleted boolean DEFAULT false NOT NULL,
    psri_sync_date timestamp(6) with time zone,
    psri_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    psri_created_by character varying(50) NOT NULL,
    psri_modified_on timestamp(6) with time zone,
    psri_modified_by character varying(50),
    CONSTRAINT ck_psri_qty CHECK (psri_qty > 0)
)
PARTITION BY LIST (psri_acc_year);
ALTER TABLE purchase.pur_shortage_receipt_item ADD CONSTRAINT pk_pur_shortage_receipt_item PRIMARY KEY (psri_id, psri_acc_year);
CREATE TABLE purchase.pur_shortage_receipt_item_2024_2025 PARTITION OF purchase.pur_shortage_receipt_item FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_shortage_receipt_item_2025_2026 PARTITION OF purchase.pur_shortage_receipt_item FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_shortage_receipt_item_2026_2027 PARTITION OF purchase.pur_shortage_receipt_item FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_shortage_receipt_item_2027_2028 PARTITION OF purchase.pur_shortage_receipt_item FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_shortage_receipt_item ADD CONSTRAINT fk_psri_psr FOREIGN KEY (psri_psr_id, psri_acc_year) REFERENCES purchase.pur_shortage_receipt (psr_id, psr_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_psri_psr ON purchase.pur_shortage_receipt_item (psri_psr_id, psri_acc_year, psri_line_no) WHERE (psri_is_deleted = false);
ALTER TABLE purchase.pur_shortage_receipt_item ADD CONSTRAINT fk_psri_item FOREIGN KEY (psri_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage_receipt_item ADD CONSTRAINT fk_psri_uom FOREIGN KEY (psri_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_shortage_receipt_item ADD CONSTRAINT fk_psri_base_uom FOREIGN KEY (psri_base_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_psri_item ON purchase.pur_shortage_receipt_item (psri_item_id) WHERE (psri_is_deleted = false);
ALTER TABLE purchase.pur_shortage_receipt_item ADD CONSTRAINT fk_psri_shortage FOREIGN KEY (psri_shortage_id, psri_shortage_acc_year) REFERENCES purchase.pur_shortage (psh_id, psh_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 8 · purchase return / claim / replace ─────────────────────────────
CREATE TABLE purchase.pur_return (
    pr_id uuid DEFAULT uuidv7() NOT NULL,
    pr_company_id uuid NOT NULL,
    pr_branch_id uuid NOT NULL,
    pr_tenant_id uuid,
    pr_acc_year character(9) NOT NULL,
    pr_device_id uuid NOT NULL,
    pr_session_id uuid,
    pr_slno bigint NOT NULL,
    pr_refno character varying(40) NOT NULL,
    pr_doc_date date NOT NULL,
    pr_doc_datetime timestamp(6) with time zone DEFAULT now() NOT NULL,
    pr_status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    pr_kind character varying(20) DEFAULT 'AGAINST_INVOICE'::character varying NOT NULL,
    pr_src_doc_id uuid NOT NULL,
    pr_src_acc_year character(9) NOT NULL,
    pr_supplier_id uuid NOT NULL,
    pr_godown_id uuid,
    pr_settlement character varying(10) DEFAULT 'ADJUST'::character varying NOT NULL,
    pr_pos_stcd character(2),
    pr_supplier_cn_no character varying(60),
    pr_supplier_cn_date date,
    pr_ewb_no character varying(15),
    pr_ewb_date date,
    pr_vehicle_no character varying(20),
    pr_driver_name character varying(100),
    pr_our_ref character varying(60),
    pr_return_value numeric(15,2) DEFAULT 0 NOT NULL,
    pr_claim_value numeric(15,2) DEFAULT 0 NOT NULL,
    pr_itc_reversed numeric(15,2) DEFAULT 0 NOT NULL,
    pr_replace_qty_base numeric(18,6) DEFAULT 0 NOT NULL,
    pr_remarks character varying(500),
    pr_revision_no integer DEFAULT 1 NOT NULL,
    pr_print_count integer DEFAULT 0 NOT NULL,
    pr_posted_voucher_id uuid,
    pr_is_deleted boolean DEFAULT false NOT NULL,
    pr_sync_date timestamp(6) with time zone,
    pr_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    pr_created_by character varying(50) NOT NULL,
    pr_modified_on timestamp(6) with time zone,
    pr_modified_by character varying(50),
    CONSTRAINT ck_pr_status CHECK (pr_status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    CONSTRAINT ck_pr_kind CHECK (pr_kind IN ('AGAINST_INVOICE','AGAINST_GRN')),
    CONSTRAINT ck_pr_settlement CHECK (pr_settlement IN ('ADJUST','CASH','ADVANCE'))
)
PARTITION BY LIST (pr_acc_year);
ALTER TABLE purchase.pur_return ADD CONSTRAINT pk_pur_return PRIMARY KEY (pr_id, pr_acc_year);
COMMENT ON TABLE purchase.pur_return IS 'One document, outcome PER ROW (Return / Claim sent / Claim destroyed / Replace). Against a GRN (not billed yet) = rejection at the gate.';
CREATE TABLE purchase.pur_return_2024_2025 PARTITION OF purchase.pur_return FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_return_2025_2026 PARTITION OF purchase.pur_return FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_return_2026_2027 PARTITION OF purchase.pur_return FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_return_2027_2028 PARTITION OF purchase.pur_return FOR VALUES IN ('2027-2028');

CREATE UNIQUE INDEX ux_pr_device_slno ON purchase.pur_return (pr_company_id, pr_branch_id, pr_acc_year, pr_device_id, pr_slno);
CREATE UNIQUE INDEX ux_pr_refno ON purchase.pur_return (pr_company_id, pr_branch_id, pr_acc_year, pr_refno);
CREATE INDEX ix_pr_branch_date ON purchase.pur_return (pr_company_id, pr_branch_id, pr_doc_date DESC) WHERE (pr_is_deleted = false);
ALTER TABLE purchase.pur_return ADD CONSTRAINT fk_pr_company FOREIGN KEY (pr_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return ADD CONSTRAINT fk_pr_branch FOREIGN KEY (pr_branch_id) REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return ADD CONSTRAINT fk_pr_device FOREIGN KEY (pr_device_id) REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return ADD CONSTRAINT fk_pr_supplier FOREIGN KEY (pr_supplier_id) REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return ADD CONSTRAINT fk_pr_godown FOREIGN KEY (pr_godown_id) REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return ADD CONSTRAINT fk_pr_pos FOREIGN KEY (pr_pos_stcd) REFERENCES fixed.state_codes (state_code) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_pr_src ON purchase.pur_return (pr_src_doc_id, pr_src_acc_year) WHERE (pr_is_deleted = false);

CREATE TABLE purchase.pur_return_item (
    pri_id uuid DEFAULT uuidv7() NOT NULL,
    pri_pr_id uuid NOT NULL,
    pri_company_id uuid NOT NULL,
    pri_branch_id uuid NOT NULL,
    pri_acc_year character(9) NOT NULL,
    pri_line_no integer NOT NULL,
    pri_item_id uuid NOT NULL,
    pri_uom_id uuid NOT NULL,
    pri_base_uom_id uuid NOT NULL,
    pri_to_base_factor numeric(18,9) DEFAULT 1 NOT NULL,
    pri_hsn_code character varying(8),
    pri_weight numeric(15,3),
    pri_src_doc_type character varying(20),
    pri_src_doc_id uuid,
    pri_src_doc_year character(9),
    pri_src_item_id uuid,
    pri_src_doc_line_no integer,
    pri_src_doc_refno character varying(40),
    pri_outcome character varying(20) NOT NULL,
    pri_reason_id uuid,
    pri_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pri_free_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pri_rate numeric(18,6) DEFAULT 0 NOT NULL,
    pri_disc_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pri_disc_per_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pri_disc_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_sch_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pri_sch_per_qty numeric(18,6) DEFAULT 0 NOT NULL,
    pri_sch_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_extra_disc_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_chrg_before_tax numeric(15,2) DEFAULT 0 NOT NULL,
    pri_chrg_after_tax numeric(15,2) DEFAULT 0 NOT NULL,
    pri_gross_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_taxable_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_tax_id uuid,
    pri_gst_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pri_cgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_sgst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_igst_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_cess_pct numeric(9,4) DEFAULT 0 NOT NULL,
    pri_cess_per_unit numeric(18,6) DEFAULT 0 NOT NULL,
    pri_cess_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_total_amt numeric(15,2) DEFAULT 0 NOT NULL,
    pri_lot_cost_value numeric(15,2) DEFAULT 0 NOT NULL,
    pri_itc_reversed_in_books boolean DEFAULT true NOT NULL,
    pri_supplier_cn_status character varying(10) DEFAULT 'PENDING'::character varying NOT NULL,
    pri_claim_against character varying(12),
    pri_claim_party_id uuid,
    pri_remarks character varying(250),
    pri_is_deleted boolean DEFAULT false NOT NULL,
    pri_sync_date timestamp(6) with time zone,
    pri_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    pri_created_by character varying(50) NOT NULL,
    pri_modified_on timestamp(6) with time zone,
    pri_modified_by character varying(50),
    CONSTRAINT ck_pri_outcome CHECK (pri_outcome IN ('RETURN','CLAIM_SENT','CLAIM_DESTROYED','REPLACE')),
    CONSTRAINT ck_pri_cn_status CHECK (pri_supplier_cn_status IN ('PENDING','MATCHED','NONE')),
    CONSTRAINT ck_pri_claim CHECK ((pri_outcome IN ('CLAIM_SENT','CLAIM_DESTROYED')) = (pri_claim_against IS NOT NULL)),
    CONSTRAINT ck_pri_claim_against CHECK (pri_claim_against IS NULL OR pri_claim_against IN ('SUPPLIER','TRANSPORTER','INSURER')),
    CONSTRAINT ck_pri_src CHECK (pri_src_doc_type IS NOT NULL AND ((pri_src_doc_type IS NULL) = (pri_src_item_id IS NULL)) AND ((pri_src_doc_type IS NULL) = (pri_src_doc_id IS NULL)) AND ((pri_src_doc_type IS NULL) = (pri_src_doc_year IS NULL)) AND (pri_src_doc_type IS NULL OR pri_src_doc_type IN ('PURCHASE_BILL', 'GRN'))),
    CONSTRAINT ck_pri_qty CHECK (pri_qty >= 0 AND pri_free_qty >= 0 AND pri_qty + pri_free_qty > 0)
)
PARTITION BY LIST (pri_acc_year);
ALTER TABLE purchase.pur_return_item ADD CONSTRAINT pk_pur_return_item PRIMARY KEY (pri_id, pri_acc_year);
CREATE TABLE purchase.pur_return_item_2024_2025 PARTITION OF purchase.pur_return_item FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_return_item_2025_2026 PARTITION OF purchase.pur_return_item FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_return_item_2026_2027 PARTITION OF purchase.pur_return_item FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_return_item_2027_2028 PARTITION OF purchase.pur_return_item FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_return_item ADD CONSTRAINT fk_pri_pr FOREIGN KEY (pri_pr_id, pri_acc_year) REFERENCES purchase.pur_return (pr_id, pr_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_pri_pr ON purchase.pur_return_item (pri_pr_id, pri_acc_year, pri_line_no) WHERE (pri_is_deleted = false);
ALTER TABLE purchase.pur_return_item ADD CONSTRAINT fk_pri_item FOREIGN KEY (pri_item_id) REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return_item ADD CONSTRAINT fk_pri_uom FOREIGN KEY (pri_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return_item ADD CONSTRAINT fk_pri_base_uom FOREIGN KEY (pri_base_uom_id) REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_pri_item ON purchase.pur_return_item (pri_item_id) WHERE (pri_is_deleted = false);
CREATE INDEX ix_pri_src_item ON purchase.pur_return_item (pri_src_doc_type, pri_src_item_id, pri_src_doc_year) WHERE (pri_src_item_id IS NOT NULL AND pri_is_deleted = false);
ALTER TABLE purchase.pur_return_item ADD CONSTRAINT fk_pri_reason FOREIGN KEY (pri_reason_id) REFERENCES stock.stock_reason_master (srm_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE purchase.pur_return_item ADD CONSTRAINT fk_pri_claim_party FOREIGN KEY (pri_claim_party_id) REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE purchase.pur_claim_settlement (
    pcs_id uuid DEFAULT uuidv7() NOT NULL,
    pcs_company_id uuid NOT NULL,
    pcs_branch_id uuid NOT NULL,
    pcs_acc_year character(9) NOT NULL,
    pcs_device_id uuid,
    pcs_return_item_id uuid NOT NULL,
    pcs_return_item_acc_year character(9) NOT NULL,
    pcs_action character varying(15) NOT NULL,
    pcs_received_as character varying(10),
    pcs_amount numeric(15,2) DEFAULT 0 NOT NULL,
    pcs_gst_reavailed numeric(15,2) DEFAULT 0 NOT NULL,
    pcs_cn_no character varying(60),
    pcs_cn_date date,
    pcs_reason character varying(250),
    pcs_doc_date date NOT NULL,
    pcs_voucher_id uuid,
    pcs_reversal_of_id uuid,
    pcs_is_deleted boolean DEFAULT false NOT NULL,
    pcs_sync_date timestamp(6) with time zone,
    pcs_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    pcs_created_by character varying(50) NOT NULL,
    pcs_modified_on timestamp(6) with time zone,
    pcs_modified_by character varying(50),
    CONSTRAINT ck_pcs_action CHECK (pcs_action IN ('CREDIT','SHORT_SETTLED','REJECTED')),
    CONSTRAINT ck_pcs_received_as CHECK (pcs_received_as IS NULL OR pcs_received_as IN ('CN','CASH','BANK','ADJUST')),
    CONSTRAINT ck_pcs_reversal_sign CHECK ((pcs_reversal_of_id IS NULL AND pcs_amount >= 0) OR (pcs_reversal_of_id IS NOT NULL AND pcs_amount <= 0))
)
PARTITION BY LIST (pcs_acc_year);
ALTER TABLE purchase.pur_claim_settlement ADD CONSTRAINT pk_pur_claim_settlement PRIMARY KEY (pcs_id, pcs_acc_year);
COMMENT ON TABLE purchase.pur_claim_settlement IS 'Settlements of a claim row, in parts. Open = value − Σ settled (derived). Undo = a reversing row, never a delete (like acc_bill_adjustment).';
CREATE TABLE purchase.pur_claim_settlement_2024_2025 PARTITION OF purchase.pur_claim_settlement FOR VALUES IN ('2024-2025');
CREATE TABLE purchase.pur_claim_settlement_2025_2026 PARTITION OF purchase.pur_claim_settlement FOR VALUES IN ('2025-2026');
CREATE TABLE purchase.pur_claim_settlement_2026_2027 PARTITION OF purchase.pur_claim_settlement FOR VALUES IN ('2026-2027');
CREATE TABLE purchase.pur_claim_settlement_2027_2028 PARTITION OF purchase.pur_claim_settlement FOR VALUES IN ('2027-2028');

ALTER TABLE purchase.pur_claim_settlement ADD CONSTRAINT fk_pcs_return_item FOREIGN KEY (pcs_return_item_id, pcs_return_item_acc_year) REFERENCES purchase.pur_return_item (pri_id, pri_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX ix_pcs_return_item ON purchase.pur_claim_settlement (pcs_return_item_id, pcs_return_item_acc_year) WHERE (pcs_is_deleted = false);


-- ── 8b · attachments: bill scans / photos, many pages (P16) ──────────────
CREATE TABLE public.txn_attachment (
    tat_id uuid DEFAULT uuidv7() NOT NULL,
    tat_company_id uuid NOT NULL,
    tat_branch_id uuid NOT NULL,
    tat_acc_year character(9) NOT NULL,
    tat_src_module character varying(15) NOT NULL,
    tat_src_doc_type character varying(30) NOT NULL,
    tat_src_doc_id uuid NOT NULL,
    tat_page_no smallint DEFAULT 1 NOT NULL,
    tat_file_name character varying(200) NOT NULL,
    tat_mime_type character varying(60) NOT NULL,
    tat_size_bytes integer NOT NULL,
    tat_sha256 character(64) NOT NULL,
    tat_content bytea NOT NULL,
    tat_caption character varying(200),
    tat_is_deleted boolean DEFAULT false NOT NULL,
    tat_sync_date timestamp(6) with time zone,
    tat_created_on timestamp(6) with time zone DEFAULT now() NOT NULL,
    tat_created_by character varying(50) NOT NULL,
    tat_modified_on timestamp(6) with time zone,
    tat_modified_by character varying(50),
    CONSTRAINT ck_tat_module CHECK (tat_src_module IN ('SALES','PURCHASE','INVENTORY','ACCOUNTS','POS','SERVICE','OTHER')),
    CONSTRAINT ck_tat_mime CHECK (tat_mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
    CONSTRAINT ck_tat_size CHECK (tat_size_bytes > 0 AND tat_size_bytes = octet_length(tat_content)),
    CONSTRAINT ck_tat_page CHECK (tat_page_no >= 1)
)
PARTITION BY LIST (tat_acc_year);
ALTER TABLE public.txn_attachment ADD CONSTRAINT pk_txn_attachment PRIMARY KEY (tat_id, tat_acc_year);
COMMENT ON TABLE public.txn_attachment IS 'Scans / photos attached to any document, one row per page or file (a bill scan may be several pages). Stored in the DB (as 3.0 voucher_images) so backups and branch sync carry it; the API caps the size per file. Delete = soft (is_deleted).';
CREATE TABLE public.txn_attachment_2024_2025 PARTITION OF public.txn_attachment FOR VALUES IN ('2024-2025');
CREATE TABLE public.txn_attachment_2025_2026 PARTITION OF public.txn_attachment FOR VALUES IN ('2025-2026');
CREATE TABLE public.txn_attachment_2026_2027 PARTITION OF public.txn_attachment FOR VALUES IN ('2026-2027');
CREATE TABLE public.txn_attachment_2027_2028 PARTITION OF public.txn_attachment FOR VALUES IN ('2027-2028');

CREATE INDEX ix_tat_doc ON public.txn_attachment (tat_src_doc_type, tat_src_doc_id, tat_page_no) WHERE (tat_is_deleted = false);
ALTER TABLE public.txn_attachment ADD CONSTRAINT fk_tat_company FOREIGN KEY (tat_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.txn_attachment ADD CONSTRAINT fk_tat_branch FOREIGN KEY (tat_branch_id) REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 9 · next years get purchase partitions too ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_create_year_partitions(p_acc_year character)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    r        record;
    v_year   text    := trim(p_acc_year);
    v_suffix text    := replace(trim(p_acc_year), '-', '_');
    v_count  integer := 0;
BEGIN
    IF v_year !~ '^\d{4}-\d{4}$' THEN
        RAISE EXCEPTION 'acc_year must look like 2026-2027, got %', p_acc_year;
    END IF;

    FOR r IN
        SELECT n.nspname AS sch, c.relname AS tbl
          FROM pg_partitioned_table pt
          JOIN pg_class     c ON c.oid = pt.partrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname IN ('public', 'sales', 'accounts', 'purchase')   -- 'purchase' added 20261028110000
           AND pt.partstrat = 'l'      -- LIST-partitioned only
           AND pt.partnatts = 1        -- single-column key (acc_year)
         ORDER BY n.nspname, c.relname
    LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I FOR VALUES IN (%L)',
            r.sch, r.tbl || '_' || v_suffix, r.sch, r.tbl, v_year);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;   -- number of parents visited
END $function$;

-- ── 10 · sync triggers + pending indexes for every new table ─────────────
SELECT public.sync_install_triggers();
