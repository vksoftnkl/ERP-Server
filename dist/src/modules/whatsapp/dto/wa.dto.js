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
exports.WaRetryDto = exports.WaSendDto = exports.WaSettingsSaveDto = exports.WaOnPostTickDto = exports.WaTestDto = exports.WaDisconnectDto = exports.WaActivateDto = exports.WaCompanyDto = exports.WA_DOC_TYPE_VALUES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const ACC_YEAR = /^\d{4}-\d{4}$/;
exports.WA_DOC_TYPE_VALUES = ['SALES_ORDER'];
class WaCompanyDto {
    companyId;
}
exports.WaCompanyDto = WaCompanyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WaCompanyDto.prototype, "companyId", void 0);
class WaActivateDto extends WaCompanyDto {
    activationCode;
    replace;
}
exports.WaActivateDto = WaActivateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "VK's one-time activation code (case, spaces and dashes ignored)", example: 'ABCD-EFGH-JKMN-PQRS' }),
    (0, dtoDecorators_1.TrimmedString)(40),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WaActivateDto.prototype, "activationCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Use this code although the company is already activated here (VK re-key / recovery). Without it a healthy ' +
            'activation answers 409 WA_ALREADY_ACTIVATED and the code is not spent.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], WaActivateDto.prototype, "replace", void 0);
class WaDisconnectDto extends WaCompanyDto {
    reason;
}
exports.WaDisconnectDto = WaDisconnectDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 200, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(200),
    __metadata("design:type", Object)
], WaDisconnectDto.prototype, "reason", void 0);
class WaTestDto extends WaCompanyDto {
    phone;
}
exports.WaTestDto = WaTestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '919865322154', description: 'A mobile number (10 digits or with 91)' }),
    (0, dtoDecorators_1.TrimmedString)(20),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WaTestDto.prototype, "phone", void 0);
class WaOnPostTickDto {
    vchrTypeId;
    on;
}
exports.WaOnPostTickDto = WaOnPostTickDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], WaOnPostTickDto.prototype, "vchrTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], WaOnPostTickDto.prototype, "on", void 0);
class WaSettingsSaveDto extends WaCompanyDto {
    defaultLanguage;
    ratePerMessage;
    rateGstPercent;
    fallbackClickToChat;
    logRetentionYears;
    onPostTypes;
}
exports.WaSettingsSaveDto = WaSettingsSaveDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, enum: ['en', 'ta'] }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], WaSettingsSaveDto.prototype, "defaultLanguage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, example: '0.115', description: 'Decimal string or number, ≥ 0, ≤ 4 decimals' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], WaSettingsSaveDto.prototype, "ratePerMessage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, example: '18', description: '0–100, ≤ 2 decimals' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], WaSettingsSaveDto.prototype, "rateGstPercent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Boolean }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], WaSettingsSaveDto.prototype, "fallbackClickToChat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Number, minimum: 1, maximum: 10 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], WaSettingsSaveDto.prototype, "logRetentionYears", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [WaOnPostTickDto],
        description: "WhatsApp on Post ticks, saved as this company's whatsapp.on_post_types (Sales Order (4) only in this build)",
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => WaOnPostTickDto),
    __metadata("design:type", Array)
], WaSettingsSaveDto.prototype, "onPostTypes", void 0);
class WaSendDto extends WaCompanyDto {
    branchId;
    docType;
    docId;
    docAccYear;
    phone;
    lang;
}
exports.WaSendDto = WaSendDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: "The sender's branch" }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WaSendDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.WA_DOC_TYPE_VALUES }),
    (0, class_validator_1.IsIn)(exports.WA_DOC_TYPE_VALUES),
    __metadata("design:type", Object)
], WaSendDto.prototype, "docType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'so_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WaSendDto.prototype, "docId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ACC_YEAR),
    __metadata("design:type", String)
], WaSendDto.prototype, "docAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'A number typed in the send popup: goes first, never copied to the master' }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], WaSendDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['en', 'ta'], nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['en', 'ta']),
    __metadata("design:type", Object)
], WaSendDto.prototype, "lang", void 0);
class WaRetryDto extends WaCompanyDto {
    wmlId;
    accYear;
    confirmResend;
}
exports.WaRetryDto = WaRetryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], WaRetryDto.prototype, "wmlId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(ACC_YEAR),
    __metadata("design:type", String)
], WaRetryDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Send a DELIVERED / READ message again (answer to 409 WA_ALREADY_DELIVERED)' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], WaRetryDto.prototype, "confirmResend", void 0);
//# sourceMappingURL=wa.dto.js.map