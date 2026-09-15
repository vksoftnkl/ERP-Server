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
const open_items_service_1 = require("./open-items.service");
const open_item_dto_1 = require("./dto/open-item.dto");
const save_receipt_dto_1 = require("./dto/save-receipt.dto");
const post_receipt_dto_1 = require("./dto/post-receipt.dto");
const receipt_response_dto_1 = require("./dto/receipt-response.dto");
const receipt_utils_1 = require("./receipt.utils");
let ReceiptController = class ReceiptController {
    receiptService;
    postingService;
    cancelService;
    openItemsService;
    recompute;
    constructor(receiptService, postingService, cancelService, openItemsService, recompute) {
        this.receiptService = receiptService;
        this.postingService = postingService;
        this.cancelService = cancelService;
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
    async regularise(dto) {
        const data = await this.recompute.regularisePostDated(dto.asOf ? (0, receipt_utils_1.toDateOnly)(dto.asOf) : new Date());
        return {
            success: true,
            message: `${data.billsRegularised} bill(s) regularised as at ${data.asOf}`,
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
            'them, and refused if the client sends figures that disagree.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.ReceiptDraftSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_receipt_dto_1.SaveReceiptDto]),
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
    (0, common_1.Post)('regularise-pdc'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Bring every matured post-dated settlement into the bills' cached totals",
        description: 'Tally\'s "Regularised". A post-dated adjustment row is written when the receipt posts and ' +
            'counts only once its date arrives, so a bill settled by a cheque maturing today becomes ' +
            'CLOSED without anybody posting anything — this is what makes that visible in the stored ' +
            'columns.\n\n' +
            'Run it from cron just after midnight:\n' +
            "`curl -X POST https://host/api/v1/receipts/regularise-pdc -d '{}'`\n\n" +
            'It sweeps everything maturing ON OR BEFORE the date, not only on it, so a run after an ' +
            'outage repairs every day that was missed. Idempotent.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: receipt_response_dto_1.RegularisePdcSuccessDto }),
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
        open_items_service_1.OpenItemsService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], ReceiptController);
//# sourceMappingURL=receipt.controller.js.map