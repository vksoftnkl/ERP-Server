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
exports.BatchDetailController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const batch_detail_service_1 = require("./batch-detail.service");
const batch_detail_dto_1 = require("./dto/batch-detail.dto");
let BatchDetailController = class BatchDetailController {
    service;
    constructor(service) {
        this.service = service;
    }
    async models(q) {
        const data = await this.service.models(q);
        return { success: true, message: `${data.length} model(s)`, data };
    }
    async update(dto) {
        const data = await this.service.update(dto);
        return { success: true, message: 'Batch detail updated', data };
    }
};
exports.BatchDetailController = BatchDetailController;
__decorate([
    (0, common_1.Get)('models'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The models used before for an item — the Model cell’s suggestions',
        description: 'Textile addendum 2 E3.2. Distinct models (ignoring case) on the item’s live batch ' +
            'details, most recently used first, at most 20. q narrows to models containing it, ' +
            'ignoring case.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'data: string[]' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'VALIDATION_*' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_detail_dto_1.BatchDetailModelsQueryDto]),
    __metadata("design:returntype", Promise)
], BatchDetailController.prototype, "models", null);
__decorate([
    (0, common_1.Post)('update'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Put right a posted batch’s size, colour or model',
        description: 'Textile addendum 2 E2. Once its inward document is posted, a batch’s detail changes only ' +
            'here: a field left out is kept, null clears it, and the reason is required. The before ' +
            'and after are kept on audit.audit_log (screen "Batch Detail"). Stock does not move.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'data: BatchDetailRecord' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'VALIDATION_*' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'STOCK_BATCH_DETAIL_NOT_FOUND' }),
    (0, swagger_1.ApiConflictResponse)({ description: 'STOCK_BATCH_DETAIL_ON_DRAFT — change it on the draft' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        description: 'STOCK_BATCH_SIZE_NOT_FOUND, STOCK_BATCH_COLOUR_NOT_FOUND',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_detail_dto_1.UpdateBatchDetailDto]),
    __metadata("design:returntype", Promise)
], BatchDetailController.prototype, "update", null);
exports.BatchDetailController = BatchDetailController = __decorate([
    (0, swagger_1.ApiTags)('Stock'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('stock/batch-detail'),
    __metadata("design:paramtypes", [batch_detail_service_1.BatchDetailService])
], BatchDetailController);
//# sourceMappingURL=batch-detail.controller.js.map