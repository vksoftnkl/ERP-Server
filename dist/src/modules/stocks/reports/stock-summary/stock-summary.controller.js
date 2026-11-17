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
exports.StockSummaryController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../../common/dto/http-error-response.dto");
const stock_summary_service_1 = require("./stock-summary.service");
const stock_summary_query_dto_1 = require("./dto/stock-summary-query.dto");
const SCOPE_NOTE = 'One branch, a period. Scope (godownId, bucket — default SALEABLE —, groupId / brandId with ' +
    'their subtrees) defines what a row adds up. Inward / outward by type, not sign (a reversal ' +
    'keeps its type with a minus); internal moves with both legs in scope net. Value = the stock ' +
    'engine’s valuation at the date (qty × the branch pool’s rate), cost without tax by default; ' +
    'costAdj = value − (openingValue + inwardValue − outwardValue). Quantities 3 dp in the Qty-in ' +
    'unit, money and rates 2 dp. reserved / available / inTransit / tie / the EXPIRY chip only ' +
    'when to ≥ today (IST). Needs view on menu 302 — 403 STOCK_SUMMARY_RIGHT_VIEW.';
const SCOPE_REFUSALS = 'STOCK_SUMMARY_RANGE_REVERSED, _BRANCH_NOT_IN_COMPANY, _GODOWN_NOT_IN_BRANCH, _GROUP_NOT_FOUND, ' +
    '_BRAND_NOT_FOUND (in that order)';
const RUN_NOTE = 'Reads the run kept by Show (no SQL beyond the rights row). A run lives 15 min idle (each ' +
    'read renews) and answers only its own user: anything else is 410 STOCK_SUMMARY_RUN_EXPIRED — ' +
    'run Show again.';
let StockSummaryController = class StockSummaryController {
    service;
    constructor(service) {
        this.service = service;
    }
    async options(q) {
        const data = await this.service.options(q);
        return { success: true, message: 'Summary options', data };
    }
    async show(q) {
        const data = await this.service.show(q);
        return { success: true, message: `${data.page.totalRows} item(s)`, data };
    }
    async rows(q) {
        const data = await this.service.rows(q);
        return { success: true, message: `${data.page.totalRows} row(s)`, data };
    }
    async item(q) {
        const data = await this.service.item(q);
        return { success: true, message: 'Item detail', data };
    }
    async groups(q) {
        const data = await this.service.groups(q);
        return { success: true, message: `${data.rows.length} group(s)`, data };
    }
    async godowns(q) {
        const data = await this.service.godowns(q);
        return { success: true, message: `${data.page.totalRows} row(s)`, data };
    }
    async branches(q) {
        const data = await this.service.branches(q);
        return { success: true, message: `${data.page.totalRows} item(s)`, data };
    }
    async export(q) {
        const data = await this.service.export(q);
        return { success: true, message: `${data.totalRows} row(s)`, data };
    }
};
exports.StockSummaryController = StockSummaryController;
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The page’s choices: godowns of the branch, buckets, today, FY, defaults, rights',
        description: 'Call when the screen opens and when the Company or Branch changes. defaults.from = the 1st ' +
            'of this month (IST), defaults.to = today.',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryOptionsDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "options", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Show: compute the Item-wise run once, keep it, answer page 1',
        description: 'head (runId, asOf, todayOnly …), tiles and totals over the whole run (totals.rowsShown ' +
            'follows the view), tie, transitOut, one page of rows. Later pages / sorts / Find / tile ' +
            'filters go to /rows with head.runId. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${SCOPE_REFUSALS}, STOCK_SUMMARY_TOO_MANY_ITEMS`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryQueryDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "show", null);
__decorate([
    (0, common_1.Get)('rows'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Another page / sort / filter / Find of a run (Item-wise or Branch-wise rows)',
        description: `totalsShown = the value totals of every row of the view. ${RUN_NOTE}`,
    }),
    (0, swagger_1.ApiGoneResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryRowsDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "rows", null);
__decorate([
    (0, common_1.Get)('item'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The two panes for one row: item facts, Lots & godowns, Movement',
        description: 'Stateless (the scope again + itemId). lots.source STOCK_BALANCE when to ≥ today, else ' +
            'LEDGER (the holdings at the pool rate, no reserved / available). movement.byType = the ' +
            'Item Ledger’s By voucher type for the same scope; its opening / closing values are the ' +
            'Summary’s. runId (optional) adds ties.row = the pane equals the grid row. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${SCOPE_REFUSALS}, then STOCK_SUMMARY_ITEM_NOT_FOUND`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryItemDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "item", null);
__decorate([
    (0, common_1.Get)('groups'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Group summary tab of an Item-wise run (by Group / Brand / Section / Category)',
        description: `A null key is "(No …)"; drill with groupBy + groupKey=NONE on /rows. ${RUN_NOTE}`,
    }),
    (0, swagger_1.ApiGoneResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryGroupsDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "groups", null);
__decorate([
    (0, common_1.Get)('godowns'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Godown-wise tab of an Item-wise run: one qty column per godown + value',
        description: 'Columns = the branch’s godowns with any non-zero cell in the run. The Godown filter is ' +
            `ignored here (this tab is the split); the bucket scope holds. ${RUN_NOTE}`,
    }),
    (0, swagger_1.ApiGoneResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryGodownsDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "godowns", null);
__decorate([
    (0, common_1.Get)('branches'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Branch-wise tab: open a Branch-wise run (one column per branch + in transit + chain)',
        description: 'No godownId (400 if sent). head.source STOCK_BALANCE when to ≥ today (stock_balance + ' +
            'stock_transit), else LEDGER (a company-wide replay, slower). Later pages through /rows. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${SCOPE_REFUSALS}, STOCK_SUMMARY_TOO_MANY_ITEMS`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryBranchesDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "branches", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Every row of the tab on screen (no paging) for Excel (CSV) and print',
        description: 'tab ITEMS / GROUPS / GODOWNS read an Item-wise run, BRANCHES a Branch-wise one (another ' +
            'kind = 410). Needs VIEW and EXPORT on 302. More than 20,000 rows = 422 ' +
            `STOCK_SUMMARY_TOO_MANY_ROWS. ${RUN_NOTE}`,
    }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'STOCK_SUMMARY_RIGHT_VIEW, STOCK_SUMMARY_RIGHT_EXPORT',
    }),
    (0, swagger_1.ApiGoneResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'STOCK_SUMMARY_RUN_EXPIRED' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'STOCK_SUMMARY_TOO_MANY_ROWS',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stock_summary_query_dto_1.StockSummaryExportDto]),
    __metadata("design:returntype", Promise)
], StockSummaryController.prototype, "export", null);
exports.StockSummaryController = StockSummaryController = __decorate([
    (0, swagger_1.ApiTags)('Stock Reports — Stock Summary'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'STOCK_SUMMARY_RIGHT_VIEW' }),
    (0, common_1.Controller)('stock/reports/summary'),
    __metadata("design:paramtypes", [stock_summary_service_1.StockSummaryService])
], StockSummaryController);
//# sourceMappingURL=stock-summary.controller.js.map