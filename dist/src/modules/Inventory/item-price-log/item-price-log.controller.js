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
exports.ItemPriceLogController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const item_price_log_query_dto_1 = require("./dto/item-price-log-query.dto");
const item_price_log_service_1 = require("./item-price-log.service");
const RIGHT = 'Needs um_can_view on menu 290 (Price Change Log); 403 IPCL_RIGHT_VIEW otherwise.';
let ItemPriceLogController = class ItemPriceLogController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list(q) {
        const data = await this.service.list(q);
        return { success: true, message: `${data.meta.total} price change(s)`, data };
    }
    async get(q) {
        const data = await this.service.get(q);
        return { success: true, message: `${data.itemName ?? data.itemId}: ${data.action}`, data };
    }
    async days(q) {
        const data = await this.service.days(q);
        return { success: true, message: `${data.length} day(s) with price changes`, data };
    }
    async itemHistory(q) {
        const data = await this.service.itemHistory(q);
        return { success: true, message: `${data.length} price change(s)`, data };
    }
    async gaps(q) {
        const data = await this.service.gaps(q);
        return {
            success: true,
            message: data.total ? `${data.total} price row(s) changed without a log row` : 'No gaps',
            data,
        };
    }
};
exports.ItemPriceLogController = ItemPriceLogController;
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Every price change in a range, newest first, paged',
        description: 'One row per changed price row (IPM item_price_master) or qty slab (IQP item_qty_price): ' +
            'who, when, where from, the source screen, the scope, the old / new headline figures, and ' +
            '(notes 145) fields[]: every changed column with its label and value before → after, ' +
            'price first then its w/o-tax and markup companions. Optional deviceId, and field (a ' +
            'column name, e.g. ipm_sales_price_b: only the changes that touched it). ' +
            'A company sees its shared prices too, a branch the all-branches ones. ' +
            `fromDate / toDate are IST days, at most 366 apart. ${RIGHT}`,
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'items and meta { page, limit, total }.' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'VALIDATION_* or IPCL_BAD_RANGE.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'IPCL_RIGHT_VIEW.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_price_log_query_dto_1.ListItemPriceLogQueryDto]),
    __metadata("design:returntype", Promise)
], ItemPriceLogController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One price change, with the row before and after and a labelled diff',
        description: `fields[] names each changed column with its report label. ${RIGHT}`,
    }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'IPCL_NOT_FOUND.' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'IPCL_RIGHT_VIEW.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_price_log_query_dto_1.GetItemPriceLogQueryDto]),
    __metadata("design:returntype", Promise)
], ItemPriceLogController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('days'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Price changes per day in a range',
        description: `The same filters as /list. Per day: changes, price rows, slabs, items, users, saves. ${RIGHT}`,
    }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'IPCL_RIGHT_VIEW.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_price_log_query_dto_1.ItemPriceLogFilterDto]),
    __metadata("design:returntype", Promise)
], ItemPriceLogController.prototype, "days", null);
__decorate([
    (0, common_1.Get)('item-history'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One item’s price changes, newest first',
        description: `Across every scope unless companyId / branchId / priceTable narrow it. ${RIGHT}`,
    }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'IPCL_RIGHT_VIEW.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_price_log_query_dto_1.ItemPriceHistoryQueryDto]),
    __metadata("design:returntype", Promise)
], ItemPriceLogController.prototype, "itemHistory", null);
__decorate([
    (0, common_1.Get)('gaps'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The gap count: price rows changed without a log row',
        description: 'Plan §2.6. Every price row touched since the log began is compared with its latest log ' +
            'row: NOT_LOGGED (no log row) or DIFFERS (the row is not what its last log row says). ' +
            `0 is the healthy answer. ${RIGHT}`,
    }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'IPCL_RIGHT_VIEW.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_price_log_query_dto_1.ItemPriceLogGapsQueryDto]),
    __metadata("design:returntype", Promise)
], ItemPriceLogController.prototype, "gaps", null);
exports.ItemPriceLogController = ItemPriceLogController = __decorate([
    (0, swagger_1.ApiTags)('Item Price Log'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('item-price-log'),
    __metadata("design:paramtypes", [item_price_log_service_1.ItemPriceLogService])
], ItemPriceLogController);
//# sourceMappingURL=item-price-log.controller.js.map