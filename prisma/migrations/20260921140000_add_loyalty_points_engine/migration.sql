-- ═══════════════════════════════════════════════════════════════════════════
--  Loyalty POINTS engine
--      sales.loyalty_member            one wallet per customer, open across years
--      sales.loyalty_ledger            one row per point movement, and the FIFO lots
--      sales.loyalty_gift_redeem       a gift redemption slip (header)
--      sales.loyalty_gift_redeem_item  the goods that went out (detail)
--
--  Builds on the loyalty SCHEME masters (sales.loyalty_scheme and friends),
--  which already exist. Requires PostgreSQL 18+ for uuidv7().
--
--  ── The shape, and why ───────────────────────────────────────────────────
--  This is accounts.acc_bill_balance applied to points, and deliberately so.
--  A points balance is the same animal as a bill's outstanding: it opens, it
--  is drawn down by events that happen in other financial years, and it is
--  NEVER carried forward at year end. So:
--
--      loyalty_member  is NOT partitioned, single-column PK. A customer who
--                      earned in 2025-2026 and spends in 2027-2028 is the
--                      SAME row throughout. lmb_acc_year records the year they
--                      enrolled and is a reporting filter only — making it a
--                      partition key is exactly the mistake the bill-balance
--                      repartitioning exists to undo.
--
--      loyalty_ledger  IS partitioned, by the year of the EVENT rather than of
--                      the bill behind it. July's redemption of April's points
--                      lands in July's partition and April's earn row never
--                      moves. Composite PK (id, acc_year).
--
--  The roll-ups on loyalty_member are CACHES of the ledger. Application code
--  writes ledger rows and reads balances, never the other way round.
--
--  ── FIFO, stated once ────────────────────────────────────────────────────
--  Points are consumed OLDEST-EXPIRY FIRST; within one expiry date, OLDEST-
--  EARNED first; lots that never expire are consumed LAST:
--
--      ORDER BY lld_expires_on NULLS LAST, lld_txn_date, lld_id
--
--  That is the customer-favourable order — it spends what would otherwise
--  lapse. It is declared in ONE method of LoyaltyLedgerService and nowhere
--  else, so the till, the redeem endpoint and the expiry run cannot disagree
--  about it.
--
--  The lot link lives ON the ledger row: a consuming row (REDEEM / GIFT /
--  EXPIRE) names the EARN lot it drew from, and the lot carries its own
--  lld_consumed_points. A redemption spanning three lots is therefore THREE
--  REDEEM rows sharing ONE tender — the same granularity acc_bill_adjustment
--  uses for a bill settled by three tenders. It costs rows and buys expiry
--  that is exact, reversible and auditable.
--
--  ── Granularity, decided once so the two sides do not drift ──────────────
--    * ONE wallet per (company, customer). Not per branch and not per scheme:
--      switching scheme must not split a balance, and a chain's whole point is
--      that points earned at one branch spend at another. lld_branch_id
--      records where each EVENT happened, which is what inter-branch
--      settlement between franchisees actually needs.
--    * ONE ledger row per lot consumed, per event.
--    * A cancellation, a claw-back or a mis-keyed adjustment is REVERSED by a
--      new row of opposite sign naming the row it undoes (lld_reversal_of_id),
--      never by deleting or editing the original. The trail is the point.
--
--  ── Accounting: STATISTICAL ONLY ─────────────────────────────────────────
--  Earning points posts NOTHING to the general ledger. There is no liability
--  accrual and no expense provision here, by decision. The GL is touched only
--  at REDEMPTION, and only by the tender row that already posts:
--  accounts.acc_tender_detail with td_tender_type_id = 10 (LOYALTY, confirmed
--  present in accounts.acc_tender_types), carrying td_units_used (the points)
--  and td_conversion_rate (rupees per point). If accrual is ever wanted, it is
--  a new migration, not a change to this one.
--
--  ── The claw-back rule ───────────────────────────────────────────────────
--  A bill earns 500 points; the customer spends them; the bill is returned.
--  Reversing the earn would push the wallet negative. The primary defence is
--  loyalty_scheme.lsc_activation_days: points earn immediately but are not
--  REDEEMABLE until the return window has closed, so the situation mostly
--  cannot arise.
--
--  When it arises anyway — a return after the cooling period — the write path
--  must CAP the claw-back at the live balance and record the shortfall in
--  lld_remarks. It must NOT abort the return: nobody is holding a queue at a
--  till while a supervisor works out why a credit note will not save. The
--  schema cannot enforce this; it is a write-path rule, so it is written down
--  here and nowhere else.
--
--  ── How any of this reaches Tally ────────────────────────────────────────
--  Export happens at the VOUCHER layer and nowhere else. acc_voucher_header
--  carries the Tally guid and export status. Nothing in this migration
--  duplicates any of that — a loyalty table with its own tally_guid would be a
--  second, competing export path.
--
--    POINTS EARNED    nothing to export. Earning is statistical: it moves no
--                     money and posts no ledger entry, so there is no voucher
--                     and Tally never hears about it.
--    POINTS REDEEMED  through the tender. lld_tender_id names the
--                     acc_tender_detail row, which carries td_voucher_id once
--                     posted, and the voucher exports normally.
--    A GIFT           through lgr_posted_voucher_id. Goods left the shelf, so
--                     this one DOES have to post: in Tally a Stock Journal
--                     (consumption) or a zero-value Delivery Note, with the
--                     giveaway cost from loyalty_gift_redeem_item.lgd_cost_price.
--
--  STILL NEEDED, and deliberately NOT done here: a row in
--  accounts.acc_voucher_types for the gift redemption, with Tally export and
--  inventory-affecting flags set. Its vchr_type_id is a small integer assigned
--  by hand, and guessing the next free one is exactly the kind of collision
--  that is cheap to avoid and expensive to undo, so it is left to whoever owns
--  that master.
--
--  ── Deviations from the source design note, and why ──────────────────────
--   1. PARTITIONS. The note creates them with a self-contained DO loop over
--      three hard-coded years, on the grounds that fn_create_year_partitions
--      "does not exist on the live database". It does not — but
--      public.ensure_acc_year_partitions does, and it is the function the
--      April 1st ritual actually calls. A table that is partitioned but absent
--      from its list is silently skipped when a year is opened and fails at
--      the first insert of the new year — which is what the voucher tables did
--      until 20260915120000 caught it. So the three partitioned tables here go
--      INTO that function, and the years are read off txn_status_log rather
--      than hard-coded: this database has four (2024-2025 … 2027-2028), not
--      the three the note names.
--
--   2. TRIGGERS. The note is emphatic and at length that this file contains no
--      functions and no triggers — the recomputes are LoyaltyLedgerService's —
--      but several of its COMMENT ON statements still say "Trigger-maintained"
--      and one paragraph refers to "the trigger above (tr_lld_refresh)". There
--      is no such trigger and nothing here creates one. The comments below say
--      what is actually true, because a COMMENT is what the next person reads
--      out of \d+ when a wallet looks wrong.
--
--   3. sales.sale_return is NOT touched, exactly as the note instructs, and
--      the table genuinely does not exist yet in this database — so an
--      ALTER TABLE IF EXISTS would have been the silent no-op it warns about.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  The wallet.
--
--  NOT partitioned, and never carried forward at year end. Keyed by COMPANY
--  and CUSTOMER — never by branch. That single index, ux_lmb_cust, is what
--  makes a chain's points portable between its branches; everything else about
--  cross-branch behaviour is policy on top of it (lsc_pool_mode).
--
--  lmb_card_no and lmb_mobile are ALTERNATE HANDLES, not identity. The
--  identity is lmb_cust_id. They exist because a supermarket till finds a
--  shopper by scanning a card or typing a phone number, and that lookup must
--  be answered from an index rather than by scanning sales.customers.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_member
(
    lmb_id                uuid           NOT NULL DEFAULT uuidv7(),
    lmb_comp_id           uuid           NOT NULL,
    lmb_branch_id         uuid,                      -- branch that ENROLLED them; never a scope
    lmb_tenant_id         uuid,
    lmb_acc_year          character(9)   NOT NULL,   -- FY of enrolment, filter only

    -- ── Identity ─────────────────────────────────────────────────────────
    lmb_cust_id           uuid           NOT NULL,   -- THE identity
    -- The accounting party, snapshotted so a points-liability report can join
    -- accounts without a hop through the customer master. Nullable: a cash
    -- customer may have no ledger row yet.
    lmb_party_ledger_id   uuid,
    lmb_lsc_id            uuid,                      -- scheme currently enrolled on
    lmb_card_no           character varying(30),
    lmb_mobile            character varying(20),     -- snapshot of customers.cus_phone1
    lmb_enrolled_on       date           NOT NULL DEFAULT CURRENT_DATE,

    -- ── Roll-ups ─────────────────────────────────────────────────────────
    -- CACHES of sales.loyalty_ledger, recomputed by
    -- LoyaltyLedgerService.recomputeMembers(). Never written by any other
    -- application code. All stored positive except lmb_adjusted_points, which
    -- is signed.
    lmb_earned_points     numeric(18,4)  NOT NULL DEFAULT 0,
    lmb_redeemed_points   numeric(18,4)  NOT NULL DEFAULT 0,
    lmb_expired_points    numeric(18,4)  NOT NULL DEFAULT 0,
    lmb_gift_points       numeric(18,4)  NOT NULL DEFAULT 0,
    lmb_adjusted_points   numeric(18,4)  NOT NULL DEFAULT 0,

    -- What the customer holds. THIS is the cust_points the bill screen shows.
    -- GENERATED: Postgres fills it from the five buckets above, so the service
    -- writes the inputs and never this. A push that sends a whole row must
    -- leave it out of the column list or the INSERT is rejected.
    lmb_balance_points    numeric(18,4)
        GENERATED ALWAYS AS (lmb_earned_points + lmb_adjusted_points
                             - lmb_redeemed_points - lmb_expired_points
                             - lmb_gift_points) STORED,

    -- Lifetime trading, which points alone cannot answer: lmb_earned_points is
    -- already "everything ever earned" (redemption never touches that bucket),
    -- so a separate lifetime-points column would just be a second copy of it.
    -- These two are not derivable from the point columns at all.
    lmb_lifetime_bill_amt numeric(18,2)  NOT NULL DEFAULT 0,
    lmb_lifetime_bill_cnt integer        NOT NULL DEFAULT 0,

    lmb_last_earn_on      date,
    lmb_last_redeem_on    date,
    -- The dormant-member report and lsc_expiry_basis = 'LAST_TXN' have no other
    -- source once the row simply stays open across years.
    lmb_last_activity_on  date,
    -- Earliest open lot, so the till can say "480 points expire in 9 days"
    -- without a scan of the ledger.
    lmb_next_expiry_on    date,

    -- NOTE: there is deliberately NO stored "redeemable points" column. With a
    -- cooling period, redeemable is not the same number as balance — but it is
    -- date-dependent, and a cached copy would go stale at midnight with nobody
    -- writing to it. LoyaltyLedgerService.redeemable() answers it instead.

    -- ── Status ───────────────────────────────────────────────────────────
    -- MERGED: two wallets that turn out to be one person. The loser is marked
    -- MERGED and its points move by a PAIR of ADJUST ledger rows — never by
    -- editing a balance, which would leave the trail with a hole in it.
    lmb_status            character varying(20) NOT NULL DEFAULT 'ACTIVE',
    lmb_merged_into_id    uuid,
    lmb_block_reason      character varying(250),

    lmb_remarks           character varying(250),
    lmb_is_active         boolean NOT NULL DEFAULT true,
    lmb_is_deleted        boolean NOT NULL DEFAULT false,

    -- ── Audit ────────────────────────────────────────────────────────────
    lmb_sync_date         timestamp(6) with time zone,
    lmb_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    lmb_created_by        character varying(50),
    lmb_modified_on       timestamp(6) with time zone,
    lmb_modified_by       character varying(50),

    CONSTRAINT pk_loyalty_member PRIMARY KEY (lmb_id),

    CONSTRAINT fk_lmb_company FOREIGN KEY (lmb_comp_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lmb_branch FOREIGN KEY (lmb_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lmb_cust FOREIGN KEY (lmb_cust_id)
        REFERENCES sales.customers (cus_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lmb_party_ledger FOREIGN KEY (lmb_party_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lmb_scheme FOREIGN KEY (lmb_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lmb_merged_into FOREIGN KEY (lmb_merged_into_id)
        REFERENCES sales.loyalty_member (lmb_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lmb_acc_year CHECK (
        lmb_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(lmb_acc_year, 4)::int = LEFT(lmb_acc_year, 4)::int + 1),
    CONSTRAINT ck_lmb_status CHECK (
        lmb_status::text = ANY (ARRAY[
            'ACTIVE'::text, 'SUSPENDED'::text, 'CLOSED'::text, 'MERGED'::text])),
    CONSTRAINT ck_lmb_merged CHECK (
        (lmb_status::text = 'MERGED') = (lmb_merged_into_id IS NOT NULL)),
    CONSTRAINT ck_lmb_no_self_merge CHECK (
        lmb_merged_into_id IS NULL OR lmb_merged_into_id <> lmb_id),
    CONSTRAINT ck_lmb_card_shape CHECK (
        lmb_card_no IS NULL OR length(btrim(lmb_card_no)) > 0)
    -- NO non-negativity guard on the buckets, and none on the balance.
    -- Every one of these is an aggregate over a ledger that arrives in
    -- pieces: under offline sync a reversal can land before the row it
    -- reverses, and the bucket is transiently negative through no fault of
    -- anyone's. A CHECK here would abort the sync batch. The over-draw guard
    -- is LoyaltyLedgerService's, at post, where the true wallet is visible;
    -- what survives here is the RECORD of it — lmb_balance_points is allowed
    -- to go negative and ix_lmb_overdrawn finds every wallet that did.
);

ALTER TABLE IF EXISTS sales.loyalty_member OWNER to postgres;


-- ───────────────────────────────────────────────────────────────────────────
--  Wallet indexes
-- ───────────────────────────────────────────────────────────────────────────

-- ONE wallet per customer per company. This is the chain-store guarantee
-- expressed as a constraint, and it is the index the customer-detail endpoint
-- rides to fill cust_points.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lmb_cust
    ON sales.loyalty_member USING btree (lmb_comp_id, lmb_cust_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lmb_card_no
    ON sales.loyalty_member USING btree (lmb_comp_id, upper(lmb_card_no::text))
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_card_no IS NOT NULL AND lmb_is_deleted = false;

-- The supermarket lookup: a cashier types a phone number and the balance has
-- to be on screen before the next item is scanned. INCLUDE makes it index-only.
CREATE INDEX IF NOT EXISTS ix_lmb_mobile
    ON sales.loyalty_member USING btree (lmb_comp_id, lmb_mobile)
    INCLUDE (lmb_cust_id, lmb_balance_points, lmb_status)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_mobile IS NOT NULL AND lmb_is_deleted = false;

-- The liability report and the top-members list. Heap never touched.
CREATE INDEX IF NOT EXISTS ix_lmb_balance
    ON sales.loyalty_member USING btree (lmb_comp_id, lmb_balance_points DESC)
    INCLUDE (lmb_cust_id, lmb_card_no, lmb_next_expiry_on, lmb_last_activity_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_is_deleted = false AND lmb_balance_points <> 0;

CREATE INDEX IF NOT EXISTS ix_lmb_expiry
    ON sales.loyalty_member USING btree (lmb_comp_id, lmb_next_expiry_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_is_deleted = false AND lmb_balance_points > 0
      AND lmb_next_expiry_on IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_lmb_branch
    ON sales.loyalty_member USING btree (lmb_branch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_branch_id IS NOT NULL AND lmb_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lmb_scheme
    ON sales.loyalty_member USING btree (lmb_lsc_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_lsc_id IS NOT NULL AND lmb_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lmb_party_ledger
    ON sales.loyalty_member USING btree (lmb_party_ledger_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lmb_party_ledger_id IS NOT NULL AND lmb_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  The movement.
--
--  One row per point event against one wallet, drawn from one lot. Partitioned
--  by the year the EVENT happened, not the year the points were earned — that
--  is the whole trick: April's earn row never moves when July spends it.
--
--  A row is never edited and never deleted. Everything is undone by a new row
--  of opposite sign naming the row it undoes.
--
--  EARN rows ARE the lots. They carry lld_expires_on, lld_active_from and
--  lld_consumed_points; lld_lot_balance is what is left. Consuming rows
--  (REDEEM / GIFT / EXPIRE) carry lld_lot_id pointing back at the lot they
--  came out of.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_ledger
(
    lld_id                uuid           NOT NULL DEFAULT uuidv7(),
    lld_comp_id           uuid           NOT NULL,
    -- WHERE THE EVENT HAPPENED. Points earned at one branch and spent at
    -- another are the normal case for a chain; this column is what makes
    -- "who gave them, who honoured them" answerable, and it is the whole
    -- basis of inter-branch settlement between franchisees.
    lld_branch_id         uuid           NOT NULL,
    lld_tenant_id         uuid,
    lld_acc_year          character(9)   NOT NULL,   -- FY of the EVENT

    -- ── Whose points ─────────────────────────────────────────────────────
    -- Single-column FK: loyalty_member is not partitioned, which is precisely
    -- what makes earning in one year and spending in another a plain foreign
    -- key instead of a composite one that has to carry a year around.
    lld_member_id         uuid           NOT NULL,
    lld_cust_id           uuid           NOT NULL,   -- snapshot; every report groups by it

    -- ── Which rule produced this ─────────────────────────────────────────
    -- The "why did I get 37 points" answer, without re-running the engine
    -- against a scheme that may since have been edited.
    lld_lsc_id            uuid,                      -- the scheme
    lld_lss_id            uuid,                      -- the earn slab that fired
    lld_lsi_id            uuid,                      -- the item/group/brand rule that fired

    -- ── The event ────────────────────────────────────────────────────────
    lld_txn_type          character varying(20) NOT NULL,
    lld_row_no            integer        NOT NULL DEFAULT 1,
    -- SIGNED. EARN/OPENING positive, REDEEM/GIFT/EXPIRE negative,
    -- ADJUST/TRANSFER either. A reversal repeats the type with the opposite
    -- sign; nothing here is ever edited or deleted.
    lld_points            numeric(18,4)  NOT NULL,
    lld_txn_date          date           NOT NULL,
    -- Which side of a happy-hour boundary the till was on. Without it, a
    -- double-points window is unauditable the morning after.
    lld_txn_time          time without time zone,

    -- ── FIFO lot ─────────────────────────────────────────────────────────
    -- On a consuming row: the EARN row these points came out of.
    lld_lot_id            uuid,
    lld_lot_acc_year      character(9),
    -- On the LOT row only: how much of it has been spent, expired or moved
    -- away. Recomputed by LoyaltyLedgerService.recomputeLots(); never written
    -- by any other application code.
    lld_consumed_points   numeric(18,4)  NOT NULL DEFAULT 0,
    -- GENERATED, so the service writes lld_consumed_points and Postgres does
    -- the subtraction. Zero — not NULL — on a consuming row, which is what
    -- keeps the "> 0" index predicates below cheap and total.
    lld_lot_balance       numeric(18,4)
        GENERATED ALWAYS AS (
            CASE WHEN lld_points > 0 THEN lld_points - lld_consumed_points
                 ELSE 0 END) STORED,
    -- When this lot lapses. Set from lsc_points_valid_days / lsc_expiry_basis
    -- at earn time. NULL = never expires.
    lld_expires_on        date,
    -- When this lot becomes REDEEMABLE: bill date + lsc_activation_days. Before
    -- it, the points exist and show in the balance but cannot be spent — the
    -- return-window defence. NULL = redeemable at once.
    lld_active_from       date,

    -- ── Source document ──────────────────────────────────────────────────
    -- The same four-part polymorphic identifier acc_tender_detail,
    -- acc_bill_balance and txn_status_log use.
    lld_src_module        character varying(20),
    lld_src_doc_type      character varying(30),
    lld_src_doc_id        uuid,                      -- no FK: polymorphic by design
    lld_src_acc_year      character(9),              -- the SOURCE's FY, not this row's
    -- Snapshot, so a member statement prints the bill number without joining a
    -- partitioned table across every year the customer has traded.
    lld_src_doc_refno     character varying(100),
    lld_src_row_no        integer,                   -- the bill line, when earn is per item

    -- ── How it was computed ──────────────────────────────────────────────
    lld_base_amount       numeric(18,2)  NOT NULL DEFAULT 0,   -- value the points came off
    lld_base_qty          numeric(18,3)  NOT NULL DEFAULT 0,
    lld_rate              numeric(18,4)  NOT NULL DEFAULT 0,   -- points per slab, or INR per point
    lld_factor            numeric(18,4)  NOT NULL DEFAULT 1,
    lld_money_value       numeric(18,2)  NOT NULL DEFAULT 0,   -- what they were worth, in INR

    -- ── The tender ───────────────────────────────────────────────────────
    -- Redemption is a TENDER LINE: accounts.acc_tender_detail with
    -- td_tender_type_id = 10, td_units_used = the points, td_conversion_rate =
    -- rupees per point. This pair is what ties the two sides together, and it
    -- travels as (id, acc_year) because the tender table is partitioned.
    lld_tender_id         uuid,
    lld_tender_acc_year   character(9),

    -- ── Reversal ─────────────────────────────────────────────────────────
    -- Carries a real FK, unlike abj_reversal_of_id, because this table has the
    -- year to complete the composite key with.
    lld_reversal_of_id       uuid,
    lld_reversal_of_acc_year character(9),
    lld_reversal_reason      character varying(250),

    -- ── Who ──────────────────────────────────────────────────────────────
    -- A manual adjustment is somebody's decision, not a keying accident.
    lld_approved_by       uuid,
    lld_user_id           uuid,
    lld_session_id        uuid,
    lld_device_id         uuid,

    lld_remarks           character varying(250),
    lld_is_deleted        boolean NOT NULL DEFAULT false,

    -- ── Audit ────────────────────────────────────────────────────────────
    lld_sync_date         timestamp(6) with time zone,
    lld_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    lld_created_by        character varying(50),
    lld_modified_on       timestamp(6) with time zone,
    lld_modified_by       character varying(50),

    CONSTRAINT pk_loyalty_ledger PRIMARY KEY (lld_id, lld_acc_year),

    CONSTRAINT fk_lld_member FOREIGN KEY (lld_member_id)
        REFERENCES sales.loyalty_member (lmb_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_cust FOREIGN KEY (lld_cust_id)
        REFERENCES sales.customers (cus_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_scheme FOREIGN KEY (lld_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_slab FOREIGN KEY (lld_lss_id)
        REFERENCES sales.loyalty_scheme_slab (lss_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_item_rule FOREIGN KEY (lld_lsi_id)
        REFERENCES sales.loyalty_scheme_item (lsi_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_user FOREIGN KEY (lld_user_id)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_approved_by FOREIGN KEY (lld_approved_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_device FOREIGN KEY (lld_device_id)
        REFERENCES fixed.device_master (dev_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_company FOREIGN KEY (lld_comp_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_branch FOREIGN KEY (lld_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_lot FOREIGN KEY (lld_lot_id, lld_lot_acc_year)
        REFERENCES sales.loyalty_ledger (lld_id, lld_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_tender FOREIGN KEY (lld_tender_id, lld_tender_acc_year)
        REFERENCES accounts.acc_tender_detail (td_id, td_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lld_reversal FOREIGN KEY (lld_reversal_of_id, lld_reversal_of_acc_year)
        REFERENCES sales.loyalty_ledger (lld_id, lld_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lld_acc_year CHECK (
        lld_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(lld_acc_year, 4)::int = LEFT(lld_acc_year, 4)::int + 1),
    CONSTRAINT ck_lld_src_acc_year CHECK (
        lld_src_acc_year IS NULL OR lld_src_acc_year ~ '^[0-9]{4}-[0-9]{4}$'),

    CONSTRAINT ck_lld_txn_type CHECK (
        lld_txn_type::text = ANY (ARRAY[
            'EARN'::text, 'REDEEM'::text, 'GIFT'::text, 'EXPIRE'::text,
            'ADJUST'::text, 'TRANSFER'::text, 'OPENING'::text])),
    CONSTRAINT ck_lld_src_module CHECK (
        lld_src_module IS NULL OR lld_src_module::text = ANY (ARRAY[
            'SALES'::text, 'ACCOUNTS'::text, 'POS'::text,
            'SERVICE'::text, 'OTHER'::text])),
    -- 'OTHER' is a member on purpose: a new document type should cost one
    -- CHECK value, and usually none.
    CONSTRAINT ck_lld_src_doc_type CHECK (
        lld_src_doc_type IS NULL OR lld_src_doc_type::text = ANY (ARRAY[
            'SALE_BILL'::text, 'SALE_RETURN'::text, 'SALES_ORDER'::text,
            'RECEIPT'::text, 'LOYALTY_ADJUST'::text, 'GIFT_REDEEM'::text,
            'EXPIRY_RUN'::text, 'OTHER'::text])),
    -- All three of module / type / id, or none of them.
    CONSTRAINT ck_lld_src_doc CHECK (
        (lld_src_module IS NULL AND lld_src_doc_type IS NULL AND lld_src_doc_id IS NULL)
        OR (lld_src_module IS NOT NULL AND lld_src_doc_type IS NOT NULL
            AND lld_src_doc_id IS NOT NULL)),

    -- A movement of zero is not an event.
    CONSTRAINT ck_lld_points_nonzero CHECK (lld_points <> 0),

    -- An EARN is positive unless it is a reversal, and a REDEEM is negative
    -- unless it is a reversal. ADJUST and TRANSFER go either way by nature.
    CONSTRAINT ck_lld_sign CHECK (
        (lld_txn_type::text = ANY (ARRAY['EARN'::text, 'OPENING'::text])
             AND (lld_reversal_of_id IS NULL) = (lld_points > 0))
        OR (lld_txn_type::text = ANY (ARRAY['REDEEM'::text, 'GIFT'::text, 'EXPIRE'::text])
             AND (lld_reversal_of_id IS NULL) = (lld_points < 0))
        OR  lld_txn_type::text = ANY (ARRAY['ADJUST'::text, 'TRANSFER'::text])),

    CONSTRAINT ck_lld_lot_pair CHECK (
        (lld_lot_id IS NULL) = (lld_lot_acc_year IS NULL)),
    -- A consuming row names its lot; nothing else may name one.
    CONSTRAINT ck_lld_lot_required CHECK (
        CASE WHEN lld_txn_type::text = ANY (ARRAY['REDEEM'::text, 'GIFT'::text, 'EXPIRE'::text])
             THEN lld_lot_id IS NOT NULL OR lld_reversal_of_id IS NOT NULL
             WHEN lld_txn_type::text = 'TRANSFER' THEN true
             ELSE lld_lot_id IS NULL END),
    CONSTRAINT ck_lld_no_self_lot CHECK (
        lld_lot_id IS NULL OR lld_lot_id <> lld_id),

    -- No per-lot over-draw guard either, and for the same reason: two tills
    -- offline can each draw the last of one lot, and the batch that syncs
    -- second must be recorded, not refused. lld_lot_balance goes negative and
    -- ix_lld_lot_overdrawn finds it.

    -- Only a lot expires or matures, and it cannot lapse before it exists.
    CONSTRAINT ck_lld_lot_dates CHECK (
        (lld_expires_on  IS NULL OR lld_points > 0)
        AND (lld_active_from IS NULL OR lld_points > 0)
        AND (lld_expires_on IS NULL OR lld_expires_on >= lld_txn_date)),

    CONSTRAINT ck_lld_tender_pair CHECK (
        (lld_tender_id IS NULL) = (lld_tender_acc_year IS NULL)),
    CONSTRAINT ck_lld_reversal_pair CHECK (
        (lld_reversal_of_id IS NULL) = (lld_reversal_of_acc_year IS NULL)),
    CONSTRAINT ck_lld_no_self_reversal CHECK (
        lld_reversal_of_id IS NULL OR lld_reversal_of_id <> lld_id),

    -- A redemption names the tender the money went out on; a reversal need
    -- not. GIFT is excluded deliberately — a gift is stock, not money, and has
    -- no tender at all.
    CONSTRAINT ck_lld_redeem_tender CHECK (
        lld_txn_type::text <> 'REDEEM'
        OR lld_tender_id IS NOT NULL
        OR lld_reversal_of_id IS NOT NULL),
    CONSTRAINT ck_lld_gift_no_tender CHECK (
        lld_txn_type::text <> 'GIFT' OR lld_tender_id IS NULL),

    -- Somebody signs for a manual adjustment.
    CONSTRAINT ck_lld_adjust_approval CHECK (
        lld_txn_type::text <> 'ADJUST' OR lld_approved_by IS NOT NULL),

    CONSTRAINT ck_lld_row_no CHECK (lld_row_no >= 1),
    CONSTRAINT ck_lld_factor CHECK (lld_factor > 0)
) PARTITION BY LIST (lld_acc_year);

ALTER TABLE IF EXISTS sales.loyalty_ledger OWNER to postgres;


-- ───────────────────────────────────────────────────────────────────────────
--  Ledger indexes
-- ───────────────────────────────────────────────────────────────────────────

-- The member statement, and the drill-down under every balance shown.
CREATE INDEX IF NOT EXISTS ix_lld_member
    ON sales.loyalty_ledger USING btree (lld_member_id, lld_txn_date)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_is_deleted = false;

-- THE IDEMPOTENCY GUARD, and the most important index in this migration.
-- Points earn on bill save at a counter that may be offline; that bill will be
-- re-sent, and possibly re-sent twice. Without this, every replay mints points
-- again and nothing downstream notices until a customer redeems money the shop
-- never owed them.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lld_src_row
    ON sales.loyalty_ledger USING btree
    (lld_src_doc_type, lld_src_doc_id, lld_acc_year, lld_txn_type, lld_row_no)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_src_doc_id IS NOT NULL AND lld_is_deleted = false;

-- THE FIFO INDEX. Both the redeem path and the expiry run live on it, and
-- INCLUDE keeps them off the heap: a till walking a member's lots must not
-- pay for random I/O per lot.
CREATE INDEX IF NOT EXISTS ix_lld_open_lots
    ON sales.loyalty_ledger USING btree
    (lld_member_id, lld_expires_on, lld_txn_date, lld_id)
    INCLUDE (lld_points, lld_consumed_points, lld_active_from, lld_lot_balance)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_is_deleted = false AND lld_lot_balance > 0;

-- The nightly expiry run, and the "expiring this month" notice.
CREATE INDEX IF NOT EXISTS ix_lld_expiry
    ON sales.loyalty_ledger USING btree (lld_comp_id, lld_expires_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_expires_on IS NOT NULL AND lld_is_deleted = false
      AND lld_lot_balance > 0;

-- The lot recompute's own path: every row naming one lot.
CREATE INDEX IF NOT EXISTS ix_lld_lot
    ON sales.loyalty_ledger USING btree (lld_lot_id, lld_lot_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_lot_id IS NOT NULL AND lld_is_deleted = false;

-- INTER-BRANCH SETTLEMENT: points issued by branch A, honoured by branch B.
-- For a franchise chain this report is the reason lld_branch_id exists.
CREATE INDEX IF NOT EXISTS ix_lld_branch_period
    ON sales.loyalty_ledger USING btree
    (lld_comp_id, lld_branch_id, lld_txn_date, lld_txn_type)
    INCLUDE (lld_points, lld_money_value)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_is_deleted = false;

-- Bill -> the points it earned. The sale return's claw-back path.
CREATE INDEX IF NOT EXISTS ix_lld_src_doc
    ON sales.loyalty_ledger USING btree (lld_src_doc_type, lld_src_doc_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_src_doc_id IS NOT NULL AND lld_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lld_tender
    ON sales.loyalty_ledger USING btree (lld_tender_id, lld_tender_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_tender_id IS NOT NULL AND lld_is_deleted = false;

-- FK-covering indexes. Every foreign key gets one, so that re-keying or
-- deleting a master never sequentially scans this table.
CREATE INDEX IF NOT EXISTS ix_lld_scheme ON sales.loyalty_ledger USING btree (lld_lsc_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_lsc_id IS NOT NULL AND lld_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lld_slab ON sales.loyalty_ledger USING btree (lld_lss_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_lss_id IS NOT NULL AND lld_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lld_item_rule ON sales.loyalty_ledger USING btree (lld_lsi_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_lsi_id IS NOT NULL AND lld_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lld_cust ON sales.loyalty_ledger USING btree (lld_cust_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lld_user ON sales.loyalty_ledger USING btree (lld_user_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_user_id IS NOT NULL AND lld_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lld_device ON sales.loyalty_ledger USING btree (lld_device_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_device_id IS NOT NULL AND lld_is_deleted = false;

-- A row may be reversed once. CAVEAT, identical to ux_abj_reversal: a unique
-- index on a partitioned table must include the partition key, so this is
-- unique per YEAR — a reversal in March and another in April of the same row
-- would both be accepted. Reversing across a year boundary is rare enough to
-- leave to the posting code, which must check before it writes.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lld_reversal
    ON sales.loyalty_ledger USING btree (lld_reversal_of_id, lld_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_reversal_of_id IS NOT NULL AND lld_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  The gift redemption — A DOCUMENT IN ITS OWN RIGHT.
--
--  A customer walks up with points and walks away with goods and a printed
--  slip. No money crosses the counter, so this cannot live in
--  accounts.acc_tender_detail. And it is not a line on a sale bill either: it
--  has its own number series, its own status, its own print count, and
--  frequently no bill at all.
--
--  Shape follows sale_bill: a partitioned header with an offline-safe number
--  pair (a per-device serial plus the printed refno that embeds it), and a
--  partitioned detail carrying the stock movement.
--
--  The points side is NOT stored here. loyalty_ledger holds the GIFT rows —
--  one per lot consumed, named by lld_src_doc_id — and the wallet balance
--  follows from them. lgr_opening_points / _redeem_points / _closing_points
--  are SNAPSHOTS for the printed slip; the ledger remains the authority.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_gift_redeem
(
    lgr_id                uuid           NOT NULL DEFAULT uuidv7(),
    lgr_comp_id           uuid           NOT NULL,
    lgr_branch_id         uuid           NOT NULL,
    lgr_tenant_id         uuid,
    lgr_acc_year          character(9)   NOT NULL,

    -- ── Document identity ────────────────────────────────────────────────
    -- Offline-safe, the sale_bill pattern: the DEVICE owns the series, so a
    -- till with no network can still number a slip. The serial is raw; the
    -- refno is what gets printed and embeds the counter series.
    lgr_device_id         uuid,
    lgr_redeem_slno       bigint         NOT NULL,
    lgr_redeem_refno      character varying(100) NOT NULL,
    lgr_redeem_date       date           NOT NULL,
    lgr_redeem_time       time without time zone,

    -- ── Who ──────────────────────────────────────────────────────────────
    lgr_member_id         uuid           NOT NULL,
    lgr_cust_id           uuid           NOT NULL,
    lgr_lsc_id            uuid,                      -- scheme it was claimed under
    lgr_user_id           uuid,                      -- the login that saved it
    lgr_emp_id            uuid,                      -- the person who served, if different

    -- ── Points, as printed on the slip ───────────────────────────────────
    lgr_opening_points    numeric(18,4)  NOT NULL DEFAULT 0,
    lgr_redeem_points     numeric(18,4)  NOT NULL DEFAULT 0,
    lgr_closing_points    numeric(18,4)  NOT NULL DEFAULT 0,

    -- ── What it cost the shop ────────────────────────────────────────────
    lgr_total_qty         numeric(18,3)  NOT NULL DEFAULT 0,
    lgr_total_value       numeric(18,2)  NOT NULL DEFAULT 0,   -- at MRP / issue rate
    lgr_total_cost        numeric(18,2)  NOT NULL DEFAULT 0,   -- at cost, for the giveaway P&L

    -- ── Authorisation ────────────────────────────────────────────────────
    -- Points are bearer value, and a counter that can redeem them
    -- unchallenged is a fraud route.
    lgr_otp_no            character varying(10),
    lgr_approved_by       uuid,
    lgr_status            character varying(20) NOT NULL DEFAULT 'DRAFT',
    lgr_print_count       integer        NOT NULL DEFAULT 0,

    -- ── Accounting / Tally ───────────────────────────────────────────────
    -- The voucher this slip posted to, once the server has posted it.
    --
    -- NO FOREIGN KEY, deliberately, and for the same reason
    -- sale_bill.sb_posted_voucher_id has none: this is a counter document
    -- created OFFLINE, so the row exists long before the voucher does. An FK
    -- would make the counter's insert depend on a server-side write it cannot
    -- see. The accounts-side documents (acc_bill_balance, acc_pdc_register) DO
    -- carry the FK, because they are only ever written server-side after
    -- posting — a different lifecycle, a different rule.
    --
    -- The accounting year travels with the id so the lookup hits one partition
    -- instead of scanning them all; the pair is nullable together.
    lgr_posted_voucher_id    uuid,
    lgr_voucher_acc_year     character(9),

    lgr_reversal_of_id       uuid,
    lgr_reversal_of_acc_year character(9),
    lgr_reversal_reason      character varying(250),

    lgr_remarks           character varying(500),
    lgr_is_deleted        boolean NOT NULL DEFAULT false,
    lgr_sync_date         timestamp with time zone,
    lgr_created_on        timestamp with time zone NOT NULL DEFAULT now(),
    lgr_created_by        character varying(50),
    lgr_modified_on       timestamp with time zone,
    lgr_modified_by       character varying(50),

    CONSTRAINT pk_loyalty_gift_redeem PRIMARY KEY (lgr_id, lgr_acc_year),

    CONSTRAINT fk_lgr_company FOREIGN KEY (lgr_comp_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_branch FOREIGN KEY (lgr_branch_id)
        REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_device FOREIGN KEY (lgr_device_id)
        REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_member FOREIGN KEY (lgr_member_id)
        REFERENCES sales.loyalty_member (lmb_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_cust FOREIGN KEY (lgr_cust_id)
        REFERENCES sales.customers (cus_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_scheme FOREIGN KEY (lgr_lsc_id)
        REFERENCES sales.loyalty_scheme (lsc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_user FOREIGN KEY (lgr_user_id)
        REFERENCES public.user_master (usr_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_emp FOREIGN KEY (lgr_emp_id)
        REFERENCES public.employee_master (emp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_approved_by FOREIGN KEY (lgr_approved_by)
        REFERENCES public.user_master (usr_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgr_reversal FOREIGN KEY (lgr_reversal_of_id, lgr_reversal_of_acc_year)
        REFERENCES sales.loyalty_gift_redeem (lgr_id, lgr_acc_year)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lgr_acc_year CHECK (
        lgr_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(lgr_acc_year, 4)::int = LEFT(lgr_acc_year, 4)::int + 1),
    CONSTRAINT ck_lgr_status CHECK (
        lgr_status::text = ANY (ARRAY['DRAFT'::text, 'CONFIRMED'::text, 'CANCELLED'::text])),
    CONSTRAINT ck_lgr_slno CHECK (lgr_redeem_slno > 0),
    CONSTRAINT ck_lgr_refno CHECK (length(btrim(lgr_redeem_refno)) > 0),
    CONSTRAINT ck_lgr_points CHECK (
        lgr_opening_points >= 0 AND lgr_redeem_points >= 0 AND lgr_closing_points >= 0),
    CONSTRAINT ck_lgr_totals CHECK (
        lgr_total_qty >= 0 AND lgr_total_value >= 0 AND lgr_total_cost >= 0),
    CONSTRAINT ck_lgr_print_count CHECK (lgr_print_count >= 0),
    CONSTRAINT ck_lgr_voucher_pair CHECK (
        (lgr_posted_voucher_id IS NULL) = (lgr_voucher_acc_year IS NULL)),
    CONSTRAINT ck_lgr_voucher_acc_year CHECK (
        lgr_voucher_acc_year IS NULL
        OR lgr_voucher_acc_year ~ '^[0-9]{4}-[0-9]{4}$'),
    -- A confirmed slip is what the server posts; a draft has nothing to post
    -- yet, and a cancelled one must never carry a live voucher.
    CONSTRAINT ck_lgr_voucher_status CHECK (
        lgr_posted_voucher_id IS NULL OR lgr_status::text = 'CONFIRMED'),
    CONSTRAINT ck_lgr_reversal_pair CHECK (
        (lgr_reversal_of_id IS NULL) = (lgr_reversal_of_acc_year IS NULL)),
    CONSTRAINT ck_lgr_no_self_reversal CHECK (
        lgr_reversal_of_id IS NULL OR lgr_reversal_of_id <> lgr_id),
    -- A cancelled slip must say who authorised the cancellation.
    CONSTRAINT ck_lgr_cancel CHECK (
        lgr_status::text <> 'CANCELLED' OR lgr_approved_by IS NOT NULL)
) PARTITION BY LIST (lgr_acc_year);

ALTER TABLE IF EXISTS sales.loyalty_gift_redeem OWNER to postgres;

-- The printed number is unique per branch and year; the raw serial is unique
-- per DEVICE, which is what lets an offline till number without asking.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lgr_refno
    ON sales.loyalty_gift_redeem USING btree
    (lgr_comp_id, lgr_branch_id, lgr_acc_year, lgr_redeem_refno)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_lgr_slno
    ON sales.loyalty_gift_redeem USING btree
    (lgr_comp_id, lgr_branch_id, lgr_acc_year, lgr_device_id, lgr_redeem_slno)
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lgr_list
    ON sales.loyalty_gift_redeem USING btree (lgr_comp_id, lgr_branch_id, lgr_redeem_date)
    INCLUDE (lgr_redeem_refno, lgr_cust_id, lgr_redeem_points, lgr_status)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgr_member
    ON sales.loyalty_gift_redeem USING btree (lgr_member_id, lgr_redeem_date)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgr_cust ON sales.loyalty_gift_redeem USING btree (lgr_cust_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgr_branch ON sales.loyalty_gift_redeem USING btree (lgr_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgr_scheme ON sales.loyalty_gift_redeem USING btree (lgr_lsc_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_lsc_id IS NOT NULL AND lgr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgr_device ON sales.loyalty_gift_redeem USING btree (lgr_device_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lgr_user ON sales.loyalty_gift_redeem USING btree (lgr_user_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lgr_emp ON sales.loyalty_gift_redeem USING btree (lgr_emp_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_emp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lgr_approved_by ON sales.loyalty_gift_redeem USING btree (lgr_approved_by)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_approved_by IS NOT NULL;
-- The posting queue: confirmed slips the server has not yet turned into a
-- voucher. Partial, so it stays small however long the table grows.
CREATE INDEX IF NOT EXISTS ix_lgr_unposted
    ON sales.loyalty_gift_redeem USING btree (lgr_comp_id, lgr_redeem_date)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lgr_posted_voucher_id IS NULL AND lgr_status::text = 'CONFIRMED'
      AND lgr_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgr_voucher
    ON sales.loyalty_gift_redeem USING btree (lgr_posted_voucher_id, lgr_voucher_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lgr_posted_voucher_id IS NOT NULL AND lgr_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lgr_reversal
    ON sales.loyalty_gift_redeem USING btree (lgr_reversal_of_id, lgr_reversal_of_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgr_reversal_of_id IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
--  The goods that went out.
--
--  ONE detail table, not two. The legacy pair (loy_item_rdm_items and
--  loy_item_rdm_itm_det) held identical column sets against the same header;
--  only one was live, so only one is rebuilt here.
--
--  Carries the full stock movement — godown, batch, serial, expiry — because
--  a gift relieves inventory exactly as a sale does, and a batch-tracked shop
--  cannot post the issue without them. Cost is snapshotted alongside the issue
--  rate so the giveaway can be valued afterwards without re-pricing history.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_gift_redeem_item
(
    lgd_id                uuid           NOT NULL DEFAULT uuidv7(),
    lgd_comp_id           uuid           NOT NULL,
    lgd_branch_id         uuid           NOT NULL,
    lgd_tenant_id         uuid,
    lgd_acc_year          character(9)   NOT NULL,

    lgd_lgr_id            uuid           NOT NULL,
    lgd_lgr_acc_year      character(9)   NOT NULL,
    lgd_row_no            integer        NOT NULL DEFAULT 1,

    lgd_lsg_id            uuid,                      -- catalogue row claimed
    lgd_item_id           uuid           NOT NULL,
    lgd_unit_id           uuid           NOT NULL,   -- item_unit_conversion, as on a bill line
    lgd_godown_id         uuid,
    lgd_barcode           character varying(30),

    -- Batch / serial. The id is the link; the rest are snapshots so a reprint
    -- of last year's slip does not depend on the batch row still existing.
    lgd_batch_id          uuid,
    lgd_batch_no          character varying(50),
    lgd_serial_no         character varying(50),
    lgd_batch_date        date,
    lgd_expiry_date       date,

    -- No DEFAULT on lgd_qty: ck_lgd_qty demands it be positive, so a row that
    -- omits it must fail rather than silently issue nothing.
    lgd_qty               numeric(18,3)  NOT NULL,
    lgd_stock_qty         numeric(18,3)  NOT NULL DEFAULT 0,   -- on hand at the moment of issue
    lgd_rate              numeric(18,4)  NOT NULL DEFAULT 0,   -- issue rate
    lgd_total             numeric(18,2)  NOT NULL DEFAULT 0,
    lgd_points            numeric(18,4)  NOT NULL DEFAULT 0,   -- points this line cost
    lgd_max_price         numeric(18,4)  NOT NULL DEFAULT 0,   -- MRP
    lgd_cost_price        numeric(18,4)  NOT NULL DEFAULT 0,
    lgd_cost_wot          numeric(18,4)  NOT NULL DEFAULT 0,   -- cost excluding tax

    lgd_notes             character varying(250),
    lgd_is_deleted        boolean NOT NULL DEFAULT false,
    lgd_sync_date         timestamp with time zone,
    lgd_created_on        timestamp with time zone NOT NULL DEFAULT now(),
    lgd_created_by        character varying(50),
    lgd_modified_on       timestamp with time zone,
    lgd_modified_by       character varying(50),

    CONSTRAINT pk_loyalty_gift_redeem_item PRIMARY KEY (lgd_id, lgd_acc_year),

    CONSTRAINT fk_lgd_header FOREIGN KEY (lgd_lgr_id, lgd_lgr_acc_year)
        REFERENCES sales.loyalty_gift_redeem (lgr_id, lgr_acc_year)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_lgd_company FOREIGN KEY (lgd_comp_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgd_branch FOREIGN KEY (lgd_branch_id)
        REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgd_gift FOREIGN KEY (lgd_lsg_id)
        REFERENCES sales.loyalty_scheme_gift (lsg_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgd_item FOREIGN KEY (lgd_item_id)
        REFERENCES inventory.item_master (item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgd_unit FOREIGN KEY (lgd_unit_id)
        REFERENCES inventory.item_unit_conversion (iuc_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgd_godown FOREIGN KEY (lgd_godown_id)
        REFERENCES inventory.godown_locations (gdl_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lgd_batch FOREIGN KEY (lgd_batch_id)
        REFERENCES inventory.item_batch_master (btm_id) ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lgd_acc_year CHECK (
        lgd_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(lgd_acc_year, 4)::int = LEFT(lgd_acc_year, 4)::int + 1),
    -- A line lives in the same year as its header: the composite FK requires
    -- it, and stating it makes the intent readable.
    CONSTRAINT ck_lgd_same_year CHECK (lgd_acc_year = lgd_lgr_acc_year),
    CONSTRAINT ck_lgd_row_no CHECK (lgd_row_no >= 1),
    CONSTRAINT ck_lgd_qty CHECK (lgd_qty > 0),
    CONSTRAINT ck_lgd_amounts CHECK (
        lgd_rate >= 0 AND lgd_total >= 0 AND lgd_points >= 0
        AND lgd_max_price >= 0 AND lgd_cost_price >= 0 AND lgd_cost_wot >= 0),
    CONSTRAINT ck_lgd_batch_dates CHECK (
        lgd_expiry_date IS NULL OR lgd_batch_date IS NULL
        OR lgd_expiry_date >= lgd_batch_date)
) PARTITION BY LIST (lgd_acc_year);

ALTER TABLE IF EXISTS sales.loyalty_gift_redeem_item OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lgd_row
    ON sales.loyalty_gift_redeem_item USING btree (lgd_lgr_id, lgd_acc_year, lgd_row_no)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgd_header
    ON sales.loyalty_gift_redeem_item USING btree (lgd_lgr_id, lgd_lgr_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_is_deleted = false;
-- What the giveaway cost, by item and period.
CREATE INDEX IF NOT EXISTS ix_lgd_item_period
    ON sales.loyalty_gift_redeem_item USING btree (lgd_comp_id, lgd_item_id, lgd_acc_year)
    INCLUDE (lgd_qty, lgd_points, lgd_total, lgd_cost_price)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgd_branch ON sales.loyalty_gift_redeem_item USING btree (lgd_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgd_item ON sales.loyalty_gift_redeem_item USING btree (lgd_item_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgd_unit ON sales.loyalty_gift_redeem_item USING btree (lgd_unit_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgd_gift ON sales.loyalty_gift_redeem_item USING btree (lgd_lsg_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_lsg_id IS NOT NULL AND lgd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgd_godown ON sales.loyalty_gift_redeem_item USING btree (lgd_godown_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_godown_id IS NOT NULL AND lgd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lgd_batch ON sales.loyalty_gift_redeem_item USING btree (lgd_batch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lgd_batch_id IS NOT NULL AND lgd_is_deleted = false;


-- ── Reconciliation: what the dropped CHECKs used to refuse ────────────────
--
-- These are the report. A wallet or a lot that has been drawn past what it
-- holds is a real event under offline sync — two tills, one wallet — and it
-- has to be findable in O(index), every day, not discovered by a customer.
CREATE INDEX IF NOT EXISTS ix_lmb_overdrawn
    ON sales.loyalty_member USING btree (lmb_comp_id, lmb_balance_points)
    WHERE lmb_is_deleted = false AND lmb_balance_points < 0;

CREATE INDEX IF NOT EXISTS ix_lld_lot_overdrawn
    ON sales.loyalty_ledger USING btree (lld_comp_id, lld_member_id)
    WHERE lld_is_deleted = false AND lld_lot_balance < 0;


-- ───────────────────────────────────────────────────────────────────────────
--  Remaining FK-covering indexes.
--
--  Every foreign key above now has an index whose LEADING columns are the FK
--  columns. Without that, deleting or re-keying a master sequentially scans
--  the child table.
--
--  Note the reversal pairs: ux_lld_reversal is (reversal_of_id, ACC_YEAR) for
--  per-year uniqueness, which is a different column pair from the foreign key
--  (reversal_of_id, REVERSAL_OF_acc_year). It does not cover it.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_lmb_cust_fk ON sales.loyalty_member USING btree (lmb_cust_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lmb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lmb_merged_into ON sales.loyalty_member USING btree (lmb_merged_into_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lmb_merged_into_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_lld_branch ON sales.loyalty_ledger USING btree (lld_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lld_approved_by ON sales.loyalty_ledger USING btree (lld_approved_by)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lld_reversal_fk
    ON sales.loyalty_ledger USING btree (lld_reversal_of_id, lld_reversal_of_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lld_reversal_of_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  Amendments to sale_bill and sale_bill_item.
--
--  The client already computes points per line and then throws the number
--  away, because there has never been a column to put it in. These are those
--  columns.
--
--  Snapshots, not caches: a sale return must reverse WHAT THE BILL ACTUALLY
--  AWARDED, not what re-running today's scheme would award. Schemes get
--  edited; bills do not.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS sales.sale_bill
    ADD COLUMN IF NOT EXISTS sb_lsc_id                uuid,
    ADD COLUMN IF NOT EXISTS sb_loyalty_earn_points   numeric(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sb_loyalty_redeem_points numeric(18,4) NOT NULL DEFAULT 0;

-- NOTE: no sb_loyalty_gift_points, and sale_bill_item's free-type CHECK is NOT
-- touched. A gift redemption is its own document (loyalty_gift_redeem) with
-- its own number series and its own stock movement, so it never appears as a
-- free line on a bill and sale_bill has nothing to roll up for it.

ALTER TABLE IF EXISTS sales.sale_bill_item
    ADD COLUMN IF NOT EXISTS sbi_loyalty_pv      numeric(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sbi_loyalty_points  numeric(18,4) NOT NULL DEFAULT 0;

-- NOTHING is altered onto sales.sale_return here, deliberately — and the table
-- genuinely does not exist in this database yet, so `ALTER TABLE IF EXISTS`
-- would have been the silent no-op the design note warns about. Whichever
-- migration creates sale_return must declare sr_loyalty_reverse_points and
-- sri_loyalty_points in the CREATE TABLE itself, which is the only place that
-- cannot be skipped.
--
-- NOTE: sale_order gets nothing. An order neither earns nor redeems — points
-- are earned and spent on the bill.
--
-- NOTE: sale_bill_item's promotion-scheme columns are NOT touched. Those
-- belong to the PROMOTION scheme master, a separate feature; reusing them for
-- loyalty would weld the two together.

COMMENT ON COLUMN sales.sale_bill.sb_loyalty_earn_points IS
    'Points this bill awarded. Snapshot — the authority is loyalty_ledger; this is what the invoice printed.';
COMMENT ON COLUMN sales.sale_bill_item.sbi_loyalty_pv IS
    'Points per unit applied to this line. Snapshot of the rule that ran, so a later scheme edit cannot rewrite history.';


-- ═══════════════════════════════════════════════════════════════════════════
--  Settings.
--
--  ENABLEMENT AND UI ONLY. Every value the earning arithmetic depends on lives
--  on loyalty_scheme instead, and deliberately: a setting is mutable with no
--  history, while a scheme is versioned by its validity window. A balance has
--  to stay reproducible from the scheme that produced it, and it cannot be if
--  a setting could silently have changed the rate underneath it.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
     asd_label, asd_description, asd_sort_order, asd_needs_relogin,
     asd_created_by)
VALUES

('loyalty.enabled', 'SALES', 'Loyalty', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Loyalty programme', 'Master switch. Off means no points are earned, shown or redeemed anywhere.', 10, true, 'SYSTEM'),

('loyalty.auto_enrol', 'SALES', 'Loyalty', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Enrol automatically', 'Open a wallet the first time a customer with Allow Loyalty is billed, instead of enrolling them by hand.', 20, false, 'SYSTEM'),

('loyalty.identify_by', 'SALES', 'Loyalty', 'TEXT', 'mobile',
 '["mobile","card","both"]', NULL, NULL, 'BRANCH',
 'Identify member by', 'What the counter types or scans to find a member.', 30, false, 'SYSTEM'),

('loyalty.card_no_mandatory', 'SALES', 'Loyalty', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Membership number required', 'A wallet cannot be opened without a card number.', 40, false, 'SYSTEM'),

('loyalty.redeem_needs_approval', 'SALES', 'Loyalty', 'BOOL', 'false',
 NULL, NULL, NULL, 'BRANCH',
 'Supervisor approval to redeem', 'Redemption at this branch needs a supervisor before it will save.', 50, false, 'SYSTEM'),

('loyalty.expiry_notice_days', 'SALES', 'Loyalty', 'INT', '30',
 NULL, 0, 365, 'COMPANY',
 'Warn before points expire', 'How many days ahead the till and the statement flag points about to lapse.', 60, false, 'SYSTEM'),

('loyalty.statement_days', 'SALES', 'Loyalty', 'INT', '180',
 NULL, 1, 1825, 'COMPANY',
 'Statement window', 'How far back a member statement reaches by default.', 70, false, 'SYSTEM'),

('loyalty.show_panel', 'SALES', 'Loyalty', 'BOOL', 'true',
 NULL, NULL, NULL, 'DEVICE',
 'Show loyalty panel', 'Show the points panel on the billing screen at this device.', 80, false, 'SYSTEM'),

('loyalty.print_balance', 'SALES', 'Loyalty', 'BOOL', 'true',
 NULL, NULL, NULL, 'BRANCH',
 'Print points on the bill', 'Print points earned and the closing balance on the invoice.', 90, false, 'SYSTEM')

ON CONFLICT (asd_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
--  Comments on the load-bearing facts.
--
--  These say what is TRUE of this database. Where the design note's comments
--  said "Trigger-maintained", they now name the service that actually does the
--  recompute — no trigger is created here, and a COMMENT that claims one would
--  send the next person hunting for something that does not exist.
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE sales.loyalty_member IS
    'One points wallet per customer per company. Never partitioned and never carried forward at year end — the same row stays open across financial years. Keyed by company and customer, never branch: that is what makes points portable across a chain.';
COMMENT ON COLUMN sales.loyalty_member.lmb_acc_year IS
    'FY the member enrolled in. Reporting filter only, never a partition key.';
COMMENT ON COLUMN sales.loyalty_member.lmb_cust_id IS
    'The identity. lmb_card_no and lmb_mobile are handles for finding this row, not identities of their own.';
COMMENT ON COLUMN sales.loyalty_member.lmb_earned_points IS
    'Cache of loyalty_ledger, recomputed by LoyaltyLedgerService.recomputeMembers(). There is no trigger; never write this from any other code.';
COMMENT ON COLUMN sales.loyalty_member.lmb_redeemed_points IS
    'Cache of loyalty_ledger, recomputed by LoyaltyLedgerService.recomputeMembers(). There is no trigger; never write this from any other code.';
COMMENT ON COLUMN sales.loyalty_member.lmb_balance_points IS
    'GENERATED from the five bucket columns. What the customer holds — NOT what they may spend today: cooling lots and unswept lapsed lots make those differ, and LoyaltyLedgerService.redeemable() answers that instead. A whole-row INSERT must omit this column.';
COMMENT ON COLUMN sales.loyalty_member.lmb_next_expiry_on IS
    'Earliest lapse among lots with something left in them. Recomputed by LoyaltyLedgerService.recomputeMembers(), AFTER recomputeLots() — it reads lld_lot_balance, so the other order publishes a wrong date silently.';

COMMENT ON TABLE sales.loyalty_ledger IS
    'One row per point movement, drawn from one lot. Partitioned by the year of the EVENT, so a July redemption of April points lands in July and the April earn row never moves. Exactly one private method of LoyaltyLedgerService may write this table.';
COMMENT ON COLUMN sales.loyalty_ledger.lld_points IS
    'Signed. A reversal repeats the original row type with the opposite sign, so a plain SUM per type nets them; rows are never edited or deleted.';
COMMENT ON COLUMN sales.loyalty_ledger.lld_branch_id IS
    'Where the event happened. Earn-branch versus redeem-branch is the whole basis of inter-branch settlement in a chain.';
COMMENT ON COLUMN sales.loyalty_ledger.lld_consumed_points IS
    'On EARN rows only. Recomputed by LoyaltyLedgerService.recomputeLots() from the rows that name this lot. There is no trigger; never write this from any other code.';
COMMENT ON COLUMN sales.loyalty_ledger.lld_lot_balance IS
    'GENERATED: what is left of this lot. Zero, not NULL, on a consuming row. A whole-row INSERT must omit this column.';
COMMENT ON COLUMN sales.loyalty_ledger.lld_active_from IS
    'When this lot becomes redeemable: bill date + lsc_activation_days. Before it, the points count towards the balance but cannot be spent.';
COMMENT ON COLUMN sales.loyalty_ledger.lld_tender_id IS
    'The acc_tender_detail row (type 10, LOYALTY) the redemption settled through. Several REDEEM rows of one redemption share it, one per lot consumed.';

COMMENT ON TABLE sales.loyalty_gift_redeem IS
    'A gift redemption slip: its own document, own number series, own status and print count. Not a tender (no money crossed the counter) and not a bill line. The points it cost are GIFT rows on loyalty_ledger, which remains the authority.';
COMMENT ON COLUMN sales.loyalty_gift_redeem.lgr_opening_points IS
    'Snapshot for the printed slip only. loyalty_ledger and loyalty_member are the authority for any balance.';
COMMENT ON COLUMN sales.loyalty_gift_redeem.lgr_redeem_slno IS
    'Raw per-device serial, so an offline till can number a slip with no server round trip. lgr_redeem_refno is the printed number that embeds the counter series.';
COMMENT ON COLUMN sales.loyalty_gift_redeem.lgr_posted_voucher_id IS
    'The acc_voucher_header this slip posted to. Deliberately carries no FK — an offline counter writes the slip before the voucher exists (same rule as sale_bill.sb_posted_voucher_id). This is the ONLY route by which a gift redemption reaches Tally: export happens at the voucher layer, never from a source document.';
COMMENT ON COLUMN sales.loyalty_gift_redeem.lgr_otp_no IS
    'One-time code that authorised the redemption. Points are bearer value; a counter able to spend them unchallenged is a fraud route.';
COMMENT ON TABLE sales.loyalty_gift_redeem_item IS
    'The goods issued against a redemption slip, with the full stock movement (godown, batch, serial, expiry) and cost snapshot. One detail table: the legacy pair held identical column sets and only one was live.';


-- ───────────────────────────────────────────────────────────────────────────
--  Partitions.
--
--  public.ensure_acc_year_partitions is the one place that knows which tables
--  are partitioned by acc_year; it carries an explicit list rather than
--  scanning the catalogue. A partitioned table that is not in the list is
--  silently skipped when a fiscal year is opened and fails at the first insert
--  of the new year.
--
--  Re-stated in full (CREATE OR REPLACE) because that is how every earlier
--  migration has extended it; the body below is 20260921120000's, plus three
--  EXECUTEs for this migration's tables. The gift-redemption HEADER is created
--  before its DETAIL — fk_lgd_header points at it.
--
--  sales.loyalty_member is deliberately a plain table and takes no partitions.
-- ───────────────────────────────────────────────────────────────────────────
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
    --  The GSP call log. Every IRN, e-way bill and GSTIN lookup writes a row
    --  here, so a missing partition is a counter that cannot bill on April 1st.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.gst_api_log FOR VALUES IN (%L)',
        'gst_api_log_' || v_suffix, v_year);

    -- ── Added by 20260921140000 ──────────────────────────────────────────
    --  The loyalty engine's three. The ledger is written on every bill save
    --  that earns a point, so a missing partition stops billing outright for
    --  any customer with a wallet. Header before detail: fk_lgd_header.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_ledger FOR VALUES IN (%L)',
        'loyalty_ledger_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem FOR VALUES IN (%L)',
        'loyalty_gift_redeem_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem_item FOR VALUES IN (%L)',
        'loyalty_gift_redeem_item_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

-- Catch the three new tables up with the years that already have partitions,
-- rather than naming a hard-coded list of years that may or may not be the
-- ones this database uses. Reading them off txn_status_log is what keeps this
-- correct on every installation.
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
         WHERE p.relname = 'txn_status_log'
           AND c.relname ~ '[0-9]{4}_[0-9]{4}$'
         ORDER BY 1
    LOOP
        FOREACH v_tbl IN ARRAY ARRAY['loyalty_ledger', 'loyalty_gift_redeem',
                                     'loyalty_gift_redeem_item'] LOOP
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.%I FOR VALUES IN (%L)',
                v_tbl || '_' || replace(v_year, '-', '_'), v_tbl, v_year);
        END LOOP;
        RAISE NOTICE 'loyalty partitions ensured for %', v_year;
    END LOOP;
END
$backfill$;


-- ═══════════════════════════════════════════════════════════════════════════
--  NO FUNCTIONS AND NO TRIGGERS IN THIS MIGRATION. NOT ONE.
--
--  This migration is tables, constraints, indexes, comments and one partition
--  helper. Every BEHAVIOUR is LoyaltyLedgerService in NestJS.
--
--  ── WHY, and it is the offline app, not tidiness ─────────────────────────
--
--  The till runs offline and pushes to the cloud when it reconnects. A trigger
--  fires on the SERVER, during that push, on rows the till wrote hours ago
--  under conditions the server cannot see. That is the worst possible place
--  for logic to live:
--
--    * it runs in a language nobody on this team debugs, in a stack frame no
--      TypeScript stack trace reaches;
--    * it runs per statement of a sync batch, so a failure is attributed to
--      the batch rather than to the row that caused it;
--    * it runs whether or not the service wanted it to, so the push cannot
--      stage, inspect and correct data before it lands;
--    * and it forks quietly from the TypeScript that also has to do the sums
--      for the offline client — the divergence that already happened to the
--      stock posting engine.
--
--  ── WHAT THE SERVICE MUST DO, so nothing here was lost ───────────────────
--
--  Two columns are GENERATED ALWAYS and Postgres fills them by itself from
--  plain columns the service writes:
--
--    loyalty_member.lmb_balance_points
--        = lmb_earned_points + lmb_adjusted_points
--        - lmb_redeemed_points - lmb_expired_points - lmb_gift_points
--    loyalty_ledger.lld_lot_balance
--        = lld_points - lld_consumed_points   (on a lot row; 0 otherwise)
--
--  So the service fills the INPUTS and Postgres does the subtraction. Leave
--  the inputs at zero and every wallet reads zero and every lot looks
--  untouched — the feature simply does not work. These two recomputes are
--  therefore not optional; they are the feature.
--
--  NOTE for the sync writer: a GENERATED column may not be written. A push
--  that sends a whole row must leave lmb_balance_points and lld_lot_balance
--  OUT of the column list or the INSERT is rejected. Prisma already omits
--  them; hand-rolled SQL must too.
--
--  recomputeMembers(tx, memberIds[]) — for each id, from sales.loyalty_ledger
--  where lld_member_id = id AND lld_is_deleted = false:
--      lmb_earned_points     =  SUM(points) WHERE type IN ('EARN','OPENING')
--      lmb_redeemed_points   = -SUM(points) WHERE type = 'REDEEM'
--      lmb_expired_points    = -SUM(points) WHERE type = 'EXPIRE'
--      lmb_gift_points       = -SUM(points) WHERE type = 'GIFT'
--      lmb_adjusted_points   =  SUM(points) WHERE type IN ('ADJUST','TRANSFER')
--      lmb_lifetime_bill_amt =  SUM(lld_base_amount) WHERE type='EARN' AND src_doc_id IS NOT NULL
--      lmb_lifetime_bill_cnt =  COUNT(DISTINCT lld_src_doc_id) same filter
--      lmb_last_earn_on      =  MAX(txn_date) WHERE type='EARN'
--      lmb_last_redeem_on    =  MAX(txn_date) WHERE type IN ('REDEEM','GIFT')
--      lmb_last_activity_on  =  MAX(txn_date)
--      lmb_next_expiry_on    =  MIN(lld_expires_on) WHERE type='EARN'
--                               AND lld_lot_balance > 0 AND expires_on IS NOT NULL
--  Reversals are rows of the SAME type with the opposite sign, so a plain SUM
--  per type nets them — do not special-case a reversal.
--  A member whose every row was deleted gets ZEROES, not "left alone": a
--  GROUP BY returns no row for it, and that is the one way this recompute can
--  silently leave a stale wallet behind.
--
--  recomputeLots(tx, lots[{lotId, lotAccYear}]) — for each lot,
--      lld_consumed_points = -SUM(c.lld_points)
--        FROM loyalty_ledger c
--       WHERE c.lld_lot_id = lotId AND c.lld_lot_acc_year = lotAccYear
--         AND c.lld_is_deleted = false
--      (consuming rows are negative and their reversals positive, so the
--       negated sum is what has been drawn — again no reversal special case).
--
--  ORDER MATTERS: recompute the LOTS first, then the members. The wallet's
--  lmb_next_expiry_on reads lld_lot_balance, so a member re-summed before its
--  lots will publish the wrong next-expiry date and nothing will complain.
--
--  ── THE ONE RULE THAT REPLACES THE TRIGGER ───────────────────────────────
--
--  A trigger could not be forgotten. A service call can, and there are nine
--  write paths into this ledger — earn, consume, cancel reversal, return
--  claw-back, expiry, gift, adjust, transfer, opening. So make forgetting
--  structurally impossible rather than a matter of discipline:
--
--      ONE private method on LoyaltyLedgerService is the only code in the
--      entire codebase that INSERTs, UPDATEs or soft-deletes
--      sales.loyalty_ledger. It takes the rows, writes them, then recomputes
--      the touched lots and the touched members before it returns. Every other
--      method goes through it. Nothing else touches this table — not a
--      repository, not the sync handler, not a migration script.
--
--  A test should assert it: no file outside that service may reference
--  `loyalty_ledger` in a write. Recompute per BATCH, not per row: the sync
--  push is many rows at once, so both methods take arrays.
--
--  ── THE READS, also the service's ────────────────────────────────────────
--
--  lots(memberId, onDate) — the spendable lots, in the ONE order the whole
--  product must agree on:
--      WHERE type = 'EARN' AND NOT is_deleted AND lld_lot_balance > 0
--        AND (lld_active_from IS NULL OR lld_active_from <= onDate)   -- matured
--        AND (lld_expires_on  IS NULL OR lld_expires_on  >= onDate)   -- not lapsed
--      ORDER BY lld_expires_on NULLS LAST, lld_txn_date, lld_id
--  Oldest expiry first; within one expiry date, oldest earned first; lots that
--  never expire last of all. consume(), the till and the expiry job must all
--  call this one method and never re-implement the ORDER BY.
--
--  redeemable(memberId, onDate) = SUM(lld_lot_balance) over exactly those lots
--  — which is NOT lmb_balance_points: the wallet total also counts lots still
--  inside their cooling period and lots already lapsed but not yet swept.
--  Redeem against redeemable(), display lmb_balance_points.
--
--  balance(memberId) = lmb_balance_points, read straight off the wallet row.
--
--  ── consume() and expiryRun(), for the same reason ───────────────────────
--
--  consume(tx, memberId, points, txnType, …) — REDEEM (money; a tender row
--  must be given), GIFT (stock; no tender at all) or EXPIRE (nobody got
--  anything). Returns how many ledger rows it wrote.
--
--   1  points <= 0 → 0 rows, no work.
--   2  SELECT lmb_comp_id, lmb_cust_id FROM sales.loyalty_member
--      WHERE lmb_id = $1 FOR UPDATE — and deliberately NOT
--      "FOR UPDATE SKIP LOCKED". Two tills redeeming one wallet must
--      SERIALISE; in a supermarket that is a real race. Blocking is correct;
--      skipping would let both tills spend the same points. Keep this lock
--      inside the caller's transaction — it is the bill's post transaction, so
--      Prisma's interactive $transaction, never a fresh connection.
--   3  no member → throw (the row is gone or the id is wrong).
--   4  avail := redeemable(memberId, txnDate);
--      avail < points → throw, naming member, avail, date and points, BEFORE a
--      single row is written. NOTHING IN THE DATABASE WILL CATCH THIS: there
--      is deliberately no non-negativity CHECK on the wallet or the lot (see
--      loyalty_member's trailing comment), so this guard is the only guard.
--      An over-draw that gets past it is recorded, not refused, and surfaces
--      in ix_lmb_overdrawn the next morning.
--   5  for each lot from lots(memberId, txnDate), in that order, until the ask
--      is covered:
--        take := LEAST(left, lot.lot_balance)
--        INSERT one sales.loyalty_ledger row:
--          lld_points     = -take            (always negative; a spend)
--          lld_row_no     = 1, 2, 3 … within this call
--          lld_lot_id / lld_lot_acc_year = the lot being drawn from
--          lld_money_value = ROUND(take * rate, 2)
--          lld_comp_id / lld_cust_id from the member row, branch / acc year /
--          src_module / src_doc_type / src_doc_id / src_acc_year /
--          src_doc_refno / tender_id / tender_acc_year / created_by from the
--          caller.
--      ONE ROW PER LOT — the member statement has to be able to say which lot
--      paid. Do not collapse them. Then recomputeLots(), then
--      recomputeMembers(), in that order, before returning.
--   6  anything still unallocated after the loop → throw: the lot balances and
--      the wallet balance disagree. Unreachable while the wallet is locked and
--      step 4 passed, which is exactly why it must be loud.
--
--  expiryRun(companyId, accYear, on = today, createdBy = 'SYSTEM') — the
--  nightly sweep, per company. An expiry is a CLOCK event and a clock is not a
--  row change, which is why it was never a trigger; in NestJS it belongs on
--  the scheduler, with the jobs list, its logging and its retry.
--
--   1  runId := md5(companyId || '|' || on)::uuid — DETERMINISTIC, so a re-run
--      on the same date is caught by ux_lld_src_row instead of quietly writing
--      a second set of EXPIRE rows. Keep the exact recipe.
--   2  select the lapsed lots:
--        lld_txn_type = 'EARN' AND lld_is_deleted = false
--        AND lld_lot_balance > 0
--        AND lld_expires_on IS NOT NULL AND lld_expires_on < on
--      ORDER BY lld_expires_on, lld_txn_date, lld_id.
--   3  one EXPIRE row per lot, lld_points = -lot_balance, lld_txn_date = on,
--      lld_lot_id / lld_lot_acc_year = the lot, lld_src_module 'SALES',
--      lld_src_doc_type 'EXPIRY_RUN', lld_src_doc_id = runId,
--      lld_src_acc_year = accYear, lld_remarks 'Lapsed on <on>'. Carry
--      lld_lsc_id from the lot so the statement keeps the scheme.
--   4  return the row count.
--
--  Idempotent twice over, and both must survive the port: a swept lot has a
--  zero balance and is not selected again, and ux_lld_src_row rejects a second
--  row for the same run and lot.
--
--  Tests that must exist before this is called done (test/sales/loyalty): two
--  concurrent redeems of one wallet serialise and the second sees the first's
--  spend; a redeem larger than the balance throws and writes nothing; a redeem
--  spanning three lots writes three rows in FIFO order; the expiry run is
--  re-run on the same date and writes nothing the second time.
--
--  Nothing here creates fn_loyalty_lots, fn_loyalty_redeemable or
--  fn_loyalty_balance as database functions. If a scratch database still holds
--  them from an earlier draft, drop them by hand — a stale FIFO sitting in the
--  schema is exactly what someone eventually calls instead of the service's.
-- ═══════════════════════════════════════════════════════════════════════════
