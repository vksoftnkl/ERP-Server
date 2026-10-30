-- th_locked_by / th_resumed_by name the DEVICE that pulled the hold onto a till
-- (the X-Device-Id header), and th_device_id is VARCHAR(64) — so at 50 a device
-- id could be silently truncated on the way in and then never match itself on
-- the ownership check that release / convert make in their WHERE clause.
-- Widening only; VARCHAR(50) -> VARCHAR(64) is a no-rewrite ALTER in Postgres.
--
-- Nothing else on transaction_hold is touched. Every index on this table is
-- PARTIAL (see 20260804131134_transaction_hold_table_added) and therefore
-- invisible to Prisma; a `migrate dev`-generated version of this change would
-- try to re-CREATE them without their WHERE predicate and fail 42P07, which is
-- why this migration is hand-authored as a bare ALTER COLUMN ... TYPE.
ALTER TABLE public.transaction_hold
    ALTER COLUMN th_locked_by  TYPE VARCHAR(64),
    ALTER COLUMN th_resumed_by TYPE VARCHAR(64);
