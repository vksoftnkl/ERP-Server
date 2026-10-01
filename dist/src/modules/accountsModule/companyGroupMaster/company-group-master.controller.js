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
exports.CompanyGroupMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const company_group_master_exception_filter_1 = require("./company-group-master-exception.filter");
const company_group_master_response_dto_1 = require("./dto/company-group-master-response.dto");
const save_company_group_master_dto_1 = require("./dto/save-company-group-master.dto");
const company_group_master_service_1 = require("./company-group-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let CompanyGroupMasterController = class CompanyGroupMasterController {
    companyGroupMasterService;
    constructor(companyGroupMasterService) {
        this.companyGroupMasterService = companyGroupMasterService;
    }
    async save(saveCompanyGroupMasterDto) {
        const data = await this.companyGroupMasterService.save(saveCompanyGroupMasterDto);
        return {
            success: true,
            message: saveCompanyGroupMasterDto.cogGroupId
                ? 'Company group updated successfully'
                : 'Company group created successfully',
            data,
        };
    }
    async getById(cogGroupId) {
        const data = await this.companyGroupMasterService.getById(cogGroupId);
        return {
            success: true,
            message: 'Company group fetched successfully',
            data,
        };
    }
    async remove(cogGroupId) {
        const data = await this.companyGroupMasterService.softDelete(cogGroupId);
        return {
            success: true,
            message: 'Company group deleted successfully',
            data,
        };
    }
};
exports.CompanyGroupMasterController = CompanyGroupMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update company group (by cogGroupId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_company_group_master_dto_1.SaveCompanyGroupMasterDto]),
    __metadata("design:returntype", Promise)
], CompanyGroupMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get company group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'cogGroupId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('cogGroupId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CompanyGroupMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete company group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'cogGroupId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: company_group_master_response_dto_1.CompanyGroupMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('cogGroupId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CompanyGroupMasterController.prototype, "remove", null);
exports.CompanyGroupMasterController = CompanyGroupMasterController = __decorate([
    (0, swagger_1.ApiTags)('Company Group Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('company-group-masters'),
    (0, common_1.UseFilters)(company_group_master_exception_filter_1.CompanyGroupMasterExceptionFilter),
    __metadata("design:paramtypes", [company_group_master_service_1.CompanyGroupMasterService])
], CompanyGroupMasterController);
//# sourceMappingURL=company-group-master.controller.js.map