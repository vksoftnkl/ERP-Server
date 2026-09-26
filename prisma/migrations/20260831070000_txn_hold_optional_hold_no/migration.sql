-- public.txn_hold: txh_hold_no / txh_hold_slno become OPTIONAL.
--
-- Only a HOLD prints a token slip. An AUTOSAVE snapshot is written by the
-- screen every few seconds and a TEMPLATE is never handed to a customer, so
-- neither has a number to carry — forcing one on them made the client invent
-- throwaway values that then burned a slot in the per-device series.
--
-- The two partial unique indexes (ux_txh_hold_no, ux_txh_device_slno) stay as
-- they are: Postgres treats NULLs as distinct, so unnumbered rows never collide
-- with each other and a numbered one is still unique in its scope.
--
-- ck_txh_hold_no_shape / ck_txh_hold_slno need no change either: both evaluate
-- to UNKNOWN on a NULL column, which a CHECK accepts. They keep judging the
-- shape of a number that IS present.
--
-- DROP NOT NULL recurses from the partitioned parent into every existing
-- partition, so no per-partition statement is needed.
ALTER TABLE public.txn_hold
    ALTER COLUMN txh_hold_no   DROP NOT NULL,
    ALTER COLUMN txh_hold_slno DROP NOT NULL;
