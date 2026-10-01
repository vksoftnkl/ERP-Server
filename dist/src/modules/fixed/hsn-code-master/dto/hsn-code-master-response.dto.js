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
exports.HsnCodeMasterSuccessGetDto = exports.HsnCodeMasterGetMetaDto = exports.HsnCodeMasterPayloadDto = exports.HsnCodeMasterErrorResponseDto = exports.HsnCodeMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class HsnCodeMasterErrorFieldDto {
    field;
    message;
}
exports.HsnCodeMasterErrorFieldDto = HsnCodeMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], HsnCodeMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], HsnCodeMasterErrorFieldDto.prototype, "message", void 0);
class HsnCodeMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.HsnCodeMasterErrorResponseDto = HsnCodeMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], HsnCodeMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], HsnCodeMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HsnCodeMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], HsnCodeMasterErrorResponseDto.prototype, "errors", void 0);
class HsnCodeMasterPayloadDto {
    hsnId;
    hsnCode;
    hsnName;
    hsnDescription;
    hsnIsService;
    hsnUqc;
    hsnIsActive;
    hsnRateOfTax;
}
exports.HsnCodeMasterPayloadDto = HsnCodeMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], HsnCodeMasterPayloadDto.prototype, "hsnId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '3004' }),
    __metadata("design:type", String)
], HsnCodeMasterPayloadDto.prototype, "hsnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Medicaments' }),
    __metadata("design:type", String)
], HsnCodeMasterPayloadDto.prototype, "hsnName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Ayurvedic medicine' }),
    __metadata("design:type", Object)
], HsnCodeMasterPayloadDto.prototype, "hsnDescription", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], HsnCodeMasterPayloadDto.prototype, "hsnIsService", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'PCS' }),
    __metadata("design:type", Object)
], HsnCodeMasterPayloadDto.prototype, "hsnUqc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], HsnCodeMasterPayloadDto.prototype, "hsnIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18 }),
    __metadata("design:type", Number)
], HsnCodeMasterPayloadDto.prototype, "hsnRateOfTax", void 0);
class HsnCodeMasterGetMetaDto {
    hsnId;
    hsnCode;
    activeOnly;
    count;
}
exports.HsnCodeMasterGetMetaDto = HsnCodeMasterGetMetaDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    __metadata("design:type", Number)
], HsnCodeMasterGetMetaDto.prototype, "hsnId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '3004' }),
    __metadata("design:type", String)
], HsnCodeMasterGetMetaDto.prototype, "hsnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], HsnCodeMasterGetMetaDto.prototype, "activeOnly", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], HsnCodeMasterGetMetaDto.prototype, "count", void 0);
class HsnCodeMasterSuccessGetDto {
    success;
    message;
    data;
    meta;
}
exports.HsnCodeMasterSuccessGetDto = HsnCodeMasterSuccessGetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], HsnCodeMasterSuccessGetDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'HSN codes fetched successfully' }),
    __metadata("design:type", String)
], HsnCodeMasterSuccessGetDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HsnCodeMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], HsnCodeMasterSuccessGetDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HsnCodeMasterGetMetaDto }),
    __metadata("design:type", HsnCodeMasterGetMetaDto)
], HsnCodeMasterSuccessGetDto.prototype, "meta", void 0);
//# sourceMappingURL=hsn-code-master-response.dto.js.map