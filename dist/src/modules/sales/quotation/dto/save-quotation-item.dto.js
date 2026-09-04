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
exports.SaveQuotationItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveQuotationItemDto {
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
    sqiItemUnitId;
    sqiLineNo;
    sqiItemId;
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
    sqiCreatedBy;
    sqiModifiedBy;
    sqiNetGross;
    sqiChrgBeforeTax;
    sqiChrgAfterTax;
    sqiToBaseFactor;
    sqiRateDiff;
    sqiHasFreight;
    sqiSize;
    sqiSizeUom;
}
exports.SaveQuotationItemDto = SaveQuotationItemDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates the existing line; otherwise a new line is created',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Owning quotation id (defaults to the parent quotation)',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiQuoteId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent quotation scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent quotation scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent quotation scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiTenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        description: 'Defaults to the parent quotation scope',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSrcItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSrcUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSrcItemQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Defaults to the 1-based position within the items array' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveQuotationItemDto.prototype, "sqiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveQuotationItemDto.prototype, "sqiItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(8),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Defaults to the parent quotation price level' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveQuotationItemDto.prototype, "sqiPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiBatchDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiExpiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationItemDto.prototype, "sqiIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationItemDto.prototype, "sqiIsPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationItemDto.prototype, "sqiIsFree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiFreeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationItemDto.prototype, "sqiIsService", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiBillQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiLengthQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAvailableStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiItemDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSplDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSplDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSplDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSchDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSchDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiBillSchPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiBillSchQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiBillSchAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAddlDisc1Perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAddlDisc1Amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAddlDisc2Perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAddlDisc2Amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCashDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAcessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAcessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiAcessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiFreightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiLoadQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiUnloadQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiMinPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiActPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiQuotePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiItemProfit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCostPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiQuotePreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiProfitPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSchemeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSchemeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line net/gross basis the charges sit on' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiNetGross", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing before tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiChrgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing after tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiChrgAfterTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Snapshot of item_unit_conversion.iucToBaseFactor for sqiItemUnitId',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiRateDiff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveQuotationItemDto.prototype, "sqiHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Free-text dimension the operator typed, e.g. "12*6*2*10" — stored verbatim so a ' +
            'reprint shows the size the customer was quoted',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveQuotationItemDto.prototype, "sqiSizeUom", void 0);
//# sourceMappingURL=save-quotation-item.dto.js.map