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
exports.ConfigsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const configs_exception_filter_1 = require("./configs-exception.filter");
const configs_response_dto_1 = require("./dto/configs-response.dto");
const save_configs_dto_1 = require("./dto/save-configs.dto");
const configs_service_1 = require("./configs.service");
const api_version_1 = require("../../../common/constants/api-version");
let ConfigsController = class ConfigsController {
    configsService;
    constructor(configsService) {
        this.configsService = configsService;
    }
    async save(saveConfigsDto) {
        const data = await this.configsService.save(saveConfigsDto);
        return {
            success: true,
            message: 'Config saved successfully',
            data,
        };
    }
    async getById(configId) {
        const data = await this.configsService.getById(configId);
        return {
            success: true,
            message: 'Config fetched successfully',
            data,
        };
    }
};
exports.ConfigsController = ConfigsController;
__decorate([
    (0, common_1.Post)('update'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update a config' }),
    (0, swagger_1.ApiCreatedResponse)({ type: configs_response_dto_1.ConfigsSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: configs_response_dto_1.ConfigsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: configs_response_dto_1.ConfigsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: configs_response_dto_1.ConfigsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_configs_dto_1.SaveConfigsDto]),
    __metadata("design:returntype", Promise)
], ConfigsController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get config by id' }),
    (0, swagger_1.ApiQuery)({ name: 'configId', schema: { type: 'integer' }, example: 1 }),
    (0, swagger_1.ApiOkResponse)({ type: configs_response_dto_1.ConfigsSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: configs_response_dto_1.ConfigsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: configs_response_dto_1.ConfigsErrorResponseDto }),
    __param(0, (0, common_1.Query)('configId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ConfigsController.prototype, "getById", null);
exports.ConfigsController = ConfigsController = __decorate([
    (0, swagger_1.ApiTags)('Configs'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('configs'),
    (0, common_1.UseFilters)(configs_exception_filter_1.ConfigsExceptionFilter),
    __metadata("design:paramtypes", [configs_service_1.ConfigsService])
], ConfigsController);
//# sourceMappingURL=configs.controller.js.map