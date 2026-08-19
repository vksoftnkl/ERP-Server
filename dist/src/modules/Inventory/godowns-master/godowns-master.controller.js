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
exports.GodownsMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const delete_godown_query_dto_1 = require("./dto/delete-godown-query.dto");
const godown_response_dto_1 = require("./dto/godown-response.dto");
const save_godown_dto_1 = require("./dto/save-godown.dto");
const godown_exception_filter_1 = require("./godown-exception.filter");
const godowns_master_service_1 = require("./godowns-master.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let GodownsMasterController = class GodownsMasterController {
    godownsMasterService;
    constructor(godownsMasterService) {
        this.godownsMasterService = godownsMasterService;
    }
    async save(saveGodownDto, response) {
        const isUpdate = Boolean(saveGodownDto.gdl_id);
        response.status(isUpdate ? common_1.HttpStatus.OK : common_1.HttpStatus.CREATED);
        const data = await this.godownsMasterService.save(saveGodownDto);
        return {
            success: true,
            message: isUpdate
                ? 'Godown location updated successfully'
                : 'Godown location created successfully',
            data,
        };
    }
    async getByQuery(queryDto) {
        return this.listOrGet(queryDto);
    }
    async listOrGet(queryDto) {
        const data = await this.godownsMasterService.getById(queryDto.gdl_id);
        return {
            success: true,
            message: 'Godown location fetched successfully',
            data,
        };
    }
    async remove(queryDto) {
        const { gdl_id, deleted } = await this.godownsMasterService.toggleDelete(queryDto.gdl_id);
        return {
            success: true,
            message: deleted
                ? 'Godown location deleted successfully'
                : 'Godown location restored successfully',
            data: { gdl_id, deleted },
        };
    }
};
exports.GodownsMasterController = GodownsMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update godown location (by gdl_id presence in request body)',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: godown_response_dto_1.GodownSuccessSingleDto }),
    (0, swagger_1.ApiOkResponse)({ type: godown_response_dto_1.GodownSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_godown_dto_1.SaveGodownDto, Object]),
    __metadata("design:returntype", Promise)
], GodownsMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get godown location by gdl_id query parameter (alias of /godowns/get)',
    }),
    (0, swagger_1.ApiOkResponse)({ type: godown_response_dto_1.GodownSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_godown_query_dto_1.DeleteGodownQueryDto]),
    __metadata("design:returntype", Promise)
], GodownsMasterController.prototype, "getByQuery", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get godown location by gdl_id query parameter',
    }),
    (0, swagger_1.ApiOkResponse)({ type: godown_response_dto_1.GodownSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_godown_query_dto_1.DeleteGodownQueryDto]),
    __metadata("design:returntype", Promise)
], GodownsMasterController.prototype, "listOrGet", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore godown location by gdl_id query parameter' }),
    (0, swagger_1.ApiOkResponse)({ type: godown_response_dto_1.GodownSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: godown_response_dto_1.GodownErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [delete_godown_query_dto_1.DeleteGodownQueryDto]),
    __metadata("design:returntype", Promise)
], GodownsMasterController.prototype, "remove", null);
exports.GodownsMasterController = GodownsMasterController = __decorate([
    (0, swagger_1.ApiTags)('Godowns'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('godowns'),
    (0, common_1.UseFilters)(godown_exception_filter_1.GodownExceptionFilter),
    __metadata("design:paramtypes", [godowns_master_service_1.GodownsMasterService])
], GodownsMasterController);
//# sourceMappingURL=godowns-master.controller.js.map