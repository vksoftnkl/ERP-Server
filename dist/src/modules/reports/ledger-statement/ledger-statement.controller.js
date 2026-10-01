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
exports.LedgerStatementController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const ledger_statement_service_1 = require("./ledger-statement.service");
const ledger_statement_query_dto_1 = require("./dto/ledger-statement-query.dto");
const SCOPE_NOTE = 'Counts POSTED **and** CANCELLED vouchers (a cancel keeps the original’s legs and posts a ' +
    'POSTED mirror — the pair nets to zero); DRAFT never. branchId absent = All branches (every ' +
    'opening set + every branch’s legs). Amounts are strings with two decimals; sides are DR / CR. ' +
    'Needs view on menu 258 (Ledger Statement) or 144 (Ledger Monthly Summary) — 403 otherwise.';
let LedgerStatementController = class LedgerStatementController {
    service;
    constructor(service) {
        this.service = service;
    }
    async ledgers(q) {
        const data = await this.service.ledgers(q);
        return { success: true, message: `${data.items.length} ledger(s)`, data };
    }
    async header(q) {
        const data = await this.service.header(q);
        return { success: true, message: 'Ledger statement header', data };
    }
    async vouchers(q) {
        const data = await this.service.vouchers(q);
        return { success: true, message: `${data.page.totalRows} voucher(s)`, data };
    }
    async voucherLegs(q) {
        const data = await this.service.voucherLegs(q);
        return { success: true, message: `${data.legs.length} leg(s)`, data };
    }
    async daily(q) {
        const data = await this.service.daily(q);
        return { success: true, message: `${data.days.length} day(s)`, data };
    }
    async monthly(q) {
        const data = await this.service.monthly(q);
        return { success: true, message: `${data.months.length} month(s)`, data };
    }
    async export(q) {
        const data = await this.service.export(q);
        return { success: true, message: `${data.totalRows} voucher(s)`, data };
    }
};
exports.LedgerStatementController = LedgerStatementController;
__decorate([
    (0, common_1.Get)('ledgers'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The ledger picker (search-as-you-type, PgUp / PgDn within a group)',
        description: 'Ledgers of the company plus the shared ones (led_company_id IS NULL), sorted by name. ' +
            '`search` matches name, alias, short name, GSTIN or phone.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_statement_query_dto_1.LedgerStatementLedgersDto]),
    __metadata("design:returntype", Promise)
], LedgerStatementController.prototype, "ledgers", null);
__decorate([
    (0, common_1.Get)('header'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'LEDGER DETAIL + PERIOD SUMMARY — the three top panels',
        description: 'Opening at fromDate, gross debit / credit in the period with voucher counts, closing at ' +
            'toDate, cancelled pairs inside the period, and openingNote = COMPANY_LEVEL_ONLY when a ' +
            'branch is picked but the ledger was opened at company level only. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'LEDGER_NOT_IN_COMPANY, BRANCH_NOT_IN_COMPANY, YEAR_UNKNOWN, RANGE_OUTSIDE_YEAR, RANGE_REVERSED',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_statement_query_dto_1.LedgerStatementRangeDto]),
    __metadata("design:returntype", Promise)
], LedgerStatementController.prototype, "header", null);
__decorate([
    (0, common_1.Get)('vouchers'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The voucher grid — one row per voucher, running balance, paged',
        description: 'Ordered by date, avh_voucher_slno, voucher id. debit / credit are this ledger’s gross ' +
            'DR / CR legs in the voucher (L3); the balance moves by the net. broughtForward / ' +
            'carriedForward are exact for the page. rowKind NORMAL / CANCELLED / REVERSAL; ' +
            'includeCancelled=false hides a pair only when both halves are in the range. ' +
            'withLegs=true inlines every leg (L4). Opening / total / closing are not rows. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_statement_query_dto_1.LedgerStatementVouchersDto]),
    __metadata("design:returntype", Promise)
], LedgerStatementController.prototype, "vouchers", null);
__decorate([
    (0, common_1.Get)('voucher-legs'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Every leg of one voucher (Alt+F1 / the ▾ toggle)',
        description: 'av_row_no order; isThisLedger marks the statement ledger’s legs; role = av_role.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_statement_query_dto_1.LedgerStatementVoucherLegsDto]),
    __metadata("design:returntype", Promise)
], LedgerStatementController.prototype, "voucherLegs", null);
__decorate([
    (0, common_1.Get)('daily'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Daily tab — one row per date with movement',
        description: 'Not paged: a fiscal year is at most 366 rows. ' + SCOPE_NOTE,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_statement_query_dto_1.LedgerStatementRangeDto]),
    __metadata("design:returntype", Promise)
], LedgerStatementController.prototype, "daily", null);
__decorate([
    (0, common_1.Get)('monthly'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The MONTH-WISE panel / Monthly tab — every month of the fiscal year',
        description: 'Always the whole year from fy_begin_date, months with no movement included (closing ' +
            'carried) and future months flagged isFuture. Also what menu 144 opens (L1). ' +
            SCOPE_NOTE,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_statement_query_dto_1.LedgerStatementScopeDto]),
    __metadata("design:returntype", Promise)
], LedgerStatementController.prototype, "monthly", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Header + every row, for the client to print / PDF / Excel / WhatsApp',
        description: 'The /vouchers rows unpaged, with the /header panels. Capped at 20,000 rows — beyond ' +
            'that 422 RANGE_TOO_LARGE with the count. Data only: nothing is rendered or sent. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'RANGE_TOO_LARGE' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ledger_statement_query_dto_1.LedgerStatementExportDto]),
    __metadata("design:returntype", Promise)
], LedgerStatementController.prototype, "export", null);
exports.LedgerStatementController = LedgerStatementController = __decorate([
    (0, swagger_1.ApiTags)('Reports — Ledger Statement'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'NO_MENU_RIGHT' }),
    (0, common_1.Controller)('reports/ledger-statement'),
    __metadata("design:paramtypes", [ledger_statement_service_1.LedgerStatementService])
], LedgerStatementController);
//# sourceMappingURL=ledger-statement.controller.js.map