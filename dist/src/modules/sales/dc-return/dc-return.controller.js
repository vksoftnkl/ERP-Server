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
exports.DcReturnController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const dc_return_exception_filter_1 = require("./dc-return-exception.filter");
const dc_return_service_1 = require("./dc-return.service");
const save_dc_return_dto_1 = require("./dto/save-dc-return.dto");
const dc_return_lifecycle_dto_1 = require("./dto/dc-return-lifecycle.dto");
const ok = (message, data) => ({ success: true, message, data });
let DcReturnController = class DcReturnController {
    service;
    constructor(service) {
        this.service = service;
    }
    async save(dto) {
        return ok(dto.sdrId ? 'DC return updated successfully' : 'DC return created successfully', await this.service.save(dto));
    }
    async post(dto) {
        return ok('DC return posted successfully', await this.service.post(dto));
    }
    async cancel(dto) {
        return ok('DC return cancelled successfully', await this.service.cancel(dto));
    }
    async remove(dto) {
        return ok('Draft DC return deleted successfully', await this.service.delete(dto));
    }
    async get(sdrId, sdrCompanyId, sdrBranchId, sdrAccYear) {
        return ok('DC return fetched successfully', await this.service.get({
            id: sdrId,
            companyId: sdrCompanyId,
            branchId: sdrBranchId,
            accYear: sdrAccYear,
        }));
    }
    async openLines(sdcId, sdcAccYear) {
        return ok('Open challan lines fetched', await this.service.openLines(sdcId, sdcAccYear));
    }
    async transport(dto) {
        return ok('Transport details saved', await this.service.transport(dto));
    }
};
exports.DcReturnController = DcReturnController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a DRAFT DC return (sdrDcId + sdrDcAccYear, lines with sdriDcItemId)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_dc_return_dto_1.SaveDcReturnDto]),
    __metadata("design:returntype", Promise)
], DcReturnController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post: goods back in (DC_RETURN), COGS reversed under PERPETUAL, inward challan register row',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dc_return_lifecycle_dto_1.PostDcReturnDto]),
    __metadata("design:returntype", Promise)
], DcReturnController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a POSTED DC return by reversal' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dc_return_lifecycle_dto_1.CancelDcReturnDto]),
    __metadata("design:returntype", Promise)
], DcReturnController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a DRAFT DC return' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dc_return_lifecycle_dto_1.DcReturnKeysDto]),
    __metadata("design:returntype", Promise)
], DcReturnController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiQuery)({ name: 'sdrId' }),
    (0, swagger_1.ApiQuery)({ name: 'sdrCompanyId' }),
    (0, swagger_1.ApiQuery)({ name: 'sdrBranchId' }),
    (0, swagger_1.ApiQuery)({ name: 'sdrAccYear' }),
    __param(0, (0, common_1.Query)('sdrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sdrCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('sdrBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('sdrAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], DcReturnController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('open-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The challan lines still open for return' }),
    (0, swagger_1.ApiQuery)({ name: 'sdcId' }),
    (0, swagger_1.ApiQuery)({ name: 'sdcAccYear' }),
    __param(0, (0, common_1.Query)('sdcId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sdcAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DcReturnController.prototype, "openLines", null);
__decorate([
    (0, common_1.Put)('transport'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The transport band (direction INWARD); refused after the e-way bill' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dc_return_lifecycle_dto_1.DcReturnTransportDto]),
    __metadata("design:returntype", Promise)
], DcReturnController.prototype, "transport", null);
exports.DcReturnController = DcReturnController = __decorate([
    (0, swagger_1.ApiTags)('DC Returns'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('dc-returns'),
    (0, common_1.UseFilters)(dc_return_exception_filter_1.DcReturnExceptionFilter),
    __metadata("design:paramtypes", [dc_return_service_1.DcReturnService])
], DcReturnController);
//# sourceMappingURL=dc-return.controller.js.map