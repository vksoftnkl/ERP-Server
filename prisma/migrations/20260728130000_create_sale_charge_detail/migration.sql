-- Per-document applied charges — freight, loading, packing, cash discount, etc.
-- One row per charge line on a document, shared by every module (sales,
-- purchase, quotation, GRN, invoice) via the cd_doc_type discriminator.
--
-- Every cd_* column except the amounts is a SNAPSHOT taken from charge_master
-- (and its ledger) at save time, so editing a charge master later never rewrites
-- what was already invoiced.
CREATE TABLE IF NOT EXISTS "public"."sale_charge_detail" (
    "cd_id"             uuid           NOT NULL DEFAULT gen_random_uuid(),

    -- -- Parent document (polymorphic — no single FK possible) --------------
    "cd_doc_type"       varchar(12)    NOT NULL,          -- which module's document
    "cd_doc_id"         uuid           NOT NULL,          -- parent document id
    "cd_slno"           integer,                          -- line order within the document

    -- -- Denormalised context (lets sale_charge_detail be queried/reported
    --    without joining the parent document) -----------------------------
    "cd_comp_id"        uuid           NOT NULL,
    "cd_branch_id"      uuid           NOT NULL,
    "cd_acc_year"       char(9)        NOT NULL,
    "cd_voucher_no"     bigint,

    -- -- Charge reference + snapshots --------------------------------------
    "cd_chg_id"         uuid           NOT NULL,          -- FK charge_master.chg_id
    "cd_chg_name"       varchar(100),                     -- snapshot, for print/history
    "cd_role"           varchar(15),                      -- FREIGHT|LOADING|UNLOADING|CASH_DISC|OTHERS|NONE
    "cd_method"         varchar(10),                      -- how the amount is computed
    "cd_type"           varchar(10)    NOT NULL DEFAULT 'ADD',   -- ADD | DEDUCT (the sign)
    "cd_apply_on"       varchar(10),                      -- distribution basis for a FIXED lump sum
    "cd_ledger_code"    uuid           NOT NULL,          -- GL ledger this charge posts to

    -- -- Landing cost + posting flags --------------------------------------
    "cd_landing_cost"   boolean        NOT NULL DEFAULT false,   -- purchase: adds to item landing cost
    "cd_cost_alloc"     varchar(10),                             -- how that landing cost is allocated
    -- The two tax flags are mutually exclusive (ck_cd_tax_apl). before_tax folds
    -- the charge into the goods' taxable value, so it is taxed at each ITEM's own
    -- GST rate; tax_apl means the charge carries its OWN GST, after tax. Both at
    -- once would tax it twice. A row with neither is a flat, untaxed adjustment.
    "cd_before_tax"     boolean        NOT NULL DEFAULT false,
    "cd_tax_apl"        boolean        NOT NULL DEFAULT false,
    "cd_sep_post"       boolean        NOT NULL DEFAULT false,   -- post to its own ledger vs absorb

    -- -- Basis + amounts ---------------------------------------------------
    "cd_unit"           varchar(15),
    "cd_qty_val"        numeric(18,4),                    -- qty or value basis keyed on the line
    "cd_weight"         numeric(18,4),                    -- weight / tonnage basis
    -- rate 0 with a non-zero amount is meaningful, NOT missing data: the operator
    -- priced the charge by typing its total, and the client spreads that total in
    -- the method's own shape rather than deriving a rate. Never add a
    -- rate-is-required constraint.
    "cd_rate"           numeric(14,4),                    -- rate or %, per cd_method
    "cd_amount"         numeric(14,4),                    -- charge amount BEFORE tax

    -- -- Tax (non-zero only when cd_tax_apl AND NOT cd_before_tax) ----------
    "cd_tax_code"       uuid,
    "cd_hsn"            varchar(15),                      -- HSN/SAC, snapshot from the ledger
    "cd_tax_perc"       numeric(9,4),
    "cd_tax_amt"        numeric(14,4),
    "cd_sgst_perc"      numeric(9,4),
    "cd_sgst_amt"       numeric(14,4),
    "cd_cgst_perc"      numeric(9,4),
    "cd_cgst_amt"       numeric(14,4),
    "cd_igst_perc"      numeric(9,4),
    "cd_igst_amt"       numeric(14,4),
    "cd_cess_perc"      numeric(9,4),
    "cd_cess_amt"       numeric(14,4),
    "cd_net_amt"        numeric(14,4),                    -- cd_amount + its own tax

    -- -- Status + audit ----------------------------------------------------
    "cd_remarks"        varchar(255),
    "cd_is_active"      boolean        NOT NULL DEFAULT true,
    "cd_is_deleted"     boolean        NOT NULL DEFAULT false,
    "cd_sync_date"      timestamptz,
    "cd_created_on"     timestamptz    NOT NULL DEFAULT now(),
    "cd_created_by"     uuid,
    "cd_modified_on"    timestamptz,
    "cd_modified_by"    uuid,

    CONSTRAINT "sale_charge_detail_pkey" PRIMARY KEY ("cd_id"),

    -- Taxed at the item rate, or carrying its own GST — never both. Prisma does
    -- not model CHECK constraints, so this lives only here.
    CONSTRAINT "ck_cd_tax_apl" CHECK (NOT ("cd_tax_apl" AND "cd_before_tax"))
);

-- Fetch all charge lines for one document (the hot path on entry load).
CREATE INDEX IF NOT EXISTS "ix_sale_charge_detail_doc"
    ON "public"."sale_charge_detail" ("cd_doc_type", "cd_doc_id");

ALTER TABLE "public"."sale_charge_detail"
    ADD CONSTRAINT "fk_cd_charge"
    FOREIGN KEY ("cd_chg_id")
    REFERENCES "public"."charge_master" ("chg_id")
    ON UPDATE NO ACTION ON DELETE NO ACTION;
