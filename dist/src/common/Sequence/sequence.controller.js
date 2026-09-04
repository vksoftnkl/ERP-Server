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
exports.SequenceController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../dto/http-error-response.dto");
const list_sequence_query_dto_1 = require("./dto/list-sequence-query.dto");
const sequence_response_dto_1 = require("./dto/sequence-response.dto");
const save_sequence_dto_1 = require("./dto/save-sequence.dto");
const sequence_service_1 = require("./sequence.service");
const api_version_1 = require("../constants/api-version");
let SequenceController = class SequenceController {
    sequenceService;
    constructor(sequenceService) {
        this.sequenceService = sequenceService;
    }
    async save(saveSequenceDto) {
        const data = await this.sequenceService.save(saveSequenceDto);
        return {
            success: true,
            message: saveSequenceDto.id ? 'Sequence updated successfully' : 'Sequence saved successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.sequenceService.list(queryDto);
        return {
            success: true,
            message: 'Sequences fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(id) {
        const data = await this.sequenceService.getById(id);
        return {
            success: true,
            message: 'Sequence fetched successfully',
            data,
        };
    }
    async remove(id) {
        const data = await this.sequenceService.softDelete(id);
        return {
            success: true,
            message: 'Sequence deleted successfully',
            data,
        };
    }
};
exports.SequenceController = SequenceController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update sequence (by id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: sequence_response_dto_1.SequenceSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_sequence_dto_1.SaveSequenceDto]),
    __metadata("design:returntype", Promise)
], SequenceController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List sequences with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: sequence_response_dto_1.SequenceSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_sequence_query_dto_1.ListSequenceQueryDto]),
    __metadata("design:returntype", Promise)
], SequenceController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get sequence by id' }),
    (0, swagger_1.ApiQuery)({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: sequence_response_dto_1.SequenceSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    __param(0, (0, common_1.Query)('id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SequenceController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete sequence by id' }),
    (0, swagger_1.ApiQuery)({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: sequence_response_dto_1.SequenceSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sequence_response_dto_1.SequenceErrorResponseDto }),
    __param(0, (0, common_1.Query)('id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SequenceController.prototype, "remove", null);
exports.SequenceController = SequenceController = __decorate([
    (0, swagger_1.ApiTags)('Sequence'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('sequences'),
    __metadata("design:paramtypes", [sequence_service_1.SequenceService])
], SequenceController);
//# sourceMappingURL=sequence.controller.js.map