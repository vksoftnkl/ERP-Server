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
exports.SaleReturnController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const sale_return_exception_filter_1 = require("./sale-return-exception.filter");
const sale_return_service_1 = require("./sale-return.service");
const save_sale_return_dto_1 = require("./dto/save-sale-return.dto");
const sale_return_lifecycle_dto_1 = require("./dto/sale-return-lifecycle.dto");
const ok = (message, data) => ({ success: true, message, data });
let SaleReturnController = class SaleReturnController {
    service;
    constructor(service) {
        this.service = service;
    }
    async save(dto) {
        return ok(dto.srId ? 'Sale return updated successfully' : 'Sale return created successfully', await this.service.save(dto));
    }
    async validate(dto) {
        return ok('Sale return validated', await this.service.validate(dto));
    }
    async post(dto) {
        return ok('Sale return posted successfully', await this.service.post(dto));
    }
    async cancel(dto) {
        return ok('Sale return cancelled successfully', await this.service.cancel(dto));
    }
    async amend(dto) {
        return ok('Sale return amended successfully', await this.service.amend(dto));
    }
    async remove(dto) {
        return ok('Draft sale return deleted successfully', await this.service.delete(dto));
    }
    async get(srId, srCompanyId, srBranchId, srAccYear) {
        return ok('Sale return fetched successfully', await this.service.get({
            id: srId,
            companyId: srCompanyId,
            branchId: srBranchId,
            accYear: srAccYear,
        }));
    }
    async billLines(sbId, sbAccYear) {
        return ok('Bill lines fetched', await this.service.billLines(sbId, sbAccYear));
    }
    async transport(dto) {
        return ok('Transport details saved', await this.service.transport(dto));
    }
};
exports.SaleReturnController = SaleReturnController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update a DRAFT sale return (by srId presence)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_sale_return_dto_1.SaveSaleReturnDto]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Dry-run the post. Writes nothing.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_return_lifecycle_dto_1.ValidateSaleReturnDto]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post: goods in, credit-note legs (SRt), CREDIT_NOTE register row, settlement (CASH | ADJUST | ADVANCE), loyalty claw-back',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_return_lifecycle_dto_1.PostSaleReturnDto]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a POSTED sale return by reversal (SALES_CN_APPLIED refuses it once the credit has been used)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_return_lifecycle_dto_1.CancelSaleReturnDto]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('amend'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Amend a POSTED sale return (no IRN / e-way bill yet): unwind, re-apply, re-post, revision + 1',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_return_lifecycle_dto_1.AmendSaleReturnDto]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "amend", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a DRAFT sale return' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_return_lifecycle_dto_1.SaleReturnKeysDto]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiQuery)({ name: 'srId' }),
    (0, swagger_1.ApiQuery)({ name: 'srCompanyId' }),
    (0, swagger_1.ApiQuery)({ name: 'srBranchId' }),
    (0, swagger_1.ApiQuery)({ name: 'srAccYear' }),
    __param(0, (0, common_1.Query)('srId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('srCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('srBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('srAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('bill-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The bill lines still returnable' }),
    (0, swagger_1.ApiQuery)({ name: 'sbId' }),
    (0, swagger_1.ApiQuery)({ name: 'sbAccYear' }),
    __param(0, (0, common_1.Query)('sbId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sbAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "billLines", null);
__decorate([
    (0, common_1.Put)('transport'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The transport band (direction INWARD); refused after the credit-note IRN or the e-way bill',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sale_return_lifecycle_dto_1.SaleReturnTransportDto]),
    __metadata("design:returntype", Promise)
], SaleReturnController.prototype, "transport", null);
exports.SaleReturnController = SaleReturnController = __decorate([
    (0, swagger_1.ApiTags)('Sale Returns'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('sale-returns'),
    (0, common_1.UseFilters)(sale_return_exception_filter_1.SaleReturnExceptionFilter),
    __metadata("design:paramtypes", [sale_return_service_1.SaleReturnService])
], SaleReturnController);
//# sourceMappingURL=sale-return.controller.js.map