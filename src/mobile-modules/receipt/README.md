# Mobile · Receipts

Money collected by the salesman, from the React Native app. It is the desktop receipt: the upload
is saved AND posted by
[`ReceiptPostingService.saveAndPostInTransaction`](../../modules/accountsModule/receipt/receipt-posting.service.ts),
the one-call save-and-post of notes 106, inside a transaction of ours that also holds the resend
check and stamps `avh_client_uuid`.

- **Routes:** `GET /api/v1/mobile/receipts/options`, `GET /api/v1/mobile/receipts/open-bills`,
  `POST /api/v1/mobile/receipts/create`. Swagger tag `Mobile · Receipts`, docs page
  `/api/docs/mobile-receipts`.
- **Auth:** `/create` needs a token (401 without one); the login must hold the Post right on menu
  99 Receipt (403 `RCT_RIGHT_POST`, the check `/receipts/create` with `post: true` makes). The login
  is the receipt's user and the audit author. `/open-bills` needs a token too (customer balances;
  the ledger statement needs a login as well). `/options` is `@OptionalAuth`.
- **Database:** `accounts.acc_voucher_header.avh_client_uuid` + `ux_avh_client_uuid` (migration
  `20261118120000_mobile_bills_receipts`). Read and written with raw SQL only.

## The user's rules (2026-11-17)

1. **Post at once**, like the bill (a DRAFT upload was considered and dropped by the user on
   2026-11-17). A refusal saves nothing and is `/receipts/post`'s (`VCH_*`, `ACC_*`, `TENDER_*`).
2. **Oldest bills first.** The phone sends only the money. The server takes the customer's open
   bills in the order `/receipts/open-items` returns them (`accounts.receipt_bill_sort`, due date
   first by default), fills each up to what it owes, until the money runs out, and holds the rest
   on account (an ADVANCE bill, R7). See [`mobile-receipt-settlement.ts`](mobile-receipt-settlement.ts):
   it only writes the per-bill figures; the allocation engine splits and checks them as on
   `/receipts/post`.

## GET /mobile/receipts/options?companyId=&deviceUid=

```json
{
  "companyId": "…",
  "branchId": "…",
  "tenders": [
    {
      "tenderId": "…",
      "typeId": 3,
      "typeCode": "UPI",
      "name": "UPI",
      "shortName": "UPI",
      "needsRef": true,
      "refLabel": "UTR No",
      "isDefault": false,
      "surchargePerc": "1.000",
      "surchargeAmount": "0.00"
    }
  ]
}
```

The company's live, active `acc_tender_master` rows for that branch or every branch, in force today
(`tnd_effective_from` / `_to`), with a ledger, of type CASH, CARD, UPI, WALLET, CHEQUE or BANK
(never CREDIT, TEMP_CR, LOYALTY, RRN or a gift VOUCHER), in display order. `needsRef` is the
master's flag (else the type's); a CHEQUE always needs `tdRefNo`, `tdBankName` and
`tdInstrumentDate`. The surcharge is INSIDE `tdAmount` (notes 107): 200 by UPI at 1% is tdAmount
202.00, of which 2.00 is surcharge and settles no bill.

## GET /mobile/receipts/open-bills?companyId=&page=&pageSize=

Every customer's open bills in the company, paged (`pageSize` 1-500, default 200), for the phone's
pending-bills screen. Read-only.

```json
{
  "items": [
    {
      "partyId": "…",
      "billId": "…",
      "billAccYear": "2026-2027",
      "billType": "SALES",
      "docRefno": "bil01300",
      "docDate": "2026-11-17",
      "dueDate": "2026-12-17",
      "billAmount": "1180.00",
      "pendingAmount": "680.00",
      "daysOverdue": 0
    }
  ],
  "total": 7,
  "page": 1,
  "pageSize": 200,
  "hasMore": false,
  "companyId": "…",
  "onDate": "2026-11-17"
}
```

The rows and the order are `/receipts/open-items`'s, through
`OpenItemsService.listCompanyOpenBills`: the same `openReceivableWhere` (live, active DR bills of a
receivable type with something pending; `abl_is_deleted` is in it, since a cancelled bill's
generated status still reads OPEN) and the same `openBillOrder` (`accounts.receipt_bill_sort`)
within each party. Ordered by party, then that order, then by id, so a page boundary never moves
between two reads. `daysOverdue` is measured on `onDate`, as open-items measures it. 404
`MOBILE_COMPANY_NOT_FOUND`.

