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
exports.LotByBatchController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const lot_by_batch_query_dto_1 = require("./dto/lot-by-batch-query.dto");
const lot_by_batch_service_1 = require("./lot-by-batch.service");
let LotByBatchController = class LotByBatchController {
    service;
    constructor(service) {
        this.service = service;
    }
    async find(q) {
        const data = await this.service.find(q);
        return { success: true, message: `${data.length} lot(s)`, data };
    }
};
exports.LotByBatchController = LotByBatchController;
__decorate([
    (0, common_1.Get)('by-batch'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The lots carrying a batch number, with their stock at a branch',
        description: 'Textile plan D5 (2026-10-23) — the sale bill scans a batch label. The company’s lots whose ' +
            'batch, trimmed and upper-cased as the lot key folds it, is batchNo. Per lot: lotId, item ' +
            'id / code / name, base unit, batchNo, mrp, salePrice, status, the batch’s sizeId / ' +
            'sizeName, colourId / colourName and model (addendum 2), and the SALEABLE stock at ' +
            'branchId, in total and per godown (onHandQty, availableQty). A lot with none is left out ' +
            'unless includeEmpty=true. One row: fill the line from it; several: pick.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'data: LotByBatchRow[]' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'VALIDATION_*' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'STOCK_BATCH_NOT_FOUND — "No stock with batch CBE26-00001"' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [lot_by_batch_query_dto_1.LotByBatchQueryDto]),
    __metadata("design:returntype", Promise)
], LotByBatchController.prototype, "find", null);
exports.LotByBatchController = LotByBatchController = __decorate([
    (0, swagger_1.ApiTags)('Stock'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('stock/lots'),
    __metadata("design:paramtypes", [lot_by_batch_service_1.LotByBatchService])
], LotByBatchController);
//# sourceMappingURL=lot-by-batch.controller.js.map