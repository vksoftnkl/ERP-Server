-- ═══════════════════════════════════════════════════════════════════════════
--  §2.4 — install the voucher-totals trigger this database never received
--
--  ── What happened, and it is NOT a partial execution ────────────────────
--  20260915120000_receipt_voucher_prerequisites was APPLIED to this database
--  at 16:43 on 2026-09-15. The file was then EDITED at 16:59 to append its
--  section 11 — the totals trigger. Prisma has the migration recorded as
--  applied and will never run text added to it afterwards, so the database
--  simply never saw that section. Nothing half-executed and nothing rolled
--  forward; do not go looking for a partial-apply bug, there isn't one.
--
--  This is documented in the repo already, and the note is worth reading:
--  20260915130000_receipt_ledger_roles_and_map lines 17-24 explain why THAT
--  migration exists for the same reason, and its lines 123-130 name this
--  trigger specifically as still absent for the same cause.
--
--  So what is missing here is exactly section 11 of that file:
--
--              · accounts.fn_avh_refresh_totals()
--              · accounts.fn_avh_recompute_totals(uuid, char)
--              · TRIGGER tr_av_refresh_totals ON accounts.acc_vouchers
--              · the back-fill, and the two column comments
--
--  reproduced below verbatim, so there is ONE definition of the arithmetic.
--
--  ── Why it matters, measured rather than argued ─────────────────────────
--  Measured on 2026-09-17: 39 POSTED vouchers hold live legs and read
--  avh_total_debit = 0, avh_total_credit = 0. So
--
--      ck_avh_balanced: CHECK (status <> 'POSTED' OR debit = credit)
--
--  has been comparing 0 with 0 on every posted voucher in this database and
--  passing. Verified as ACCEPTED in a rolled-back transaction: stripping one
--  leg of a POSTED voucher, and stripping all of them.
--
--  ── Why this is safe to run ─────────────────────────────────────────────
--  Checked before writing this file: of the 39 POSTED vouchers with legs,
--  ZERO have DR <> CR. Every one already balances by its legs, so the
--  back-fill moves them from 0/0 to their true figures and ck_avh_balanced
--  refuses nothing. The trigger protects the table from the next leg written.
--
--  ── Why a new migration and not a re-run ────────────────────────────────
--  Prisma will not replay a migration it has recorded as applied, and editing
--  an applied migration's checksum is worse than the disease — it is what
--  produced this situation. A new file is the only way a delta reaches a
--  database that has already run the original.
--
--  Everything here is idempotent (CREATE OR REPLACE, DROP TRIGGER IF EXISTS),
--  so on a FRESH database — where 120000 now carries section 11 and runs it —
--  this file is a harmless no-op, and on this one it is the repair.
--
--  ── The lesson, recorded because it has now happened twice ──────────────
--  Never edit a migration that has been applied anywhere. The added text runs
--  on fresh databases and silently never runs on existing ones, which is the
--  worst of both: the file says the object exists, every environment that ran
--  it before the edit disagrees, and nothing reports the difference. The delta
--  belongs in a new migration. `prisma migrate status` will not tell you —
--  read the objects back.
-- ═══════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION accounts.fn_avh_refresh_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_id   uuid;
    v_year char(9);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_id := OLD.av_voucher_id;
        v_year := OLD.av_acc_year;
    ELSE
        v_id := NEW.av_voucher_id;
        v_year := NEW.av_acc_year;
    END IF;

    PERFORM accounts.fn_avh_recompute_totals(v_id, v_year);

    --  A leg that changed voucher leaves the one it LEFT overstated.
    IF TG_OP = 'UPDATE'
       AND (NEW.av_voucher_id, NEW.av_acc_year)
           IS DISTINCT FROM (OLD.av_voucher_id, OLD.av_acc_year) THEN
        PERFORM accounts.fn_avh_recompute_totals(OLD.av_voucher_id, OLD.av_acc_year);
    END IF;

    --  AFTER trigger: the return value is discarded.
    RETURN NULL;
END
$fn$;

--  The arithmetic on its own, so it can be called for a repair or a back-fill
--  without pretending to be a trigger:
--      SELECT accounts.fn_avh_recompute_totals(avh_voucher_id, avh_acc_year)
--        FROM accounts.acc_voucher_header;
CREATE OR REPLACE FUNCTION accounts.fn_avh_recompute_totals(
    p_voucher_id uuid,
    p_acc_year   char(9))
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF p_voucher_id IS NULL OR p_acc_year IS NULL THEN
        RETURN;
    END IF;

    UPDATE accounts.acc_voucher_header h
       SET avh_total_debit  = s.dr,
           avh_total_credit = s.cr
      FROM (SELECT COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'DR'), 0) AS dr,
                   COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'CR'), 0) AS cr
              FROM accounts.acc_vouchers
             WHERE av_voucher_id = p_voucher_id
               AND av_acc_year   = p_acc_year
               AND NOT av_is_deleted) s
     WHERE h.avh_voucher_id = p_voucher_id
       AND h.avh_acc_year   = p_acc_year
       --  Skip the write when nothing moved, so a no-op UPDATE does not churn
       --  the row or wake anything watching it.
       AND (h.avh_total_debit, h.avh_total_credit) IS DISTINCT FROM (s.dr, s.cr);
END
$fn$;

COMMENT ON FUNCTION accounts.fn_avh_recompute_totals(uuid, char) IS
    'Re-derives acc_voucher_header.avh_total_debit / _credit from that voucher''s live legs. Called by tr_av_refresh_totals; safe to call by hand for a repair.';

DROP TRIGGER IF EXISTS tr_av_refresh_totals ON accounts.acc_vouchers;

CREATE TRIGGER tr_av_refresh_totals
    AFTER INSERT OR UPDATE OR DELETE ON accounts.acc_vouchers
    FOR EACH ROW
    EXECUTE FUNCTION accounts.fn_avh_refresh_totals();

--  Back-fill every header that already exists, so the columns are true from
--  the moment this migration lands rather than from the next leg written.
--  (There are no legs today; this costs nothing and means the file is still
--  correct the day it is replayed onto a database that has some.)
SELECT accounts.fn_avh_recompute_totals(h.avh_voucher_id, h.avh_acc_year)
  FROM accounts.acc_voucher_header h;

COMMENT ON COLUMN accounts.acc_voucher_header.avh_total_debit IS
    'DERIVED by tr_av_refresh_totals from accounts.acc_vouchers. Never write it: ck_avh_balanced compares it with avh_total_credit, and a stamped value makes that check compare a writer''s claim with itself.';

COMMENT ON COLUMN accounts.acc_voucher_header.avh_total_credit IS
    'DERIVED by tr_av_refresh_totals from accounts.acc_vouchers. Never write it.';
