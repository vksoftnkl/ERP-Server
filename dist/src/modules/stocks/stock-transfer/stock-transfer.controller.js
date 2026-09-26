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
exports.TRANSFER_OUT_RULES = exports.StockTransferController = void 0;
const common_1 = require("@nestjs/common");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const stock_voucher_service_1 = require("../stock-voucher/stock-voucher.service");
const stock_transfer_service_1 = require("./stock-transfer.service");
const save_stock_transfer_dto_1 = require("./dto/save-stock-transfer.dto");
const list_stock_transfer_query_dto_1 = require("./dto/list-stock-transfer-query.dto");
const post_stock_transfer_dto_1 = require("./dto/post-stock-transfer.dto");
const stock_transfer_response_dto_1 = require("./dto/stock-transfer-response.dto");
const TRANSFER_OUT_RULES = {
    voucherType: 'TRANSFER_OUT',
    typeCode: 'TRF',
    displayName: 'Stock transfer',
    requiresToGodown: true,
    requiresFromGodown: true,
    isInward: false,
    ledgerTxnTypes: ['TRANSFER_OUT'],
    quantityMode: 'QTY',
    requiresLot: true,
    zeroesLineCost: true,
    allowsCount: false,
    allowsToBranch: true,
    postFunction: 'stock.fn_svh_post_transfer',
    auditScreenName: 'Stock Transfer',
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.STOCK_TRANSFER,
    refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_IN', 'REPACK_IN', 'REPACK_OUT'],
};
exports.TRANSFER_OUT_RULES = TRANSFER_OUT_RULES;
let StockTransferController = class StockTransferController {
    stockTransferService;
    stockVoucherService;
    constructor(stockTransferService, stockVoucherService) {
        this.stockTransferService = stockTransferService;
        this.stockVoucherService = stockVoucherService;
    }
    async save(dto) {
        const data = await this.stockTransferService.save(TRANSFER_OUT_RULES, dto);
        return {
            success: true,
            message: dto.header.svhId
                ? 'Stock transfer updated successfully'
                : 'Stock transfer created successfully',
            data,
        };
    }
    async listOrLoad(query) {
        if (query.svhId) {
            const data = await this.stockTransferService.getOne(TRANSFER_OUT_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
            return { success: true, message: 'Stock transfer fetched successfully', data };
        }
        const data = await this.stockVoucherService.list(TRANSFER_OUT_RULES, query);
        return { success: true, message: 'Stock transfer list fetched successfully', data };
    }
    async validate(query) {
        const data = await this.stockVoucherService.validate(TRANSFER_OUT_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
        const failing = data.filter((row) => row.problem !== null).length;
        return {
            success: true,
            message: failing
                ? `${failing} of ${data.length} lines have problems`
                : `All ${data.length} lines are clean`,
            data,
        };
    }
    async despatch(dto) {
        const data = await this.stockTransferService.despatch(TRANSFER_OUT_RULES, dto);
        return {
            success: true,
            message: data.sameBranch
                ? `Stock moved between godowns — ${data.ledgerRows} ledger rows, transfer POSTED`
                : `Transfer despatched — ${data.transitRows} lines in transit`,
            data,
        };
    }
    async cancel(dto) {
        const data = await this.stockVoucherService.cancel(TRANSFER_OUT_RULES, dto.svhId, dto.accYear, dto.reason, dto.companyId, dto.branchId, dto.userId);
        return {
            success: true,
            message: `Stock transfer cancelled — ${data.rowsReversed} reversal rows`,
            data,
        };
    }
    async remove(query) {
        const data = await this.stockVoucherService.softDelete(TRANSFER_OUT_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
        return { success: true, message: 'Stock transfer deleted successfully', data };
    }
};
exports.StockTransferController = StockTransferController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a stock transfer draft (godown → godown or branch → branch)',
        description: 'One endpoint for both forms — omit toBranchId, or send this branch, for a godown-to-godown move. Every line names the lot it moves and the SOURCE godown; the destination is on the header. Never send a cost: the engine stamps it and it travels with the stock.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: stock_transfer_response_dto_1.StockTransferDocumentSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_stock_transfer_dto_1.SaveStockTransferDto]),
    __metadata("design:returntype", Promise)
], StockTransferController.prototype, "save", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List stock transfers, or load one with its transit rows when svhId is given',
        description: 'The status filter offers all five: an inter-branch despatch is IN_TRANSIT, never POSTED, so filtering to POSTED hides every transfer on a lorry. Loading one returns its transit rows so the sender can see what has been received against each line.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferListSuccessDto }),
    (0, swagger_1.ApiExtraModels)(stock_transfer_response_dto_1.StockTransferLoadSuccessDto),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_stock_transfer_query_dto_1.GetStockTransferQueryDto]),
    __metadata("design:returntype", Promise)
], StockTransferController.prototype, "listOrLoad", null);
__decorate([
    (0, common_1.Get)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Preflight one transfer, line by line',
        description: 'Advisory: another till can move the same holding between this call and the despatch.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferValidateSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_stock_transfer_query_dto_1.StockTransferRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockTransferController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('despatch'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Despatch the transfer — stock.fn_svh_post_transfer',
        description: 'The engine chooses the shape. A same-branch transfer writes the OUT and IN ledger rows as a pair and ends POSTED; an inter-branch despatch writes the OUT row plus one stock_transit row per line and ends IN_TRANSIT. The response says which happened — read from the row, not from the request. LR, vehicle and expected date are written to the transit rows in the same transaction.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferDespatchSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_stock_transfer_dto_1.DespatchStockTransferDto]),
    __metadata("design:returntype", Promise)
], StockTransferController.prototype, "despatch", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a same-branch POSTED transfer — reversal rows, never a delete',
        description: "Only a same-branch transfer can be cancelled. An IN_TRANSIT or RECEIVED despatch is refused by tr_svh_transfer_cancel_guard with 409 and the engine's own sentence — goods that left cannot be cancelled on paper, and the fix is to receive them or transfer them back.",
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferCancelSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_stock_transfer_dto_1.CancelStockTransferDto]),
    __metadata("design:returntype", Promise)
], StockTransferController.prototype, "cancel", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a DRAFT transfer',
        description: 'Drafts are DELETED, never cancelled. The cancel guard refuses cancelling any linked TRANSFER_IN, a draft one included, and the link is mandatory on all of them.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferDeleteSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_stock_transfer_query_dto_1.StockTransferRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockTransferController.prototype, "remove", null);
exports.StockTransferController = StockTransferController = __decorate([
    (0, swagger_1.ApiTags)('Stock Transfer'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock/transfer'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [stock_transfer_service_1.StockTransferService,
        stock_voucher_service_1.StockVoucherService])
], StockTransferController);
//# sourceMappingURL=stock-transfer.controller.js.map