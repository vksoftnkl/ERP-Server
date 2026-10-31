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
exports.StateController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const state_exception_filter_1 = require("./state-exception.filter");
const state_service_1 = require("./state.service");
const save_state_dto_1 = require("./dto/save-state.dto");
const state_response_dto_1 = require("./dto/state-response.dto");
const state_utils_1 = require("./utils/state.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const api_version_1 = require("../../../common/constants/api-version");
let StateController = class StateController {
    stateService;
    requestContextService;
    constructor(stateService, requestContextService) {
        this.stateService = stateService;
        this.requestContextService = requestContextService;
    }
    async createStateMaster(dto) {
        if (dto.stmId) {
            const data = await this.stateService.save(dto);
            return {
                success: true,
                message: 'State updated successfully',
                data,
            };
        }
        const userId = this.requestContextService.getUserId() ?? state_utils_1.DEFAULT_ACTOR;
        const data = await this.stateService.createStateMaster(dto, userId);
        return {
            success: true,
            message: 'State created successfully',
            data,
        };
    }
    async getById(stmId) {
        const data = await this.stateService.getById(stmId);
        return {
            success: true,
            message: 'State fetched successfully',
            data,
        };
    }
    async remove(stmId) {
        const data = await this.stateService.softDelete(stmId);
        return {
            success: true,
            message: 'State deleted successfully',
            data,
        };
    }
};
exports.StateController = StateController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update state (by stmId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: state_response_dto_1.StateMasterCreateSuccessDto }),
    (0, swagger_1.ApiOkResponse)({ type: state_response_dto_1.StateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: state_response_dto_1.StateErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: state_response_dto_1.StateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: state_response_dto_1.StateErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_state_dto_1.SaveStateDto]),
    __metadata("design:returntype", Promise)
], StateController.prototype, "createStateMaster", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get state by id' }),
    (0, swagger_1.ApiQuery)({ name: 'stmId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: state_response_dto_1.StateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: state_response_dto_1.StateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: state_response_dto_1.StateErrorResponseDto }),
    __param(0, (0, common_1.Query)('stmId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StateController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete state by id' }),
    (0, swagger_1.ApiQuery)({ name: 'stmId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: state_response_dto_1.StateSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: state_response_dto_1.StateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: state_response_dto_1.StateErrorResponseDto }),
    __param(0, (0, common_1.Query)('stmId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StateController.prototype, "remove", null);
exports.StateController = StateController = __decorate([
    (0, swagger_1.ApiTags)('States'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('states'),
    (0, common_1.UseFilters)(state_exception_filter_1.StateExceptionFilter),
    __metadata("design:paramtypes", [state_service_1.StateService,
        request_context_service_1.RequestContextService])
], StateController);
//# sourceMappingURL=state.controller.js.map