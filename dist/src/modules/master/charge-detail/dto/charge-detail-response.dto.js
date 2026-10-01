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
exports.ChargeDetailSuccessDeleteDto = exports.ChargeDetailDeleteResultDto = exports.ChargeDetailSuccessManyDto = exports.ChargeDetailSuccessSingleDto = exports.ChargeDetailPayloadDto = exports.ChargeDetailErrorResponseDto = exports.ChargeDetailErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const charge_detail_api_types_1 = require("../types/charge-detail-api.types");
class ChargeDetailErrorFieldDto {
    field;
    message;
}
exports.ChargeDetailErrorFieldDto = ChargeDetailErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cdChgId' }),
    __metadata("design:type", String)
], ChargeDetailErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'cdChgId is required when creating a charge line' }),
    __metadata("design:type", String)
], ChargeDetailErrorFieldDto.prototype, "message", void 0);
class ChargeDetailErrorResponseDto {
    success;
    message;
    errors;
}
exports.ChargeDetailErrorResponseDto = ChargeDetailErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], ChargeDetailErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], ChargeDetailErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeDetailErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], ChargeDetailErrorResponseDto.prototype, "errors", void 0);
class ChargeDetailPayloadDto {
    cdId;
    cdDocType;
    cdDocId;
    cdSlno;
    cdCompId;
    cdBranchId;
    cdAccYear;
    cdVoucherNo;
    cdChgId;
    cdChgName;
    cdRole;
    cdMethod;
    cdType;
    cdApplyOn;
    cdLedgerCode;
    cdLedgerName;
    cdLandingCost;
    cdCostAlloc;
    cdBeforeTax;
    cdTaxApl;
    cdSepPost;
    cdUnit;
    cdQtyVal;
    cdWeight;
    cdRate;
    cdAmount;
    cdTaxCode;
    cdHsn;
    cdTaxPerc;
    cdTaxAmt;
    cdSgstPerc;
    cdSgstAmt;
    cdCgstPerc;
    cdCgstAmt;
    cdIgstPerc;
    cdIgstAmt;
    cdCessPerc;
    cdCessAmt;
    cdNetAmt;
    cdRemarks;
    cdIsActive;
    cdIsDeleted;
    cdSyncDate;
    cdCreatedOn;
    cdCreatedBy;
    cdModifiedOn;
    cdModifiedBy;
}
exports.ChargeDetailPayloadDto = ChargeDetailPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_detail_api_types_1.ChargeDocType, enumName: 'ChargeDocType' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Parent document id (polymorphic, no FK)' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdSlno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdCompId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'bigint carried as a string' }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdVoucherNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdChgId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdChgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_detail_api_types_1.ChargeRole, enumName: 'ChargeRole', nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdRole", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_detail_api_types_1.ChargeMethod, enumName: 'ChargeMethod', nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdMethod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_detail_api_types_1.ChargeType, enumName: 'ChargeType' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_detail_api_types_1.ChargeApplyOn, enumName: 'ChargeApplyOn', nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdApplyOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdLedgerCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 200,
        nullable: true,
        description: 'Name of the mapped GL ledger (read-only, not stored)',
    }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeDetailPayloadDto.prototype, "cdLandingCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_detail_api_types_1.ChargeCostAlloc, enumName: 'ChargeCostAlloc', nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdCostAlloc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeDetailPayloadDto.prototype, "cdBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeDetailPayloadDto.prototype, "cdTaxApl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeDetailPayloadDto.prototype, "cdSepPost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdQtyVal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdTaxCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdHsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 255, nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeDetailPayloadDto.prototype, "cdIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ChargeDetailPayloadDto.prototype, "cdIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], ChargeDetailPayloadDto.prototype, "cdCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], ChargeDetailPayloadDto.prototype, "cdModifiedBy", void 0);
class ChargeDetailSuccessSingleDto {
    success;
    message;
    data;
}
exports.ChargeDetailSuccessSingleDto = ChargeDetailSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeDetailSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Charge line fetched successfully' }),
    __metadata("design:type", String)
], ChargeDetailSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeDetailPayloadDto }),
    __metadata("design:type", ChargeDetailPayloadDto)
], ChargeDetailSuccessSingleDto.prototype, "data", void 0);
class ChargeDetailSuccessManyDto {
    success;
    message;
    data;
}
exports.ChargeDetailSuccessManyDto = ChargeDetailSuccessManyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeDetailSuccessManyDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Charge lines fetched successfully' }),
    __metadata("design:type", String)
], ChargeDetailSuccessManyDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeDetailPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], ChargeDetailSuccessManyDto.prototype, "data", void 0);
class ChargeDetailDeleteResultDto {
    cdId;
    deleted;
}
exports.ChargeDetailDeleteResultDto = ChargeDetailDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ChargeDetailDeleteResultDto.prototype, "cdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeDetailDeleteResultDto.prototype, "deleted", void 0);
class ChargeDetailSuccessDeleteDto {
    success;
    message;
    data;
}
exports.ChargeDetailSuccessDeleteDto = ChargeDetailSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ChargeDetailSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Charge line deleted successfully' }),
    __metadata("design:type", String)
], ChargeDetailSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ChargeDetailDeleteResultDto }),
    __metadata("design:type", ChargeDetailDeleteResultDto)
], ChargeDetailSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=charge-detail-response.dto.js.map