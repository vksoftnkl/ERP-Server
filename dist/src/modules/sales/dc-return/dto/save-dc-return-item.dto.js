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
exports.SDRI_DATE_FIELDS = exports.SDRI_OPTIONAL_FIELDS = exports.SaveDcReturnItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
class SaveDcReturnItemDto {
    sdriId;
    sdriCompanyId;
    sdriBranchId;
    sdriTenantId;
    sdriAccYear;
    sdriLineNo;
    sdriDcItemId;
    sdriDcAccYear;
    sdriDcLineNo;
    sdriItemId;
    sdriItemUnitId;
    sdriToBaseFactor;
    sdriHsnCode;
    sdriGodownId;
    sdriLotId;
    sdriCondition;
    sdriBucket;
    sdriBatchNo;
    sdriExpiryDate;
    sdriSerialNo;
    sdriReturnQty;
    sdriFreeQty;
    sdriNetQty;
    sdriWeightQty;
    sdriRate;
    sdriCostPrice;
    sdriTaxableAmt;
    sdriTaxPerc;
    sdriTaxAmt;
    sdriNetAmt;
    sdriPriceLevel;
    sdriEanCode;
    sdriIsTaxIncl;
    sdriIsService;
    sdriRatePreTax;
    sdriMaxPrice;
    sdriItemDiscPerc;
    sdriItemDiscAmt;
    sdriSchDiscAmt;
    sdriGrossAmt;
    sdriCgstPerc;
    sdriCgstAmt;
    sdriSgstPerc;
    sdriSgstAmt;
    sdriIgstPerc;
    sdriIgstAmt;
    sdriCessPerc;
    sdriCessPerUnit;
    sdriCessAmt;
    sdriSize;
    sdriSizeUom;
    sdriTaxId;
    sdriRemarks;
    sdriCreatedBy;
    sdriModifiedBy;
}
exports.SaveDcReturnItemDto = SaveDcReturnItemDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'When provided, updates the existing line' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveDcReturnItemDto.prototype, "sdriId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriBranchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriTenantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnItemDto.prototype, "sdriDcItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 9, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(9),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriDcAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriDcLineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnItemDto.prototype, "sdriItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnItemDto.prototype, "sdriItemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriToBaseFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 8, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(8),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriHsnCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveDcReturnItemDto.prototype, "sdriGodownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriLotId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCondition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriBucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriExpiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriSerialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriReturnQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriFreeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriNetQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriWeightQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCostPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriTaxableAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriTaxPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriTaxAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriNetAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableInteger)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriPriceLevel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(100),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriEanCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDcReturnItemDto.prototype, "sdriIsTaxIncl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], SaveDcReturnItemDto.prototype, "sdriIsService", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriRatePreTax", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriMaxPrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriItemDiscPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriItemDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriSchDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriGrossAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriSgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriSgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriIgstPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriIgstAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCessPerc", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, dtoDecorators_1.NullableNumber)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCessAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 20, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(20),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriSizeUom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriTaxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(250),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriRemarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 50, nullable: true }),
    (0, dtoDecorators_1.NullableStringStrict)(50),
    __metadata("design:type", Object)
], SaveDcReturnItemDto.prototype, "sdriModifiedBy", void 0);
exports.SDRI_OPTIONAL_FIELDS = [
    'sdriCompanyId',
    'sdriBranchId',
    'sdriTenantId',
    'sdriAccYear',
    'sdriLineNo',
    'sdriDcAccYear',
    'sdriDcLineNo',
    'sdriToBaseFactor',
    'sdriHsnCode',
    'sdriLotId',
    'sdriCondition',
    'sdriBucket',
    'sdriBatchNo',
    'sdriExpiryDate',
    'sdriSerialNo',
    'sdriReturnQty',
    'sdriFreeQty',
    'sdriNetQty',
    'sdriWeightQty',
    'sdriRate',
    'sdriCostPrice',
    'sdriTaxableAmt',
    'sdriTaxPerc',
    'sdriTaxAmt',
    'sdriNetAmt',
    'sdriPriceLevel',
    'sdriEanCode',
    'sdriIsTaxIncl',
    'sdriIsService',
    'sdriRatePreTax',
    'sdriMaxPrice',
    'sdriItemDiscPerc',
    'sdriItemDiscAmt',
    'sdriSchDiscAmt',
    'sdriGrossAmt',
    'sdriCgstPerc',
    'sdriCgstAmt',
    'sdriSgstPerc',
    'sdriSgstAmt',
    'sdriIgstPerc',
    'sdriIgstAmt',
    'sdriCessPerc',
    'sdriCessPerUnit',
    'sdriCessAmt',
    'sdriSize',
    'sdriSizeUom',
    'sdriTaxId',
    'sdriRemarks',
    'sdriCreatedBy',
    'sdriModifiedBy',
];
exports.SDRI_DATE_FIELDS = ['sdriExpiryDate'];
//# sourceMappingURL=save-dc-return-item.dto.js.map