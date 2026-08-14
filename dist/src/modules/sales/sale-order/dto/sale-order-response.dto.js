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
exports.SaleOrderSuccessCancelLinesDto = exports.SaleOrderCancelLinesResultDto = exports.SaleOrderCancelledLineDto = exports.SaleOrderSuccessPendingAmountDto = exports.SaleOrderPendingAmountResultDto = exports.SaleOrderSuccessDeleteDto = exports.SaleOrderSuccessSingleDto = exports.SaleOrderDeleteResultDto = exports.SaleOrderPayloadDto = exports.SaleOrderTenderPayloadDto = exports.SaleOrderChargePayloadDto = exports.SaleOrderItemPayloadDto = exports.SaleOrderErrorResponseDto = exports.SaleOrderErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const charge_detail_response_dto_1 = require("../../../master/charge-detail/dto/charge-detail-response.dto");
const tender_detail_response_dto_1 = require("../../../accountsModule/tenderDetail/dto/tender-detail-response.dto");
class SaleOrderErrorFieldDto {
    field;
    message;
}
exports.SaleOrderErrorFieldDto = SaleOrderErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'soCustId' }),
    __metadata("design:type", String)
], SaleOrderErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'soCustId is required' }),
    __metadata("design:type", String)
], SaleOrderErrorFieldDto.prototype, "message", void 0);
class SaleOrderErrorResponseDto {
    success;
    message;
    errors;
}
exports.SaleOrderErrorResponseDto = SaleOrderErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SaleOrderErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], SaleOrderErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], SaleOrderErrorResponseDto.prototype, "errors", void 0);
class SaleOrderItemPayloadDto {
    soiId;
    soiOrderId;
    soiCompanyId;
    soiCompanyName;
    soiBranchId;
    soiBranchName;
    soiTenantId;
    soiAccYear;
    soiLineNo;
    soiSrcDocType;
    soiSrcDocId;
    soiSrcDocAccYear;
    soiSrcDocRefno;
    soiSrcLineNo;
    soiItemId;
    soiItemName;
    soiItemUnitId;
    soiUnitName;
    soiDecimalCount;
    soiGroupId;
    soiBrandId;
    soiSectionId;
    soiCategoryId;
    soiToBaseFactor;
    soiHsnCode;
    soiPriceLevel;
    soiEanCode;
    soiSize;
    soiSizeUom;
    soiGodownId;
    soiGodownName;
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
    soiSalesmanName;
    soiSchemeId;
    soiSchemeName;
    soiRemarks;
    soiCancelReason;
    soiIsDeleted;
    soiSyncDate;
    soiCreatedOn;
    soiCreatedBy;
    soiModifiedOn;
    soiModifiedBy;
}
exports.SaleOrderItemPayloadDto = SaleOrderItemPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiOrderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'company.comp_name for soiCompanyId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'branch_master.br_name for soiBranchId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 9, maxLength: 9, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSrcDocAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSrcLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_master.itemNameEn for soiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiItemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
    }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_unit_master.unit_name reached via item_unit_conversion — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiUnitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_unit_master.unit_decimal_count reached via item_unit_conversion — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiDecimalCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_group_id for soiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_brand_id for soiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiBrandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_section_id for soiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSectionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_category_id for soiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Snapshot of item_unit_conversion.iucToBaseFactor for soiItemUnitId',
    }),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Free-text dimension the operator typed, stored verbatim',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSizeUom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'godown_locations.gdl_name for soiGodownId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiGodownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Soft hold; inventory owns the hard one' }),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiIsReserved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiReservedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiReserveExpiresOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiIsPromo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiIsFree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiFreeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiIsService", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiOrderQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiLengthQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Informational snapshot at order time' }),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAvailableStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fulfilment cache — sale_bill_item is the truth' }),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiDeliveredQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fulfilment cache' }),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCancelledQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fulfilment cache; ordered = delivered + cancelled + pending' }),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiPendingQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fulfilment cache' }),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiBilledAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiRateDiff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiActPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'MRP' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiMinPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiCostPreTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'true = the order holds its price even if the price master moves',
    }),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiIsRateLocked", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiItemDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSplDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSplDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSplDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSchDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSchDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiBillSchPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiBillSchQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiBillSchAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAddlDisc1Perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAddlDisc1Amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAddlDisc2Perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAddlDisc2Amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCashDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line net/gross basis the charges sit on' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiNetGross", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing before tax' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiChrgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing after tax' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiChrgAfterTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'On the POST-charge taxable' }),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAcessPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAcessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiAcessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiFreightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiLoadQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiUnloadQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderItemPayloadDto.prototype, "soiNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Costing / margin, PER UNIT' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSoldPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSoldPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiItemProfit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiProfitPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        format: 'date',
        description: 'A split delivery date for this line',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiDeliveryDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, description: 'PENDING / PARTIAL / DELIVERED / CANCELLED' }),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiLineStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'employee_master.emp_name for soiSalesmanId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSalesmanName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSchemeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSchemeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 250,
        nullable: true,
        description: 'Why the line was cancelled — written by PUT /sale-orders/cancel-lines',
    }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiCancelReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderItemPayloadDto.prototype, "soiIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleOrderItemPayloadDto.prototype, "soiCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderItemPayloadDto.prototype, "soiModifiedBy", void 0);
