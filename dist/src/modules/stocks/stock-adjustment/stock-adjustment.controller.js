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
exports.StockAdjustmentController = exports.STOCK_ADJUSTMENT_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const save_stock_adjustment_dto_1 = require("./dto/save-stock-adjustment.dto");
const stock_adjustment_query_dto_1 = require("./dto/stock-adjustment-query.dto");
const stock_adjustment_service_1 = require("./stock-adjustment.service");
exports.STOCK_ADJUSTMENT_MENU_ID = 264;
let StockAdjustmentController = class StockAdjustmentController {
    service;
    prisma;
    requestContext;
    constructor(service, prisma, requestContext) {
        this.service = service;
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async save(dto) {
        await this.requireRight(dto.header.svhId ? 'edit' : 'create', 'save a stock adjustment');
        if (dto.header.post === true || dto.header.status === 'POSTED') {
            await this.requireRight('post', 'post a stock adjustment');
        }
        const data = await this.service.save(dto);
        return {
            success: true,
            message: dto.header.svhId ? 'Stock adjustment updated successfully' : 'Stock adjustment created successfully',
            data,
        };
    }
    async load(query) {
        await this.requireRight('view', 'view stock adjustments');
        const data = await this.service.getOne(query.svhId, query.accYear, query.companyId, query.branchId);
        return { success: true, message: 'Stock adjustment fetched successfully', data };
    }
    async validate(query) {
        await this.requireRight('view', 'view stock adjustments');
        const data = await this.service.validate(query.svhId, query.accYear, query.companyId, query.branchId);
        const failing = data.filter((row) => row.problem !== null).length;
        return {
            success: true,
            message: failing ? `${failing} of ${data.length} lines have problems` : `All ${data.length} lines are clean`,
            data,
        };
    }
    async post(dto) {
        await this.requireRight('post', 'post a stock adjustment');
        const data = await this.service.post(dto);
        return { success: true, message: `Stock adjustment posted — ${data.rowsPosted} ledger rows`, data };
    }
    async cancel(dto) {
        await this.requireRight('cancel', 'cancel a stock adjustment');
        const data = await this.service.cancel(dto);
        return { success: true, message: `Stock adjustment cancelled — ${data.rowsReversed} reversal rows`, data };
    }
    async remove(query) {
        await this.requireRight('delete', 'delete a stock adjustment draft');
        const data = await this.service.remove(query.svhId, query.accYear, query.companyId, query.branchId);
        return { success: true, message: 'Stock adjustment deleted successfully', data };
    }
    async pickStock(query) {
        await this.requireRight('view', 'pick stock for an adjustment');
        const data = await this.service.pickStock(query);
        return { success: true, message: `${data.length} holdings`, data };
    }
    async requireRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: exports.STOCK_ADJUSTMENT_MENU_ID,
            right,
            codePrefix: 'ADJ',
            action,
        });
    }
};
exports.StockAdjustmentController = StockAdjustmentController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a DRAFT adjustment, issue, damage or expiry write-off, or a stock move',
        description: 'header.voucherType picks the kind. Every line moves under a reason (its own, else the header\'s): an IN / OUT reason fixes the sign, a BOTH reason takes it from the signed quantity. Outward lines name a lot from /pick-stock or leave it to the issue strategy; inward lines state identity. A re-lot is an ADJUSTMENT with a RELOT_OUT / RELOT_IN pair that balances per item. BUCKET_MOVE (stored as ADJUSTMENT): every line names its lot, `bucket` (from) and `toBucket` (to), a positive quantity and a move reason; the post writes BUCKET_OUT / BUCKET_IN at the same cost and no accounts voucher.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The saved document.' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_stock_adjustment_dto_1.SaveStockAdjustmentDto]),
    __metadata("design:returntype", Promise)
], StockAdjustmentController.prototype, "save", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Load one document with item, lot, reason and godown names',
        description: '`kind` is what the Type selector shows: ADJUSTMENT, RELOT, BUCKET_MOVE, ISSUE, DAMAGE or EXPIRY_WRITEOFF (header.voucherType stays the stored type, ADJUSTMENT for the first three). A move\'s lines carry `toBucket`.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The document.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_adjustment_query_dto_1.StockAdjustmentRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockAdjustmentController.prototype, "load", null);
__decorate([
    (0, common_1.Get)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Preflight one document, line by line',
        description: 'The reason and its direction, the lot and what it holds, the expiry rule, the re-lot pair, the identity facets, the freeze — one message per line, the same rules the post applies.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'One row per line; problem null means clean.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_adjustment_query_dto_1.StockAdjustmentRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockAdjustmentController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post: the engine, the accounts voucher and the trail in one transaction',
        description: 'Per-line direction and txn type from the reason; BLOCK on any holding it would drive negative; the header re-summed from the ledger; under PERPETUAL one Stock Journal voucher (DR reason ledger / CR Stock-in-Hand for stock out, the reverse for stock in, netted per ledger; a re-lot pair and a stock move post none).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The posted document with rowsPosted.' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_adjustment_query_dto_1.StockAdjustmentRefDto]),
    __metadata("design:returntype", Promise)
], StockAdjustmentController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel: a DRAFT moves to CANCELLED; a POSTED document is mirrored and its Stock Journal reversed',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The cancelled document with rowsReversed.' }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_adjustment_query_dto_1.CancelStockAdjustmentDto]),
    __metadata("design:returntype", Promise)
], StockAdjustmentController.prototype, "cancel", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a DRAFT' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Deleted.' }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_adjustment_query_dto_1.StockAdjustmentRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockAdjustmentController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('pick-stock'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Pick stock from the balance — the holdings an outward line is chosen from',
        description: 'Balance-grain rows (godown × lot × bucket) with available > 0: item, batch, expiry, MRP, the lot\'s supplier, on hand, available, the average cost and (notes 151 #8) the batch\'s sizeId / sizeName, colourId / colourName and model. With bucket=DAMAGED it is the "what goes back to which supplier" list; without bucket, every bucket, each row naming its own. `batchNo` (notes 151 #9) is the exact batch-label scan, folded as the lot key folds it; `search` stays a loose match on name, code and batch. Notes 153: each row also carries `loadRate` / `unloadRate`, the Godown Transfer line\'s default rates per unit of the holding\'s unit (unit_loading / unit_unloading when the item has item_allow_loading, else 0). Live, never cached.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The holdings.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_adjustment_query_dto_1.PickStockQueryDto]),
    __metadata("design:returntype", Promise)
], StockAdjustmentController.prototype, "pickStock", null);
exports.StockAdjustmentController = StockAdjustmentController = __decorate([
    (0, swagger_1.ApiTags)('Stock Adjustment'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock/adjustment'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [stock_adjustment_service_1.StockAdjustmentService,
        prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], StockAdjustmentController);
//# sourceMappingURL=stock-adjustment.controller.js.map