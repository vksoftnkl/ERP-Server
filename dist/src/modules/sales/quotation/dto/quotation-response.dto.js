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
exports.QuotationSuccessDeleteDto = exports.QuotationSuccessSingleDto = exports.QuotationDeleteResultDto = exports.QuotationPayloadDto = exports.QuotationItemPayloadDto = exports.QuotationChargePayloadDto = exports.QuotationErrorResponseDto = exports.QuotationErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const charge_enum_1 = require("../../../master/charge-master/types/charge-enum");
class QuotationErrorFieldDto {
    field;
    message;
}
exports.QuotationErrorFieldDto = QuotationErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sqQuoteRefno' }),
    __metadata("design:type", String)
], QuotationErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Duplicate quotation reference number is not allowed' }),
    __metadata("design:type", String)
], QuotationErrorFieldDto.prototype, "message", void 0);
class QuotationErrorResponseDto {
    success;
    message;
    errors;
}
exports.QuotationErrorResponseDto = QuotationErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], QuotationErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], QuotationErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QuotationErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], QuotationErrorResponseDto.prototype, "errors", void 0);
class QuotationChargePayloadDto {
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
    cdIsDeleted;
    cdSyncDate;
    cdCreatedOn;
    cdCreatedBy;
    cdModifiedOn;
    cdModifiedBy;
}
exports.QuotationChargePayloadDto = QuotationChargePayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_enum_1.ChargeDocType, enumName: 'ChargeDocType', example: charge_enum_1.ChargeDocType.QUOTATION }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The parent quotation (sqId)' }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdSlno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdCompId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '1',
        description: 'BigInt serialized as string',
    }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdVoucherNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'charge_master.chgId' }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdChgId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdChgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_enum_1.ChargeRole, enumName: 'ChargeRole', nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdRole", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_enum_1.ChargeMethod, enumName: 'ChargeMethod', nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdMethod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: charge_enum_1.ChargeType, enumName: 'ChargeType', example: charge_enum_1.ChargeType.ADD }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_enum_1.ChargeApplyOn, enumName: 'ChargeApplyOn', nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdApplyOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdLedgerCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationChargePayloadDto.prototype, "cdLandingCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: charge_enum_1.ChargeCostAlloc, enumName: 'ChargeCostAlloc', nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdCostAlloc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationChargePayloadDto.prototype, "cdBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationChargePayloadDto.prototype, "cdTaxApl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationChargePayloadDto.prototype, "cdSepPost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdQtyVal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdWeight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdTaxCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdHsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 255, nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationChargePayloadDto.prototype, "cdIsActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationChargePayloadDto.prototype, "cdIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], QuotationChargePayloadDto.prototype, "cdCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationChargePayloadDto.prototype, "cdModifiedBy", void 0);
