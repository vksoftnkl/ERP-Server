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
exports.PartyOutstandingController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const party_outstanding_service_1 = require("./party-outstanding.service");
const party_outstanding_query_dto_1 = require("./dto/party-outstanding-query.dto");
const SCOPE_NOTE = 'Pending as on D, as the books stand today: bill − Σ adjustment rows dated ≤ D − the counter ' +
    'tender that has no row (§3.1, tenderDerived). A reversal carries the original date, so a ' +
    'later cancel changes an earlier D. A post-dated cheque settles on its cheque date. ' +
    'Receivable: DR bills are owed, CR bills on-account; Payable the other way round. asOn decides ' +
    'the year; a carried-forward bill is read once (its OPENING copy). branchId absent = all ' +
    'branches. Amounts are strings with two decimals; a balance is {amount, side} with side null ' +
    'on 0.00. Needs view on menu 279 (Reports › Party Outstanding) — 403 otherwise.';
const REFUSALS = 'AS_ON_OUTSIDE_YEARS, BAD_BUCKETS, BAD_SORT, NOT_FOR_PAYABLE (area / salesman / collection ' +
    'day on Payable), BRANCH_NOT_IN_COMPANY, PARTY_NOT_IN_COMPANY, RANGE_REVERSED';
let PartyOutstandingController = class PartyOutstandingController {
    service;
    constructor(service) {
        this.service = service;
    }
    async options(q) {
        const data = await this.service.options(q);
        return { success: true, message: `${data.groups.length} group(s)`, data };
    }
    async parties(q) {
        const data = await this.service.parties(q);
        return { success: true, message: `${data.page.totalRows} part(ies)`, data };
    }
    async party(q) {
        const data = await this.service.party(q);
        return { success: true, message: 'Party card', data };
    }
    async bills(q) {
        const data = await this.service.bills(q);
        return { success: true, message: `${data.rows.length} bill(s)`, data };
    }
    async billWise(q) {
        const data = await this.service.billWise(q);
        return { success: true, message: `${data.page.totalRows} bill(s)`, data };
    }
    async billHistory(q) {
        const data = await this.service.billHistory(q);
        return { success: true, message: `${data.rows.length} row(s)`, data };
    }
    async summary(q) {
        const data = await this.service.summary(q);
        return { success: true, message: `${data.rows.length} row(s)`, data };
    }
    async dueCalendar(q) {
        const data = await this.service.dueCalendar(q);
        return { success: true, message: `${data.days.length} day(s)`, data };
    }
    async export(q) {
        const data = await this.service.export(q);
        return { success: true, message: `${data.totalRows} row(s)`, data };
    }
};
exports.PartyOutstandingController = PartyOutstandingController;
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Filter sources: party groups, areas, salesmen, branches',
        description: 'groups = the side’s default group (Sundry Debtors / Sundry Creditors, isDefault) and its ' +
            'sub-groups in tree order with depth. areas carry their collection days (MON … SUN). areas ' +
            'and salesmen are empty on PAYABLE.',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingOptionsDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "options", null);
__decorate([
    (0, common_1.Get)('parties'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The party grid — one row per party, paged — with its totals and the six tiles',
        description: 'Totals and tiles cover EVERY row that passes the filters, not the page. sort = net | name ' +
            '| overdue | oldest | owed | bucket0 … bucket7 (default net desc); ties break on name, then ' +
            'party id. net = owed − on-account (− PDC in hand with deductPdc). ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingPartiesDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "parties", null);
__decorate([
    (0, common_1.Get)('party'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The party card: facts, ageing, on-account items, PDC, last settlement',
        description: 'pdcInHand = cheques dated after asOn (not yet counted). pdcEffectiveUncleared = dated on or ' +
            'before asOn, not yet cleared: ALREADY counted as settled — information only. ' +
            'lastSettlement = the latest live ALLOCATION on an owed bill, by voucher. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingPartyDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "party", null);
__decorate([
    (0, common_1.Get)('bills'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The open items of one party on asOn (both sides), with the ledger closing',
        description: 'Ordered by bill date, bill no. adjusted = billAmount − pending. ledgerClosing = the party ' +
            'ledger’s balance on asOn by the Ledger Statement’s definition; a difference from ' +
            'totals.net means a posting moved one without the other. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingPartyDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "bills", null);
__decorate([
    (0, common_1.Get)('bill-wise'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Bill-wise tab — open items across parties, paged',
        description: 'The /bills row plus partyId, partyName, area. sort = date | party | due | refno | pending ' +
            '| age | overdue (default date asc). dueOn = owed bills whose dueEff is that day (the Due ' +
            'calendar’s day click). Totals over every row. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingBillWiseDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "billWise", null);
__decorate([
    (0, common_1.Get)('bill-history'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'What settled one bill — every adjustment row, reversals included (3.0’s grid 580)',
        description: 'abj_adj_date, abj_row_no order; amounts signed; effective = dated ≤ asOn. tenderAtBill = ' +
            'the counter tender that has no row ("paid at counter").',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No such bill in the company' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingBillHistoryDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "billHistory", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Group / area summary tab',
        description: 'groupBy = AREA | GROUP (the party ledger’s own group) | SALESMAN (the customer’s default) ' +
            '| BRANCH (the bill’s branch). AREA and SALESMAN are refused on PAYABLE. Totals = the ' +
            '/parties totals. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingSummaryDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('due-calendar'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The Due calendar tab — owed bills pending on asOn, by dueEff, at most 92 days',
        description: 'days lists only the days with something due. overdueBefore = the owed bills whose dueEff ' +
            'is before `from`. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${REFUSALS}, RANGE_TOO_LARGE (> 92 days)`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingDueCalendarDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "dueCalendar", null);
__decorate([
    (0, common_1.Get)('export'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Rows for the client to print / PDF / Excel / WhatsApp',
        description: 'shape = PARTIES (the /parties rows unpaged + totals + tiles) | BILLS (the /bill-wise rows ' +
            'unpaged) | PARTY_STATEMENT (one party’s open bills, ageing, net and PDC — "Print bill ' +
            'balance" / the WhatsApp reminder; needs partyId). printedAs = the filters as one sentence. ' +
            'Capped at 20,000 rows — 422 RANGE_TOO_LARGE. Data only: nothing is rendered or sent. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: `${REFUSALS}, PARTY_REQUIRED, RANGE_TOO_LARGE`,
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [party_outstanding_query_dto_1.OutstandingExportDto]),
    __metadata("design:returntype", Promise)
], PartyOutstandingController.prototype, "export", null);
exports.PartyOutstandingController = PartyOutstandingController = __decorate([
    (0, swagger_1.ApiTags)('Reports — Party-wise Outstanding'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'NO_MENU_RIGHT' }),
    (0, common_1.Controller)('reports/party-outstanding'),
    __metadata("design:paramtypes", [party_outstanding_service_1.PartyOutstandingService])
], PartyOutstandingController);
//# sourceMappingURL=party-outstanding.controller.js.map