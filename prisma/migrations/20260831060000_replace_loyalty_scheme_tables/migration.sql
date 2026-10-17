-- ═══════════════════════════════════════════════════════════════════════════
--  12: LOYALTY SCHEME — the rules, replacing sales.loyalty_sch_*
--
--      sales.loyalty_scheme         the campaign header        (lsc_)
--      sales.loyalty_scheme_branch  which branches run it      (lsb_)
--      sales.loyalty_scheme_party   who it applies to          (lsp_)
--      sales.loyalty_scheme_item    which stock it applies to  (lsi_)
--      sales.loyalty_scheme_slab    the earn rates             (lss_)
--      sales.loyalty_scheme_gift    points -> free item        (lsg_)
--
--  Requires PostgreSQL 18+ (uuidv7()).
--
--  ── What this file is ────────────────────────────────────────────────────
--  The RULES: who earns, on what, how fast, and what a point is worth. It
--  holds no balances and no movements — those are 13 (points) and 14
--  (coupons and gift vouchers), neither of which exists yet.
--
--  §0 DROPS the predecessor tables (loyalty_sch_list / _party / _points /
--  _gift) outright, along with the module that read them. The design note this
--  file is taken from left them standing; the instruction that brought it here
--  did not. Their rows are NOT migrated — that is a data task, not a schema
--  one, and nothing below reads or writes them.
--
--  ── HAND-AUTHORED, not generated ─────────────────────────────────────────
--  `prisma migrate` cannot express three of the things this file creates:
--    * the seven GENERATED ALWAYS ... STORED columns on the party and item
--      tables — Prisma has no generated-column concept and would emit them as
--      plain nullable uuid, leaving every FK carrier permanently empty;
--    * the partial indexes (every one carries a WHERE) — Prisma ignores
--      indexes with predicates, which is why the models must not declare them;
--    * the CHECK constraints.
--
--  The CHECKs below are the schema's own backstop. They are ALSO mirrored,
--  one function per constraint, in
--  src/modules/sales/loyalty/utils/loyalty-scheme-invariants.ts, so a rejected
--  campaign comes back as a field-addressed 400 rather than a Postgres error
--  string the screen cannot place on an input. The table is the last word; the
--  service is the one that explains itself.
--
--  ── Scope: KIND + SCOPE_ID, with the foreign keys kept anyway ────────────
--  The predecessor carried one scope_id whose meaning depended on a type
--  column, so no foreign key was possible on the thing that most needed one —
--  a deleted brand left a scheme rule pointing at nothing.
--
--  The pair is kept, because the entry grid is two columns wide and has to
--  bind to something. Beside it sits a GENERATED ALWAYS ... STORED column per
--  kind, each holding the id only when the kind matches, and each therefore
--  able to carry a real foreign key of its own. Nothing can write them; the
--  database computes them. So referential integrity is real after all, and
--  "exactly one target is set" stops being a CHECK to test and becomes a
--  consequence of how the columns are defined. See §3.
--
--  Two things follow: these FKs are ON UPDATE NO ACTION (PostgreSQL forbids
--  CASCADE on a key containing a generated column), and the ORM maps the
--  generated columns read-only.
--
--  ── Redemption rate: one source of truth ─────────────────────────────────
--  lsc_redeem_value_per_point is what a point is worth in rupees. It WINS over
--  accounts.acc_tender_master.tnd_conversion_rate whenever a scheme matches;
--  the tender master is the fallback for a company running no scheme; and
--  acc_tender_detail.td_conversion_rate snapshots whichever was used, so a
--  historic redemption stays re-derivable. A write-path rule the schema cannot
--  enforce — so it is at least written down, here and in the .prisma header.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  §0  Out with the old
--
--  Children first, header last, so nothing is dropped out from under a foreign
--  key. CASCADE is deliberately NOT used: if something outside this module has
--  quietly grown a dependency on these tables, this migration should fail
--  loudly rather than take that dependency with it.
-- ───────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS sales.loyalty_sch_gift;
DROP TABLE IF EXISTS sales.loyalty_sch_points;
DROP TABLE IF EXISTS sales.loyalty_sch_party;
DROP TABLE IF EXISTS sales.loyalty_sch_list;