class SaleOrderChargePayloadDto extends charge_detail_response_dto_1.ChargeDetailPayloadDto {
    cdCompName;
    cdBranchName;
}
exports.SaleOrderChargePayloadDto = SaleOrderChargePayloadDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'company.comp_name for cdCompId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderChargePayloadDto.prototype, "cdCompName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'branch_master.br_name for cdBranchId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderChargePayloadDto.prototype, "cdBranchName", void 0);
class SaleOrderTenderPayloadDto extends tender_detail_response_dto_1.TenderDetailPayloadDto {
    tdCompanyName;
    tdPartyLedgerName;
    tdUserName;
}
exports.SaleOrderTenderPayloadDto = SaleOrderTenderPayloadDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'company.comp_name for tdCompanyId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderTenderPayloadDto.prototype, "tdCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'acc_ledger_master.led_name for tdPartyLedgerId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderTenderPayloadDto.prototype, "tdPartyLedgerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'user_master.usr_display_name for tdUserId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderTenderPayloadDto.prototype, "tdUserName", void 0);
class SaleOrderPayloadDto {
    soId;
    soCompanyId;
    soCompanyName;
    soBranchId;
    soBranchName;
    soTenantId;
    soAccYear;
    soSessionId;
    soDeviceId;
    soDocType;
    soOrderType;
    soPriceLevel;
    soOrderSlno;
    soOrderRefno;
    soUsrRefno;
    soOrderDate;
    soOrderDatetime;
    soDeliveryDate;
    soDeliverySlot;
    soPriority;
    soValidUntil;
    soSrcDocType;
    soSrcDocId;
    soSrcDocAccYear;
    soSrcDocRefno;
    soSrcDocDate;
    soDeliveryMode;
    soCustId;
    soCustName;
    soCustAddr;
    soCustPlace;
    soCustPin;
    soCustPhone;
    soCustEmail;
    soCustGstin;
    soCustGstType;
    soCustStcd;
    soPosStcd;
    soStateName;
    soContactPerson;
    soContactPhone;
    soShipName;
    soShipAddr;
    soShipPlace;
    soShipPin;
    soShipPhone;
    soShipStcd;
    soShipLandmark;
    soShipLat;
    soShipLng;
    soHasLoad;
    soHasUnload;
    soHasFreight;
    soHasPromo;
    soHasComm;
    soHasLoyalty;
    soUserId;
    soSalesmanId;
    soSalesmanName;
    soAgentId;
    soAgentCommPerc;
    soAgentCommAmt;
    soPackedId;
    soTotItems;
    soDeliveredItems;
    soTotWeight;
    soTotBags;
    soGrossAmt;
    soItemDisc;
    soSplDisc;
    soSchDisc;
    soBillSchDisc;
    soAddlDisc1;
    soAddlDisc2;
    soCashDiscPerc;
    soCashDisc;
    soTaxableAmt;
    soCgstAmt;
    soSgstAmt;
    soIgstAmt;
    soCessAmt;
    soTaxAmt;
    soFreightAmt;
    soLoadAmt;
    soUnloadAmt;
    soOtherAmt1;
    soOtherAmt2;
    soRoundOff;
    soOrderAmt;
    soTotalCost;
    soMarginAmt;
    soMarginAmtWot;
    soMarginPerc;
    soMarginPercWot;
    soMrpSavings;
    soMrpSavingsPerc;
    soAdvancePolicy;
    soAdvancePerc;
    soAdvanceRequired;
    soAdvanceDueDate;
    soIsAdvanceMandatory;
    soAdvanceLedgerId;
    soAdvanceRecdAmt;
    soAdvanceAdjustedAmt;
    soAdvanceRefundAmt;
    soAdvanceForfeitAmt;
    soAdvanceBalanceAmt;
    soAdvanceStatus;
    soAdvanceRecdOn;
    soPayMode;
    soSurchargeAmt;
    soTenderAmt;
    soRefundAmt;
    soPayStatus;
    soBilledAmt;
    soCancelledAmt;
    soPendingAmt;
    soFulfilStatus;
    soLastBilledOn;
    soCompletedOn;
    soPaymentTerms;
    soDeliveryTerms;
    soTermsConditions;
    soRemarks;
    soFreightCalcType;
    soLoadingCalcType;
    soDiscAlterBase;
    soRoundOffStep;
    soStatus;
    soVersionNo;
    soPrintCount;
    soIsDeleted;
    soSyncDate;
    soCreatedOn;
    soCreatedBy;
    soModifiedOn;
    soModifiedBy;
    items;
    charges;
    tenders;
}
exports.SaleOrderPayloadDto = SaleOrderPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'company.comp_name for soCompanyId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCompanyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Branch that TOOK the order' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'branch_master.br_name for soBranchId — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soBranchName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'fixed.device_master.dev_id — the billing point that raised this order',
    }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30, description: 'SALES_ORDER / BOOKING / CUSTOM_ORDER' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, description: 'CASH / CREDIT' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soOrderType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '1',
        nullable: true,
        description: 'BigInt serialized as string; allocated from the sales-order voucher sequence',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soOrderSlno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'sor00001',
        maxLength: 100,
        description: 'Printable order number generated from the sales-order voucher sequence',
    }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soOrderRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soOrderDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soOrderDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        format: 'date',
        description: 'The delivery date agreed with the customer',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soDeliveryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soDeliverySlot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 10, description: 'LOW / NORMAL / HIGH / URGENT' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soPriority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        format: 'date',
        description: 'An unclaimed booking lapses after this date',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soValidUntil", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 9, maxLength: 9, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSrcDocAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSrcDocDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 20,
        description: 'STORE_PICKUP / HOME_DELIVERY / SHIP_FROM_STORE / COURIER / TRANSPORT',
    }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soDeliveryMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        minLength: 2,
        maxLength: 2,
        nullable: true,
        description: 'Place of supply: decides CGST+SGST vs IGST',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soStateName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soContactPerson", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soContactPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 200,
        nullable: true,
        description: 'Ship-to, snapshotted separately from the billing address',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipLandmark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipLat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soShipLng", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soHasComm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soHasLoyalty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        nullable: true,
        description: 'employee_master.emp_name per soSalesmanId entry, in the same order — only populated on GET',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSalesmanName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soAgentCommPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soAgentCommAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soPackedId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Ordered LINES' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soTotItems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fully delivered LINES' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soDeliveredItems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soTotBags", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soBillSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAddlDisc1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAddlDisc2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soCashDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'POST-charge taxable value' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soOtherAmt1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soOtherAmt2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The order value' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soOrderAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Never printed; drives margin reports' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soMarginAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Margin without tax' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soMarginAmtWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soMarginPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soMarginPercWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 10, description: 'NONE / FIXED / PERC / FULL' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soAdvancePolicy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAdvancePerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAdvanceRequired", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soAdvanceDueDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soIsAdvanceMandatory", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Customer-advance liability ledger',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soAdvanceLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Roll-up cache from accounts.acc_tender_detail' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAdvanceRecdAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Advance set against invoices — stated by the caller' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAdvanceAdjustedAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Advance paid back — stated by the caller' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAdvanceRefundAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Advance kept on cancellation — stated by the caller' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAdvanceForfeitAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'What the company still HOLDS = received − adjusted − refunded − forfeited',
    }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soAdvanceBalanceAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 20,
        nullable: true,
        description: 'NONE / PENDING / PARTIAL / RECEIVED / ADJUSTED / REFUNDED / FORFEITED',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soAdvanceStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        format: 'date-time',
        description: 'First instalment received on',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soAdvanceRecdOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soPayMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soTenderAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soRefundAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, description: 'UNPAID / PARTIAL / PAID' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soPayStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fulfilment cache — sale_bill is the truth' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soBilledAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fulfilment cache' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soCancelledAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Fulfilment cache' }),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soPendingAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, description: 'PENDING / PARTIAL / COMPLETED / CANCELLED' }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soFulfilStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soLastBilledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time', description: 'Last line delivered' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soCompletedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soPaymentTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soDeliveryTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soTermsConditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'fixed' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soFreightCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'fixed' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soLoadingCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'true = discounts change the basis the charges are computed on',
    }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soRoundOffStep", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 20,
        description: 'DRAFT / CONFIRMED / PARTIAL / COMPLETED / CANCELLED / CLOSED / EXPIRED — the current ' +
            'state; the status TRAIL lives in public.txn_status_log',
    }),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soVersionNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SaleOrderPayloadDto.prototype, "soPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SaleOrderPayloadDto.prototype, "soIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SaleOrderPayloadDto.prototype, "soCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], SaleOrderPayloadDto.prototype, "soModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderItemPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], SaleOrderPayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderChargePayloadDto, isArray: true }),
    __metadata("design:type", Array)
], SaleOrderPayloadDto.prototype, "charges", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderTenderPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], SaleOrderPayloadDto.prototype, "tenders", void 0);
class SaleOrderDeleteResultDto {
    soId;
    deleted;
}
exports.SaleOrderDeleteResultDto = SaleOrderDeleteResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderDeleteResultDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleOrderDeleteResultDto.prototype, "deleted", void 0);
class SaleOrderSuccessSingleDto {
    success;
    message;
    data;
}
exports.SaleOrderSuccessSingleDto = SaleOrderSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleOrderSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Order fetched successfully' }),
    __metadata("design:type", String)
], SaleOrderSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: SaleOrderPayloadDto,
        description: 'Order record including its line items, applied charges and tendered amounts',
    }),
    __metadata("design:type", SaleOrderPayloadDto)
], SaleOrderSuccessSingleDto.prototype, "data", void 0);
class SaleOrderSuccessDeleteDto {
    success;
    message;
    data;
}
exports.SaleOrderSuccessDeleteDto = SaleOrderSuccessDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleOrderSuccessDeleteDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Order deleted successfully' }),
    __metadata("design:type", String)
], SaleOrderSuccessDeleteDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderDeleteResultDto }),
    __metadata("design:type", SaleOrderDeleteResultDto)
], SaleOrderSuccessDeleteDto.prototype, "data", void 0);
class SaleOrderPendingAmountResultDto {
    ablPendingAmount;
}
exports.SaleOrderPendingAmountResultDto = SaleOrderPendingAmountResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 5000,
        description: 'accounts.acc_bill_balance.abl_pending_amount summed over the live rows raised against the ' +
            'source document — for an order, the advance still held. 0 when the document has no bill row',
    }),
    __metadata("design:type", Number)
], SaleOrderPendingAmountResultDto.prototype, "ablPendingAmount", void 0);
class SaleOrderSuccessPendingAmountDto {
    success;
    message;
    data;
}
exports.SaleOrderSuccessPendingAmountDto = SaleOrderSuccessPendingAmountDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleOrderSuccessPendingAmountDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Pending amount fetched successfully' }),
    __metadata("design:type", String)
], SaleOrderSuccessPendingAmountDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderPendingAmountResultDto }),
    __metadata("design:type", SaleOrderPendingAmountResultDto)
], SaleOrderSuccessPendingAmountDto.prototype, "data", void 0);
class SaleOrderCancelledLineDto {
    soiId;
    soiLineNo;
    soiCancelledQty;
    soiLineStatus;
}
exports.SaleOrderCancelledLineDto = SaleOrderCancelledLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderCancelledLineDto.prototype, "soiId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SaleOrderCancelledLineDto.prototype, "soiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 8,
        description: 'Quantity this call moved out of pending, not the line running total',
    }),
    __metadata("design:type", Number)
], SaleOrderCancelledLineDto.prototype, "soiCancelledQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'PARTIAL',
        description: 'PARTIAL when the line had already delivered something, CANCELLED when it had not',
    }),
    __metadata("design:type", String)
], SaleOrderCancelledLineDto.prototype, "soiLineStatus", void 0);
class SaleOrderCancelLinesResultDto {
    soId;
    soAccYear;
    soStatus;
    soFulfilStatus;
    cancelledLines;
    cancelledQty;
    soCancelledAmt;
    soPendingAmt;
    lines;
}
exports.SaleOrderCancelLinesResultDto = SaleOrderCancelLinesResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], SaleOrderCancelLinesResultDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    __metadata("design:type", String)
], SaleOrderCancelLinesResultDto.prototype, "soAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PARTIAL' }),
    __metadata("design:type", String)
], SaleOrderCancelLinesResultDto.prototype, "soStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PARTIAL' }),
    __metadata("design:type", String)
], SaleOrderCancelLinesResultDto.prototype, "soFulfilStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Lines closed by this call; 0 on a repeat call' }),
    __metadata("design:type", Number)
], SaleOrderCancelLinesResultDto.prototype, "cancelledLines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 18, description: 'Total quantity cancelled by this call' }),
    __metadata("design:type", Number)
], SaleOrderCancelLinesResultDto.prototype, "cancelledQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1440.5, description: 'Header roll-up recomputed from the lines' }),
    __metadata("design:type", Number)
], SaleOrderCancelLinesResultDto.prototype, "soCancelledAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Header roll-up recomputed from the lines' }),
    __metadata("design:type", Number)
], SaleOrderCancelLinesResultDto.prototype, "soPendingAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderCancelledLineDto, isArray: true }),
    __metadata("design:type", Array)
], SaleOrderCancelLinesResultDto.prototype, "lines", void 0);
class SaleOrderSuccessCancelLinesDto {
    success;
    message;
    data;
}
exports.SaleOrderSuccessCancelLinesDto = SaleOrderSuccessCancelLinesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SaleOrderSuccessCancelLinesDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Order lines cancelled successfully' }),
    __metadata("design:type", String)
], SaleOrderSuccessCancelLinesDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: SaleOrderCancelLinesResultDto }),
    __metadata("design:type", SaleOrderCancelLinesResultDto)
], SaleOrderSuccessCancelLinesDto.prototype, "data", void 0);
//# sourceMappingURL=sale-order-response.dto.js.map