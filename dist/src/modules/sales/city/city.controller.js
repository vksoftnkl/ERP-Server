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
exports.CityController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const city_exception_filter_1 = require("./city-exception.filter");
const city_service_1 = require("./city.service");
const save_city_dto_1 = require("./dto/save-city.dto");
const city_response_dto_1 = require("./dto/city-response.dto");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const api_version_1 = require("../../../common/constants/api-version");
let CityController = class CityController {
    cityService;
    requestContextService;
    constructor(cityService, requestContextService) {
        this.cityService = cityService;
        this.requestContextService = requestContextService;
    }
    async createCityMaster(dto) {
        if (dto.ctmId) {
            const data = await this.cityService.save(dto);
            return {
                success: true,
                message: 'City updated successfully',
                data,
            };
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const data = await this.cityService.createCityMaster(dto, userId);
        return {
            success: true,
            message: 'City created successfully',
            data,
        };
    }
    async getById(ctmId) {
        const data = await this.cityService.getById(ctmId);
        return {
            success: true,
            message: 'City fetched successfully',
            data,
        };
    }
    async remove(ctmId) {
        const data = await this.cityService.softDelete(ctmId);
        return {
            success: true,
            message: 'City deleted successfully',
            data,
        };
    }
};
exports.CityController = CityController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update city (by ctmId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: city_response_dto_1.CityMasterCreateSuccessDto }),
    (0, swagger_1.ApiOkResponse)({ type: city_response_dto_1.CitySuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: city_response_dto_1.CityErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: city_response_dto_1.CityErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: city_response_dto_1.CityErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_city_dto_1.SaveCityDto]),
    __metadata("design:returntype", Promise)
], CityController.prototype, "createCityMaster", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get city by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ctmId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: city_response_dto_1.CitySuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: city_response_dto_1.CityErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: city_response_dto_1.CityErrorResponseDto }),
    __param(0, (0, common_1.Query)('ctmId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CityController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete city by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ctmId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: city_response_dto_1.CitySuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: city_response_dto_1.CityErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: city_response_dto_1.CityErrorResponseDto }),
    __param(0, (0, common_1.Query)('ctmId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CityController.prototype, "remove", null);
exports.CityController = CityController = __decorate([
    (0, swagger_1.ApiTags)('Cities'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('cities'),
    (0, common_1.UseFilters)(city_exception_filter_1.CityExceptionFilter),
    __metadata("design:paramtypes", [city_service_1.CityService,
        request_context_service_1.RequestContextService])
], CityController);
//# sourceMappingURL=city.controller.js.map