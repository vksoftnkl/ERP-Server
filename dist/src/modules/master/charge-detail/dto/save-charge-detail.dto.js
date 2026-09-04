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
exports.SaveChargeDetailDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const charge_detail_api_types_1 = require("../types/charge-detail-api.types");
class SaveChargeDetailDto {
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
exports.SaveChargeDetailDto = SaveChargeDetailDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates that charge line; otherwise a new line is created',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: charge_detail_api_types_1.ChargeDocType,
        enumName: 'ChargeDocType',
        description: "Parent document's module. Required on create, immutable afterwards",
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(12),
    (0, class_validator_1.IsEnum)(charge_detail_api_types_1.ChargeDocType),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Parent document id. Required on create, immutable afterwards',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Line order within the document. Defaults to the next free number',
    }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveChargeDetailDto.prototype, "cdSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Required on create' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdCompId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Required on create' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        description: 'Accounting year, e.g. 2026-2027. Required on create',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: "Parent document's voucher number" }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdVoucherNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'charge_master.chgId. Required on create',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdChgId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true, description: 'Snapshot of chgName' }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdChgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_detail_api_types_1.ChargeRole, enumName: 'ChargeRole', nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(15),
    (0, class_validator_1.IsEnum)(charge_detail_api_types_1.ChargeRole),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdRole", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_detail_api_types_1.ChargeMethod, enumName: 'ChargeMethod', nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_detail_api_types_1.ChargeMethod),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdMethod", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: charge_detail_api_types_1.ChargeType,
        enumName: 'ChargeType',
        default: charge_detail_api_types_1.ChargeType.ADD,
        description: 'The sign of the charge',
    }),
    (0, dtoDecorators_1.OptionalUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_detail_api_types_1.ChargeType),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: charge_detail_api_types_1.ChargeApplyOn,
        enumName: 'ChargeApplyOn',
        nullable: true,
        description: 'Distribution basis for a FIXED lump sum',
    }),
    (0, dtoDecorators_1.NullableUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_detail_api_types_1.ChargeApplyOn),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdApplyOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'GL ledger this charge posts to. Required on create',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveChargeDetailDto.prototype, "cdLedgerCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Purchase: adds to item landing cost' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeDetailDto.prototype, "cdLandingCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_detail_api_types_1.ChargeCostAlloc, enumName: 'ChargeCostAlloc', nullable: true }),
    (0, dtoDecorators_1.NullableUpperMaxString)(10),
    (0, class_validator_1.IsEnum)(charge_detail_api_types_1.ChargeCostAlloc),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdCostAlloc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: "Folds the charge into the goods' taxable value (taxed at each item's own rate)",
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeDetailDto.prototype, "cdBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: false,
        description: 'The charge carries its OWN GST, after tax. Mutually exclusive with cdBeforeTax',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeDetailDto.prototype, "cdTaxApl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Post to its own ledger vs absorb' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeDetailDto.prototype, "cdSepPost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Qty or value basis keyed on the line' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdQtyVal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Weight / tonnage basis' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'Rate or %, per cdMethod. 0 with a non-zero cdAmount is valid: the operator typed the total',
    }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Charge amount BEFORE tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdTaxCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true, description: 'HSN/SAC snapshot' }),
    (0, dtoDecorators_1.NullableStringStrict)(15),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdHsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'cdAmount + its own tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 255, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(255),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveChargeDetailDto.prototype, "cdIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveChargeDetailDto.prototype, "cdModifiedBy", void 0);
//# sourceMappingURL=save-charge-detail.dto.js.map