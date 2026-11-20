# Mobile · Receipts

Money collected by the salesman, from the React Native app (VKSMAN). It is the desktop receipt
(menu 99): the upload is saved AND posted by
[`ReceiptPostingService.saveAndPostInTransaction`](../../modules/accountsModule/receipt/receipt-posting.service.ts),
the one-call save-and-post of notes 106, inside a transaction of ours that also holds the resend
check and stamps `avh_client_uuid`. Same allocation engine, same checks, same ledgers, same PDC
vouchers as a desktop receipt.

- **Routes:** `GET /api/v1/mobile/receipts/options`, `GET /api/v1/mobile/receipts/open-bills`,
  `POST /api/v1/mobile/receipts/create`, `GET /api/v1/mobile/receipts/status`. Swagger tag
  `Mobile · Receipts`, docs page `/api/docs/mobile-receipts`. The login itself (its employee and
  rights) is `GET /api/v1/mobile/me`, in [`../me`](../me/README.md).
- **Auth:** `/create` needs a token (401 without one); the login must hold the Post right on menu
  99 Receipt (403 `RCT_RIGHT_POST`, the check `/receipts/create` with `post: true` makes). The login
  is the receipt's user and the audit author. `/open-bills` and `/status` need a token too.
  `/options` is `@OptionalAuth`.
- **Database:** no change for the phone-settled receipt (2026-11-19).
  `accounts.acc_voucher_header.avh_client_uuid` + `ux_avh_client_uuid` (migration
  `20261118120000_mobile_bills_receipts`), read and written with raw SQL only.

## The user's rules

2026-11-17:

1. **Post at once**, like the bill. A refusal saves nothing and is `/receipts/post`'s (`VCH_*`,
   `ACC_*`, `TENDER_*`).
2. **Oldest bills first** for a phone that sends only the money: the server takes the customer's
   open bills in `/receipts/open-items` order (`accounts.receipt_bill_sort`, due date first by
   default), fills each up to what it owes, and holds the rest on account (an ADVANCE bill, R7).
   See [`mobile-receipt-settlement.ts`](mobile-receipt-settlement.ts).

2026-11-19 (canvas page "5b · Receipt (new)", all recommended answers):

- The phone may send **its own settlement** (`allocations[]`, `creditsApplied[]`), as the desktop
  screen keys it: per bill the money and credits, a prompt-payment discount and a round-off.
- **D1, bills moved since the phone's Sync: never refused for `ACC_BILL_MOVED`.** Under the row
  lock, before the engine: each line is capped at what its bill can take now (after its discount and
  round-off); a bill no longer open (paid or cancelled) frees its whole line and drops its discount;
  each credit is capped at what it still holds (the bills it was to pay give that much back, last
  line first); the freed money fills the party's open bills in open-items order, then goes on
  account; a credit never goes on account (cut, last first). Every change is reported in
  `adjusted[]`. See [`mobile-receipt-plan.ts`](mobile-receipt-plan.ts) `reconcilePhonePlan`.
- **D4:** a discount must be at most the PPD suggestion (ppd-slab.ts) for that bill on the receipt
  date, measured on what the bill owes now, or on what the line settles when that is more (a bill
  paid down since Sync is not refused). Else 422 `MOBILE_RECEIPT_DISCOUNT_ABOVE_PPD`. The slabs are
  the company's (`loadSettings(companyId)`), as `/receipts/open-items` and `/open-bills` read them.
  No slabs = no discount.
- **D5:** round-off at most 0.99 per bill, else 422 `MOBILE_RECEIPT_ROUNDOFF_TOO_BIG`.
- **D11 (PDC under ON_CLEARING): not built.** The desktop refuses EVERY receipt under
  `accounts.pdc_posting_mode = ON_CLEARING` (`ReceiptService.assertPostable`, `ACC_PDC_ALLOCATION`,
  "not built yet"), cheque or not, so there is no desktop rule to post the PDC money on account by.
  A phone receipt gets the same refusal. `PDC_ON_CLEARING` is reserved in `adjusted[].reason`.