class QuotationItemPayloadDto {
    sqiId;
    sqiQuoteId;
    sqiCompanyId;
    sqiBranchId;
    sqiTenantId;
    sqiAccYear;
    sqiSrcDocType;
    sqiSrcItemId;
    sqiSrcUnitId;
    sqiSrcDocRefno;
    sqiSrcItemQty;
    sqiLineNo;
    sqiItemId;
    sqiItemName;
    sqiItemUnitId;
    sqiUnitName;
    sqiDecimalCount;
    sqiBatchConfig;
    sqiGroupId;
    sqiBrandId;
    sqiSectionId;
    sqiCategoryId;
    sqiHsnCode;
    sqiPriceLevel;
    sqiEanCode;
    sqiBatchNo;
    sqiBatchDate;
    sqiExpiryDate;
    sqiIsTaxIncl;
    sqiIsPromo;
    sqiIsFree;
    sqiFreeType;
    sqiIsService;
    sqiCaseQty;
    sqiBillQty;
    sqiLengthQty;
    sqiNetQty;
    sqiWeightQty;
    sqiAvailableStock;
    sqiRate;
    sqiRatePreTax;
    sqiItemDiscPerc;
    sqiItemDiscQty;
    sqiItemDiscAmt;
    sqiSplDiscPerc;
    sqiSplDiscQty;
    sqiSplDiscAmt;
    sqiSchDiscPerc;
    sqiSchDiscQty;
    sqiSchDiscAmt;
    sqiBillSchPerc;
    sqiBillSchQty;
    sqiBillSchAmt;
    sqiAddlDisc1Perc;
    sqiAddlDisc1Amt;
    sqiAddlDisc2Perc;
    sqiAddlDisc2Amt;
    sqiCashDiscPerc;
    sqiCashDiscAmt;
    sqiGrossAmt;
    sqiTaxableAmt;
    sqiTaxPerc;
    sqiTaxAmt;
    sqiCgstPerc;
    sqiCgstAmt;
    sqiSgstPerc;
    sqiSgstAmt;
    sqiIgstPerc;
    sqiIgstAmt;
    sqiCessPerc;
    sqiCessPerUnit;
    sqiCessAmt;
    sqiAcessPerc;
    sqiAcessPerUnit;
    sqiAcessAmt;
    sqiFreightQty;
    sqiFreightAmt;
    sqiLoadQty;
    sqiLoadAmt;
    sqiUnloadQty;
    sqiUnloadAmt;
    sqiRoundOff;
    sqiNetAmt;
    sqiCostPrice;
    sqiMaxPrice;
    sqiMinPrice;
    sqiActPrice;
    sqiQuotePrice;
    sqiItemProfit;
    sqiCostPreTax;
    sqiQuotePreTax;
    sqiProfitPreTax;
    sqiMrpSavings;
    sqiMrpSavingsPerc;
    sqiSchemeId;
    sqiSchemeName;
    sqiRemarks;
    sqiNetGross;
    sqiChrgBeforeTax;
    sqiChrgAfterTax;
    sqiToBaseFactor;
    sqiRateDiff;
    sqiHasFreight;
    sqiSize;
    sqiSizeUom;
    sqiIsDeleted;
    sqiSyncDate;
    sqiCreatedOn;
    sqiCreatedBy;
    sqiModifiedOn;
    sqiModifiedBy;
}
exports.QuotationItemPayloadDto = QuotationItemPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiQuoteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSrcItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSrcUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSrcItemQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_master.itemNameEn for sqiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiItemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
    }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_unit_master.unit_name reached via item_unit_conversion — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiUnitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_unit_master.unit_decimal_count reached via item_unit_conversion — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiDecimalCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_master.item_batch_config for sqiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiBatchConfig", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_group_id for sqiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_brand_id for sqiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiBrandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_section_id for sqiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSectionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_category_id for sqiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiBatchDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiExpiryDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationItemPayloadDto.prototype, "sqiIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationItemPayloadDto.prototype, "sqiIsPromo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationItemPayloadDto.prototype, "sqiIsFree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiFreeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationItemPayloadDto.prototype, "sqiIsService", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiBillQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiLengthQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAvailableStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiItemDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSplDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSplDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSplDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSchDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSchDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiBillSchPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiBillSchQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiBillSchAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAddlDisc1Perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAddlDisc1Amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAddlDisc2Perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAddlDisc2Amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCashDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAcessPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAcessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiAcessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiFreightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiLoadQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiUnloadQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiMinPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiActPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiQuotePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiItemProfit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiCostPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiQuotePreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiProfitPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSchemeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSchemeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line net/gross basis the charges sit on' }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiNetGross", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing before tax' }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiChrgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing after tax' }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiChrgAfterTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Snapshot of item_unit_conversion.iucToBaseFactor for sqiItemUnitId',
    }),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationItemPayloadDto.prototype, "sqiRateDiff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationItemPayloadDto.prototype, "sqiHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Free-text dimension the operator typed, stored verbatim',
    }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSizeUom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationItemPayloadDto.prototype, "sqiIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationItemPayloadDto.prototype, "sqiCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationItemPayloadDto.prototype, "sqiModifiedBy", void 0);
