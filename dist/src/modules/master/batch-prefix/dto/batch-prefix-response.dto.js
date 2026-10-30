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
exports.BatchPrefixSuccessDeleteDto = exports.BatchPrefixSuccessListDto = exports.BatchPrefixSuccessSingleDto = exports.BatchPrefixDeleteResultDto = exports.BatchPrefixListMetaDto = exports.BatchPrefixPayloadDto = exports.BatchPrefixErrorResponseDto = exports.BatchPrefixErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class BatchPrefixErrorFieldDto {
    field;
    message;
}
exports.BatchPrefixErrorFieldDto = BatchPrefixErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'prefixUsed' }),
    __metadata("design:type", String)
], BatchPrefixErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'prefixUsed must not be empty' }),
    __metadata("design:type", String)
], BatchPrefixErrorFieldDto.prototype, "message", void 0);
class BatchPrefixErrorResponseDto {
    success;
    message;
    errors;
}
exports.BatchPrefixErrorResponseDto = BatchPrefixErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], BatchPrefixErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], BatchPrefixErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BatchPrefixErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], BatchPrefixErrorResponseDto.prototype, "errors", void 0);
class BatchPrefixPayloadDto {
    id;
    prefixUsed;
    syncDate;
    createdBy;
    createdOn;
    modifiedBy;
    modifiedOn;
}
exports.BatchPrefixPayloadDto = BatchPrefixPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BatchPrefixPayloadDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BatchPrefixPayloadDto.prototype, "prefixUsed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BatchPrefixPayloadDto.prototype, "syncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BatchPrefixPayloadDto.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BatchPrefixPayloadDto.prototype, "createdOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BatchPrefixPayloadDto.prototype, "modifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BatchPrefixPayloadDto.prototype, "modifiedOn", void 0);
class BatchPrefixListMetaDto {
    page;
    limit;
    total;
    total_pages;
}
exports.BatchPrefixListMetaDto = BatchPrefixListMetaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], BatchPrefixListMetaDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20 }),
    __metadata("design:type", Number)
], BatchPrefixListMetaDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], BatchPrefixListMetaDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], BatchPrefixListMetaDto.prototype, "total_pages", void 0);
class BatchPrefixDeleteResultDto {
    id;
    deleted;
}
exports.BatchPrefixDeleteResultDto = BatchPrefixDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BatchPrefixDeleteResultDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BatchPrefixDeleteResultDto.prototype, "deleted", void 0);
class BatchPrefixSuccessSingleDto {
    success;
    message;
    data;
}
exports.BatchPrefixSuccessSingleDto = BatchPrefixSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BatchPrefixSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Batch prefix fetched successfully' }),
    __metadata("design:type", String)
], BatchPrefixSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BatchPrefixPayloadDto }),
    __metadata("design:type", BatchPrefixPayloadDto)
], BatchPrefixSuccessSingleDto.prototype, "data", void 0);
class BatchPrefixSuccessListDto {
    success;
    message;
    data;
    meta;
}
exports.BatchPrefixSuccessListDto = BatchPrefixSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BatchPrefixSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Batch prefixes fetched successfully' }),
    __metadata("design:type", String)
], BatchPrefixSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BatchPrefixPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], BatchPrefixSuccessListDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BatchPrefixListMetaDto }),
    __metadata("design:type", BatchPrefixListMetaDto)
], BatchPrefixSuccessListDto.prototype, "meta", void 0);
class BatchPrefixSuccessDeleteDto {
    success;
    message;
    data;
}
exports.BatchPrefixSuccessDeleteDto = BatchPrefixSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BatchPrefixSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Batch prefix deleted successfully' }),
    __metadata("design:type", String)
], BatchPrefixSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BatchPrefixDeleteResultDto }),
    __metadata("design:type", BatchPrefixDeleteResultDto)
], BatchPrefixSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=batch-prefix-response.dto.js.map