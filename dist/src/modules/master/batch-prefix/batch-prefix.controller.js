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
exports.BatchPrefixController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const batch_prefix_exception_filter_1 = require("./batch-prefix-exception.filter");
const batch_prefix_response_dto_1 = require("./dto/batch-prefix-response.dto");
const list_batch_prefix_query_dto_1 = require("./dto/list-batch-prefix-query.dto");
const save_batch_prefix_dto_1 = require("./dto/save-batch-prefix.dto");
const batch_prefix_service_1 = require("./batch-prefix.service");
const api_version_1 = require("../../../common/constants/api-version");
let BatchPrefixController = class BatchPrefixController {
    batchPrefixService;
    constructor(batchPrefixService) {
        this.batchPrefixService = batchPrefixService;
    }
    async save(saveBatchPrefixDto) {
        const data = await this.batchPrefixService.save(saveBatchPrefixDto);
        return {
            success: true,
            message: saveBatchPrefixDto.id
                ? 'Batch prefix updated successfully'
                : 'Batch prefix created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.batchPrefixService.list(queryDto);
        return {
            success: true,
            message: 'Batch prefixes fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(id) {
        const data = await this.batchPrefixService.getById(id);
        return {
            success: true,
            message: 'Batch prefix fetched successfully',
            data,
        };
    }
    async remove(id) {
        const data = await this.batchPrefixService.delete(id);
        return {
            success: true,
            message: 'Batch prefix deleted successfully',
            data,
        };
    }
};
exports.BatchPrefixController = BatchPrefixController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update batch prefix (by id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: batch_prefix_response_dto_1.BatchPrefixSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_batch_prefix_dto_1.SaveBatchPrefixDto]),
    __metadata("design:returntype", Promise)
], BatchPrefixController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List batch prefixes with search and pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: batch_prefix_response_dto_1.BatchPrefixSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_batch_prefix_query_dto_1.ListBatchPrefixQueryDto]),
    __metadata("design:returntype", Promise)
], BatchPrefixController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get batch prefix by id' }),
    (0, swagger_1.ApiQuery)({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: batch_prefix_response_dto_1.BatchPrefixSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    __param(0, (0, common_1.Query)('id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchPrefixController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Delete batch prefix by id' }),
    (0, swagger_1.ApiQuery)({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: batch_prefix_response_dto_1.BatchPrefixSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: batch_prefix_response_dto_1.BatchPrefixErrorResponseDto }),
    __param(0, (0, common_1.Query)('id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BatchPrefixController.prototype, "remove", null);
exports.BatchPrefixController = BatchPrefixController = __decorate([
    (0, swagger_1.ApiTags)('Batch Prefix'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('batch-prefixes'),
    (0, common_1.UseFilters)(batch_prefix_exception_filter_1.BatchPrefixExceptionFilter),
    __metadata("design:paramtypes", [batch_prefix_service_1.BatchPrefixService])
], BatchPrefixController);
//# sourceMappingURL=batch-prefix.controller.js.map