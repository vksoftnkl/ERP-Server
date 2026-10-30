-- ═══════════════════════════════════════════════════════════════════════════
--  Opening balances — schema prerequisites
--
--  Everything the opening-balance screen needs that the database does not yet
--  have. Nothing here posts, reads or carries anything forward: it is the
--  ground the service is built on, so that the service can be written against
--  a schema that already refuses the rows it must never hold.
--
--  Source: "Opening balances — schema gaps and plan corrections (2026-09-14)",
--  sections 2.1, 2.2, 2.5, 3.1, 3.3 and 3.4. Each block below names its
--  section. Two things that document asks for are deliberately NOT here and
--  are called out where they would have gone (3.2's CHECK, and the DECISION 5
--  stale-flag constraint).
--
--  accounts.acc_opening_balance holds 0 rows today, so every ALTER is free:
--  no back-fill, no NOT VALID, no lock worth planning around.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  §2.1 — the three foreign keys
--
--  The table shipped with a primary key, four CHECKs and no referential
--  integrity at all: op_ledger_id, op_company_id and op_branch_id referenced
--  nothing. An opening for a ledger that does not exist was accepted in
--  silence, and a ledger that HAD an opening could be hard-deleted out from
--  under it. acc_bill_balance has had fk_abl_party since it was created; this
--  is the same rule applied to the table beside it.
--
--  A partitioned table may carry a foreign key to a non-partitioned one
--  (PG 12+), and each partition inherits it — including partitions
--  public.ensure_acc_year_partitions() creates later.
--
--  ON DELETE RESTRICT, not CASCADE: an opening balance is an accounting
--  record. Deleting a ledger must fail loudly while an opening names it,
--  rather than quietly taking the opening with it.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_opening_balance
    ADD CONSTRAINT fk_op_ledger FOREIGN KEY (op_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_opening_balance
    ADD CONSTRAINT fk_op_company FOREIGN KEY (op_company_id)
        REFERENCES public.companys (comp_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_opening_balance
    ADD CONSTRAINT fk_op_branch FOREIGN KEY (op_branch_id)
        REFERENCES public.branch_master (br_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;


-- ───────────────────────────────────────────────────────────────────────────
--  §2.2 — op_tenant_id
--
--  Every other partitioned accounts table carries one — abl_, abj_, apd_,
--  td_, avh_, av_tenant_id — and this was the only one without, so whatever
--  tenant scoping is applied elsewhere could not be applied here.
--
--  Nullable and unconstrained, exactly like abl_tenant_id: there is no tenant
--  table in this database yet, so there is nothing to point a foreign key at.
--  The column exists so that the day there is one, this table is not the
--  exception that needs a migration of its own.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_opening_balance
    ADD COLUMN IF NOT EXISTS op_tenant_id uuid;

COMMENT ON COLUMN accounts.acc_opening_balance.op_tenant_id IS
    'Reserved for multi-tenancy, mirroring abl_tenant_id. No FK: there is no tenant table yet.';


-- ───────────────────────────────────────────────────────────────────────────
--  §2.5 — why an opening went stale, not just that it did
--
--  op_is_stale / op_stale_since record THAT and WHEN. The screen could
--  therefore say "stale" and nothing more, when the only question an
--  accountant actually asks is "stale because of what?".
--
--  op_stale_ref_id + op_stale_ref_acc_year name the row that invalidated it —
--  a voucher, usually. The pair is deliberately NOT a foreign key:
--  acc_vouchers is partitioned on its own accounting year, the reference is
--  diagnostic rather than structural, and a stale marker must survive the
--  cancellation of the very document that caused it. ck_op_stale_ref keeps
--  the pair honest instead, the same shape as ck_abl_src_doc.
--
--  NOT added here: a constraint forcing a not-stale row to carry no stale
--  detail. What sets and clears op_is_stale is DECISION 5 and still open —
--  writing the clear-semantics into a CHECK now would decide it by accident.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_opening_balance
    ADD COLUMN IF NOT EXISTS op_stale_reason       varchar(30),
    ADD COLUMN IF NOT EXISTS op_stale_ref_id       uuid,
    ADD COLUMN IF NOT EXISTS op_stale_ref_acc_year char(9);

ALTER TABLE accounts.acc_opening_balance
    ADD CONSTRAINT ck_op_stale_reason CHECK (
        op_stale_reason IS NULL
        OR op_stale_reason IN (
            'VOUCHER_POSTED',       -- a voucher landed in the source year
            'VOUCHER_CANCELLED',    -- one that had been counted was reversed
            'SOURCE_OPENING_EDITED',-- the previous year's own opening changed
            'YEAR_REOPENED',        -- the source year came back from CLOSED
            'MANUAL'                -- an operator marked it by hand
        ));

ALTER TABLE accounts.acc_opening_balance
    ADD CONSTRAINT ck_op_stale_ref CHECK (
        (op_stale_ref_id IS NULL AND op_stale_ref_acc_year IS NULL)
        OR (op_stale_ref_id IS NOT NULL AND op_stale_ref_acc_year IS NOT NULL));

ALTER TABLE accounts.acc_opening_balance
    ADD CONSTRAINT ck_op_stale_ref_acc_year CHECK (
        op_stale_ref_acc_year IS NULL
        OR op_stale_ref_acc_year ~ '^[0-9]{4}-[0-9]{4}$');

COMMENT ON COLUMN accounts.acc_opening_balance.op_stale_reason IS
    'Why this opening went stale (ck_op_stale_reason). Companion to op_is_stale / op_stale_since.';
COMMENT ON COLUMN accounts.acc_opening_balance.op_stale_ref_id IS
    'The row that invalidated this opening — usually a voucher. Not a FK: the reference is diagnostic and must outlive its target.';


-- ───────────────────────────────────────────────────────────────────────────
--  §3.1 — the two system ledgers, found by role
--
--  The flow needs two ledgers it cannot name: the plug row's "Difference in
--  Opening Balances", and the "Profit & Loss A/c" that carry-forward writes
--  the year's result into. Nothing on acc_ledger_master marks either —
--  acc_group_master has acc_group_is_reserved, the ledger has no equivalent,
--  and led_category holds only GENERAL or NULL.
--
--  No new mechanism is needed: this is exactly what acc_ledger_role +
--  acc_ledger_map already do for ROUND_OFF, and the resolver in
--  ledger-map.helper.ts takes a role as a plain string, so it answers for
--  these two the moment the rows exist. No TypeScript changes.
--
--  CORRECTION to the source document, whose INSERT would have failed:
--  alr_group is NOT NULL and constrained by ck_alr_group. Both roles are
--  SHARED — one answer for the business, never per GST rate — which is where
--  ROUND_OFF, WRITE_OFF and ADVANCE_RECEIVED already sit. Sort orders
--  continue that block at 250 and 260.
--
--  alr_want_nature = 'Liabilities' is right for both, and checked: the three
--  groups these ledgers can live under — Suspense A/c, Capital Account,
--  Reserves & Surplus — are all Liabilities / BALANCESHEET today.
--  alr_want_type is left NULL because neither role needs a particular
--  led_ledger_type; GENERAL is the honest answer and the catalogue treats
--  NULL as "not checked on this axis".
--
--  by_supply / by_rate are both false: an opening difference has no supply
--  nature and no GST rate.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO accounts.acc_ledger_role
    (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty,
     alr_want_nature, alr_by_supply, alr_by_rate, alr_sort_order, alr_remarks)
VALUES
  ('OPENING_DIFFERENCE', 'Difference in opening balances', 'SHARED',
   NULL, NULL, 'Liabilities', false, false, 250,
   'The plug row. Where the unmatched side of a manually entered opening trial balance lands.'),

  ('RETAINED_EARNINGS',  'Profit & Loss / retained earnings', 'SHARED',
   NULL, NULL, 'Liabilities', false, false, 260,
   'Where the previous year''s P&L result is carried into the new year''s opening balances.')
ON CONFLICT (alr_role) DO NOTHING;


-- ───────────────────────────────────────────────────────────────────────────
--  §3.2 — account group nature, inherited down the chain
--
--  Five ledgers are "unclassified" because eight groups carry no nature, and
--  the source document blamed missing inheritance. That is not the cause
--  here: acc-group-master.service.ts already copies the parent's nature on
--  create and mirrors it on update, and a parent is mandatory through the
--  API. Reading the eight rows says what really happened — 'Corporate
--  Accounts' and 'Office accounts' are ROOT groups with no nature, inserted
--  outside the API, and the other six correctly inherited NULL from them.
--
--  So the gap the trigger closes is the one the app layer cannot: rows that
--  arrive by direct SQL — seeds, Tally imports, fixes typed into psql — which
--  is precisely how those eight got in. It walks the parent chain rather than
--  reading the immediate parent only, so a child of a NULL-natured group
--  still finds the nature of whatever ancestor has one.
--
--  It fills in, and never overrides: a nature given explicitly is kept.
--
--  NOT added: the ck_acc_group_nature CHECK the document also asks for.
--  Migration 20260623100000_remove_acc_group_check_constraints_to_app_layer
--  deliberately DROPPED that exact constraint and moved the vocabulary to
--  AccGroupMasterNature in acc-group-master-enum.ts, which holds the same
--  four values. Re-adding it would reverse a recorded decision and turn a
--  clean 400 from the module's exception filter into an opaque 500.
--
--  The two NULL-natured roots are left alone: with no ancestor to inherit
--  from, no migration can know whether they are Assets or Liabilities. That
--  is a data question for whoever owns the chart of accounts.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accounts.fn_acc_group_inherit_nature()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_nature varchar(20);
    v_parent uuid := NEW.acc_group_parent_id;
    v_hops   int  := 0;
BEGIN
    -- Given explicitly, or nothing to inherit from: leave it exactly as it is.
    IF NEW.acc_group_nature IS NOT NULL OR v_parent IS NULL THEN
        RETURN NEW;
    END IF;

    -- Walk up until an ancestor has a nature. The hop cap is a cycle guard:
    -- acc_group_parent_id is a self-reference with no constraint preventing a
    -- loop, and a trigger must not be the thing that hangs an INSERT.
    WHILE v_parent IS NOT NULL AND v_hops < 32 LOOP
        SELECT acc_group_nature, acc_group_parent_id
          INTO v_nature, v_parent
          FROM accounts.acc_group_master
         WHERE acc_group_id = v_parent;

        EXIT WHEN v_nature IS NOT NULL;
        v_hops := v_hops + 1;
    END LOOP;

    NEW.acc_group_nature := v_nature;   -- still NULL if no ancestor had one
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION accounts.fn_acc_group_inherit_nature() IS
    'Fills acc_group_nature from the nearest ancestor that has one, for inserts that bypass the app layer. Never overrides a nature given explicitly.';

DROP TRIGGER IF EXISTS tr_acc_group_inherit_nature ON accounts.acc_group_master;

CREATE TRIGGER tr_acc_group_inherit_nature
    BEFORE INSERT ON accounts.acc_group_master
    FOR EACH ROW
    EXECUTE FUNCTION accounts.fn_acc_group_inherit_nature();


-- ───────────────────────────────────────────────────────────────────────────
--  §3.3 — fiscal_years
--
--  CORRECTION to the source document, which was read against 192.168.0.106.
--  Two of the three objects it asks for already exist here, in a BETTER form
--  than it proposes — both are soft-delete aware, which its versions are not:
--
--    uq_fiscal_years_comp_name  UNIQUE (comp_id, fy_year_name) WHERE NOT deleted
--    uq_fiscal_years_current    UNIQUE (comp_id) WHERE fy_is_current AND NOT deleted
--
--  Creating ux_fy_company_year on top of them would add a second index over
--  the same columns, so it is not created. If 192.168.0.106 is genuinely
--  missing them, it has drifted from this migration history and should be
--  brought back to it rather than patched sideways.
--
--  Only fy_status was truly unconstrained — free text, where carry-forward
--  needs to trust 'CLOSED'. The vocabulary is the fragment's three, not the
--  document's two: fy_lock_date exists and LOCKED is a real state in
--  fiscalYear.prisma. Live data uses only OPEN and CLOSED, so this validates
--  on the spot.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fiscal_years
    ADD CONSTRAINT ck_fy_status CHECK (fy_status IN ('OPEN', 'CLOSED', 'LOCKED'));


-- ───────────────────────────────────────────────────────────────────────────
--  §3.4 — the carry-forward run log (DECISION 11: keep the history)
--
--  fy_is_carried_forward / fy_carried_forward_at / fy_prev_fy_id record that
--  a carry-forward happened and when — once. A regenerate overwrites the
--  timestamp, and the numbers that actually tell you whether the run was
--  sound — how many rows it created, how many manual openings it stepped
--  around, the Dr and Cr totals and the difference between them — are
--  returned to the caller and then gone.
--
--  One row per run, never updated. Deliberately NOT partitioned: it is keyed
--  by the two years it spans rather than living inside one of them, and it
--  grows by a handful of rows a year.
--
--  aor_difference is generated, not stored by the caller: the one number
--  everybody reads off this table is the one nobody should be able to write
--  incorrectly.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_opening_run
(
    aor_id               uuid          NOT NULL DEFAULT uuidv7(),

    aor_company_id       uuid          NOT NULL,
    -- NULL = the run covered the company as a whole, matching op_branch_id.
    aor_branch_id        uuid,

    aor_from_acc_year    char(9)       NOT NULL,
    aor_to_acc_year      char(9)       NOT NULL,

    aor_run_at           timestamptz(6) NOT NULL DEFAULT now(),
    aor_run_by           varchar(50),

    -- What the run did.
    aor_created          integer       NOT NULL DEFAULT 0,
    aor_updated          integer       NOT NULL DEFAULT 0,
    aor_skipped_manual   integer       NOT NULL DEFAULT 0,

    -- What it produced. Dr and Cr should agree; aor_difference says by how
    -- much they did not.
    aor_total_debit      numeric(18,2) NOT NULL DEFAULT 0,
    aor_total_credit     numeric(18,2) NOT NULL DEFAULT 0,
    -- NOT NULL is explicit: a generated column is nullable by default, but
    -- both operands are NOT NULL so this one never can be.
    aor_difference       numeric(18,2) NOT NULL GENERATED ALWAYS AS
                             (aor_total_debit - aor_total_credit) STORED,

    -- Whether this run was allowed to overwrite MANUAL openings. The single
    -- most important thing to know about a run after the fact.
    aor_overwrite_manual boolean       NOT NULL DEFAULT false,

    aor_remarks          varchar(500),

    CONSTRAINT pk_acc_opening_run PRIMARY KEY (aor_id),

    CONSTRAINT fk_aor_company FOREIGN KEY (aor_company_id)
        REFERENCES public.companys (comp_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_aor_branch FOREIGN KEY (aor_branch_id)
        REFERENCES public.branch_master (br_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    -- Same year shape acc_opening_balance enforces, and the same rule: the
    -- second half is the first plus one.
    CONSTRAINT ck_aor_from_acc_year CHECK (
        aor_from_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND right(aor_from_acc_year, 4)::int = left(aor_from_acc_year, 4)::int + 1),
    CONSTRAINT ck_aor_to_acc_year CHECK (
        aor_to_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND right(aor_to_acc_year, 4)::int = left(aor_to_acc_year, 4)::int + 1),
    -- A carry-forward moves strictly forward, and the years must differ.
    CONSTRAINT ck_aor_year_order CHECK (
        left(aor_to_acc_year, 4)::int > left(aor_from_acc_year, 4)::int),

    CONSTRAINT ck_aor_counts CHECK (
        aor_created >= 0 AND aor_updated >= 0 AND aor_skipped_manual >= 0),
    CONSTRAINT ck_aor_totals CHECK (
        aor_total_debit >= 0 AND aor_total_credit >= 0)
);

ALTER TABLE IF EXISTS accounts.acc_opening_run OWNER to postgres;

-- The screen's question: "when was this year last carried forward, and what
-- happened?" — newest first, for one company and target year.
CREATE INDEX IF NOT EXISTS ix_aor_target
    ON accounts.acc_opening_run (aor_company_id, aor_to_acc_year, aor_run_at DESC);

COMMENT ON TABLE accounts.acc_opening_run IS
    'One row per carry-forward run, never updated. The history that fy_is_carried_forward / fy_carried_forward_at overwrite.';
COMMENT ON COLUMN accounts.acc_opening_run.aor_skipped_manual IS
    'Openings left alone because op_source was MANUAL or MIGRATION — owned by a human.';
COMMENT ON COLUMN accounts.acc_opening_run.aor_difference IS
    'Generated: debit minus credit. Non-zero means the carried trial balance did not agree.';
