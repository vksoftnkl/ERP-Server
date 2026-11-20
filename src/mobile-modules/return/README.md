# Mobile · Returns

Sale returns made on the salesman's phone (VKSMAN, canvas page "6b · Sales return (new)"). The
contract is `Shared/Prathap/mobile/plan-mobile-sales-return-2026-11-20.md` (decisions D1–D12, all
the recommended answers, user 2026-11-20). The return is the desktop's (menu 13, `/sale-returns`,
[`../../modules/sales/sale-return`](../../modules/sales/sale-return/README.md)): saved through
`SaleReturnService.saveInTx` (the server works out all the money, D45; the SRT number of the phone's
own device, D16; the revision) and posted at once through `postInTx` behind a savepoint, inside a
transaction of ours that also holds the resend check and stamps `sr_client_uuid` /
`sr_mobile_refno`.

- **Routes:** `GET /api/v1/mobile/returns/options`, `GET /bill-lines`, `POST /create`,
  `POST /delete`, `GET /status`. Swagger tag `Mobile · Returns`, docs page
  `/api/docs/mobile-returns`. Plain HTTP on :3011 works (the `mobile/` prefix).
- **Auth:** `/options` is `@OptionalAuth` (`rights` only with a token). Everything else needs a
  token (401). The phone path does **not** need the menu-13 CREATE or EDIT right
  (`SaleReturnSaveOptions.skipSaveRight`, set only here). The post keeps its menu-13 Post right:
  without it the return is HELD. `/delete` keeps the desktop's DELETE right.
- **Database:** migration `20261120170000_mobile_sale_returns`: `sales.sale_return.sr_client_uuid`
  uuid + `ux_sr_client_uuid` UNIQUE (sr_company_id, sr_client_uuid, sr_acc_year), and
  `sr_mobile_refno` varchar(30). Both written with raw SQL only (the Prisma fragment declares them;
  the client is not regenerated for them).

## GET /mobile/returns/options?companyId=&deviceUid=&branchId=

`{ companyId, branchId, reasons[], godowns[], settings, rights }`

- `reasons[]`: `{ reasonId, code, name, defaultCondition, refundCharges, isClaim, sortOrder }`: the
  SALE_RETURN reasons the company sees, as the desktop's dropdown 78 (shared + its own, its own
  winning by code). `isClaim` = the code ends in `_SHOP` (SR_EXPIRED_SHOP, SR_DAMAGED_SHOP, or a
  company row overriding them): the phone hides them (D8). `defaultCondition` is null unless it is
  RESTOCK / DAMAGED / EXPIRED / SCRAP.
- `godowns[]`: `{ godownId, name, isDefault }`, live and active, the branch default first.
- `settings`: `{ returnWindowDays, freeReturnAllowed, settleDefault, expiredLotDays, billDays }`;
  `billDays` = returnWindowDays when above 0, else 90 (D9). `settleDefault` ADVANCE, else ADJUST
  (a CASH setting reads ADJUST: the phone never refunds), null when unset.
- `rights`: `{ create, post }` of menu 13, null without a token.

## GET /mobile/returns/bill-lines?companyId=&deviceUid=&branchId=&since=&page=&pageSize=

Posted, live bills of the branch dated `since` or later (default today − billDays), every
customer of the company, newest first, paged by **bill** (pageSize 1–200, default 50).
`{ asOf, billDays, since, page, pageSize, total, hasMore, companyId, branchId, bills[] }`; each bill
`{ sbId, accYear, refno, date, custId, branchId, billAmount, due, payMode, returnedAmt, returnStatus,
lines[] }`, each line `{ billItemId, accYear, lineNo, itemId, itemName, itemUnitId, unitName,
toBaseFactor, billQty, billQtyBase, returnedQtyBase, qtyLeftBase, onOtherDraftsBase, ratePreTaxBase,
rate, taxPerc, cgstPerc, sgstPerc, igstPerc, lotId, batchNo, expiryDate, godownId, isFree,
allowReturn }`.

The qty figures are read by the desktop's `SaleReturnBillReader` exactly as `/sale-returns/bill-lines`
reads them (no return excluded), so they match it (proved live 2026-11-20). `ratePreTaxBase` = the
line's `sbi_taxable_amt` ÷ its billed base qty, 4 decimals: what a return line gets back per base
unit before tax. Money: 2-decimal text; percentages: 3-decimal text; quantities: numbers.

## POST /mobile/returns/create

Body: `srClientUuid` (v7; also the srId), `deviceUid`, `srCompanyId`, `srBranchId?`, `srCustId`,
`srIsAgainstBill`, `srBillId?` / `srBillAccYear?` (required when against a bill), `srReasonId`,
`srSettleMode` ADJUST | ADVANCE, `srReturnDate?`, `srMobileRefno`, `srUsrRefno?`, `srUsrRefdate?`,
`srRemarks?`, `godownId?`, `adjustments?[] {billId (abl_id), billAccYear, amount}`, `phoneEstimate?`
(any JSON, never read), `lines[] {sriLineNo, sriSplitNo?, sriBillItemId?, sriBillAccYear?, sriItemId,
sriItemUnitId, sriReturnQty, sriCondition, sriRemarks?, sriBatchNo?, sriExpiryDate?}`. No money key.

