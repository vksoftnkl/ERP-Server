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
exports.LoyaltyStatusController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const loyalty_status_service_1 = require("./loyalty-status.service");
const loyalty_status_query_dto_1 = require("./dto/loyalty-status-query.dto");
const SCOPE_NOTE = '`companyId` is required; `branchId` absent = all branches. "Today" is the company-local date. ' +
    'Needs view on menu 79 (Loyalty Status) — 403 LST_RIGHT_VIEW otherwise.';
let LoyaltyStatusController = class LoyaltyStatusController {
    service;
    constructor(service) {
        this.service = service;
    }
    async members(q) {
        const data = await this.service.members(q);
        return { success: true, message: `${data.total} member(s)`, data };
    }
    async statement(q) {
        const data = await this.service.statement(q);
        return { success: true, message: `${data.rows.length} row(s)`, data };
    }
    async member(q) {
        const data = await this.service.member(q);
        return { success: true, message: 'Loyalty member', data };
    }
    async expiring(q) {
        const data = await this.service.expiring(q);
        return { success: true, message: `${data.total} row(s)`, data };
    }
    async calendar(q) {
        const data = await this.service.calendar(q);
        return { success: true, message: `${data.weeks.length} week(s)`, data };
    }
    async schemes(q) {
        const data = await this.service.schemes(q);
        return { success: true, message: `${data.total} row(s)`, data };
    }
    async monthly(q) {
        const data = await this.service.monthly(q);
        return { success: true, message: `${data.months.length} month(s)`, data };
    }
    async gifts(q) {
        const data = await this.service.gifts(q);
        return { success: true, message: `${data.gifts.length} gift(s)`, data };
    }
    async export(q) {
        const data = await this.service.export(q);
        return { success: true, message: `${data.totalRows} row(s)`, data };
    }
};
exports.LoyaltyStatusController = LoyaltyStatusController;
__decorate([
    (0, common_1.Get)('members'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 1 — the member grid and its tiles',
        description: 'One row per wallet: balance, redeemable, cooling, lapsed, value ₹ (each lot at its own ' +
            'scheme rate), next expiry, best gift, eligible. `summary` is over the WHOLE filtered set, ' +
            'never the page. Redeemed on the screen = redeemed + gift. Sort keys: customerName, cardNo, ' +
            'mobile, schemeName, status, earned, redeemed, expired, gift, adjusted, balance, redeemable, ' +
            'cooling, value, nextExpiryOn, lastActivityOn, enrolledOn, branchName. ' +
            SCOPE_NOTE,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusMembersDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "members", null);
__decorate([
    (0, common_1.Get)('statement'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 1 bottom left — one member’s ledger with a running balance',
        description: 'Ordered by date, time, row no, id. `opening` = Σ points before `from`; `closing` = the ' +
            'wallet balance when `to` is today. showReversals=false hides BOTH halves of a reversed ' +
            'pair. The client opens the source document from srcDocType + srcDocId + srcAccYear.',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MEMBER_NOT_FOUND' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusStatementDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "statement", null);
__decorate([
    (0, common_1.Get)('member'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 1 bottom right — the member card',
        description: 'The card, balance / redeemable / cooling / lapsed, every open lot in FIFO order with its ' +
            'state, the best gift and its tender value, the scheme’s redeem rules, and `unlotted` = ' +
            'balance − Σ lots.left (shown only when ≠ 0). `redeemable` is LoyaltyLedgerService.redeemable() ' +
            'itself — the till’s number (D1).',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MEMBER_NOT_FOUND' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusMemberDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "member", null);
__decorate([
    (0, common_1.Get)('expiring'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 2 — points lapsing within N days, one row per (member, expiry date)',
        description: 'Open lots whose expires_on falls in [today, today + withinDays]. `summary.buckets` cut at ' +
            '≤7 / 8–15 / 16–withinDays; `summary.members` counts a member once. Sort keys: expiresOn, ' +
            'daysLeft, points, value, balance, customerName, cardNo, mobile, schemeName, status, ' +
            'lastActivityOn, branchName. No lastSmsOn yet (plan §7.3). ' +
            SCOPE_NOTE,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusExpiringDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "expiring", null);
__decorate([
    (0, common_1.Get)('expiring/calendar'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 2 chart — points lapsing per week',
        description: 'Weeks start on Monday; weeks with nothing lapsing are returned with zeros.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusCalendarDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "calendar", null);
__decorate([
    (0, common_1.Get)('schemes'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 3 — how each scheme is doing',
        description: 'Movement by lld_lsc_id in [from, to]: opening, earned, redeemed, gift, expired, adjusted, ' +
            'outstanding (= Σ as on `to`), value, usedPct, bills, holders (as on `to`; NULL on ' +
            'scheme_month; does not total). splitBy = scheme | scheme_branch | scheme_month. A CLOSED / ' +
            'ended scheme stays only while its outstanding > 0 (includeClosedHolding). Not paged. ' +
            'branchId here = where the movement happened (lld_branch_id). ' +
            SCOPE_NOTE,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusSchemesDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "schemes", null);
__decorate([
    (0, common_1.Get)('schemes/monthly'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 3 bottom left — one scheme month by month',
        description: 'Every month between from and to, zeros included; `partial` marks a month the period does ' +
            'not cover whole.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusMonthlyDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "monthly", null);
__decorate([
    (0, common_1.Get)('schemes/gifts'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Tab 3 bottom right — the scheme’s gifts',
        description: 'eligibleMembers counts ACTIVE members of the scheme whose redeemable ≥ THIS gift’s points. ' +
            'issuedInPeriod = Σ qty of CONFIRMED gift redemptions in [from, to]. inStock = the sale ' +
            'bill’s own stock read (SALEABLE, branch or all), NULL when the gift does not check stock.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusGiftsDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "gifts", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'A tab’s rows unpaged, with the "Printed as:" line',
        description: '`tab` = members | expiring | schemes | statement with that tab’s filters. `printedAs` is ' +
            'built on the server from every filter applied, so a print cannot disagree with the screen. ' +
            'Capped at 20,000 rows (422 RANGE_TOO_LARGE). Data only — the client renders; `format` is ' +
            'echoed. pdf needs print on menu 79, xlsx needs export.',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'RANGE_TOO_LARGE' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [loyalty_status_query_dto_1.LoyaltyStatusExportDto]),
    __metadata("design:returntype", Promise)
], LoyaltyStatusController.prototype, "export", null);
exports.LoyaltyStatusController = LoyaltyStatusController = __decorate([
    (0, swagger_1.ApiTags)('Reports — Loyalty Status'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'LST_RIGHT_VIEW / PRINT / EXPORT',
    }),
    (0, swagger_1.ApiBadRequestResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'BRANCH_NOT_IN_COMPANY, SCHEME_NOT_IN_COMPANY, RANGE_REVERSED, BAD_SORT',
    }),
    (0, common_1.Controller)('reports/loyalty-status'),
    __metadata("design:paramtypes", [loyalty_status_service_1.LoyaltyStatusService])
], LoyaltyStatusController);
//# sourceMappingURL=loyalty-status.controller.js.map