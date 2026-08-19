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
exports.BankListController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const bank_list_exception_filter_1 = require("./bank-list-exception.filter");
const bank_list_response_dto_1 = require("./dto/bank-list-response.dto");
const list_bank_list_query_dto_1 = require("./dto/list-bank-list-query.dto");
const save_bank_list_dto_1 = require("./dto/save-bank-list.dto");
const bank_list_service_1 = require("./bank-list.service");
const api_version_1 = require("../../../common/constants/api-version");
let BankListController = class BankListController {
    bankListService;
    constructor(bankListService) {
        this.bankListService = bankListService;
    }
    async save(saveBankListDto) {
        const data = await this.bankListService.save(saveBankListDto);
        return {
            success: true,
            message: saveBankListDto.bnkId ? 'Bank updated successfully' : 'Bank created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.bankListService.list(queryDto);
        return {
            success: true,
            message: 'Banks fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(bnkId) {
        const data = await this.bankListService.getById(bnkId);
        return {
            success: true,
            message: 'Bank fetched successfully',
            data,
        };
    }
    async remove(bnkId) {
        const data = await this.bankListService.softDelete(bnkId);
        return {
            success: true,
            message: 'Bank deleted successfully',
            data,
        };
    }
};
exports.BankListController = BankListController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update bank (by bnkId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: bank_list_response_dto_1.BankListSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_bank_list_dto_1.SaveBankListDto]),
    __metadata("design:returntype", Promise)
], BankListController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List banks with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: bank_list_response_dto_1.BankListSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_bank_list_query_dto_1.ListBankListQueryDto]),
    __metadata("design:returntype", Promise)
], BankListController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get bank by id' }),
    (0, swagger_1.ApiQuery)({ name: 'bnkId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: bank_list_response_dto_1.BankListSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    __param(0, (0, common_1.Query)('bnkId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BankListController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete bank by id' }),
    (0, swagger_1.ApiQuery)({ name: 'bnkId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: bank_list_response_dto_1.BankListSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bank_list_response_dto_1.BankListErrorResponseDto }),
    __param(0, (0, common_1.Query)('bnkId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BankListController.prototype, "remove", null);
exports.BankListController = BankListController = __decorate([
    (0, swagger_1.ApiTags)('Bank List'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('bank-lists'),
    (0, common_1.UseFilters)(bank_list_exception_filter_1.BankListExceptionFilter),
    __metadata("design:paramtypes", [bank_list_service_1.BankListService])
], BankListController);
//# sourceMappingURL=bank-list.controller.js.map