"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const receipt_exception_filter_1 = require("./receipt-exception.filter");
const receipt_service_1 = require("./receipt.service");
const receipt_posting_service_1 = require("./receipt-posting.service");
const receipt_cancel_service_1 = require("./receipt-cancel.service");
const receipt_amend_service_1 = require("./receipt-amend.service");
const open_items_service_1 = require("./open-items.service");
const open_item_dto_1 = require("./dto/open-item.dto");
const amend_receipt_dto_1 = require("./dto/amend-receipt.dto");
const save_receipt_dto_1 = require("./dto/save-receipt.dto");
const post_receipt_dto_1 = require("./dto/post-receipt.dto");
const receipt_response_dto_1 = require("./dto/receipt-response.dto");
const receipt_utils_1 = require("./receipt.utils");
let ReceiptController = class ReceiptController {
    receiptService;
    postingService;
    cancelService;
    amendService;
    openItemsService;
    recompute;
    constructor(receiptService, postingService, cancelService, amendService, openItemsService, recompute) {
        this.receiptService = receiptService;
        this.postingService = postingService;
        this.cancelService = cancelService;
        this.amendService = amendService;
        this.openItemsService = openItemsService;
        this.recompute = recompute;
    }
    async openItems(query) {
        const data = await this.openItemsService.listOpenItems(query);
        return {
            success: true,
            message: `${data.bills.length} open bill(s) and ${data.credits.length} credit(s) for ${data.party.ledName}`,
            data,
        };
    }
    async partyContext(query) {
        const data = await this.openItemsService.partyContext(query);
        return { success: true, message: 'Party context fetched successfully', data };
    }
    async get(query) {
        const data = await this.receiptService.get(query);
        return { success: true, message: 'Receipt fetched successfully', data };
    }
    async adjacent(query) {
        const data = await this.openItemsService.adjacent(query);
        return {
            success: true,
            message: data.voucher
                ? `${data.voucher.voucherRefno ?? data.voucher.voucherId} is the ${query.direction} receipt`
                : `No ${query.direction} receipt — this is the end of the register`,
            data,
        };
    }
    async duplicateCheck(query) {
        const data = await this.openItemsService.duplicateCheck(query);
        return {
            success: true,
            message: data.isDuplicate
                ? `${data.matches.length} receipt(s) already taken from this party for this amount on this date`
                : 'No matching receipt — this does not look like a duplicate',
            data,
        };
    }
    async create(dto) {
        const data = await this.receiptService.save(dto);
        return {
            success: true,
            message: data.expectedRoles.length > 0
                ? `Receipt draft saved — this party normally also needs ${data.expectedRoles.join(', ')}`
                : 'Receipt draft saved successfully',
            data,
        };
    }
    async postReceipt(dto) {
        const data = await this.postingService.post(dto);
        const pdcCount = data.numberedVouchers.filter((voucher) => voucher.isPdcVoucher).length;
        return {
            success: true,
            message: `Receipt ${data.header.avhVoucherRefno} posted` +
                (pdcCount > 0 ? ` with ${pdcCount} post-dated cheque voucher(s)` : ''),
            data,
        };
    }
    async updateHeader(dto, body) {
        const data = await this.receiptService.updateHeader(dto, body);
        return { success: true, message: 'Receipt header updated successfully', data };
    }
    async cancel(dto) {
        const data = await this.cancelService.cancel(dto);
        return {
            success: true,
            message: `Receipt ${data.avhVoucherRefno} cancelled — ${data.reversals.length} voucher(s) reversed`,
            data,
        };
    }
    async delete(dto) {
        const data = await this.receiptService.deleteDraft(dto);
        return {
            success: true,
            message: 'Draft receipt deleted' +
                (data.tendersDeleted > 0 ? ` — ${data.tendersDeleted} tender row(s) removed` : ''),
            data,
        };
    }
    async amend(dto) {
        const data = await this.amendService.amend(dto);
        return {
            success: true,
            message: `Receipt ${data.header.avhVoucherRefno ?? data.header.avhVoucherId} amended — now ` +
                `revision ${data.toRevision}`,
            data,
        };
    }
    async regularise(dto) {
        const result = await this.recompute.regularisePostDated({ companyId: dto.companyId, branchId: dto.branchId, accYear: dto.accYear }, dto.asOf ? (0, receipt_utils_1.toDateOnly)(dto.asOf) : new Date());
        const data = { ...result, companyId: dto.companyId };
        return {
            success: true,
            message: `${data.billsRegularised} of ${data.billsExamined} bill(s) regularised as at ${data.asOf}`,
            data,
        };
    }
};
exports.ReceiptController = ReceiptController;
__decorate([
    (0, common_1.Get)('open-items'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Everything a party owes and everything of theirs the company holds',
        description: 'The ONE answer to that question — /transactions/party-balance calls the same code for its ' +
            'credit panel, so the two cannot disagree.\n\n' +
            'No accounting year: acc_bill_balance is partitioned by the year a bill ORIGINATED in and ' +
            'is never carried forward, so filtering on this year would hide every bill raised before ' +
            'it. No branch: a customer pays one cheque for bills raised at three. **No paging**: a ' +
            'capped list is a wrong collection, not a slow one.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: receipt_response_dto_1.OpenItemsSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.ListOpenItemsQueryDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "openItems", null);
__decorate([
    (0, common_1.Get)('party-context'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: "The party's last ten receipts and the cheques of theirs still in flight",
        description: 'The two side panels of the 3.0 screen. Read-only, and small by construction, so there is ' +
            'no cap: a party with a hundred uncleared cheques is a collections problem the panel should ' +
            'show, not hide behind a "more" button.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: receipt_response_dto_1.PartyContextSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.PartyContextQueryDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "partyContext", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One receipt in full',
        description: 'Header, tenders, other-ledger lines, legs (each with avRole), allocations, credits ' +
            'applied, cheques, the post-dated vouchers and the advance bills. A POSTED receipt paints ' +
            'read-only from this, and it is what the RECEIPT_VOUCHER print purpose reads.\n\n' +
            'On a **DRAFT**, allocations[] and creditsApplied[] are what /receipts/create REMEMBERED — ' +
            'no adjustment row exists, so every row carries `abjId: null`. They are a suggestion: ' +
            'nothing re-checks them, so an amount may exceed what its bill can still take. Re-read ' +
            '/receipts/open-items and clamp. One more difference on a draft — a creditsApplied row ' +
            'names the CREDIT in billId with againstBillId null, because which invoices it settles is ' +
            "the allocation engine's decision at post.\n\n" +
            'Each allocations[] / creditsApplied[] row carries the BILL it names — `billAmount`, ' +
            '`pendingAmount` (as it stands NOW, after this receipt), `dueDate`, `billType` and ' +
            '`status` — because a posted receipt is painted from this payload alone and must not call ' +
            '/receipts/open-items: what a receipt shows is what it DID, not what the party owes ' +
            'today.\n\n' +
            "allocations[] is the voucher's HISTORY, not its current state. acc_bill_adjustment never " +
            'rewrites a row and never soft-deletes one, so an AMENDED receipt answers with the ' +
            'original row, its exact negative and the replacement — three rows against one bill. NET ' +
            'PER BILL before painting; `reversalOfId` and `isReversed` say which row retracted ' +
            'which.\n\n' +
            'A settlement, its discount, its write-off and its round-off are four rows against ONE ' +
            'bill, each with its own `adjType`. Route by it — there are no `discount` / `writeoff` ' +
            'fields.\n\n' +
            'avhAccYear is not optional: acc_voucher_header is partitioned on the year, so an id alone ' +
            'does not name a row.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: receipt_response_dto_1.ReceiptSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_receipt_dto_1.GetReceiptQueryDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('adjacent'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The receipt entered just before or just after this one',
        description: "R-B4 — 3.0's Ctrl+PgUp / Ctrl+PgDown. Without it every reopen is a search.\n\n" +
            'Returns a KEY, not a receipt: the client calls /receipts/get with it, which is what it ' +
            'was going to do next anyway, and the walk stays cheap enough to hold a key down on.\n\n' +
            '**prev is the receipt entered BEFORE this one; next is the one entered after.** Both are ' +
            'named for the ordering key — (voucher date, then voucher no) — and not for the direction ' +
            'the register happens to be drawn in, which is descending today and is a display choice.\n\n' +
            'Pass back the same `status` and date window the register was run with, so the walk visits ' +
            'exactly the rows the operator can see. The structural filters are always applied: receipt ' +
            'vouchers only, not deleted, and post-dated cheque vouchers excluded — those belong under ' +
            'their receipt and are not rows of the register.\n\n' +
            '`voucher` is **null at the end of the walk**, and that null is what greys the key out. ' +
            'There is no separate hasNext flag: a second thing saying the same thing is a second thing ' +
            'to keep true.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: receipt_response_dto_1.AdjacentVoucherSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.AdjacentVoucherQueryDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "adjacent", null);
__decorate([
    (0, common_1.Get)('duplicate-check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Has this party already paid this amount on this date?',
        description: 'R-B6. On a beat run this is the only thing between a re-key and a double receipt.\n\n' +
            '**A WARNING, never a refusal.** It writes nothing and has no opinion: a customer settling ' +
            'two invoices with two equal cheques on one day is ordinary, so the answer goes to the ' +
            'operator and the operator decides. A 200 with an empty `matches` is the common case.\n\n' +
            'The amount is matched EXACTLY — Σ of the tender rows, the figure that becomes ' +
            'avh_doc_amount. A tolerance sounds safer and is not: on a beat where the day is 500, 1000 ' +
            'and 2000 over and over it would fire on nearly every row, and a prompt that fires on ' +
            'nearly every row is one nobody reads.\n\n' +
            'Scoped to the company and the year; `branchId` narrows it only if you send it, because a ' +
            're-key that landed on another branch is still a duplicate and is the one hardest to find ' +
            'by hand. CANCELLED receipts and post-dated cheque vouchers are excluded.\n\n' +
            'Send `excludeVoucherId` as soon as /create has returned one, or the draft on screen ' +
            'reports itself on every re-check.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: receipt_response_dto_1.DuplicateCheckSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.DuplicateCheckQueryDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "duplicateCheck", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save a draft receipt',
        description: 'Upsert on avhVoucherId. Writes the header (DRAFT, NO number — an abandoned draft must ' +
            'leave no gap in the series), the tender rows with td_voucher_id NULL, and the ' +
            'other-ledger lines into avh_draft_lines.\n\n' +
            '**Nothing touches a bill and nothing touches acc_vouchers** (R10). Allocation happens at ' +
            'post, against what is pending then.\n\n' +
            'tdIsPdc is never sent — it is computed from tdInstrumentDate against the receipt date. ' +
            'BANK_CHARGES and SURCHARGE_RECOVERED lines are seeded from the tenders if the client omits ' +
            'them, and refused if the client sends figures that disagree.\n\n' +
            '**allocations[] and creditsApplied[] are REMEMBERED, not applied.** Send the bill-wise ' +
            'settlement as the operator left it and /receipts/get hands it back when the draft is ' +
            'reopened, so a split or a deliberately out-of-order settlement is not re-keyed by hand. ' +
            'Still no acc_bill_adjustment row and still no movement in abl_pending_amount — R10 is ' +
            'unchanged, and two people may hold drafts against the same party without reserving each ' +
            "other's outstanding.\n\n" +
            '**Nothing about them is validated, deliberately.** A remembered figure goes stale if ' +
            'somebody else settles the same bill in the meantime, and it is handed back exactly as ' +
            'stored: re-read /receipts/open-items on reopen and clamp. Refusing the load would cost the ' +
            'operator the whole draft to save one number. Omit either key to leave what is already ' +
            'remembered alone; send [] to clear it.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.ReceiptDraftSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_receipt_dto_1.SaveDraftReceiptDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post the receipt — the one-way door',
        description: 'ONE transaction, fifteen ordered steps. Everything in the body is a PREVIEW: the server ' +
            're-reads every bill under a row lock, re-runs the allocation engine and refuses a ' +
            'mismatch — including an onAccount that disagrees with its own, which is the single figure ' +
            'that proves the client and the server read the same receipt.\n\n' +
            "Writes: the receipt's legs; one voucher per POST-DATED cheque, dated the cheque and " +
            'numbered in its own right; one acc_pdc_register row per cheque; the adjustment rows; one ' +
            'ADVANCE bill per voucher with a remainder; and the bill caches, recomputed.\n\n' +
            'A post-dated row is written today and counts only when its date arrives — which is why a ' +
            'cheque dated today settles immediately and one dated next week leaves the bill open.\n\n' +
            'Two concurrent posts against one bill: one gets a 409 naming the bill and its current ' +
            'pending amount, never a 500.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.ReceiptPostSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_receipt_dto_1.PostReceiptDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "postReceipt", null);
__decorate([
    (0, common_1.Put)('update-header'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Change the narration and references on a posted receipt',
        description: 'The ONLY edit a posted receipt accepts: remarks, the two reference numbers, the document ' +
            'date and the salesman. Money is changed by cancelling and re-entering (R3).\n\n' +
            'A body carrying anything else — tenders, allocations, an amount — is a 400 and not a ' +
            'silent ignore: a client that believes it changed the money must be told that it did not.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: receipt_response_dto_1.ReceiptHeaderSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_receipt_dto_1.UpdateReceiptHeaderDto, Object]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "updateHeader", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Reverse a posted receipt',
        description: 'A reversal voucher for the receipt AND for every post-dated cheque voucher, with mirrored ' +
            'legs; a negative adjustment row for every row the post wrote; the advance bills soft ' +
            'deleted; the register rows CANCELLED; the tender rows soft deleted; and the originals ' +
            'CANCELLED, keeping their numbers.\n\n' +
            'Refused when any cheque has gone past HELD — deposited money is unwound on the Received ' +
            'Cheques screen — and refused when the on-account balance has already been spent.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.ReceiptCancelSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_receipt_dto_1.CancelReceiptDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Throw a draft away',
        description: 'DRAFT only, and the four keys only — there is no reason field, because there is nothing ' +
            'to justify. A draft took no number, touched no bill and wrote nothing into acc_vouchers ' +
            '(R10), so abandoning one is abandoning a piece of paper on a desk.\n\n' +
            'Soft-deletes the header, its tender rows and the other-ledger lines in one transaction. ' +
            'avh_voucher_status is left at DRAFT: the row leaves play through avh_is_deleted, and the ' +
            'trail is a DELETED event in txn_status_log, which is the distinction that keeps an ' +
            'abandoned draft out of the cancelled list.\n\n' +
            'A POSTED receipt is a 409 naming /cancel — money in the books is reversed, never removed ' +
            '— and a CANCELLED one is a 409 too. This route exists because /cancel refuses a DRAFT, ' +
            'correctly, and without it an abandoned draft would be permanent.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.ReceiptDeleteSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_receipt_dto_1.DeleteReceiptDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('amend'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Restate a posted receipt in place — behind a company setting, default OFF',
        description: 'R20. Takes EXACTLY what /create and /post take together — the same object the screen ' +
            'already assembles — plus the four keys, a baseRevision and an editRemark. ONE ' +
            'transaction: the old money is unwound in place, the bills are recomputed, and §5.2’s ' +
            'fifteen steps re-run from the new payload.\n\n' +
            '**Not a second way to post.** It calls /post’s own transaction rather than reproducing ' +
            'it, so everything /post validates is validated here — including the identity to the ' +
            'paisa and an onAccount that must agree with the server’s own, recomputed against the ' +
            'REOPENED bills.\n\n' +
            '**The document keeps its identity**: same avhVoucherId, same avhVoucherNo, same ' +
            'avhVoucherRefno, POSTED before and POSTED after. No reversal voucher is written and the ' +
            'status never becomes CANCELLED — that is the whole difference from /cancel. ' +
            'avh_revision_no carries the change instead, because a receipt is not a GST document and ' +
            'the customer is holding a slip with that number on it.\n\n' +
            '**baseRevision is mandatory** and is the avhRevisionNo /receipts/get returned. A ' +
            'mismatch is a 409 naming the current revision: an amend carries the WHOLE document, so ' +
            'last-writer-wins would silently undo somebody else’s correction — on ledger legs, not ' +
            'on a master record. Reload on that 409; never retry with the number you were just told.\n\n' +
            '**Refused on exactly what /cancel is refused on**, and no setting makes these ' +
            'negotiable: a cheque DEPOSITED or later, an on-account balance already spent, a locked ' +
            'period or closed year, a receipt that is not POSTED. And refused as a 409 naming the ' +
            'setting key when accounts.allow_posted_amend is off — which is the default, and is the ' +
            'current cancel-and-re-enter model unchanged.\n\n' +
            'audit.audit_log carries the before and after of acc_voucher_header, acc_vouchers, ' +
            'acc_bill_adjustment and acc_pdc_register; txn_status_log reads POSTED → AMENDED → ' +
            'POSTED, carrying the editRemark.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.ReceiptAmendSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [amend_receipt_dto_1.AmendReceiptDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "amend", null);
__decorate([
    (0, common_1.Post)('regularise-pdc'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Bring every matured post-dated settlement into the bills' cached totals",
        description: 'Tally\'s "Regularised". A post-dated adjustment row is written when the receipt posts and ' +
            'counts only once its date arrives, so a bill settled by a cheque maturing today becomes ' +
            'CLOSED without anybody posting anything — this is what makes that visible in the stored ' +
            'columns.\n\n' +
            'Run it from cron just after midnight, **once per company**:\n' +
            '`curl -X POST https://host/api/v1/receipts/regularise-pdc -d \'{"companyId":"…"}\'`\n\n' +
            'It sweeps everything maturing ON OR BEFORE the date, not only on it, so a run after an ' +
            'outage repairs every day that was missed. Idempotent.\n\n' +
            '**companyId is required** (R-B1). This route used to take nothing but `asOf`, so one ' +
            'authenticated call regularised every company in the database — idempotent, and still a ' +
            'write across a tenant boundary.\n\n' +
            '`branchId` and `accYear` are FILTERS and are not the house keys here: omit both on the ' +
            'nightly run. Outstanding is company-wide and a bill raised at one branch is settled at ' +
            'another; and acc_bill_balance is partitioned by the year the bill ORIGINATED in and is ' +
            'never carried forward, so a sweep pinned to this year walks past almost everything.\n\n' +
            '`billsRegularised` counts bills whose stored figures actually MOVED, so a second run over ' +
            'the same data reports 0 — it used to report the size of the batch, which told an operator ' +
            'nothing. `billsExamined` is beside it so that 0 reads as "nothing left to do" rather than ' +
            'as "nothing ran".',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.RegularisePdcSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_receipt_dto_1.RegularisePdcDto]),
    __metadata("design:returntype", Promise)
], ReceiptController.prototype, "regularise", null);
exports.ReceiptController = ReceiptController = __decorate([
    (0, swagger_1.ApiTags)('Receipts'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('receipts'),
    (0, common_1.UseFilters)(receipt_exception_filter_1.ReceiptExceptionFilter),
    __metadata("design:paramtypes", [receipt_service_1.ReceiptService,
        receipt_posting_service_1.ReceiptPostingService,
        receipt_cancel_service_1.ReceiptCancelService,
        receipt_amend_service_1.ReceiptAmendService,
        open_items_service_1.OpenItemsService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], ReceiptController);
//# sourceMappingURL=receipt.controller.js.map