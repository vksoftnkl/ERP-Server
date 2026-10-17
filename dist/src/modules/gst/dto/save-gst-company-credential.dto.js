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
exports.SaveGstCompanyCredentialDto = exports.GST_CREDENTIAL_CLEARABLE_KEYS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const gst_config_constants_1 = require("../config/gst-config.constants");
const gst_dto_decorators_1 = require("./gst-dto.decorators");
exports.GST_CREDENTIAL_CLEARABLE_KEYS = ['clientId', 'clientSecret', 'appKey'];
const SECRET_NOTE = 'Write-only. Absent or "" keeps what is stored; a value is encrypted with GST_CRED_KEY. ' +
    'Never returned — /get answers with a has* flag.';
class SaveGstCompanyCredentialDto {
    gccId;
    gccCompanyId;
    gccBranchId;
    gccGpvId;
    gccService;
    gccEnvironment;
    gccPriority;
    gccLoginId;
    password;
    clientId;
    clientSecret;
    appKey;
    clear;
    gccPublicKeyRef;
    gccWhitelistedIps;
    gccValidFrom;
    gccValidUpto;
    gccRemarks;
    gccIsActive;
}
exports.SaveGstCompanyCredentialDto = SaveGstCompanyCredentialDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = create; present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "gccId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "gccCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'NULL = files under the company GSTIN; set = under that branch’s own GSTIN.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveGstCompanyCredentialDto.prototype, "gccBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The provider this login signs in through.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "gccGpvId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: gst_config_constants_1.GST_SERVICES,
        nullable: true,
        description: 'NULL = one login for every service (gateway GSPs); set = that service (direct NIC).',
    }),
    (0, gst_dto_decorators_1.NullableUpperEnum)(gst_config_constants_1.GST_SERVICES),
    __metadata("design:type", Object)
], SaveGstCompanyCredentialDto.prototype, "gccService", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: gst_config_constants_1.GST_ENVIRONMENTS }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_ENVIRONMENTS),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "gccEnvironment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minimum: 1,
        maximum: 9,
        default: 1,
        description: '1 = primary, 2+ = failover order. One live, active primary per company + branch + ' +
            'service + environment (409 GST_CREDENTIAL_PRIMARY_EXISTS); each priority once per ' +
            'that key among live rows (409 GST_CREDENTIAL_PRIORITY_TAKEN).',
    }),
    (0, dtoDecorators_1.OptionalInteger)(1, 9),
    __metadata("design:type", Number)
], SaveGstCompanyCredentialDto.prototype, "gccPriority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The portal API user. Not a secret: support must see which login fails.',
    }),
    (0, dtoDecorators_1.TrimmedString)(200),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "gccLoginId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        writeOnly: true,
        description: `${SECRET_NOTE} Required on create; can be replaced, never cleared. Stamps gccPasswordChangedOn.`,
    }),
    (0, gst_dto_decorators_1.WriteOnlySecret)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        writeOnly: true,
        description: `${SECRET_NOTE} Set with clientSecret, or neither.`,
    }),
    (0, gst_dto_decorators_1.WriteOnlySecret)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        writeOnly: true,
        description: `${SECRET_NOTE} Set with clientId, or neither.`,
    }),
    (0, gst_dto_decorators_1.WriteOnlySecret)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "clientSecret", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        writeOnly: true,
        description: `${SECRET_NOTE} NIC's AppKey (32 bytes, base64).`,
    }),
    (0, gst_dto_decorators_1.WriteOnlySecret)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "appKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.GST_CREDENTIAL_CLEARABLE_KEYS,
        isArray: true,
        example: ['clientId', 'clientSecret'],
        description: 'Secrets to set to NULL (not password). A key may not be both given and cleared.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(exports.GST_CREDENTIAL_CLEARABLE_KEYS, {
        each: true,
        message: `each of clear must be one of: ${exports.GST_CREDENTIAL_CLEARABLE_KEYS.join(', ')}`,
    }),
    __metadata("design:type", Array)
], SaveGstCompanyCredentialDto.prototype, "clear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        nullable: true,
        maxLength: 100,
        example: 'nic-einv-sandbox',
        description: 'The IRP / GSP public key the auth body is RSA-encrypted with (NIC direct): the file ' +
            '<ref>.pem under GST_PUBLIC_KEY_DIR.',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    (0, dtoDecorators_1.SkipOnNullish)(),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9._-]+$/, { message: 'gccPublicKeyRef may hold only letters, digits, . _ -' }),
    __metadata("design:type", Object)
], SaveGstCompanyCredentialDto.prototype, "gccPublicKeyRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        example: ['203.0.113.10'],
        description: 'The static IPs registered with the portal for this GSTIN. null / absent on create = [].',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === null
        ? []
        : Array.isArray(value)
            ? value.map((ip) => (typeof ip === 'string' ? ip.trim() : ip))
            : value),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIP)(undefined, {
        each: true,
        message: 'each of gccWhitelistedIps must be an IPv4 or IPv6 address',
    }),
    __metadata("design:type", Array)
], SaveGstCompanyCredentialDto.prototype, "gccWhitelistedIps", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01' }),
    (0, gst_dto_decorators_1.DateOnly)(),
    __metadata("design:type", String)
], SaveGstCompanyCredentialDto.prototype, "gccValidFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2027-03-31' }),
    (0, gst_dto_decorators_1.NullableDateOnly)(),
    __metadata("design:type", Object)
], SaveGstCompanyCredentialDto.prototype, "gccValidUpto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveGstCompanyCredentialDto.prototype, "gccRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstCompanyCredentialDto.prototype, "gccIsActive", void 0);
//# sourceMappingURL=save-gst-company-credential.dto.js.map