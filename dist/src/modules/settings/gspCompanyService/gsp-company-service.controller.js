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
exports.GspCompanyServiceController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const gsp_company_service_response_dto_1 = require("./dto/gsp-company-service-response.dto");
const save_gsp_company_service_dto_1 = require("./dto/save-gsp-company-service.dto");
const gsp_company_service_exception_filter_1 = require("./gsp-company-service-exception.filter");
const gsp_company_service_service_1 = require("./gsp-company-service.service");
const api_version_1 = require("../../../common/constants/api-version");
let GspCompanyServiceController = class GspCompanyServiceController {
    gspCompanyServiceService;
    constructor(gspCompanyServiceService) {
        this.gspCompanyServiceService = gspCompanyServiceService;
    }
    async save(saveGspCompanyServiceDto) {
        const data = await this.gspCompanyServiceService.save(saveGspCompanyServiceDto);
        return {
            success: true,
            message: saveGspCompanyServiceDto.csgCompanyServiceId
                ? 'GSP company service updated successfully'
                : 'GSP company service created successfully',
            data,
        };
    }
    async getById(csgCompanyServiceId) {
        const data = await this.gspCompanyServiceService.getById(csgCompanyServiceId);
        return {
            success: true,
            message: 'GSP company service fetched successfully',
            data,
        };
    }
    async remove(csgCompanyServiceId) {
        const data = await this.gspCompanyServiceService.softDelete(csgCompanyServiceId);
        return {
            success: true,
            message: 'GSP company service deleted successfully',
            data,
        };
    }
};
exports.GspCompanyServiceController = GspCompanyServiceController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update GSP company service (by csgCompanyServiceId presence)',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gsp_company_service_dto_1.SaveGspCompanyServiceDto]),
    __metadata("design:returntype", Promise)
], GspCompanyServiceController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get GSP company service by id' }),
    (0, swagger_1.ApiQuery)({ name: 'csgCompanyServiceId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceErrorResponseDto }),
    __param(0, (0, common_1.Query)('csgCompanyServiceId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GspCompanyServiceController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete GSP company service by id' }),
    (0, swagger_1.ApiQuery)({ name: 'csgCompanyServiceId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: gsp_company_service_response_dto_1.GspCompanyServiceErrorResponseDto }),
    __param(0, (0, common_1.Query)('csgCompanyServiceId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GspCompanyServiceController.prototype, "remove", null);
exports.GspCompanyServiceController = GspCompanyServiceController = __decorate([
    (0, swagger_1.ApiTags)('GSP Company Service'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('gsp-company-services'),
    (0, common_1.UseFilters)(gsp_company_service_exception_filter_1.GspCompanyServiceExceptionFilter),
    __metadata("design:paramtypes", [gsp_company_service_service_1.GspCompanyServiceService])
], GspCompanyServiceController);
//# sourceMappingURL=gsp-company-service.controller.js.map