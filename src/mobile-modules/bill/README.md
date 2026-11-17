# Mobile · Bills

Sales bills from the React Native salesman app. It is the desktop bill: the upload is saved AND
posted by [`BillLifecycleService.saveAndPostInTx`](../../modules/sales/bill/bill-lifecycle.service.ts),
the one-call save-and-post of notes 106, inside a transaction of ours that also holds the resend
check and stamps `sb_client_uuid`.

- **Routes:** `GET /api/v1/mobile/bills/options`, `POST /api/v1/mobile/bills/create`. Swagger tag
  `Mobile · Bills`, docs page `/api/docs/mobile-bills`.
- **Auth:** `/create` needs a token (401 `AUTH_AUTHORIZATION_MISSING` without one), because posting
  judges the login's menu-12 rights. The login is `sb_user_id` and the audit author. `/options` is
  `@OptionalAuth`, like the other mobile reads.
- **Database:** `sales.sale_bill.sb_client_uuid` + `ux_sb_client_uuid` (migration
  `20261118120000_mobile_bills_receipts`). Read and written with raw SQL only.

## The user's rules (2026-11-17)

1. **Post at once.** A phone bill is saved and posted in one call. Stock and the customer's
   balance change at upload. A refusal leaves nothing saved and burns no number, and it is exactly
   what `/bills/post` answers: `SALES_RIGHT_POST` without the Post right on menu 12, the stock /
   credit-limit / rate codes, the WARN list (`overrides[]` works as on the desktop).
2. **The salesman picks the godown.** Every line names `sbiGodownId`, from `/options`.
3. **VK Nex numbers the bill** from the branch's Sales Bill series (a phone bill is WHOLESALE, so
   never a POS device series). The phone's own number (`A1B2/2627/00001`) is sent as `sbUsrRefno`
   and kept there; the answer returns VK Nex's `sbBillRefno`.

## GET /mobile/bills/options?companyId=&deviceUid=

```json
{
  "companyId": "…",
  "branchId": "…",
  "godowns": [{ "godownId": "…", "name": "namakkal", "shortName": "nkl", "isDefault": true }]
}
```

The branch is resolved exactly as the upload resolves it (below). Godowns are that branch's live,
active `inventory.godown_locations` rows, the branch default (`br_default_godown_id`) first.
Refusals: 404 `MOBILE_COMPANY_NOT_FOUND`, 403 `MOBILE_DEVICE_*`, 422 `MOBILE_BRANCH_NOT_RESOLVED`.

## POST /mobile/bills/create

