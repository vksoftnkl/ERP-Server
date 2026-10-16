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
exports.DaySummaryController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const day_summary_service_1 = require("./day-summary.service");
const day_summary_query_dto_1 = require("./dto/day-summary-query.dto");
const SCOPE_NOTE = 'Counts the legs of POSTED **and** CANCELLED vouchers; DRAFT only as a count. A cancelled ' +
    'pair with both halves inside the range is left out of every figure (it nets to zero) and ' +
    'reported as cancelledPairs; a lone half is counted on its own type row (loneHalves). ' +
    'Amount = Σ DR legs, never avh_doc_amount. branchId absent = All branches; toDate absent = ' +
    'fromDate. Amounts are strings with two decimals; sides are DR / CR. Needs view on menu ' +
    '284 (Account Day Summary) or 181 (Day Book Detail) — 403 NO_MENU_RIGHT otherwise.';
const REFUSALS = 'BRANCH_NOT_IN_COMPANY, YEAR_UNKNOWN, RANGE_OUTSIDE_YEAR, RANGE_REVERSED, TYPE_UNKNOWN';
let DaySummaryController = class DaySummaryController {
    service;
    constructor(service) {
        this.service = service;
    }
    async voucherTypes() {
        const data = await this.service.voucherTypes();
        return { success: true, message: `${data.items.length} voucher type(s)`, data };
    }
    async summary(q) {
        const data = await this.service.summary(q);
        return { success: true, message: 'Account day summary', data };
    }
    async vouchers(q) {
        const data = await this.service.vouchers(q);
        return { success: true, message: `${data.page.totalRows} voucher(s)`, data };
    }
    async daily(q) {
        const data = await this.service.daily(q);
        return { success: true, message: `${data.days.length} day(s)`, data };
    }
    async groupLedgers(q) {
        const data = await this.service.groupLedgers(q);
        return { success: true, message: `${data.ledgers.length} ledger(s)`, data };
    }
    async checkDetail(q) {
        const data = await this.service.checkDetail(q);
        return { success: true, message: `${data.rows.length} row(s)`, data };
    }
    async export(q) {
        const data = await this.service.export(q);
        return { success: true, message: `${data.totalRows} voucher(s)`, data };
    }
};
exports.DaySummaryController = DaySummaryController;
__decorate([
    (0, common_1.Get)('voucher-types'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Type combo',
        description: 'Active voucher types that post legs, in vchr_sort_order. The INVENTORY types that post ' +
            '(OPENING, Phy, StkAdj) are in; Quo and SOr (vchr_affects_accounts = false) are not.',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DaySummaryController.prototype, "voucherTypes", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Summary tab — tiles, type grid, money grid, group grid and checks, one snapshot',
        description: 'One read-only REPEATABLE READ transaction, so every panel ties to the others. ' +
            'businessDay is filled for a one-day request only. With voucherTypeId, money opening / ' +
            'closing are null. checks carry codes and facts, never sentences. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [day_summary_query_dto_1.DaySummaryScopeDto]),
    __metadata("design:returntype", Promise)
], DaySummaryController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('vouchers'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Vouchers tab (day book detail) — one row per voucher, paged',
        description: 'Ordered by date, avh_voucher_slno, voucher id. rowKind NORMAL / CANCELLED / REVERSAL; ' +
            'pairInRange marks the halves /summary left out (shown unless includeCancelledPairs=' +
            'false). natureFilter / moneyKind narrow a drill. withLegs inlines every leg. ' +
            'draftsOnly=true returns the DRAFT headers instead (amount = avh_doc_amount). ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [day_summary_query_dto_1.DaySummaryVouchersDto]),
    __metadata("design:returntype", Promise)
], DaySummaryController.prototype, "vouchers", null);
__decorate([
    (0, common_1.Get)('daily'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Day-wise tab — one row per calendar day',
        description: 'Each day is its own day book: a cancelled pair is left out when both halves fall on ' +
            'that day, so each closing is the true balance at that day’s end and the last one equals ' +
            'the /summary closing. Days with nothing only with zeroRows. Not paged (≤ 366 rows). ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [day_summary_query_dto_1.DaySummaryScopeDto]),
    __metadata("design:returntype", Promise)
], DaySummaryController.prototype, "daily", null);
__decorate([
    (0, common_1.Get)('group-ledgers'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Enter on a group row — the ledgers rolled into it',
        description: 'The ledgers whose group rolls into groupId at groupLevel, same legs and pair rule as ' +
            '/summary. Enter on a ledger opens the Ledger Statement on the client. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: `${REFUSALS}, GROUP_UNKNOWN` }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [day_summary_query_dto_1.DaySummaryGroupLedgersDto]),
    __metadata("design:returntype", Promise)
], DaySummaryController.prototype, "groupLedgers", null);
__decorate([
    (0, common_1.Get)('checks/detail'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: '"Show me" on a check — the rows behind it',
        description: 'code = BALANCED, AMOUNT_TIES, LEGLESS, DRAFTS, CANCELLED_PAIRS, CLEARING_PENDING, ' +
            'BUSINESS_DAY, FUTURE_DATED or NUMBER_GAPS. At most 500 rows (truncated: true beyond).',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: `${REFUSALS}, CHECK_UNKNOWN` }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [day_summary_query_dto_1.DaySummaryCheckDetailDto]),
    __metadata("design:returntype", Promise)
], DaySummaryController.prototype, "checkDetail", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: '/summary plus every /vouchers row, for the client to print / PDF / Excel / WhatsApp',
        description: 'One snapshot. withLegs defaults to true here. Over 20,000 vouchers → 422 ' +
            'RANGE_TOO_LARGE with the count. Data only: nothing is rendered or sent. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'RANGE_TOO_LARGE' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [day_summary_query_dto_1.DaySummaryExportDto]),
    __metadata("design:returntype", Promise)
], DaySummaryController.prototype, "export", null);
exports.DaySummaryController = DaySummaryController = __decorate([
    (0, swagger_1.ApiTags)('Reports — Account Day Summary'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'NO_MENU_RIGHT' }),
    (0, common_1.Controller)('reports/day-summary'),
    __metadata("design:paramtypes", [day_summary_service_1.DaySummaryService])
], DaySummaryController);
//# sourceMappingURL=day-summary.controller.js.map