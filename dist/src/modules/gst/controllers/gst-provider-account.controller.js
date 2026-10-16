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
exports.GstProviderAccountController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const gst_provider_account_service_1 = require("../config/gst-provider-account.service");
const gst_ids_dto_1 = require("../dto/gst-ids.dto");
const save_gst_provider_account_dto_1 = require("../dto/save-gst-provider-account.dto");
const gst_exception_filter_1 = require("../gst-exception.filter");
let GstProviderAccountController = class GstProviderAccountController {
    accounts;
    constructor(accounts) {
        this.accounts = accounts;
    }
    async create(dto) {
        const data = await this.accounts.save(dto);
        return {
            success: true,
            message: dto.gpaId
                ? 'GST provider account updated successfully'
                : 'GST provider account created successfully',
            data,
        };
    }
    async get(query) {
        const data = await this.accounts.getById(query.gpaId);
        return { success: true, message: 'GST provider account fetched successfully', data };
    }
    async delete(dto) {
        const data = await this.accounts.softDelete(dto.gpaId);
        return { success: true, message: 'GST provider account deleted successfully', data };
    }
};
exports.GstProviderAccountController = GstProviderAccountController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no gpaId) or update a provider account; secrets are write-only',
        description: 'Needs create / edit on GST Providers. Each secret: absent or "" keeps the stored value, a ' +
            'value is encrypted with GST_CRED_KEY (503 GST_CRED_KEY_MISSING when the server has none), ' +
            '"clear": ["clientSecret"] sets it NULL. 409 GST_ACCOUNT_DUPLICATE per (provider, ' +
            'environment, service).',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: GstProviderAccountPayload }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gst_provider_account_dto_1.SaveGstProviderAccountDto]),
    __metadata("design:returntype", Promise)
], GstProviderAccountController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One provider account, deleted or not — hasClientId / hasClientSecret / hasApiKey, never a value',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ success, message, data: GstProviderAccountPayload }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderAccountIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderAccountController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a provider account',
        description: 'Needs delete. 409 GST_ALREADY_DELETED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: { gpaId, deleted: true } }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderAccountIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderAccountController.prototype, "delete", null);
exports.GstProviderAccountController = GstProviderAccountController = __decorate([
    (0, swagger_1.ApiTags)('GST Providers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' }),
    (0, common_1.Controller)('gst/provider-accounts'),
    (0, common_1.UseFilters)(gst_exception_filter_1.GstExceptionFilter),
    __metadata("design:paramtypes", [gst_provider_account_service_1.GstProviderAccountService])
], GstProviderAccountController);
//# sourceMappingURL=gst-provider-account.controller.js.map