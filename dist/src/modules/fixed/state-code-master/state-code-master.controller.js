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
exports.StateCodeMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const state_code_master_response_dto_1 = require("./dto/state-code-master-response.dto");
const list_state_code_master_query_dto_1 = require("./dto/list-state-code-master-query.dto");
const save_state_code_master_dto_1 = require("./dto/save-state-code-master.dto");
const state_code_master_exception_filter_1 = require("./state-code-master-exception.filter");
const state_code_master_service_1 = require("./state-code-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let StateCodeMasterController = class StateCodeMasterController {
    stateCodeMasterService;
    constructor(stateCodeMasterService) {
        this.stateCodeMasterService = stateCodeMasterService;
    }
    async save(saveStateCodeMasterDto) {
        const data = await this.stateCodeMasterService.save(saveStateCodeMasterDto);
        return {
            success: true,
            message: 'State code saved successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.stateCodeMasterService.list(queryDto);
        return {
            success: true,
            message: 'State codes fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(stateCode) {
        const data = await this.stateCodeMasterService.getById(stateCode);
        return {
            success: true,
            message: 'State code fetched successfully',
            data,
        };
    }
    async remove(stateCode) {
        const data = await this.stateCodeMasterService.softDelete(stateCode);
        return {
            success: true,
            message: 'State code deleted successfully',
            data,
        };
    }
};
exports.StateCodeMasterController = StateCodeMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update state code' }),
    (0, swagger_1.ApiCreatedResponse)({ type: state_code_master_response_dto_1.StateCodeMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_state_code_master_dto_1.SaveStateCodeMasterDto]),
    __metadata("design:returntype", Promise)
], StateCodeMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List state codes with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: state_code_master_response_dto_1.StateCodeMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_state_code_master_query_dto_1.ListStateCodeMasterQueryDto]),
    __metadata("design:returntype", Promise)
], StateCodeMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get state code by code' }),
    (0, swagger_1.ApiQuery)({ name: 'stateCode', description: '2-character state code', example: 'MH' }),
    (0, swagger_1.ApiOkResponse)({ type: state_code_master_response_dto_1.StateCodeMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('stateCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StateCodeMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete state code by code' }),
    (0, swagger_1.ApiQuery)({ name: 'stateCode', description: '2-character state code', example: 'MH' }),
    (0, swagger_1.ApiOkResponse)({ type: state_code_master_response_dto_1.StateCodeMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: state_code_master_response_dto_1.StateCodeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('stateCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StateCodeMasterController.prototype, "remove", null);
exports.StateCodeMasterController = StateCodeMasterController = __decorate([
    (0, swagger_1.ApiTags)('State Code Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('state-code-masters'),
    (0, common_1.UseFilters)(state_code_master_exception_filter_1.StateCodeMasterExceptionFilter),
    __metadata("design:paramtypes", [state_code_master_service_1.StateCodeMasterService])
], StateCodeMasterController);
//# sourceMappingURL=state-code-master.controller.js.map