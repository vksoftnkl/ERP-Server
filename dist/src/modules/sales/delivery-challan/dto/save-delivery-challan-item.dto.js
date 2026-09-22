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
exports.SDI_DATE_FIELDS = exports.SDI_OPTIONAL_FIELDS = exports.SaveDeliveryChallanItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveDeliveryChallanItemDto {
    sdiId;
    sdiCompanyId;
    sdiBranchId;
    sdiTenantId;
    sdiAccYear;
    sdiLineNo;
    sdiSplitNo;
    sdiSrcDocType;
    sdiSrcDocId;
    sdiSrcDocAccYear;
    sdiSrcDocRefno;
    sdiSrcLineNo;
    sdiSrcItemId;
    sdiItemId;
    sdiItemUnitId;
    sdiToBaseFactor;
    sdiHsnCode;
    sdiTaxId;
    sdiPriceLevel;
    sdiEanCode;
    sdiSize;
    sdiSizeUom;
    sdiGodownId;
    sdiLotId;
    sdiBucket;
    sdiBatchNo;
    sdiBatchDate;
    sdiExpiryDate;
    sdiSerialNo;
    sdiIsFree;
    sdiFreeType;
    sdiIsService;
    sdiCaseQty;
    sdiDcQty;
    sdiFreeQty;
    sdiNetQty;
    sdiWeightQty;
    sdiBilledQty;
    sdiReturnedQty;
    sdiOpenQty;
    sdiLineStatus;
    sdiRate;
    sdiRatePreTax;
    sdiMaxPrice;
    sdiCostPrice;
    sdiIsTaxIncl;
    sdiDiscPerc;
    sdiDiscAmt;
    sdiGrossAmt;
    sdiTaxableAmt;
    sdiTaxPerc;
    sdiCgstPerc;
    sdiCgstAmt;
    sdiSgstPerc;
    sdiSgstAmt;
    sdiIgstPerc;
    sdiIgstAmt;
    sdiCessPerc;
    sdiCessAmt;
    sdiTaxAmt;
    sdiNetAmt;
    sdiIsPromo;
    sdiActPrice;
    sdiMinPrice;
    sdiItemDiscPerc;
    sdiItemDiscAmt;
    sdiSplDiscPerc;
    sdiSplDiscAmt;
    sdiSchDiscPerc;
    sdiSchDiscAmt;
    sdiChrgBeforeTax;
    sdiChrgAfterTax;
    sdiCessPerUnit;
    sdiSalesmanId;
    sdiSchemeId;
    sdiSchemeName;
    sdiRemarks;
    sdiCreatedBy;
    sdiModifiedBy;
}
exports.SaveDeliveryChallanItemDto = SaveDeliveryChallanItemDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'When provided, updates the existing line' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanItemDto.prototype, "sdiId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiTenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSplitNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 30, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(30),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSrcDocType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSrcDocId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSrcDocAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSrcDocRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSrcLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSrcItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanItemDto.prototype, "sdiItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanItemDto.prototype, "sdiItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(8),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiTaxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSizeUom", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDeliveryChallanItemDto.prototype, "sdiGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiLotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiBucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiBatchDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiExpiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSerialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanItemDto.prototype, "sdiIsFree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiFreeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanItemDto.prototype, "sdiIsService", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiDcQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiFreeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiBilledQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiReturnedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, readOnly: true, description: 'Ignored — server-owned' }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiOpenQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 20,
        nullable: true,
        readOnly: true,
        description: 'Ignored — server-owned',
    }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiLineStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanItemDto.prototype, "sdiIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDeliveryChallanItemDto.prototype, "sdiIsPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiActPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiMinPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSplDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSplDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSchDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiChrgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiChrgAfterTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSchemeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiSchemeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDeliveryChallanItemDto.prototype, "sdiModifiedBy", void 0);
exports.SDI_OPTIONAL_FIELDS = [
    'sdiCompanyId',
    'sdiBranchId',
    'sdiTenantId',
    'sdiAccYear',
    'sdiLineNo',
    'sdiSplitNo',
    'sdiSrcDocType',
    'sdiSrcDocId',
    'sdiSrcDocAccYear',
    'sdiSrcDocRefno',
    'sdiSrcLineNo',
    'sdiSrcItemId',
    'sdiToBaseFactor',
    'sdiHsnCode',
    'sdiTaxId',
    'sdiPriceLevel',
    'sdiEanCode',
    'sdiSize',
    'sdiSizeUom',
    'sdiLotId',
    'sdiBucket',
    'sdiBatchNo',
    'sdiBatchDate',
    'sdiExpiryDate',
    'sdiSerialNo',
    'sdiIsFree',
    'sdiFreeType',
    'sdiIsService',
    'sdiCaseQty',
    'sdiDcQty',
    'sdiFreeQty',
    'sdiNetQty',
    'sdiWeightQty',
    'sdiRate',
    'sdiRatePreTax',
    'sdiMaxPrice',
    'sdiCostPrice',
    'sdiIsTaxIncl',
    'sdiDiscPerc',
    'sdiDiscAmt',
    'sdiGrossAmt',
    'sdiTaxableAmt',
    'sdiTaxPerc',
    'sdiCgstPerc',
    'sdiCgstAmt',
    'sdiSgstPerc',
    'sdiSgstAmt',
    'sdiIgstPerc',
    'sdiIgstAmt',
    'sdiCessPerc',
    'sdiCessAmt',
    'sdiTaxAmt',
    'sdiNetAmt',
    'sdiIsPromo',
    'sdiActPrice',
    'sdiMinPrice',
    'sdiItemDiscPerc',
    'sdiItemDiscAmt',
    'sdiSplDiscPerc',
    'sdiSplDiscAmt',
    'sdiSchDiscPerc',
    'sdiSchDiscAmt',
    'sdiChrgBeforeTax',
    'sdiChrgAfterTax',
    'sdiCessPerUnit',
    'sdiSalesmanId',
    'sdiSchemeId',
    'sdiSchemeName',
    'sdiRemarks',
    'sdiCreatedBy',
    'sdiModifiedBy',
];
exports.SDI_DATE_FIELDS = ['sdiBatchDate', 'sdiExpiryDate'];
//# sourceMappingURL=save-delivery-challan-item.dto.js.map