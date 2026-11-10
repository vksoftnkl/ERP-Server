-- ═══════════════════════════════════════════════════════════════════════════
--  Sales Order: restate so_pending_amt / so_cancelled_amt / so_billed_amt
--  from the order lines  2026-11-10
--  One-off data repair (user-approved, 2026-11-10). No table, column, CHECK,
--  function or trigger; no seed change.
--
--  Why: before 2026-11-10 only the bill recompute (syncOneOrderFulfilment) and
--  PUT /sale-orders/cancel-lines wrote these three header caches. /create and
--  /post never did, so an order nobody had billed or cancelled against read
--  so_pending_amt 0.00 with every unit still to deliver. The server now
--  restates them on create, update, amend and post
--  (SaleOrderService.orderAmountsOf); this fixes the rows saved before that.
--  Draft: Shared/Prathap/sales/sql/so-amounts-restate-2026-11-10.sql
--  (nestjs-backend), tightened here to match the server's arithmetic digit
--  for digit.
--
--  The rule is summariseOrderLines as orderAmountsOf feeds it. Per line of
--  the order (same so_id and acc_year, soi_is_deleted = false):
--      net / delivered / cancelled  = the numeric(15,3) columns (the server's
--                                     round to 3 dp is a no-op on them)
--      pending                      = net - delivered - cancelled
--      share                        = soi_net_amt / net when net > 0, else 0
--      pending_amt  += pending   * share
--      cancelled_amt += cancelled * share
--      billed_amt   += soi_billed_amt
--  and each sum rounded ONCE to 2 dp, half up. An order with no live line gets
--  0.00 for all three.
--  Precision: the server computes with Prisma.Decimal (decimal.js, 20
--  significant digits, ROUND_HALF_UP). PostgreSQL's own numeric division keeps
--  a magnitude-dependent number of digits (1079.99/12 gives 89.9991666666666667,
--  the server 89.999166666666666667), which can move a sum that sits on a
--  half-paisa by 0.01. So the quotient is taken at 30 decimals and rounded
--  half up to 20 significant digits, and so is each product, as decimal.js
--  does. The running sum is not re-rounded per addition: for an order under
--  1e9 that only touches the 11th decimal and later.
--
--  Only rows whose three values differ are updated; deleted orders are left
--  alone, as the server leaves them. so_modified_on / so_modified_by are NOT
--  stamped (a data repair, not a user edit) and the status columns are not
--  touched. sales.sale_order's zz_sync_mark_dirty trigger clears so_sync_date
--  on every repaired row, so the corrected caches go up with the next cloud
--  sync - wanted, since the values change.
--  Safe on an empty table and re-runnable: a second run finds nothing to
--  change. Dev (2026-11-10): 0 rows.
-- ═══════════════════════════════════════════════════════════════════════════

WITH line AS (
    SELECT i.soi_order_id AS so_id,
           i.soi_acc_year AS so_acc_year,
           i.soi_net_qty - i.soi_delivered_qty - i.soi_cancelled_qty AS pending_qty,
           i.soi_cancelled_qty AS cancelled_qty,
           i.soi_billed_amt AS billed_amt,
           CASE WHEN i.soi_net_qty <= 0 OR i.soi_net_amt = 0 THEN 0::numeric
                ELSE round(q.quotient, 19 - floor(log(abs(q.quotient)))::int)
           END AS share
      FROM sales.sale_order_item i
     CROSS JOIN LATERAL (
           SELECT CASE WHEN i.soi_net_qty > 0 THEN round(i.soi_net_amt, 30) / i.soi_net_qty END AS quotient
           ) q
     WHERE i.soi_is_deleted = false
),
part AS (
    SELECT l.so_id, l.so_acc_year, l.billed_amt,
           CASE WHEN p.pending_raw = 0 THEN 0::numeric
                ELSE round(p.pending_raw, 19 - floor(log(abs(p.pending_raw)))::int) END AS pending_part,
           CASE WHEN p.cancelled_raw = 0 THEN 0::numeric
                ELSE round(p.cancelled_raw, 19 - floor(log(abs(p.cancelled_raw)))::int) END AS cancelled_part
      FROM line l
     CROSS JOIN LATERAL (
           SELECT l.pending_qty * l.share AS pending_raw, l.cancelled_qty * l.share AS cancelled_raw
           ) p
),
amt AS (
    SELECT o.so_id, o.so_acc_year,
           round(coalesce(sum(p.pending_part), 0), 2)   AS pending_amt,
           round(coalesce(sum(p.cancelled_part), 0), 2) AS cancelled_amt,
           round(coalesce(sum(p.billed_amt), 0), 2)     AS billed_amt
      FROM sales.sale_order o
      LEFT JOIN part p ON p.so_id = o.so_id AND p.so_acc_year = o.so_acc_year
     WHERE o.so_is_deleted = false
     GROUP BY o.so_id, o.so_acc_year
)
UPDATE sales.sale_order o
   SET so_pending_amt   = a.pending_amt,
       so_cancelled_amt = a.cancelled_amt,
       so_billed_amt    = a.billed_amt
  FROM amt a
 WHERE o.so_id = a.so_id
   AND o.so_acc_year = a.so_acc_year
   AND (o.so_pending_amt, o.so_cancelled_amt, o.so_billed_amt)
       IS DISTINCT FROM (a.pending_amt, a.cancelled_amt, a.billed_amt);
