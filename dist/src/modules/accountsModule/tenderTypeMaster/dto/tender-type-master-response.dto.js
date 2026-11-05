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
exports.TenderTypeMasterSuccessDeleteDto = exports.TenderTypeMasterSuccessSingleDto = exports.TenderTypeMasterDeleteResultDto = exports.TenderTypeMasterPayloadDto = exports.TenderTypeMasterErrorResponseDto = exports.TenderTypeMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class TenderTypeMasterErrorFieldDto {
    field;
    message;
}
exports.TenderTypeMasterErrorFieldDto = TenderTypeMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ttmTypeName' }),
    __metadata("design:type", String)
], TenderTypeMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate ttmTypeName is not allowed' }),
    __metadata("design:type", String)
], TenderTypeMasterErrorFieldDto.prototype, "message", void 0);
class TenderTypeMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.TenderTypeMasterErrorResponseDto = TenderTypeMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TenderTypeMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], TenderTypeMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderTypeMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], TenderTypeMasterErrorResponseDto.prototype, "errors", void 0);
class TenderTypeMasterPayloadDto {
    ttmTypeId;
    ttmTypeName;
    ttmDisplayName;
    ttmIsActive;
    ttmIsDeleted;
    ttmSyncDate;
    ttmCreatedOn;
    ttmCreatedBy;
    ttmModifiedOn;
    ttmModifiedBy;
}
exports.TenderTypeMasterPayloadDto = TenderTypeMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], TenderTypeMasterPayloadDto.prototype, "ttmTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'CASH' }),
    __metadata("design:type", String)
], TenderTypeMasterPayloadDto.prototype, "ttmTypeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cash' }),
    __metadata("design:type", String)
], TenderTypeMasterPayloadDto.prototype, "ttmDisplayName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderTypeMasterPayloadDto.prototype, "ttmIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderTypeMasterPayloadDto.prototype, "ttmIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderTypeMasterPayloadDto.prototype, "ttmSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TenderTypeMasterPayloadDto.prototype, "ttmCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderTypeMasterPayloadDto.prototype, "ttmCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderTypeMasterPayloadDto.prototype, "ttmModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderTypeMasterPayloadDto.prototype, "ttmModifiedBy", void 0);
class TenderTypeMasterDeleteResultDto {
    ttmTypeId;
    deleted;
}
exports.TenderTypeMasterDeleteResultDto = TenderTypeMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], TenderTypeMasterDeleteResultDto.prototype, "ttmTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderTypeMasterDeleteResultDto.prototype, "deleted", void 0);
class TenderTypeMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.TenderTypeMasterSuccessSingleDto = TenderTypeMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderTypeMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tender type fetched successfully' }),
    __metadata("design:type", String)
], TenderTypeMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderTypeMasterPayloadDto }),
    __metadata("design:type", TenderTypeMasterPayloadDto)
], TenderTypeMasterSuccessSingleDto.prototype, "data", void 0);
class TenderTypeMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.TenderTypeMasterSuccessDeleteDto = TenderTypeMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderTypeMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tender type deleted successfully' }),
    __metadata("design:type", String)
], TenderTypeMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderTypeMasterDeleteResultDto }),
    __metadata("design:type", TenderTypeMasterDeleteResultDto)
], TenderTypeMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=tender-type-master-response.dto.js.map