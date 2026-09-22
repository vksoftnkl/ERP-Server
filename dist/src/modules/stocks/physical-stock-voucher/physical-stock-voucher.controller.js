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
exports.PhysicalStockVoucherController = void 0;
const common_1 = require("@nestjs/common");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const stock_voucher_service_1 = require("../stock-voucher/stock-voucher.service");
const stock_voucher_types_1 = require("../stock-voucher/types/stock-voucher.types");
const save_physical_stock_voucher_dto_1 = require("./dto/save-physical-stock-voucher.dto");
const list_physical_stock_voucher_query_dto_1 = require("./dto/list-physical-stock-voucher-query.dto");
const post_physical_stock_voucher_dto_1 = require("./dto/post-physical-stock-voucher.dto");
const physical_stock_voucher_response_dto_1 = require("./dto/physical-stock-voucher-response.dto");
const PHYSICAL_VCHR_TYPE_ID = 6;
const PHYSICAL_RULES = {
    voucherType: 'PHYSICAL',
    typeCode: 'PHY',
    displayName: 'Physical stock count',
    refnoVchrTypeId: PHYSICAL_VCHR_TYPE_ID,
    requiresToGodown: true,
    requiresFromGodown: false,
    isInward: false,
    ledgerTxnTypes: ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'],
    quantityMode: 'COUNT',
    defaultRateSource: stock_voucher_types_1.PHYSICAL_DEFAULT_RATE_SOURCE,
    allowsRepeatHolding: true,
    allowsCount: true,
    allowsToBranch: false,
    auditScreenName: 'Physical Stock Count',
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.STOCK_ADJUSTMENT,
    postFunction: 'stock.fn_svh_post',
    refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};
