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
exports.SaleOrderDeskController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const sale_order_response_dto_1 = require("../sale-order/dto/sale-order-response.dto");
const sale_order_desk_dto_1 = require("./dto/sale-order-desk.dto");
const sale_order_desk_exception_filter_1 = require("./sale-order-desk-exception.filter");
const sale_order_desk_merge_service_1 = require("./sale-order-desk-merge.service");
const sale_order_desk_service_1 = require("./sale-order-desk.service");
let SaleOrderDeskController = class SaleOrderDeskController {
    desk;
    mergeService;
    constructor(desk, mergeService) {
        this.desk = desk;
        this.mergeService = mergeService;
    }
    async deliveryHold(dto) {
        const data = await this.desk.deliveryHold(dto);
        return {
            success: true,
            message: data.soDeliveryHold
                ? `${data.soOrderRefno} put on delivery hold`
                : `${data.soOrderRefno} released from delivery hold`,
            data,
        };
    }
    async priority(dto) {
        const data = await this.desk.priority(dto);
        return {
            success: true,
            message: data.soPriority === 'URGENT'
                ? `${data.soOrderRefno} marked for quick delivery`
                : `${data.soOrderRefno} set to ${data.soPriority}`,
            data,
        };
    }
    async closeOpenLines(dto) {
        const data = await this.desk.closeOpenLines(dto);
        return {
            success: true,
            message: `${data.cancelledLines} open line(s) closed; the order is ${data.soStatus}`,
            data,
        };
    }
    async stockCover(dto) {
        const data = await this.desk.stockCover(dto);
        return { success: true, message: 'Stock cover', data };
    }
    async figures(dto) {
        const data = await this.desk.figures(dto);
        return { success: true, message: 'Order figures', data };
    }
    async mergePreview(dto) {
        const data = await this.mergeService.preview(dto);
        return { success: true, message: 'Merge preview', data };
    }
    async merge(dto) {
        const { message, data } = await this.mergeService.merge(dto);
        return { success: true, message, data };
    }
};
exports.SaleOrderDeskController = SaleOrderDeskController;
__decorate([
    (0, common_1.Post)('delivery-hold'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Put an order on delivery hold, or release it (Sales Order Edit)',
        description: 'Sends the state wanted (soDeliveryHold) and a reason, both ways. Writes the four ' +
            'so_delivery_hold* columns, a DELIVERY_HOLD / DELIVERY_RELEASED trail step and an audit ' +
            'row; not a save, so no revision. A held order is refused by /bills (validate / post / ' +
            'amend) and by the challans with 422 SALES_ORDER_DELIVERY_HOLD, and left out of the ' +
            "bill's open orders. 400 SALES_ORDER_REASON_REQUIRED; 403 SALES_RIGHT_EDIT; 404 " +
            'SALES_NOT_FOUND; 409 SALES_ORDER_CLOSED (not CONFIRMED / PARTIAL or nothing open), ' +
            'SALES_ORDER_HOLD_UNCHANGED (already in that state; the message says by whom and when).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ soId, soAccYear, soOrderRefno, soStatus, soDeliveryHold, …}' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_order_desk_dto_1.DeliveryHoldDto]),
    __metadata("design:returntype", Promise)
], SaleOrderDeskController.prototype, "deliveryHold", null);
__decorate([
    (0, common_1.Post)('priority'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: "Set an order's priority — Quick delivery = URGENT, off = NORMAL (Sales Order Edit)",
        description: 'Writes so_priority, a PRIORITY_CHANGED trail step and an audit row; no revision. ' +
            '400 VALIDATION_IS_IN; 403 SALES_RIGHT_EDIT; 404 SALES_NOT_FOUND; 409 SALES_ORDER_CLOSED, ' +
            'SALES_ORDER_PRIORITY_UNCHANGED.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ soId, soAccYear, soOrderRefno, soPriority }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_order_desk_dto_1.PriorityDto]),
    __metadata("design:returntype", Promise)
], SaleOrderDeskController.prototype, "priority", null);
__decorate([
    (0, common_1.Post)('close-open-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel the rest of an order: close its open lines, keep the billed part (Sales Order Cancel)',
        description: "Releases the order's reservations, then closes every open line (cancelOrderOpenLines): " +
            'the order ends COMPLETED (something billed) or CANCELLED (nothing billed), with a ' +
            'CANCELLED step "Open lines closed: <reason>". soCancelledAmt / soPendingAmt only with ' +
            'Receipt (99) View. 400 SALES_ORDER_REASON_REQUIRED, SALE_ORDER_ADVANCE_HELD (it would ' +
            'end CANCELLED holding an advance); 403 SALES_RIGHT_CANCEL; 404 SALES_NOT_FOUND; 409 ' +
            'SALES_ORDER_CLOSED.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'SaleOrderCancelLinesResult + releasedReservations' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_order_desk_dto_1.CloseOpenLinesDto]),
    __metadata("design:returntype", Promise)
], SaleOrderDeskController.prototype, "closeOpenLines", null);
__decorate([
    (0, common_1.Post)('stock-cover'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'In-stock weight of the ticked orders (reads only; Sales Order View)',
        description: 'Per item, base units: pending vs free (SALEABLE, this company and branch) + these ' +
            "orders' own open reservations; kg = open qty × unit weight. 1-500 orders; an id not " +
            'found here goes into missing[]. 400 VALIDATION_ARRAY_MIN_SIZE / _MAX_SIZE; 403 ' +
            'SALES_RIGHT_VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ orderKg, coverKg, shortKg, coverPerc, items[], missing[] }' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_order_desk_dto_1.StockCoverDto]),
    __metadata("design:returntype", Promise)
], SaleOrderDeskController.prototype, "stockCover", null);
__decorate([
    (0, common_1.Post)('figures'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: "The desk's amounts and dues (Sales Order View + Receipt View)",
        description: 'Grids 201-203 carry no money; this is where the open values, order amounts and the ' +
            "customers' dues (DR, live, part-paid included) come from. customers = the orders' " +
            'customers ∪ custIds. listValue = Σ openValue. 403 SALES_RIGHT_VIEW, ' +
            'SALES_ORDER_MONEY_RIGHT (no Receipt menu 99 View); 400 VALIDATION_ARRAY_MAX_SIZE.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ orders[], customers[], listValue }' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_order_desk_dto_1.FiguresDto]),
    __metadata("design:returntype", Promise)
], SaleOrderDeskController.prototype, "figures", null);
__decorate([
    (0, common_1.Post)('merge-preview'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'What a merge of these orders would make (reads only; Sales Order View)',
        description: 'Business refusals come back in refusals[] with ok: false (as /bills/validate), plus a ' +
            'missing Create / Post / Cancel right. Only a missing View (403 SALES_RIGHT_VIEW) and ' +
            'malformed input (400) fail the call. fingerprint goes back to /merge. Amounts only ' +
            'with Receipt (99) View.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ ok, refusals[], fingerprint, customer, orders[], newOrder }' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_order_desk_dto_1.MergePreviewDto]),
    __metadata("design:returntype", Promise)
], SaleOrderDeskController.prototype, "mergePreview", null);
__decorate([
    (0, common_1.Post)('merge'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Merge 2-20 orders of one customer into a new confirmed order (Create + Post + Cancel)',
        description: 'One transaction: the sources are locked (by so_id) and checked, the fingerprint is ' +
            're-computed, the new order is created (oldest source header, every open line at its ' +
            'pending qty, amounts pro-rata) and confirmed through /post (FEFO reservations; shortfalls ' +
            "are warnings[]), each source's reservations are released and its open lines closed " +
            '(→ CANCELLED, or COMPLETED when part-billed), and MERGED steps are written on all. Any ' +
            'refusal rolls everything back, the number included. 400 SALES_ORDER_MERGE_TOO_FEW / ' +
            '_ONE_PARTY / _TERMS_DIFFER, SALES_SALESMAN_INVALID; 403 SALES_RIGHT_CREATE / _POST / ' +
            '_CANCEL; 404 SALES_NOT_FOUND; 409 SALES_ORDER_CLOSED, SALES_ORDER_DELIVERY_HOLD, ' +
            'SALES_ORDER_MERGE_ADVANCE / _CHARGES / _SOURCE_CHANGED, SALES_DAY_CLOSED, ' +
            'SALE_ORDER_ORDER_NO_TAKEN. soOrderAmt only with Receipt (99) View.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'the new order keys + totals + warnings[] + mergedSources[]' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_order_desk_dto_1.MergeDto]),
    __metadata("design:returntype", Promise)
], SaleOrderDeskController.prototype, "merge", null);
exports.SaleOrderDeskController = SaleOrderDeskController = __decorate([
    (0, swagger_1.ApiTags)('Sale Order Desk'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: sale_order_response_dto_1.SaleOrderErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('sale-order-desk'),
    (0, common_1.UseFilters)(sale_order_desk_exception_filter_1.SaleOrderDeskExceptionFilter),
    __metadata("design:paramtypes", [sale_order_desk_service_1.SaleOrderDeskService,
        sale_order_desk_merge_service_1.SaleOrderDeskMergeService])
], SaleOrderDeskController);
//# sourceMappingURL=sale-order-desk.controller.js.map