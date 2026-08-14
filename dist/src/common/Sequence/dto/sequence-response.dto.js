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
exports.SequenceSuccessDeleteDto = exports.SequenceSuccessListDto = exports.SequenceSuccessSingleDto = exports.SequenceDeleteResultDto = exports.SequenceListMetaDto = exports.SequencePayloadDto = exports.SequenceErrorResponseDto = exports.SequenceErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class SequenceErrorFieldDto {
    field;
    message;
}
exports.SequenceErrorFieldDto = SequenceErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'scope' }),
    __metadata("design:type", String)
], SequenceErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Duplicate vchrTypeId, companyId, branchId, accYear, deviceCode, and periodKey values are not allowed',
    }),
    __metadata("design:type", String)
], SequenceErrorFieldDto.prototype, "message", void 0);
class SequenceErrorResponseDto {
    success;
    message;
    errors;
}
exports.SequenceErrorResponseDto = SequenceErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SequenceErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], SequenceErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SequenceErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], SequenceErrorResponseDto.prototype, "errors", void 0);
class SequencePayloadDto {
    id;
    vchrTypeId;
    companyId;
    branchId;
    accYear;
    deviceId;
    deviceCode;
    periodKey;
    lastNo;
    voucherPrefix;
    companyCode;
    branchCode;
    voucherSuffix;
    noWidth;
    lastRefno;
    isActive;
    isDeleted;
    createdOn;
    createdBy;
    modifiedOn;
    modifiedBy;
}
exports.SequencePayloadDto = SequencePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SequencePayloadDto.prototype, "vchrTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-27' }),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MAIN' }),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "deviceCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-27' }),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "periodKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'Server-generated next number for the sequence scope' }),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "lastNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "voucherPrefix", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "companyCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "branchCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "voucherSuffix", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], SequencePayloadDto.prototype, "noWidth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "lastRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SequencePayloadDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SequencePayloadDto.prototype, "isDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SequencePayloadDto.prototype, "createdOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "modifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SequencePayloadDto.prototype, "modifiedBy", void 0);
class SequenceListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.SequenceListMetaDto = SequenceListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SequenceListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], SequenceListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], SequenceListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SequenceListMetaDto.prototype, "total_pages", void 0);
class SequenceDeleteResultDto {
    id;
    deleted;
}
exports.SequenceDeleteResultDto = SequenceDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SequenceDeleteResultDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SequenceDeleteResultDto.prototype, "deleted", void 0);
class SequenceSuccessSingleDto {
    success;
    message;
    data;
}
exports.SequenceSuccessSingleDto = SequenceSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SequenceSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sequence fetched successfully' }),
    __metadata("design:type", String)
], SequenceSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SequencePayloadDto }),
    __metadata("design:type", SequencePayloadDto)
], SequenceSuccessSingleDto.prototype, "data", void 0);
class SequenceSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.SequenceSuccessListDto = SequenceSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SequenceSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sequences fetched successfully' }),
    __metadata("design:type", String)
], SequenceSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SequencePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], SequenceSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SequenceListMetaDto }),
    __metadata("design:type", SequenceListMetaDto)
], SequenceSuccessListDto.prototype, "meta", void 0);
class SequenceSuccessDeleteDto {
    success;
    message;
    data;
}
exports.SequenceSuccessDeleteDto = SequenceSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SequenceSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sequence deleted successfully' }),
    __metadata("design:type", String)
], SequenceSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SequenceDeleteResultDto }),
    __metadata("design:type", SequenceDeleteResultDto)
], SequenceSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=sequence-response.dto.js.map