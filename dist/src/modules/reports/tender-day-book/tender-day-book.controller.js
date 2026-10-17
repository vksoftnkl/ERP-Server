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
exports.TenderDayBookController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const tender_day_book_dto_1 = require("./tender-day-book.dto");
const tender_day_book_service_1 = require("./tender-day-book.service");
const SCOPE_NOTE = 'Every leg on a CASH / BANK ledger (led_ledger_type) of a POSTED or CANCELLED voucher, labelled by ' +
    'its tender rows: the voucher’s own (td_voucher_id / td_src_doc_id), the document’s (a bill’s, a ' +
    'return’s), a re-tender’s voided and replacing rows, a reversal mirror’s original’s (sides flipped). ' +
    'A row labels the ledger it names or its settlement ledger. Rows short of a leg leave the rest with ' +
    'no tender. Amounts are strings, 2 dp. Menu 284 (Account Day Summary) or 181 (Day Book Detail) view, ' +
    'else 403 NO_MENU_RIGHT.';
const REFUSALS = 'YEAR_UNKNOWN, BRANCH_NOT_IN_COMPANY, RANGE_REVERSED, RANGE_OUTSIDE_YEAR, DATE_REQUIRED';
let TenderDayBookController = class TenderDayBookController {
    service;
    constructor(service) {
        this.service = service;
    }
    async dayBook(q) {
        const data = await this.service.dayBook(q);
        return { success: true, message: `${data.groups.length} tender group(s)`, data };
    }
    async noTender(q) {
        const data = await this.service.noTender(q);
        return {
            success: true,
            message: data.count === 0 ? 'Every money line has its tender' : `${data.count} money line(s) with no tender`,
            data,
        };
    }
};
exports.TenderDayBookController = TenderDayBookController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Day Book by tender: cash / bank movement per tender (or tender type) and ledger',
        description: '`groups`: per ledger × tender master (groupBy TENDER — each machine / QR / cash tender on its ' +
            'own) or × tender type (groupBy TYPE), opening (the year’s lines before fromDate), debit, credit, ' +
            'closing; a group with tenderId and tenderTypeId null is the lines with NO tender. `ledgers`: the ' +
            'books per ledger — the opening set (acc_opening_balance: not a transaction, so in no tender group) ' +
            '+ every line — so Σ groups + openingSet = the ledger. `rows`: the range line by line (withRows=' +
            'false leaves them out; limit caps them, rowsTruncated says so). Filters: tenderIds, tenderTypeIds ' +
            '(groups and rows), sessionId (the voucher’s till session), branchId. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_day_book_dto_1.TenderDayBookQueryDto]),
    __metadata("design:returntype", Promise)
], TenderDayBookController.prototype, "dayBook", null);
__decorate([
    (0, common_1.Get)('no-tender'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Money lines with no tender — should always be empty',
        description: 'Every cash / bank line no tender row labels, in the range (fromDate absent = the year’s start, ' +
            'toDate absent = today): count, amount, the count per voucher type, the lines. Each one is a ' +
            'transaction to look into — since notes 126 the server refuses (or, at the counter, labels) every ' +
            'new one. ' +
            SCOPE_NOTE,
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: REFUSALS }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tender_day_book_dto_1.NoTenderQueryDto]),
    __metadata("design:returntype", Promise)
], TenderDayBookController.prototype, "noTender", null);
exports.TenderDayBookController = TenderDayBookController = __decorate([
    (0, swagger_1.ApiTags)('Reports — Day Book by tender'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'NO_MENU_RIGHT' }),
    (0, common_1.Controller)('reports/tender-day-book'),
    __metadata("design:paramtypes", [tender_day_book_service_1.TenderDayBookService])
], TenderDayBookController);
//# sourceMappingURL=tender-day-book.controller.js.map