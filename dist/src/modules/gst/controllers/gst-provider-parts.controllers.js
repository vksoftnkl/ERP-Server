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
exports.GstProviderErrorMapController = exports.GstProviderFieldMapController = exports.GstProviderEndpointController = exports.GstProviderServiceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const gst_provider_parts_service_1 = require("../config/gst-provider-parts.service");
const gst_ids_dto_1 = require("../dto/gst-ids.dto");
const save_gst_provider_dto_1 = require("../dto/save-gst-provider.dto");
const gst_exception_filter_1 = require("../gst-exception.filter");
const SAVE_NOTE = 'Needs create (no id) / edit on GST Providers. A row never moves to another parent (409 GST_PARENT_FIXED).';
let GstProviderServiceController = class GstProviderServiceController {
    parts;
    constructor(parts) {
        this.parts = parts;
    }
    async create(dto) {
        const data = await this.parts.saveService(dto);
        return {
            success: true,
            message: dto.gpsId
                ? 'GST provider service updated successfully'
                : 'GST provider service created successfully',
            data,
        };
    }
    async delete(dto) {
        const data = await this.parts.deleteService(dto.gpsId);
        return { success: true, message: 'GST provider service deleted successfully', data };
    }
};
exports.GstProviderServiceController = GstProviderServiceController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no gpsId) or update a provider service (host per service × environment)',
        description: `${SAVE_NOTE} 409 GST_SERVICE_DUPLICATE when the provider has a live row for that service + environment.`,
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: GstProviderServicePayload }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gst_provider_dto_1.SaveGstProviderServiceDto]),
    __metadata("design:returntype", Promise)
], GstProviderServiceController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a provider service, its endpoints and their field maps' }),
    (0, swagger_1.ApiCreatedResponse)({
        description: '{ success, message, data: { gpsId, deleted, endpointsDeleted } }',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderServiceIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderServiceController.prototype, "delete", null);
exports.GstProviderServiceController = GstProviderServiceController = __decorate([
    (0, swagger_1.ApiTags)('GST Providers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' }),
    (0, common_1.Controller)('gst/provider-services'),
    (0, common_1.UseFilters)(gst_exception_filter_1.GstExceptionFilter),
    __metadata("design:paramtypes", [gst_provider_parts_service_1.GstProviderPartsService])
], GstProviderServiceController);
let GstProviderEndpointController = class GstProviderEndpointController {
    parts;
    constructor(parts) {
        this.parts = parts;
    }
    async create(dto) {
        const data = await this.parts.saveEndpoint(dto);
        return {
            success: true,
            message: dto.gpeId
                ? 'GST provider endpoint updated successfully'
                : 'GST provider endpoint created successfully',
            data,
        };
    }
    async get(query) {
        const data = await this.parts.getEndpoint(query.gpeId);
        return { success: true, message: 'GST provider endpoint fetched successfully', data };
    }
    async delete(dto) {
        const data = await this.parts.deleteEndpoint(dto.gpeId);
        return { success: true, message: 'GST provider endpoint deleted successfully', data };
    }
};
exports.GstProviderEndpointController = GstProviderEndpointController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no gpeId) or update an endpoint (one action of a service)',
        description: `${SAVE_NOTE} 409 GST_ENDPOINT_DUPLICATE when the service has a live row for the action. ` +
            'gpeHeaders is an object of string templates; gpeRedactPaths an array of $-paths. Answers like /get.',
    }),
    (0, swagger_1.ApiCreatedResponse)({
        description: '{ success, message, data: GstProviderEndpointPayload (with fieldMaps) }',
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gst_provider_dto_1.SaveGstProviderEndpointDto]),
    __metadata("design:returntype", Promise)
], GstProviderEndpointController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One endpoint, deleted or not, with its live field map',
        description: 'Needs view on GST Providers. fieldMaps[]: REQUEST then RESPONSE, by sort order — the field-map popup in one call.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: '{ success, message, data: GstProviderEndpointPayload }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderEndpointIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderEndpointController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete an endpoint and its field map' }),
    (0, swagger_1.ApiCreatedResponse)({
        description: '{ success, message, data: { gpeId, deleted, fieldMapsDeleted } }',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderEndpointIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderEndpointController.prototype, "delete", null);
exports.GstProviderEndpointController = GstProviderEndpointController = __decorate([
    (0, swagger_1.ApiTags)('GST Providers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' }),
    (0, common_1.Controller)('gst/provider-endpoints'),
    (0, common_1.UseFilters)(gst_exception_filter_1.GstExceptionFilter),
    __metadata("design:paramtypes", [gst_provider_parts_service_1.GstProviderPartsService])
], GstProviderEndpointController);
let GstProviderFieldMapController = class GstProviderFieldMapController {
    parts;
    constructor(parts) {
        this.parts = parts;
    }
    async create(dto) {
        const data = await this.parts.saveFieldMap(dto);
        return {
            success: true,
            message: dto.gfmId
                ? 'GST field map updated successfully'
                : 'GST field map created successfully',
            data,
        };
    }
    async delete(dto) {
        const data = await this.parts.deleteFieldMap(dto.gfmId);
        return { success: true, message: 'GST field map deleted successfully', data };
    }
};
exports.GstProviderFieldMapController = GstProviderFieldMapController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no gfmId) or update one field of an endpoint’s request or reply',
        description: `${SAVE_NOTE} 409 GST_FIELD_MAP_DUPLICATE per (endpoint, direction, gfmOurField). ` +
            '400 for a required field with a default, or DATETIME_MASK without gfmFormatMask.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: GstProviderFieldMapPayload }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gst_provider_dto_1.SaveGstProviderFieldMapDto]),
    __metadata("design:returntype", Promise)
], GstProviderFieldMapController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a field-map row' }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: { gfmId, deleted: true } }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderFieldMapIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderFieldMapController.prototype, "delete", null);
exports.GstProviderFieldMapController = GstProviderFieldMapController = __decorate([
    (0, swagger_1.ApiTags)('GST Providers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' }),
    (0, common_1.Controller)('gst/provider-field-maps'),
    (0, common_1.UseFilters)(gst_exception_filter_1.GstExceptionFilter),
    __metadata("design:paramtypes", [gst_provider_parts_service_1.GstProviderPartsService])
], GstProviderFieldMapController);
let GstProviderErrorMapController = class GstProviderErrorMapController {
    parts;
    constructor(parts) {
        this.parts = parts;
    }
    async create(dto) {
        const data = await this.parts.saveErrorMap(dto);
        return {
            success: true,
            message: dto.gemId
                ? 'GST error map updated successfully'
                : 'GST error map created successfully',
            data,
        };
    }
    async delete(dto) {
        const data = await this.parts.deleteErrorMap(dto.gemId);
        return { success: true, message: 'GST error map deleted successfully', data };
    }
};
exports.GstProviderErrorMapController = GstProviderErrorMapController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no gemId) or update what one of the provider’s codes means to us',
        description: `${SAVE_NOTE} gemService null = every service. 409 GST_ERROR_MAP_DUPLICATE per ` +
            '(provider, service, gemTheirCode). gemTreatAs SUCCESS needs gemExtractPath + gemCanonicalField.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: GstProviderErrorMapPayload }' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gst_provider_dto_1.SaveGstProviderErrorMapDto]),
    __metadata("design:returntype", Promise)
], GstProviderErrorMapController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete an error-map row' }),
    (0, swagger_1.ApiCreatedResponse)({ description: '{ success, message, data: { gemId, deleted: true } }' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [gst_ids_dto_1.GstProviderErrorMapIdDto]),
    __metadata("design:returntype", Promise)
], GstProviderErrorMapController.prototype, "delete", null);
exports.GstProviderErrorMapController = GstProviderErrorMapController = __decorate([
    (0, swagger_1.ApiTags)('GST Providers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'GST_RIGHT_<RIGHT>: the user_menus flag on GST Providers' }),
    (0, common_1.Controller)('gst/provider-error-maps'),
    (0, common_1.UseFilters)(gst_exception_filter_1.GstExceptionFilter),
    __metadata("design:paramtypes", [gst_provider_parts_service_1.GstProviderPartsService])
], GstProviderErrorMapController);
//# sourceMappingURL=gst-provider-parts.controllers.js.map