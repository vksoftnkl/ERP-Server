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
exports.BillSuccessCancelDto = exports.BillSuccessSingleDto = exports.BillCancelResultDto = exports.BillCancelledOrderDto = exports.BillCancelledLineDto = exports.BillPayloadDto = exports.BillItemPayloadDto = exports.BillErrorResponseDto = exports.BillErrorFieldDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const charge_detail_response_dto_1 = require("../../../master/charge-detail/dto/charge-detail-response.dto");
const tender_detail_response_dto_1 = require("../../../accountsModule/tenderDetail/dto/tender-detail-response.dto");
class BillErrorFieldDto {
    field;
    message;
}
exports.BillErrorFieldDto = BillErrorFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sbCustId' }),
    __metadata("design:type", String)
], BillErrorFieldDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sbCustId is required' }),
    __metadata("design:type", String)
], BillErrorFieldDto.prototype, "message", void 0);
class BillErrorResponseDto {
    success;
    message;
    errors;
}
exports.BillErrorResponseDto = BillErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], BillErrorResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Validation failed' }),
    __metadata("design:type", String)
], BillErrorResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BillErrorFieldDto, isArray: true }),
    __metadata("design:type", Array)
], BillErrorResponseDto.prototype, "errors", void 0);
class BillItemPayloadDto {
    sbiId;
    sbiBillId;
    sbiCompanyId;
    sbiBranchId;
    sbiTenantId;
    sbiAccYear;
    sbiLineNo;
    sbiSplitNo;
    sbiSrcDocType;
    sbiSrcDocId;
    sbiSrcDocYear;
    sbiSrcDocRefno;
    sbiSrcDocLineNo;
    sbiSrcItemQty;
    sbiSrcFreeQty;
    sbiItemId;
    sbiItemName;
    sbiItemUnitId;
    sbiUnitName;
    sbiDecimalCount;
    sbiGroupId;
    sbiBrandId;
    sbiSectionId;
    sbiCategoryId;
    sbiToBaseFactor;
    sbiHsnCode;
    sbiPriceLevel;
    sbiEanCode;
    sbiSize;
    sbiSizeUom;
    sbiGodownId;
    sbiGodownName;
    sbiStockId;
    sbiBatchNo;
    sbiBatchDate;
    sbiExpiryDate;
    sbiSerialNo;
    sbiIsTaxIncl;
    sbiIsPromo;
    sbiIsFree;
    sbiFreeType;
    sbiIsService;
    sbiHasFreight;
    sbiCaseQty;
    sbiBillQty;
    sbiLengthQty;
    sbiNetQty;
    sbiWeightQty;
    sbiAvailableStock;
    sbiReturnQty;
    sbiRate;
    sbiRatePreTax;
    sbiRateDiff;
    sbiActPrice;
    sbiMaxPrice;
    sbiMinPrice;
    sbiCostPrice;
    sbiCostPreTax;
    sbiItemDiscPerc;
    sbiItemDiscQty;
    sbiItemDiscAmt;
    sbiSplDiscPerc;
    sbiSplDiscQty;
    sbiSplDiscAmt;
    sbiSchDiscPerc;
    sbiSchDiscQty;
    sbiSchDiscAmt;
    sbiBillSchPerc;
    sbiBillSchQty;
    sbiBillSchAmt;
    sbiAddlDisc1Perc;
    sbiAddlDisc1Amt;
    sbiAddlDisc2Perc;
    sbiAddlDisc2Amt;
    sbiCashDiscPerc;
    sbiCashDiscAmt;
    sbiGrossAmt;
    sbiNetGross;
    sbiChrgBeforeTax;
    sbiChrgAfterTax;
    sbiTaxableAmt;
    sbiTaxPerc;
    sbiTaxAmt;
    sbiCgstPerc;
    sbiCgstAmt;
    sbiSgstPerc;
    sbiSgstAmt;
    sbiIgstPerc;
    sbiIgstAmt;
    sbiCessPerc;
    sbiCessPerUnit;
    sbiCessAmt;
    sbiAcessPerc;
    sbiAcessPerUnit;
    sbiAcessAmt;
    sbiBatchConfig;
    sbiFreightQty;
    sbiFreightAmt;
    sbiLoadQty;
    sbiLoadAmt;
    sbiUnloadQty;
    sbiUnloadAmt;
    sbiRoundOff;
    sbiNetAmt;
    sbiSoldPrice;
    sbiSoldPreTax;
    sbiItemProfit;
    sbiProfitPreTax;
    sbiMrpSavings;
    sbiMrpSavingsPerc;
    sbiSalesmanId;
    sbiSchemeId;
    sbiSchemeName;
    sbiRemarks;
    sbiIsDeleted;
    sbiSyncDate;
    sbiCreatedOn;
    sbiCreatedBy;
    sbiModifiedOn;
    sbiModifiedBy;
}
exports.BillItemPayloadDto = BillItemPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiBillId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ default: 1 }),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSplitNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 9, maxLength: 9, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSrcDocYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSrcDocLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSrcItemQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSrcFreeQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_master.itemNameEn for sbiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiItemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
    }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_unit_master.unit_name reached via item_unit_conversion — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiUnitName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'item_unit_master.unit_decimal_count reached via item_unit_conversion — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiDecimalCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_group_id for sbiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiGroupId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_brand_id for sbiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiBrandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_section_id for sbiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSectionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'item_master.item_category_id for sbiItemId — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Snapshot of item_unit_conversion.iucToBaseFactor for sbiItemUnitId',
    }),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 50,
        nullable: true,
        description: 'Free-text dimension the operator typed, stored verbatim',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSizeUom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The inventory godown the stock was taken from' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'godown_locations.gdl_name for sbiGodownId — only populated on GET',
    }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiGodownName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The inventory batch/stock row allocated' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiStockId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiBatchDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiExpiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSerialNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillItemPayloadDto.prototype, "sbiIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillItemPayloadDto.prototype, "sbiIsPromo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillItemPayloadDto.prototype, "sbiIsFree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiFreeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillItemPayloadDto.prototype, "sbiIsService", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillItemPayloadDto.prototype, "sbiHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCaseQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiBillQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiLengthQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAvailableStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cache mirrored from sale_return' }),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiReturnQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiRateDiff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiActPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'MRP' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiMinPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiCostPreTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiItemDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSplDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSplDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSplDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSchDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSchDiscQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiBillSchPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiBillSchQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiBillSchAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAddlDisc1Perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAddlDisc1Amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAddlDisc2Perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAddlDisc2Amt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCashDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCashDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line net/gross basis the charges sit on' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiNetGross", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing before tax' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiChrgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Line charges landing after tax' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiChrgAfterTax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAcessPerc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAcessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiAcessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "The item's batch configuration, snapshotted onto the line" }),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiBatchConfig", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiFreightQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiLoadQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiUnloadQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillItemPayloadDto.prototype, "sbiNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSoldPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSoldPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiItemProfit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiProfitPreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSchemeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSchemeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiRemarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillItemPayloadDto.prototype, "sbiIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillItemPayloadDto.prototype, "sbiCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillItemPayloadDto.prototype, "sbiModifiedBy", void 0);
