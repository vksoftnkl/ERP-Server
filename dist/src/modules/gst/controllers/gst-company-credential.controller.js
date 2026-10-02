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
exports.GstCompanyCredentialController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const gst_company_credential_service_1 = require("../config/gst-company-credential.service");
const gst_ids_dto_1 = require("../dto/gst-ids.dto");
const save_gst_company_credential_dto_1 = require("../dto/save-gst-company-credential.dto");
const gst_exception_filter_1 = require("../gst-exception.filter");
let GstCompanyCredentialController = class GstCompanyCredentialController {
    credentials;
    constructor(credentials) {
        this.credentials = credentials;
    }
    async create(dto) {
        const data = await this.credentials.save(dto);
        return {
            success: true,
            message: dto.gccId
                ? 'GST credential updated successfully'
                : 'GST credential created successfully',
            data,
        };
    }
    async get(query) {
        const data = await this.credentials.getById(query.gccId);
        return { success: true, message: 'GST credential fetched successfully', data };
    }
    async delete(dto) {
        const data = await this.credentials.softDelete(dto.gccId);
        return { success: true, message: 'GST credential deleted successfully', data };
    }
    async restore(dto) {
        const data = await this.credentials.restore(dto.gccId);
        return { success: true, message: 'GST credential restored successfully', data };
    }
    async verify(dto) {
        const data = await this.credentials.verify(dto.gccId);
        return {
            success: true,
            message: data.ok ? 'GST credential verified' : 'GST credential verification failed',
            data,
        };
    }
    async status(query) {
        const data = await this.credentials.status(query.gccId);
        return { success: true, message: 'GST credential status fetched successfully', data };
    }
};
exports.GstCompanyCredentialController = GstCompanyCredentialController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no gccId) or update a company credential; secrets are write-only',
        description: 'Needs create / edit on GST Credentials. password is required on create; each secret: absent ' +
            'or "" keeps it, a value is encrypted with GST_CRED_KEY, "clear" sets clientId / clientSecret ' +
            '/ appKey NULL. The GSTIN is not a field: the response carries `gstin` (branch GSTIN, else ' +
            'the company’s); 422 GST_NO_GSTIN when neither has one. 409 GST_CREDENTIAL_PRIMARY_EXISTS ' +
            '(one live, active priority 1 per company + branch + service + environment), ' +
            'GST_CREDENTIAL_PRIORITY_TAKEN. A save that changes who signs in retires the live session.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: GstCompanyCredentialPayload }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gst_company_credential_dto_1.SaveGstCompanyCredentialDto]),
    __metadata("design:returntype", Promise)
], GstCompanyCredentialController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One credential, deleted or not — hasPassword / hasClientId / hasClientSecret / hasAppKey, never a value',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ success, message, data: GstCompanyCredentialPayload }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstCompanyCredentialIdDto]),
    __metadata("design:returntype", Promise)
], GstCompanyCredentialController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a credential (its live session is retired)',
        description: 'Needs delete on GST Credentials. 409 GST_ALREADY_DELETED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: { gccId, deleted: true } }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstCompanyCredentialIdDto]),
    __metadata("design:returntype", Promise)
], GstCompanyCredentialController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('restore'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Restore a soft-deleted credential',
        description: 'Needs edit. 409 GST_NOT_DELETED, GST_CREDENTIAL_PRIMARY_EXISTS / _PRIORITY_TAKEN when its ' +
            'slot was filled meanwhile, GST_ALREADY_DELETED when its provider is deleted.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: { gccId, deleted: false } }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstCompanyCredentialIdDto]),
    __metadata("design:returntype", Promise)
], GstCompanyCredentialController.prototype, "restore", null);
__decorate([
    (0, common_1.Post)('verify'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'ONE sign-in at the provider, through the auth lease',
        description: 'Needs POST on GST Credentials (it reaches an outside system). Stamps gccLastVerifiedOn ' +
            '(success) / gccLastErrorMessage (failure) and keeps the session it gets. A refusal by the ' +
            'portal is data: { ok: false, message, errorCode }. Refused WITHOUT calling the portal: 409 ' +
            'GST_AUTH_BUSY (another sign-in holds the lease), GST_AUTH_RATE_LIMIT (4 sign-ins for this ' +
            'GSTIN in 15 minutes — NIC blocks at 5); 422 GST_CREDENTIAL_INCOMPLETE / ' +
            'GST_PUBLIC_KEY_MISSING / GST_NO_AUTH_ENDPOINT / GST_NO_GSTIN naming what is missing.',
    }),
    (0, swagger_1.ApiCreatedResponse)({
        description: '{ success, message, data: { ok, message, errorCode?, tokenValidUntil?, creditBalance? } }',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiServiceUnavailableResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstCompanyCredentialIdDto]),
    __metadata("design:returntype", Promise)
], GstCompanyCredentialController.prototype, "verify", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Session and verification status, with no portal call',
        description: 'Needs view. { hasLiveToken, tokenExpiresOn, issuedOn, leaseFree, lastVerifiedOn, ' +
            'lastErrorMessage, creditBalance } from gst_auth_session, the credential and its provider account.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ success, message, data: GstCredentialStatus }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstCompanyCredentialIdDto]),
    __metadata("design:returntype", Promise)
], GstCompanyCredentialController.prototype, "status", null);
exports.GstCompanyCredentialController = GstCompanyCredentialController = __decorate([
    (0, swagger_1.ApiTags)('GST Credentials'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Credentials' }),
    (0, common_1.Controller)('gst/company-credentials'),
    (0, common_1.UseFilters)(gst_exception_filter_1.GstExceptionFilter),
    __metadata("design:paramtypes", [gst_company_credential_service_1.GstCompanyCredentialService])
], GstCompanyCredentialController);
//# sourceMappingURL=gst-company-credential.controller.js.map