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
exports.SaveQuotationChargeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const charge_enum_1 = require("../../../master/charge-master/types/charge-enum");
class SaveQuotationChargeDto {
    cdId;
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
    cdCreatedBy;
    cdModifiedBy;
}
exports.SaveQuotationChargeDto = SaveQuotationChargeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates the existing charge line; otherwise a new line is created',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationChargeDto.prototype, "cdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Defaults to the 1-based position within the charges array' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveQuotationChargeDto.prototype, "cdSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent quotation scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationChargeDto.prototype, "cdCompId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent quotation scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationChargeDto.prototype, "cdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        description: 'Defaults to the parent quotation scope',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", String)
], SaveQuotationChargeDto.prototype, "cdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: "Defaults to the quotation's sqQuoteSlno",
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdVoucherNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'charge_master.chgId' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveQuotationChargeDto.prototype, "cdChgId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'Snapshot of chgName' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdChgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_enum_1.ChargeRole, enumName: 'ChargeRole', nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(charge_enum_1.ChargeRole),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdRole", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_enum_1.ChargeMethod, enumName: 'ChargeMethod', nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_enum_1.ChargeMethod),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: charge_enum_1.ChargeType,
        enumName: 'ChargeType',
        default: charge_enum_1.ChargeType.ADD,
        description: 'The sign of the charge',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_enum_1.ChargeType),
    __metadata("design:type", String)
], SaveQuotationChargeDto.prototype, "cdType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: charge_enum_1.ChargeApplyOn,
        enumName: 'ChargeApplyOn',
        nullable: true,
        description: 'Distribution basis for a FIXED lump sum',
    }),
    (0, dtoDecorators_1.NullableUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_enum_1.ChargeApplyOn),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdApplyOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'GL ledger this charge posts to' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveQuotationChargeDto.prototype, "cdLedgerCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Purchase: adds to item landing cost' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationChargeDto.prototype, "cdLandingCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_enum_1.ChargeCostAlloc, enumName: 'ChargeCostAlloc', nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_enum_1.ChargeCostAlloc),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdCostAlloc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: "Folds the charge into the goods' taxable value (taxed at each item's own rate)",
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationChargeDto.prototype, "cdBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'The charge carries its OWN GST, after tax. Mutually exclusive with cdBeforeTax',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationChargeDto.prototype, "cdTaxApl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Post to its own ledger vs absorb' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationChargeDto.prototype, "cdSepPost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Qty or value basis keyed on the line' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdQtyVal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Weight / tonnage basis' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Rate or %, per cdMethod. 0 with a non-zero cdAmount is valid: the operator typed the total',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Charge amount BEFORE tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdTaxCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true, description: 'HSN/SAC snapshot' }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdHsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'cdAmount + its own tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 255, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(255),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationChargeDto.prototype, "cdIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationChargeDto.prototype, "cdModifiedBy", void 0);
//# sourceMappingURL=save-quotation-charge.dto.js.map