class BillPayloadDto {
    sbId;
    sbCompanyId;
    sbBranchId;
    sbTenantId;
    sbAccYear;
    sbSessionId;
    sbCounterId;
    sbDeviceType;
    sbDeviceId;
    sbDocType;
    sbBillType;
    sbCategoryId;
    sbPriceLevel;
    sbBillSlno;
    sbBillRefno;
    sbUsrRefno;
    sbBillDate;
    sbBillDatetime;
    sbDueDays;
    sbDueDate;
    sbSrcDocType;
    sbSrcDocId;
    sbSrcDocRefno;
    sbSrcDocDate;
    sbSrcDocYear;
    sbCustId;
    sbCustName;
    sbCustAddr;
    sbCustPlace;
    sbCustPin;
    sbCustPhone;
    sbCustGstin;
    sbCustGstType;
    sbCustStcd;
    sbPosStcd;
    sbStateName;
    sbHasLoad;
    sbHasUnload;
    sbHasFreight;
    sbHasPromo;
    sbHasComm;
    sbHasLoyalty;
    sbUserId;
    sbSalesmanId;
    sbAgentId;
    sbAgentCommPerc;
    sbAgentCommAmt;
    sbDriverId;
    sbLoadmanId;
    sbPackedId;
    sbSupervisorId;
    sbVehicleId;
    sbVehicleNo;
    sbTotItems;
    sbTotWeight;
    sbTotBags;
    sbGrossAmt;
    sbItemDisc;
    sbSplDisc;
    sbSchDisc;
    sbBillSchDisc;
    sbAddlDisc1;
    sbAddlDisc2;
    sbCashDisc;
    sbTaxableAmt;
    sbCgstAmt;
    sbSgstAmt;
    sbIgstAmt;
    sbCessAmt;
    sbTaxAmt;
    sbFreightAmt;
    sbLoadAmt;
    sbUnloadAmt;
    sbOtherAmt1;
    sbOtherAmt2;
    sbRoundOff;
    sbBillAmt;
    sbTotalCost;
    sbMarginAmt;
    sbMarginAmtWot;
    sbMarginPerc;
    sbMrpSavings;
    sbMrpSavingsPerc;
    sbPayMode;
    sbCreditAmt;
    sbSurchargeAmt;
    sbTenderAmt;
    sbRefundAmt;
    sbAdvanceAmt;
    sbPaidAmt;
    sbBalanceAmt;
    sbPayStatus;
    sbReturnedAmt;
    sbReturnStatus;
    sbPaymentTerms;
    sbDeliveryTerms;
    sbTermsConditions;
    sbRemarks;
    sbFreightCalcType;
    sbLoadingCalcType;
    sbDiscAlterBase;
    sbRoundOffStep;
    sbStatus;
    sbPostedOn;
    sbPostedVoucherId;
    sbApprovedOn;
    sbApprovedBy;
    sbCancelledOn;
    sbCancelledBy;
    sbCancelReason;
    sbVersionNo;
    sbPrintCount;
    sbIsDeleted;
    sbSyncDate;
    sbCreatedOn;
    sbCreatedBy;
    sbModifiedOn;
    sbModifiedBy;
    items;
    charges;
    tenders;
}
exports.BillPayloadDto = BillPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbTenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'The counter/device that raised this document' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbCounterId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbDeviceType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbDeviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30 }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbDocType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbBillType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCategoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '1',
        nullable: true,
        description: 'BigInt serialized as string; allocated from the bill voucher sequence',
    }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbBillSlno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'bil00001',
        maxLength: 100,
        nullable: true,
        description: 'Printable bill number generated from the bill voucher sequence',
    }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbBillRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbUsrRefno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbBillDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbBillDatetime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbDueDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbDueDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSrcDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true, example: '2026-2027' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSrcDocYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbCustId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200 }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbCustName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCustAddr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCustPlace", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 10, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCustPin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCustPhone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 15, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCustGstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCustGstType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCustStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 2, maxLength: 2, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbPosStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbStateName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillPayloadDto.prototype, "sbHasLoad", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillPayloadDto.prototype, "sbHasUnload", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillPayloadDto.prototype, "sbHasFreight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillPayloadDto.prototype, "sbHasPromo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillPayloadDto.prototype, "sbHasComm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillPayloadDto.prototype, "sbHasLoyalty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbAgentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbAgentCommPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbAgentCommAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbDriverId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbLoadmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbPackedId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSupervisorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbVehicleId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbVehicleNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Printed LINES, not split rows' }),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbTotItems", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbTotWeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbTotBags", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbItemDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbSplDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbBillSchDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbAddlDisc1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbAddlDisc2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbCashDisc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'POST-charge taxable value' }),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbFreightAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbLoadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbUnloadAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbOtherAmt1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbOtherAmt2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbBillAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbTotalCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbMarginAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, description: 'Margin without tax' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbMarginAmtWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbMarginPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbMrpSavings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbMrpSavingsPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbPayMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbCreditAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbSurchargeAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbTenderAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbRefundAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbAdvanceAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbPaidAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbBalanceAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbPayStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cache mirrored from sale_return' }),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbReturnedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbReturnStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbPaymentTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbDeliveryTerms", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbTermsConditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the freight charge is computed, lower case',
    }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbFreightCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: 'fixed',
        description: 'How the loading charge is computed, lower case',
    }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbLoadingCalcType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        description: 'true = discounts change the basis the charges are computed on',
    }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbDiscAlterBase", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbRoundOffStep", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20 }),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbPostedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'accounts.acc_voucher_header',
    }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbPostedVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbApprovedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbApprovedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCancelledBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbCancelReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbVersionNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillPayloadDto.prototype, "sbPrintCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], BillPayloadDto.prototype, "sbIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillPayloadDto.prototype, "sbCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, format: 'date-time' }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbModifiedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], BillPayloadDto.prototype, "sbModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BillItemPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], BillPayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: charge_detail_response_dto_1.ChargeDetailPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], BillPayloadDto.prototype, "charges", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: tender_detail_response_dto_1.TenderDetailPayloadDto, isArray: true }),
    __metadata("design:type", Array)
], BillPayloadDto.prototype, "tenders", void 0);
class BillCancelledLineDto {
    soiId;
    soiLineNo;
    soiCancelledQty;
    soiLineStatus;
}
exports.BillCancelledLineDto = BillCancelledLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillCancelledLineDto.prototype, "soiId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillCancelledLineDto.prototype, "soiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The quantity THIS call moved into soi_cancelled_qty' }),
    __metadata("design:type", Number)
], BillCancelledLineDto.prototype, "soiCancelledQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        maxLength: 20,
        description: 'Read back off the row: soi_line_status is a GENERATED column',
    }),
    __metadata("design:type", String)
], BillCancelledLineDto.prototype, "soiLineStatus", void 0);
class BillCancelledOrderDto {
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
exports.BillCancelledOrderDto = BillCancelledOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillCancelledOrderDto.prototype, "soId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 9, maxLength: 9 }),
    __metadata("design:type", String)
], BillCancelledOrderDto.prototype, "soAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: 'CANCELLED' }),
    __metadata("design:type", String)
], BillCancelledOrderDto.prototype, "soStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 20, example: 'CANCELLED' }),
    __metadata("design:type", String)
], BillCancelledOrderDto.prototype, "soFulfilStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Lines this call closed out; 0 on a repeat call' }),
    __metadata("design:type", Number)
], BillCancelledOrderDto.prototype, "cancelledLines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total quantity this call wrote off' }),
    __metadata("design:type", Number)
], BillCancelledOrderDto.prototype, "cancelledQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillCancelledOrderDto.prototype, "soCancelledAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillCancelledOrderDto.prototype, "soPendingAmt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BillCancelledLineDto, isArray: true }),
    __metadata("design:type", Array)
], BillCancelledOrderDto.prototype, "lines", void 0);
class BillCancelResultDto {
    sbId;
    cancelled;
    remarks;
    username;
    cancelledOn;
    orders;
}
exports.BillCancelResultDto = BillCancelResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], BillCancelResultDto.prototype, "sbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BillCancelResultDto.prototype, "cancelled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250 }),
    __metadata("design:type", String)
], BillCancelResultDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 50 }),
    __metadata("design:type", String)
], BillCancelResultDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date-time' }),
    __metadata("design:type", String)
], BillCancelResultDto.prototype, "cancelledOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: BillCancelledOrderDto,
        isArray: true,
        description: 'One entry per sale order this bill referenced',
    }),
    __metadata("design:type", Array)
], BillCancelResultDto.prototype, "orders", void 0);
class BillSuccessSingleDto {
    success;
    message;
    data;
}
exports.BillSuccessSingleDto = BillSuccessSingleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BillSuccessSingleDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bill fetched successfully' }),
    __metadata("design:type", String)
], BillSuccessSingleDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        type: BillPayloadDto,
        description: 'Bill record including its line items and applied charges',
    }),
    __metadata("design:type", BillPayloadDto)
], BillSuccessSingleDto.prototype, "data", void 0);
class BillSuccessCancelDto {
    success;
    message;
    data;
}
exports.BillSuccessCancelDto = BillSuccessCancelDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BillSuccessCancelDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sale order cancelled successfully' }),
    __metadata("design:type", String)
], BillSuccessCancelDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BillCancelResultDto }),
    __metadata("design:type", BillCancelResultDto)
], BillSuccessCancelDto.prototype, "data", void 0);
//# sourceMappingURL=bill-response.dto.js.map