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
exports.AreaController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const area_exception_filter_1 = require("./area-exception.filter");
const area_service_1 = require("./area.service");
const save_area_dto_1 = require("./dto/save-area.dto");
const area_response_dto_1 = require("./dto/area-response.dto");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const api_version_1 = require("../../../common/constants/api-version");
let AreaController = class AreaController {
    areaService;
    requestContextService;
    constructor(areaService, requestContextService) {
        this.areaService = areaService;
        this.requestContextService = requestContextService;
    }
    async createAreaMaster(dto) {
        if (dto.armId) {
            const data = await this.areaService.save(dto);
            return {
                success: true,
                message: 'Area updated successfully',
                data,
            };
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const data = await this.areaService.createAreaMaster(dto, userId);
        return {
            success: true,
            message: 'Area created successfully',
            data,
        };
    }
    async getById(armId) {
        const data = await this.areaService.getById(armId);
        return {
            success: true,
            message: 'Area fetched successfully',
            data,
        };
    }
    async remove(armId) {
        const data = await this.areaService.softDelete(armId);
        return {
            success: true,
            message: 'Area deleted successfully',
            data,
        };
    }
};
exports.AreaController = AreaController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update area (by armId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: area_response_dto_1.AreaMasterCreateSuccessDto }),
    (0, swagger_1.ApiOkResponse)({ type: area_response_dto_1.AreaSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: area_response_dto_1.AreaErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: area_response_dto_1.AreaErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: area_response_dto_1.AreaErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_area_dto_1.SaveAreaDto]),
    __metadata("design:returntype", Promise)
], AreaController.prototype, "createAreaMaster", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get area by id' }),
    (0, swagger_1.ApiQuery)({ name: 'armId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: area_response_dto_1.AreaSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: area_response_dto_1.AreaErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: area_response_dto_1.AreaErrorResponseDto }),
    __param(0, (0, common_1.Query)('armId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AreaController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete area by id' }),
    (0, swagger_1.ApiQuery)({ name: 'armId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: area_response_dto_1.AreaSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: area_response_dto_1.AreaErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: area_response_dto_1.AreaErrorResponseDto }),
    __param(0, (0, common_1.Query)('armId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AreaController.prototype, "remove", null);
exports.AreaController = AreaController = __decorate([
    (0, swagger_1.ApiTags)('Areas'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('areas'),
    (0, common_1.UseFilters)(area_exception_filter_1.AreaExceptionFilter),
    __metadata("design:paramtypes", [area_service_1.AreaService,
        request_context_service_1.RequestContextService])
], AreaController);
//# sourceMappingURL=area.controller.js.map