-- The lifecycle stamps leave stock.stock_voucher: public.txn_status_log is the
-- only record of WHO changed a voucher's status, WHEN and WHY.
--
-- svh_posted_on/_by, svh_approved_on/_by, svh_cancelled_on/_by and
-- svh_cancel_reason were a second copy of facts the trail already holds -- one
-- that a plain UPDATE could rewrite, while a trail row is append-only. Two
-- copies of one fact drift; the header keeps svh_status (the CURRENT state) and
-- nothing else.
--
-- Reading them back is a lateral on the trail, keyed by
-- (tsl_src_doc_type, tsl_src_doc_id, tsl_acc_year) -- ux_tsl_doc_seq covers it:
--
--   LEFT JOIN LATERAL (
--     SELECT t.tsl_changed_on, t.tsl_changed_by, t.tsl_remarks
--       FROM public.txn_status_log t
--      WHERE t.tsl_src_doc_id = svh.svh_id
--        AND t.tsl_acc_year   = svh.svh_acc_year
--        AND t.tsl_to_status  = 'POSTED'
--        AND t.tsl_is_deleted = false
--      ORDER BY t.tsl_seq_no DESC
--      LIMIT 1) posted ON true
--
-- svh_approved_on/_by are dropped without a backfill: no code ever wrote them
-- and no row on this deployment carries one. There is no approval step in the
-- stock voucher flow -- when one arrives it belongs on the trail as an
-- APPROVED event, not as a column here.

BEGIN;

-- 1. Backfill any stamp the trail is missing. On this deployment every posted
--    and cancelled voucher already has its step (the service has written the
--    trail since the engine moved in-process), so this inserts nothing -- it is
--    here for deployments whose vouchers predate that, and for the fresh
--    replay, where stock_voucher is empty and it selects no rows.
WITH stamped AS (
    SELECT v.svh_id,
           v.svh_acc_year,
           v.svh_company_id,
           v.svh_branch_id,
           v.svh_tenant_id,
           v.svh_refno,
           v.svh_device_id,
           v.svh_session_id,
           -- The trail's doc type per screen: the two transfer legs file as
           -- STOCK_TRANSFER, every other voucher type as STOCK_ADJUSTMENT.
           -- Mirrors StockVoucherTypeRules.statusDocType.
           CASE WHEN v.svh_voucher_type IN ('TRANSFER_OUT', 'TRANSFER_IN')
                THEN 'STOCK_TRANSFER'
                ELSE 'STOCK_ADJUSTMENT'
           END AS doc_type,
           step.to_status,
           step.from_status,
           step.changed_on,
           step.changed_by,
           step.remarks
      FROM stock.stock_voucher v
      CROSS JOIN LATERAL (
          VALUES
              ('POSTED',    'DRAFT',  v.svh_posted_on,    v.svh_posted_by,    NULL::varchar(500)),
              ('CANCELLED', 'POSTED', v.svh_cancelled_on, v.svh_cancelled_by, v.svh_cancel_reason::varchar(500))
      ) AS step(to_status, from_status, changed_on, changed_by, remarks)
     WHERE step.changed_on IS NOT NULL
),
missing AS (
    SELECT s.*,
           COALESCE((SELECT max(t.tsl_seq_no)
                       FROM public.txn_status_log t
                      WHERE t.tsl_src_doc_id = s.svh_id
                        AND t.tsl_acc_year   = s.svh_acc_year), 0)
             + row_number() OVER (PARTITION BY s.svh_id, s.svh_acc_year
                                      ORDER BY s.changed_on) AS seq_no
      FROM stamped s
     WHERE NOT EXISTS (
               SELECT 1
                 FROM public.txn_status_log t
                WHERE t.tsl_src_doc_id = s.svh_id
                  AND t.tsl_acc_year   = s.svh_acc_year
                  AND t.tsl_to_status  = s.to_status
           )
)
INSERT INTO public.txn_status_log (
    tsl_company_id, tsl_branch_id, tsl_tenant_id, tsl_acc_year,
    tsl_src_module, tsl_src_doc_type, tsl_src_doc_id, tsl_src_doc_refno,
    tsl_seq_no, tsl_event, tsl_from_status, tsl_to_status,
    tsl_changed_on, tsl_changed_by, tsl_remarks,
    tsl_device_id, tsl_session_id, tsl_created_on, tsl_created_by
)
SELECT m.svh_company_id,
       m.svh_branch_id,
       m.svh_tenant_id,
       m.svh_acc_year,
       -- INVENTORY, not the ledger's 'STOCK' -- the two tables allow different
       -- module vocabularies (ck_tsl_src_module).
       'INVENTORY',
       m.doc_type,
       m.svh_id,
       m.svh_refno,
       m.seq_no,
       m.to_status,
       m.from_status,
       m.to_status,
       m.changed_on,
       -- tsl_changed_by is NOT NULL while svh_posted_by/_cancelled_by were
       -- nullable ("posted by nobody" was sayable). The nil uuid is this
       -- schema's stand-in for an unauthenticated actor.
       COALESCE(m.changed_by, '00000000-0000-0000-0000-000000000000'::uuid),
       -- ck_tsl_reason_required wants a non-empty remark on a CANCELLED row,
       -- and svh_cancel_reason was nullable.
       CASE WHEN m.to_status = 'CANCELLED'
            THEN COALESCE(NULLIF(btrim(m.remarks), ''), 'Cancelled (reason not recorded)')
            ELSE m.remarks
       END,
       m.svh_device_id,
       m.svh_session_id,
       m.changed_on,
       'migration_20260909120000'
  FROM missing m;

-- 2. Drop the copies. Nothing else in the database reads them: no view, index,
--    check constraint or function references these columns (stock.fn_svh_post /
--    fn_svh_cancel do not exist on this deployment -- post and cancel run in
--    process). stock_voucher is LIST-partitioned by svh_acc_year, so one DROP
--    on the parent drops the column from every partition.
ALTER TABLE stock.stock_voucher
    DROP COLUMN IF EXISTS svh_posted_on,
    DROP COLUMN IF EXISTS svh_posted_by,
    DROP COLUMN IF EXISTS svh_approved_on,
    DROP COLUMN IF EXISTS svh_approved_by,
    DROP COLUMN IF EXISTS svh_cancelled_on,
    DROP COLUMN IF EXISTS svh_cancelled_by,
    DROP COLUMN IF EXISTS svh_cancel_reason;

COMMIT;
