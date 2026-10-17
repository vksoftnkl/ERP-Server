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
exports.SaveGstProviderAccountDto = exports.GST_ACCOUNT_SECRET_KEYS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const gst_config_constants_1 = require("../config/gst-config.constants");
const gst_dto_decorators_1 = require("./gst-dto.decorators");
exports.GST_ACCOUNT_SECRET_KEYS = ['clientId', 'clientSecret', 'apiKey'];
const SECRET_NOTE = 'Write-only. Absent or "" keeps what is stored; a value is encrypted with GST_CRED_KEY. ' +
    'Never returned — /get answers with a has* flag.';
class SaveGstProviderAccountDto {
    gpaId;
    gpaGpvId;
    gpaEnvironment;
    gpaService;
    gpaAccountRef;
    clientId;
    clientSecret;
    apiKey;
    clear;
    gpaValidFrom;
    gpaValidUpto;
    gpaRemarks;
    gpaIsActive;
}
exports.SaveGstProviderAccountDto = SaveGstProviderAccountDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Absent = create; present = update.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveGstProviderAccountDto.prototype, "gpaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The provider. Fixed once created.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveGstProviderAccountDto.prototype, "gpaGpvId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: gst_config_constants_1.GST_ENVIRONMENTS,
        description: 'One live row per (provider, environment, service) — 409 GST_ACCOUNT_DUPLICATE.',
    }),
    (0, gst_dto_decorators_1.UpperEnum)(gst_config_constants_1.GST_ENVIRONMENTS),
    __metadata("design:type", String)
], SaveGstProviderAccountDto.prototype, "gpaEnvironment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: gst_config_constants_1.GST_SERVICES,
        nullable: true,
        description: 'NULL = every service of the provider (the norm); set = that service only.',
    }),
    (0, gst_dto_decorators_1.NullableUpperEnum)(gst_config_constants_1.GST_SERVICES),
    __metadata("design:type", Object)
], SaveGstProviderAccountDto.prototype, "gpaService", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100, description: 'Your account number with the GSP. Not a secret.' }),
    (0, dtoDecorators_1.TrimmedString)(100),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveGstProviderAccountDto.prototype, "gpaAccountRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: SECRET_NOTE, writeOnly: true }),
    (0, gst_dto_decorators_1.WriteOnlySecret)(),
    __metadata("design:type", String)
], SaveGstProviderAccountDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: SECRET_NOTE, writeOnly: true }),
    (0, gst_dto_decorators_1.WriteOnlySecret)(),
    __metadata("design:type", String)
], SaveGstProviderAccountDto.prototype, "clientSecret", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: SECRET_NOTE, writeOnly: true }),
    (0, gst_dto_decorators_1.WriteOnlySecret)(2000),
    __metadata("design:type", String)
], SaveGstProviderAccountDto.prototype, "apiKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: exports.GST_ACCOUNT_SECRET_KEYS,
        isArray: true,
        example: ['clientSecret'],
        description: 'Secrets to set to NULL. A key may not be both given and cleared.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(exports.GST_ACCOUNT_SECRET_KEYS, {
        each: true,
        message: `each of clear must be one of: ${exports.GST_ACCOUNT_SECRET_KEYS.join(', ')}`,
    }),
    __metadata("design:type", Array)
], SaveGstProviderAccountDto.prototype, "clear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2026-04-01' }),
    (0, gst_dto_decorators_1.NullableDateOnly)(),
    __metadata("design:type", Object)
], SaveGstProviderAccountDto.prototype, "gpaValidFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, example: '2027-03-31' }),
    (0, gst_dto_decorators_1.NullableDateOnly)(),
    __metadata("design:type", Object)
], SaveGstProviderAccountDto.prototype, "gpaValidUpto", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, nullable: true, maxLength: 500 }),
    (0, dtoDecorators_1.NullableStringStrict)(500),
    __metadata("design:type", Object)
], SaveGstProviderAccountDto.prototype, "gpaRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveGstProviderAccountDto.prototype, "gpaIsActive", void 0);
//# sourceMappingURL=save-gst-provider-account.dto.js.map