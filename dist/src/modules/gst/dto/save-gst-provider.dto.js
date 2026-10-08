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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveGstProviderErrorMapDto = exports.SaveGstProviderFieldMapDto = exports.SaveGstProviderEndpointDto = exports.SaveGstProviderServiceDto = exports.SaveGstProviderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const gst_config_constants_1 = require("../config/gst-config.constants");
const gst_dto_decorators_1 = require("./gst-dto.decorators");
const JSON_PATH_MESSAGE = {
    message: '$property must be a JSONPath from the root, starting with $',
};
const JSON_PATH_EACH = { each: true, message: 'each of $property must start with $' };
const URL_MESSAGE = { message: '$property must be http(s)://host, no trailing slash' };
const URL_PATTERN = /^https?:\/\/\S+$/;
const toBaseUrl = (value) => typeof value === 'string' ? value.trim().replace(/\/+$/, '') : value;
class SaveGstProviderDto {
    gpvId;
    gpvCode;
    gpvName;
    gpvPortalUrl;
    gpvSupportEmail;
    gpvSupportPhone;
    gpvTimeoutMs;
    gpvMaxRetries;
    gpvRateLimitPerMin;
    gpvRemarks;
    gpvIsActive;
}
exports.SaveGstProviderDto = SaveGstProviderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = create; present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGstProviderDto.prototype, "gpvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 20,
        example: 'NIC',
        description: "Short stable handle: 'NIC', 'CHARTERED'. Upper-cased; A–Z, 0–9, _. Unique across ALL " +
            'providers, deleted ones too (409 GST_PROVIDER_CODE_DUPLICATE), and never renamed — an ' +
            'update with another code is a 409 GST_PROVIDER_CODE_FIXED. Retire the row instead.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(20),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_PROVIDER_CODE_PATTERN, {
        message: 'gpvCode must start with a letter and hold only A-Z, 0-9 and _',
    }),
    __metadata("design:type", String)
], SaveGstProviderDto.prototype, "gpvCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 150 }),
    (0, dtoDecorators_1.TrimmedString)(150),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGstProviderDto.prototype, "gpvName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        description: 'Where a human goes. Not used by code.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveGstProviderDto.prototype, "gpvPortalUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 120 }),
    (0, dtoDecorators_1.NullableEmail)(120),
    __metadata("design:type", Object)
], SaveGstProviderDto.prototype, "gpvSupportEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 20 }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveGstProviderDto.prototype, "gpvSupportPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1000, maximum: 600000, default: 30000 }),
    (0, dtoDecorators_1.OptionalInteger)(1000, 600000),
    __metadata("design:type", Number)
], SaveGstProviderDto.prototype, "gpvTimeoutMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, maximum: 10, default: 2 }),
    (0, dtoDecorators_1.OptionalInteger)(0, 10),
    __metadata("design:type", Number)
], SaveGstProviderDto.prototype, "gpvMaxRetries", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: Number,
        nullable: true,
        minimum: 1,
        description: 'NULL = unmetered.',
    }),
    (0, dtoDecorators_1.NullableInteger)(1),
    (0, class_validator_1.Max)(32767),
    __metadata("design:type", Object)
], SaveGstProviderDto.prototype, "gpvRateLimitPerMin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveGstProviderDto.prototype, "gpvRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderDto.prototype, "gpvIsActive", void 0);
class SaveGstProviderServiceDto {
    gpsId;
    gpsGpvId;
    gpsService;
    gpsEnvironment;
    gpsBaseUrl;
    gpsFallbackUrls;
    gpsAuthScheme;
    gpsTokenTtlMinutes;
    gpsRefreshMarginMinutes;
    gpsPayloadEncryption;
    gpsTimeoutMs;
    gpsMaxRetries;
    gpsRemarks;
    gpsIsActive;
}
exports.SaveGstProviderServiceDto = SaveGstProviderServiceDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = create; present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGstProviderServiceDto.prototype, "gpsId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The provider. Fixed once created.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveGstProviderServiceDto.prototype, "gpsGpvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: gst_config_constants_1.GST_SERVICES }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_SERVICES),
    __metadata("design:type", String)
], SaveGstProviderServiceDto.prototype, "gpsService", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: gst_config_constants_1.GST_ENVIRONMENTS,
        description: '(service, environment) is unique per provider among live rows — 409 GST_SERVICE_DUPLICATE.',
    }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_ENVIRONMENTS),
    __metadata("design:type", String)
], SaveGstProviderServiceDto.prototype, "gpsEnvironment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'https://einv-apisandbox.nic.in',
        description: 'Scheme + host; a trailing / is dropped.',
    }),
    (0, class_transformer_1.Transform)(({ value }) => toBaseUrl(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(URL_PATTERN, URL_MESSAGE),
    __metadata("design:type", String)
], SaveGstProviderServiceDto.prototype, "gpsBaseUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'Other hosts of the SAME service, tried in order. null / absent on create = [].',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === null
        ? []
        : Array.isArray(value)
            ? value.map((url) => toBaseUrl(url))
            : value),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Matches)(URL_PATTERN, { ...URL_MESSAGE, each: true }),
    __metadata("design:type", Array)
], SaveGstProviderServiceDto.prototype, "gpsFallbackUrls", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: gst_config_constants_1.GST_AUTH_SCHEMES }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_AUTH_SCHEMES),
    __metadata("design:type", String)
], SaveGstProviderServiceDto.prototype, "gpsAuthScheme", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, default: 360 }),
    (0, dtoDecorators_1.OptionalInteger)(1, 32767),
    __metadata("design:type", Number)
], SaveGstProviderServiceDto.prototype, "gpsTokenTtlMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 0,
        default: 15,
        description: 'Must be below gpsTokenTtlMinutes.',
    }),
    (0, dtoDecorators_1.OptionalInteger)(0, 32767),
    __metadata("design:type", Number)
], SaveGstProviderServiceDto.prototype, "gpsRefreshMarginMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: gst_config_constants_1.GST_PAYLOAD_ENCRYPTIONS, default: 'NONE' }),
    (0, gst_dto_decorators_1.OptionalUpperEnum)(gst_config_constants_1.GST_PAYLOAD_ENCRYPTIONS),
    __metadata("design:type", String)
], SaveGstProviderServiceDto.prototype, "gpsPayloadEncryption", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, description: 'NULL = the provider’s.' }),
    (0, dtoDecorators_1.NullableInteger)(1000),
    (0, class_validator_1.Max)(600000),
    __metadata("design:type", Object)
], SaveGstProviderServiceDto.prototype, "gpsTimeoutMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, description: 'NULL = the provider’s.' }),
    (0, dtoDecorators_1.NullableInteger)(0),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Object)
], SaveGstProviderServiceDto.prototype, "gpsMaxRetries", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveGstProviderServiceDto.prototype, "gpsRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderServiceDto.prototype, "gpsIsActive", void 0);
class SaveGstProviderEndpointDto {
    gpeId;
    gpeGpsId;
    gpeAction;
    gpeHttpMethod;
    gpePathTemplate;
    gpeQueryTemplate;
    gpeContentType;
    gpeHeaders;
    gpeRequestWrapper;
    gpeRedactPaths;
    gpeResponseRootPath;
    gpeSuccessPath;
    gpeSuccessValue;
    gpeErrorCodePath;
    gpeErrorMessagePath;
    gpeTimeoutMs;
    gpeMaxRetries;
    gpeIsIdempotent;
    gpeRemarks;
    gpeIsActive;
}
exports.SaveGstProviderEndpointDto = SaveGstProviderEndpointDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = create; present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGstProviderEndpointDto.prototype, "gpeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The service. Fixed once created.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveGstProviderEndpointDto.prototype, "gpeGpsId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: gst_config_constants_1.GST_ACTIONS,
        description: 'One live row per (service, action) — 409 GST_ENDPOINT_DUPLICATE.',
    }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_ACTIONS),
    __metadata("design:type", String)
], SaveGstProviderEndpointDto.prototype, "gpeAction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: gst_config_constants_1.GST_HTTP_METHODS, default: 'POST' }),
    (0, gst_dto_decorators_1.OptionalUpperEnum)(gst_config_constants_1.GST_HTTP_METHODS),
    __metadata("design:type", String)
], SaveGstProviderEndpointDto.prototype, "gpeHttpMethod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '/eivital/v1.04/auth',
        description: 'Appended to the base URL; starts with /. May carry {gstin}, {irn}, {ewbNo}, {period}.',
    }),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.Matches)(/^\//, { message: 'gpePathTemplate must start with /' }),
    __metadata("design:type", String)
], SaveGstProviderEndpointDto.prototype, "gpePathTemplate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '?QrCodeSize=250' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeQueryTemplate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 60, default: 'application/json' }),
    (0, dtoDecorators_1.OptionalTrimmedString)(60),
    __metadata("design:type", String)
], SaveGstProviderEndpointDto.prototype, "gpeContentType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'object',
        additionalProperties: { type: 'string' },
        nullable: true,
        example: { Gstin: '{gstin}', client_id: '{clientId}', client_secret: '{clientSecret}' },
        description: 'Header name → value template. Placeholders: {gstin} {loginId} {password} {clientId} ' +
            '{clientSecret} {aspId} {aspPassword} {apiKey} {appKey} {authToken}. Values must be strings.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeHeaders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 30, example: 'Data' }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeRequestWrapper", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        nullable: true,
        example: ['$.Password', '$.AppKey'],
        description: 'JSONPaths blanked before the exchange is logged.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_JSON_PATH_PATTERN, JSON_PATH_EACH),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeRedactPaths", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '$.Data' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeResponseRootPath", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        example: '$.Status',
        description: 'Set together with gpeSuccessValue, or neither.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeSuccessPath", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 20, example: '1' }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeSuccessValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '$.ErrorDetails[0].ErrorCode' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeErrorCodePath", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '$.ErrorDetails[0].ErrorMessage' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeErrorMessagePath", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, description: 'NULL = the service’s.' }),
    (0, dtoDecorators_1.NullableInteger)(1000),
    (0, class_validator_1.Max)(600000),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeTimeoutMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, description: 'NULL = the service’s.' }),
    (0, dtoDecorators_1.NullableInteger)(0),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeMaxRetries", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'Safe to resend after a timeout. Never GENERATE_IRN.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderEndpointDto.prototype, "gpeIsIdempotent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveGstProviderEndpointDto.prototype, "gpeRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderEndpointDto.prototype, "gpeIsActive", void 0);
