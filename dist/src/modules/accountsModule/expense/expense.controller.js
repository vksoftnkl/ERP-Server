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
exports.ExpenseController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const save_expense_dto_1 = require("./dto/save-expense.dto");
const expense_exception_filter_1 = require("./expense-exception.filter");
const expense_service_1 = require("./expense.service");
const expense_enum_1 = require("./types/expense-enum");
let ExpenseController = class ExpenseController {
    expenses;
    prisma;
    requestContext;
    constructor(expenses, prisma, requestContext) {
        this.expenses = expenses;
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async create(dto) {
        await this.requireRight(dto.voucherId ? 'edit' : 'create', 'save an expense voucher');
        const data = await this.expenses.save(dto);
        return { success: true, message: `Expense voucher saved as ${data.status}`, data };
    }
    async validate(dto) {
        await this.requireRight('view', 'validate an expense voucher');
        const data = await this.expenses.validate(dto);
        return {
            success: true,
            message: data.ok ? 'The expense voucher can be posted' : `${data.refusals.length} refusal(s)`,
            data,
        };
    }
    async post(dto) {
        await this.requireRight('post', 'post an expense voucher');
        const data = await this.expenses.post(dto);
        return { success: true, message: `Expense voucher ${data.voucherNo} posted`, data };
    }
    async get(query) {
        await this.requireRight('view', 'view an expense voucher');
        const data = await this.expenses.get(query);
        return { success: true, message: `Expense voucher is ${data.status}`, data };
    }
    async cancel(dto) {
        await this.requireRight('cancel', 'cancel an expense voucher');
        const data = await this.expenses.cancel(dto);
        return { success: true, message: `Expense voucher ${data.voucherNo} cancelled`, data };
    }
    async quickReasons(query) {
        await this.requireRight('view', 'list expense reasons');
        const data = await this.expenses.quickReasons(query.companyId);
        return { success: true, message: `${data.length} reason(s)`, data };
    }
    async ledgerPick(query) {
        await this.requireRight('view', 'list expense ledgers');
        const data = await this.expenses.ledgerPick(query.companyId, query.search ?? null);
        return { success: true, message: `${data.length} ledger(s)`, data };
    }
    async requireRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: expense_enum_1.EXPENSE_MENU_ID,
            right,
            codePrefix: expense_enum_1.EXPENSE_RIGHT_PREFIX,
            action,
        });
    }
};
exports.ExpenseController = ExpenseController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save a DRAFT expense voucher (create, or edit with voucherId)',
        description: 'Lines (expense ledgers; with a GST bill each line is a taxable value and a rate) and tenders. Nothing is ' +
            'numbered or posted. The answer carries what /post would write (derived). Menu 277 CREATE / EDIT.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The draft, with its derived legs' }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'The voucher is not a DRAFT' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_expense_dto_1.SaveExpenseDto]),
    __metadata("design:returntype", Promise)
], ExpenseController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'What /post would write and refuse — always 200',
        description: 'Derived legs (lines, input GST, tenders and where each one’s money comes from: DRAWER, SAFE, LEDGER), ' +
            'refusals (EXPENSE_TOTAL_MISMATCH, EXPENSE_LEDGER_NOT_EXPENSE, EXPENSE_GST_INCOMPLETE, TILL_SESSION_REQUIRED …), ' +
            'warnings (EXPENSE_GST_BILL_MISSING; STATUTORY_40A3 — cash to one payee in a day above the 40A(3) ' +
            'limit, a refusal under a company REFUSE row; TILL_APPROVAL_REQUIRED, INFO) and `approval`: what the ' +
            'EXPENSE rule would ask in a till session, reported until phase 3 builds the gate. Saves nothing. ' +
            'Menu 277 VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ ok, derived, refusals, warnings, approval }' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_expense_dto_1.SaveExpenseDto]),
    __metadata("design:returntype", Promise)
], ExpenseController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post a DRAFT: number it, write its legs, its tender rows and (with a GST bill) the GSTR-2 row',
        description: 'On a device in a till session the CASH rows are that drawer (the voucher carries the session); on a ' +
            'back-office device in a branch that runs a till they come from the default safe (till.backoffice_cash_from ' +
            '= SAFE) or are refused (REFUSE). The answer carries the warnings /validate gave (40A(3), the EXPENSE ' +
            'approval need — neither blocks). Menu 277 POST.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'The posted voucher' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Every refusal, with its code',
    }),
    (0, swagger_1.ApiConflictResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Not a DRAFT · TILL_SESSION_REQUIRED · TILL_SESSION_WRONG_DEVICE · TILL_SESSION_NOT_YOURS',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_expense_dto_1.ExpenseKeyDto]),
    __metadata("design:returntype", Promise)
], ExpenseController.prototype, "post", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({ summary: 'One expense voucher: header, lines, tenders, legs. Menu 277 VIEW.' }),
    (0, swagger_1.ApiOkResponse)({ description: 'The voucher' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_expense_dto_1.ExpenseKeyDto]),
    __metadata("design:returntype", Promise)
], ExpenseController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a POSTED expense voucher: a mirror in the Rev series',
        description: 'Refused once the till session it moved money in has stopped taking money (TILL_SESSION_CLOSED): ' +
            'correct it with a new document or a journal. Menu 277 CANCEL.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'The cancelled voucher' }),
    (0, swagger_1.ApiConflictResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Not POSTED · TILL_SESSION_CLOSED',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_expense_dto_1.CancelExpenseDto]),
    __metadata("design:returntype", Promise)
], ExpenseController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('quick-reasons'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The EXPENSE till reasons (tea, courier, repair …) and the ledger each fills a line with',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Reasons, sort order then name' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_expense_dto_1.ExpenseReasonQueryDto]),
    __metadata("design:returntype", Promise)
], ExpenseController.prototype, "quickReasons", null);
__decorate([
    (0, common_1.Get)('ledger-pick'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The ledgers a line may debit: live, under an Expenses group, the company’s and shared',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Ledgers by name (500 at most)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_expense_dto_1.ExpenseLedgerPickQueryDto]),
    __metadata("design:returntype", Promise)
], ExpenseController.prototype, "ledgerPick", null);
exports.ExpenseController = ExpenseController = __decorate([
    (0, swagger_1.ApiTags)('Expense Voucher'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'EXP_RIGHT_<VERB> on menu 277' }),
    (0, common_1.UseFilters)(expense_exception_filter_1.ExpenseExceptionFilter),
    (0, common_1.Controller)('expenses'),
    __metadata("design:paramtypes", [expense_service_1.ExpenseService,
        prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], ExpenseController);
//# sourceMappingURL=expense.controller.js.map