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
exports.LedgerBankAccountController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const ledger_bank_account_exception_filter_1 = require("./ledger-bank-account-exception.filter");
const ledger_bank_account_response_dto_1 = require("./dto/ledger-bank-account-response.dto");
const save_ledger_bank_account_dto_1 = require("./dto/save-ledger-bank-account.dto");
const ledger_bank_account_service_1 = require("./ledger-bank-account.service");
const api_version_1 = require("../../../common/constants/api-version");
let LedgerBankAccountController = class LedgerBankAccountController {
    ledgerBankAccountService;
    constructor(ledgerBankAccountService) {
        this.ledgerBankAccountService = ledgerBankAccountService;
    }
    async save(saveLedgerBankAccountDto) {
        const data = await this.ledgerBankAccountService.save(saveLedgerBankAccountDto);
        return {
            success: true,
            message: saveLedgerBankAccountDto.lbaId
                ? 'Ledger bank account updated successfully'
                : 'Ledger bank account created successfully',
            data,
        };
    }
    async getById(lbaId) {
        const data = await this.ledgerBankAccountService.getById(lbaId);
        return {
            success: true,
            message: 'Ledger bank account fetched successfully',
            data,
        };
    }
    async remove(lbaId) {
        const data = await this.ledgerBankAccountService.softDelete(lbaId);
        return {
            success: true,
            message: 'Ledger bank account deleted successfully',
            data,
        };
    }
};
exports.LedgerBankAccountController = LedgerBankAccountController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update ledger bank account (by lbaId presence)' }),
    (0, swagger_1.ApiBody)({
        type: save_ledger_bank_account_dto_1.SaveLedgerBankAccountDto,
        examples: {
            createBankAccount: {
                summary: 'Create a new bank account for a ledger',
                value: {
                    lbaLedgerId: '0199b3a4-1c2d-7e3f-8a9b-0c1d2e3f4a5b',
                    lbaCompanyId: '0199b3a4-1111-7222-8333-444455556666',
                    lbaAccountHolder: 'Acme Industries Pvt Ltd',
                    lbaBankName: 'HDFC Bank',
                    lbaBranchName: 'MG Road',
                    lbaAccountNo: '50100123456789',
                    lbaIfscCode: 'HDFC0001234',
                    lbaMicrCode: '560240002',
                    lbaAccountType: 'CURRENT',
                    lbaUpiId: 'acme@hdfcbank',
                    lbaChequeName: 'Acme Industries',
                    lbaIsDefault: true,
                    lbaIsActive: true,
                    lbaRemarks: 'Primary settlement account',
                },
            },
            updateBankAccount: {
                summary: 'Update an existing bank account (include lbaId)',
                value: {
                    lbaId: '0199b3a4-7777-7888-8999-aaaabbbbcccc',
                    lbaLedgerId: '0199b3a4-1c2d-7e3f-8a9b-0c1d2e3f4a5b',
                    lbaAccountHolder: 'Acme Industries Pvt Ltd',
                    lbaBankName: 'HDFC Bank',
                    lbaBranchName: 'Indiranagar',
                    lbaAccountNo: '50100123456789',
                    lbaIfscCode: 'HDFC0005678',
                    lbaIsDefault: false,
                },
            },
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_ledger_bank_account_dto_1.SaveLedgerBankAccountDto]),
    __metadata("design:returntype", Promise)
], LedgerBankAccountController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get ledger bank account by id' }),
    (0, swagger_1.ApiQuery)({ name: 'lbaId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountErrorResponseDto }),
    __param(0, (0, common_1.Query)('lbaId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LedgerBankAccountController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete ledger bank account by id' }),
    (0, swagger_1.ApiQuery)({ name: 'lbaId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_bank_account_response_dto_1.LedgerBankAccountErrorResponseDto }),
    __param(0, (0, common_1.Query)('lbaId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LedgerBankAccountController.prototype, "remove", null);
exports.LedgerBankAccountController = LedgerBankAccountController = __decorate([
    (0, swagger_1.ApiTags)('Ledger Bank Accounts'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('ledger-bank-accounts'),
    (0, common_1.UseFilters)(ledger_bank_account_exception_filter_1.LedgerBankAccountExceptionFilter),
    __metadata("design:paramtypes", [ledger_bank_account_service_1.LedgerBankAccountService])
], LedgerBankAccountController);
//# sourceMappingURL=ledger-bank-account.controller.js.map