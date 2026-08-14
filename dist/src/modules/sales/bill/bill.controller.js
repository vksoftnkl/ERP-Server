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
exports.BillController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const bill_exception_filter_1 = require("./bill-exception.filter");
const bill_service_1 = require("./bill.service");
const save_bill_dto_1 = require("./dto/save-bill.dto");
const cancel_bill_dto_1 = require("./dto/cancel-bill.dto");
const bill_response_dto_1 = require("./dto/bill-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let BillController = class BillController {
    billService;
    constructor(billService) {
        this.billService = billService;
    }
    async save(saveBillDto) {
        const data = await this.billService.save(saveBillDto);
        return {
            success: true,
            message: saveBillDto.sbId ? 'Bill updated successfully' : 'Bill created successfully',
            data,
        };
    }
    async getById(sbId, sbCompanyId, sbBranchId, sbAccYear) {
        const data = await this.billService.getById(sbId, sbCompanyId, sbBranchId, sbAccYear);
        return {
            success: true,
            message: 'Bill fetched successfully',
            data,
        };
    }
    async remove(cancelBillDto) {
        const data = await this.billService.cancelSourceOrders(cancelBillDto);
        return {
            success: true,
            message: 'Sale order cancelled successfully',
            data,
        };
    }
};
exports.BillController = BillController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update a bill (by sbId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: bill_response_dto_1.BillSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_bill_dto_1.SaveBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get bill by id' }),
    (0, swagger_1.ApiQuery)({ name: 'sbId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbCompanyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbBranchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sbAccYear', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ type: bill_response_dto_1.BillSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    __param(0, (0, common_1.Query)('sbId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sbCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('sbBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('sbAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel the sale order this bill was raised against',
        description: 'Writes off every OPEN line of the order(s) the bill references: soi_cancelled_qty takes ' +
            'the pending quantity, which drives the GENERATED soi_pending_qty to zero and ' +
            'soi_line_status to CANCELLED, and the header roll-ups follow. Nothing is deleted and no ' +
            'is_deleted flag moves. Idempotent — calling it twice cancels nothing the second time.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: bill_response_dto_1.BillSuccessCancelDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cancel_bill_dto_1.CancelBillDto]),
    __metadata("design:returntype", Promise)
], BillController.prototype, "remove", null);
exports.BillController = BillController = __decorate([
    (0, swagger_1.ApiTags)('Bills'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('bills'),
    (0, common_1.UseFilters)(bill_exception_filter_1.BillExceptionFilter),
    __metadata("design:paramtypes", [bill_service_1.BillService])
], BillController);
//# sourceMappingURL=bill.controller.js.map