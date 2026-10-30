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
exports.StockAdjReasonsSuccessGetDto = exports.StockAdjReasonsGetMetaDto = exports.StockAdjReasonsPayloadDto = exports.StockAdjReasonsErrorResponseDto = exports.StockAdjReasonsErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class StockAdjReasonsErrorFieldDto {
    field;
    message;
}
exports.StockAdjReasonsErrorFieldDto = StockAdjReasonsErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockAdjReasonsErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], StockAdjReasonsErrorFieldDto.prototype, "message", void 0);
class StockAdjReasonsErrorResponseDto {
    success;
    message;
    errors;
}
exports.StockAdjReasonsErrorResponseDto = StockAdjReasonsErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StockAdjReasonsErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], StockAdjReasonsErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockAdjReasonsErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], StockAdjReasonsErrorResponseDto.prototype, "errors", void 0);
class StockAdjReasonsPayloadDto {
    sarId;
    sarCode;
    sarName;
    sarReasonKind;
    sarDefaultResolution;
    sarAffectsAccounts;
    sarIsActive;
    sarIsDeleted;
    sarCreatedOn;
    sarCreatedBy;
    sarModifiedOn;
    sarModifiedBy;
}
exports.StockAdjReasonsPayloadDto = StockAdjReasonsPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '01930000-0000-7000-0000-000000000001' }),
    __metadata("design:type", String)
], StockAdjReasonsPayloadDto.prototype, "sarId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DAMAGE' }),
    __metadata("design:type", String)
], StockAdjReasonsPayloadDto.prototype, "sarCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Physical Damage' }),
    __metadata("design:type", String)
], StockAdjReasonsPayloadDto.prototype, "sarName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'LOSS' }),
    __metadata("design:type", String)
], StockAdjReasonsPayloadDto.prototype, "sarReasonKind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'WRITE_OFF' }),
    __metadata("design:type", String)
], StockAdjReasonsPayloadDto.prototype, "sarDefaultResolution", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockAdjReasonsPayloadDto.prototype, "sarAffectsAccounts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockAdjReasonsPayloadDto.prototype, "sarIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StockAdjReasonsPayloadDto.prototype, "sarIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-01-01T00:00:00.000Z' }),
    __metadata("design:type", String)
], StockAdjReasonsPayloadDto.prototype, "sarCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], StockAdjReasonsPayloadDto.prototype, "sarCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], StockAdjReasonsPayloadDto.prototype, "sarModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], StockAdjReasonsPayloadDto.prototype, "sarModifiedBy", void 0);
class StockAdjReasonsGetMetaDto {
    sarId;
    sarCode;
    sarReasonKind;
    activeOnly;
    includeDeleted;
    count;
}
exports.StockAdjReasonsGetMetaDto = StockAdjReasonsGetMetaDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '01930000-0000-7000-0000-000000000001' }),
    __metadata("design:type", String)
], StockAdjReasonsGetMetaDto.prototype, "sarId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'DAMAGE' }),
    __metadata("design:type", String)
], StockAdjReasonsGetMetaDto.prototype, "sarCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'LOSS' }),
    __metadata("design:type", String)
], StockAdjReasonsGetMetaDto.prototype, "sarReasonKind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockAdjReasonsGetMetaDto.prototype, "activeOnly", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], StockAdjReasonsGetMetaDto.prototype, "includeDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], StockAdjReasonsGetMetaDto.prototype, "count", void 0);
class StockAdjReasonsSuccessGetDto {
    success;
    message;
    data;
    meta;
}
exports.StockAdjReasonsSuccessGetDto = StockAdjReasonsSuccessGetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], StockAdjReasonsSuccessGetDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Stock adjustment reasons fetched successfully' }),
    __metadata("design:type", String)
], StockAdjReasonsSuccessGetDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockAdjReasonsPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], StockAdjReasonsSuccessGetDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: StockAdjReasonsGetMetaDto }),
    __metadata("design:type", StockAdjReasonsGetMetaDto)
], StockAdjReasonsSuccessGetDto.prototype, "meta", void 0);
//# sourceMappingURL=stock-adj-reasons-response.dto.js.map