class QuotationPayloadDto {
    sqId;
    sqCompanyId;
    sqBranchId;
    sqTenantId;
    sqAccYear;
    sqSessionId;
    sqCategoryId;
    sqPriceLevel;
    sqDocType;
    sqQuoteSlno;
    sqQuoteRefno;
    sqUsrRefno;
    sqQuoteDate;
    sqQuoteDatetime;
    sqValidUntil;
    sqValidityDays;
    sqRevisionNo;
    sqParentQuoteId;
    sqParentAccYear;
    sqSrcDocType;
    sqSrcDocId;
    sqSrcDocRefno;
    sqSrcDocDate;
    sqCustId;
    sqCustAreaId;
    sqCustAreaName;
    sqCustAreaDistanceKm;
    sqCustName;
    sqCustAddr;
    sqCustPlace;
    sqCustPhone;
    sqCustEmail;
    sqCustGstin;
    sqCustGstType;
    sqCustStcd;
    sqPosStcd;
    sqStateName;
    sqContactPerson;
    sqContactPhone;
    sqHasLoad;
    sqHasUnload;
    sqHasFreight;
    sqHasPromo;
    sqHasComm;
    sqUserId;
    sqSalesmanId;
    sqSalesmanName;
    sqAgentId;
    sqAgentName;
    sqTotItems;
    sqTotWeight;
    sqTotBags;
    sqGrossAmt;
    sqItemDisc;
    sqSplDisc;
    sqSchDisc;
    sqBillSchDisc;
    sqAddlDisc1;
    sqAddlDisc2;
    sqTaxableAmt;
    sqCgstAmt;
    sqSgstAmt;
    sqIgstAmt;
    sqCessAmt;
    sqTaxAmt;
    sqFreightAmt;
    sqLoadAmt;
    sqUnloadAmt;
    sqOtherAmt1;
    sqOtherAmt2;
    sqRoundOff;
    sqQuoteAmt;
    sqTotalCost;
    sqMarginAmt;
    sqMarginPerc;
    sqPaymentTerms;
    sqDeliveryTerms;
    sqTermsConditions;
    sqStatus;
    sqSentOn;
    sqAcceptedOn;
    sqRejectedOn;
    sqRejectReason;
    sqConvertedDocType;
    sqConvertedDocId;
    sqConvertedOn;
    sqApprovedOn;
    sqApprovedBy;
    sqCancelledOn;
    sqCancelledBy;
    sqCancelReason;
    sqMrpSavings;
    sqMrpSavingsPerc;
    sqPrintCount;
    sqDeviceType;
    sqDeviceId;
    sqRemarks;
    sqIsDeleted;
    sqSyncDate;
    sqCreatedOn;
    sqCreatedBy;
    sqModifiedOn;
    sqModifiedBy;
    sqFreightCalcType;
    sqLoadingCalcType;
    sqDiscAlterBase;
    items;
    charges;
}
exports.QuotationPayloadDto = QuotationPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30 }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1', description: 'BigInt serialized as string' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqQuoteSlno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqQuoteRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqQuoteDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqQuoteDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqValidUntil", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqValidityDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqRevisionNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqParentQuoteId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 9, maxLength: 9, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqParentAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSrcDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustAreaId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'area_master.armName for sqCustAreaId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustAreaName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'area_master.armDistanceKm for sqCustAreaId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustAreaDistanceKm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqContactPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationPayloadDto.prototype, "sqHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationPayloadDto.prototype, "sqHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationPayloadDto.prototype, "sqHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationPayloadDto.prototype, "sqHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationPayloadDto.prototype, "sqHasComm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'employee_master.empName for sqSalesmanId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSalesmanName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'sale_agents.saName for sqAgentId — only populated on GET',
    }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqAgentName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqTotItems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqTotBags", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqBillSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqAddlDisc1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqAddlDisc2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqOtherAmt1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqOtherAmt2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqQuoteAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqMarginAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqMarginPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqPaymentTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqDeliveryTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqTermsConditions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSentOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqAcceptedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqRejectedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqRejectReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqConvertedDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqConvertedDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqConvertedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqApprovedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqApprovedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCancelledBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqCancelReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], QuotationPayloadDto.prototype, "sqPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Originating device identifier' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], QuotationPayloadDto.prototype, "sqIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationPayloadDto.prototype, "sqCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the freight charge is computed (snapshot of the charge master method), lower case',
    }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqFreightCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the loading charge is computed (snapshot of the charge master method), lower case',
    }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqLoadingCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'true = discounts change the basis the charges are computed on',
    }),
    __metadata("design:type", Object)
], QuotationPayloadDto.prototype, "sqDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QuotationItemPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], QuotationPayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QuotationChargePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], QuotationPayloadDto.prototype, "charges", void 0);
class QuotationDeleteResultDto {
    sqId;
    deleted;
}
exports.QuotationDeleteResultDto = QuotationDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], QuotationDeleteResultDto.prototype, "sqId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], QuotationDeleteResultDto.prototype, "deleted", void 0);
class QuotationSuccessSingleDto {
    success;
    message;
    data;
}
exports.QuotationSuccessSingleDto = QuotationSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], QuotationSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Quotation fetched successfully' }),
    __metadata("design:type", String)
], QuotationSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: QuotationPayloadDto,
        description: 'Quotation record including its line items and applied charges',
    }),
    __metadata("design:type", QuotationPayloadDto)
], QuotationSuccessSingleDto.prototype, "data", void 0);
class QuotationSuccessDeleteDto {
    success;
    message;
    data;
}
exports.QuotationSuccessDeleteDto = QuotationSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], QuotationSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Quotation deleted successfully' }),
    __metadata("design:type", String)
], QuotationSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QuotationDeleteResultDto }),
    __metadata("design:type", QuotationDeleteResultDto)
], QuotationSuccessDeleteDto.prototype, "data", void 0);
//# sourceMappingURL=quotation-response.dto.js.map