-- ════════════════════════════════════════════════════════════════════════════
-- 20261028170000_print_share_link — documents shared as a link
--
-- The sale bill's WhatsApp send puts a link to the bill's PDF in the message
-- (`POST /print-share/create`, opened at the public `GET /print-share/<token>`).
-- One row per link: the token, and the render context frozen at creation. The
-- PDF is rendered on every open, never stored.
--
-- Runs:   once, in one transaction. Re-runnable: every statement is IF NOT
--         EXISTS / OR REPLACE.
--
--   · No foreign keys: a link whose revision or document has gone answers "no
--     longer available" rather than holding either in place.
--   · The two sync triggers and the sync "pending" index are created only when
--     fn_sync_mark_dirty / fn_sync_log_delete exist — same guard as
--     20261023120000_item_price_change_log_notes_144, for the same reason (they
--     are absent on the VPS, and an unconditional CREATE TRIGGER fails the
--     deploy there). psl_sync_date itself is unconditional: the Prisma fragment
--     declares it.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.print_share_link (
  psl_id          uuid          PRIMARY KEY DEFAULT uuidv7(),
  psl_token       varchar(43)   NOT NULL,
  psl_version_id  uuid          NOT NULL,
  psl_doc_id      uuid          NOT NULL,
  psl_company_id  uuid          NOT NULL,
  psl_branch_id   uuid,
  psl_acc_year    char(9)       NOT NULL,
  psl_device_id   uuid,
  psl_filename    varchar(80)   NOT NULL,
  psl_expires_on  timestamptz(6) NOT NULL,
  psl_created_on  timestamptz(6) NOT NULL DEFAULT now(),
  psl_created_by  uuid,
  psl_sync_date   timestamptz(6)                        -- offline sync: NULL = not yet synced
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_psl_token      ON public.print_share_link (psl_token);
CREATE INDEX IF NOT EXISTS        ix_psl_doc        ON public.print_share_link (psl_doc_id);
CREATE INDEX IF NOT EXISTS        ix_psl_expires_on ON public.print_share_link (psl_expires_on);

-- ── sync: exactly what public.sync_install_triggers() creates per table ──
-- Skipped where the sync functions are absent (see the header).
DO $$
BEGIN
  IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
     OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
    RAISE NOTICE 'print_share_link: sync functions absent, sync triggers skipped';
    RETURN;
  END IF;
  CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON public.print_share_link
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty('psl_sync_date');
  CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON public.print_share_link
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete('public', 'print_share_link', 'psl_id');
  CREATE INDEX IF NOT EXISTS ix_sync_pending_print_share_link
    ON public.print_share_link (psl_id) WHERE psl_sync_date IS NULL;
END $$;

COMMENT ON TABLE public.print_share_link IS
  'A rendered document shared outside the system as a link (sale bill WhatsApp send). The token is the authorisation; the PDF is rendered on each open from the frozen context. Written by PrintShareService.';
