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
exports.SRI_DATE_FIELDS = exports.SRI_OPTIONAL_FIELDS = exports.SaveSaleReturnItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const sales_dto_decorators_1 = require("../../posting/sales-dto.decorators");
class SaveSaleReturnItemDto {
    sriId;
    sriCompanyId;
    sriBranchId;
    sriTenantId;
    sriAccYear;
    sriLineNo;
    sriSplitNo;
    sriBillItemId;
    sriBillAccYear;
    sriBillLineNo;
    sriItemId;
    sriItemUnitId;
    sriToBaseFactor;
    sriHsnCode;
    sriTaxId;
    sriGodownId;
    sriLotId;
    sriBatchNo;
    sriBatchDate;
    sriExpiryDate;
    sriSerialNo;
    sriCondition;
    sriBucket;
    sriCaseQty;
    sriReturnQty;
    sriFreeQty;
    sriNetQty;
    sriWeightQty;
    sriRate;
    sriRatePreTax;
    sriMaxPrice;
    sriCostPrice;
    sriGrossAmt;
    sriDiscAmt;
    sriTaxableAmt;
    sriTaxPerc;
    sriCgstPerc;
    sriCgstAmt;
    sriSgstPerc;
    sriSgstAmt;
    sriIgstPerc;
    sriIgstAmt;
    sriCessPerc;
    sriCessAmt;
    sriTaxAmt;
    sriRoundOff;
    sriNetAmt;
    sriPriceLevel;
    sriEanCode;
    sriIsTaxIncl;
    sriIsPromo;
    sriIsFree;
    sriFreeType;
    sriIsService;
    sriActPrice;
    sriMinPrice;
    sriItemDiscPerc;
    sriItemDiscAmt;
    sriSplDiscPerc;
    sriSplDiscAmt;
    sriSchDiscPerc;
    sriSchDiscAmt;
    sriBillSchAmt;
    sriChrgBeforeTax;
    sriChrgAfterTax;
    sriCessPerUnit;
    sriSalesmanId;
    sriSchemeId;
    sriSchemeName;
    sriLoyaltyPoints;
    sriSize;
    sriSizeUom;
    sriRemarks;
    sriCreatedBy;
    sriModifiedBy;
}
exports.SaveSaleReturnItemDto = SaveSaleReturnItemDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'When provided, updates the existing line' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnItemDto.prototype, "sriId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriTenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSplitNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriBillItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriBillAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriBillLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnItemDto.prototype, "sriItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnItemDto.prototype, "sriItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(8),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriTaxId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveSaleReturnItemDto.prototype, "sriGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriLotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriBatchDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriExpiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSerialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCondition", void 0);
__decorate([
    (0, sales_dto_decorators_1.OptionalStockBucket)(),
    __metadata("design:type", String)
], SaveSaleReturnItemDto.prototype, "sriBucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriReturnQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriFreeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriRoundOff", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnItemDto.prototype, "sriIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnItemDto.prototype, "sriIsPromo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnItemDto.prototype, "sriIsFree", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriFreeType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveSaleReturnItemDto.prototype, "sriIsService", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriActPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriMinPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSplDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSplDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSchDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriBillSchAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriChrgBeforeTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriChrgAfterTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSalesmanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSchemeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 150, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(150),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSchemeName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriLoyaltyPoints", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriSizeUom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveSaleReturnItemDto.prototype, "sriModifiedBy", void 0);
exports.SRI_OPTIONAL_FIELDS = [
    'sriCompanyId',
    'sriBranchId',
    'sriTenantId',
    'sriAccYear',
    'sriLineNo',
    'sriSplitNo',
    'sriBillItemId',
    'sriBillAccYear',
    'sriBillLineNo',
    'sriToBaseFactor',
    'sriHsnCode',
    'sriTaxId',
    'sriLotId',
    'sriBatchNo',
    'sriBatchDate',
    'sriExpiryDate',
    'sriSerialNo',
    'sriCondition',
    'sriBucket',
    'sriCaseQty',
    'sriReturnQty',
    'sriFreeQty',
    'sriNetQty',
    'sriWeightQty',
    'sriRate',
    'sriRatePreTax',
    'sriMaxPrice',
    'sriCostPrice',
    'sriGrossAmt',
    'sriDiscAmt',
    'sriTaxableAmt',
    'sriTaxPerc',
    'sriCgstPerc',
    'sriCgstAmt',
    'sriSgstPerc',
    'sriSgstAmt',
    'sriIgstPerc',
    'sriIgstAmt',
    'sriCessPerc',
    'sriCessAmt',
    'sriTaxAmt',
    'sriRoundOff',
    'sriNetAmt',
    'sriPriceLevel',
    'sriEanCode',
    'sriIsTaxIncl',
    'sriIsPromo',
    'sriIsFree',
    'sriFreeType',
    'sriIsService',
    'sriActPrice',
    'sriMinPrice',
    'sriItemDiscPerc',
    'sriItemDiscAmt',
    'sriSplDiscPerc',
    'sriSplDiscAmt',
    'sriSchDiscPerc',
    'sriSchDiscAmt',
    'sriBillSchAmt',
    'sriChrgBeforeTax',
    'sriChrgAfterTax',
    'sriCessPerUnit',
    'sriSalesmanId',
    'sriSchemeId',
    'sriSchemeName',
    'sriLoyaltyPoints',
    'sriSize',
    'sriSizeUom',
    'sriRemarks',
    'sriCreatedBy',
    'sriModifiedBy',
];
exports.SRI_DATE_FIELDS = ['sriBatchDate', 'sriExpiryDate'];
//# sourceMappingURL=save-sale-return-item.dto.js.map