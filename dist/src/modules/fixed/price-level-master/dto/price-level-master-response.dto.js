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
exports.PriceLevelMasterSuccessUpdateDto = exports.PriceLevelMasterSuccessGetDto = exports.PriceLevelMasterGetMetaDto = exports.PriceLevelMasterPayloadDto = exports.PriceLevelMasterErrorResponseDto = exports.PriceLevelMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PriceLevelMasterErrorFieldDto {
    field;
    message;
}
exports.PriceLevelMasterErrorFieldDto = PriceLevelMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PriceLevelMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PriceLevelMasterErrorFieldDto.prototype, "message", void 0);
class PriceLevelMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.PriceLevelMasterErrorResponseDto = PriceLevelMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PriceLevelMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], PriceLevelMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PriceLevelMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], PriceLevelMasterErrorResponseDto.prototype, "errors", void 0);
class PriceLevelMasterPayloadDto {
    priceLvlId;
    priceLvlName;
    priceLvlShort;
    priceLvlIsActive;
    priceLvlIsAdmin;
    priceLvlIsDeleted;
    priceLvlSyncDate;
    priceLvlCreatedOn;
    priceLvlCreatedBy;
    priceLvlModifiedOn;
    priceLvlModifiedBy;
}
exports.PriceLevelMasterPayloadDto = PriceLevelMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PriceLevelMasterPayloadDto.prototype, "priceLvlId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Retail' }),
    __metadata("design:type", String)
], PriceLevelMasterPayloadDto.prototype, "priceLvlName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'RTL', nullable: true }),
    __metadata("design:type", Object)
], PriceLevelMasterPayloadDto.prototype, "priceLvlShort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PriceLevelMasterPayloadDto.prototype, "priceLvlIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PriceLevelMasterPayloadDto.prototype, "priceLvlIsAdmin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PriceLevelMasterPayloadDto.prototype, "priceLvlIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-03-01T10:20:00.000Z' }),
    __metadata("design:type", Object)
], PriceLevelMasterPayloadDto.prototype, "priceLvlSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-01T10:20:00.000Z' }),
    __metadata("design:type", String)
], PriceLevelMasterPayloadDto.prototype, "priceLvlCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'system' }),
    __metadata("design:type", Object)
], PriceLevelMasterPayloadDto.prototype, "priceLvlCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-01T10:20:00.000Z' }),
    __metadata("design:type", String)
], PriceLevelMasterPayloadDto.prototype, "priceLvlModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'system' }),
    __metadata("design:type", Object)
], PriceLevelMasterPayloadDto.prototype, "priceLvlModifiedBy", void 0);
class PriceLevelMasterGetMetaDto {
    priceLvlId;
    priceLvlIsActive;
    includeDeleted;
    count;
}
exports.PriceLevelMasterGetMetaDto = PriceLevelMasterGetMetaDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    __metadata("design:type", Number)
], PriceLevelMasterGetMetaDto.prototype, "priceLvlId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    __metadata("design:type", Boolean)
], PriceLevelMasterGetMetaDto.prototype, "priceLvlIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], PriceLevelMasterGetMetaDto.prototype, "includeDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], PriceLevelMasterGetMetaDto.prototype, "count", void 0);
class PriceLevelMasterSuccessGetDto {
    success;
    message;
    data;
    meta;
}
exports.PriceLevelMasterSuccessGetDto = PriceLevelMasterSuccessGetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PriceLevelMasterSuccessGetDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Price levels fetched successfully' }),
    __metadata("design:type", String)
], PriceLevelMasterSuccessGetDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PriceLevelMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], PriceLevelMasterSuccessGetDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PriceLevelMasterGetMetaDto }),
    __metadata("design:type", PriceLevelMasterGetMetaDto)
], PriceLevelMasterSuccessGetDto.prototype, "meta", void 0);
class PriceLevelMasterSuccessUpdateDto {
    success;
    message;
    data;
}
exports.PriceLevelMasterSuccessUpdateDto = PriceLevelMasterSuccessUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PriceLevelMasterSuccessUpdateDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Price levels updated successfully' }),
    __metadata("design:type", String)
], PriceLevelMasterSuccessUpdateDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PriceLevelMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], PriceLevelMasterSuccessUpdateDto.prototype, "data", void 0);
//# sourceMappingURL=price-level-master-response.dto.js.map