The desktop `/bills/create` body (`sb*`, with `items[]` of `sbi*`), plus `sbClientUuid` (required,
the phone's own id for the bill) and `deviceUid` (required). `items` needs at least one line, and
every line its `sbiGodownId`. `sbBillType` may be omitted; if sent it must be `CREDIT` (a phone bill
carries no tenders).

These keys are **refused** (400 `VALIDATION_WHITELIST`):

- header: `sbId`, `sbBranchId`, `sbTenantId`, `sbAccYear`, `sbSessionId`, `sbCounterId`,
  `sbDeviceType`, `sbDeviceId`, `sbBillSlno`, `sbBillRefno`, `sbBillMode`, `sbStatus`, `post`,
  `sbPostedVoucherId`, `sbDocRegisterId`, `sbApprovedOn`, `sbApprovedBy`, `sbCancelReason`,
  `sbVersionNo`, `sbPrintCount`, `sbRevisionNo`, `sbCogsAmt`, `sbDeliveryStatus`,
  `sbLoyaltyEarned`, `sbLoyaltyRedeemed`, `sbReturnedAmt`, `sbReturnStatus`, `sbHasDc`,
  `sbSrcDocType`, `sbSrcDocId`, `sbSrcDocRefno`, `sbSrcDocDate`, `sbSrcDocYear`, `tenders`,
  `charges`, `adjustments`, `sbCreatedBy`, `sbModifiedBy`, `sbUserId`;
- lines: `sbiId`, `sbiBillId`, `sbiCompanyId`, `sbiBranchId`, `sbiTenantId`, `sbiAccYear`,
  `sbiCogsAmt`, `sbiSrcDocType`, `sbiSrcDocId`, `sbiSrcDocYear`, `sbiSrcDocRefno`,
  `sbiSrcDocLineNo`, `sbiSrcItemQty`, `sbiSrcFreeQty`, `sbiSrcItemId`, `sbiCreatedBy`,
  `sbiModifiedBy`.

### What the server fills

| Column                           | From                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sb_device_id`                   | The registered phone's `dev_id` (by `deviceUid`; 403 `MOBILE_DEVICE_*`). The bill's shadow stock voucher needs a registered device.                                       |
| `sb_device_type`                 | `MOBILE` (its voucher's `avh_device_type` MOBILE).                                                                                                                        |
| `sb_branch_id`                   | The phone's branch when it belongs to `sbCompanyId`, else the company's default branch, else its only branch; 422 `MOBILE_BRANCH_NOT_RESOLVED`.                           |
| `sb_acc_year`                    | The company's financial year holding `sbBillDate` (its date part; today, the database's IST date, when omitted); 422 `MOBILE_NO_FISCAL_YEAR`. `sb_bill_date` is that day. |
| `sb_bill_type`                   | `CREDIT`.                                                                                                                                                                 |
| `sb_user_id`                     | The login.                                                                                                                                                                |
| `sb_bill_slno` / `sb_bill_refno` | The bill's voucher type series, as on the desktop (`sbVchrTypeId` and the device default work as there).                                                                  |
| `sb_status`                      | `POSTED`, through the desktop post.                                                                                                                                       |
| `sb_client_uuid`                 | `sbClientUuid`: stamped on the bill row only (never its voucher), on create only, after the save.                                                                         |

Every line's `sbiGodownId` must be a live, active godown of that branch, else 422
`MOBILE_GODOWN_INVALID` per line (`items.<n>.sbiGodownId`). The desktop save takes any uuid there.

## Resend safety

As the order upload:

1. a transaction advisory lock on (`bill`, company, client uuid);
2. a look-up of a bill with that (company, client uuid) **in any year and any state**, deleted and
   cancelled ones included;
3. a hit answers that bill as it stands now with `duplicate: true` and writes nothing; on another
   customer it is 409 `MOBILE_CLIENT_UUID_REUSED`;
4. otherwise the save and post run and `sb_client_uuid` is stamped, in the same transaction. A
   unique clash on the client-uuid index (the backstop) is answered as a resend too.

## Answer

```json
{
  "sbId": "…",
  "sbCompanyId": "…",
  "sbBranchId": "…",
  "sbAccYear": "2026-2027",
  "sbBillRefno": "bil01300",
  "sbUsrRefno": "A1B2/2627/00001",
  "sbBillDate": "2026-11-17",
  "sbBillAmt": "118.00",
  "sbStatus": "POSTED",
  "duplicate": false,
  "sbIsDeleted": false
}
```

`sbStatus` is the bill's status now (a resend of a bill the office cancelled reads `CANCELLED`).
Errors are the desktop's (`SALES_*`, `VT_*`, `BILL_*`) shaped by `BillExceptionFilter`, plus the
`MOBILE_*` codes ([`mobile-error-codes.ts`](../common/mobile-error-codes.ts), worded in
`prisma/seed/Error_Messages.json`). The write interceptor announces `bills`, the desktop bill
list's own resource.

## Tests

- Unit: [`dto/mobile-bill.dto.spec.ts`](dto/mobile-bill.dto.spec.ts) (refused and required keys),
  [`mobile-bill.service.spec.ts`](mobile-bill.service.spec.ts) (server-filled scope, the stamp, a
  resend, a reused uuid, a bad godown, the unique backstop).
- HTTP, live dev DB: `test/mobile-bills-receipts-http.e2e-spec.ts`
  (`npx jest --config ./test/jest-e2e.json --runInBand test/mobile-bills-receipts-http.e2e-spec.ts`).
  It grants tester1 the sales rights (the sales harness fixture) and cancels every bill it posts.
