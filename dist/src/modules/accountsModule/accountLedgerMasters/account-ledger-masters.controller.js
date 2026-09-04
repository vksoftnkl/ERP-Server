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
exports.AccountLedgerMastersController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const account_ledger_master_exception_filter_1 = require("./account-ledger-master-exception.filter");
const account_ledger_master_response_dto_1 = require("./dto/account-ledger-master-response.dto");
const save_account_ledger_master_dto_1 = require("./dto/save-account-ledger-master.dto");
const save_bulk_account_ledger_master_dto_1 = require("./dto/save-bulk-account-ledger-master.dto");
const account_ledger_masters_service_1 = require("./account-ledger-masters.service");
const api_version_1 = require("../../../common/constants/api-version");
let AccountLedgerMastersController = class AccountLedgerMastersController {
    accountLedgerMastersService;
    constructor(accountLedgerMastersService) {
        this.accountLedgerMastersService = accountLedgerMastersService;
    }
    bodyValidationPipe = new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    });
    async save(body) {
        if (this.isBulkPayload(body)) {
            const { data: dtos } = await this.validateBody(body, save_bulk_account_ledger_master_dto_1.SaveBulkAccountLedgerMasterDto);
            const data = await this.accountLedgerMastersService.saveMany(dtos);
            return {
                success: true,
                message: 'Account ledgers saved successfully',
                data,
            };
        }
        const dto = await this.validateBody(body, save_account_ledger_master_dto_1.SaveAccountLedgerMasterDto);
        const data = await this.accountLedgerMastersService.save(dto);
        return {
            success: true,
            message: dto.ledId
                ? 'Account ledger updated successfully'
                : 'Account ledger created successfully',
            data,
        };
    }
    isBulkPayload(body) {
        return (typeof body === 'object' && body !== null && Array.isArray(body.data));
    }
    async validateBody(body, metatype) {
        return (await this.bodyValidationPipe.transform(body, {
            type: 'body',
            metatype,
        }));
    }
    async get(ledId) {
        if (ledId) {
            const data = await this.accountLedgerMastersService.get({ ledId });
            return {
                success: true,
                message: 'Account ledger fetched successfully',
                data,
            };
        }
        const data = await this.accountLedgerMastersService.get();
        return {
            success: true,
            message: 'Account ledgers fetched successfully',
            data,
        };
    }
    async remove(ledId) {
        const data = await this.accountLedgerMastersService.softDelete(ledId);
        return {
            success: true,
            message: 'Account ledger deleted successfully',
            data,
        };
    }
    async getBank(lbaId, ledId) {
        if (lbaId) {
            const data = await this.accountLedgerMastersService.getBankAccounts({ lbaId });
            return {
                success: true,
                message: 'Ledger bank account fetched successfully',
                data,
            };
        }
        if (ledId) {
            const data = await this.accountLedgerMastersService.getBankAccounts({ ledId });
            return {
                success: true,
                message: 'Ledger bank accounts fetched successfully',
                data,
            };
        }
        const data = await this.accountLedgerMastersService.getBankAccounts({});
        return {
            success: true,
            message: 'Ledger bank accounts fetched successfully',
            data,
        };
    }
    async removeBankAccounts(lbaId) {
        const data = await this.accountLedgerMastersService.deleteBankAccountById(lbaId);
        return {
            success: true,
            message: 'Ledger bank account deleted successfully',
            data,
        };
    }
};
exports.AccountLedgerMastersController = AccountLedgerMastersController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update account ledger(s) — single object or { data: [...] } batch',
        description: [
            'Accepts either a single ledger object or a batch wrapped as `{ "data": [ ... ] }`.',
            '',
            '- Omit `ledId` to create; include it to update the existing ledger.',
            '- In batch mode every entry follows the same rule and the whole array is persisted in',
            '  one transaction (all-or-nothing): if any entry fails, nothing is saved.',
        ].join('\n'),
    }),
    (0, swagger_1.ApiExtraModels)(save_account_ledger_master_dto_1.SaveAccountLedgerMasterDto, save_bulk_account_ledger_master_dto_1.SaveBulkAccountLedgerMasterDto, account_ledger_master_response_dto_1.AccountLedgerMasterSuccessSingleDto, account_ledger_master_response_dto_1.AccountLedgerMasterSuccessListDto),
    (0, swagger_1.ApiBody)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(save_account_ledger_master_dto_1.SaveAccountLedgerMasterDto) },
                { $ref: (0, swagger_1.getSchemaPath)(save_bulk_account_ledger_master_dto_1.SaveBulkAccountLedgerMasterDto) },
            ],
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(account_ledger_master_response_dto_1.AccountLedgerMasterSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(account_ledger_master_response_dto_1.AccountLedgerMasterSuccessListDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountLedgerMastersController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get account ledger by id, or list all account ledgers',
        description: 'Pass ledId to fetch a single ledger. Otherwise returns all account ledgers.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'ledId', schema: { type: 'string', format: 'uuid' }, required: false }),
    (0, swagger_1.ApiOkResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('ledId', new common_1.DefaultValuePipe(undefined), new common_1.ParseUUIDPipe({ version: '7', optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccountLedgerMastersController.prototype, "get", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete account ledger by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ledId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('ledId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccountLedgerMastersController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('get-bank'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get a ledger bank account by id, or list all bank accounts for a ledger',
        description: 'Pass lbaId to fetch a single bank account. Otherwise pass ledId to list every active ' +
            'bank account for that ledger. Exactly one of lbaId or ledId is required.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'lbaId', schema: { type: 'string', format: 'uuid' }, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'ledId', schema: { type: 'string', format: 'uuid' }, required: false }),
    (0, swagger_1.ApiOkResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterBankAccountSingleDto }),
    (0, swagger_1.ApiOkResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterBankAccountListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('lbaId', new common_1.DefaultValuePipe(undefined), new common_1.ParseUUIDPipe({ version: '7', optional: true }))),
    __param(1, (0, common_1.Query)('ledId', new common_1.DefaultValuePipe(undefined), new common_1.ParseUUIDPipe({ version: '7', optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AccountLedgerMastersController.prototype, "getBank", null);
__decorate([
    (0, common_1.Delete)('delete-bank'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a ledger bank account by id',
        description: 'Soft deletes a single bank account by its own id (lbaId), GST/audit retention safe. ' +
            'Use the nested array on create/update to add or edit individual bank accounts.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'lbaId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterBankAccountsDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_ledger_master_response_dto_1.AccountLedgerMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('lbaId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccountLedgerMastersController.prototype, "removeBankAccounts", null);
exports.AccountLedgerMastersController = AccountLedgerMastersController = __decorate([
    (0, swagger_1.ApiTags)('Account Ledger Masters'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('account-ledger-masters'),
    (0, common_1.UseFilters)(account_ledger_master_exception_filter_1.AccountLedgerMasterExceptionFilter),
    __metadata("design:paramtypes", [account_ledger_masters_service_1.AccountLedgerMastersService])
], AccountLedgerMastersController);
//# sourceMappingURL=account-ledger-masters.controller.js.map