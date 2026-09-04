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
exports.SaveItemStockLedgerDto = exports.ItemStockBalanceRowDto = exports.ItemStockLedgerRowDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const item_stock_types_1 = require("../types/item-stock.types");
const dto_transforms_1 = require("../../../../common/dto/dto-transforms");
const toRequiredTrimmedString = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
};
const toRequiredNumber = (value) => {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return value;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
};
class ItemStockLedgerRowDto {
    stlId;
    stlAccYear;
    stlCompanyId;
    stlBranchId;
    stlGodownId;
    stlVoucherId;
    stlVoucherDate;
    stlLineNo;
    stlSplitNo;
    stlVoucherTypeId;
    stlTxnType;
    stlStockEffect;
    stlDocDate;
    stlPostedOn;
    stlDocRefNo;
    stlItemId;
    stlTrackingType;
    stlUomId;
    stlBaseUomId;
    stlConversionFactor;
    stlBatchId;
    stlBatchNo;
    stlMfgDate;
    stlExpiryDate;
    stlQty;
    stlBaseQty;
    stlFreeQty;
    stlFreeBaseQty;
    stlStockRate;
    stlStockValue;
    stlLandedCostRate;
    stlLandedCostValue;
    stlDocRateWot;
    stlDocAmountWot;
    stlNarration;
    stlIsActive;
    stlIsDeleted;
    stlSyncedOn;
    stlCreatedOn;
    stlCreatedBy;
}
exports.ItemStockLedgerRowDto = ItemStockLedgerRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalUuid)(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9 }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlGodownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlVoucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, format: 'date-time' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlVoucherDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlLineNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlSplitNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredNumber(value)),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlVoucherTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: item_stock_types_1.StockTxnType }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsEnum)(item_stock_types_1.StockTxnType),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlTxnType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Stock effect sign. Common values are 1 for inwards and -1 for outwards.',
    }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredNumber(value)),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlStockEffect", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, format: 'date-time' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlDocDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlPostedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 50 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlDocRefNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: item_stock_types_1.StockTrackingType, default: item_stock_types_1.StockTrackingType.NONE }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsEnum)(item_stock_types_1.StockTrackingType),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlTrackingType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlUomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockLedgerRowDto.prototype, "stlBaseUomId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlConversionFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlBatchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlBatchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlMfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlExpiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlFreeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlFreeBaseQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlStockRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlStockValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlLandedCostRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlLandedCostValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlDocRateWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockLedgerRowDto.prototype, "stlDocAmountWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlNarration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalBoolean)(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ItemStockLedgerRowDto.prototype, "stlIsActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalBoolean)(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ItemStockLedgerRowDto.prototype, "stlIsDeleted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlSyncedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", Object)
], ItemStockLedgerRowDto.prototype, "stlCreatedBy", void 0);
class ItemStockBalanceRowDto {
    isbId;
    isbAccYear;
    isbCompanyId;
    isbBranchId;
    isbGodownId;
    isbItemId;
    isbUnitId;
    isbTrackingType;
    isbStockBucket;
    isbOpeningQty;
    isbInQty;
    isbOutQty;
    isbClosingQty;
    isbOpeningFreeQty;
    isbFreeInQty;
    isbFreeOutQty;
    isbFreeClosingQty;
    isbReservedQty;
    isbTransitQty;
    isbAvailableQty;
    isbOpeningAvgRate;
    isbAvgStockRate;
    isbOpeningValue;
    isbStockValue;
    isbOpeningAvgRateWot;
    isbAvgStockRateWot;
    isbOpeningValueWot;
    isbStockValueWot;
    isbLastInDate;
    isbLastOutDate;
    isbSyncDate;
    isbCreatedOn;
    isbCreatedBy;
    isbUpdatedOn;
    isbUpdatedBy;
}
exports.ItemStockBalanceRowDto = ItemStockBalanceRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalUuid)(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 9 }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbCompanyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbGodownId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbUnitId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: item_stock_types_1.ItemStockBalanceTrackingType,
        default: item_stock_types_1.ItemStockBalanceTrackingType.NONE,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsEnum)(item_stock_types_1.ItemStockBalanceTrackingType),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbTrackingType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: item_stock_types_1.ItemStockBucket, default: item_stock_types_1.ItemStockBucket.SALEABLE }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toRequiredTrimmedString(value)),
    (0, class_validator_1.IsEnum)(item_stock_types_1.ItemStockBucket),
    __metadata("design:type", String)
], ItemStockBalanceRowDto.prototype, "isbStockBucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbOpeningQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbInQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbOutQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbClosingQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbOpeningFreeQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbFreeInQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbFreeOutQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbFreeClosingQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbReservedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbTransitQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbAvailableQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbOpeningAvgRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbAvgStockRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbOpeningValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbStockValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbOpeningAvgRateWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbAvgStockRateWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbOpeningValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalNumber)(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ItemStockBalanceRowDto.prototype, "isbStockValueWot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockBalanceRowDto.prototype, "isbLastInDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockBalanceRowDto.prototype, "isbLastOutDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockBalanceRowDto.prototype, "isbSyncDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockBalanceRowDto.prototype, "isbCreatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", Object)
], ItemStockBalanceRowDto.prototype, "isbCreatedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], ItemStockBalanceRowDto.prototype, "isbUpdatedOn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toNullableString)(value)),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null && value !== undefined),
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", Object)
], ItemStockBalanceRowDto.prototype, "isbUpdatedBy", void 0);
class SaveItemStockLedgerDto {
    itemStockLedger;
    itemStockBalance;
}
exports.SaveItemStockLedgerDto = SaveItemStockLedgerDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: ItemStockLedgerRowDto,
        isArray: true,
        description: 'Rows to insert or upsert into inventory.item_stock_ledger.',
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ItemStockLedgerRowDto),
    __metadata("design:type", Array)
], SaveItemStockLedgerDto.prototype, "itemStockLedger", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: ItemStockBalanceRowDto,
        isArray: true,
        description: 'Optional companion rows for inventory.item_stock_balance.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ItemStockBalanceRowDto),
    __metadata("design:type", Array)
], SaveItemStockLedgerDto.prototype, "itemStockBalance", void 0);
//# sourceMappingURL=save-item-stock-ledger.dto.js.map