The server fills: device + counter = the phone's `dev_id` (403 `MOBILE_DEVICE_*`), device type
MOBILE, the branch (422 `MOBILE_BRANCH_*`), the acc year (422 `MOBILE_NO_FISCAL_YEAR`), the login,
kind RETURN, the salesmen (the bill's; no bill: the login's employee when it is the company's), the
price level (no bill: the customer's), each line's godown (`godownId` for every line, else the bill
line's own, else the branch default; 422 `MOBILE_GODOWN_INVALID`). Checked first, nothing saved on a
refusal: 422 `MOBILE_RETURN_CUSTOMER_NOT_FOUND`, `MOBILE_RETURN_REASON_INVALID`,
`SALES_RETURN_BILL_NOT_POSTED` (not a posted bill of the company), `MOBILE_RETURN_BILL_OTHER_CUSTOMER`.

Then the post (D7) behind `SAVEPOINT mobile_return_post`:

| Outcome     | When                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POSTED`    | it went through; `warnings[]` = its INFO / overridden notes                                                                                                                                                  |
| `HELD`      | every refusal is one only the office clears: `TILL_APPROVAL_REQUIRED` (the request is filed for the inbox, no PIN), `SALES_RETURN_WINDOW`, `GST_CREDIT_NOTE_CUTOFF`, `SALES_RETURN_LOT_EXPIRED`, `SALES_RETURN_NO_PRICE`, `SALES_RETURN_SCHEME_SHORT`, `SALES_RIGHT_POST`, `TILL_SESSION_*` |
| `SENT_BACK` | any other refusal (`SALES_RETURN_OVER_QTY`, `_NOT_ON_BILL`, `_ITEM_NOT_ALLOWED`, `_NO_BILL_OFF`, `_SETTLE_MODE`, `SALES_DAY_CLOSED`, `SALES_BACKDATE`, `VCH_*` …)                                            |

HELD / SENT_BACK keep the DRAFT (status `DRAFT`): the post's writes are rolled back to the savepoint.
A throw that is not a coded 4xx (a database error) fails the whole upload, as before.

**D6, Adjust:** `adjustments` omitted = the desktop's own split (this bill first, then the Receipt's
order). Sent (even `[]`) = the phone's split, re-planned against the bills under the post's lock
([`mobile-return-plan.ts`](mobile-return-plan.ts) `replanAdjust`, through the settlement's `replan`
hook): a bill no longer open drops (`BILL_SETTLED`), one owing less is capped (`BILL_REDUCED`), the
split is cut last-first to what the note can adjust (`NOTE_SMALLER`), freed money goes to the open
bills in order (`FREED_MONEY`); the rest stays on the note as credit. `replanned[]` lists every
change `{ billId, billAccYear, refno, from, to, reason }`. ADJUST needs a bill of this branch (the
desktop's `SALES_RETURN_SETTLE_MODE` otherwise: SENT_BACK).

Answer: `{ duplicate, srId, srClientUuid, srReturnRefno, srMobileRefno, srAccYear, srBranchId,
srStatus, status, srReturnAmt, totals{goods, tax, chargesNet, roundOff, creditNote},
settlement{mode, credited, settleStatus, adjusted[{billId, billAccYear, refno, amount}]},
lines[{sriLineNo, sriSplitNo, sriId, rateSource, taxableAmt, taxAmt, netAmt, bucket}], held,
refusal, refusals[], warnings[], replanned[], approval }`. A note is `{ code, message, field, line,
user? }` plus the desktop detail's own keys (`event`, `amount`, `params` …: the wording variant reads
them).

**Resends** (lock on (return, company, uuid), then the uuid looked up in every year, deleted rows
included): POSTED / CANCELLED → answered as it stands, `duplicate: true` (status POSTED, srStatus
the row's); DRAFT → saved again with this body and posted again (a DRAFT with a PENDING approval is
frozen, D77: not re-saved, only posted again; the request is reused); another customer → 409
`MOBILE_CLIENT_UUID_REUSED`; a return deleted in VK Nex → 409 `MOBILE_RETURN_DELETED`.

## POST /mobile/returns/delete

`{ srClientUuid, deviceUid, srCompanyId }` → `{ deleted, srClientUuid, srId, srReturnRefno,
duplicate }`. A DRAFT is deleted through the desktop (DELETE right), its own PENDING approval
request withdrawn first. POSTED: 409 `SALES_DOC_POSTED`; CANCELLED: 409 `SALES_DOC_CANCELLED`;
unknown: `deleted: false`; deleted before: `deleted: true, duplicate: true`.

## GET /mobile/returns/status?companyId=&deviceUid=&since=&page=&pageSize=

The returns this phone uploaded (client uuid set, `sr_device_id` = its dev_id), changed at or after
`since`, oldest change first. `{ asOf, page, pageSize, total, hasMore, companyId, returns[] }`; each
`{ srClientUuid, srId, srAccYear, srReturnRefno, status (DRAFT · POSTED · CANCELLED · DELETED),
approval {status PENDING · APPROVED · REJECTED, note} | null, revisionNo, srReturnAmt, settleStatus,
adjusted[], cancelledOn, cancelReason, updatedOn }`. A change is the row's own or one of its approval
requests'. `asOf` = read time − 5 min: send it back as `since`. A withdrawn request is not shown; an
expired one reads REJECTED.

## Desktop changes this needed (`src/modules/sales/sale-return`)

- `saveInTx(tx, dto, { skipSaveRight, origin })`, `postInTx(tx, dto, { replanAdjust, onWarnings,
  onGateRefused })`, `deleteInTx(tx, keys, { withdrawPendingNote })`, `afterPostCommit(fire)`,
  `fileGateRequestsInTx(tx, gates, note)`. `/create`, `/post`, `/delete` call them with no options.
- `buildSettlement` takes an optional `replan` (`AdjustReplanner`), which replaces the operator's
  split; `checkAdjust` still checks the answer.

Tests: `mobile-return-plan.spec.ts`, `mobile-return.service.spec.ts` (unit); live suite
`Shared/Prathap/mobile/test_mobile_returns_api.py` (44 checks, cancels what it posts).
