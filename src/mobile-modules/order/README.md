# Mobile · Orders

Order upload from the React Native salesman app. It is the desktop order: the save runs through
[`SaleOrderService.createOrderInTx`](../../modules/sales/sale-order/sale-order.service.ts).

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
- `soUserId`: optional, see Auth above;
- `items`: at least one line.

These keys are **refused** (400 `VALIDATION_WHITELIST`), because the server fills them or a phone
order does not carry them:

- header: `soId`, `soBranchId`, `soTenantId`, `soAccYear`, `soSessionId`, `soDeviceId`,
  `soOrderSlno`, `soOrderRefno`, `soStatus`, `post`, `charges`, `tenders`, `soCreatedBy`,
  `soModifiedBy`;
- lines: `soiId`, `soiOrderId`, `soiCompanyId`, `soiBranchId`, `soiTenantId`, `soiAccYear`,
  `soiCreatedBy`, `soiModifiedBy`.

## What the server fills

| Column | From |
| --- | --- |
| `so_device_id` | The phone, looked up by `deviceUid`. Phones are **registered on the Device List screen** like any counter (the user's call, 2026-11-16). An unknown phone is a 403 `MOBILE_DEVICE_NOT_REGISTERED`, a blocked one `MOBILE_DEVICE_BLOCKED`, a switched-off one `MOBILE_DEVICE_INACTIVE`. |
| `so_branch_id` | The phone's branch when it belongs to `soCompanyId`, else the company's default branch, else its only branch. Otherwise a 422 `MOBILE_BRANCH_NOT_RESOLVED`. A salesman may order for several companies. |
| `so_acc_year` | The company's financial year holding `soOrderDate` (YYYY-MM-DD; today, the database's IST date, when omitted). None is a 422 `MOBILE_NO_FISCAL_YEAR`. |
| `so_order_slno` / `so_order_refno` | Voucher type 4, as on the desktop. |
| `so_status` | `DRAFT`. The office confirms it (`/sale-orders/post`), so no stock is reserved from a phone. |
| `so_client_uuid` | `soClientUuid`. |

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

```json
{ "soId": "…", "soOrderRefno": "sor00042", "soStatus": "DRAFT", "soAccYear": "2026-2027",
  "duplicate": false, "soIsDeleted": false }
```

`soStatus` is the order's status now: a resend reads the stored one, which may be CONFIRMED by
then. `soIsDeleted` = the office has deleted it since. Errors are the desktop's (`SALE_ORDER_*`,
`SALES_*`), shaped by `SaleOrderExceptionFilter`, plus the `MOBILE_*` codes above
([`mobile-error-codes.ts`](../common/mobile-error-codes.ts), worded in
`prisma/seed/Error_Messages.json`).

A new order is announced on the data-change feed as `sale-orders`, so open desktop order lists
re-read. The write interceptor also announces `orders` itself.

## Tests

- Unit: [`dto/mobile-order.dto.spec.ts`](dto/mobile-order.dto.spec.ts) covers the refused keys and
  the required ones.
- HTTP, live dev DB: `test/mobile-items-orders-visits-http.e2e-spec.ts`
  (`npx jest --config ./test/jest-e2e.json --runInBand test/mobile-items-orders-visits-http.e2e-spec.ts`).
  - It checks the server-filled columns, a resend, two simultaneous copies (one order), a reused
    uuid, the three device refusals, the whitelist, and a no-token upload.
  - The phone is the sales harness device `E2E-SALES-HARNESS`. Test orders are deleted through
    `DELETE /sale-orders/delete`.
