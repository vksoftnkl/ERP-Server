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
exports.SaleOrderController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const sale_order_exception_filter_1 = require("./sale-order-exception.filter");
const sale_order_service_1 = require("./sale-order.service");
const save_sale_order_dto_1 = require("./dto/save-sale-order.dto");
const cancel_sale_order_lines_dto_1 = require("./dto/cancel-sale-order-lines.dto");
const sale_order_response_dto_1 = require("./dto/sale-order-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let SaleOrderController = class SaleOrderController {
    orderService;
    constructor(orderService) {
        this.orderService = orderService;
    }
    async save(saveOrderDto) {
        const data = await this.orderService.save(saveOrderDto);
        return {
            success: true,
            message: saveOrderDto.soId ? 'Order updated successfully' : 'Order created successfully',
            data,
        };
    }
    async getById(soId, soCompanyId, soBranchId, soAccYear) {
        const data = await this.orderService.getById(soId, soCompanyId, soBranchId, soAccYear);
        return {
            success: true,
            message: 'Order fetched successfully',
            data,
        };
    }
    async getPendingAmount(ablSrcDocType, ablSrcDocId, ablSrcAccYear) {
        const data = await this.orderService.getSrcDocPendingAmount(ablSrcDocType, ablSrcDocId, ablSrcAccYear);
        return {
            success: true,
            message: 'Pending amount fetched successfully',
            data,
        };
    }
    async cancelLines(srcModule, srcDocId, srcAccYear, cancelDto) {
        const data = await this.orderService.cancelOpenLines(srcModule, srcDocId, srcAccYear, cancelDto);
        return {
            success: true,
            message: 'Order lines cancelled successfully',
            data,
        };
    }
    async remove(soId, soCompanyId, soBranchId, soAccYear) {
        const data = await this.orderService.softDelete(soId, soCompanyId, soBranchId, soAccYear);
        return {
            success: true,
            message: 'Order deleted successfully',
            data,
        };
    }
};
exports.SaleOrderController = SaleOrderController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update a sales order (by soId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: sale_order_response_dto_1.SaleOrderSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_sale_order_dto_1.SaveSaleOrderDto]),
    __metadata("design:returntype", Promise)
], SaleOrderController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get sales order by id' }),
    (0, swagger_1.ApiQuery)({ name: 'soId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'soCompanyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'soBranchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'soAccYear', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ type: sale_order_response_dto_1.SaleOrderSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Query)('soId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('soCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('soBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('soAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SaleOrderController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('pending-amount'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "One source document's outstanding amount from accounts.acc_bill_balance",
        description: 'Answers with abl_pending_amount alone, summed over the live bill-balance rows whose source ' +
            'document is the tuple given. For a sale order that is its ADVANCE row: the money the ' +
            'customer handed over that no invoice has eaten yet. It is read off the bill row rather ' +
            'than the order header because abl_pending_amount is a generated column (bill − alloc − ' +
            'disc − writeoff) and moves the moment an adjustment is posted, with no save on the order. ' +
            'A document with no bill row answers 0, not 404 — an order that took no advance, or one ' +
            'whose advance is fully adjusted, is an ordinary state.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'ablSrcDocType',
        schema: { type: 'string', example: 'SALES_ORDER' },
        description: 'abl_src_doc_type — the document discriminator the bill row carries (SALES_ORDER, BOOKING ' +
            'or CUSTOM_ORDER for an order). Case and separators are free: "sales order" and ' +
            '"Sales-Order" both name SALES_ORDER.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'ablSrcDocId',
        schema: { type: 'string', format: 'uuid' },
        description: 'abl_src_doc_id — the document id, i.e. so_id for an order',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'ablSrcAccYear',
        schema: { type: 'string', example: '2026-2027' },
        description: 'abl_src_acc_year — the accounting year of the SOURCE DOCUMENT (so_acc_year), not of the ' +
            'bill: a bill stays in the partition of the year it was raised in, so an advance adjusted ' +
            'in a later year is still found by its order year.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: sale_order_response_dto_1.SaleOrderSuccessPendingAmountDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Query)('ablSrcDocType')),
    __param(1, (0, common_1.Query)('ablSrcDocId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('ablSrcAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SaleOrderController.prototype, "getPendingAmount", null);
__decorate([
    (0, common_1.Put)('cancel-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a sales order line, or every open line of the order, by its source tuple',
        description: 'Called from the sales line, which holds the order only as its source document. Moves the ' +
            "addressed still-open line's pending quantity into cancelled — line status PARTIAL where " +
            'something had already been delivered, CANCELLED where nothing had — then recomputes the ' +
            'header amounts, line counts and both status columns from what ALL the lines then say. ' +
            'srcDocId decides the scope: an order id (so_id) closes out every open line, an order line ' +
            'id (soi_id) closes out that one line and leaves its siblings alone. Idempotent: a second ' +
            'call finds nothing open, writes no status-trail step and answers cancelledLines 0.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'srcModule',
        schema: {
            type: 'string',
            enum: ['SALES', 'SALES_ORDER', 'BOOKING', 'CUSTOM_ORDER'],
            example: 'SALES_ORDER',
        },
        description: 'SALES, the only module a sales order is reachable from, or the order doc type the calling ' +
            'screen has on hand — SALES_ORDER, the one a downstream document stores beside the id, or ' +
            'BOOKING / CUSTOM_ORDER for an order carrying either. Case and separators are free ' +
            '("sales order" and "Sales-Order" both name SALES_ORDER); any other word — a bill, a ' +
            'delivery challan — is a 400.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'srcDocId',
        schema: { type: 'string', format: 'uuid' },
        description: 'The order id (so_id) to cancel every open line of, or one order line id (soi_id) to cancel ' +
            'just that line',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'srcAccYear',
        schema: { type: 'string', example: '2026-2027' },
        description: 'The accounting year of the order and its lines (so_acc_year / soi_acc_year) — the partition key',
    }),
    (0, swagger_1.ApiOkResponse)({ type: sale_order_response_dto_1.SaleOrderSuccessCancelLinesDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Query)('srcModule')),
    __param(1, (0, common_1.Query)('srcDocId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('srcAccYear')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, cancel_sale_order_lines_dto_1.CancelSaleOrderLinesDto]),
    __metadata("design:returntype", Promise)
], SaleOrderController.prototype, "cancelLines", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete sales order by id' }),
    (0, swagger_1.ApiQuery)({ name: 'soId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'soCompanyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'soBranchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'soAccYear', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ type: sale_order_response_dto_1.SaleOrderSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Query)('soId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('soCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('soBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('soAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SaleOrderController.prototype, "remove", null);
exports.SaleOrderController = SaleOrderController = __decorate([
    (0, swagger_1.ApiTags)('Sale Orders'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('sale-orders'),
    (0, common_1.UseFilters)(sale_order_exception_filter_1.SaleOrderExceptionFilter),
    __metadata("design:paramtypes", [sale_order_service_1.SaleOrderService])
], SaleOrderController);
//# sourceMappingURL=sale-order.controller.js.map