let PhysicalStockVoucherController = class PhysicalStockVoucherController {
    stockVoucherService;
    constructor(stockVoucherService) {
        this.stockVoucherService = stockVoucherService;
    }
    async countSheet(query) {
        const data = await this.stockVoucherService.countSheet(PHYSICAL_RULES, query);
        return {
            success: true,
            message: `${data.items.length} holdings to count`,
            data,
        };
    }
    async save(dto) {
        const data = await this.stockVoucherService.save(PHYSICAL_RULES, dto);
        return {
            success: true,
            message: dto.header.svhId
                ? 'Physical stock count updated successfully'
                : 'Physical stock count created successfully',
            data,
        };
    }
    async listOrLoad(query) {
        if (query.svhId) {
            const data = await this.stockVoucherService.getById(PHYSICAL_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
            return { success: true, message: 'Physical stock count fetched successfully', data };
        }
        const data = await this.stockVoucherService.list(PHYSICAL_RULES, query);
        return { success: true, message: 'Physical stock count list fetched successfully', data };
    }
    async validate(query) {
        const data = await this.stockVoucherService.validate(PHYSICAL_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
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
        const data = await this.stockVoucherService.post(PHYSICAL_RULES, dto.svhId, dto.accYear, dto.companyId, dto.branchId, dto.userId);
        return {
            success: true,
            message: this.postedMessage(data),
            data,
        };
    }
    async cancel(dto) {
        const data = await this.stockVoucherService.cancel(PHYSICAL_RULES, dto.svhId, dto.accYear, dto.reason, dto.companyId, dto.branchId, dto.userId);
        return {
            success: true,
            message: data.rowsReversed
                ? `Physical stock count cancelled successfully — ${data.rowsReversed} reversal rows`
                : 'Physical stock count cancelled successfully — no variance had posted, so nothing was reversed',
            data,
        };
    }
    async variance(query) {
        const data = await this.stockVoucherService.variance(PHYSICAL_RULES, query.svhId, query.accYear, query.companyId, query.branchId, query.limit, query.offset);
        return {
            success: true,
            message: data.items.length
                ? `${data.items.length} variance rows`
                : 'Every line agreed — the count posted no ledger rows',
            data,
        };
    }
    postedMessage(data) {
        const varied = data.lines.filter((line) => (line.diffQty ?? 0) !== 0).length;
        const total = data.lines.length;
        return varied
            ? `Physical stock count posted — ${varied} of ${total} lines had a variance`
            : `Physical stock count posted — all ${total} lines agreed with the book`;
    }
};
exports.PhysicalStockVoucherController = PhysicalStockVoucherController;
__decorate([
    (0, common_1.Get)('count-sheet'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Generate a count sheet for one godown from stock_balance',
        description: 'A READ, NOT A DOCUMENT — it creates nothing, so the sheet can be printed and walked before any row exists. One line per godown × lot × bucket, not per item: two batches of MILK are two lines, because they are two holdings.\n\n' +
            'AN ITEM WITH NO BALANCE ROW IS NOT ON THE SHEET AND MUST NOT BE ADDED TO IT. No book quantity means no variance to have; finding such an item on the shelf is an ADJUSTMENT, which is a different screen.\n\n' +
            'Send each row back on POST /stock/physical with its lotId verbatim and one number filled in.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_voucher_response_dto_1.CountSheetSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_voucher_query_dto_1.GenerateCountSheetQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockVoucherController.prototype, "countSheet", null);
__decorate([
    (0, common_1.Post)('/create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a physical count draft (by header.svhId presence)',
        description: 'Update is a full replace of the lines. The saved status is always DRAFT — posting is a separate call, not a status field.\n\n' +
            'THE SERVER READS RATHER THAN TRUSTS: svi_book_qty comes from stock_balance for the lot the line names, and the unit, batch, expiry, MRP, sale price, serial and supplier are copied from the same holding. A lotId with no live balance row in this godown is a 422 telling you to regenerate the sheet.\n\n' +
            'THE HEADER TOTALS ARE THE EXCEPTION — header.lineCount, totalQty, totalValue and totalValueWot are taken verbatim from the payload, because nothing server-side sums the grid. They are written AFTER the lines, each is optional against a NOT NULL DEFAULT 0 column, and on a count they may be NEGATIVE: the intended reading is the net variance, and a shortage is negative. Omit one and its stored value is left alone.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockDocumentSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_physical_stock_voucher_dto_1.SavePhysicalStockVoucherDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockVoucherController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('/get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List physical counts, or load one when svhId is given',
        description: 'The header totals on a POSTED count are the NET VARIANCE read off the ledger, not the sum of anything on the screen. Label them "Net variance" or do not show them: a column headed "Total" reading 1 under three lines totalling 236 counted units is worse than no column.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockListSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_voucher_query_dto_1.GetPhysicalStockVoucherQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockVoucherController.prototype, "listOrLoad", null);
__decorate([
    (0, common_1.Get)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Preflight one count, line by line',
        description: 'Returns EVERY line, problem null on the clean ones — including the ones that agree, because a line with no variance is still a line that was counted and the screen ticks it.\n\n' +
            'The check worth reading is the drift check: "the book quantity has changed since this sheet was generated". With the freeze on it should never fire; when it does, it is telling you the freeze is not working. Advisory either way — a sheet can be generated before the freeze window opens.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockValidateSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_voucher_query_dto_1.PhysicalStockVoucherRefQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockVoucherController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post the count — stock.fn_svh_post, the whole engine in one statement',
        description: 'ZERO LEDGER ROWS IS A SUCCESS. A count where every line agrees posts nothing, closes POSTED, and is exactly what a well-run stockroom should produce; rowsPosted is the honest number of lines that varied, not a failure count.\n\n' +
            'The average must not move: a shortage is relieved at the average and an overage added at it. A count finds a quantity error, not a price error — and correcting a price is something this engine cannot express at all.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockPostSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_physical_stock_voucher_dto_1.PostPhysicalStockVoucherDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockVoucherController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a DRAFT or a POSTED count — never a delete',
        description: 'A DRAFT count is cancelled by moving the header — no ledger row was written, so `rowsReversed` is 0. That also LIFTS THE GODOWN FREEZE it was holding: an abandoned count must not go on blocking every movement in the godown until its freeze window expires, which until now needed the draft deleted.\n\n' +
            'A cancelled POSTED count UN-CORRECTS a correction: the book figure goes back to being the one the shelf disagreed with. Usually the right answer to "the counter miscounted" is a SECOND COUNT, not a cancellation — a holding may be counted any number of times, each posting its own variance from the then-current book figure. Put that in the confirm dialog.\n\n' +
            'It can also legitimately fail with 409: cancel an overage after the found stock has been sold and the reversal drives the holding negative, which fn_sml_apply refuses under BLOCK. The fix is another count, not a retry.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockCancelSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_physical_stock_voucher_dto_1.CancelPhysicalStockVoucherDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockVoucherController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('variance'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The count as the LEDGER recorded it',
        description: "Not the same row set as the document: only the lines that varied are here, keeping the count sheet's own line numbers so a variance row can be pointed back at the line it came from. A count of three lines with one agreement returns rows 2 and 3, and row 1 is missing deliberately.\n\n" +
            "This is what an auditor asks for, and the only place the shortage's stamped cost and the overage's derived cost sit side by side.",
    }),
    (0, swagger_1.ApiOkResponse)({ type: physical_stock_voucher_response_dto_1.StockVarianceSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: physical_stock_voucher_response_dto_1.PhysicalStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_physical_stock_voucher_query_dto_1.PhysicalStockVarianceQueryDto]),
    __metadata("design:returntype", Promise)
], PhysicalStockVoucherController.prototype, "variance", null);
exports.PhysicalStockVoucherController = PhysicalStockVoucherController = __decorate([
    (0, swagger_1.ApiTags)('Physical Stock'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock/physical'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [stock_voucher_service_1.StockVoucherService])
], PhysicalStockVoucherController);
//# sourceMappingURL=physical-stock-voucher.controller.js.map