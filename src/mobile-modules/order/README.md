# Mobile · Orders

Order upload from the React Native salesman app. It is the desktop order: the save runs through
[`SaleOrderService.createOrderInTx`](../../modules/sales/sale-order/sale-order.service.ts), and in
the same transaction the order is confirmed through
[`SaleOrderLifecycleService.postInTx`](../../modules/sales/sale-order/sale-order-lifecycle.service.ts),
as if the office had pressed Confirm (since 2026-11-19, the user's call: "convert this as directly
confirmed, not a draft"). See [Confirm](#confirm).

- **Route:** `POST /api/v1/mobile/orders/create`. Swagger tag `Mobile · Orders`, docs page
  `/api/docs/mobile-orders`.
- **Auth:** optional (`@OptionalAuth`). With a token, the login user is `so_user_id` and the
  audit author. Without one, `soUserId` from the body is required (400
  `MOBILE_ORDER_USER_REQUIRED`), and the audit names the default actor.
- **Database:** `sales.sale_order.so_client_uuid` + `ux_so_client_uuid` (migration
  `20261118110000_mobile_orders_visits`).

## Payload

The desktop `/sale-orders/create` body (`so*`, with `items[]` of `soi*`), plus:

- `soClientUuid` (required): the phone's own id for the order;
- `deviceUid` (required): the phone's registered device uid (`fixed.device_master.dev_device_uid`);
- `soBranchId` (optional, since 2026-11-18): the branch the salesman picked for this order in
  VKSMAN's Switch company. See [Branch](#branch) below;
- `soUserId`: optional, see Auth above;
- `items`: at least one line.

These keys are **refused** (400 `VALIDATION_WHITELIST`), because the server fills them or a phone
order does not carry them:

- header: `soId`, `soTenantId`, `soAccYear`, `soSessionId`, `soDeviceId`, `soOrderSlno`,
  `soOrderRefno`, `soStatus`, `post`, `waOnPost` (WhatsApp on Post follows the company's setting
  alone, see [Confirm](#confirm)), `charges`, `tenders`, `soCreatedBy`, `soModifiedBy`;
- lines: `soiId`, `soiOrderId`, `soiCompanyId`, `soiBranchId`, `soiTenantId`, `soiAccYear`,
  `soiCreatedBy`, `soiModifiedBy`.

## What the server fills

| Column | From |
| --- | --- |
| `so_device_id` | The phone, looked up by `deviceUid`. Phones are **registered on the Device List screen** like any counter (the user's call, 2026-11-16). An unknown phone is a 403 `MOBILE_DEVICE_NOT_REGISTERED`, a blocked one `MOBILE_DEVICE_BLOCKED`, a switched-off one `MOBILE_DEVICE_INACTIVE`. |
| `so_branch_id` | `soBranchId` when sent. Without it: the phone's branch when it belongs to `soCompanyId`, else the company's default branch, else its only branch; otherwise a 422 `MOBILE_BRANCH_NOT_RESOLVED`. See [Branch](#branch). |
| `so_acc_year` | The company's financial year holding `soOrderDate` (YYYY-MM-DD; today, the database's IST date, when omitted). None is a 422 `MOBILE_NO_FISCAL_YEAR`. |
| `so_order_slno` / `so_order_refno` | Voucher type 4, as on the desktop. |
| `so_status` | `CONFIRMED`: the upload confirms the order it saves, with its stock reservations, as `/sale-orders/post` does. `DRAFT` only when that confirm is refused (see [Confirm](#confirm)); the office then confirms it. |
| `so_client_uuid` | `soClientUuid`. |
| `soi_godown_id` | The line's `soiGodownId` when sent. A line without one gets its item's godown (user 2026-11-20): the price row's `ipm_godown_id` for the line's unit, else the order branch's live default (`br_default_godown_id`), the desktop's rule (notes 51). Otherwise it stays empty. See [Confirm](#confirm). |

### What the desktop sends beside the phone's keys (user, 2026-11-20)

"Order creation should work like the Qt desktop application." The desktop order screen
(NexERP `sale_order_entry.cpp`) works out more per line and per header than the phone sends.
`mobile-order-desktop-fill.ts` fills those keys before the save, **only where the phone sent
none**. The phone's money (rate, discount, taxable, GST, net) is never re-priced; the figures are
derived from it.

| Where | Keys | From |
| --- | --- | --- |
| Line | `soiActPrice`, `soiCostPrice`, `soiCostPreTax`, `soiMaxPrice`, `soiMinPrice`, `soiHasFreight`, `soiIsService`, `soiEanCode`, `soiHsnCode`, `soiWeightQty`, `soiAvailableStock` | `/master-lookups/item-price` (`ItemPriceLookup`), asked as the desktop's pick asks it: company, branch, customer, the line's level, unit and godown, the order's date and year. A line it cannot price keeps the phone's figures only; the upload is never refused for it. |
| Line | `soiIsRateLocked` | `false`: the desktop has no lock control, so the bill may re-price at delivery. |
| Line | `soiRatePreTax`, `soiRateDiff`, `soiNetGross`, `soiChrgBeforeTax` (0), `soiChrgAfterTax` (the phone's freight + loading), `soiSoldPrice`, `soiSoldPreTax`, `soiItemProfit`, `soiProfitPreTax`, `soiMrpSavings`, `soiMrpSavingsPerc` | `priceRowStandard` / `finalizeRowWithCharges`, off the phone's rate, taxable and net. |
| Header | `soCustGstType`, `soCustStcd`, `soPosStcd`, `soStateName` | The customer. The place of supply only when `fixed.state_codes` lists the customer's state (`fk_so_pos_state`), named as that list names it. |
| Header | `soFreightCalcType`, `soLoadingCalcType`, `soDiscAlterBase`, `soRoundOffStep`, `soDeliveryMode` | The company's effective settings (`sales.*`), as the desktop's AppSession stamps them. A delivery mode outside `ck_so_delivery_mode` is skipped. |
| Header | `soAgentCommPerc` / `soAgentCommAmt` (0), `soTotalCost`, `soMarginAmt`, `soMarginPerc`, `soMrpSavings`, `soMrpSavingsPerc` | `recalcDocumentTotals` over the filled lines. |

Not matched on purpose: the phone's `soiGrossAmt` / `soGrossAmt` stay qty × rate (tax included
for a GST-inclusive item), and `soiIsPromo` keeps the phone's meaning (offers applied to the line).

## Branch

The salesman picks a company and a branch in VKSMAN's Switch company sheet, from
`GET /master-lookups/branches/by-company/{companyId}`. The phone saves the pick on each order
offline, so the order lands in that branch even when the salesman switches later.

- **`soBranchId` sent** (not null): it must be a branch of `soCompanyId` that is active and not
  deleted (`public.branch_master`: `br_comp_id`, `br_is_active`, `br_is_deleted`), the same rows
  the lookup lists. Anything else (another company's branch, a switched-off or deleted branch, an
  unknown id) is a 422 `MOBILE_BRANCH_NOT_OF_COMPANY` on `soBranchId`. No other branch is tried
  instead, so an order never lands in a branch the salesman did not pick.
- **`soBranchId` absent** (or null): the fallback as before, so older phones and orders saved
  before the pick existed save exactly as they did: the phone's Device List branch when it
  belongs to `soCompanyId`, else the company's default branch (`br_is_default`), else its only
  active branch, else 422 `MOBILE_BRANCH_NOT_RESOLVED` on `deviceUid`.
- **No user-to-branch rule.** VK Nex has no table that limits which companies or branches a
  user may work in: `user_menus` is not scoped by company or branch, and the desktop
  `/sale-orders/create` checks no right for a DRAFT. So the phone gets no such check either.
- The phone's device (`so_device_id`) and its number series do not change with the branch.
- A resend answers the stored order before any branch check (see below), so it keeps its
  saved branch whatever `soBranchId` the resend carries, valid or not.

## Confirm

After the save, in the same transaction, the upload runs the desktop confirm
(`SaleOrderLifecycleService.postInTx`) on the new order: the lock, the status gates, the year, the
day, the salesmen, the stock reservations (FEFO, per lot), `so_status = CONFIRMED`, the POSTED
status step and the `approve` audit row. The number, the CREATED step and revision 1 are the
save's, as on the desktop's one-call save-and-confirm.

- **No Post right needed** (the user's call, 2026-11-19). The phone passes
  `{ skipPostRight: true, origin: 'PHONE' }` (`SaleOrderPostOptions`): the menu-11 Post-right check
  is skipped on this path only. A login without the right (raman, ravi on dev) and an upload
  without a token are confirmed too; a no-token one in the default actor's name (the zero uuid),
  as its save is stamped. The desktop `/sale-orders/post` and `/sale-orders/create` with `post`
  still refuse such a login with 403 `SALES_RIGHT_POST`.
- **Marked as from the phone.** The POSTED step's remarks read `Confirmed from the phone` (then
  `; N line(s) short on reservation` when some are), and the audit row's notes
  `Order confirmed from the phone` (the desktop writes `Order confirmed`).
- **Reservations.** A line is reserved in its godown, FEFO, from the branch's own stock
  (`stock_balance` by branch AND godown). More than the shelf holds is a `SALES_RESERVE_SHORT`
  warning in `warnings[]`, never a refusal, as on the desktop.
- **The line godown** (user, 2026-11-20: "fill their items godown"). The phone sends no
  `soiGodownId` today. Before the save, a line without one takes the godown a desktop sale line of
  that item defaults to (`resolveDefaultSaleGodowns`, notes 51, the rule `/master-lookups/item-price`
  and `/quotations/get` use), so the line stores it and the confirm reserves there. A line that
  sends a godown keeps it.
  1. The item's price-row godown: `item_price_master.ipm_godown_id` of the headline row in force
     today for the line's unit, a branch row before a chain row.
  2. Else the order branch's default (`br_default_godown_id`), when that godown is live.
  - This replaced the 2026-11-19 rule (branch default only, and only a godown of the order's own
    branch), which left every Counter2 line without a godown: Counter2's default is namakkal, a
    godown of Acme Foods - Coimbatore. As on the desktop, a godown of another branch is now kept;
    the confirm reads stock by branch AND godown, so it may reserve nothing there (a
    `SALES_RESERVE_SHORT` warning).
  - Neither gives one: the line stays without a godown, and the confirm answers it as a
    `SALES_RESERVE_SHORT` warning ("no godown on the line, nothing reserved").
- **Fallback: a refusal keeps the DRAFT.** The confirm runs behind `SAVEPOINT mobile_order_confirm`.
  When it is refused with a coded 4xx (the house refusal: `errors[].code`), the upload rolls back
  to the savepoint, so only the confirm's own writes are undone; the DRAFT, its lines, its number
  and `so_client_uuid` commit, and the answer carries `confirmRefused`. Codes it can carry:
  `SALES_DAY_CLOSED` (the order's date is closed at the branch), `VCH_YEAR_CLOSED` /
  `VCH_PERIOD_LOCKED` (the year), `SALES_SALESMAN_INVALID` (a `soSalesmanId` that is not a live
  employee of the company), or any other coded refusal `postInTx` throws. The upload still answers
  201 "Order created successfully"; the office confirms the draft once the cause is fixed.
- **Anything else fails the upload as before**: a database error, a 5xx, an uncoded error. The
  whole transaction rolls back (no order, no number).
- **WhatsApp on Post, as on the desktop** (user, 2026-11-19). After the commit, for an order THIS
  call confirmed (not a resend, not a DRAFT kept by a refusal), the upload fires
  `SaleOrderLifecycleService.whatsappAfterPost`, the step `/sale-orders/post` fires, with
  `waOnPost` undefined: the company's `whatsapp.on_post_types` alone decides (it must list 4,
  Sales Order). `waOnPost` stays refused in the body. It never throws or fails the upload; the
  answer then carries the desktop's `whatsapp` block (`wmlId`, `accYear`, `status`, …) when a send
  was asked for. On dev the one connected company has `[]`, so nothing is sent.
- **A resend does not confirm again.** It answers the stored order as it stands now
  (`confirmRefused: null`, `warnings: []`) and writes nothing.

## Resend safety

The phone resends an order when it lost the answer. Every upload:

1. takes a transaction advisory lock on (company, client uuid), so two copies of one resend run
   one after the other;
2. looks for an order with that (company, client uuid) **in any year and any state**, deleted ones
   included;
3. if it finds one, answers it with `duplicate: true` and writes nothing. If that order is for
   another customer, the phone has reused a uuid: 409 `MOBILE_CLIENT_UUID_REUSED`;
4. otherwise saves the order and stamps `so_client_uuid`, in the same transaction.

`ux_so_client_uuid` is `UNIQUE (so_company_id, so_client_uuid, so_acc_year)`. The year is in the
key only because a unique index on a partitioned table must hold the partition key. The lock and
step 2 are what make a resend across the year change safe; the index is the backstop.

## Answer

Confirmed (the line had no godown, so it was saved and reserved in its item's godown):

```json
{ "soId": "…", "soOrderRefno": "sor01196", "soStatus": "CONFIRMED", "soAccYear": "2026-2027",
  "duplicate": false, "soIsDeleted": false, "confirmRefused": null, "warnings": [] }
```

A shortfall (or a line left without a godown) is a warning:

```json
"warnings": [ { "code": "SALES_RESERVE_SHORT", "line": 1, "short": 2,
                "message": "Line 1: no godown on the line, nothing reserved",
                "user": { "title": "Not enough stock", "line": "…", "todo": "…" } } ]
```

Kept DRAFT (the confirm was refused):

```json
{ "soId": "…", "soOrderRefno": "sor01177", "soStatus": "DRAFT", "soAccYear": "2026-2027",
  "duplicate": false, "soIsDeleted": false, "warnings": [],
  "confirmRefused": { "code": "SALES_SALESMAN_INVALID", "field": "soSalesmanId",
                      "message": "soSalesmanId names an employee that do not exist, …",
                      "user": { "title": "…", "line": "…", "todo": "…" } } }
```

- `soStatus` is the order's status now: CONFIRMED, or DRAFT when the confirm was refused. A resend
  reads the stored one.
- `confirmRefused` (`code`, `field`, `message`, and `user` when `fixed.error_message` words the
  code): why the order stayed DRAFT. `null` when confirmed, and on a resend.
- `warnings[]`: the confirm's `SALES_RESERVE_SHORT` shortfalls, the desktop `ReservationShort`
  shape (`code`, `line`, `short`, `message`), each worded with `user` like any success-body warning.
  `[]` on a resend and when kept DRAFT.
- `soIsDeleted` = the office has deleted it since.
- `whatsapp` (only when WhatsApp on Post was asked for): `{ wmlId, accYear, status:
  SENDING|SKIPPED|FAILED|NOT_CONNECTED, errorCode?, fallbackClickToChat? }`, as `/sale-orders/post`.

Errors are the desktop's (`SALE_ORDER_*`, `SALES_*`), shaped by `SaleOrderExceptionFilter`, plus
the `MOBILE_*` codes above ([`mobile-error-codes.ts`](../common/mobile-error-codes.ts), worded in
`prisma/seed/Error_Messages.json`).

A new order is announced on the data-change feed as `sale-orders`, so open desktop order lists
re-read. The write interceptor also announces `orders` itself.

## Tests

- Unit: [`dto/mobile-order.dto.spec.ts`](dto/mobile-order.dto.spec.ts) covers the refused keys,
  the required ones and the optional `soBranchId`;
  [`mobile-order.service.spec.ts`](mobile-order.service.spec.ts) covers the branch choice (sent,
  refused, absent), a resend that carries another branch, and the confirm: the phone options, the
  savepoint, the DRAFT fallback on a coded refusal, an unexpected error failing the upload, a
  resend that does not confirm, the item's godown (filled per item and unit, a sent one kept, none), and WhatsApp on
  Post (fired after the commit for a confirm only, never failing the upload), and the desktop's
  figures (the lookup asked per line, a line it cannot price, a key the phone sent kept);
  [`mobile-order-desktop-fill.spec.ts`](mobile-order-desktop-fill.spec.ts) covers the formulas. `sale-order-lifecycle.service.spec.ts` ("postInTx from the phone")
  proves the skipped right is the phone's only and the desktop still answers 403.
- HTTP, live dev DB: `test/mobile-items-orders-visits-http.e2e-spec.ts`
  (`npx jest --config ./test/jest-e2e.json --runInBand test/mobile-items-orders-visits-http.e2e-spec.ts`).
  - `WaPostHook` is stubbed there (it records the events), so a company that ticks Sales Order
    in `whatsapp.on_post_types` can never get a real message from a test order.
  - It checks the server-filled columns, the confirm (status, trail, audit notes, WhatsApp on Post
    asked once, a reservation in a named godown and one in the item's own godown), a login without the Post right confirmed (and still refused by
    `/sale-orders/post`), the DRAFT fallback, a resend, two simultaneous copies (one order), a
    reused uuid, the three device refusals, the whitelist, a no-token upload (confirmed), and the
    picked branch (saved in it, another company's branch refused, a resend keeping its branch).
  - The phone is the sales harness device `E2E-SALES-HARNESS`. Confirmed test orders are cancelled
    through `POST /sale-orders/cancel` (it releases the reservations); drafts are deleted through
    `DELETE /sale-orders/delete`.
