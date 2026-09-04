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
exports.TenderDetailSuccessDeleteDto = exports.TenderDetailDeleteResultDto = exports.TenderDetailSuccessManyDto = exports.TenderDetailSuccessSingleDto = exports.TenderDetailPayloadDto = exports.TenderDetailErrorResponseDto = exports.TenderDetailErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const tender_detail_api_types_1 = require("../types/tender-detail-api.types");
class TenderDetailErrorFieldDto {
    field;
    message;
}
exports.TenderDetailErrorFieldDto = TenderDetailErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'tdTenderId' }),
    __metadata("design:type", String)
], TenderDetailErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'tdTenderId must be provided when creating a tender line' }),
    __metadata("design:type", String)
], TenderDetailErrorFieldDto.prototype, "message", void 0);
class TenderDetailErrorResponseDto {
    success;
    message;
    errors;
}
exports.TenderDetailErrorResponseDto = TenderDetailErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], TenderDetailErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], TenderDetailErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderDetailErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], TenderDetailErrorResponseDto.prototype, "errors", void 0);
class TenderDetailPayloadDto {
    tdId;
    tdCompanyId;
    tdBranchId;
    tdTenantId;
    tdAccYear;
    tdSrcModule;
    tdSrcDocType;
    tdSrcDocId;
    tdRowNo;
    tdDocDate;
    tdPartyLedgerId;
    tdVoucherId;
    tdTenderId;
    tdTenderName;
    tdTenderTypeId;
    tdTenderLedgerId;
    tdTenderLedgerName;
    tdDrCr;
    tdAmount;
    tdSurchargePerc;
    tdSurchargeAmt;
    tdSurchargeLedgerId;
    tdTotalAmt;
    tdReceivedAmt;
    tdChangeAmt;
    tdUnitsUsed;
    tdConversionRate;
    tdRefNo;
    tdAuthCode;
    tdCardLast4;
    tdBankName;
    tdPayerVpa;
    tdInstrumentDate;
    tdIsPdc;
    tdSettleStatus;
    tdSettleLedgerId;
    tdExpectedSettleOn;
    tdSettledOn;
    tdSettleAmount;
    tdMdrAmt;
    tdSettleRefNo;
    tdSettleVoucherId;
    tdSessionId;
    tdDeviceId;
    tdUserId;
    tdNotes;
    tdIsDeleted;
    tdSyncDate;
    tdCreatedOn;
    tdCreatedBy;
    tdModifiedOn;
    tdModifiedBy;
}
exports.TenderDetailPayloadDto = TenderDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: tender_detail_api_types_1.TenderSrcModule, enumName: 'TenderSrcModule' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdSrcModule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: tender_detail_api_types_1.TenderSrcDocType, enumName: 'TenderSrcDocType' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Parent document id (polymorphic, no FK)' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1 }),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date', description: "Snapshot of the parent document's date" }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdDocDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdPartyLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true, description: 'Filled at posting' }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'acc_tender_master.tndId' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdTenderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        nullable: true,
        description: 'Name of the picked tender (read-only, not stored)',
    }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdTenderName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'Integer carried as a string' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdTenderTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdTenderLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 200,
        nullable: true,
        description: 'Name of the posting ledger (read-only, not stored)',
    }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdTenderLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: tender_detail_api_types_1.TenderDrCr, enumName: 'TenderDrCr' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdDrCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdSurchargePerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Surcharge income ledger snapshot',
    }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSurchargeLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'tdAmount + tdSurchargeAmt, rounded to 2 decimals' }),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdTotalAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdReceivedAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdChangeAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdUnitsUsed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdConversionRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdRefNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdAuthCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 4, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdCardLast4", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdPayerVpa", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date', nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdInstrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderDetailPayloadDto.prototype, "tdIsPdc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: tender_detail_api_types_1.TenderSettleStatus, enumName: 'TenderSettleStatus' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdSettleStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSettleLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date', nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdExpectedSettleOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date', nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSettledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSettleAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], TenderDetailPayloadDto.prototype, "tdMdrAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSettleRefNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSettleVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdNotes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], TenderDetailPayloadDto.prototype, "tdIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    __metadata("design:type", String)
], TenderDetailPayloadDto.prototype, "tdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    __metadata("design:type", Object)
], TenderDetailPayloadDto.prototype, "tdModifiedBy", void 0);
class TenderDetailSuccessSingleDto {
    success;
    message;
    data;
}
exports.TenderDetailSuccessSingleDto = TenderDetailSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderDetailSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tender line fetched successfully' }),
    __metadata("design:type", String)
], TenderDetailSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderDetailPayloadDto }),
    __metadata("design:type", TenderDetailPayloadDto)
], TenderDetailSuccessSingleDto.prototype, "data", void 0);
class TenderDetailSuccessManyDto {
    success;
    message;
    data;
}
exports.TenderDetailSuccessManyDto = TenderDetailSuccessManyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderDetailSuccessManyDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tender lines fetched successfully' }),
    __metadata("design:type", String)
], TenderDetailSuccessManyDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderDetailPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], TenderDetailSuccessManyDto.prototype, "data", void 0);
class TenderDetailDeleteResultDto {
    tdId;
    deleted;
}
exports.TenderDetailDeleteResultDto = TenderDetailDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], TenderDetailDeleteResultDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderDetailDeleteResultDto.prototype, "deleted", void 0);
class TenderDetailSuccessDeleteDto {
    success;
    message;
    data;
}
exports.TenderDetailSuccessDeleteDto = TenderDetailSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TenderDetailSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tender line deleted successfully' }),
    __metadata("design:type", String)
], TenderDetailSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: TenderDetailDeleteResultDto }),
    __metadata("design:type", TenderDetailDeleteResultDto)
], TenderDetailSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=tender-detail-response.dto.js.map