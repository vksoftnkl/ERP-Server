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
exports.TRANSFER_IN_RULES = exports.StockTransferReceiveController = void 0;
const common_1 = require("@nestjs/common");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const stock_voucher_service_1 = require("../stock-voucher/stock-voucher.service");
const stock_transfer_service_1 = require("./stock-transfer.service");
const save_stock_transfer_receive_dto_1 = require("./dto/save-stock-transfer-receive.dto");
const list_stock_transfer_query_dto_1 = require("./dto/list-stock-transfer-query.dto");
const post_stock_transfer_dto_1 = require("./dto/post-stock-transfer.dto");
const stock_transfer_response_dto_1 = require("./dto/stock-transfer-response.dto");
const TRANSFER_IN_RULES = {
    voucherType: 'TRANSFER_IN',
    typeCode: 'TRI',
    displayName: 'Transfer receipt',
    requiresToGodown: true,
    requiresFromGodown: true,
    isInward: true,
    ledgerTxnTypes: ['TRANSFER_IN'],
    quantityMode: 'QTY',
    requiresLot: true,
    zeroesLineCost: true,
    allowsCount: false,
    allowsToBranch: false,
    postFunction: 'stock.fn_svh_receive_transfer',
    auditScreenName: 'Stock Transfer Receipt',
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.STOCK_TRANSFER,
    refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};
exports.TRANSFER_IN_RULES = TRANSFER_IN_RULES;
let StockTransferReceiveController = class StockTransferReceiveController {
    stockTransferService;
    stockVoucherService;
    constructor(stockTransferService, stockVoucherService) {
        this.stockTransferService = stockTransferService;
        this.stockVoucherService = stockVoucherService;
    }
    async inbound(query) {
        const data = await this.stockTransferService.inbound(query.companyId, query.branchId, query.limit ?? 100, query.offset ?? 0);
        return {
            success: true,
            message: `${data.meta.count} consignments in transit to this branch`,
            data,
        };
    }
    async prefill(query) {
        const data = await this.stockTransferService.prefill(query.companyId, query.branchId, query.outVoucherId, query.accYear);
        return {
            success: true,
            message: `${data.rows.length} lines still to receive against ${data.outVoucher.refno}`,
            data,
        };
    }
    async save(dto) {
        const data = await this.stockTransferService.saveReceive(TRANSFER_IN_RULES, dto);
        return {
            success: true,
            message: dto.header.svhId
                ? 'Transfer receipt updated successfully'
                : 'Transfer receipt created successfully',
            data,
        };
    }
    async post(dto) {
        const data = await this.stockTransferService.receive(TRANSFER_IN_RULES, dto.svhId, dto.accYear, dto.companyId, dto.branchId, dto.userId);
        return {
            success: true,
            message: data.outVoucher.closed
                ? `Receipt posted — ${data.inVoucher.ledgerRows} ledger rows, transfer ${data.outVoucher.refno} closed`
                : `Receipt posted — ${data.inVoucher.ledgerRows} ledger rows, transfer ${data.outVoucher.refno} still open with stock outstanding`,
            data,
        };
    }
    async remove(query) {
        const data = await this.stockVoucherService.softDelete(TRANSFER_IN_RULES, query.svhId, query.accYear, query.companyId, query.branchId);
        return { success: true, message: 'Transfer receipt deleted successfully', data };
    }
};
exports.StockTransferReceiveController = StockTransferReceiveController;
__decorate([
    (0, common_1.Get)('inbound'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The inbound worklist — what is on its way to me',
        description: 'Transit rows still IN_TRANSIT or PARTIAL, oldest first, with days in flight. Takes NO accYear on purpose: a transfer despatched on 29 March is received in April, and stock_transit is unpartitioned so that both halves of one fact stay in one place.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferInboundSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_stock_transfer_query_dto_1.StockTransferInboundQueryDto]),
    __metadata("design:returntype", Promise)
], StockTransferReceiveController.prototype, "inbound", null);
__decorate([
    (0, common_1.Get)('prefill'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Open a receipt against a despatch, at the REMAINDER',
        description: "Read from stock_transit, not from the despatch's lines. A second partial receipt opens with what is still owed — prefilling from the lines is what lets a clerk receive the same 30 twice.",
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferPrefillSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_stock_transfer_query_dto_1.StockTransferPrefillQueryDto]),
    __metadata("design:returntype", Promise)
], StockTransferReceiveController.prototype, "prefill", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a transfer receipt draft',
        description: 'Requires the despatch it is against. godownId on a line is the DESTINATION godown, taken from the prefill. Bucket is SALEABLE for what arrived good and DAMAGED for what arrived broken — damaged units still post in, because they exist, broken. What never arrived gets no line.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: stock_transfer_response_dto_1.StockTransferDocumentSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_stock_transfer_receive_dto_1.SaveStockTransferReceiveDto]),
    __metadata("design:returntype", Promise)
], StockTransferReceiveController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post the receipt — stock.fn_svh_receive_transfer',
        description: 'Returns BOTH documents. The receipt closing does not mean the transfer closed: the despatch flips to RECEIVED only when no transit row of it has anything left, and a short keeps it open on purpose — that is the loss report. The write-off is a separate decision and is deliberately not automated.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferReceiveSuccessDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_stock_transfer_dto_1.StockTransferRefDto]),
    __metadata("design:returntype", Promise)
], StockTransferReceiveController.prototype, "post", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a DRAFT receipt',
        description: 'DELETE, NEVER CANCEL. tr_svh_transfer_cancel_guard refuses cancelling any linked TRANSFER_IN — a draft one included — and the link is mandatory on every one of them, so Cancel must not be offered on a draft receipt at all.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_transfer_response_dto_1.StockTransferDeleteSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_transfer_response_dto_1.StockTransferErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_stock_transfer_query_dto_1.StockTransferRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockTransferReceiveController.prototype, "remove", null);
exports.StockTransferReceiveController = StockTransferReceiveController = __decorate([
    (0, swagger_1.ApiTags)('Stock Transfer'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock/transfer/receive'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [stock_transfer_service_1.StockTransferService,
        stock_voucher_service_1.StockVoucherService])
], StockTransferReceiveController);
//# sourceMappingURL=stock-transfer-receive.controller.js.map