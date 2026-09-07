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
exports.OpeningStockVoucherController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const stock_voucher_service_1 = require("../stock-voucher/stock-voucher.service");
const save_opening_stock_voucher_dto_1 = require("./dto/save-opening-stock-voucher.dto");
const list_opening_stock_voucher_query_dto_1 = require("./dto/list-opening-stock-voucher-query.dto");
const post_opening_stock_voucher_dto_1 = require("./dto/post-opening-stock-voucher.dto");
const opening_stock_voucher_response_dto_1 = require("./dto/opening-stock-voucher-response.dto");
const OPENING_RULES = {
    voucherType: 'OPENING',
    typeCode: 'OPN',
    displayName: 'Opening stock',
    requiresToGodown: true,
    requiresFromGodown: false,
    isInward: true,
    ledgerTxnType: 'OPENING',
    auditScreenName: 'Opening Stock',
    refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};
let OpeningStockVoucherController = class OpeningStockVoucherController {
    stockVoucherService;
    constructor(stockVoucherService) {
        this.stockVoucherService = stockVoucherService;
    }
    async save(dto) {
        const data = await this.stockVoucherService.save(OPENING_RULES, dto);
        return {
            success: true,
            message: dto.header.svhId
                ? 'Opening stock updated successfully'
                : 'Opening stock created successfully',
            data,
        };
    }
    async listOrLoad(query) {
        if (query.svhId) {
            const data = await this.stockVoucherService.getById(OPENING_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
            return { success: true, message: 'Opening stock fetched successfully', data };
        }
        const data = await this.stockVoucherService.list(OPENING_RULES, query);
        return { success: true, message: 'Opening stock list fetched successfully', data };
    }
    async validate(query) {
        const data = await this.stockVoucherService.validate(OPENING_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
        const failing = data.filter((row) => row.problem !== null).length;
        return {
            success: true,
            message: failing
                ? `${failing} of ${data.length} lines have problems`
                : `All ${data.length} lines are clean`,
            data,
        };
    }
    async post(dto) {
        const data = await this.stockVoucherService.post(OPENING_RULES, dto.svhId, dto.accYear, dto.companyId, dto.branchId, dto.userId);
        return {
            success: true,
            message: `Opening stock posted successfully — ${data.rowsPosted} ledger rows`,
            data,
        };
    }
    async cancel(dto) {
        const data = await this.stockVoucherService.cancel(OPENING_RULES, dto.svhId, dto.accYear, dto.reason, dto.companyId, dto.branchId, dto.userId);
        return {
            success: true,
            message: `Opening stock cancelled successfully — ${data.rowsReversed} reversal rows`,
            data,
        };
    }
    async remove(query) {
        const data = await this.stockVoucherService.softDelete(OPENING_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
        return { success: true, message: 'Opening stock deleted successfully', data };
    }
    async pendingItems(query) {
        const data = await this.stockVoucherService.pendingItems(OPENING_RULES, query.companyId, query.branchId, query.accYear, query.limit, query.offset);
        return { success: true, message: 'Pending opening items fetched successfully', data };
    }
    async reconcile(query) {
        const data = await this.stockVoucherService.reconcile(OPENING_RULES, query.companyId, query.branchId, query.accYear, query.limit, query.offset);
        return { success: true, message: 'Opening reconciliation fetched successfully', data };
    }
};
exports.OpeningStockVoucherController = OpeningStockVoucherController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update an opening stock draft (by header.svhId presence)',
        description: 'Update is a full replace of the lines. The saved status is always DRAFT — posting is a separate call, not a status field.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockDocumentSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_opening_stock_voucher_dto_1.SaveOpeningStockVoucherDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "save", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List opening stock documents, or load one when svhId is given',
        description: 'The list reads the trigger-maintained header counters — it never aggregates the line table.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockListSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opening_stock_voucher_query_dto_1.GetOpeningStockVoucherQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "listOrLoad", null);
__decorate([
    (0, common_1.Get)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Preflight one opening stock document, line by line',
        description: 'Resolves the lot the way the engine would — without creating anything — and reports every line, problem null on the clean ones. Advisory: another till can post the same holding between this call and the post.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockValidateSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opening_stock_voucher_query_dto_1.OpeningStockVoucherRefQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post the opening — stock.fn_svh_post, the whole engine in one statement',
        description: 'Returns the reloaded document: the post fills lotId and costRateWot and recomputes every total on rows the client is still holding.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockPostSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_opening_stock_voucher_dto_1.PostOpeningStockVoucherDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a posted opening — reversal rows, never a delete',
        description: 'Can legitimately fail with 409: cancelling an opening after stock has been sold from it drives the holding negative, which fn_sml_apply refuses under BLOCK. The fix is an ADJUSTMENT, not a retry.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockCancelSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_opening_stock_voucher_dto_1.CancelOpeningStockVoucherDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "cancel", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete an opening stock DRAFT',
        description: 'DRAFT only. A POSTED voucher is cancelled, never deleted: soft-deleting it would hide the document from every list while its ledger rows went on affecting stock for ever.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockDeleteSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_stock_voucher_response_dto_1.OpeningStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opening_stock_voucher_query_dto_1.OpeningStockVoucherRefQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('pending-items'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Every stockable item with no opening movement in this branch and year',
        description: 'On go-live day this is the work list. A week later it should be the items that genuinely started at zero.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_stock_voucher_response_dto_1.PendingOpeningItemsSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opening_stock_voucher_query_dto_1.OpeningStockReportQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "pendingItems", null);
__decorate([
    (0, common_1.Get)('reconcile'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'What the branch started with, what it holds now, the difference',
        description: 'The opening figure comes from the ledger, not the document, so a cancelled opening correctly reads as zero.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_stock_voucher_response_dto_1.OpeningReconcileSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opening_stock_voucher_query_dto_1.OpeningStockReportQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningStockVoucherController.prototype, "reconcile", null);
exports.OpeningStockVoucherController = OpeningStockVoucherController = __decorate([
    (0, swagger_1.ApiTags)('Opening Stock'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock/opening'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [stock_voucher_service_1.StockVoucherService])
], OpeningStockVoucherController);
//# sourceMappingURL=opening-stock-voucher.controller.js.map