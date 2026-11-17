-- ═══════════════════════════════════════════════════════════════════════════
--  Mobile app: order upload (/mobile/orders) and visit check-ins
--  (/mobile/visits)                                              2026-11-16
--  Folder: prisma/migrations/20261118110000_mobile_orders_visits/
--
--  The React Native salesman app uploads orders and check-ins it took offline.
--  An upload whose answer was lost is sent again, so both writes carry the
--  phone's own uuid and the server answers a resend with the row it already
--  has instead of saving it twice. Sorts after 20261118100000_dc_dc_return.
--
--   1 · sales.sale_order.so_client_uuid uuid NULL: the phone's id for the
--       order. NULL on every desktop order.
--       ux_so_client_uuid UNIQUE (so_company_id, so_client_uuid, so_acc_year).
--       sale_order is LIST-partitioned by so_acc_year, and a unique index on
--       a partitioned table must hold the partition key, so the year is in
--       the key. The server's duplicate check reads across every year under
--       a transaction lock on (company, client uuid), so a resend after the
--       year turns is still found. The index is the backstop within a year.
--       NOT partial: a deleted order still holds its uuid, so a resend of an
--       order the office deleted is not saved again.
--   2 · sales.customer_visit (cv_): one row per check-in at a customer, by a
--       salesman, with a reason code, remarks, the GPS fix and the visit time.
--       ux_cv_client_uuid UNIQUE (cv_company_id, cv_client_uuid). Insert-only.
--       Reason codes are the phone's own words (ck_cv_reason_code). FKs to
--       the customer, the salesman (employee_master, as so_salesman_id) and
--       the device; company and branch carry none, as on sale_order.
--   3 · sync triggers + pending index on customer_visit, only where the sync
--       functions exist (the 20261117100000 pattern; cloud sync is
--       local-only).
--   4 · public.db_table_master 635 for customer_visit
--       (prisma/seed/Db_Table_Master.sql carries the same row).
--
--  No business-logic function or trigger. Every statement is re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · sale_order.so_client_uuid ──────────────────────────────────────────
ALTER TABLE sales.sale_order ADD COLUMN IF NOT EXISTS so_client_uuid uuid;

COMMENT ON COLUMN sales.sale_order.so_client_uuid IS
    'The phone''s own id for an order uploaded from the mobile app (/mobile/orders/create). A resend with the same (company, client uuid) answers the order already saved. NULL on desktop orders.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_so_client_uuid
    ON sales.sale_order (so_company_id, so_client_uuid, so_acc_year);


-- ── 2 · sales.customer_visit ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales.customer_visit (
    cv_id            uuid           NOT NULL DEFAULT uuidv7(),
    cv_company_id    uuid           NOT NULL,
    cv_branch_id     uuid           NOT NULL,
    cv_device_id     uuid           NOT NULL,
    cv_cust_id       uuid           NOT NULL,
    cv_salesman_id   uuid           NOT NULL,
    cv_user_id       uuid,
    cv_reason_code   varchar(20)    NOT NULL,
    cv_remarks       varchar(500),
    cv_latitude      numeric(9,6),
    cv_longitude     numeric(9,6),
    cv_gps_accuracy  numeric(10,2),
    cv_visit_at      timestamptz(6) NOT NULL,
    cv_client_uuid   uuid           NOT NULL,
    cv_sync_date     timestamptz(6),
    cv_created_on    timestamptz(6) NOT NULL DEFAULT now(),
    cv_created_by    varchar(50)    NOT NULL,
    CONSTRAINT pk_customer_visit PRIMARY KEY (cv_id),
    CONSTRAINT ux_cv_client_uuid UNIQUE (cv_company_id, cv_client_uuid),
    CONSTRAINT ck_cv_reason_code CHECK (cv_reason_code IN
        ('shopClosed', 'noOrder', 'shopBusy', 'ownerAway', 'paymentPending', 'nextVisit')),
    CONSTRAINT ck_cv_position CHECK ((cv_latitude IS NULL) = (cv_longitude IS NULL)),
    CONSTRAINT ck_cv_latitude CHECK (cv_latitude BETWEEN -90 AND 90),
    CONSTRAINT ck_cv_longitude CHECK (cv_longitude BETWEEN -180 AND 180),
    CONSTRAINT ck_cv_gps_accuracy CHECK (cv_gps_accuracy >= 0),
    CONSTRAINT fk_cv_device FOREIGN KEY (cv_device_id)
        REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_cv_cust FOREIGN KEY (cv_cust_id)
        REFERENCES sales.customers (cus_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_cv_salesman FOREIGN KEY (cv_salesman_id)
        REFERENCES public.employee_master (emp_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_cv_cust_time
    ON sales.customer_visit (cv_cust_id, cv_visit_at DESC);
CREATE INDEX IF NOT EXISTS ix_cv_salesman_time
    ON sales.customer_visit (cv_salesman_id, cv_visit_at DESC);

COMMENT ON TABLE sales.customer_visit IS
    'A salesman''s check-in at a customer from the mobile app (/mobile/visits/create): reason, remarks, GPS fix, visit time. Insert-only; (company, client uuid) makes a resend answer the row already saved.';
COMMENT ON COLUMN sales.customer_visit.cv_reason_code IS
    'The phone''s reason code: shopClosed, noOrder, shopBusy, ownerAway, paymentPending, nextVisit.';
COMMENT ON COLUMN sales.customer_visit.cv_gps_accuracy IS 'GPS accuracy radius in metres, as the phone reports it.';
COMMENT ON COLUMN sales.customer_visit.cv_visit_at IS 'When the salesman checked in, by the phone''s clock.';
COMMENT ON COLUMN sales.customer_visit.cv_user_id IS 'The login user, when the upload carried a token.';


-- ── 3 · sync triggers + pending index (local installs only) ────────────────
DO $sync$
BEGIN
    IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
       OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
        RAISE NOTICE 'mobile visits: sync functions absent, sync triggers skipped';
        RETURN;
    END IF;
    CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON sales.customer_visit
        FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty('cv_sync_date');
    CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON sales.customer_visit
        FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete('sales', 'customer_visit', 'cv_id');
    CREATE INDEX IF NOT EXISTS ix_sync_pending_customer_visit
        ON sales.customer_visit (cv_id) WHERE cv_sync_date IS NULL;
END $sync$;


-- ── 4 · table registry row 635 (Db_Table_Master.sql carries the same) ──────
INSERT INTO public.db_table_master
       (dtm_id, dtm_schema, dtm_table, dtm_parent_id, dtm_name, dtm_kind, dtm_module,
        dtm_col_prefix, dtm_sync_col, dtm_menu_id, dtm_write_mode, dtm_retention_days, dtm_is_active,
        dtm_description)
SELECT 635, 'sales', 'customer_visit', NULL, 'Customer Visit', 'TRANSACTION', 'SALES',
       'cv_', 'cv_sync_date', NULL, 'APPEND_ONLY', NULL, true,
       'A salesman''s check-in at a customer from the mobile app: reason, remarks, GPS fix, visit time; (company, client uuid) unique so a resend is not saved twice.'
 WHERE to_regclass('public.db_table_master') IS NOT NULL
ON CONFLICT (dtm_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.db_table_master', 'dtm_id'),
              GREATEST((SELECT COALESCE(max(dtm_id), 1) FROM public.db_table_master),
                       (SELECT last_value FROM public.db_table_master_dtm_id_seq)));
