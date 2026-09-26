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
exports.OpeningBalanceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
const opening_balance_exception_filter_1 = require("./opening-balance-exception.filter");
const opening_balance_service_1 = require("./opening-balance.service");
const bill_wise_service_1 = require("./bill-wise.service");
const carry_forward_service_1 = require("./carry-forward.service");
const list_opening_balance_query_dto_1 = require("./dto/list-opening-balance-query.dto");
const save_opening_balance_dto_1 = require("./dto/save-opening-balance.dto");
const save_opening_bill_dto_1 = require("./dto/save-opening-bill.dto");
const carry_forward_dto_1 = require("./dto/carry-forward.dto");
const opening_balance_response_dto_1 = require("./dto/opening-balance-response.dto");
let OpeningBalanceController = class OpeningBalanceController {
    openingBalanceService;
    billWiseService;
    carryForwardService;
    constructor(openingBalanceService, billWiseService, carryForwardService) {
        this.openingBalanceService = openingBalanceService;
        this.billWiseService = billWiseService;
        this.carryForwardService = carryForwardService;
    }
    async list(query) {
        const data = await this.openingBalanceService.list(query);
        return { success: true, message: 'Opening balances fetched successfully', data };
    }
    async save(dto) {
        const data = await this.openingBalanceService.save(dto);
        return {
            success: true,
            message: data.trialBalance.isBalanced
                ? 'Opening balances saved successfully'
                : `Opening balances saved — the set is out by ${Math.abs(data.trialBalance.difference).toFixed(2)}`,
            data,
        };
    }
    async trialBalance(query) {
        const data = await this.openingBalanceService.trialBalance(query);
        return { success: true, message: 'Trial balance fetched successfully', data };
    }
    async remove(opId, accYear) {
        const data = await this.openingBalanceService.softDelete(opId, accYear);
        return { success: true, message: 'Opening balance deleted successfully', data };
    }
    async carryForward(dto) {
        const data = await this.carryForwardService.run(dto);
        return {
            success: true,
            message: `Carried ${data.created + data.updated} opening(s) and ${data.billsCarried} bill(s) into ${data.toAccYear}`,
            data,
        };
    }
    async listBills(query) {
        const data = await this.billWiseService.list(query);
        return { success: true, message: 'Opening bills fetched successfully', data };
    }
    async saveBills(dto) {
        const data = await this.billWiseService.save(dto);
        return { success: true, message: 'Opening bills saved successfully', data };
    }
};
exports.OpeningBalanceController = OpeningBalanceController;
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Every balance-sheet ledger for a company-year, with its opening if it has one',
        description: 'A review surface over the FULL chart, not a list of rows that happen to exist — so there ' +
            'is no paging: a partial chart is a wrong trial balance, not a slow one.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_balance_response_dto_1.OpeningBalanceListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opening_balance_query_dto_1.ListOpeningBalanceQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningBalanceController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save the whole opening set for one company-year',
        description: 'Upsert: rows carrying opId are updated, rows without one inserted, and with replace:true ' +
            'rows absent from the array are soft deleted. An amount of 0 writes no row — absence is ' +
            'the zero. This is also the EDIT endpoint; there is no other.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: opening_balance_response_dto_1.OpeningBalanceSaveSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_opening_balance_dto_1.SaveOpeningBalanceDto]),
    __metadata("design:returntype", Promise)
], OpeningBalanceController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('trial-balance'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Debit and credit totals for a company-year, and the plug ledger',
        description: 'Its own endpoint because the screen shows it permanently and recomputes as the operator ' +
            'types. differenceLedgerId is the OPENING_DIFFERENCE role resolved through acc_ledger_map — ' +
            'null when the company has not mapped it, and the plug then cannot be offered.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_balance_response_dto_1.TrialBalanceSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opening_balance_query_dto_1.ListOpeningBalanceQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningBalanceController.prototype, "trialBalance", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete one opening row',
        description: 'Refused while OPENING bills still point at it — delete the bills first.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'opId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'accYear', schema: { type: 'string', example: '2026-2027' } }),
    (0, swagger_1.ApiOkResponse)({ type: opening_balance_response_dto_1.OpeningBalanceDeleteSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    __param(0, (0, common_1.Query)('opId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('accYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OpeningBalanceController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('carry-forward'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Derive one year's openings from the previous year's closings",
        description: 'One transaction. Carries the balance-sheet ledgers, the P&L result onto the ' +
            'RETAINED_EARNINGS ledger, and every still-open bill of a bill-wise party — without that ' +
            'last part a carry-forward silently destroys the ageing of every debtor. MANUAL and ' +
            'MIGRATION rows are spared unless overwriteManual is set, and are always reported.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: opening_balance_response_dto_1.CarryForwardSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [carry_forward_dto_1.CarryForwardDto]),
    __metadata("design:returntype", Promise)
], OpeningBalanceController.prototype, "carryForward", null);
__decorate([
    (0, common_1.Get)('bills'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "One bill-by-bill party's opening bills, and the figures that must tie",
        description: 'branchId is required — abl_branch_id is NOT NULL, so a bill always has a branch.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: opening_balance_response_dto_1.OpeningBillsSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_opening_bill_dto_1.ListOpeningBillsQueryDto]),
    __metadata("design:returntype", Promise)
], OpeningBalanceController.prototype, "listBills", null);
__decorate([
    (0, common_1.Post)('bills'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Save one bill-by-bill party's whole breakup",
        description: "This endpoint OWNS the party's opening figure: it rewrites op_amount / op_dr_cr from " +
            'these bills in the same transaction, so the tie is true by construction. A bill that has ' +
            'been receipted against accepts only date, credit-day and narration changes. ' +
            'NOTE: replace:true is not "here is the whole breakup, sort it out" — a row WITHOUT an ' +
            'ablId is an insert, so re-sending a bill the screen loaded without carrying its ablId ' +
            'through is refused by ux_abl_doc_refno as a duplicate reference. Keep the ablId from GET ' +
            'on every existing row; only genuinely new bills omit it.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: opening_balance_response_dto_1.OpeningBillsSaveSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: opening_balance_response_dto_1.OpeningBalanceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_opening_bill_dto_1.SaveOpeningBillsDto]),
    __metadata("design:returntype", Promise)
], OpeningBalanceController.prototype, "saveBills", null);
exports.OpeningBalanceController = OpeningBalanceController = __decorate([
    (0, swagger_1.ApiTags)('Opening Balances'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('opening-balances'),
    (0, common_1.UseFilters)(opening_balance_exception_filter_1.OpeningBalanceExceptionFilter),
    __metadata("design:paramtypes", [opening_balance_service_1.OpeningBalanceService,
        bill_wise_service_1.BillWiseService,
        carry_forward_service_1.CarryForwardService])
], OpeningBalanceController);
//# sourceMappingURL=opening-balance.controller.js.map