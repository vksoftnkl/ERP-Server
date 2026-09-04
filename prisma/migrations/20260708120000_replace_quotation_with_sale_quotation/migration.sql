-- Replace the old quotation tables with the new sale_quotation design.
DROP TABLE IF EXISTS "sales"."quotation_detail";
DROP TABLE IF EXISTS "sales"."quotation_master";

CREATE SCHEMA IF NOT EXISTS sales;

-- =============================================================================
-- 1. SALE_QUOTATION  (header)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales.sale_quotation
(
    sq_id                 uuid            NOT NULL DEFAULT uuidv7(),

    -- ---- scope --------------------------------------------------------------
    sq_company_id         uuid            NOT NULL,
    sq_branch_id          uuid            NOT NULL,
    sq_tenant_id          uuid            NOT NULL,
    sq_acc_year           char(9)         NOT NULL,
    sq_session_id         uuid,
    sq_category_id        uuid,
    sq_price_level        integer         NOT NULL,

    -- ---- document identity --------------------------------------------------
    sq_doc_type           varchar(30)     NOT NULL DEFAULT 'QUOTATION',  -- QUOTATION / PROFORMA
    sq_quote_slno         bigint          NOT NULL,
    sq_quote_refno        varchar(100)    NOT NULL,
    sq_usr_refno          varchar(100),
    sq_quote_date         date            NOT NULL,
    sq_quote_datetime     timestamptz(6)  NOT NULL DEFAULT now(),
    sq_valid_until        date,                                -- offer expiry (drives EXPIRED)
    sq_validity_days      integer,

    -- ---- revision / versioning ----------------------------------------------
    sq_revision_no        integer         NOT NULL DEFAULT 0,
    sq_parent_quote_id    uuid,                                -- self-ref: the quote this revises

    -- ---- source (enquiry / lead) --------------------------------------------
    sq_src_doc_type       varchar(30),                         -- ENQUIRY / LEAD (polymorphic -> no FK)
    sq_src_doc_id         uuid,
    sq_src_doc_refno      varchar(100),
    sq_src_doc_date       timestamptz(6),

    -- ---- customer / prospect snapshot ---------------------------------------
    sq_cust_id            uuid,                                -- NULLABLE: may be a prospect
    sq_cust_area_id       uuid,                                -- route / area (distribution)
    sq_cust_name          varchar(200)    NOT NULL,
    sq_cust_addr          varchar(500),
    sq_cust_place         varchar(100),
    sq_cust_phone         varchar(20),
    sq_cust_email         varchar(150),
    sq_cust_gstin         varchar(15),
    sq_cust_gst_type      varchar(20),
    sq_cust_stcd          char(2),
    sq_pos_stcd           char(2),                             -- place of supply (CGST/SGST vs IGST)
    sq_contact_person     varchar(150),
    sq_contact_phone      varchar(20),

    -- ---- applicability flags ------------------------------------------------
    sq_has_load           boolean         NOT NULL DEFAULT false,
    sq_has_unload         boolean         NOT NULL DEFAULT false,
    sq_has_freight        boolean         NOT NULL DEFAULT false,
    sq_has_promo          boolean         NOT NULL DEFAULT false,
    sq_has_comm           boolean         NOT NULL DEFAULT false,

    -- ---- people -------------------------------------------------------------
    sq_user_id            uuid            NOT NULL,
    sq_salesman_id        uuid,
    sq_agent_id           uuid,

    -- ---- counts / weight ----------------------------------------------------
    sq_tot_items          integer         NOT NULL DEFAULT 0,
    sq_tot_weight         numeric(15,3)   NOT NULL DEFAULT 0,
    sq_tot_bags           numeric(15,3)   NOT NULL DEFAULT 0,

    -- ---- amounts (priced-out offer; numeric(15,2)) --------------------------
    sq_gross_amt          numeric(15,2)   NOT NULL DEFAULT 0,
    sq_item_disc          numeric(15,2)   NOT NULL DEFAULT 0,
    sq_spl_disc           numeric(15,2)   NOT NULL DEFAULT 0,
    sq_sch_disc           numeric(15,2)   NOT NULL DEFAULT 0,
    sq_bill_sch_disc      numeric(15,2)   NOT NULL DEFAULT 0,
    sq_addl_disc1         numeric(15,2)   NOT NULL DEFAULT 0,
    sq_addl_disc2         numeric(15,2)   NOT NULL DEFAULT 0,
    sq_taxable_amt        numeric(15,2)   NOT NULL DEFAULT 0,
    sq_cgst_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sq_sgst_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sq_igst_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sq_cess_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sq_tax_amt            numeric(15,2)   NOT NULL DEFAULT 0,
    sq_freight_amt        numeric(15,2)   NOT NULL DEFAULT 0,
    sq_load_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sq_unload_amt         numeric(15,2)   NOT NULL DEFAULT 0,
    sq_other_amt1         numeric(15,2)   NOT NULL DEFAULT 0,
    sq_other_amt2         numeric(15,2)   NOT NULL DEFAULT 0,
    sq_round_off          numeric(15,2)   NOT NULL DEFAULT 0,
    sq_quote_amt          numeric(15,2)   NOT NULL DEFAULT 0,   -- grand total offered

    -- ---- internal margin (never printed) ------------------------------------
    sq_total_cost         numeric(15,2),
    sq_margin_amt         numeric(15,2),
    sq_margin_perc        numeric(15,4),

    -- ---- terms --------------------------------------------------------------
    sq_payment_terms      varchar(250),
    sq_delivery_terms     varchar(250),
    sq_terms_conditions   text,

    -- ---- status + conversion tracking ---------------------------------------
    sq_status             varchar(20)     NOT NULL DEFAULT 'DRAFT',
        -- DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED / CONVERTED / CANCELLED
    sq_sent_on            timestamptz(6),
    sq_accepted_on        timestamptz(6),
    sq_rejected_on        timestamptz(6),
    sq_reject_reason      varchar(250),
    sq_converted_doc_type varchar(30),                         -- SALE_ORDER
    sq_converted_doc_id   uuid,                                -- polymorphic -> no FK
    sq_converted_on       timestamptz(6),

    -- ---- approval / cancel --------------------------------------------------
    sq_approved_on        timestamptz(6),
    sq_approved_by        uuid,
    sq_cancelled_on       timestamptz(6),
    sq_cancelled_by       uuid,
    sq_cancel_reason      varchar(250),

    -- ---- print / device / sync + standard audit -----------------------------
    sq_print_count        integer         NOT NULL DEFAULT 0,
    sq_device_type        varchar(20),
    sq_device_id          uuid,
    sq_remarks            varchar(500),
    sq_is_deleted         boolean         NOT NULL DEFAULT false,
    sq_sync_date          timestamptz(6),
    sq_created_on         timestamptz(6)  NOT NULL DEFAULT now(),
    sq_created_by         uuid            NOT NULL,
    sq_modified_on        timestamptz(6),
    sq_modified_by        uuid,

    CONSTRAINT pk_sale_quotation PRIMARY KEY (sq_id),
    CONSTRAINT fk_sq_parent
        FOREIGN KEY (sq_parent_quote_id) REFERENCES sales.sale_quotation (sq_id),
    CONSTRAINT ck_sq_status
        CHECK (sq_status IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CONVERTED','CANCELLED'))
);

CREATE UNIQUE INDEX ux_sq_quote_no
    ON sales.sale_quotation (sq_company_id, sq_branch_id, sq_acc_year, sq_quote_refno, sq_revision_no)
    WHERE sq_is_deleted = false;
CREATE UNIQUE INDEX ux_sq_slno
    ON sales.sale_quotation (sq_company_id, sq_branch_id, sq_acc_year, sq_quote_slno)
    WHERE sq_is_deleted = false;

CREATE INDEX ix_sq_date    ON sales.sale_quotation (sq_company_id, sq_branch_id, sq_quote_date);
CREATE INDEX ix_sq_cust    ON sales.sale_quotation (sq_cust_id) WHERE sq_cust_id IS NOT NULL;
CREATE INDEX ix_sq_status  ON sales.sale_quotation (sq_status) WHERE sq_is_deleted = false;
CREATE INDEX ix_sq_valid   ON sales.sale_quotation (sq_valid_until)
    WHERE sq_status IN ('SENT','ACCEPTED') AND sq_is_deleted = false;   -- expiry sweep
CREATE INDEX ix_sq_conv    ON sales.sale_quotation (sq_converted_doc_id) WHERE sq_converted_doc_id IS NOT NULL;
CREATE INDEX ix_sq_parent  ON sales.sale_quotation (sq_parent_quote_id) WHERE sq_parent_quote_id IS NOT NULL;


-- =============================================================================
-- 2. SALE_QUOTATION_ITEM  (lines; one row per item)
-- -----------------------------------------------------------------------------
-- Batch/expiry/available_stock here are INFORMATIONAL (availability shown while
-- quoting). A quote allocates NO stock -- allocation happens at DC/invoice.
-- sqi_qty_converted tracks how much of this quote line has become an order.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales.sale_quotation_item
(
    sqi_id                 uuid            NOT NULL DEFAULT uuidv7(),

    sqi_quote_id           uuid            NOT NULL,           -- FK -> sale_quotation(sq_id)
    sqi_company_id         uuid            NOT NULL,
    sqi_branch_id          uuid            NOT NULL,
    sqi_tenant_id          uuid            NOT NULL,
    sqi_acc_year           char(9)         NOT NULL,

    -- source (enquiry line -> quote line). Polymorphic -> no FK.
    sqi_src_doc_type       varchar(30),
    sqi_src_item_id        uuid,
    sqi_src_unit_id        uuid,
    sqi_src_doc_refno      varchar(100),
    sqi_src_item_qty       numeric(15,3),                      -- qty pulled from source

    sqi_line_no            integer         NOT NULL,
    sqi_item_id            uuid            NOT NULL,
    sqi_item_code          varchar(50),                        -- snapshot
    sqi_item_name          varchar(200),                       -- snapshot
    sqi_unit_id            uuid            NOT NULL,
    sqi_hsn_code           varchar(8),                         -- HSN (goods) / SAC (service)
    sqi_price_level        integer         NOT NULL,
    sqi_ean_code           varchar(100),
    sqi_batch_no           varchar(100),                       -- informational (specific batch offer)
    sqi_batch_date         date,
    sqi_expiry_date        date,

    -- line flags
    sqi_is_tax_incl        boolean         NOT NULL DEFAULT false,
    sqi_is_promo           boolean         NOT NULL DEFAULT false,
    sqi_is_free            boolean         NOT NULL DEFAULT false,
    sqi_free_type          varchar(20),                        -- NULL / SCHEME / SAMPLE
    sqi_is_service         boolean         NOT NULL DEFAULT false,

    -- quantities
    sqi_qty                numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_qty_length         numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_item_weight        numeric(15,3)   DEFAULT 0,
    sqi_qty_converted      numeric(15,3)   NOT NULL DEFAULT 0,  -- qty already turned into an order
    sqi_available_stock    numeric(15,3)   NOT NULL DEFAULT 0,  -- availability shown at quote time

    -- rate / price
    sqi_rate               numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_rate_pre_tax       numeric(15,4)   NOT NULL DEFAULT 0,

    -- discounts
    sqi_item_disc_perc     numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_item_disc_qty      numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_item_disc_amt      numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_spl_disc_perc      numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_spl_disc_qty       numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_spl_disc_amt       numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_sch_disc_perc      numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_sch_disc_qty       numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_sch_disc_amt       numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_bill_sch_perc      numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_bill_sch_qty       numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_bill_sch_amt       numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_addl_disc1_perc    numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_addl_disc1_amt     numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_addl_disc2_perc    numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_addl_disc2_amt     numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_cash_disc_perc     numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_cash_disc_amt      numeric(15,2)   NOT NULL DEFAULT 0,

    -- amounts + tax
    sqi_gross_amt          numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_taxable_amt        numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_tax_perc           numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_tax_amt            numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_cgst_perc          numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_cgst_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_sgst_perc          numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_sgst_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_igst_perc          numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_igst_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_cess_perc          numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_cess_per_unit      numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_cess_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_acess_perc         numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_acess_per_unit     numeric(15,4)   NOT NULL DEFAULT 0,
    sqi_acess_amt          numeric(15,2)   NOT NULL DEFAULT 0,

    -- line charges + net
    sqi_freight_qty        numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_freight_amt        numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_load_qty           numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_load_amt           numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_unload_qty         numeric(15,3)   NOT NULL DEFAULT 0,
    sqi_unload_amt         numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_round_off          numeric(15,2)   NOT NULL DEFAULT 0,
    sqi_net_amt            numeric(15,2)   NOT NULL DEFAULT 0,

    -- internal margin
    sqi_cost_price         numeric(15,4),
    sqi_max_price          numeric(15,4),
    sqi_min_price          numeric(15,4),
    sqi_act_price          numeric(15,4),
    sqi_quote_price        numeric(15,4),
    sqi_item_profit        numeric(15,2),
    sqi_cost_pre_tax       numeric(15,2),
    sqi_quote_pre_tax      numeric(15,2),
    sqi_profit_pre_tax     numeric(15,2),

    -- scheme ref (display only on a quote)
    sqi_scheme_id          uuid,
    sqi_scheme_name        varchar(150),

    sqi_remarks            varchar(250),
    sqi_is_deleted         boolean         NOT NULL DEFAULT false,
    sqi_sync_date          timestamptz(6),
    sqi_created_on         timestamptz(6)  NOT NULL DEFAULT now(),
    sqi_created_by         uuid            NOT NULL,
    sqi_modified_on        timestamptz(6),
    sqi_modified_by        uuid,

    CONSTRAINT pk_sale_quotation_item PRIMARY KEY (sqi_id),
    CONSTRAINT fk_sqi_quote
        FOREIGN KEY (sqi_quote_id) REFERENCES sales.sale_quotation (sq_id),
    CONSTRAINT ck_sqi_free_type
        CHECK (sqi_free_type IS NULL OR sqi_free_type IN ('SCHEME','SAMPLE'))
);

CREATE UNIQUE INDEX ux_sqi_quote_line
    ON sales.sale_quotation_item (sqi_quote_id, sqi_line_no) WHERE sqi_is_deleted = false;
CREATE INDEX ix_sqi_quote ON sales.sale_quotation_item (sqi_quote_id);
CREATE INDEX ix_sqi_item  ON sales.sale_quotation_item (sqi_item_id);
CREATE INDEX ix_sqi_hsn   ON sales.sale_quotation_item (sqi_hsn_code);
