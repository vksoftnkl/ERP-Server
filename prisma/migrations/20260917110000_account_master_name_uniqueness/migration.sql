-- ═══════════════════════════════════════════════════════════════════════════
--  §1.2 — ledger and group names, unique within what one company can SEE
--
--  ── THIS IS NOT A REQUEST TO SCOPE company_id ───────────────────────────
--  NULL means SHARED BY EVERY COMPANY and it is deliberate: one customer
--  billed in four companies is one ledger. 50 of 61 ledgers are shared, 11 are
--  scoped, and all 48 groups are shared. Both modes stay.
--
--  ── WHY THE EXISTING UNIQUE DOES NOTHING ────────────────────────────────
--  UNIQUE (led_company_id, led_name) is INERT for shared rows, because
--  Postgres treats NULLs as distinct — two shared ledgers named the same thing
--  both fit. And it says nothing at all about a scoped row colliding with a
--  shared one. acc_group_master has no name uniqueness index whatsoever; only
--  the pkey, parent_id, company_id and tally_guid.
--
--  ── WHY IT BITES THE TALLY EXPORT SPECIFICALLY ──────────────────────────
--  A Tally company is its own file, so exporting company X emits the SHARED
--  masters plus X's own into one file. Tally merges two <LEDGER> entries with
--  the same NAME into one and combines their balances, silently. lower() here
--  is not fastidiousness: Tally matches master names case-insensitively, so
--  'VAPI Battery' and 'VAPI BATTERY' are one ledger there and must be one here.
--
--  ── THREE RULES, AND AN INDEX EXPRESSES ONLY TWO ────────────────────────
--    1 · no two SHARED rows share a name                    -> partial index
--    2 · no two rows in the SAME company share a name       -> partial index
--    3 · a company-scoped row must not collide with a SHARED one
--        -> BEFORE INSERT OR UPDATE trigger. No index can say "must not match
--           a row in the OTHER scope".
--
--  ── THE ONE LIVE VIOLATION IS LEFT STANDING, ON PURPOSE ─────────────────
--  'VAPI BATTERY & AUTO ELECTRICALS' exists twice: shared
--  (01a0a4c8-5f63-7e4b-a825-4ad402e2c84f, group Suppliers) and scoped to Acme
--  Foods (01a0a4c7-77de-7d0b-91bc-510a244c796e, group MUSIRI). The same trade
--  partner is both a customer and a supplier, so it got two ledgers in two
--  scopes. That is rule 3, and rule 3 is a TRIGGER, which fires on writes and
--  not on rows already sitting there — so nothing here fails, and the pair
--  survives until someone decides what a dual customer+supplier party should be
--  called (Tally's own convention is one ledger under Sundry Debtors settled
--  bill-wise, or two named 'X' and 'X (Supplier)'). That decision changes a
--  backfill, not this file.
--
--  The trigger deliberately re-checks ONLY when the name, the scope or the
--  deleted flag actually changes. Editing the VAPI pair's address still works;
--  renaming either row into a fresh collision does not. Undeleting is checked,
--  because an undelete can resurrect a name someone else has since taken.
--
--  Verified against localhost/ERP before writing: zero rule-1 violations, zero
--  rule-2 violations and exactly one rule-3 pair (the VAPI ledgers) on both
--  tables, so both indexes build without error on today's data.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · Rules 1 and 2 — accounts.acc_ledger_master
--
--  Soft-deleted rows are excluded from both. A name a deleted ledger once held
--  has to be reusable, or every mistyped master would burn its name forever.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uq_led_name_shared
    ON accounts.acc_ledger_master (lower(led_name))
 WHERE led_company_id IS NULL AND NOT led_is_deleted;

CREATE UNIQUE INDEX IF NOT EXISTS uq_led_name_company
    ON accounts.acc_ledger_master (led_company_id, lower(led_name))
 WHERE led_company_id IS NOT NULL AND NOT led_is_deleted;


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · Rules 1 and 2 — accounts.acc_group_master
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_group_name_shared
    ON accounts.acc_group_master (lower(acc_group_name))
 WHERE acc_group_company_id IS NULL AND NOT acc_group_is_deleted;

CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_group_name_company
    ON accounts.acc_group_master (acc_group_company_id, lower(acc_group_name))
 WHERE acc_group_company_id IS NOT NULL AND NOT acc_group_is_deleted;


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · Rule 3 — the cross-scope guard
--
--  ERRCODE 23505 on purpose: Prisma maps it to P2002, which the account-ledger
--  and account-group exception filters already turn into a 409 naming the field
--  — the same answer the service's own pre-check gives. A bespoke SQLSTATE
--  would surface as an opaque 500, which is the failure mode this whole
--  document is trying to remove.
--
--  The service checks all three rules BEFORE writing (ensureNameIsUnique), so
--  in practice this fires only for writes that bypass Nest: seeds, Tally
--  imports, psql. That is exactly the traffic that produced the mess §1.1 had
--  to clean up.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION accounts.fn_led_name_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clash_id   uuid;
  v_clash_side text;
BEGIN
  IF NEW.led_is_deleted THEN
    RETURN NEW;
  END IF;

  -- Nothing about the NAME, the SCOPE or the deleted flag moved: whatever was
  -- true a moment ago is still true. This is what grandfathers the legacy
  -- cross-scope pair through ordinary edits.
  IF TG_OP = 'UPDATE'
     AND NEW.led_name       IS NOT DISTINCT FROM OLD.led_name
     AND NEW.led_company_id IS NOT DISTINCT FROM OLD.led_company_id
     AND NEW.led_is_deleted IS NOT DISTINCT FROM OLD.led_is_deleted THEN
    RETURN NEW;
  END IF;

  IF NEW.led_company_id IS NULL THEN
    v_clash_side := 'a company-scoped';
    SELECT l.led_id INTO v_clash_id
      FROM accounts.acc_ledger_master l
     WHERE l.led_company_id IS NOT NULL
       AND NOT l.led_is_deleted
       AND l.led_id <> NEW.led_id
       AND lower(l.led_name) = lower(NEW.led_name)
     LIMIT 1;
  ELSE
    v_clash_side := 'a shared';
    SELECT l.led_id INTO v_clash_id
      FROM accounts.acc_ledger_master l
     WHERE l.led_company_id IS NULL
       AND NOT l.led_is_deleted
       AND l.led_id <> NEW.led_id
       AND lower(l.led_name) = lower(NEW.led_name)
     LIMIT 1;
  END IF;

  IF v_clash_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Ledger name "%" already belongs to % ledger (%); one company would see both',
      NEW.led_name, v_clash_side, v_clash_id
      USING ERRCODE = '23505', CONSTRAINT = 'uq_led_name_shared';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_led_name_scope ON accounts.acc_ledger_master;
CREATE TRIGGER tr_led_name_scope
    BEFORE INSERT OR UPDATE OF led_name, led_company_id, led_is_deleted
    ON accounts.acc_ledger_master
    FOR EACH ROW
    EXECUTE FUNCTION accounts.fn_led_name_scope_guard();


CREATE OR REPLACE FUNCTION accounts.fn_acc_group_name_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clash_id   uuid;
  v_clash_side text;
BEGIN
  IF NEW.acc_group_is_deleted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.acc_group_name       IS NOT DISTINCT FROM OLD.acc_group_name
     AND NEW.acc_group_company_id IS NOT DISTINCT FROM OLD.acc_group_company_id
     AND NEW.acc_group_is_deleted IS NOT DISTINCT FROM OLD.acc_group_is_deleted THEN
    RETURN NEW;
  END IF;

  IF NEW.acc_group_company_id IS NULL THEN
    v_clash_side := 'a company-scoped';
    SELECT g.acc_group_id INTO v_clash_id
      FROM accounts.acc_group_master g
     WHERE g.acc_group_company_id IS NOT NULL
       AND NOT g.acc_group_is_deleted
       AND g.acc_group_id <> NEW.acc_group_id
       AND lower(g.acc_group_name) = lower(NEW.acc_group_name)
     LIMIT 1;
  ELSE
    v_clash_side := 'a shared';
    SELECT g.acc_group_id INTO v_clash_id
      FROM accounts.acc_group_master g
     WHERE g.acc_group_company_id IS NULL
       AND NOT g.acc_group_is_deleted
       AND g.acc_group_id <> NEW.acc_group_id
       AND lower(g.acc_group_name) = lower(NEW.acc_group_name)
     LIMIT 1;
  END IF;

  IF v_clash_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Account group name "%" already belongs to % group (%); one company would see both',
      NEW.acc_group_name, v_clash_side, v_clash_id
      USING ERRCODE = '23505', CONSTRAINT = 'uq_acc_group_name_shared';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_acc_group_name_scope ON accounts.acc_group_master;
CREATE TRIGGER tr_acc_group_name_scope
    BEFORE INSERT OR UPDATE OF acc_group_name, acc_group_company_id, acc_group_is_deleted
    ON accounts.acc_group_master
    FOR EACH ROW
    EXECUTE FUNCTION accounts.fn_acc_group_name_scope_guard();
