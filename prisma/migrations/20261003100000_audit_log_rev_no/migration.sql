-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 89 — transaction audit: one BEFORE/AFTER snapshot per save
--
--  Every save of a transaction now writes ONE audit.audit_log row holding the
--  document as it stood before the save (log_original_record, NULL on a create)
--  and after it (log_modified_record), both in the shape of the screen's own
--  /get response. log_rev_no numbers those rows per document: 1 for the create,
--  then 2, 3 … one per save, so the History dialog can list revisions in order
--  and open the document "as at rev N".
--
--  Counted per (log_screen_id, log_pk). Rows written before this migration, and
--  every non-revision row (masters, status steps), keep NULL — they are not
--  revisions of a document and take no part in the numbering.
--
--  The partial unique index is both the guard (two saves can never claim the
--  same revision) and the read path for MAX(log_rev_no) + 1. Partial, so it is
--  DB-only: Prisma cannot express the predicate (see the auditLog.prisma note).
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE audit.audit_log
    ADD COLUMN IF NOT EXISTS log_rev_no smallint;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'ck_audit_log_rev_no'
                      AND conrelid = 'audit.audit_log'::regclass) THEN
        ALTER TABLE audit.audit_log
            ADD CONSTRAINT ck_audit_log_rev_no CHECK (log_rev_no IS NULL OR log_rev_no >= 1);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_log_revision
    ON audit.audit_log (log_screen_id, log_pk, log_rev_no)
 WHERE log_rev_no IS NOT NULL;

COMMENT ON COLUMN audit.audit_log.log_rev_no IS
    'Revision of a transaction document: 1 = create, then one per save (notes 89). NULL on every other row.';
