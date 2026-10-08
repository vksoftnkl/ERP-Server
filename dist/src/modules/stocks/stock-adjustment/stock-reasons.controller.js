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
exports.StockReasonsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const stock_voucher_exception_filter_1 = require("../stock-voucher/stock-voucher-exception.filter");
const stock_reason_dto_1 = require("./dto/stock-reason.dto");
const stock_reasons_service_1 = require("./stock-reasons.service");
let StockReasonsController = class StockReasonsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async pick(query) {
        const data = await this.service.pick(query);
        return { success: true, message: `${data.length} reasons`, data };
    }
    async list(query) {
        const data = await this.service.list(query.companyId, query.includeInactive ?? false);
        return { success: true, message: `${data.length} reasons`, data };
    }
    async getOne(query) {
        const data = await this.service.getOne(query.companyId, query.srmId);
        return { success: true, message: 'Stock reason fetched successfully', data };
    }
    async usage(query) {
        const data = await this.service.usage(query.companyId, query.srmId);
        return { success: true, message: 'Stock reason usage fetched successfully', data };
    }
    async save(dto) {
        const data = await this.service.save(dto);
        return { success: true, message: dto.srmId ? 'Stock reason updated successfully' : 'Stock reason created successfully', data };
    }
    async deactivate(dto) {
        const data = await this.service.deactivate(dto);
        return {
            success: true,
            message: 'deleted' in data ? 'Stock reason deleted' : data.isActive ? 'Stock reason reactivated' : 'Stock reason deactivated',
            data,
        };
    }
};
exports.StockReasonsController = StockReasonsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The reason picker for one document kind',
        description: 'Shared and company rows merged — a company row hides the shared one with the same code — filtered by the txn types the kind posts and, optionally, by direction (BOTH always qualifies).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The reasons.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_reason_dto_1.StockReasonPickerQueryDto]),
    __metadata("design:returntype", Promise)
], StockReasonsController.prototype, "pick", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Every reason the company can see, with isOverridden, usageCount and canDelete' }),
    (0, swagger_1.ApiOkResponse)({ description: 'The rows.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_reason_dto_1.StockReasonListQueryDto]),
    __metadata("design:returntype", Promise)
], StockReasonsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One reason' }),
    (0, swagger_1.ApiOkResponse)({ description: 'The row.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_reason_dto_1.StockReasonRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockReasonsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)('usage'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Where a reason is cited: ledger rows, voucher headers, voucher lines, last used' }),
    (0, swagger_1.ApiOkResponse)({ description: 'The counts.' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_reason_dto_1.StockReasonRefQueryDto]),
    __metadata("design:returntype", Promise)
], StockReasonsController.prototype, "usage", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Create or update the company's own reason",
        description: 'A shared row is read-only: create a company row with the same code to override it. The code is immutable once any ledger row cites the reason. srm_gl_ledger_id is the ledger the reason posts to under PERPETUAL.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The saved row.' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_reason_dto_1.SaveStockReasonDto]),
    __metadata("design:returntype", Promise)
], StockReasonsController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('deactivate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Deactivate (or reactivate) a company reason; one never cited is deleted outright',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The row, or { srmId, deleted: true }.' }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_reason_dto_1.DeactivateStockReasonDto]),
    __metadata("design:returntype", Promise)
], StockReasonsController.prototype, "deactivate", null);
exports.StockReasonsController = StockReasonsController = __decorate([
    (0, swagger_1.ApiTags)('Stock Reasons'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock/reasons'),
    (0, common_1.UseFilters)(stock_voucher_exception_filter_1.StockVoucherExceptionFilter),
    __metadata("design:paramtypes", [stock_reasons_service_1.StockReasonsService])
], StockReasonsController);
//# sourceMappingURL=stock-reasons.controller.js.map