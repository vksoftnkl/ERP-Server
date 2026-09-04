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
exports.LedgerShippingAddressSuccessDeleteDto = exports.LedgerShippingAddressSuccessSingleDto = exports.LedgerShippingAddressDeleteResultDto = exports.LedgerShippingAddressPayloadDto = exports.LedgerShippingAddressErrorResponseDto = exports.LedgerShippingAddressErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class LedgerShippingAddressErrorFieldDto {
    field;
    message;
}
exports.LedgerShippingAddressErrorFieldDto = LedgerShippingAddressErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'saaLedgerId' }),
    __metadata("design:type", String)
], LedgerShippingAddressErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'No active ledger found with id 0195b8ff-7b6e-7dbf-9d3a-cab4e4504b59' }),
    __metadata("design:type", String)
], LedgerShippingAddressErrorFieldDto.prototype, "message", void 0);
class LedgerShippingAddressErrorResponseDto {
    success;
    message;
    errors;
}
exports.LedgerShippingAddressErrorResponseDto = LedgerShippingAddressErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LedgerShippingAddressErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], LedgerShippingAddressErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerShippingAddressErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], LedgerShippingAddressErrorResponseDto.prototype, "errors", void 0);
class LedgerShippingAddressPayloadDto {
    saaId;
    saaCompanyId;
    saaBranchId;
    saaLedgerId;
    saaAddrType;
    saaIsDefault;
    saaSort;
    saaTradeName;
    saaContactName;
    saaAddr1;
    saaAddr2;
    saaAddr3;
    saaLocation;
    saaPin;
    saaStateCode;
    saaStateName;
    saaCountryCode;
    saaDistanceKm;
    saaPhone;
    saaEmail;
    saaGstin;
    saaSyncedOn;
    saaIsActive;
    saaIsDeleted;
    saaCreatedOn;
    saaCreatedBy;
    saaModifiedOn;
    saaModifiedBy;
    saaRemarks;
}
exports.LedgerShippingAddressPayloadDto = LedgerShippingAddressPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], LedgerShippingAddressPayloadDto.prototype, "saaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], LedgerShippingAddressPayloadDto.prototype, "saaLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LedgerShippingAddressPayloadDto.prototype, "saaAddrType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], LedgerShippingAddressPayloadDto.prototype, "saaIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], LedgerShippingAddressPayloadDto.prototype, "saaSort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaTradeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaContactName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaAddr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaAddr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaAddr3", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaLocation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaStateCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaStateName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LedgerShippingAddressPayloadDto.prototype, "saaCountryCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaDistanceKm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaEmail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LedgerShippingAddressPayloadDto.prototype, "saaGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaSyncedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], LedgerShippingAddressPayloadDto.prototype, "saaIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], LedgerShippingAddressPayloadDto.prototype, "saaIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LedgerShippingAddressPayloadDto.prototype, "saaCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], LedgerShippingAddressPayloadDto.prototype, "saaModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], LedgerShippingAddressPayloadDto.prototype, "saaRemarks", void 0);
class LedgerShippingAddressDeleteResultDto {
    saaId;
    deleted;
}
exports.LedgerShippingAddressDeleteResultDto = LedgerShippingAddressDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], LedgerShippingAddressDeleteResultDto.prototype, "saaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerShippingAddressDeleteResultDto.prototype, "deleted", void 0);
class LedgerShippingAddressSuccessSingleDto {
    success;
    message;
    data;
}
exports.LedgerShippingAddressSuccessSingleDto = LedgerShippingAddressSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerShippingAddressSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ledger shipping address fetched successfully' }),
    __metadata("design:type", String)
], LedgerShippingAddressSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerShippingAddressPayloadDto }),
    __metadata("design:type", LedgerShippingAddressPayloadDto)
], LedgerShippingAddressSuccessSingleDto.prototype, "data", void 0);
class LedgerShippingAddressSuccessDeleteDto {
    success;
    message;
    data;
}
exports.LedgerShippingAddressSuccessDeleteDto = LedgerShippingAddressSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerShippingAddressSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ledger shipping address deleted successfully' }),
    __metadata("design:type", String)
], LedgerShippingAddressSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerShippingAddressDeleteResultDto }),
    __metadata("design:type", LedgerShippingAddressDeleteResultDto)
], LedgerShippingAddressSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=ledger-shipping-address-response.dto.js.map