- **Collector:** `avh_employee_id` = the login's live employee (`user_master.usr_employee_id`). None
  and `accounts.receipt_salesman_mandatory` on (at the receipt's branch, as the post reads it): 422
  `MOBILE_RECEIPT_NO_EMPLOYEE`, field `avhEmployeeId`.

## GET /mobile/receipts/options?companyId=&deviceUid=&branchId=

```json
{
  "companyId": "…",
  "branchId": "…",
  "tenders": [
    {
      "tenderId": "…",
      "typeId": 5,
      "typeCode": "CHEQUE",
      "name": "CHEQUE",
      "shortName": null,
      "needsRef": true,
      "refLabel": "Cheque No",
      "isDefault": false,
      "surchargePerc": "0.000",
      "surchargeAmount": "0.00",
      "requiresBank": true
    }
  ],
  "settings": {
    "receiptBillSort": "DUE_DATE",
    "salesmanMandatory": false,
    "pdcPostingMode": "ON_RECEIPT",
    "ppdEnabled": false
  }
}
```

- `branchId` (optional): the branch picked in Switch company; 422 `MOBILE_BRANCH_NOT_OF_COMPANY`
  when it is not an active branch of the company. Omitted: the device rule (422
  `MOBILE_BRANCH_NOT_RESOLVED`).
- Tenders: the company's live, active `acc_tender_master` rows for that branch or every branch, in
  force today, with a ledger, of **every type the desktop Receipt screen offers**: not CREDIT,
  LOYALTY, TEMP_CR or an adjust tender (ADJUST / its old name RRN), as NexERP
  `ReceiptEntry::loadTenderMasters` leaves them out. `requiresBank` = a cheque (it needs
  `tdBankName`, `tdRefNo`, `tdInstrumentDate`). The surcharge is INSIDE `tdAmount` (notes 107).
- `settings`: `receiptBillSort` and `ppdEnabled` are the company's (the order `/open-bills` lists and
  freed money fills in, and the slabs `ppdSchedule` and D4 read); `salesmanMandatory` and
  `pdcPostingMode` are the receipt branch's (what the post checks).

## GET /mobile/receipts/open-bills?companyId=&page=&pageSize=&withCredits=

```json
{
  "items": [
    {
      "partyId": "…",
      "billId": "…",
      "billAccYear": "2026-2027",
      "billType": "SALES",
      "docRefno": "bil05089",
      "docDate": "2026-11-19",
      "dueDate": "2026-11-24",
      "billAmount": "118.00",
      "pendingAmount": "68.00",
      "daysOverdue": 0,
      "kind": "BILL",
      "paidAmount": "50.00",
      "pdcHeld": "0.00",
      "ppdSchedule": [{ "tillDate": "2026-11-26", "perc": "2.000", "amount": "1.36" }]
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 200,
  "hasMore": false,
  "companyId": "…",
  "onDate": "2026-11-19"
}
```