-- ───────────────────────────────────────────────────────────────────────────
--  §1  sales.loyalty_scheme — the campaign header
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_scheme
(
    lsc_id                   uuid           NOT NULL DEFAULT uuidv7(),
    lsc_comp_id              uuid           NOT NULL,
    lsc_branch_id            uuid,                      -- single-shop shorthand; NULL = all
    lsc_tenant_id            uuid,

    lsc_code                 character varying(30)  NOT NULL,
    lsc_name                 character varying(150) NOT NULL,
    lsc_type                 character varying(20)  NOT NULL DEFAULT 'BOTH',   -- EARN|REDEEM|BOTH
    lsc_status               character varying(20)  NOT NULL DEFAULT 'DRAFT',
    -- Which scheme wins when several match one bill. 1 = primary. A super-
    -- market running a house campaign and a brand campaign at once needs this
    -- to be data, not the order rows happen to come back in.
    lsc_priority             smallint       NOT NULL DEFAULT 1,
    lsc_auto_apply           boolean        NOT NULL DEFAULT true,

    -- ── What it earns on ─────────────────────────────────────────────────
    lsc_apply_on             character varying(20) NOT NULL DEFAULT 'BILL_AMOUNT',
    lsc_calc_on_amount_type  character varying(20) NOT NULL DEFAULT 'NET_AMOUNT',
    lsc_include_tax          boolean        NOT NULL DEFAULT false,
    lsc_bill_type            character varying(20) NOT NULL DEFAULT 'ALL',     -- ALL|CASH|CREDIT
    lsc_min_bill_amount      numeric(18,2)  NOT NULL DEFAULT 0,                -- earn floor
    lsc_max_earn_points      numeric(18,4)  NOT NULL DEFAULT 0,                -- per bill; 0 = uncapped
    lsc_earn_on_discounted   boolean        NOT NULL DEFAULT true,
    lsc_earn_on_charges      boolean        NOT NULL DEFAULT false,
    lsc_earn_with_redeem     boolean        NOT NULL DEFAULT false,
    lsc_rounding_method      character varying(10) NOT NULL DEFAULT 'FLOOR',
    lsc_points_decimals      smallint       NOT NULL DEFAULT 2,

    -- ── Scope switches ───────────────────────────────────────────────────
    -- 'ALL' = everything; 'LIST' = read the matching child table.
    lsc_branch_scope         character varying(10) NOT NULL DEFAULT 'ALL',
    lsc_cust_scope           character varying(10) NOT NULL DEFAULT 'ALL',
    lsc_item_scope           character varying(10) NOT NULL DEFAULT 'ALL',
    lsc_price_level_id       integer,                   -- NULL = every price level

    -- ── Chain store ──────────────────────────────────────────────────────
    -- COMPANY = one wallet, earned anywhere, spent anywhere (the default, and
    -- what a chain wants). BRANCH = a franchisee honours only what it issued.
    lsc_pool_mode            character varying(10) NOT NULL DEFAULT 'COMPANY',
    lsc_allow_cross_branch_redeem boolean   NOT NULL DEFAULT true,

    -- ── Redemption ───────────────────────────────────────────────────────
    lsc_allow_point_redeem   boolean        NOT NULL DEFAULT false,
    lsc_allow_gift_redeem    boolean        NOT NULL DEFAULT false,
    lsc_redeem_tender_id     uuid,                      -- the LOYALTY tender (type 10)
    lsc_redeem_value_per_point numeric(18,4) NOT NULL DEFAULT 0,
    lsc_min_redeem_points    numeric(18,4)  NOT NULL DEFAULT 0,
    lsc_max_redeem_points    numeric(18,4)  NOT NULL DEFAULT 0,                -- per bill; 0 = uncapped
    lsc_max_redeem_perc      numeric(6,3)   NOT NULL DEFAULT 100,              -- per bill; % of it points may settle
    lsc_redeem_min_bill_amount numeric(18,2) NOT NULL DEFAULT 0,
    lsc_redeem_multiple      numeric(18,4)  NOT NULL DEFAULT 0,         -- 0 = any quantity

    -- ── Expiry and the return window ─────────────────────────────────────
    lsc_expiry_basis         character varying(20) NOT NULL DEFAULT 'EARN_DATE',
    lsc_points_valid_days    integer        NOT NULL DEFAULT 0,
    -- THE CLAW-BACK DEFENCE. Points earn on bill save (offline included) but
    -- are not REDEEMABLE until this many days have passed — long enough for
    -- the return window to close. Without it a customer can earn 500 points,
    -- spend them the same evening, and return the bill next morning, leaving
    -- the wallet owing points it no longer holds. 0 = redeemable immediately.
    lsc_activation_days      smallint       NOT NULL DEFAULT 0,
    lsc_return_mode          character varying(10) NOT NULL DEFAULT 'REVERSE',

    -- ── When it runs ─────────────────────────────────────────────────────
    lsc_start_date           date           NOT NULL,
    lsc_end_date             date           NOT NULL,
    lsc_valid_from_time      time without time zone,
    lsc_valid_to_time        time without time zone,
    lsc_valid_weekdays       character varying(30),     -- 'MON,TUE,...'; NULL = every day

    lsc_remarks              text,
    lsc_is_active            boolean NOT NULL DEFAULT true,
    lsc_is_deleted           boolean NOT NULL DEFAULT false,
    lsc_sync_date            timestamp with time zone,
    lsc_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    lsc_created_by           character varying(50),
    lsc_modified_on          timestamp with time zone,
    lsc_modified_by          character varying(50),
    lsc_approved_on          timestamp with time zone,
    lsc_approved_by          uuid,

    CONSTRAINT pk_loyalty_scheme PRIMARY KEY (lsc_id),

    CONSTRAINT fk_lsc_company FOREIGN KEY (lsc_comp_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lsc_branch FOREIGN KEY (lsc_branch_id)
        REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lsc_price_level FOREIGN KEY (lsc_price_level_id)
        REFERENCES inventory.item_price_levels (ipl_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lsc_redeem_tender FOREIGN KEY (lsc_redeem_tender_id)
        REFERENCES accounts.acc_tender_master (tnd_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lsc_approved_by FOREIGN KEY (lsc_approved_by)
        REFERENCES public.user_master (usr_id) ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lsc_code_shape CHECK (lsc_code ~ '^[A-Za-z0-9_-]+$'),
    CONSTRAINT ck_lsc_type CHECK (
        lsc_type::text = ANY (ARRAY['EARN'::text, 'REDEEM'::text, 'BOTH'::text])),
    CONSTRAINT ck_lsc_status CHECK (
        lsc_status::text = ANY (ARRAY['DRAFT'::text, 'APPROVED'::text,
                                      'SUSPENDED'::text, 'CLOSED'::text])),
    CONSTRAINT ck_lsc_apply_on CHECK (
        lsc_apply_on::text = ANY (ARRAY['BILL_AMOUNT'::text, 'BILL_QTY'::text,
                                        'ITEM_AMOUNT'::text, 'ITEM_QTY'::text])),
    CONSTRAINT ck_lsc_calc_on CHECK (
        lsc_calc_on_amount_type::text = ANY (ARRAY['GROSS_AMOUNT'::text,
                                        'NET_AMOUNT'::text, 'TAXABLE_AMOUNT'::text])),
    CONSTRAINT ck_lsc_bill_type CHECK (
        lsc_bill_type::text = ANY (ARRAY['ALL'::text, 'CASH'::text, 'CREDIT'::text])),
    CONSTRAINT ck_lsc_rounding CHECK (
        lsc_rounding_method::text = ANY (ARRAY['FLOOR'::text, 'ROUND'::text,
                                               'CEIL'::text, 'NONE'::text])),
    CONSTRAINT ck_lsc_branch_scope CHECK (
        lsc_branch_scope::text = ANY (ARRAY['ALL'::text, 'LIST'::text])),
    CONSTRAINT ck_lsc_cust_scope CHECK (
        lsc_cust_scope::text = ANY (ARRAY['ALL'::text, 'LIST'::text])),
    CONSTRAINT ck_lsc_item_scope CHECK (
        lsc_item_scope::text = ANY (ARRAY['ALL'::text, 'LIST'::text])),
    CONSTRAINT ck_lsc_pool_mode CHECK (
        lsc_pool_mode::text = ANY (ARRAY['COMPANY'::text, 'BRANCH'::text])),
    CONSTRAINT ck_lsc_return_mode CHECK (
        lsc_return_mode::text = ANY (ARRAY['REVERSE'::text, 'IGNORE'::text])),
    -- NONE = never lapses. SCHEME_END_DATE takes the date from lsc_end_date.
    -- The rest are computed from the earn date, which is why no separate
    -- "fixed expiry date" column exists — it would be a second source.
    CONSTRAINT ck_lsc_expiry_basis CHECK (
        lsc_expiry_basis::text = ANY (ARRAY['NONE'::text, 'EARN_DATE'::text,
                          'MONTH_END'::text, 'YEAR_END'::text, 'SCHEME_END_DATE'::text])),
    CONSTRAINT ck_lsc_expiry_days CHECK (
        lsc_points_valid_days >= 0
        AND (lsc_expiry_basis::text <> 'EARN_DATE' OR lsc_points_valid_days > 0)),

    CONSTRAINT ck_lsc_dates CHECK (lsc_end_date >= lsc_start_date),
    -- Both ends of the window or neither. DELIBERATELY NO "to >= from": a
    -- window may legitimately cross midnight (22:22 to 04:44 is a late-night
    -- promotion, not a typo), and the engine must read from > to as "spans
    -- midnight". A constraint here would forbid a real business case.
    CONSTRAINT ck_lsc_time_pair CHECK (
        (lsc_valid_from_time IS NULL) = (lsc_valid_to_time IS NULL)),
    -- Shape, not vocabulary: three-letter day names, comma separated.
    CONSTRAINT ck_lsc_weekdays CHECK (
        lsc_valid_weekdays IS NULL
        OR lsc_valid_weekdays ~ '^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$'),

    CONSTRAINT ck_lsc_priority   CHECK (lsc_priority BETWEEN 1 AND 9),
    CONSTRAINT ck_lsc_decimals   CHECK (lsc_points_decimals BETWEEN 0 AND 4),
    CONSTRAINT ck_lsc_activation CHECK (lsc_activation_days BETWEEN 0 AND 365),
    CONSTRAINT ck_lsc_earn_limits CHECK (
        lsc_min_bill_amount >= 0 AND lsc_max_earn_points >= 0),
    CONSTRAINT ck_lsc_redeem_limits CHECK (
        lsc_redeem_value_per_point >= 0 AND lsc_min_redeem_points >= 0
        AND lsc_max_redeem_points >= 0 AND lsc_redeem_min_bill_amount >= 0
        AND lsc_redeem_multiple >= 0
        AND lsc_max_redeem_perc BETWEEN 0 AND 100),
    -- A scheme that redeems must say what a point is worth, or the till has
    -- nothing to price the redemption with.
    CONSTRAINT ck_lsc_redeem_rate CHECK (
        lsc_allow_point_redeem = false OR lsc_redeem_value_per_point > 0),
    CONSTRAINT ck_lsc_approved CHECK (
        lsc_status::text <> 'APPROVED' OR lsc_approved_by IS NOT NULL)
);

ALTER TABLE IF EXISTS sales.loyalty_scheme OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lsc_code
    ON sales.loyalty_scheme USING btree (lsc_comp_id, lower(lsc_code::text))
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsc_is_deleted = false;

-- One PRIMARY scheme per company / branch / type at a time. NULLS NOT
-- DISTINCT so a company-wide scheme (NULL branch) is caught too.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lsc_primary
    ON sales.loyalty_scheme USING btree (lsc_comp_id, lsc_branch_id, lsc_type)
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsc_priority = 1 AND lsc_status::text = 'APPROVED'
      AND lsc_is_active = true AND lsc_is_deleted = false;

-- The resolver: "which scheme applies to this bill, at this branch, today?"
CREATE INDEX IF NOT EXISTS ix_lsc_resolve
    ON sales.loyalty_scheme USING btree
    (lsc_comp_id, lsc_branch_id, lsc_start_date, lsc_end_date, lsc_priority)
    INCLUDE (lsc_type, lsc_apply_on, lsc_branch_scope, lsc_cust_scope, lsc_item_scope)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsc_is_deleted = false AND lsc_is_active = true
      AND lsc_status::text = 'APPROVED';

-- FK-covering indexes. Every foreign key in this file gets one: without it,
-- deleting or re-keying a master sequentially scans the child, and 133 FKs
-- elsewhere in this database already have that problem.
CREATE INDEX IF NOT EXISTS ix_lsc_branch
    ON sales.loyalty_scheme USING btree (lsc_branch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsc_branch_id IS NOT NULL AND lsc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsc_price_level
    ON sales.loyalty_scheme USING btree (lsc_price_level_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsc_price_level_id IS NOT NULL AND lsc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsc_redeem_tender
    ON sales.loyalty_scheme USING btree (lsc_redeem_tender_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsc_redeem_tender_id IS NOT NULL AND lsc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsc_approved_by
    ON sales.loyalty_scheme USING btree (lsc_approved_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsc_approved_by IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
--  §2  sales.loyalty_scheme_branch — which branches run it
--
--  Read only when lsc_branch_scope = 'LIST'. lsb_is_exclude makes "all except
--  two" two rows rather than thirty-eight; an EXCLUDE row always beats an
--  INCLUDE row for the same branch.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_scheme_branch
(
    lsb_id          uuid NOT NULL DEFAULT uuidv7(),
    lsb_lsc_id      uuid NOT NULL,
    lsb_slno        integer NOT NULL DEFAULT 1,
    lsb_branch_id   uuid NOT NULL,
    lsb_is_exclude  boolean NOT NULL DEFAULT false,
    lsb_notes       text,
    lsb_is_active   boolean NOT NULL DEFAULT true,
    lsb_is_deleted  boolean NOT NULL DEFAULT false,
    lsb_sync_date   timestamp with time zone,
    lsb_created_on  timestamp with time zone NOT NULL DEFAULT now(),
    lsb_created_by  character varying(50),
    lsb_modified_on timestamp with time zone,
    lsb_modified_by character varying(50),

    CONSTRAINT pk_loyalty_scheme_branch PRIMARY KEY (lsb_id),
    CONSTRAINT fk_lsb_scheme FOREIGN KEY (lsb_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_lsb_branch FOREIGN KEY (lsb_branch_id)
        REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_lsb_slno CHECK (lsb_slno > 0)
);

ALTER TABLE IF EXISTS sales.loyalty_scheme_branch OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lsb_row
    ON sales.loyalty_scheme_branch USING btree (lsb_lsc_id, lsb_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsb_scheme
    ON sales.loyalty_scheme_branch USING btree (lsb_lsc_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsb_branch
    ON sales.loyalty_scheme_branch USING btree (lsb_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsb_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  §3  sales.loyalty_scheme_party — who it applies to
--
--  ONE KIND + ONE SCOPE ID, with the foreign keys kept by generated columns.
--  Read only when lsc_cust_scope = 'LIST'.
--
--      lsp_kind      CUSTOMER | CUSTOMER_GROUP
--      lsp_scope_id  the id, whichever master it belongs to
--
--  The entry grid is TWO columns wide — a kind, and the target it chooses — so
--  those are the two columns stored, and the screen binds to them directly.
--
--  On its own that is the polymorphic id this file was written to get rid of:
--  one column cannot reference two tables, so it can carry no foreign key, and
--  a deleted customer group leaves a scheme rule pointing at nothing. Both are
--  had by putting GENERATED ALWAYS ... STORED columns beside the pair, one per
--  kind, each holding the id only when the kind matches:
--
--      lsp_cust_id uuid GENERATED ALWAYS AS
--          (CASE WHEN lsp_kind = 'CUSTOMER' THEN lsp_scope_id END) STORED
--
--  Each is single-purpose, so each takes a real foreign key. Nothing can write
--  them — PostgreSQL refuses a direct INSERT — so they cannot drift from the
--  pair, and no CHECK is needed to keep them honest. "Exactly one target is
--  set" is no longer a constraint to test; it is a consequence of how the
--  columns are computed.
--
--  This is the same shape as sales.promotion_scheme_party, deliberately: the
--  two screens have the same grid and should not have two designs.
--
--  ONE COST, stated rather than buried: these foreign keys are ON UPDATE
--  NO ACTION, not ON UPDATE CASCADE. PostgreSQL forbids a cascading update on
--  a key containing a generated column. Every master key here is a uuidv7()
--  that is never reissued, so nothing is lost, and NO ACTION refuses rather
--  than propagates, which is the stricter behaviour.
--
--  FOR THE BACKEND DEV: the live database is Prisma-managed. Generated columns
--  must be mapped read-only (@default(dbgenerated()) with no argument); an ORM
--  that tries to INSERT into lsp_cust_id will be refused by the server.
--
--  lsp_match_priority makes "a rule naming one CUSTOMER beats one naming their
--  GROUP" data rather than an assumption in the engine. Seed CUSTOMER 2,
--  CUSTOMER_GROUP 1. An EXCLUDE row beats an INCLUDE row at equal priority.
--
--  NOTE: promotion_scheme_party also offers AREA and CITY. Loyalty does not:
--  a wallet follows the person, not the route. Adding them here would be one
--  generated column and one FK each, if a chain ever wants to earn points by
--  geography.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_scheme_party
(
    lsp_id             uuid NOT NULL DEFAULT uuidv7(),
    lsp_lsc_id         uuid NOT NULL,
    lsp_slno           integer NOT NULL DEFAULT 1,

    lsp_kind           character varying(20) NOT NULL,
    lsp_scope_id       uuid NOT NULL,          -- the customer or the group

    -- Generated FK carriers; see the header above. Never written, never sent.
    lsp_cust_id        uuid GENERATED ALWAYS AS
        (CASE WHEN lsp_kind::text = 'CUSTOMER'       THEN lsp_scope_id END) STORED,
    lsp_cust_group_id  uuid GENERATED ALWAYS AS
        (CASE WHEN lsp_kind::text = 'CUSTOMER_GROUP' THEN lsp_scope_id END) STORED,

    lsp_is_exclude     boolean  NOT NULL DEFAULT false,
    lsp_match_priority smallint NOT NULL DEFAULT 1,
    lsp_notes          text,
    lsp_is_active      boolean NOT NULL DEFAULT true,
    lsp_is_deleted     boolean NOT NULL DEFAULT false,
    lsp_sync_date      timestamp with time zone,
    lsp_created_on     timestamp with time zone NOT NULL DEFAULT now(),
    lsp_created_by     character varying(50),
    lsp_modified_on    timestamp with time zone,
    lsp_modified_by    character varying(50),

    CONSTRAINT pk_loyalty_scheme_party PRIMARY KEY (lsp_id),
    CONSTRAINT fk_lsp_scheme FOREIGN KEY (lsp_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- ON UPDATE NO ACTION: PostgreSQL forbids a cascading update on a key
    -- containing a generated column. See the header.
    CONSTRAINT fk_lsp_cust FOREIGN KEY (lsp_cust_id)
        REFERENCES sales.customers (cus_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_lsp_cust_group FOREIGN KEY (lsp_cust_group_id)
        REFERENCES sales.cust_groups (cgr_id) ON UPDATE NO ACTION ON DELETE RESTRICT,

    -- The vocabulary is the only thing left to check by hand. "Exactly one
    -- target is set" is now derived, not tested.
    CONSTRAINT ck_lsp_kind CHECK (
        lsp_kind::text = ANY (ARRAY['CUSTOMER'::text, 'CUSTOMER_GROUP'::text])),
    CONSTRAINT ck_lsp_slno CHECK (lsp_slno > 0),
    CONSTRAINT ck_lsp_match_priority CHECK (lsp_match_priority BETWEEN 0 AND 9)
);

ALTER TABLE IF EXISTS sales.loyalty_scheme_party OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lsp_row
    ON sales.loyalty_scheme_party USING btree (lsp_lsc_id, lsp_kind, lsp_scope_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsp_scheme
    ON sales.loyalty_scheme_party USING btree (lsp_lsc_id, lsp_match_priority DESC)
    INCLUDE (lsp_kind, lsp_scope_id, lsp_is_exclude)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsp_is_deleted = false AND lsp_is_active = true;
-- Reverse lookup, and the FK-covering index for each target.
CREATE INDEX IF NOT EXISTS ix_lsp_cust
    ON sales.loyalty_scheme_party USING btree (lsp_cust_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsp_cust_id IS NOT NULL AND lsp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsp_cust_group
    ON sales.loyalty_scheme_party USING btree (lsp_cust_group_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsp_cust_group_id IS NOT NULL AND lsp_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  §4  sales.loyalty_scheme_item — which stock it applies to
--
--  ONE KIND + ONE SCOPE ID, with five GENERATED columns carrying the foreign
--  keys — the same shape as §3 above and as promotion_scheme_item.
--
--      lsi_kind      ITEM | ITEM_GROUP | ITEM_CATEGORY | ITEM_BRAND | ITEM_SECTION
--      lsi_scope_id  the id, whichever master it belongs to
--
--  The vocabulary is the live one: loyalty_sch_list.ls_item_type already used
--  exactly these five values, so the new screen and the old data agree.
--
--  This is what makes "double points on own-brand, but nothing on tobacco"
--  expressible in one scheme — the predecessor could hold only ONE kind of
--  grouping per scheme and could not exclude at all.
--
--  lsi_match_priority: most specific wins. Seed ITEM 4, BRAND 3, CATEGORY 2,
--  SECTION 1, GROUP 0. Data, not a hard-coded rule, so a shop can reorder it.
--  An EXCLUDE row earns nothing regardless of any broader rule.
--
--  Read only when lsc_item_scope = 'LIST'.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_scheme_item
(
    lsi_id             uuid NOT NULL DEFAULT uuidv7(),
    lsi_lsc_id         uuid NOT NULL,
    lsi_slno           integer NOT NULL DEFAULT 1,

    lsi_kind           character varying(20) NOT NULL,
    lsi_scope_id       uuid NOT NULL,          -- item, group, category, brand or section

    -- Generated FK carriers; never written, never sent. See §3's header.
    lsi_item_id        uuid GENERATED ALWAYS AS
        (CASE WHEN lsi_kind::text = 'ITEM'          THEN lsi_scope_id END) STORED,
    lsi_group_id       uuid GENERATED ALWAYS AS
        (CASE WHEN lsi_kind::text = 'ITEM_GROUP'    THEN lsi_scope_id END) STORED,
    lsi_category_id    uuid GENERATED ALWAYS AS
        (CASE WHEN lsi_kind::text = 'ITEM_CATEGORY' THEN lsi_scope_id END) STORED,
    lsi_brand_id       uuid GENERATED ALWAYS AS
        (CASE WHEN lsi_kind::text = 'ITEM_BRAND'    THEN lsi_scope_id END) STORED,
    lsi_section_id     uuid GENERATED ALWAYS AS
        (CASE WHEN lsi_kind::text = 'ITEM_SECTION'  THEN lsi_scope_id END) STORED,

    lsi_is_exclude     boolean       NOT NULL DEFAULT false,
    -- Multiplies whatever the slab computed for the line (2.0 = double points).
    lsi_factor         numeric(18,4) NOT NULL DEFAULT 1,
    -- Non-zero replaces the slab result outright instead of scaling it.
    lsi_points         numeric(18,4) NOT NULL DEFAULT 0,
    lsi_max_points     numeric(18,4) NOT NULL DEFAULT 0,   -- 0 = uncapped, per line
    lsi_match_priority smallint      NOT NULL DEFAULT 1,
    lsi_notes          text,
    lsi_is_active      boolean NOT NULL DEFAULT true,
    lsi_is_deleted     boolean NOT NULL DEFAULT false,
    lsi_sync_date      timestamp with time zone,
    lsi_created_on     timestamp with time zone NOT NULL DEFAULT now(),
    lsi_created_by     character varying(50),
    lsi_modified_on    timestamp with time zone,
    lsi_modified_by    character varying(50),

    CONSTRAINT pk_loyalty_scheme_item PRIMARY KEY (lsi_id),
    CONSTRAINT fk_lsi_scheme FOREIGN KEY (lsi_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_lsi_item FOREIGN KEY (lsi_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_lsi_group FOREIGN KEY (lsi_group_id)
        REFERENCES inventory.item_group_master (itg_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_lsi_category FOREIGN KEY (lsi_category_id)
        REFERENCES inventory.item_category_master (category_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_lsi_brand FOREIGN KEY (lsi_brand_id)
        REFERENCES inventory.item_brand_master (brand_id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT fk_lsi_section FOREIGN KEY (lsi_section_id)
        REFERENCES inventory.item_section_master (sec_id) ON UPDATE NO ACTION ON DELETE RESTRICT,

    CONSTRAINT ck_lsi_kind CHECK (
        lsi_kind::text = ANY (ARRAY['ITEM'::text, 'ITEM_GROUP'::text,
              'ITEM_CATEGORY'::text, 'ITEM_BRAND'::text, 'ITEM_SECTION'::text])),
    -- An exclusion earns nothing, so a rate on it would be a contradiction
    -- somebody would eventually try to read.
    CONSTRAINT ck_lsi_exclude CHECK (
        lsi_is_exclude = false OR (lsi_points = 0 AND lsi_factor = 1)),
    CONSTRAINT ck_lsi_values CHECK (
        lsi_factor > 0 AND lsi_points >= 0 AND lsi_max_points >= 0),
    CONSTRAINT ck_lsi_slno CHECK (lsi_slno > 0),
    CONSTRAINT ck_lsi_match_priority CHECK (lsi_match_priority BETWEEN 0 AND 9)
);

ALTER TABLE IF EXISTS sales.loyalty_scheme_item OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lsi_row
    ON sales.loyalty_scheme_item USING btree (lsi_lsc_id, lsi_kind, lsi_scope_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsi_is_deleted = false;

-- The engine walks a scheme's rules most-specific first, once per bill line,
-- so this must not touch the heap.
CREATE INDEX IF NOT EXISTS ix_lsi_scheme
    ON sales.loyalty_scheme_item USING btree (lsi_lsc_id, lsi_match_priority DESC)
    INCLUDE (lsi_kind, lsi_scope_id, lsi_is_exclude, lsi_factor, lsi_points)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsi_is_deleted = false AND lsi_is_active = true;

-- Reverse lookups, doubling as the FK-covering index for each master.
CREATE INDEX IF NOT EXISTS ix_lsi_item     ON sales.loyalty_scheme_item USING btree (lsi_item_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsi_item_id     IS NOT NULL AND lsi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsi_group    ON sales.loyalty_scheme_item USING btree (lsi_group_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsi_group_id    IS NOT NULL AND lsi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsi_category ON sales.loyalty_scheme_item USING btree (lsi_category_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsi_category_id IS NOT NULL AND lsi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsi_brand    ON sales.loyalty_scheme_item USING btree (lsi_brand_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsi_brand_id    IS NOT NULL AND lsi_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsi_section  ON sales.loyalty_scheme_item USING btree (lsi_section_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsi_section_id  IS NOT NULL AND lsi_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  §5  sales.loyalty_scheme_slab — the earn rates
--
--  One row = one rate band. Read as:
--      for every lss_each units ABOVE lss_exceeds, award lss_points,
--      scaled by lss_factor.
--  "units" are rupees when lsc_apply_on is BILL_AMOUNT / ITEM_AMOUNT, and
--  quantity when it is BILL_QTY / ITEM_QTY.
--
--  Bill-value slabs are ROWS, not columns: 0-999 -> 1pt/100, 1000-4999 ->
--  2pt/100, 5000+ -> 3pt/100 is three rows. lss_item_id narrows a band to one
--  item; leave it NULL for a whole-bill band. Anything broader than one item
--  (group, brand, category) belongs in loyalty_scheme_item, which multiplies
--  what this computes.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_scheme_slab
(
    lss_id          uuid NOT NULL DEFAULT uuidv7(),
    lss_lsc_id      uuid NOT NULL,
    lss_slno        integer NOT NULL DEFAULT 1,

    lss_item_id     uuid,                    -- NULL = applies to the whole bill
    lss_unit_id     uuid,                    -- item_unit_conversion, as on a bill line

    lss_exceeds     numeric(18,3) NOT NULL DEFAULT 0,   -- band lower bound
    lss_upto        numeric(18,3),                      -- band ceiling; NULL = open-ended
    lss_each        numeric(18,3) NOT NULL DEFAULT 1,   -- granularity
    lss_points      numeric(18,4) NOT NULL DEFAULT 0,   -- awarded per lss_each
    lss_factor      numeric(18,4) NOT NULL DEFAULT 1,
    lss_max_points  numeric(18,4) NOT NULL DEFAULT 0,   -- 0 = uncapped

    lss_notes       text,
    lss_is_active   boolean NOT NULL DEFAULT true,
    lss_is_deleted  boolean NOT NULL DEFAULT false,
    lss_sync_date   timestamp with time zone,
    lss_created_on  timestamp with time zone NOT NULL DEFAULT now(),
    lss_created_by  character varying(50),
    lss_modified_on timestamp with time zone,
    lss_modified_by character varying(50),

    CONSTRAINT pk_loyalty_scheme_slab PRIMARY KEY (lss_id),
    CONSTRAINT fk_lss_scheme FOREIGN KEY (lss_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_lss_item FOREIGN KEY (lss_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lss_unit FOREIGN KEY (lss_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lss_band CHECK (
        lss_exceeds >= 0 AND (lss_upto IS NULL OR lss_upto > lss_exceeds)),
    CONSTRAINT ck_lss_values CHECK (
        lss_each > 0 AND lss_points >= 0 AND lss_factor > 0 AND lss_max_points >= 0),
    CONSTRAINT ck_lss_slno CHECK (lss_slno > 0)
);

ALTER TABLE IF EXISTS sales.loyalty_scheme_slab OWNER to postgres;

-- One band per item per lower bound: stops two rows claiming the same slab
-- with nothing to say which wins.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lss_band
    ON sales.loyalty_scheme_slab USING btree
    (lss_lsc_id, COALESCE(lss_item_id, '00000000-0000-0000-0000-000000000000'::uuid), lss_exceeds)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lss_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lss_scheme
    ON sales.loyalty_scheme_slab USING btree (lss_lsc_id, lss_exceeds)
    INCLUDE (lss_item_id, lss_upto, lss_each, lss_points, lss_factor)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lss_is_deleted = false AND lss_is_active = true;
CREATE INDEX IF NOT EXISTS ix_lss_item ON sales.loyalty_scheme_slab USING btree (lss_item_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lss_item_id IS NOT NULL AND lss_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lss_unit ON sales.loyalty_scheme_slab USING btree (lss_unit_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lss_unit_id IS NOT NULL AND lss_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  §6  sales.loyalty_scheme_gift — points buy an ITEM
--
--  The catalogue of what MAY be claimed. What was actually handed over is
--  recorded in sales.loyalty_gift_issue (13), which does not exist yet.
--
--  A gift redemption is NOT a tender: no money crosses the counter, stock
--  does. lsg_unit_id references item_unit_conversion(iuc_id) — the same target
--  sale_bill_item.fk_sbi_item_unit uses — because the gift becomes a bill line
--  and the two must agree without a conversion lookup.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_scheme_gift
(
    lsg_id               uuid NOT NULL DEFAULT uuidv7(),
    lsg_lsc_id           uuid NOT NULL,
    lsg_slno             integer NOT NULL DEFAULT 1,

    lsg_item_id          uuid NOT NULL,
    lsg_unit_id          uuid NOT NULL,
    lsg_item_qty         numeric(18,3) NOT NULL DEFAULT 1,
    lsg_redeem_points    numeric(18,4) NOT NULL DEFAULT 0,

    lsg_repeat           boolean NOT NULL DEFAULT false,   -- claimable more than once
    lsg_max_qty_per_bill numeric(18,3) NOT NULL DEFAULT 0, -- 0 = uncapped
    -- Block the claim when the item is not in stock at the issuing branch. A
    -- real till problem: a gift the shop cannot hand over is worse than one it
    -- never offered.
    lsg_stock_check      boolean NOT NULL DEFAULT true,
    lsg_valid_from       date,
    lsg_valid_upto       date,

    lsg_notes            text,
    lsg_is_active        boolean NOT NULL DEFAULT true,
    lsg_is_deleted       boolean NOT NULL DEFAULT false,
    lsg_sync_date        timestamp with time zone,
    lsg_created_on       timestamp with time zone NOT NULL DEFAULT now(),
    lsg_created_by       character varying(50),
    lsg_modified_on      timestamp with time zone,
    lsg_modified_by      character varying(50),

    CONSTRAINT pk_loyalty_scheme_gift PRIMARY KEY (lsg_id),
    CONSTRAINT fk_lsg_scheme FOREIGN KEY (lsg_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_lsg_item FOREIGN KEY (lsg_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lsg_unit FOREIGN KEY (lsg_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lsg_qty CHECK (lsg_item_qty > 0 AND lsg_max_qty_per_bill >= 0),
    CONSTRAINT ck_lsg_points CHECK (lsg_redeem_points >= 0),
    CONSTRAINT ck_lsg_validity CHECK (
        lsg_valid_from IS NULL OR lsg_valid_upto IS NULL OR lsg_valid_upto >= lsg_valid_from),
    CONSTRAINT ck_lsg_slno CHECK (lsg_slno > 0)
);

ALTER TABLE IF EXISTS sales.loyalty_scheme_gift OWNER to postgres;

-- One catalogue row per item+unit per scheme: without it the same gift can be
-- listed twice at two point prices, with nothing to say which wins.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lsg_item
    ON sales.loyalty_scheme_gift USING btree (lsg_lsc_id, lsg_item_id, lsg_unit_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsg_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsg_scheme
    ON sales.loyalty_scheme_gift USING btree (lsg_lsc_id, lsg_redeem_points)
    INCLUDE (lsg_item_id, lsg_unit_id, lsg_item_qty)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lsg_is_deleted = false AND lsg_is_active = true;
CREATE INDEX IF NOT EXISTS ix_lsg_item ON sales.loyalty_scheme_gift USING btree (lsg_item_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsg_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lsg_unit ON sales.loyalty_scheme_gift USING btree (lsg_unit_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lsg_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  §7  Comments
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE sales.loyalty_scheme IS
    'Loyalty campaign header. Rules only — no balances, no movements; those are 13 (points) and 14 (coupons). Supersedes sales.loyalty_sch_list, which this migration drops.';
COMMENT ON COLUMN sales.loyalty_scheme.lsc_activation_days IS
    'Days a lot must age before it may be REDEEMED. Points still earn on bill save; this is the return-window defence against a bill being returned after its points were spent. Enforced via loyalty_ledger.lld_active_from and fn_loyalty_redeemable (13).';
COMMENT ON COLUMN sales.loyalty_scheme.lsc_pool_mode IS
    'COMPANY = one wallet across every branch (default, and what a chain wants). BRANCH = a franchisee honours only the points it issued.';
COMMENT ON COLUMN sales.loyalty_scheme.lsc_redeem_value_per_point IS
    'Rupees per point. Wins over acc_tender_master.tnd_conversion_rate when a scheme matches; the tender master is the fallback. acc_tender_detail.td_conversion_rate snapshots whichever was used.';
COMMENT ON COLUMN sales.loyalty_scheme.lsc_valid_to_time IS
    'A window where to_time < from_time SPANS MIDNIGHT and is valid. There is deliberately no ordering constraint on the pair.';
COMMENT ON COLUMN sales.loyalty_scheme.lsc_valid_weekdays IS
    'Three-letter day names, comma separated: MON,TUE,... NULL = every day.';
COMMENT ON TABLE sales.loyalty_scheme_party IS
    'Who a scheme applies to. Stores lsp_kind + lsp_scope_id — the two columns the entry grid binds to — with generated columns beside them carrying a real FK per kind. Read only when lsc_cust_scope = LIST. Same shape as promotion_scheme_party.';
COMMENT ON COLUMN sales.loyalty_scheme_party.lsp_kind IS
    'CUSTOMER | CUSTOMER_GROUP — which master lsp_scope_id points into. Loyalty deliberately has no AREA or CITY: a wallet follows the person, not the route.';
COMMENT ON COLUMN sales.loyalty_scheme_party.lsp_cust_id IS
    'GENERATED, never written. Holds lsp_scope_id only when lsp_kind = CUSTOMER, which is what lets it carry a real FK to sales.customers. Map it read-only in any ORM.';
COMMENT ON TABLE sales.loyalty_scheme_item IS
    'Which stock a scheme applies to. Stores lsi_kind + lsi_scope_id, with five generated columns carrying a real FK per kind. Read only when lsc_item_scope = LIST.';
COMMENT ON COLUMN sales.loyalty_scheme_item.lsi_kind IS
    'ITEM | ITEM_GROUP | ITEM_CATEGORY | ITEM_BRAND | ITEM_SECTION — the live loyalty_sch_list.ls_item_type vocabulary, so the new screen and the old data agree.';
COMMENT ON COLUMN sales.loyalty_scheme_item.lsi_match_priority IS
    'Narrowest wins: seed ITEM 4, ITEM_BRAND 3, ITEM_CATEGORY 2, ITEM_SECTION 1, ITEM_GROUP 0. Data rather than a hard-coded rule.';
COMMENT ON TABLE sales.loyalty_scheme_slab IS
    'Earn rate bands. For every lss_each units above lss_exceeds, award lss_points x lss_factor. Bill-value slabs are rows, not columns.';
COMMENT ON TABLE sales.loyalty_scheme_gift IS
    'Catalogue of what points may be exchanged for. The issue itself is loyalty_gift_issue (13). Units reference item_unit_conversion, as bill lines do.';


-- ═══════════════════════════════════════════════════════════════════════════
--  §8  Grid 40 — the loyalty scheme pick list
--
--  Its stored grid_sql selected from sales.loyalty_sch_list and counted rows in
--  the three tables §0 just dropped, so every run of it would now fail. Repoint
--  it at loyalty_scheme and re-count against the five child tables, keeping the
--  same grid_id and the same five columns the client already binds to — only
--  their sql_field_name changes, ls_* -> lsc_*.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_grid_id  BIGINT := 40;
  v_grid_sql TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = v_grid_id) THEN
    RETURN;
  END IF;

  v_grid_sql :=
    'SELECT lsc.lsc_id, lsc.lsc_code, lsc.lsc_name, lsc.lsc_type, lsc.lsc_status, lsc.lsc_branch_id, '
    || 'lsc.lsc_start_date, lsc.lsc_end_date, lsc.lsc_is_active, '
    || '(SELECT COUNT(*) FROM sales.loyalty_scheme_slab lss WHERE lss.lss_lsc_id = lsc.lsc_id AND lss.lss_is_deleted = false AND lss.lss_is_active = true) AS slabs_count, '
    || '(SELECT COUNT(*) FROM sales.loyalty_scheme_gift lsg WHERE lsg.lsg_lsc_id = lsc.lsc_id AND lsg.lsg_is_deleted = false AND lsg.lsg_is_active = true) AS gifts_count, '
    || '(SELECT COUNT(*) FROM sales.loyalty_scheme_party lsp WHERE lsp.lsp_lsc_id = lsc.lsc_id AND lsp.lsp_is_deleted = false AND lsp.lsp_is_active = true) AS parties_count, '
    || '(SELECT COUNT(*) FROM sales.loyalty_scheme_item lsi WHERE lsi.lsi_lsc_id = lsc.lsc_id AND lsi.lsi_is_deleted = false AND lsi.lsi_is_active = true) AS items_count, '
    || '(SELECT COUNT(*) FROM sales.loyalty_scheme_branch lsb WHERE lsb.lsb_lsc_id = lsc.lsc_id AND lsb.lsb_is_deleted = false AND lsb.lsb_is_active = true) AS branches_count '
    || 'FROM sales.loyalty_scheme lsc '
    || 'WHERE lsc.lsc_is_deleted = false '
    || 'AND lsc.lsc_comp_id = p_comp_id::uuid '
    || 'AND (NULLIF(p_branch_id, '''') IS NULL OR lsc.lsc_branch_id = NULLIF(p_branch_id, '''')::uuid) '
    || 'AND (NULLIF(p_status, '''') IS NULL OR lsc.lsc_status = NULLIF(p_status, '''')) '
    || 'AND (NULLIF(p_type, '''') IS NULL OR lsc.lsc_type = NULLIF(p_type, '''')) '
    || 'ORDER BY lsc.lsc_name, lsc.lsc_id';

  UPDATE fixed.grid_details
     SET grid_sql = v_grid_sql
   WHERE grid_id = v_grid_id;

  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'lsc_name'      WHERE grid_id = v_grid_id AND grid_column_sql_field_name = 'ls_name';
  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'lsc_code'      WHERE grid_id = v_grid_id AND grid_column_sql_field_name = 'ls_code';
  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'lsc_type'      WHERE grid_id = v_grid_id AND grid_column_sql_field_name = 'ls_type';
  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'lsc_status'    WHERE grid_id = v_grid_id AND grid_column_sql_field_name = 'ls_status';
  UPDATE fixed.grid_columns SET grid_column_sql_field_name = 'lsc_is_active' WHERE grid_id = v_grid_id AND grid_column_sql_field_name = 'ls_is_active';
END $$;
