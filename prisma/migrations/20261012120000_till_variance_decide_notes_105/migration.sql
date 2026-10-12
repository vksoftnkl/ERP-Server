-- ═══════════════════════════════════════════════════════════════════════════
--  Till: the variance decision — notes 105 Part A (2026-10-12)
--
--  POST /till/sessions/decide-variance lets an approver decide a session that
--  /count left PENDING_APPROVAL: APPROVE (a treatment for its PENDING
--  variances, the session back to COUNTING so /close posts them) or RECOUNT
--  (back to COUNTING with one more count attempt). The approval itself is a
--  till_approval row and a VARIANCE_DECIDED event — tables that exist since
--  20261008100000 and had no writer.
--
--  One column: how many further attempts a RECOUNT decision granted past
--  till.max_recounts. The count's limit is 1 + max_recounts + this, so the
--  grant is on the session's record rather than a decrement of
--  tss_count_attempts (every attempt is kept, numbered, in till_count).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.till_session
    ADD COLUMN IF NOT EXISTS tss_recounts_granted smallint NOT NULL DEFAULT 0;
ALTER TABLE accounts.till_session DROP CONSTRAINT IF EXISTS ck_tss_recounts_granted;
ALTER TABLE accounts.till_session
    ADD CONSTRAINT ck_tss_recounts_granted CHECK (tss_recounts_granted >= 0);

COMMENT ON COLUMN accounts.till_session.tss_recounts_granted IS
    'Further count attempts a RECOUNT decision allowed past till.max_recounts (notes 105).';
