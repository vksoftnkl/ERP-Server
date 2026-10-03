-- ═══════════════════════════════════════════════════════════════════════════
--  Coupons and gift vouchers
--      sales.loyalty_coupon_batch  the campaign / voucher book   (lcb_)
--      sales.loyalty_coupon        one ISSUED coupon             (lcp_)
--      sales.loyalty_coupon_txn    one movement against it       (lct_)
--
--  Requires PostgreSQL 18+ (uuidv7()).
--
--  ── What this is, and what it is not ─────────────────────────────────────
--  A coupon is a MONEY instrument with a code on it. It is not points, it has
--  no ledger in common with points, and it is redeemed through its own tender
--  type — accounts.acc_tender_types 11 (VOUCHER), already seeded and
--  confirmed present. Nothing here depends on the points engine
--  (20260921140000) beyond an optional link to a wallet; the two are
--  independently deployable.
--
--  Two sources, and only two:
--      SOLD      a gift voucher the customer bought. It may be RELOADED
--                (lcb_allow_topup), which is what makes it a gift CARD rather
--                than a one-shot slip.
--      CAMPAIGN  codes issued in bulk from a batch and handed out or mailed.
--                Not reloadable — a campaign code is not a wallet.
--
--  Deliberately absent: coupons auto-issued on a spend milestone or a
--  birthday, and points converted into a coupon. Both were considered and
--  ruled out; neither leaves a stub here to trip over.
--
--  ── The shape ────────────────────────────────────────────────────────────
--  The same pairing as acc_bill_balance and the points ledger, for the same
--  reason:
--
--      loyalty_coupon      NOT partitioned. A voucher issued in 2025-2026 and
--                          spent in 2027-2028 is the SAME row throughout;
--                          lcp_acc_year is the FY of issue and a reporting
--                          filter only, never a partition key.
--
--      loyalty_coupon_txn  IS partitioned, by the year of the MOVEMENT.
--
--  lcp_used_value and lcp_topup_value are CACHES of the txn table.
--  Application code writes movements and reads balances.
--
--  A redemption is undone by a new row of the SAME type with the opposite
--  sign naming the row it undoes (lct_reversal_of_id) — the
--  acc_bill_adjustment discipline. There is no separate REVERSAL type, because
--  that would make the sums need two rules instead of one.
--
--  ── Percentage coupons still settle in rupees ────────────────────────────
--  A PERCENT batch ("20% off, up to 500") resolves against the bill at the
--  moment of redemption, and the RESOLVED RUPEE AMOUNT is what lands in
--  lct_amount and in acc_tender_detail.td_amount. The percentage never leaves
--  the batch. This is the one place the coupon model and the tender model
--  could be read as disagreeing, so it is written down rather than inferred.
--
--  ── How this reaches Tally ───────────────────────────────────────────────
--  By the ordinary tender route, with nothing added here. Selling a voucher is
--  a line on a bill, and that bill posts a voucher. Redeeming one writes an
--  acc_tender_detail row (type 11) whose td_voucher_id is filled at posting,
--  and that voucher exports like any other. lcp_src_doc_* already names the
--  bill that sold the card, so the liability is traceable in both directions.
--
--  No tally_guid columns here either: export is a voucher-layer concern, and a
--  second copy of the identity triple would only give the two a way to differ.
--
--  ── Deviations from the source design note, and why ──────────────────────
--   1. PARTITIONS. The note builds them with a self-contained DO loop over
--      three hard-coded years, on the grounds that fn_create_year_partitions
--      "does not exist on the live database". It does not — but
--      public.ensure_acc_year_partitions does, and it is the function the
--      April 1st ritual actually calls. A partitioned table absent from its
--      list is silently skipped when a year is opened and fails at the first
--      insert of the new year. So loyalty_coupon_txn goes INTO that function,
--      and the years are read off txn_status_log rather than hard-coded: this
--      database has four (2024-2025 … 2027-2028), not the three the note names.
--
--   2. lcp_last_used_on IS ADDED. The note's recomputeCoupons() contract
--      writes it —  "lcp_last_used_on = MAX(lct_txn_date)" — but no such
--      column appears in its DDL. A service told to write a column that does
--      not exist fails at the first redemption, so the column is declared
--      here rather than the contract quietly trimmed.
--
--   3. TRIGGERS. The note is emphatic that it contains no functions and no
--      triggers, yet several of its COMMENT ON texts say "Trigger-maintained"
--      and its prose refers to fn_lcp_recompute and tr_lct_refresh_coupon.
--      Nothing here creates any of them. The comments below say what is
--      actually true, because a COMMENT is what the next person reads out of
--      \d+ when a voucher balance looks wrong.
--
--  ── ONE HOLE LEFT AS SPECIFIED, and flagged rather than papered over ─────
--  ck_lcp_face demands lcp_face_value > 0 on EVERY issued coupon, while
--  ck_lcb_value leaves lcb_face_value at 0 for a PERCENT batch and
--  lcb_max_value is nullable. So a coupon cannot be issued from an UNCAPPED
--  PERCENT batch: there is no positive face value to snapshot. A capped one is
--  fine — the cap is the face value. Both constraints are implemented exactly
--  as the note wrote them; closing the gap is a design decision, and the
--  one-line form of it would be:
--
--      ALTER TABLE sales.loyalty_coupon_batch ADD CONSTRAINT ck_lcb_percent_capped
--          CHECK (lcb_value_type <> 'PERCENT' OR lcb_max_value IS NOT NULL);
--
--  ── Conventions ──────────────────────────────────────────────────────────
--  The 00-11 CHAIN style (pk_ / ck_ / _modified_on / created_by varchar(50) /
--  now()) throughout, including the batch master — a master that lives beside
--  its own transactions should not be spelled differently from them.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  The batch — what a coupon of this kind is worth and how it behaves.
--  Per-company binding with an optional branch and a validity window, the
--  gst_company_credential shape.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_coupon_batch
(
    lcb_id                uuid           NOT NULL DEFAULT uuidv7(),
    lcb_comp_id           uuid           NOT NULL,
    lcb_branch_id         uuid,                      -- NULL = every branch
    lcb_tenant_id         uuid,

    lcb_code              character varying(20)  NOT NULL,   -- stable handle, never renamed
    lcb_name              character varying(150) NOT NULL,
    lcb_source            character varying(15)  NOT NULL,   -- SOLD | CAMPAIGN

    -- ── What it is worth ─────────────────────────────────────────────────
    lcb_value_type        character varying(10)  NOT NULL DEFAULT 'AMOUNT',  -- AMOUNT | PERCENT
    lcb_face_value        numeric(18,2)  NOT NULL DEFAULT 0,   -- for AMOUNT
    lcb_percent           numeric(6,3)   NOT NULL DEFAULT 0,   -- for PERCENT
    lcb_max_value         numeric(18,2),                       -- cap on a PERCENT coupon
    lcb_min_bill_amount   numeric(18,2)  NOT NULL DEFAULT 0,

    -- ── How it may be spent ──────────────────────────────────────────────
    -- Partial: may a 500 voucher go 300 now and 200 next week. This is what
    -- decides whether lcp_used_value behaves as a balance or as a switch.
    lcb_allow_partial     boolean NOT NULL DEFAULT false,
    lcb_allow_topup       boolean NOT NULL DEFAULT false,      -- reloadable gift card
    lcb_max_per_bill      smallint NOT NULL DEFAULT 1,
    lcb_is_transferable   boolean NOT NULL DEFAULT true,       -- false = bound to lcp_cust_id
    lcb_pin_required      boolean NOT NULL DEFAULT false,

    -- ── Code generation (CAMPAIGN) ───────────────────────────────────────
    lcb_prefix            character varying(10),
    lcb_code_length       smallint       NOT NULL DEFAULT 12,
    lcb_max_issue_count   integer,                             -- NULL = unlimited
    -- CACHES of loyalty_coupon, recomputed by
    -- LoyaltyCouponService.recomputeCouponBatches(). There is no trigger; no
    -- other code may write them.
    lcb_issued_count      integer        NOT NULL DEFAULT 0,
    lcb_redeemed_count    integer        NOT NULL DEFAULT 0,

    -- ── Validity ─────────────────────────────────────────────────────────
    lcb_valid_from        date,
    lcb_valid_upto        date,
    -- SOLD vouchers usually expire N days after THEIR OWN issue rather than on
    -- a batch-wide date; this is that N.
    lcb_validity_days     integer,

    lcb_branch_scope      character varying(10) NOT NULL DEFAULT 'ALL',   -- ALL | LIST
    lcb_cust_group_id     uuid,                                -- sales.cust_groups(cgr_id)

    -- The VOUCHER tender (type 11) redemption settles through. NULL = the
    -- branch's default. The rate and the floor stay owned by the tender
    -- master, exactly as they do for points.
    lcb_redeem_tender_id  uuid,

    lcb_remarks           character varying(500),
    lcb_is_active         boolean NOT NULL DEFAULT true,
    lcb_is_deleted        boolean NOT NULL DEFAULT false,

    lcb_sync_date         timestamp(6) with time zone,
    lcb_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    lcb_created_by        character varying(50),
    lcb_modified_on       timestamp(6) with time zone,
    lcb_modified_by       character varying(50),

    CONSTRAINT pk_loyalty_coupon_batch PRIMARY KEY (lcb_id),

    CONSTRAINT fk_lcb_company FOREIGN KEY (lcb_comp_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcb_branch FOREIGN KEY (lcb_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcb_redeem_tender FOREIGN KEY (lcb_redeem_tender_id)
        REFERENCES accounts.acc_tender_master (tnd_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcb_cust_group FOREIGN KEY (lcb_cust_group_id)
        REFERENCES sales.cust_groups (cgr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lcb_code_shape CHECK (lcb_code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT ck_lcb_source CHECK (
        lcb_source::text = ANY (ARRAY['SOLD'::text, 'CAMPAIGN'::text])),
    CONSTRAINT ck_lcb_value_type CHECK (
        lcb_value_type::text = ANY (ARRAY['AMOUNT'::text, 'PERCENT'::text])),
    CONSTRAINT ck_lcb_value CHECK (
        CASE WHEN lcb_value_type::text = 'AMOUNT'
             THEN lcb_face_value > 0 AND lcb_percent = 0
             ELSE lcb_percent > 0 AND lcb_percent <= 100 END),
    CONSTRAINT ck_lcb_max_value CHECK (
        lcb_max_value IS NULL OR lcb_max_value > 0),
    CONSTRAINT ck_lcb_min_bill CHECK (lcb_min_bill_amount >= 0),
    CONSTRAINT ck_lcb_code_length CHECK (lcb_code_length BETWEEN 6 AND 30),
    CONSTRAINT ck_lcb_max_issue CHECK (
        lcb_max_issue_count IS NULL OR lcb_max_issue_count > 0),
    -- No "redeemed <= issued" guard: both are aggregates and a sync batch
    -- may carry the redemption before the issue. Recorded, not refused —
    -- ix_lcb_overdrawn.
    CONSTRAINT ck_lcb_max_per_bill CHECK (lcb_max_per_bill >= 1),
    CONSTRAINT ck_lcb_validity CHECK (
        lcb_valid_from IS NULL OR lcb_valid_upto IS NULL
        OR lcb_valid_upto >= lcb_valid_from),
    CONSTRAINT ck_lcb_validity_days CHECK (
        lcb_validity_days IS NULL OR lcb_validity_days > 0),
    CONSTRAINT ck_lcb_branch_scope CHECK (
        lcb_branch_scope::text = ANY (ARRAY['ALL'::text, 'LIST'::text])),
    -- A campaign code is handed out, not held as a balance. Reloading one
    -- would make it a wallet with no owner.
    CONSTRAINT ck_lcb_topup CHECK (
        lcb_allow_topup = false OR lcb_source::text = 'SOLD'),
    -- A cap on a percentage is the only case where a cap means anything.
    CONSTRAINT ck_lcb_cap_percent CHECK (
        lcb_max_value IS NULL OR lcb_value_type::text = 'PERCENT')
);

ALTER TABLE IF EXISTS sales.loyalty_coupon_batch OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lcb_code
    ON sales.loyalty_coupon_batch USING btree (lcb_comp_id, upper(lcb_code::text))
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lcb_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lcb_branch ON sales.loyalty_coupon_batch USING btree (lcb_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcb_branch_id IS NOT NULL AND lcb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lcb_cust_group ON sales.loyalty_coupon_batch USING btree (lcb_cust_group_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcb_cust_group_id IS NOT NULL AND lcb_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lcb_redeem_tender ON sales.loyalty_coupon_batch USING btree (lcb_redeem_tender_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcb_redeem_tender_id IS NOT NULL AND lcb_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lcb_lookup
    ON sales.loyalty_coupon_batch USING btree
    (lcb_comp_id, lcb_branch_id, lcb_valid_from, lcb_valid_upto)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lcb_is_active = true AND lcb_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  The issued coupon.
--
--  NOT partitioned, and never carried forward at year end.
--
--  lcp_face_value is a SNAPSHOT taken at issue. Re-pricing a batch must not
--  re-price the cards already in customers' wallets — the same reason
--  acc_tender_detail snapshots its ledger and its rate.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_coupon
(
    lcp_id                uuid           NOT NULL DEFAULT uuidv7(),
    lcp_comp_id           uuid           NOT NULL,
    lcp_branch_id         uuid,                      -- branch that ISSUED it
    lcp_tenant_id         uuid,
    lcp_acc_year          character(9)   NOT NULL,   -- FY of issue, filter only

    lcp_lcb_id            uuid           NOT NULL,
    lcp_code              character varying(40) NOT NULL,   -- what the counter scans
    -- So a code photographed off someone's phone screen is not by itself
    -- spendable.
    lcp_pin               character varying(10),

    lcp_cust_id           uuid,                      -- NULL = bearer instrument
    lcp_member_id         uuid,                      -- if the holder is also a points member
    lcp_party_ledger_id   uuid,

    lcp_issued_on         date           NOT NULL DEFAULT CURRENT_DATE,
    lcp_valid_from        date,
    lcp_valid_upto        date,

    -- The bill that SOLD it, when it was sold rather than given away.
    lcp_src_module        character varying(20),
    lcp_src_doc_type      character varying(30),
    lcp_src_doc_id        uuid,
    lcp_src_acc_year      character(9),
    lcp_src_doc_refno     character varying(100),

    lcp_face_value        numeric(18,2)  NOT NULL,
    -- What was actually PAID for it: 0 for a giveaway, face value for a sold
    -- card, something between for a discounted promotion. Breakage — vouchers
    -- sold and never spent — has no other source.
    lcp_issue_amount      numeric(18,2)  NOT NULL DEFAULT 0,

    -- CACHES of loyalty_coupon_txn, recomputed by
    -- LoyaltyCouponService.recomputeCoupons(). There is no trigger; no other
    -- code may write them.
    lcp_used_value        numeric(18,2)  NOT NULL DEFAULT 0,
    lcp_topup_value       numeric(18,2)  NOT NULL DEFAULT 0,
    lcp_use_count         integer        NOT NULL DEFAULT 0,
    -- Added here, not in the design note, whose recomputeCoupons() contract
    -- writes it ("lcp_last_used_on = MAX(lct_txn_date)") against a column it
    -- never declares. A service told to write a column that does not exist
    -- fails at the first redemption.
    lcp_last_used_on      date,
    lcp_balance_value     numeric(18,2)
        GENERATED ALWAYS AS (lcp_face_value + lcp_topup_value - lcp_used_value) STORED,

    -- Deliberately NOT a generated column. ISSUED / PARTIAL / REDEEMED are
    -- arithmetic, but EXPIRED, CANCELLED and BLOCKED are DECISIONS and cannot
    -- be derived from the amounts — and expiry additionally depends on today's
    -- date, which a generated column may not read. recomputeCoupons() moves it
    -- between the first three only and leaves the other three alone; the admin
    -- path and LoyaltyCouponService.couponExpiryRun() own those.
    lcp_status            character varying(20) NOT NULL DEFAULT 'ISSUED',
    lcp_redeemed_on       date,
    lcp_cancelled_on      date,
    lcp_cancelled_by      uuid,
    lcp_cancel_reason     character varying(250),

    lcp_remarks           character varying(250),
    lcp_is_active         boolean NOT NULL DEFAULT true,
    lcp_is_deleted        boolean NOT NULL DEFAULT false,

    lcp_sync_date         timestamp(6) with time zone,
    lcp_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    lcp_created_by        character varying(50),
    lcp_modified_on       timestamp(6) with time zone,
    lcp_modified_by       character varying(50),

    CONSTRAINT pk_loyalty_coupon PRIMARY KEY (lcp_id),

    CONSTRAINT fk_lcp_batch FOREIGN KEY (lcp_lcb_id)
        REFERENCES sales.loyalty_coupon_batch (lcb_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcp_company FOREIGN KEY (lcp_comp_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcp_branch FOREIGN KEY (lcp_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcp_cust FOREIGN KEY (lcp_cust_id)
        REFERENCES sales.customers (cus_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcp_member FOREIGN KEY (lcp_member_id)
        REFERENCES sales.loyalty_member (lmb_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcp_cancelled_by FOREIGN KEY (lcp_cancelled_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lcp_party_ledger FOREIGN KEY (lcp_party_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lcp_acc_year CHECK (
        lcp_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(lcp_acc_year, 4)::int = LEFT(lcp_acc_year, 4)::int + 1),
    CONSTRAINT ck_lcp_src_acc_year CHECK (
        lcp_src_acc_year IS NULL OR lcp_src_acc_year ~ '^[0-9]{4}-[0-9]{4}$'),
    CONSTRAINT ck_lcp_src_doc CHECK (
        (lcp_src_module IS NULL AND lcp_src_doc_type IS NULL AND lcp_src_doc_id IS NULL)
        OR (lcp_src_module IS NOT NULL AND lcp_src_doc_type IS NOT NULL
            AND lcp_src_doc_id IS NOT NULL)),
    CONSTRAINT ck_lcp_code_shape CHECK (length(btrim(lcp_code)) > 0),
    CONSTRAINT ck_lcp_status CHECK (
        lcp_status::text = ANY (ARRAY[
            'ISSUED'::text, 'PARTIAL'::text, 'REDEEMED'::text,
            'EXPIRED'::text, 'CANCELLED'::text, 'BLOCKED'::text])),
    CONSTRAINT ck_lcp_cancel CHECK (
        lcp_status::text <> 'CANCELLED' OR lcp_cancelled_on IS NOT NULL),
    CONSTRAINT ck_lcp_validity CHECK (
        lcp_valid_from IS NULL OR lcp_valid_upto IS NULL
        OR lcp_valid_upto >= lcp_valid_from),
    CONSTRAINT ck_lcp_issue_amount CHECK (lcp_issue_amount >= 0),

    -- The face value is set once, at issue, and is not an aggregate, so it
    -- can still be guarded. Used value, top-up and use count are aggregates
    -- over movements that sync in pieces, and the over-spend guard that would
    -- have lived here is LoyaltyCouponService's policy at post; the database
    -- records the over-draw and ix_lcp_overdrawn finds it.
    --
    -- CAVEAT, see the file header: this also means a coupon cannot be issued
    -- from an UNCAPPED PERCENT batch, because there is no positive face value
    -- to snapshot.
    CONSTRAINT ck_lcp_face CHECK (lcp_face_value > 0)
);

ALTER TABLE IF EXISTS sales.loyalty_coupon OWNER to postgres;

-- THE SCAN AT THE COUNTER. Company-scoped rather than batch-scoped, because a
-- cashier types a code, not a code and the batch it came from.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lcp_code
    ON sales.loyalty_coupon USING btree (lcp_comp_id, upper(lcp_code::text))
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lcp_is_deleted = false;

-- The expiry sweep and the outstanding-voucher liability report.
CREATE INDEX IF NOT EXISTS ix_lcp_open
    ON sales.loyalty_coupon USING btree (lcp_comp_id, lcp_valid_upto)
    INCLUDE (lcp_code, lcp_face_value, lcp_balance_value, lcp_cust_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lcp_is_deleted = false AND lcp_balance_value > 0
      AND lcp_status::text = ANY (ARRAY['ISSUED'::text, 'PARTIAL'::text]);

CREATE INDEX IF NOT EXISTS ix_lcp_member ON sales.loyalty_coupon USING btree (lcp_member_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcp_member_id IS NOT NULL AND lcp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lcp_party_ledger ON sales.loyalty_coupon USING btree (lcp_party_ledger_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcp_party_ledger_id IS NOT NULL AND lcp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lcp_branch ON sales.loyalty_coupon USING btree (lcp_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcp_branch_id IS NOT NULL AND lcp_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lcp_batch
    ON sales.loyalty_coupon USING btree (lcp_lcb_id, lcp_status)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lcp_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lcp_cust
    ON sales.loyalty_coupon USING btree (lcp_comp_id, lcp_cust_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lcp_cust_id IS NOT NULL AND lcp_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lcp_src_doc
    ON sales.loyalty_coupon USING btree (lcp_src_doc_type, lcp_src_doc_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lcp_src_doc_id IS NOT NULL AND lcp_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  The movement.
--
--  Partitioned by the year of the MOVEMENT, not of the issue: a 2027 spend of
--  a 2025 voucher lands in 2027 and the voucher row never moves.
--
--  lct_amount is SIGNED and always means "what this event does to the
--  voucher": REDEEM / EXPIRE / CANCEL consume it (positive), TOPUP adds to it
--  (positive, into its own bucket). A reversal repeats its type with the
--  opposite sign. There is no REVERSAL type, so the recompute needs one rule
--  per bucket rather than two.
--
--  NOTE, because it is the opposite of the points ledger and the two live in
--  the same schema: here a spend is POSITIVE and the TYPE carries the sign.
--  In sales.loyalty_ledger a spend is NEGATIVE. Do not copy one recompute
--  into the other.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.loyalty_coupon_txn
(
    lct_id                uuid           NOT NULL DEFAULT uuidv7(),
    lct_comp_id           uuid           NOT NULL,
    lct_branch_id         uuid           NOT NULL,   -- where it was presented
    lct_tenant_id         uuid,
    lct_acc_year          character(9)   NOT NULL,

    -- Single-column FK: loyalty_coupon is not partitioned, which is what makes
    -- redeeming a two-year-old voucher a plain foreign key.
    lct_lcp_id            uuid           NOT NULL,
    lct_lcb_id            uuid           NOT NULL,   -- snapshot, so batch reports need no hop
    lct_cust_id           uuid,
    lct_member_id         uuid,

    lct_txn_type          character varying(20) NOT NULL,
    lct_row_no            integer        NOT NULL DEFAULT 1,
    lct_amount            numeric(18,2)  NOT NULL,
    lct_txn_date          date           NOT NULL,

    -- For a PERCENT batch: the bill it was measured against, and the rate that
    -- produced lct_amount. Without these the resolved figure is unexplainable
    -- afterwards.
    lct_bill_amount       numeric(18,2)  NOT NULL DEFAULT 0,
    lct_percent_applied   numeric(6,3)   NOT NULL DEFAULT 0,

    lct_src_module        character varying(20),
    lct_src_doc_type      character varying(30),
    lct_src_doc_id        uuid,
    lct_src_acc_year      character(9),
    lct_src_doc_refno     character varying(100),

    -- The tender line (type 11, VOUCHER) the money went out on.
    lct_tender_id         uuid,
    lct_tender_acc_year   character(9),

    lct_reversal_of_id       uuid,
    lct_reversal_of_acc_year character(9),
    lct_reversal_reason      character varying(250),

    lct_approved_by       uuid,
    lct_user_id           uuid,
    lct_session_id        uuid,
    lct_device_id         uuid,

    lct_remarks           character varying(250),
    lct_is_deleted        boolean NOT NULL DEFAULT false,

    lct_sync_date         timestamp(6) with time zone,
    lct_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    lct_created_by        character varying(50),
    lct_modified_on       timestamp(6) with time zone,
    lct_modified_by       character varying(50),

    CONSTRAINT pk_loyalty_coupon_txn PRIMARY KEY (lct_id, lct_acc_year),

    CONSTRAINT fk_lct_coupon FOREIGN KEY (lct_lcp_id)
        REFERENCES sales.loyalty_coupon (lcp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_batch FOREIGN KEY (lct_lcb_id)
        REFERENCES sales.loyalty_coupon_batch (lcb_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_cust FOREIGN KEY (lct_cust_id)
        REFERENCES sales.customers (cus_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_member FOREIGN KEY (lct_member_id)
        REFERENCES sales.loyalty_member (lmb_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_company FOREIGN KEY (lct_comp_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_branch FOREIGN KEY (lct_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_user FOREIGN KEY (lct_user_id)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_approved_by FOREIGN KEY (lct_approved_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_device FOREIGN KEY (lct_device_id)
        REFERENCES fixed.device_master (dev_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_tender FOREIGN KEY (lct_tender_id, lct_tender_acc_year)
        REFERENCES accounts.acc_tender_detail (td_id, td_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lct_reversal FOREIGN KEY (lct_reversal_of_id, lct_reversal_of_acc_year)
        REFERENCES sales.loyalty_coupon_txn (lct_id, lct_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_lct_acc_year CHECK (
        lct_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(lct_acc_year, 4)::int = LEFT(lct_acc_year, 4)::int + 1),
    CONSTRAINT ck_lct_src_acc_year CHECK (
        lct_src_acc_year IS NULL OR lct_src_acc_year ~ '^[0-9]{4}-[0-9]{4}$'),
    CONSTRAINT ck_lct_src_doc CHECK (
        (lct_src_module IS NULL AND lct_src_doc_type IS NULL AND lct_src_doc_id IS NULL)
        OR (lct_src_module IS NOT NULL AND lct_src_doc_type IS NOT NULL
            AND lct_src_doc_id IS NOT NULL)),

    CONSTRAINT ck_lct_txn_type CHECK (
        lct_txn_type::text = ANY (ARRAY[
            'REDEEM'::text, 'TOPUP'::text, 'CANCEL'::text, 'EXPIRE'::text])),
    CONSTRAINT ck_lct_amount_nonzero CHECK (lct_amount <> 0),
    -- Positive unless it is a reversal, whatever the type.
    CONSTRAINT ck_lct_sign CHECK (
        (lct_reversal_of_id IS NULL) = (lct_amount > 0)),
    CONSTRAINT ck_lct_percent CHECK (
        lct_percent_applied >= 0 AND lct_percent_applied <= 100),
    CONSTRAINT ck_lct_bill_amount CHECK (lct_bill_amount >= 0),

    CONSTRAINT ck_lct_tender_pair CHECK (
        (lct_tender_id IS NULL) = (lct_tender_acc_year IS NULL)),
    CONSTRAINT ck_lct_reversal_pair CHECK (
        (lct_reversal_of_id IS NULL) = (lct_reversal_of_acc_year IS NULL)),
    CONSTRAINT ck_lct_no_self_reversal CHECK (
        lct_reversal_of_id IS NULL OR lct_reversal_of_id <> lct_id),

    -- A redemption names the tender it settled through; a reversal need not.
    -- EXPIRE and CANCEL never have one — nothing was paid out.
    CONSTRAINT ck_lct_redeem_tender CHECK (
        lct_txn_type::text <> 'REDEEM'
        OR lct_tender_id IS NOT NULL
        OR lct_reversal_of_id IS NOT NULL),
    CONSTRAINT ck_lct_no_tender CHECK (
        lct_txn_type::text NOT IN ('EXPIRE', 'CANCEL') OR lct_tender_id IS NULL),
    -- Voiding a live voucher is somebody's decision.
    CONSTRAINT ck_lct_cancel_approval CHECK (
        lct_txn_type::text <> 'CANCEL' OR lct_approved_by IS NOT NULL),
    CONSTRAINT ck_lct_row_no CHECK (lct_row_no >= 1)
) PARTITION BY LIST (lct_acc_year);

ALTER TABLE IF EXISTS sales.loyalty_coupon_txn OWNER to postgres;

CREATE INDEX IF NOT EXISTS ix_lct_member ON sales.loyalty_coupon_txn USING btree (lct_member_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_member_id IS NOT NULL AND lct_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lct_cust ON sales.loyalty_coupon_txn USING btree (lct_cust_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_cust_id IS NOT NULL AND lct_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lct_user ON sales.loyalty_coupon_txn USING btree (lct_user_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_user_id IS NOT NULL AND lct_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lct_device ON sales.loyalty_coupon_txn USING btree (lct_device_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_device_id IS NOT NULL AND lct_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lct_coupon
    ON sales.loyalty_coupon_txn USING btree (lct_lcp_id, lct_txn_date)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lct_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lct_batch_period
    ON sales.loyalty_coupon_txn USING btree (lct_comp_id, lct_lcb_id, lct_txn_date)
    INCLUDE (lct_amount, lct_txn_type)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lct_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lct_tender
    ON sales.loyalty_coupon_txn USING btree (lct_tender_id, lct_tender_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lct_tender_id IS NOT NULL AND lct_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_lct_src_doc
    ON sales.loyalty_coupon_txn USING btree (lct_src_doc_type, lct_src_doc_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lct_src_doc_id IS NOT NULL AND lct_is_deleted = false;

-- One voucher cannot be spent twice on the same bill by an offline re-sync.
-- This is also what makes couponExpiryRun() safe to re-run on the same date:
-- its deterministic runId lands here as lct_src_doc_id.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lct_src_row
    ON sales.loyalty_coupon_txn USING btree
    (lct_lcp_id, lct_src_doc_type, lct_src_doc_id, lct_acc_year, lct_row_no)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lct_src_doc_id IS NOT NULL AND lct_is_deleted = false;

-- Unique per YEAR only — same partition-key caveat as ux_abj_reversal and
-- ux_lld_reversal. A cross-year double reversal is the posting code's job to
-- prevent.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lct_reversal
    ON sales.loyalty_coupon_txn USING btree (lct_reversal_of_id, lct_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lct_reversal_of_id IS NOT NULL AND lct_is_deleted = false;


-- ── Reconciliation: what the dropped CHECKs used to refuse ────────────────
--
-- A voucher spent past what it holds, and a batch whose redemptions outrun
-- its issues. Both are reachable offline and both must be findable, not
-- refused.
CREATE INDEX IF NOT EXISTS ix_lcp_overdrawn
    ON sales.loyalty_coupon USING btree (lcp_comp_id, lcp_balance_value)
    WHERE lcp_is_deleted = false AND lcp_balance_value < 0;

CREATE INDEX IF NOT EXISTS ix_lcb_overdrawn
    ON sales.loyalty_coupon_batch USING btree (lcb_comp_id)
    WHERE lcb_is_deleted = false AND lcb_redeemed_count > lcb_issued_count;


-- ───────────────────────────────────────────────────────────────────────────
--  Remaining FK-covering indexes — every foreign key gets an index led by its
--  own columns. The reversal pair is on (reversal_of_id, REVERSAL_OF_acc_year);
--  ux_lct_reversal is on (reversal_of_id, ACC_YEAR) and does not cover it.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_lcp_cust_fk ON sales.loyalty_coupon USING btree (lcp_cust_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcp_cust_id IS NOT NULL AND lcp_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lcp_cancelled_by ON sales.loyalty_coupon USING btree (lcp_cancelled_by)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lcp_cancelled_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_lct_batch_fk ON sales.loyalty_coupon_txn USING btree (lct_lcb_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lct_branch ON sales.loyalty_coupon_txn USING btree (lct_branch_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lct_approved_by ON sales.loyalty_coupon_txn USING btree (lct_approved_by)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lct_reversal_fk
    ON sales.loyalty_coupon_txn USING btree (lct_reversal_of_id, lct_reversal_of_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE lct_reversal_of_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  Settings — enablement and UI only. Every value the arithmetic depends on
--  lives on loyalty_coupon_batch instead: a setting is mutable with no
--  history, a batch is versioned by its validity window, and a voucher in
--  circulation has to stay reproducible from the batch that issued it.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
     asd_label, asd_description, asd_sort_order, asd_needs_relogin,
     asd_created_by)
VALUES

('coupon.enabled', 'SALES', 'Coupons', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Coupons and gift vouchers', 'Master switch for gift vouchers and campaign codes.', 10, true, 'SYSTEM'),

('coupon.allow_partial_redeem', 'SALES', 'Coupons', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Allow part redemption', 'Default for new batches: may a voucher be spent across more than one bill.', 20, false, 'SYSTEM'),

('coupon.pin_required', 'SALES', 'Coupons', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'PIN required to redeem', 'A coupon code alone is not enough; the PIN must be entered too.', 30, false, 'SYSTEM'),

('coupon.max_per_bill', 'SALES', 'Coupons', 'INT', '1',
 NULL, 1, 10, 'COMPANY',
 'Coupons per bill', 'How many coupons one bill may accept.', 40, false, 'SYSTEM'),

('coupon.scan_only', 'SALES', 'Coupons', 'BOOL', 'false',
 NULL, NULL, NULL, 'DEVICE',
 'Coupon must be scanned', 'Codes must be scanned at this device, not typed.', 50, false, 'SYSTEM')

ON CONFLICT (asd_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
--  Comments.
--
--  These say what is TRUE of this database. Where the design note's comments
--  said "Trigger-maintained" they now name the service that does the
--  recompute — no trigger is created here, and a COMMENT claiming one would
--  send the next person hunting for something that does not exist.
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE sales.loyalty_coupon_batch IS
    'What a coupon of this kind is worth and how it behaves. SOLD = a gift voucher the customer bought (may be reloadable); CAMPAIGN = codes issued in bulk.';
COMMENT ON COLUMN sales.loyalty_coupon_batch.lcb_issued_count IS
    'Cache of loyalty_coupon, recomputed by LoyaltyCouponService.recomputeCouponBatches(). There is no trigger; never write this from any other code. The issue cap is enforced by the service at issue, not here — a recompute reports, it does not refuse.';
COMMENT ON COLUMN sales.loyalty_coupon_batch.lcb_percent IS
    'A percentage coupon still settles as a rupee tender line: the percentage resolves against the bill at redemption and only the resolved amount reaches acc_tender_detail.';

COMMENT ON TABLE sales.loyalty_coupon IS
    'One issued coupon. Never partitioned and never carried forward — a voucher issued in one financial year and spent in another is the same row throughout.';
COMMENT ON COLUMN sales.loyalty_coupon.lcp_face_value IS
    'Snapshot taken at issue. Re-pricing the batch must never re-price cards already in circulation. Must be positive, so an uncapped PERCENT batch cannot issue one — give such a batch an lcb_max_value and use it as the face.';
COMMENT ON COLUMN sales.loyalty_coupon.lcp_issue_amount IS
    'What was actually paid for it. 0 for a giveaway, face value for a sold card. Breakage reporting has no other source.';
COMMENT ON COLUMN sales.loyalty_coupon.lcp_balance_value IS
    'GENERATED: face + topup - used. A whole-row INSERT must omit this column.';
COMMENT ON COLUMN sales.loyalty_coupon.lcp_status IS
    'Deliberately NOT generated. ISSUED/PARTIAL/REDEEMED are arithmetic and are maintained by LoyaltyCouponService.recomputeCoupons(); EXPIRED/CANCELLED/BLOCKED are decisions and are set only by the admin path or couponExpiryRun(). Writing a decision from a recompute is how a cancelled voucher silently comes back to life.';
COMMENT ON COLUMN sales.loyalty_coupon.lcp_used_value IS
    'Cache of loyalty_coupon_txn, recomputed by LoyaltyCouponService.recomputeCoupons(). There is no trigger; never write this from any other code.';
COMMENT ON COLUMN sales.loyalty_coupon.lcp_last_used_on IS
    'MAX(lct_txn_date) over this coupon''s movements. Recomputed with the value buckets.';

COMMENT ON TABLE sales.loyalty_coupon_txn IS
    'One movement against one coupon, partitioned by the year of the movement. Signed; a reversal repeats its type with the opposite sign and names the row it undoes.';
COMMENT ON COLUMN sales.loyalty_coupon_txn.lct_amount IS
    'POSITIVE for a spend, and the TYPE carries the direction — the OPPOSITE of sales.loyalty_ledger.lld_points, where a spend is negative. The two live in one schema; do not copy one recompute into the other.';


-- ───────────────────────────────────────────────────────────────────────────
--  Partitions.
--
--  public.ensure_acc_year_partitions is the one place that knows which tables
--  are partitioned by acc_year; it carries an explicit list rather than
--  scanning the catalogue. A partitioned table not in the list is silently
--  skipped when a fiscal year is opened and fails at the first insert of the
--  new year.
--
--  Re-stated in full (CREATE OR REPLACE) because that is how every earlier
--  migration has extended it; the body below is 20260921140000's, plus one
--  EXECUTE for loyalty_coupon_txn.
--
--  loyalty_coupon_batch and loyalty_coupon are deliberately plain tables and
--  take no partitions.
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
    --  The loyalty POINTS engine's three. Header before detail: fk_lgd_header.
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
    --  Coupon movements. A voucher presented on April 1st writes here, so a
    --  missing partition refuses the tender at the counter.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_coupon_txn FOR VALUES IN (%L)',
        'loyalty_coupon_txn_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

-- Catch the new table up with the years that already have partitions, rather
-- than naming a hard-coded list that may not be the one this database uses.
DO $backfill$
DECLARE
    v_year text;
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
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_coupon_txn FOR VALUES IN (%L)',
            'loyalty_coupon_txn_' || replace(v_year, '-', '_'), v_year);
        RAISE NOTICE 'loyalty_coupon_txn partition ensured for %', v_year;
    END LOOP;
END
$backfill$;


-- ═══════════════════════════════════════════════════════════════════════════
--  NO FUNCTIONS AND NO TRIGGERS IN THIS MIGRATION EITHER.
--
--  Same reason as the points engine, and it is the offline app: a trigger
--  fires on the SERVER during a cloud push, in a language this team does not
--  debug, per statement of a sync batch, whether the service wanted it or not.
--  Balance maintenance belongs with everything else that touches these tables.
--
--  One GENERATED column here, filled by Postgres from plain columns the
--  service writes, with no trigger involved:
--
--    loyalty_coupon.lcp_balance_value
--        = lcp_face_value + lcp_topup_value - lcp_used_value
--
--  It may not be written by a sync push — leave it out of the column list.
--
--  ── recomputeCoupons(tx, couponIds[]) ────────────────────────────────────
--  Per voucher, from sales.loyalty_coupon_txn where lct_lcp_id = id AND
--  lct_is_deleted = false:
--      lcp_used_value   = SUM(lct_amount) WHERE type IN ('REDEEM','EXPIRE','CANCEL')
--      lcp_topup_value  = SUM(lct_amount) WHERE type = 'TOPUP'
--      lcp_use_count    = COUNT(*)        WHERE type = 'REDEEM' AND lct_amount > 0
--      lcp_last_used_on = MAX(lct_txn_date)
--  A coupon movement is an AMOUNT and the TYPE carries the sign, so these are
--  plain sums — unlike the points ledger, where a spend is negative. A
--  reversal is the same type with the opposite sign, so it nets out of the
--  sum with no special case.
--
--  It must NOT set lcp_status. ISSUED / PARTIAL / REDEEMED are arithmetic and
--  this recompute owns them; EXPIRED / CANCELLED / BLOCKED are DECISIONS and
--  belong to the admin path and couponExpiryRun(). Writing a decision from a
--  recompute is how a cancelled voucher silently comes back to life.
--
--  A coupon whose every movement was deleted gets ZEROES, not "left alone": a
--  GROUP BY returns no row for it, and that is the one way this recompute can
--  silently leave a stale balance behind.
--
--  ── recomputeCouponBatches(tx, batchIds[]) ───────────────────────────────
--  Per batch, over sales.loyalty_coupon where lcp_lcb_id = id AND NOT deleted:
--      lcb_issued_count   = COUNT(*)
--      lcb_redeemed_count = COUNT(*) WHERE lcp_status = 'REDEEMED'
--  The issue cap (lcb_max_issue_count) is checked by the service when it
--  issues, not here — a recompute reports, it does not refuse. Two tills
--  offline can both issue the last voucher of a batch, and the second push
--  must be recorded; ix_lcb_overdrawn finds the result.
--
--  ORDER: vouchers first, then batches. lcb_redeemed_count counts vouchers by
--  STATUS, so a batch re-counted before its vouchers are re-summed counts a
--  status that is about to change.
--
--  ── THE SAME ONE RULE AS THE POINTS ENGINE ───────────────────────────────
--
--  ONE private method on the service is the only code anywhere that writes
--  sales.loyalty_coupon_txn; it writes the rows, then recomputes the touched
--  vouchers and then their batches, before returning. Same for the method that
--  writes sales.loyalty_coupon. Arrays, one UPDATE per set, because a sync
--  push is many rows at once.
--
--  What stays here: the GENERATED column, the CHECKs, the unique indexes, the
--  foreign keys, and ix_lcp_overdrawn / ix_lcb_overdrawn. No code.
--
--  ── Lapsing, also the service's ──────────────────────────────────────────
--
--  couponExpiryRun(companyId, accYear, on = today, createdBy = 'SYSTEM')
--  → number of vouchers swept. An expiry is a CLOCK event and a clock is not
--  a row change, which is why it was never a trigger.
--
--   1  runId := md5(companyId || '|coupon|' || on)::uuid — DETERMINISTIC, and
--      note the '|coupon|' segment: it must NOT collide with the points run's
--      md5(companyId || '|' || on). A re-run on the same date is then caught
--      by ux_lct_src_row rather than quietly writing a second set of
--      movements.
--   2  select the lapsed vouchers:
--        lcp_is_deleted = false
--        AND lcp_balance_value > 0
--        AND lcp_valid_upto IS NOT NULL AND lcp_valid_upto < on
--        AND lcp_status IN ('ISSUED','PARTIAL')
--      ORDER BY lcp_valid_upto, lcp_id.
--   3  per voucher, INSERT one sales.loyalty_coupon_txn row:
--        lct_txn_type   = 'EXPIRE'
--        lct_row_no     = 1                  (one movement per voucher)
--        lct_amount     = lcp_balance_value  (POSITIVE — a coupon movement is
--                                             an amount and the type carries
--                                             the sign; this is NOT the points
--                                             ledger, where a spend is
--                                             negative)
--        lct_txn_date   = on
--        lct_branch_id  = lcp_branch_id, falling back to the batch's
--                         lcb_branch_id when the voucher has none. It is NOT
--                         NULL here, so a voucher and a batch that are both
--                         branch-less need a deliberate choice rather than a
--                         null.
--        lct_lcp_id / lct_lcb_id / lct_cust_id / lct_member_id from the row
--        lct_src_module 'SALES', lct_src_doc_type 'EXPIRY_RUN',
--        lct_src_doc_id = runId, lct_src_acc_year = accYear,
--        lct_remarks 'Lapsed on <on>'
--   4  then recomputeCoupons() for that voucher, and only after that UPDATE
--      sales.loyalty_coupon SET lcp_status = 'EXPIRED', lcp_modified_on = now().
--      The movement first, the recompute second, the status last: the balance
--      comes from the movement and the status is the decision laid on top of
--      it.
--   5  recomputeCouponBatches() for the batches touched, then return the count.
--
--  Idempotent twice over, and both halves must survive the port: a swept
--  voucher has a zero balance AND a status that is no longer ISSUED or
--  PARTIAL, so it is not selected again; and the deterministic runId makes a
--  same-day re-run collide rather than duplicate.
--
--  Nothing here creates sales.fn_lcp_expire or sales.fn_lcp_recompute as
--  database functions. If a scratch database still holds either from an
--  earlier draft, drop it by hand.
-- ═══════════════════════════════════════════════════════════════════════════
