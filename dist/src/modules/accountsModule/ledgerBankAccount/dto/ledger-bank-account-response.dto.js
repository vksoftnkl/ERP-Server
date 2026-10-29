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
exports.LedgerBankAccountSuccessDeleteDto = exports.LedgerBankAccountSuccessSingleDto = exports.LedgerBankAccountDeleteResultDto = exports.LedgerBankAccountPayloadDto = exports.LedgerBankAccountErrorResponseDto = exports.LedgerBankAccountErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class LedgerBankAccountErrorFieldDto {
    field;
    message;
}
exports.LedgerBankAccountErrorFieldDto = LedgerBankAccountErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'lbaAccountNo' }),
    __metadata("design:type", String)
], LedgerBankAccountErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate lbaAccountNo is not allowed for this ledger' }),
    __metadata("design:type", String)
], LedgerBankAccountErrorFieldDto.prototype, "message", void 0);
class LedgerBankAccountErrorResponseDto {
    success;
    message;
    errors;
}
exports.LedgerBankAccountErrorResponseDto = LedgerBankAccountErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LedgerBankAccountErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], LedgerBankAccountErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerBankAccountErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], LedgerBankAccountErrorResponseDto.prototype, "errors", void 0);
class LedgerBankAccountPayloadDto {
    lbaId;
    lbaCompanyId;
    lbaLedgerId;
    lbaAccountHolder;
    lbaBankName;
    lbaBranchName;
    lbaAccountNo;
    lbaIfscCode;
    lbaMicrCode;
    lbaAccountType;
    lbaUpiId;
    lbaChequeName;
    lbaIsDefault;
    lbaIsActive;
    lbaIsDeleted;
    lbaSyncDate;
    lbaCreatedOn;
    lbaCreatedBy;
    lbaModifiedOn;
    lbaModifiedBy;
    lbaRemarks;
}
exports.LedgerBankAccountPayloadDto = LedgerBankAccountPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '0199b3a4-7777-7888-8999-aaaabbbbcccc' }),
    __metadata("design:type", String)
], LedgerBankAccountPayloadDto.prototype, "lbaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '0199b3a4-1111-7222-8333-444455556666' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', example: '0199b3a4-1c2d-7e3f-8a9b-0c1d2e3f4a5b' }),
    __metadata("design:type", String)
], LedgerBankAccountPayloadDto.prototype, "lbaLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, example: 'Acme Industries Pvt Ltd' }),
    __metadata("design:type", String)
], LedgerBankAccountPayloadDto.prototype, "lbaAccountHolder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, example: 'HDFC Bank' }),
    __metadata("design:type", String)
], LedgerBankAccountPayloadDto.prototype, "lbaBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'MG Road' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaBranchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50, example: '50100123456789' }),
    __metadata("design:type", String)
], LedgerBankAccountPayloadDto.prototype, "lbaAccountNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'HDFC0001234' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaIfscCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '560240002' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaMicrCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'CURRENT' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaAccountType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'acme@hdfcbank' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaUpiId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Acme Industries' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaChequeName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerBankAccountPayloadDto.prototype, "lbaIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerBankAccountPayloadDto.prototype, "lbaIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LedgerBankAccountPayloadDto.prototype, "lbaIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-06-23T10:15:00.000Z' }),
    __metadata("design:type", String)
], LedgerBankAccountPayloadDto.prototype, "lbaCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'user-001' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-06-23T10:15:00.000Z' }),
    __metadata("design:type", String)
], LedgerBankAccountPayloadDto.prototype, "lbaModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: null }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'Primary settlement account' }),
    __metadata("design:type", Object)
], LedgerBankAccountPayloadDto.prototype, "lbaRemarks", void 0);
class LedgerBankAccountDeleteResultDto {
    lbaId;
    deleted;
}
exports.LedgerBankAccountDeleteResultDto = LedgerBankAccountDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], LedgerBankAccountDeleteResultDto.prototype, "lbaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerBankAccountDeleteResultDto.prototype, "deleted", void 0);
class LedgerBankAccountSuccessSingleDto {
    success;
    message;
    data;
}
exports.LedgerBankAccountSuccessSingleDto = LedgerBankAccountSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerBankAccountSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ledger bank account fetched successfully' }),
    __metadata("design:type", String)
], LedgerBankAccountSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerBankAccountPayloadDto }),
    __metadata("design:type", LedgerBankAccountPayloadDto)
], LedgerBankAccountSuccessSingleDto.prototype, "data", void 0);
class LedgerBankAccountSuccessDeleteDto {
    success;
    message;
    data;
}
exports.LedgerBankAccountSuccessDeleteDto = LedgerBankAccountSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], LedgerBankAccountSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ledger bank account deleted successfully' }),
    __metadata("design:type", String)
], LedgerBankAccountSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: LedgerBankAccountDeleteResultDto }),
    __metadata("design:type", LedgerBankAccountDeleteResultDto)
], LedgerBankAccountSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=ledger-bank-account-response.dto.js.map