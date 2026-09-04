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
exports.SaveSaleOrderItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveSaleOrderItemDto {
    soiId;
    soiOrderId;
    soiCompanyId;
    soiBranchId;
    soiTenantId;
    soiAccYear;
    soiLineNo;
    soiSrcDocType;
    soiSrcDocId;
    soiSrcDocAccYear;
    soiSrcDocRefno;
    soiSrcLineNo;
    soiItemId;
    soiItemUnitId;
    soiToBaseFactor;
    soiHsnCode;
    soiPriceLevel;
    soiEanCode;
    soiSize;
    soiSizeUom;
    soiGodownId;
    soiIsReserved;
    soiReservedQty;
    soiReserveExpiresOn;
    soiIsTaxIncl;
    soiIsPromo;
    soiIsFree;
    soiFreeType;
    soiIsService;
    soiHasFreight;
    soiCaseQty;
    soiOrderQty;
    soiLengthQty;
    soiNetQty;
    soiWeightQty;
    soiAvailableStock;
    soiDeliveredQty;
    soiCancelledQty;
    soiPendingQty;
    soiBilledAmt;
    soiRate;
    soiRatePreTax;
    soiRateDiff;
    soiActPrice;
    soiMaxPrice;
    soiMinPrice;
    soiCostPrice;
    soiCostPreTax;
    soiIsRateLocked;
    soiItemDiscPerc;
    soiItemDiscQty;
    soiItemDiscAmt;
    soiSplDiscPerc;
    soiSplDiscQty;
    soiSplDiscAmt;
    soiSchDiscPerc;
    soiSchDiscQty;
    soiSchDiscAmt;
    soiBillSchPerc;
    soiBillSchQty;
    soiBillSchAmt;
    soiAddlDisc1Perc;
    soiAddlDisc1Amt;
    soiAddlDisc2Perc;
    soiAddlDisc2Amt;
    soiCashDiscPerc;
    soiCashDiscAmt;
    soiGrossAmt;
    soiNetGross;
    soiChrgBeforeTax;
    soiChrgAfterTax;
    soiTaxableAmt;
    soiTaxPerc;
    soiTaxAmt;
    soiCgstPerc;
    soiCgstAmt;
    soiSgstPerc;
    soiSgstAmt;
    soiIgstPerc;
    soiIgstAmt;
    soiCessPerc;
    soiCessPerUnit;
    soiCessAmt;
    soiAcessPerc;
    soiAcessPerUnit;
    soiAcessAmt;
    soiFreightQty;
    soiFreightAmt;
    soiLoadQty;
    soiLoadAmt;
    soiUnloadQty;
    soiUnloadAmt;
    soiRoundOff;
    soiNetAmt;
    soiSoldPrice;
    soiSoldPreTax;
    soiItemProfit;
    soiProfitPreTax;
    soiMrpSavings;
    soiMrpSavingsPerc;
    soiDeliveryDate;
    soiLineStatus;
    soiSalesmanId;
    soiSchemeId;
    soiSchemeName;
    soiRemarks;
    soiCreatedBy;
    soiModifiedBy;
}
exports.SaveSaleOrderItemDto = SaveSaleOrderItemDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'When provided, updates the existing line; otherwise a new line is created',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Owning order id (defaults to the parent order)',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiOrderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent order scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent order scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Defaults to the parent order scope' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiTenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        description: 'Defaults to the parent order scope',
    }),
    (0, dtoDecorators_1.OptionalTrimmedString)(9),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Defaults to the 1-based position within the items array' }),
    (0, dtoDecorators_1.OptionalInteger)(1),
    __metadata("design:type", Number)
], SaveSaleOrderItemDto.prototype, "soiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 30,
        nullable: true,
        description: 'Document this line came from (quotation)',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 9,
        maxLength: 9,
        nullable: true,
        description: "The source document's OWN accounting year",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSrcDocAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSrcLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleOrderItemDto.prototype, "soiItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Snapshot of item_unit_conversion.iucToBaseFactor for soiItemUnitId',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(8),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Defaults to the parent order price level' }),
    (0, dtoDecorators_1.OptionalInteger)(),
    __metadata("design:type", Number)
], SaveSaleOrderItemDto.prototype, "soiPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Free-text dimension the operator typed, e.g. "12*6*2*10" — stored verbatim so a ' +
            'reprint shows the size the customer agreed to (blank is rejected, ck_soi_size)',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSizeUom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderItemDto.prototype, "soiIsReserved", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '0 ≤ reserved ≤ ordered (ck_soi_reserved)' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiReservedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: 'string', format: 'date', nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiReserveExpiresOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderItemDto.prototype, "soiIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderItemDto.prototype, "soiIsPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderItemDto.prototype, "soiIsFree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: 'NULL / SCHEME / SAMPLE / REPLACEMENT (ck_soi_free_type in DB)',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiFreeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderItemDto.prototype, "soiIsService", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderItemDto.prototype, "soiHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiOrderQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiLengthQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Informational snapshot at order time' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAvailableStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fulfilment cache — sale_bill_item is the truth' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiDeliveredQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fulfilment cache' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCancelledQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Fulfilment cache. Ordered = delivered + cancelled + pending (ck_soi_qty_balance); ' +
            'when omitted it is derived as ordered − delivered − cancelled.',
    }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiPendingQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Fulfilment cache' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiBilledAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiRateDiff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiActPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'MRP' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiMinPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCostPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'true (default) = a confirmed order holds its price even if the price master moves; ' +
            'false lets the bill re-price at delivery',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleOrderItemDto.prototype, "soiIsRateLocked", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiItemDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSplDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSplDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSplDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSchDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSchDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiBillSchPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiBillSchQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiBillSchAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAddlDisc1Perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAddlDisc1Amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAddlDisc2Perc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAddlDisc2Amt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCashDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line net/gross basis the charges sit on' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiNetGross", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing before tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiChrgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing after tax' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiChrgAfterTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'On the POST-charge taxable' }),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAcessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAcessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiAcessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiFreightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiLoadQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiUnloadQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, dtoDecorators_1.OptionalNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Costing / margin, PER UNIT' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSoldPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSoldPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiItemProfit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiProfitPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'A split delivery date for this line, when it differs from the header',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiDeliveryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        description: "PENDING / PARTIAL / DELIVERED / CANCELLED — defaults to 'PENDING'",
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiLineStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSchemeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiSchemeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Actor id or name; defaults to the caller' }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleOrderItemDto.prototype, "soiModifiedBy", void 0);
//# sourceMappingURL=save-sale-order-item.dto.js.map