class SaveGstProviderFieldMapDto {
    gfmId;
    gfmGpeId;
    gfmDirection;
    gfmOurField;
    gfmTheirPath;
    gfmDataType;
    gfmTransform;
    gfmFormatMask;
    gfmIsRequired;
    gfmDefaultValue;
    gfmTargetColumn;
    gfmSortOrder;
}
exports.SaveGstProviderFieldMapDto = SaveGstProviderFieldMapDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = create; present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGstProviderFieldMapDto.prototype, "gfmId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The endpoint. Fixed once created.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveGstProviderFieldMapDto.prototype, "gfmGpeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: gst_config_constants_1.GST_FIELD_DIRECTIONS }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_FIELD_DIRECTIONS),
    __metadata("design:type", String)
], SaveGstProviderFieldMapDto.prototype, "gfmDirection", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 60,
        example: 'auth_token',
        description: 'Our canonical name. One live row per (endpoint, direction, field) — 409 GST_FIELD_MAP_DUPLICATE.',
    }),
    (0, dtoDecorators_1.TrimmedString)(60),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGstProviderFieldMapDto.prototype, "gfmOurField", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '$.AuthToken' }),
    (0, dtoDecorators_1.TrimmedString)(),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE),
    __metadata("design:type", String)
], SaveGstProviderFieldMapDto.prototype, "gfmTheirPath", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: gst_config_constants_1.GST_FIELD_DATA_TYPES, default: 'TEXT' }),
    (0, gst_dto_decorators_1.OptionalUpperEnum)(gst_config_constants_1.GST_FIELD_DATA_TYPES),
    __metadata("design:type", String)
], SaveGstProviderFieldMapDto.prototype, "gfmDataType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: gst_config_constants_1.GST_FIELD_TRANSFORMS,
        default: 'NONE',
        description: 'DATETIME_MASK needs gfmFormatMask.',
    }),
    (0, gst_dto_decorators_1.OptionalUpperEnum)(gst_config_constants_1.GST_FIELD_TRANSFORMS),
    __metadata("design:type", String)
], SaveGstProviderFieldMapDto.prototype, "gfmTransform", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        maxLength: 40,
        example: 'dd/MM/yyyy hh:mm:ss tt',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(40),
    __metadata("design:type", Object)
], SaveGstProviderFieldMapDto.prototype, "gfmFormatMask", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'A required field may not also carry a default.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderFieldMapDto.prototype, "gfmIsRequired", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveGstProviderFieldMapDto.prototype, "gfmDefaultValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 64, example: 'gde_irn' }),
    (0, dtoDecorators_1.NullableStringStrict)(64),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.Matches)(/^[a-z_][a-z0-9_]*$/, { message: 'gfmTargetColumn must be a column name: a-z, 0-9, _' }),
    __metadata("design:type", Object)
], SaveGstProviderFieldMapDto.prototype, "gfmTargetColumn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, dtoDecorators_1.OptionalInteger)(-32768, 32767),
    __metadata("design:type", Number)
], SaveGstProviderFieldMapDto.prototype, "gfmSortOrder", void 0);
class SaveGstProviderErrorMapDto {
    gemId;
    gemGpvId;
    gemService;
    gemTheirCode;
    gemOurCode;
    gemMessage;
    gemTreatAs;
    gemExtractPath;
    gemCanonicalField;
    gemIsRetryable;
    gemRetryAfterSeconds;
    gemShouldReauth;
    gemRecoveryAction;
    gemSeverity;
}
exports.SaveGstProviderErrorMapDto = SaveGstProviderErrorMapDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = create; present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGstProviderErrorMapDto.prototype, "gemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The provider. Fixed once created.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveGstProviderErrorMapDto.prototype, "gemGpvId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: gst_config_constants_1.GST_SERVICES,
        nullable: true,
        description: 'NULL = every service of the provider.',
    }),
    (0, gst_dto_decorators_1.NullableUpperEnum)(gst_config_constants_1.GST_SERVICES),
    __metadata("design:type", Object)
], SaveGstProviderErrorMapDto.prototype, "gemService", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 50,
        example: '2150',
        description: 'One live row per (provider, service, code) — 409 GST_ERROR_MAP_DUPLICATE.',
    }),
    (0, dtoDecorators_1.TrimmedString)(50),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGstProviderErrorMapDto.prototype, "gemTheirCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: gst_config_constants_1.GST_OUR_ERROR_CODES }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_OUR_ERROR_CODES),
    __metadata("design:type", String)
], SaveGstProviderErrorMapDto.prototype, "gemOurCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        maxLength: 500,
        description: 'Shown to the counter operator.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveGstProviderErrorMapDto.prototype, "gemMessage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: gst_config_constants_1.GST_TREAT_AS,
        default: 'ERROR',
        description: 'SUCCESS needs gemExtractPath and gemCanonicalField.',
    }),
    (0, gst_dto_decorators_1.OptionalUpperEnum)(gst_config_constants_1.GST_TREAT_AS),
    __metadata("design:type", String)
], SaveGstProviderErrorMapDto.prototype, "gemTreatAs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '$.ErrorDetails[0].InfoDtls.Irn' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.Matches)(gst_config_constants_1.GST_JSON_PATH_PATTERN, JSON_PATH_MESSAGE),
    __metadata("design:type", Object)
], SaveGstProviderErrorMapDto.prototype, "gemExtractPath", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 60, example: 'irn' }),
    (0, dtoDecorators_1.NullableStringStrict)(60),
    __metadata("design:type", Object)
], SaveGstProviderErrorMapDto.prototype, "gemCanonicalField", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderErrorMapDto.prototype, "gemIsRetryable", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, nullable: true, minimum: 0 }),
    (0, dtoDecorators_1.NullableInteger)(0),
    __metadata("design:type", Object)
], SaveGstProviderErrorMapDto.prototype, "gemRetryAfterSeconds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderErrorMapDto.prototype, "gemShouldReauth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: gst_config_constants_1.GST_RECOVERY_ACTIONS, default: 'NONE' }),
    (0, gst_dto_decorators_1.OptionalUpperEnum)(gst_config_constants_1.GST_RECOVERY_ACTIONS),
    __metadata("design:type", String)
], SaveGstProviderErrorMapDto.prototype, "gemRecoveryAction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: gst_config_constants_1.GST_SEVERITIES, default: 'ERROR' }),
    (0, gst_dto_decorators_1.OptionalUpperEnum)(gst_config_constants_1.GST_SEVERITIES),
    __metadata("design:type", String)
], SaveGstProviderErrorMapDto.prototype, "gemSeverity", void 0);
//# sourceMappingURL=save-gst-provider.dto.js.map