- Rows and order are `/receipts/open-items`'s (`OpenItemsService.listCompanyOpenBills`): live, active
  DR bills of a receivable type with something pending, by party, then in `receipt_bill_sort` order,
  then by id. **Customers only** (the user's call, 2026-11-17). `pageSize` 1-500, default 200.
- `paidAmount` = `billAmount - pendingAmount`. `pdcHeld` = post-dated cheque money promised against
  the bill, not yet matured (open-items' figure). `ppdSchedule` = the PPD steps still ahead of
  `onDate`; for a receipt dated D the phone takes the FIRST step with `tillDate >= D` (none = no
  discount). Each step's `amount` is exactly ppd-slab's suggestion on that date (on today's
  pending), the D4 ceiling. `[]` without slabs.
- **`withCredits=true`** (opt-in, so an older phone's list is unchanged): each customer's held
  credits follow its bills (`OpenItemsService.listCompanyOpenCredits`, the rows of open-items'
  credit list, oldest first), with `kind` ADVANCE / SALES_RETURN / OPENING_CR / JOURNAL_CR,
  `pendingAmount` = what is still held (always > 0), `paidAmount` = what is used, `pdcHeld`
  "0.00", `daysOverdue` 0, `ppdSchedule` []. **Paging:** `total` and the pages then count the credit
  rows too, so a page may end mid-party; the order (party, bills, credits, id) is stable between
  reads.

## POST /mobile/receipts/create

| Key                          |                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avhClientUuid`              | required: the phone's own id for the receipt                                                                                                                                 |
| `deviceUid`                  | required: the registered phone                                                                                                                                               |
| `avhCompanyId`, `avhPartyId` | required: the customer id is its ledger id (one partyId)                                                                                                                     |
| `avhBranchId`                | optional: the Switch company branch (422 `MOBILE_BRANCH_NOT_OF_COMPANY`); omitted = device rule                                                                              |
| `avhVoucherDate`             | optional, YYYY-MM-DD; today (the database's IST date) when omitted                                                                                                           |
| `avhUsrRefno`                | optional: the phone's own receipt number, kept as is                                                                                                                         |
| `avhDocRefno`, `avhDocDate`  | optional: the shop's own receipt no. and date. 409 `VCH_DUP_DOC_REFNO` when a live (not cancelled) receipt of this customer in this year has it (`ux_avh_doc_refno`)         |
| `avhRemarks`                 | optional                                                                                                                                                                     |
| `tenders[]`                  | at least one: `tdTenderId`, `tdTenderTypeId`, `tdAmount`, `tdRefNo`, `tdBankName`, `tdInstrumentDate`, `cheque` (`drawerName`, `bankBranch`, `ifsc`, `micr`, `bankLedgerId`) |
| `allocations[]`              | optional: `billId`, `billAccYear`, `amount` (money + credits on the bill, not the discount or round-off), `discount`, `roundoff`                                             |
| `creditsApplied[]`           | optional: `billId`, `billAccYear`, `amount`                                                                                                                                  |
| `onAccount`                  | optional, the phone's figure: informational, never refused on a mismatch                                                                                                     |

Anything else is a 400 `VALIDATION_WHITELIST`: `avhVoucherId`, `avhAccYear`, `avhTenantId`,
`avhDeviceType`, `avhDeviceId`, `avhSessionId`, `avhUserId`, `avhEmployeeId`, `otherLines`,
`otherLineBills`, `post`, `replace`, an allocation's `writeoff` / `writeoffApprovedBy` (a phone
never writes off), and on a tender `tdId`, `tdRowNo`, `tdTenderLedgerId`, `tdMdrAmt`, `tdSurcharge*`,
`tdReceivedAmt`, `tdChangeAmt`, `tdAuthCode`, `tdCardLast4`, `tdPayerVpa`, `tdNotes`.

**Which settlement:**

| The body has                                              | The server                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| neither `allocations` nor `creditsApplied` (older phones) | fills the open bills oldest first with the money, exactly as before (rule 2)                          |
| `allocations` (even `[]`)                                 | posts the phone's settlement, adjusted by D1; `[]` = every rupee on account                           |
| `creditsApplied` but no `allocations` key                 | money and credits fill the open bills oldest first (`fillAll`); credits the bills cannot take are cut |

A bill or credit named twice is 400 `ACC_INVALID` (the engine's). A named bill that is missing,
another party's or company's, or of the wrong kind keeps the desktop refusal (`VCH_BILL_*`); a
cancelled one is D1's (dropped). A phone that allocates more than it collected gets the engine's
400 `VCH_UNBALANCED`. A receipt with no instrument (credits only) is refused: the DTO needs one
tender, and the desktop post refuses one without (`ACC_NO_TENDER`, "a journal, not a receipt").

### What the server fills

| Field             | From                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| branch            | `avhBranchId`, else as the bill (422 `MOBILE_BRANCH_NOT_RESOLVED`)                                       |
| acc year          | the financial year holding the date (422 `MOBILE_NO_FISCAL_YEAR`)                                        |
| device            | `avhDeviceType` MOBILE, `avhDeviceId` = the phone's `dev_id` (403 `MOBILE_DEVICE_*`)                     |
| user              | the login                                                                                                |
| collector         | `avhEmployeeId` = [the login's live employee], or none (422 `MOBILE_RECEIPT_NO_EMPLOYEE` when mandatory) |
| `tdRowNo`         | the instrument's position, 1, 2, …                                                                       |
| settlement        | see the table above, decided under the row lock between the draft save and the post                      |
| onAccount         | what is left (the server's figure wins)                                                                  |
| `avh_client_uuid` | `avhClientUuid`, on the receipt's own header only, never its post-dated cheque vouchers or a reversal    |

The desktop change this needed: `ReceiptSettlementOf` (the callback `saveAndPostInTransaction`
calls between the draft and the post) may now answer `creditsApplied` too.

## Answer (create, and a resend)

```json
{
  "avhVoucherId": "…",
  "avhCompanyId": "…",
  "avhBranchId": "…",
  "avhAccYear": "2026-2027",
  "avhVoucherRefno": "rct00129",
  "avhUsrRefno": "ZT-MOBRC-132057",
  "avhVoucherDate": "2026-11-19",
  "avhDocAmount": "36.00",
  "avhVoucherStatus": "POSTED",
  "allocations": [
    {
      "billId": "…",
      "billAccYear": "2026-2027",
      "docRefno": "bil05090",
      "amount": "118.00",
      "discount": "0.00",
      "roundoff": "0.00",
      "pendingAmount": "0.00"
    }
  ],
  "onAccount": "18.00",
  "duplicate": false,
  "avhIsDeleted": false,
  "creditsApplied": [
    {
      "billId": "…",
      "billAccYear": "2026-2027",
      "docRefno": "rct00126",
      "amount": "100.00",
      "pendingAmount": "0.00"
    }
  ],
  "pdcVouchers": [],
  "adjusted": [
    {
      "billId": "…",
      "billAccYear": "2026-2027",
      "docRefno": "bil05089",
      "planned": "68.00",
      "applied": "0.00",
      "reason": "BILL_SETTLED"
    },
    {
      "billId": "…",
      "billAccYear": "2026-2027",
      "docRefno": "rct00126",
      "planned": "150.00",
      "applied": "100.00",
      "reason": "CREDIT_REDUCED"
    }
  ],
  "employeeId": null
}
```

- `allocations` / `creditsApplied` / `onAccount` are what the receipt settles NOW (read from
  `/receipts/get`'s payload): a bill's `amount` is its money and credits, `discount` and `roundoff`
  apart; a receipt the office cancelled answers empty lists.
- `pdcVouchers`: each post-dated cheque's own voucher (`chequeDate` = its date).
- `adjusted`: the phone's plan against what the receipt settles now, for a fresh upload and a resend
  alike (`adjustedAgainstPlan`): BILL_SETTLED (nothing posted on the bill), BILL_REDUCED (less money,
  discount or round-off), CREDIT_REDUCED; `PDC_ON_CLEARING` is reserved (D11). Empty for an older
  phone and once the receipt is cancelled. A bill that got MORE (freed money) is not listed; it is in
  `allocations`.
- `employeeId`: the collector on the receipt (`avh_employee_id[1]`).

## GET /mobile/receipts/status?companyId=&deviceUid=&since=&page=&pageSize=

```json
{
  "items": [
    {
      "avhClientUuid": "…",
      "avhVoucherId": "…",
      "avhAccYear": "2026-2027",
      "avhVoucherRefno": "rct00126",
      "avhVoucherStatus": "CANCELLED",
      "cancelledOn": "2026-11-19T07:52:22.630Z",
      "cancelReason": "ZT MOBILE RECEIPT TEST 132057",
      "pdc": [
        {
          "voucherId": "…",
          "voucherRefno": "rct00127",
          "instrumentNo": "Z132057",
          "chequeDate": "2026-11-29",
          "amount": "50.00",
          "status": "CANCELLED",
          "houseStatus": "CANCELLED",
          "isPostDated": true
        }
      ],
      "updatedOn": "2026-11-19T07:52:22.630Z"
    }
  ],
  "total": 10,
  "page": 1,
  "pageSize": 200,
  "hasMore": false,
  "companyId": "…",
  "asOf": "2026-11-19T07:47:10.249Z"
}
```

This phone's receipts: a client uuid and `avh_device_id` = the phone's `dev_id` (403
`MOBILE_DEVICE_*` for an unknown phone). `updatedOn` = the latest of the header's created /
modified / status times and its cheques'; `since` keeps those at or after it (inclusive), oldest
change first, then by id. A receipt's cheques are found as `receipt-cheque-links.ts` finds them
(the receipt's voucher or its own PDC vouchers, or the tender row they came in on). `status`:
HELD (register HELD or DEPOSITED), CLEARED, BOUNCED, CANCELLED (RETURNED, CANCELLED, REPLACED);
`houseStatus` is `apd_status` as is. `asOf` = the read's time less five minutes (a posting
transaction stamps its times when it starts and may run two minutes): send it back as `since`; a
few rows come twice, never one missed.

## Resend safety

As the bill: an advisory lock on (`receipt`, company, client uuid), a look-up in any year and any
state, `duplicate: true` with nothing written (the answer read back from the database, `adjusted`
included), 409 `MOBILE_CLIENT_UUID_REUSED` for another customer, and a client-uuid unique clash
answered as a resend. A `ux_avh_doc_refno` clash that slips past the check is the same 409
`VCH_DUP_DOC_REFNO`.

## Tests

- Unit: [`dto/mobile-receipt.dto.spec.ts`](dto/mobile-receipt.dto.spec.ts),
  [`mobile-receipt-settlement.spec.ts`](mobile-receipt-settlement.spec.ts),
  [`mobile-receipt-plan.spec.ts`](mobile-receipt-plan.spec.ts) (D1, D4, D5, credits, fillAll,
  adjusted), [`mobile-receipt-ppd.spec.ts`](mobile-receipt-ppd.spec.ts),
  [`mobile-receipt.service.spec.ts`](mobile-receipt.service.spec.ts) (older phones, collector,
  branch, shop number, the phone plan, `allocations: []`, resend, open-bills with credits),
  [`mobile-receipt-status.service.spec.ts`](mobile-receipt-status.service.spec.ts).
- HTTP, live dev DB: `test/mobile-bills-receipts-http.e2e-spec.ts` (with the bills). It grants
  tester1 menu 99 and cancels every receipt it posts.
