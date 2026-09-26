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
exports.CompanyMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const company_master_exception_filter_1 = require("./company-master-exception.filter");
const company_master_response_dto_1 = require("./dto/company-master-response.dto");
const save_company_master_dto_1 = require("./dto/save-company-master.dto");
const company_master_service_1 = require("./company-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let CompanyMasterController = class CompanyMasterController {
    companyMasterService;
    constructor(companyMasterService) {
        this.companyMasterService = companyMasterService;
    }
    async save(saveCompanyMasterDto) {
        const data = await this.companyMasterService.save(saveCompanyMasterDto);
        return {
            success: true,
            message: saveCompanyMasterDto.compId
                ? 'Company updated successfully'
                : 'Company created successfully',
            data,
        };
    }
    async getById(compId) {
        const data = await this.companyMasterService.getById(compId);
        return {
            success: true,
            message: 'Company fetched successfully',
            data,
        };
    }
    async remove(compId) {
        const data = await this.companyMasterService.softDelete(compId);
        return {
            success: true,
            message: 'Company deleted successfully',
            data,
        };
    }
};
exports.CompanyMasterController = CompanyMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update company (by compId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: company_master_response_dto_1.CompanyMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: company_master_response_dto_1.CompanyMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: company_master_response_dto_1.CompanyMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: company_master_response_dto_1.CompanyMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_company_master_dto_1.SaveCompanyMasterDto]),
    __metadata("design:returntype", Promise)
], CompanyMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get company by id' }),
    (0, swagger_1.ApiQuery)({ name: 'compId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' }),
    (0, swagger_1.ApiOkResponse)({ type: company_master_response_dto_1.CompanyMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: company_master_response_dto_1.CompanyMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: company_master_response_dto_1.CompanyMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('compId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CompanyMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete company by id' }),
    (0, swagger_1.ApiQuery)({ name: 'compId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' }),
    (0, swagger_1.ApiOkResponse)({ type: company_master_response_dto_1.CompanyMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: company_master_response_dto_1.CompanyMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: company_master_response_dto_1.CompanyMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('compId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CompanyMasterController.prototype, "remove", null);
exports.CompanyMasterController = CompanyMasterController = __decorate([
    (0, swagger_1.ApiTags)('Company Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('company-masters'),
    (0, common_1.UseFilters)(company_master_exception_filter_1.CompanyMasterExceptionFilter),
    __metadata("design:paramtypes", [company_master_service_1.CompanyMasterService])
], CompanyMasterController);
//# sourceMappingURL=company-master.controller.js.map