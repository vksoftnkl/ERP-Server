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
exports.TenderMasterSuccessDeleteDto = exports.TenderMasterSuccessListDto = exports.TenderMasterSuccessSingleDto = exports.TenderMasterDeleteResultDto = exports.TenderMasterPayloadDto = exports.TenderMasterErrorResponseDto = exports.TenderMasterErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class TenderMasterErrorFieldDto {
    field;
    message;
}
exports.TenderMasterErrorFieldDto = TenderMasterErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'tndName' }),
    __metadata("design:type", String)
], TenderMasterErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate tndName is not allowed for this tender type' }),
    __metadata("design:type", String)
], TenderMasterErrorFieldDto.prototype, "message", void 0);
class TenderMasterErrorResponseDto {
    success;
    message;
    errors;
}
exports.TenderMasterErrorResponseDto = TenderMasterErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TenderMasterErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], TenderMasterErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderMasterErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], TenderMasterErrorResponseDto.prototype, "errors", void 0);
class TenderMasterPayloadDto {
    tndId;
    tndCompanyId;
    tndBranchId;
    tndTypeId;
    tndName;
    tndShortName;
    tndLedgerId;
    tndSettlementLedgerId;
    tndCompanyName;
    tndBranchName;
    tndTypeName;
    tndLedgerName;
    tndSurchargeLedgerName;
    tndSettlementDays;
    tndBankAccountId;
    tndMinAmount;
    tndMaxAmount;
    tndDailyLimit;
    tndSurchargePerc;
    tndSurchargeAmount;
    tndSurchargeLedgerId;
    tndEditSurcharge;
    tndEditLedger;
    tndUpiVpa;
    tndUpiQrPayload;
    tndMerchantId;
    tndTerminalId;
    tndConversionRate;
    tndNeedsRef;
    tndAllowChange;
    tndAllowInReturn;
    tndOpenCashDrawer;
    tndIsDefault;
    tndDisplayPosition;
    tndHotkey;
    tndColour;
    tndEffectiveFrom;
    tndEffectiveTo;
    tndRemarks;
    tndIsActive;
    tndIsDeleted;
    tndSyncDate;
    tndCreatedOn;
    tndCreatedBy;
    tndModifiedOn;
    tndModifiedBy;
}
exports.TenderMasterPayloadDto = TenderMasterPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderMasterPayloadDto.prototype, "tndId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderMasterPayloadDto.prototype, "tndCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], TenderMasterPayloadDto.prototype, "tndTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TenderMasterPayloadDto.prototype, "tndName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TenderMasterPayloadDto.prototype, "tndShortName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderMasterPayloadDto.prototype, "tndLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndSettlementLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Resolved on GET only; null on create/update/delete responses',
    }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Resolved on GET only; null on create/update/delete responses',
    }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'CARD',
        description: 'Resolved on GET only; null on create/update/delete responses',
    }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndTypeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Resolved on GET only; null on create/update/delete responses',
    }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Resolved on GET only; null on create/update/delete responses',
    }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndSurchargeLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderMasterPayloadDto.prototype, "tndSettlementDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndBankAccountId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderMasterPayloadDto.prototype, "tndMinAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndMaxAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndDailyLimit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderMasterPayloadDto.prototype, "tndSurchargePerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderMasterPayloadDto.prototype, "tndSurchargeAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndSurchargeLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderMasterPayloadDto.prototype, "tndEditSurcharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderMasterPayloadDto.prototype, "tndEditLedger", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndUpiVpa", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndUpiQrPayload", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndTerminalId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderMasterPayloadDto.prototype, "tndConversionRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'null = inherit from the tender type' }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndNeedsRef", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'null = inherit from the tender type' }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndAllowChange", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'null = inherit from the tender type' }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndAllowInReturn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderMasterPayloadDto.prototype, "tndOpenCashDrawer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderMasterPayloadDto.prototype, "tndIsDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderMasterPayloadDto.prototype, "tndDisplayPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndHotkey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '#00A3FF' }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndColour", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2026-08-01' }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndEffectiveFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: '2027-03-31' }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndEffectiveTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderMasterPayloadDto.prototype, "tndIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderMasterPayloadDto.prototype, "tndIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TenderMasterPayloadDto.prototype, "tndCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], TenderMasterPayloadDto.prototype, "tndModifiedBy", void 0);
class TenderMasterDeleteResultDto {
    tndId;
    deleted;
}
exports.TenderMasterDeleteResultDto = TenderMasterDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderMasterDeleteResultDto.prototype, "tndId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderMasterDeleteResultDto.prototype, "deleted", void 0);
class TenderMasterSuccessSingleDto {
    success;
    message;
    data;
}
exports.TenderMasterSuccessSingleDto = TenderMasterSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderMasterSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tender fetched successfully' }),
    __metadata("design:type", String)
], TenderMasterSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderMasterPayloadDto }),
    __metadata("design:type", TenderMasterPayloadDto)
], TenderMasterSuccessSingleDto.prototype, "data", void 0);
class TenderMasterSuccessListDto {
    success;
    message;
    data;
}
exports.TenderMasterSuccessListDto = TenderMasterSuccessListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderMasterSuccessListDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tenders fetched successfully' }),
    __metadata("design:type", String)
], TenderMasterSuccessListDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderMasterPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], TenderMasterSuccessListDto.prototype, "data", void 0);
class TenderMasterSuccessDeleteDto {
    success;
    message;
    data;
}
exports.TenderMasterSuccessDeleteDto = TenderMasterSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderMasterSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tender deleted successfully' }),
    __metadata("design:type", String)
], TenderMasterSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderMasterDeleteResultDto }),
    __metadata("design:type", TenderMasterDeleteResultDto)
], TenderMasterSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=tender-master-response.dto.js.map