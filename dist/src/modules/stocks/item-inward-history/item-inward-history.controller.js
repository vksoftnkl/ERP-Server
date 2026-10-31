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
exports.ItemInwardHistoryController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const item_inward_history_query_dto_1 = require("./dto/item-inward-history-query.dto");
const item_inward_history_service_1 = require("./item-inward-history.service");
let ItemInwardHistoryController = class ItemInwardHistoryController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list(q) {
        const data = await this.service.list(q);
        return { success: true, message: `${data.length} inward row(s)`, data };
    }
};
exports.ItemInwardHistoryController = ItemInwardHistoryController;
__decorate([
    (0, common_1.Get)('item-inward-history'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: "An item's last inward rows at a branch, newest first",
        description: 'Plan 2026-10-23 §3.2 — the quick rate popup\'s "Recent inward". From stock.stock_ledger: ' +
            "inward (direction +1) rows of type OPENING or PURCHASE, a cancelled document's rows left " +
            "out. Each row: date, txn type, refno, supplier (the row's party, else its lot's), qty " +
            'and free qty in the keyed unit, base qty, cost w/o tax, tax % (cost ÷ cost w/o tax − 1), ' +
            'cost, MRP, batch. limit 1–50, default 10.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'data: ItemInwardRow[]' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'VALIDATION_*' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_inward_history_query_dto_1.ItemInwardHistoryQueryDto]),
    __metadata("design:returntype", Promise)
], ItemInwardHistoryController.prototype, "list", null);
exports.ItemInwardHistoryController = ItemInwardHistoryController = __decorate([
    (0, swagger_1.ApiTags)('Stock'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('stock'),
    __metadata("design:paramtypes", [item_inward_history_service_1.ItemInwardHistoryService])
], ItemInwardHistoryController);
//# sourceMappingURL=item-inward-history.controller.js.map