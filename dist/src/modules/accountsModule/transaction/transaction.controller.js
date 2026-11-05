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
exports.TransactionController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const adjustable_credit_response_dto_1 = require("./dto/adjustable-credit-response.dto");
const get_party_adjustable_credits_dto_1 = require("./dto/get-party-adjustable-credits.dto");
const transaction_exception_filter_1 = require("./transaction-exception.filter");
const transaction_service_1 = require("./transaction.service");
let TransactionController = class TransactionController {
    transactionService;
    constructor(transactionService) {
        this.transactionService = transactionService;
    }
    async get(getPartyAdjustableCreditsDto) {
        const data = await this.transactionService.getPartyAdjustableCredits(getPartyAdjustableCreditsDto);
        return {
            success: true,
            message: 'Party adjustable credits fetched successfully',
            data,
        };
    }
};
exports.TransactionController = TransactionController;
__decorate([
    (0, common_1.Get)('party-balance'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Get a party's unspent credits, available to adjust against a bill",
        description: 'Every open ADVANCE and SALES_RETURN the party holds on the side named by `type` — CR ' +
            '(the company owes the party) when it is omitted, DR (the party owes the company) when ' +
            'asked for — oldest first (FIFO), ' +
            'tie-broken on docRefno so two credits dated the same day never swap places between fetches. ' +
            'Each row carries billType and the adjType / settlementMode it settles as, plus billAccYear — ' +
            'post that alongside billId, since acc_bill_balance is keyed on the pair. There is no ' +
            'accounting-year parameter: credits are never carried forward, so the read spans every year. ' +
            'A party with no credit — and an unknown party — comes back as an empty array.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: adjustable_credit_response_dto_1.AdjustableCreditListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: adjustable_credit_response_dto_1.TransactionErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_party_adjustable_credits_dto_1.GetPartyAdjustableCreditsDto]),
    __metadata("design:returntype", Promise)
], TransactionController.prototype, "get", null);
exports.TransactionController = TransactionController = __decorate([
    (0, swagger_1.ApiTags)('Transaction'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('transactions'),
    (0, common_1.UseFilters)(transaction_exception_filter_1.TransactionExceptionFilter),
    __metadata("design:paramtypes", [transaction_service_1.TransactionService])
], TransactionController);
//# sourceMappingURL=transaction.controller.js.map