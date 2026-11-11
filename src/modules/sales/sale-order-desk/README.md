# Sales Order Management — the order desk (`/sale-order-desk/*`)

NexERP menu **299** (a port of 3.0's SalesOrderManagement, "SO Pending"). Plan:
`share/sales/plan-sales-order-management-qt-2026-11-10.md` + addendum-1 (wins) + addendum-2.

- **Lists** are registered grids, run by `GET /configured-grid-sql/run`: 201 (orders), 202 (beats),
  203 (not ordered). No `/list` route. The grids carry **no money** (the grid runner checks no right).
- **Rights.** Menu 299 only puts the screen on the menu (VIEW). Every action is judged on the
  **Sales Order menu 11**. Amounts follow **Receipt menu 99 View**: without it a money key is
  **absent** from the response (not zero), and `/figures` answers 403 `SALES_ORDER_MONEY_RIGHT`.
- **Open order** = `so_status` CONFIRMED / PARTIAL with a line whose `soi_pending_qty > 0`. Anything
  else (DRAFT, or a finished COMPLETED / CANCELLED / CLOSED / EXPIRED order) is 409
  `SALES_ORDER_CLOSED` on every write route, with the stored status on the detail.

| Route | Right (menu 11) | Writes | Trail step |
|---|---|---|---|
| `POST delivery-hold` `{keys, soDeliveryHold, reason}` | Edit | `so_delivery_hold*`, modified stamp, audit | DELIVERY_HOLD / DELIVERY_RELEASED |
| `POST priority` `{keys, soPriority}` | Edit | `so_priority`, modified stamp, audit | PRIORITY_CHANGED |
| `POST close-open-lines` `{keys, reason}` | Cancel | reservations released, then `cancelOrderOpenLines` | CANCELLED ("Open lines closed: …") |
| `POST stock-cover` `{soCompanyId, soBranchId, orders[1..500], itemId}` | View | — | — |
| `POST figures` `{soCompanyId, soBranchId, itemId, orders[0..2000], custIds[0..2000]}` | View + 99 View | — | — |
| `POST merge-preview` `{soCompanyId, soBranchId, orders[..20]}` | View (refusals list the rest) | — | — |
| `POST merge` `{soCompanyId, soBranchId, soAccYear, soDeviceId, soSessionId, orders[..20], fingerprint, reason}` | Create + Post + Cancel | new order + sources closed | MERGED on all; CREATED / POSTED on the new; CANCELLED on the old |

## How the desk sits with the order's own guards (9911f072, 7cefea18)

None of these routes **saves** an order (`SaleOrderService.save`), so the save's rules — the body
never sets `soStatus`, and a save over a CONFIRMED / PARTIAL order needs **Amend** — do not apply and
are not worked around: each route is its own verb under its own right, and no route moves
`soRevisionNo` (hold / priority / close are plain audit rows; revisions are P6).

- **Status moves** happen only on server paths that own them: `cancelOrderOpenLines` (close-open-lines,
  and the merge's sources → CANCELLED, or COMPLETED when part-billed) and the lifecycle's `postInTx`
  (the merge's new order DRAFT → CONFIRMED). `postInTx` is public for this.
- **The terminal lock**: a finished order is refused here with `SALES_ORDER_CLOSED` before anything is
  written, so `cancelOrderOpenLines` never runs on one from the desk. `PUT /sale-orders/cancel-lines`
  is unchanged (no right, no release; see the plan's §10.1).
- **The merge's new order** is born through `createOrderInTx` (always DRAFT, per-device number,
  CREATED step, audit), then confirmed by `postInTx` (Post right again, year / day / salesman guards,
  FEFO reservations → `warnings[]`). One transaction (30 s): a refusal anywhere rolls back all of it,
  the number included. The sources are locked `FOR UPDATE` ordered by `so_id` (no deadlock between two
  merges) and re-checked; the preview's `fingerprint` (SHA-256 over each source's id, revision,
  status, hold and live lines' pending qty / net amount) must still match (409
  `SALES_ORDER_MERGE_SOURCE_CHANGED`).

## The delivery hold elsewhere (D18)

`posting/sales.guards.ts` `loadHeldOrders` / `refuseHeldOrders`: a bill (`/bills/validate`, `/post`,
`/create` + post, `/amend`) or a delivery challan (validate / post) naming a held order — by order id
or by order-line id — is refused `SALES_ORDER_DELIVERY_HOLD` (422 on post), no override. A draft can
still be saved. `/bills/open-sources` (ORDER) and party-context `openSources.orders` leave held orders
out.
