-- 20261111100000_stock_reservation_source_live_only
--
-- Sales Order Management, P6 follow-up (2026-11-11).
--
-- THE BUG. Amending a CONFIRMED (or PARTIAL) sales order that holds a stock
-- reservation answered 500. StockReservationService.reserve() marks the
-- line's open row RELEASED ("Re-reserved") and then INSERTs a fresh row with
-- the same (acc_year, src module, src doc type, src doc id, line no, lot,
-- godown, bucket). ux_srv_source covered every row that is not deleted,
-- whatever its status, so that INSERT hit 23505 against the row it had just
-- released. The same clash hit a line whose earlier hold on the lot was
-- CONSUMED by a bill.
--
-- THE DECISION (user, 2026-11-11). The index covers LIVE holds only: OPEN and
-- PARTIAL. RELEASED, CONSUMED and EXPIRED rows stay as history and no longer
-- block a new hold on the same key. Two live holds on one key are still
-- refused, so a line still cannot hold the same lot twice.
--
-- ON CONFLICT. Nothing infers this index (checked 2026-11-11 over src/, the
-- migrations and pg_proc): the only INSERT is the plain one in
-- src/modules/sales/posting/stock-reservation.service.ts, and the
-- cloud-sync upsert names the primary key (srv_id, srv_acc_year).
--
-- PARTITIONS. stock.stock_reservation is LIST-partitioned on srv_acc_year.
-- DROP INDEX on the partitioned parent drops every partition's attached copy
-- with it; CREATE INDEX on the parent (no ONLY) builds the index on every
-- existing partition and attaches it, in one statement. A partition made
-- later by stock.fn_create_stock_partitions (the stock part of
-- public.ensure_acc_year_partitions) is CREATE TABLE ... PARTITION OF, which
-- clones the parent's indexes. Neither helper names this index, so neither
-- changes here.
--
-- PRISMA. A partial index, so DB-only and not declared in the model. Only
-- the doc comment in prisma/stocks/stockReservation.prisma changes.
--
-- Idempotent: a re-run drops and rebuilds the same index. Narrowing can never
-- fail to build where the wider index already held: the rows it covers are a
-- subset of the rows the old one covered.

DROP INDEX IF EXISTS stock.ux_srv_source;

CREATE UNIQUE INDEX IF NOT EXISTS ux_srv_source
    ON stock.stock_reservation
       (srv_acc_year, srv_src_module, srv_src_doc_type, srv_src_doc_id,
        srv_line_no, srv_lot_id, srv_godown_id, srv_bucket)
    WHERE srv_is_deleted = false
      AND srv_status::text = ANY (ARRAY['OPEN'::text, 'PARTIAL'::text]);
