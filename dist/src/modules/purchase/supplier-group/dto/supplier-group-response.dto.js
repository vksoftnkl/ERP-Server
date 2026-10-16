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
exports.SupplierGroupSuccessDeleteDto = exports.SupplierGroupSuccessSingleDto = exports.SupplierGroupDeleteResultDto = exports.SupplierGroupPayloadDto = exports.SupplierGroupErrorResponseDto = exports.SupplierGroupErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class SupplierGroupErrorFieldDto {
    field;
    message;
}
exports.SupplierGroupErrorFieldDto = SupplierGroupErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'spgName' }),
    __metadata("design:type", String)
], SupplierGroupErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate supplier group name is not allowed' }),
    __metadata("design:type", String)
], SupplierGroupErrorFieldDto.prototype, "message", void 0);
class SupplierGroupErrorResponseDto {
    success;
    message;
    errors;
}
exports.SupplierGroupErrorResponseDto = SupplierGroupErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SupplierGroupErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], SupplierGroupErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SupplierGroupErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], SupplierGroupErrorResponseDto.prototype, "errors", void 0);
class SupplierGroupPayloadDto {
    spgId;
    spgName;
    spgAlias;
    spgShort;
    spgDesc;
    spgIsActive;
    spgIsDeleted;
    spgSyncDate;
    spgCreatedOn;
    spgCreatedBy;
    spgModifiedOn;
    spgModifiedBy;
}
exports.SupplierGroupPayloadDto = SupplierGroupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SupplierGroupPayloadDto.prototype, "spgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], SupplierGroupPayloadDto.prototype, "spgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], SupplierGroupPayloadDto.prototype, "spgAlias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], SupplierGroupPayloadDto.prototype, "spgShort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SupplierGroupPayloadDto.prototype, "spgDesc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SupplierGroupPayloadDto.prototype, "spgIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SupplierGroupPayloadDto.prototype, "spgIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SupplierGroupPayloadDto.prototype, "spgSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SupplierGroupPayloadDto.prototype, "spgCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SupplierGroupPayloadDto.prototype, "spgCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SupplierGroupPayloadDto.prototype, "spgModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SupplierGroupPayloadDto.prototype, "spgModifiedBy", void 0);
class SupplierGroupDeleteResultDto {
    spgId;
    deleted;
}
exports.SupplierGroupDeleteResultDto = SupplierGroupDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SupplierGroupDeleteResultDto.prototype, "spgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SupplierGroupDeleteResultDto.prototype, "deleted", void 0);
class SupplierGroupSuccessSingleDto {
    success;
    message;
    data;
}
exports.SupplierGroupSuccessSingleDto = SupplierGroupSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SupplierGroupSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Supplier group fetched successfully' }),
    __metadata("design:type", String)
], SupplierGroupSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SupplierGroupPayloadDto }),
    __metadata("design:type", SupplierGroupPayloadDto)
], SupplierGroupSuccessSingleDto.prototype, "data", void 0);
class SupplierGroupSuccessDeleteDto {
    success;
    message;
    data;
}
exports.SupplierGroupSuccessDeleteDto = SupplierGroupSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SupplierGroupSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Supplier group deleted successfully' }),
    __metadata("design:type", String)
], SupplierGroupSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SupplierGroupDeleteResultDto }),
    __metadata("design:type", SupplierGroupDeleteResultDto)
], SupplierGroupSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=supplier-group-response.dto.js.map