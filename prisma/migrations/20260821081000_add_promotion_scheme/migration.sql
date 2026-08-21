-- ═══════════════════════════════════════════════════════════════════════════
--  Promotion schemes — §1 header, §2 branch scope, §3 party scope,
--  §4 item scope, §5 offer bands.
--
--  HAND-AUTHORED, not generated. `prisma migrate` cannot express three of the
--  things this file has to create:
--
--    * the nine GENERATED ALWAYS ... STORED columns on the party and item
--      tables — Prisma has no generated-column concept and would emit them as
--      plain nullable uuid, leaving every FK carrier permanently empty;
--    * the partial indexes (every one of them carries a WHERE) — Prisma
--      ignores indexes with predicates, which is also why the models must not
--      declare them;
--    * ex_prm_exclusive_clash, a GiST EXCLUDE.
--
--  NO CHECK CONSTRAINTS. The vocabularies, the benefit-column matrix, the
--  unit-on-ITEM rule and the rest are enforced in PromotionSchemeService
--  instead — same treatment inventory.item_unit_conversion already gets.
-- ═══════════════════════════════════════════════════════════════════════════

-- ex_prm_exclusive_clash mixes equality on scalars with overlap on a range in
-- one GiST index, which needs the btree operator classes.
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ───────────────────────────────────────────────────────────────────────────
--  §1  sales.promotion_scheme
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.promotion_scheme
(
    prm_id                     uuid                     NOT NULL DEFAULT uuidv7(),
    prm_comp_id                uuid                     NOT NULL,
    prm_branch_id              uuid,
    prm_tenant_id              uuid,

    prm_code                   character varying(30)    NOT NULL,
    prm_name                   character varying(150)   NOT NULL,
    prm_status                 character varying(20)    NOT NULL DEFAULT 'DRAFT',

    prm_apply_on               character varying(20)    NOT NULL DEFAULT 'ITEM_QTY',
    prm_benefit                character varying(20)    NOT NULL DEFAULT 'DISC_PERC',

    prm_priority               smallint                 NOT NULL DEFAULT 1,
    prm_stack_mode             character varying(10)    NOT NULL DEFAULT 'EXCLUSIVE',
    prm_auto_apply             boolean                  NOT NULL DEFAULT true,
    prm_allow_with_manual_disc boolean                  NOT NULL DEFAULT false,

    prm_calc_on_amount_type    character varying(20)    NOT NULL DEFAULT 'NET_AMOUNT',
    prm_include_tax            boolean                  NOT NULL DEFAULT false,
    prm_bill_type              character varying(20)    NOT NULL DEFAULT 'ALL',
    prm_min_bill_amount        numeric(18,2)            NOT NULL DEFAULT 0,
    prm_min_qty                numeric(18,3)            NOT NULL DEFAULT 0,

    prm_branch_scope           character varying(10)    NOT NULL DEFAULT 'ALL',
    prm_cust_scope             character varying(10)    NOT NULL DEFAULT 'ALL',
    prm_item_scope             character varying(10)    NOT NULL DEFAULT 'ALL',
    prm_price_level_id         integer,

    prm_max_benefit_per_bill   numeric(18,2)            NOT NULL DEFAULT 0,
    prm_max_uses_total         integer                  NOT NULL DEFAULT 0,
    prm_max_uses_per_cust      integer                  NOT NULL DEFAULT 0,
    prm_budget_amount          numeric(18,2)            NOT NULL DEFAULT 0,

    -- sales.loyalty_coupon_batch(lcb_id). NO foreign key: that table does not
    -- exist yet. Add fk_prm_coupon_batch when it lands.
    prm_coupon_batch_id        uuid,

    prm_start_date             date                     NOT NULL,
    prm_end_date               date                     NOT NULL,
    prm_valid_from_time        time without time zone,
    prm_valid_to_time          time without time zone,
    prm_valid_weekdays         character varying(30),

    prm_remarks                text,
    prm_is_active              boolean                  NOT NULL DEFAULT true,
    prm_is_deleted             boolean                  NOT NULL DEFAULT false,
    prm_sync_date              timestamp with time zone,
    prm_created_on             timestamp with time zone NOT NULL DEFAULT now(),
    prm_created_by             character varying(50),
    prm_modified_on            timestamp with time zone,
    prm_modified_by            character varying(50),
    prm_approved_on            timestamp with time zone,
    prm_approved_by            uuid,

    CONSTRAINT pk_promotion_scheme PRIMARY KEY (prm_id),

    -- Not a uniqueness rule anybody needs in its own right — prm_id is already
    -- unique — but the target of §5's composite FK, and so the only way to make
    -- the database itself refuse a free-item band on a percentage scheme.
    CONSTRAINT uq_prm_benefit UNIQUE (prm_id, prm_benefit),

    -- Two EXCLUSIVE campaigns, same company, same branch, same trigger, same
    -- priority, overlapping dates: whichever the till reads first wins, and the
    -- same basket rings up differently in two shops. That is luck, not a rule.
    --
    -- STACKABLE schemes are exempt on purpose — they accumulate, and addition
    -- does not care about order. Non-overlapping date ranges are exempt too,
    -- which is why this is an overlap test and not a unique index.
    --
    -- A NULL branch means company-wide, COALESCE'd to the nil uuid because an
    -- EXCLUDE constraint never conflicts on NULL — which would let a
    -- company-wide scheme clash with nothing at all.
    CONSTRAINT ex_prm_exclusive_clash EXCLUDE USING gist (
        prm_comp_id WITH =,
        (COALESCE(prm_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        prm_apply_on WITH =,
        prm_priority WITH =,
        daterange(prm_start_date, prm_end_date, '[]') WITH &&
    ) WHERE (prm_stack_mode::text = 'EXCLUSIVE' AND prm_status::text = 'APPROVED'
             AND prm_is_active = true AND prm_is_deleted = false),

    CONSTRAINT fk_prm_company FOREIGN KEY (prm_comp_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prm_branch FOREIGN KEY (prm_branch_id)
        REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prm_price_level FOREIGN KEY (prm_price_level_id)
        REFERENCES inventory.item_price_levels (ipl_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prm_approved_by FOREIGN KEY (prm_approved_by)
        REFERENCES public.user_master (usr_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

ALTER TABLE IF EXISTS sales.promotion_scheme OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_prm_code
    ON sales.promotion_scheme USING btree (prm_comp_id, lower(prm_code::text))
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prm_is_deleted = false;

-- The resolver: "which promotions are live at this branch today?" It runs on
-- every bill, so it must not touch the heap.
CREATE INDEX IF NOT EXISTS ix_prm_resolve
    ON sales.promotion_scheme USING btree
    (prm_comp_id, prm_branch_id, prm_start_date, prm_end_date, prm_priority)
    INCLUDE (prm_apply_on, prm_benefit, prm_stack_mode,
             prm_branch_scope, prm_cust_scope, prm_item_scope)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prm_is_deleted = false AND prm_is_active = true
      AND prm_status::text = 'APPROVED';

CREATE INDEX IF NOT EXISTS ix_prm_company
    ON sales.promotion_scheme USING btree (prm_comp_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE prm_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prm_branch
    ON sales.promotion_scheme USING btree (prm_branch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prm_branch_id IS NOT NULL AND prm_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prm_price_level
    ON sales.promotion_scheme USING btree (prm_price_level_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prm_price_level_id IS NOT NULL AND prm_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prm_coupon_batch
    ON sales.promotion_scheme USING btree (prm_coupon_batch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prm_coupon_batch_id IS NOT NULL AND prm_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prm_approved_by
    ON sales.promotion_scheme USING btree (prm_approved_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prm_approved_by IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
--  §2  sales.promotion_scheme_branch — which branches run it
--
--  Read only when prm_branch_scope = 'LIST'. prb_is_exclude makes "every
--  branch except two" two rows rather than thirty-eight; an EXCLUDE row always
--  beats an INCLUDE row for the same branch.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.promotion_scheme_branch
(
    prb_id          uuid                     NOT NULL DEFAULT uuidv7(),
    prb_prm_id      uuid                     NOT NULL,
    prb_slno        integer                  NOT NULL DEFAULT 1,
    prb_branch_id   uuid                     NOT NULL,
    prb_is_exclude  boolean                  NOT NULL DEFAULT false,
    prb_notes       text,
    prb_is_active   boolean                  NOT NULL DEFAULT true,
    prb_is_deleted  boolean                  NOT NULL DEFAULT false,
    prb_sync_date   timestamp with time zone,
    prb_created_on  timestamp with time zone NOT NULL DEFAULT now(),
    prb_created_by  character varying(50),
    prb_modified_on timestamp with time zone,
    prb_modified_by character varying(50),

    CONSTRAINT pk_promotion_scheme_branch PRIMARY KEY (prb_id),
    CONSTRAINT fk_prb_scheme FOREIGN KEY (prb_prm_id)
        REFERENCES sales.promotion_scheme (prm_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_prb_branch FOREIGN KEY (prb_branch_id)
        REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

ALTER TABLE IF EXISTS sales.promotion_scheme_branch OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_prb_row
    ON sales.promotion_scheme_branch USING btree (prb_prm_id, prb_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE prb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prb_scheme
    ON sales.promotion_scheme_branch USING btree (prb_prm_id)
    INCLUDE (prb_branch_id, prb_is_exclude)
    WITH (fillfactor=100, deduplicate_items=True) WHERE prb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prb_branch
    ON sales.promotion_scheme_branch USING btree (prb_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE prb_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  §3  sales.promotion_scheme_party — who it applies to
--
--  ONE KIND + ONE SCOPE ID, the shape the entry grid needs, with the foreign
--  keys kept by generated columns.
--
--  prp_scope_id alone could take no foreign key: one column cannot reference
--  four tables. The four columns below are GENERATED ALWAYS — the database
--  computes them, nothing can write them — so each holds the id only for its
--  own kind and can therefore carry a real FK to its own master. The screen
--  reads and writes exactly two columns and never sees these; the database
--  still refuses an id that is not in the named master, and still refuses to
--  delete a customer group a live campaign points at.
--
--  "Exactly one target is set" and "the kind agrees with the target" are
--  consequences of how the columns are generated, not CHECKs — and a rule the
--  database derives cannot be violated the way one it merely tests can.
--
--  CITY reaches a customer THROUGH THEIR AREA and only that way
--  (customers.cus_area_id -> area_master.arm_city_id -> city_master.ctm_id).
--  customers.cus_city is free text and must never be matched on.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.promotion_scheme_party
(
    prp_id             uuid                     NOT NULL DEFAULT uuidv7(),
    prp_prm_id         uuid                     NOT NULL,
    prp_slno           integer                  NOT NULL DEFAULT 1,

    prp_kind           character varying(20)    NOT NULL,
    prp_scope_id       uuid                     NOT NULL,

    prp_cust_id        uuid GENERATED ALWAYS AS
        (CASE WHEN prp_kind::text = 'CUSTOMER'       THEN prp_scope_id END) STORED,
    prp_cust_group_id  uuid GENERATED ALWAYS AS
        (CASE WHEN prp_kind::text = 'CUSTOMER_GROUP' THEN prp_scope_id END) STORED,
    prp_area_id        uuid GENERATED ALWAYS AS
        (CASE WHEN prp_kind::text = 'AREA'           THEN prp_scope_id END) STORED,
    prp_city_id        uuid GENERATED ALWAYS AS
        (CASE WHEN prp_kind::text = 'CITY'           THEN prp_scope_id END) STORED,

    prp_is_exclude     boolean                  NOT NULL DEFAULT false,
    prp_match_priority smallint                 NOT NULL DEFAULT 1,
    prp_notes          text,
    prp_is_active      boolean                  NOT NULL DEFAULT true,
    prp_is_deleted     boolean                  NOT NULL DEFAULT false,
    prp_sync_date      timestamp with time zone,
    prp_created_on     timestamp with time zone NOT NULL DEFAULT now(),
    prp_created_by     character varying(50),
    prp_modified_on    timestamp with time zone,
    prp_modified_by    character varying(50),

    CONSTRAINT pk_promotion_scheme_party PRIMARY KEY (prp_id),
    CONSTRAINT fk_prp_scheme FOREIGN KEY (prp_prm_id)
        REFERENCES sales.promotion_scheme (prm_id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- ON UPDATE NO ACTION, not CASCADE: PostgreSQL forbids a cascading update
    -- on a foreign key that contains a generated column, since cascading would
    -- have to write a column nothing is allowed to write. It costs nothing —
    -- every master key here is a uuidv7() that is never reissued — and
    -- NO ACTION is the stricter of the two: the update is refused, not
    -- propagated.
    CONSTRAINT fk_prp_cust FOREIGN KEY (prp_cust_id)
        REFERENCES sales.customers (cus_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_prp_cust_group FOREIGN KEY (prp_cust_group_id)
        REFERENCES sales.cust_groups (cgr_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_prp_area FOREIGN KEY (prp_area_id)
        REFERENCES sales.area_master (arm_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_prp_city FOREIGN KEY (prp_city_id)
        REFERENCES sales.city_master (ctm_id) ON UPDATE NO ACTION ON DELETE RESTRICT
);

ALTER TABLE IF EXISTS sales.promotion_scheme_party OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_prp_row
    ON sales.promotion_scheme_party USING btree (prp_prm_id, prp_kind, prp_scope_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE prp_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_prp_scheme
    ON sales.promotion_scheme_party USING btree (prp_prm_id, prp_match_priority DESC)
    INCLUDE (prp_kind, prp_scope_id, prp_is_exclude)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prp_is_deleted = false AND prp_is_active = true;

CREATE INDEX IF NOT EXISTS ix_prp_cust
    ON sales.promotion_scheme_party USING btree (prp_cust_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prp_cust_id IS NOT NULL AND prp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prp_cust_group
    ON sales.promotion_scheme_party USING btree (prp_cust_group_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prp_cust_group_id IS NOT NULL AND prp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prp_area
    ON sales.promotion_scheme_party USING btree (prp_area_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prp_area_id IS NOT NULL AND prp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prp_city
    ON sales.promotion_scheme_party USING btree (prp_city_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prp_city_id IS NOT NULL AND prp_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  §4  sales.promotion_scheme_item — which stock it applies to
--
--  One kind + one scope id, with five generated columns carrying the foreign
--  keys — see §3 for why. This is what makes "20% off own-brand, but nothing
--  on tobacco" ONE scheme.
--
--  pri_unit_id is written normally: it is REQUIRED on an ITEM row and
--  FORBIDDEN on every other kind, which is a biconditional and therefore a
--  CHECK — so it lives in PromotionSchemeService with the rest of them.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.promotion_scheme_item
(
    pri_id             uuid                     NOT NULL DEFAULT uuidv7(),
    pri_prm_id         uuid                     NOT NULL,
    pri_slno           integer                  NOT NULL DEFAULT 1,

    pri_kind           character varying(20)    NOT NULL,
    pri_scope_id       uuid                     NOT NULL,

    pri_item_id        uuid GENERATED ALWAYS AS
        (CASE WHEN pri_kind::text = 'ITEM'          THEN pri_scope_id END) STORED,
    pri_group_id       uuid GENERATED ALWAYS AS
        (CASE WHEN pri_kind::text = 'ITEM_GROUP'    THEN pri_scope_id END) STORED,
    pri_category_id    uuid GENERATED ALWAYS AS
        (CASE WHEN pri_kind::text = 'ITEM_CATEGORY' THEN pri_scope_id END) STORED,
    pri_brand_id       uuid GENERATED ALWAYS AS
        (CASE WHEN pri_kind::text = 'ITEM_BRAND'    THEN pri_scope_id END) STORED,
    pri_section_id     uuid GENERATED ALWAYS AS
        (CASE WHEN pri_kind::text = 'ITEM_SECTION'  THEN pri_scope_id END) STORED,
    pri_unit_id        uuid,

    pri_is_exclude     boolean                  NOT NULL DEFAULT false,

    -- The offer-per-item rate, in the bill's own idiom because these are
    -- copied straight onto sbi_sch_disc_perc / _qty / _amt. At most one is
    -- non-zero; all three zero means the row only says "in scope".
    pri_disc_perc      numeric(18,4)            NOT NULL DEFAULT 0,
    pri_disc_qty       numeric(18,4)            NOT NULL DEFAULT 0,
    pri_disc_amt       numeric(18,2)            NOT NULL DEFAULT 0,

    pri_min_qty        numeric(18,3)            NOT NULL DEFAULT 0,
    pri_factor         numeric(18,4)            NOT NULL DEFAULT 1,
    pri_max_benefit    numeric(18,2)            NOT NULL DEFAULT 0,
    pri_match_priority smallint                 NOT NULL DEFAULT 1,
    pri_notes          text,
    pri_is_active      boolean                  NOT NULL DEFAULT true,
    pri_is_deleted     boolean                  NOT NULL DEFAULT false,
    pri_sync_date      timestamp with time zone,
    pri_created_on     timestamp with time zone NOT NULL DEFAULT now(),
    pri_created_by     character varying(50),
    pri_modified_on    timestamp with time zone,
    pri_modified_by    character varying(50),

    CONSTRAINT pk_promotion_scheme_item PRIMARY KEY (pri_id),
    CONSTRAINT fk_pri_scheme FOREIGN KEY (pri_prm_id)
        REFERENCES sales.promotion_scheme (prm_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pri_item FOREIGN KEY (pri_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_pri_group FOREIGN KEY (pri_group_id)
        REFERENCES inventory.item_group_master (itg_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_pri_category FOREIGN KEY (pri_category_id)
        REFERENCES inventory.item_category_master (category_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_pri_brand FOREIGN KEY (pri_brand_id)
        REFERENCES inventory.item_brand_master (brand_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_pri_section FOREIGN KEY (pri_section_id)
        REFERENCES inventory.item_section_master (sec_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_pri_unit FOREIGN KEY (pri_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

ALTER TABLE IF EXISTS sales.promotion_scheme_item OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pri_row
    ON sales.promotion_scheme_item USING btree (pri_prm_id, pri_kind, pri_scope_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pri_is_deleted = false;

-- The engine walks a scheme's rules most-specific first, once per bill line,
-- so this must not touch the heap.
CREATE INDEX IF NOT EXISTS ix_pri_scheme
    ON sales.promotion_scheme_item USING btree (pri_prm_id, pri_match_priority DESC)
    INCLUDE (pri_kind, pri_scope_id, pri_is_exclude, pri_disc_perc, pri_disc_qty,
             pri_disc_amt, pri_factor)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pri_is_deleted = false AND pri_is_active = true;

-- Reverse lookups ("which campaigns touch this brand?"), doubling as the
-- FK-covering index for each master.
CREATE INDEX IF NOT EXISTS ix_pri_item
    ON sales.promotion_scheme_item USING btree (pri_item_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pri_item_id IS NOT NULL AND pri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pri_group
    ON sales.promotion_scheme_item USING btree (pri_group_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pri_group_id IS NOT NULL AND pri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pri_category
    ON sales.promotion_scheme_item USING btree (pri_category_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pri_category_id IS NOT NULL AND pri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pri_brand
    ON sales.promotion_scheme_item USING btree (pri_brand_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pri_brand_id IS NOT NULL AND pri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pri_section
    ON sales.promotion_scheme_item USING btree (pri_section_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pri_section_id IS NOT NULL AND pri_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pri_unit
    ON sales.promotion_scheme_item USING btree (pri_unit_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pri_unit_id IS NOT NULL AND pri_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  §5  sales.promotion_scheme_slab — the offer bands
--
--  One row = one band. Bands are ROWS, not columns: 0-999 -> 2%,
--  1000-4999 -> 5%, 5000+ -> 8% is three rows.
--
--  prs_benefit is a copy of the header's prm_benefit, tied to it by a
--  COMPOSITE foreign key. A percentage-discount scheme therefore CANNOT
--  physically hold a free-item band: the FK rejects the row. That FK is why §1
--  carries the otherwise-redundant UNIQUE (prm_id, prm_benefit), and it also
--  carries the ON DELETE CASCADE, so no second plain FK on prs_prm_id exists.
--
--  Its partner rule — "the matching column is filled and the others are empty"
--  — was ck_prs_benefit_columns and is now enforced in PromotionSchemeService.
--  Note the consequence: fk_prs_scheme_benefit is ON UPDATE CASCADE, so
--  changing prm_benefit on a scheme that already has bands would silently
--  relabel them. The service refuses that edit.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.promotion_scheme_slab
(
    prs_id               uuid                     NOT NULL DEFAULT uuidv7(),
    prs_prm_id           uuid                     NOT NULL,
    prs_slno             integer                  NOT NULL DEFAULT 1,
    prs_benefit          character varying(20)    NOT NULL,

    prs_exceeds          numeric(18,3)            NOT NULL DEFAULT 0,
    prs_upto             numeric(18,3),
    prs_each             numeric(18,3)            NOT NULL DEFAULT 1,
    prs_is_repeat        boolean                  NOT NULL DEFAULT false,
    prs_max_repeats      integer                  NOT NULL DEFAULT 0,

    prs_free_item_id     uuid,
    prs_free_unit_id     uuid,
    prs_free_qty         numeric(18,3)            NOT NULL DEFAULT 0,
    prs_free_stock_check boolean                  NOT NULL DEFAULT true,

    prs_disc_perc        numeric(18,4)            NOT NULL DEFAULT 0,
    prs_disc_qty         numeric(18,4)            NOT NULL DEFAULT 0,
    prs_disc_amt         numeric(18,2)            NOT NULL DEFAULT 0,

    prs_fixed_price      numeric(18,4),

    prs_max_benefit_amt  numeric(18,2)            NOT NULL DEFAULT 0,

    prs_notes            text,
    prs_is_active        boolean                  NOT NULL DEFAULT true,
    prs_is_deleted       boolean                  NOT NULL DEFAULT false,
    prs_sync_date        timestamp with time zone,
    prs_created_on       timestamp with time zone NOT NULL DEFAULT now(),
    prs_created_by       character varying(50),
    prs_modified_on      timestamp with time zone,
    prs_modified_by      character varying(50),

    CONSTRAINT pk_promotion_scheme_slab PRIMARY KEY (prs_id),

    CONSTRAINT fk_prs_scheme_benefit FOREIGN KEY (prs_prm_id, prs_benefit)
        REFERENCES sales.promotion_scheme (prm_id, prm_benefit)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_prs_free_item FOREIGN KEY (prs_free_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prs_free_unit FOREIGN KEY (prs_free_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

ALTER TABLE IF EXISTS sales.promotion_scheme_slab OWNER to postgres;

-- One band per lower bound — per free item, so "spend 5000, get a mug AND a
-- pen" is two rows at the same threshold, while two rows claiming the same band
-- with nothing to say which wins stays impossible.
CREATE UNIQUE INDEX IF NOT EXISTS ux_prs_band
    ON sales.promotion_scheme_slab USING btree
    (prs_prm_id, prs_exceeds,
     COALESCE(prs_free_item_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WITH (fillfactor=100, deduplicate_items=True) WHERE prs_is_deleted = false;

-- The till reads bands in order for a measured value; covers the composite FK.
CREATE INDEX IF NOT EXISTS ix_prs_scheme
    ON sales.promotion_scheme_slab USING btree (prs_prm_id, prs_benefit, prs_exceeds)
    INCLUDE (prs_upto, prs_each, prs_is_repeat, prs_free_item_id, prs_free_unit_id,
             prs_free_qty, prs_disc_perc, prs_disc_qty, prs_disc_amt, prs_fixed_price)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prs_is_deleted = false AND prs_is_active = true;

CREATE INDEX IF NOT EXISTS ix_prs_free_item
    ON sales.promotion_scheme_slab USING btree (prs_free_item_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prs_free_item_id IS NOT NULL AND prs_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prs_free_unit
    ON sales.promotion_scheme_slab USING btree (prs_free_unit_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prs_free_unit_id IS NOT NULL AND prs_is_deleted = false;
