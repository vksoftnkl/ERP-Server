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
exports.ItemLedgerController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../../common/dto/http-error-response.dto");
const item_ledger_service_1 = require("./item-ledger.service");
const item_ledger_query_dto_1 = require("./dto/item-ledger-query.dto");
const SCOPE_NOTE = 'One item at one branch. Scope (godownId, bucket — default SALEABLE —, lotId) defines the ' +
    'holding: opening, balance and closing follow it. Row filters (types, showReversed) only hide ' +
    'rows: balances never move, and totals are "of the rows shown". Opening = Σ every ledger row ' +
    'of the holding before `from`, all years. A cancelled / amended pair nets to 0 and is shown ' +
    'greyed (state CANCELLED / AMENDED + REVERSAL). Quantities are strings with 3 dp in the Qty-in ' +
    'unit (unitId, default base), money and rates 2 dp, cost without tax by default (valueAt). ' +
    'Needs view on menu 301 (Reports › Stock Reports › Item Ledger) — 403 ITEM_LEDGER_RIGHT_VIEW.';
const REFUSALS = 'ITEM_LEDGER_RANGE_REVERSED, _BRANCH_NOT_IN_COMPANY, _ITEM_NOT_FOUND, _GODOWN_NOT_IN_BRANCH, ' +
    '_LOT_NOT_OF_ITEM, _UNIT_NOT_OF_ITEM (in that order)';
let ItemLedgerController = class ItemLedgerController {
    service;
    constructor(service) {
        this.service = service;
    }
    async options(q) {
        const data = await this.service.options(q);
        return { success: true, message: 'Item options', data };
    }
    async ledger(q) {
        const data = await this.service.ledger(q);
        return { success: true, message: `${data.page.totalRows} row(s)`, data };
    }
    async days(q) {
        const data = await this.service.days(q);
        return { success: true, message: `${data.days.length} day(s)`, data };
    }
    async months(q) {
        const data = await this.service.months(q);
        return { success: true, message: `${data.months.length} month(s)`, data };
    }
    async export(q) {
        const data = await this.service.export(q);
        return { success: true, message: `${data.totalRows} row(s)`, data };
    }
};
exports.ItemLedgerController = ItemLedgerController;
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The item facts and the More-filters choices (call on an item pick)',
        description: 'godowns = the branch’s live godowns; lots = the item’s lots with any ledger row at this ' +
            'branch (≤ 500, newest expiry first, onHand in base units); types = the report types this ' +
            'item has here, all time; lastCountDate = the latest POSTED physical count with a live line ' +
            'for the item; fy = the financial year of today; rights = print / export on menu 301.',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'ITEM_LEDGER_BRANCH_NOT_IN_COMPANY, ITEM_LEDGER_ITEM_NOT_FOUND',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_ledger_query_dto_1.ItemLedgerOptionsDto]),
    __metadata("design:returntype", Promise)
], ItemLedgerController.prototype, "options", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Vouchers tab: head, opening, closing, totals, tiles, tie, one page of rows, panes',
        description: 'rows in posting order (date, time, posted time, original before its reversal); seq and ' +
            'balanceQty are always the ascending ones, order=desc only flips the listing. page / limit ' +
            '(≤ 5,000, default 1,000) page the rows shown. tie is checked only when to ≥ today (IST). ' +
            'periodTie { qtyEqual, valueEqual } = opening + totals in − out = closing, decided on the ' +
            'exact base numbers before the unit and the rounding (show it, do not re-add the strings); ' +
            'both null when a row filter hides any row. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_ledger_query_dto_1.ItemLedgerQueryDto]),
    __metadata("design:returntype", Promise)
], ItemLedgerController.prototype, "ledger", null);
__decorate([
    (0, common_1.Get)('days'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Day-wise tab: one row per day with movement, opening → closing chain',
        description: `periodTie as on the main route. ${SCOPE_NOTE}`,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_ledger_query_dto_1.ItemLedgerScopeDto]),
    __metadata("design:returntype", Promise)
], ItemLedgerController.prototype, "days", null);
__decorate([
    (0, common_1.Get)('months'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Month-wise tab: every month of the financial year of `to`, up to `to`',
        description: 'No `from`: the months run from the financial year’s first day (public.fiscal_years); the ' +
            'last is partial when to is before its month end. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${REFUSALS}, then ITEM_LEDGER_NO_FISCAL_YEAR`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_ledger_query_dto_1.ItemLedgerMonthsDto]),
    __metadata("design:returntype", Promise)
], ItemLedgerController.prototype, "months", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Every row of the period (no paging) for Excel (CSV) and the A4 print',
        description: 'The main answer’s head, opening, closing, totals and all rows, + printedAs (the filters ' +
            'as one sentence). More than 20,000 rows after the filters = 422 ITEM_LEDGER_TOO_MANY_ROWS. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${REFUSALS}, ITEM_LEDGER_TOO_MANY_ROWS`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_ledger_query_dto_1.ItemLedgerExportDto]),
    __metadata("design:returntype", Promise)
], ItemLedgerController.prototype, "export", null);
exports.ItemLedgerController = ItemLedgerController = __decorate([
    (0, swagger_1.ApiTags)('Stock Reports — Item Ledger'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'ITEM_LEDGER_RIGHT_VIEW' }),
    (0, common_1.Controller)('stock/reports/item-ledger'),
    __metadata("design:paramtypes", [item_ledger_service_1.ItemLedgerService])
], ItemLedgerController);
//# sourceMappingURL=item-ledger.controller.js.map