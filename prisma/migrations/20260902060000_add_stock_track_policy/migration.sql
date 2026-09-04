-- ═══════════════════════════════════════════════════════════════════════════
--  stock.stock_track_policy — how a holding is keyed, valued, issued and aged
--
--  HAND-AUTHORED, not generated. `prisma migrate` cannot express three of the
--  things this file has to create:
--
--    * the three GENERATED ALWAYS ... STORED columns (stp_item_id,
--      stp_group_id, stp_track_signature) — Prisma has no generated-column
--      concept and would emit them as plain nullable columns, leaving both FK
--      carriers permanently empty;
--    * the partial indexes (both carry a WHERE) — Prisma ignores indexes with
--      predicates, which is also why the model must not declare them;
--    * ex_stp_overlap, a GiST EXCLUDE.
--
--  The CHECK constraints ARE declared here (unlike promotion_scheme, which
--  pushed its vocabularies into the service): these are a handful of closed
--  vocabularies plus two derivable rules, and a policy row is written once by
--  an admin, not per bill line.
-- ═══════════════════════════════════════════════════════════════════════════

-- ex_stp_overlap mixes equality on scalars with overlap on a range in one GiST
-- index, which needs the btree operator classes.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS stock.stock_track_policy
(
    stp_id                   uuid           NOT NULL DEFAULT uuidv7(),
    -- NULL = EVERY company. inventory.item_master.item_company_id is itself
    -- nullable and items are deliberately not company-owned, so a company-less
    -- item would have nothing to write a policy against — and an item used by
    -- two companies would need two identical rows, either of which could be
    -- edited without the other. A company-specific row beats a NULL one.
    stp_company_id           uuid,
    -- NULL = every branch in the company. A branch row beats a company row.
    stp_branch_id            uuid,

    -- ── Scope: the pair, and the typed columns beside it ─────────────────
    stp_scope                character varying(20) NOT NULL DEFAULT 'COMPANY',
    -- NULL only when stp_scope = 'COMPANY'.
    stp_scope_id             uuid,

    stp_item_id  uuid GENERATED ALWAYS AS
        (CASE WHEN stp_scope = 'ITEM'  THEN stp_scope_id END) STORED,
    stp_group_id uuid GENERATED ALWAYS AS
        (CASE WHEN stp_scope = 'GROUP' THEN stp_scope_id END) STORED,

    -- ── What is significant about a holding ──────────────────────────────
    -- All false = plain item-wise stock: one lot, for ever, every identity
    -- column NULL. That is the DEFAULT, and it is the common case.
    stp_track_batch          boolean NOT NULL DEFAULT false,
    stp_track_mrp            boolean NOT NULL DEFAULT false,
    stp_track_sale_price     boolean NOT NULL DEFAULT false,
    stp_track_expiry         boolean NOT NULL DEFAULT false,
    stp_track_serial         boolean NOT NULL DEFAULT false,
    -- Supplier is tracked separately from batch on purpose: the same batch
    -- number from two suppliers is two holdings, and only this flag decides
    -- whether the business cares.
    stp_track_supplier       boolean NOT NULL DEFAULT false,

    -- B/M/S/E/R/P in that order, 'N' when nothing is tracked. Stamped onto
    -- every lot at creation so history survives a policy change.
    stp_track_signature      character varying(8) GENERATED ALWAYS AS (
        COALESCE(NULLIF(
            (CASE WHEN stp_track_batch      THEN 'B' ELSE '' END) ||
            (CASE WHEN stp_track_mrp        THEN 'M' ELSE '' END) ||
            (CASE WHEN stp_track_sale_price THEN 'S' ELSE '' END) ||
            (CASE WHEN stp_track_expiry     THEN 'E' ELSE '' END) ||
            (CASE WHEN stp_track_serial     THEN 'R' ELSE '' END) ||
            (CASE WHEN stp_track_supplier   THEN 'P' ELSE '' END)
        , ''), 'N') ) STORED,

    -- ── How it is valued ─────────────────────────────────────────────────
    -- WAVG reads stock_item_cost; FIFO and LOT_ACTUAL read slt_cost_rate.
    -- Both are always maintained, so this only selects which one a report
    -- believes — changing it needs no recomputation.
    stp_valuation_method     character varying(20) NOT NULL DEFAULT 'WAVG',

    -- ── Which lot goes out when nobody names one ─────────────────────────
    -- The single most consequential column in this file. /master-lookups/
    -- item-price returns ONE stock row to the billing screen; before this
    -- there was nothing in the schema that said which. FEFO (first expiry,
    -- first out) is the default because it is right for anything perishable
    -- and harmless for anything else.
    stp_issue_strategy       character varying(20) NOT NULL DEFAULT 'FEFO',

    -- ── Negative stock ───────────────────────────────────────────────────
    -- ALLOW because a counter must be able to sell before the GRN clerk has
    -- caught up. WARN posts and flags. BLOCK aborts the transaction — for
    -- controlled substances and anything serialised.
    stp_allow_negative       character varying(10) NOT NULL DEFAULT 'ALLOW',

    -- ── Expiry ───────────────────────────────────────────────────────────
    stp_shelf_life_days      integer,
    stp_near_expiry_days     integer        NOT NULL DEFAULT 30,
    stp_block_expired_sale   boolean        NOT NULL DEFAULT false,

    -- INWARD_DATE  — when the lot first entered the company (chain-wide age)
    -- LAST_IN_DATE — when it last entered THIS godown (shelf age)
    -- MFG_DATE     — age of the goods themselves
    stp_ageing_basis         character varying(20) NOT NULL DEFAULT 'INWARD_DATE',

    -- ── When this policy is in force ─────────────────────────────────────
    -- The window is resolved against the DOCUMENT's date, not today's, so a
    -- business can genuinely say "we start tracking batches on 1 July" and
    -- have June's receipts keep the identity scheme they were entered under.
    --
    -- The default start is deliberately far in the past. Defaulting it to
    -- CURRENT_DATE looks tidier and is a trap: a policy authored today would
    -- not apply to a receipt back-dated to yesterday, which would silently
    -- fall through to "track nothing" and create an untracked lot for an item
    -- the business believes is batch-tracked. A policy with no stated start
    -- date has always been in force.
    stp_effective_from       date           NOT NULL DEFAULT DATE '1900-01-01',
    stp_effective_to         date           NOT NULL DEFAULT DATE '9999-12-31',

    stp_remarks              character varying(250),
    stp_is_active            boolean NOT NULL DEFAULT true,
    stp_is_deleted           boolean NOT NULL DEFAULT false,
    stp_sync_date            timestamp with time zone,
    stp_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    stp_created_by           uuid,
    stp_modified_on          timestamp with time zone,
    stp_modified_by          uuid,

    CONSTRAINT pk_stock_track_policy PRIMARY KEY (stp_id),

    -- Two policies for the same thing, same branch, overlapping dates, is not
    -- a rule — it is whichever the resolver reads first, and the same item
    -- keys its stock differently on two tills. The database refuses it.
    -- NULLs COALESCE'd to the nil uuid because EXCLUDE never conflicts on
    -- NULL, which would let every company-wide row clash with nothing at all.
    CONSTRAINT ex_stp_overlap EXCLUDE USING gist (
        -- COALESCEd for the same reason branch and scope_id are, immediately
        -- below: EXCLUDE never conflicts on NULL, so two every-company rows
        -- for the same scope and dates would both be accepted.
        (COALESCE(stp_company_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        (COALESCE(stp_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        stp_scope WITH =,
        (COALESCE(stp_scope_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        daterange(stp_effective_from, stp_effective_to, '[]') WITH &&
    ) WHERE (stp_is_active = true AND stp_is_deleted = false),

    CONSTRAINT fk_stp_company FOREIGN KEY (stp_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stp_branch FOREIGN KEY (stp_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- NO ACTION, not CASCADE: PostgreSQL refuses ON UPDATE CASCADE on a
    -- foreign key over a GENERATED column, because it cannot write one.
    -- Same reason files 12 and 15 spell their scope FKs this way.
    CONSTRAINT fk_stp_item FOREIGN KEY (stp_item_id)
        REFERENCES inventory.item_master (item_id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_stp_group FOREIGN KEY (stp_group_id)
        REFERENCES inventory.item_group_master (itg_id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_stp_created_by FOREIGN KEY (stp_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_stp_scope CHECK (
        stp_scope::text = ANY (ARRAY['COMPANY'::text, 'GROUP'::text, 'ITEM'::text])),
    -- COMPANY carries no id; GROUP and ITEM must.
    CONSTRAINT ck_stp_scope_id CHECK (
        (stp_scope::text = 'COMPANY' AND stp_scope_id IS NULL)
     OR (stp_scope::text <> 'COMPANY' AND stp_scope_id IS NOT NULL)),
    CONSTRAINT ck_stp_valuation CHECK (
        stp_valuation_method::text = ANY (ARRAY['WAVG'::text, 'FIFO'::text,
                                                'LOT_ACTUAL'::text])),
    CONSTRAINT ck_stp_issue_strategy CHECK (
        stp_issue_strategy::text = ANY (ARRAY['FIFO'::text, 'FEFO'::text,
                                              'LIFO'::text, 'MANUAL'::text])),
    CONSTRAINT ck_stp_allow_negative CHECK (
        stp_allow_negative::text = ANY (ARRAY['ALLOW'::text, 'WARN'::text,
                                              'BLOCK'::text])),
    CONSTRAINT ck_stp_ageing_basis CHECK (
        stp_ageing_basis::text = ANY (ARRAY['INWARD_DATE'::text, 'MFG_DATE'::text,
                                            'LAST_IN_DATE'::text])),
    CONSTRAINT ck_stp_dates CHECK (stp_effective_to >= stp_effective_from),
    CONSTRAINT ck_stp_near_expiry CHECK (stp_near_expiry_days >= 0),
    CONSTRAINT ck_stp_shelf_life CHECK (
        stp_shelf_life_days IS NULL OR stp_shelf_life_days > 0),
    -- Expiry tracking without batch tracking cannot be keyed: two deliveries
    -- with different expiry dates and no batch number are indistinguishable
    -- on the shelf.
    CONSTRAINT ck_stp_expiry_needs_batch CHECK (
        stp_track_expiry = false OR stp_track_batch = true),
    -- FEFO can only order lots that have an expiry date to order by.
    CONSTRAINT ck_stp_fefo_needs_expiry CHECK (
        stp_issue_strategy::text <> 'FEFO' OR stp_track_expiry = true
        OR stp_track_batch = false)
);

ALTER TABLE IF EXISTS stock.stock_track_policy OWNER to postgres;

-- The resolver's exact lookup shape, most-specific first.
CREATE INDEX IF NOT EXISTS ix_stp_resolve
    ON stock.stock_track_policy USING btree
    (stp_company_id, stp_scope, stp_scope_id, stp_branch_id)
    INCLUDE (stp_effective_from, stp_effective_to)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE stp_is_active = true AND stp_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_stp_item
    ON stock.stock_track_policy USING btree (stp_item_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE stp_item_id IS NOT NULL AND stp_is_deleted = false;
