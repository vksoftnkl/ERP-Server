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
exports.GstProviderController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const gst_provider_service_1 = require("../config/gst-provider.service");
const gst_ids_dto_1 = require("../dto/gst-ids.dto");
const save_gst_provider_dto_1 = require("../dto/save-gst-provider.dto");
const gst_exception_filter_1 = require("../gst-exception.filter");
let GstProviderController = class GstProviderController {
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    async create(dto) {
        const data = await this.providers.save(dto);
        return {
            success: true,
            message: dto.gpvId
                ? 'GST provider updated successfully'
                : 'GST provider created successfully',
            data,
        };
    }
    async get(query) {
        const data = await this.providers.getById(query.gpvId);
        return { success: true, message: 'GST provider fetched successfully', data };
    }
    async delete(dto) {
        const data = await this.providers.softDelete(dto.gpvId);
        return { success: true, message: 'GST provider deleted successfully', data };
    }
    async restore(dto) {
        const data = await this.providers.restore(dto.gpvId);
        return { success: true, message: 'GST provider restored successfully', data };
    }
};
exports.GstProviderController = GstProviderController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no gpvId) or update a GST provider’s header',
        description: 'Needs create / edit on GST Providers. Answers like /get. 409 GST_PROVIDER_CODE_DUPLICATE ' +
            '(codes are unique over deleted rows too), GST_PROVIDER_CODE_FIXED (a code is never renamed), ' +
            'GST_ALREADY_DELETED (restore first).',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: GstProviderPayload }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gst_provider_dto_1.SaveGstProviderDto]),
    __metadata("design:returntype", Promise)
], GstProviderController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One GST provider, deleted or not, with its services, accounts and counts',
        description: 'Needs view on GST Providers. services[] (live, each with endpointCount), accounts[] ' +
            '(live, secret-free: has* flags + keyVersion), endpointCount, errorMapCount, credentialCount.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ success, message, data: GstProviderPayload }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a GST provider',
        description: 'Needs delete on GST Providers. 409 GST_PROVIDER_IN_USE while a live company credential ' +
            'names it; GST_ALREADY_DELETED. Its services, endpoints and maps are kept for /restore.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: { gpvId, deleted: true } }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('restore'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Restore a soft-deleted GST provider',
        description: 'Needs edit. 409 GST_NOT_DELETED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: { gpvId, deleted: false } }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderController.prototype, "restore", null);
exports.GstProviderController = GstProviderController = __decorate([
    (0, swagger_1.ApiTags)('GST Providers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' }),
    (0, common_1.Controller)('gst/providers'),
    (0, common_1.UseFilters)(gst_exception_filter_1.GstExceptionFilter),
    __metadata("design:paramtypes", [gst_provider_service_1.GstProviderService])
], GstProviderController);
//# sourceMappingURL=gst-provider.controller.js.map