**Customers only** (the user's call, 2026-11-17). A bill is kept only when its party is a live
customer: a `sales.customers` row with `cus_id` = the party id and `cus_is_deleted = false`, active
or not, as `/mobile/customers/list` shows them. A supplier's or any other ledger's receivable (a
purchase return, an opening balance on a non-customer ledger) is left out. `total` counts the
customers' bills only, and `hasMore` / the pages are over that same filtered list.

## POST /mobile/receipts/create

| Key                          |                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avhClientUuid`              | required: the phone's own id for the receipt                                                                                                                                 |
| `deviceUid`                  | required: the registered phone                                                                                                                                               |
| `avhCompanyId`, `avhPartyId` | required: the customer id is its ledger id (one partyId)                                                                                                                     |
| `avhVoucherDate`             | optional, YYYY-MM-DD; today (the database's IST date) when omitted                                                                                                           |
| `avhUsrRefno`                | optional: the phone's own receipt number, kept as is                                                                                                                         |
| `avhRemarks`                 | optional                                                                                                                                                                     |
| `tenders[]`                  | at least one: `tdTenderId`, `tdTenderTypeId`, `tdAmount`, `tdRefNo`, `tdBankName`, `tdInstrumentDate`, `cheque` (`drawerName`, `bankBranch`, `ifsc`, `micr`, `bankLedgerId`) |

Anything else is a 400 `VALIDATION_WHITELIST`: `avhVoucherId`, `avhBranchId`, `avhAccYear`,
`avhTenantId`, `avhDeviceType`, `avhDeviceId`, `avhSessionId`, `avhUserId`, `avhEmployeeId`,
`avhDocRefno`, `avhDocDate`, `otherLines`, `allocations`, `creditsApplied`, `otherLineBills`,
`onAccount`, `post`, `replace`, and on a tender `tdId`, `tdRowNo`, `tdTenderLedgerId`, `tdMdrAmt`,
`tdSurcharge*`, `tdReceivedAmt`, `tdChangeAmt`, `tdAuthCode`, `tdCardLast4`, `tdPayerVpa`, `tdNotes`.
A card's last 4 digits go in `tdRefNo`.

### What the server fills

| Field             | From                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| branch            | as the bill (422 `MOBILE_BRANCH_NOT_RESOLVED`)                                                                                        |
| acc year          | the financial year holding the date (422 `MOBILE_NO_FISCAL_YEAR`)                                                                     |
| device            | `avhDeviceType` MOBILE, `avhDeviceId` = the phone's `dev_id` (403 `MOBILE_DEVICE_*`)                                                  |
| user              | the login                                                                                                                             |
| `tdRowNo`         | the instrument's position, 1, 2, …                                                                                                    |
| allocations       | the open bills, oldest first, under the row lock the post takes (rule 2)                                                              |
| onAccount         | what is left; the post raises it as one ADVANCE bill                                                                                  |
| `avh_client_uuid` | `avhClientUuid`: on the receipt's own header only, never its post-dated cheque vouchers or a reversal; on create only, after the save |

The money the bills can take is the instruments less the CR other-ledger lines the draft save
seeded from them (the surcharge). No credit the customer holds is spent, and no prompt-payment
discount is given.

## Resend safety

As the bill: an advisory lock on (`receipt`, company, client uuid), a look-up in any year and any
state, `duplicate: true` with nothing written, 409 `MOBILE_CLIENT_UUID_REUSED` for another
customer, and a client-uuid unique clash answered as a resend.

## Answer

```json
{
  "avhVoucherId": "…",
  "avhCompanyId": "…",
  "avhBranchId": "…",
  "avhAccYear": "2026-2027",
  "avhVoucherRefno": "RCT00042",
  "avhUsrRefno": "A1B2/RC/2627/00001",
  "avhVoucherDate": "2026-11-17",
  "avhDocAmount": "707.00",
  "avhVoucherStatus": "POSTED",
  "allocations": [
    {
      "billId": "…",
      "billAccYear": "2026-2027",
      "docRefno": "bil01300",
      "amount": "300.00",
      "pendingAmount": "0.00"
    }
  ],
  "onAccount": "0.00",
  "duplicate": false,
  "avhIsDeleted": false
}
```

`allocations` and `onAccount` are what the receipt settles NOW: a resend of a receipt the office
has cancelled reads `CANCELLED` with no allocation and nothing on account. Errors are the
desktop's, shaped by `ReceiptExceptionFilter`, plus the `MOBILE_*` codes. The write interceptor
announces `receipts`, the desktop receipt list's own resource.

## Tests

- Unit: [`dto/mobile-receipt.dto.spec.ts`](dto/mobile-receipt.dto.spec.ts),
  [`mobile-receipt-settlement.spec.ts`](mobile-receipt-settlement.spec.ts),
  [`mobile-receipt.service.spec.ts`](mobile-receipt.service.spec.ts) (the right, the settlement
  through the post's callback, the stamp, a resend, a reused uuid, open-bills paging).
- HTTP, live dev DB: `test/mobile-bills-receipts-http.e2e-spec.ts` (with the bills). It grants
  tester1 menu 99 and cancels every receipt it posts.
