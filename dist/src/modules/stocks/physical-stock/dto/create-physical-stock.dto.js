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
exports.CreatePhysicalStockDto = exports.CreatePhysicalStockBatchDetailDto = exports.CreatePhysicalStockDetailDto = exports.CreatePhysicalStockHeaderDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_field_decorator_1 = require("../../../utils/dto-field.decorator");
const physical_stock_enums_1 = require("../types/physical-stock.enums");
const enum_constants_1 = require("../../../utils/enum.constants");
const transaction_enums_1 = require("../../../utils/transaction.enums");
class CreatePhysicalStockHeaderDto {
    psId;
    psAccYear;
    psCompanyId;
    psBranchId;
    psGodownId;
    psDocNo;
    psDocRefNo;
    psDocDate;
    psCountType;
    psCountedBy;
    psCountStartedOn;
    psCountCompletedOn;
    psStockCutoffAt;
    psFreezeStock;
    psFreezeFrom;
    psFreezeTo;
    psPostingMode;
    psRateSource;
    psAdjustmentVoucherId;
    psTotalLines;
    psTotalBookValue;
    psTotalCountedValue;
    psNetVarianceValue;
    psStatus;
    psApprovalRequired;
    psApprovedOn;
    psApprovedBy;
    psPostedOn;
    psPostedBy;
    psCancelledOn;
    psCancelledBy;
    psCancelReason;
    psDeviceType;
    psDeviceId;
    psCounterId;
    psSessionId;
    psRemarks;
    psIsActive;
    psIsDeleted;
    psSyncDate;
    psCreatedOn;
    psCreatedBy;
    psModifiedOn;
    psModifiedBy;
}
exports.CreatePhysicalStockHeaderDto = CreatePhysicalStockHeaderDto;
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)({
        description: 'When provided, request updates the document by physical stock header id',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredStringField)({
        maxLength: 9,
        example: '2026-2027',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psAccYear", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psCompanyId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psBranchId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psGodownId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalIntField)({
        example: 1001,
        min: 1,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockHeaderDto.prototype, "psDocNo", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 50,
        example: 'PHY-STK-1001',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockHeaderDto.prototype, "psDocRefNo", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date',
        example: '2026-05-07',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psDocDate", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(physical_stock_enums_1.PhysicalStockCountType, {
        default: physical_stock_enums_1.PhysicalStockCountType.FULL,
        example: physical_stock_enums_1.PhysicalStockCountType.FULL,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psCountType", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psCountedBy", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T10:30:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psCountStartedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:30:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psCountCompletedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T10:30:00.000Z',
        default: 'now()',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psStockCutoffAt", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: true,
        example: true,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockHeaderDto.prototype, "psFreezeStock", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T10:30:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psFreezeFrom", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:30:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psFreezeTo", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(physical_stock_enums_1.PhysicalStockPostingMode, {
        default: physical_stock_enums_1.PhysicalStockPostingMode.ADJUST_DIFFERENCE_ONLY,
        example: physical_stock_enums_1.PhysicalStockPostingMode.ADJUST_DIFFERENCE_ONLY,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psPostingMode", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(physical_stock_enums_1.PhysicalStockRateSource, {
        default: physical_stock_enums_1.PhysicalStockRateSource.AVG_COST,
        example: physical_stock_enums_1.PhysicalStockRateSource.AVG_COST,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psRateSource", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psAdjustmentVoucherId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalIntField)({
        default: 0,
        example: 10,
        min: 0,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockHeaderDto.prototype, "psTotalLines", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 12500.5,
        min: 0,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockHeaderDto.prototype, "psTotalBookValue", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 12300.75,
        min: 0,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockHeaderDto.prototype, "psTotalCountedValue", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -199.75,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockHeaderDto.prototype, "psNetVarianceValue", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(transaction_enums_1.TransactionStatus, {
        default: transaction_enums_1.TransactionStatus.DRAFT,
        example: transaction_enums_1.TransactionStatus.DRAFT,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psStatus", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: true,
        example: true,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockHeaderDto.prototype, "psApprovalRequired", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T10:30:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psApprovedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psApprovedBy", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T11:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psPostedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psPostedBy", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T11:30:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psCancelledOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psCancelledBy", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 250,
        example: 'Cancelled due to recount mismatch',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockHeaderDto.prototype, "psCancelReason", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(enum_constants_1.DeviceType, {
        default: enum_constants_1.DeviceType.WEB,
        example: enum_constants_1.DeviceType.WEB,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psDeviceType", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psDeviceId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 20,
        example: 'COUNTER-1',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockHeaderDto.prototype, "psCounterId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psSessionId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        example: 'Physical stock verified and adjusted',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockHeaderDto.prototype, "psRemarks", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: true,
        example: true,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockHeaderDto.prototype, "psIsActive", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: false,
        example: false,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockHeaderDto.prototype, "psIsDeleted", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psSyncDate", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T10:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psCreatedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psCreatedBy", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockHeaderDto.prototype, "psModifiedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockHeaderDto.prototype, "psModifiedBy", void 0);
class CreatePhysicalStockDetailDto {
    psdId;
    psdPscId;
    psdRowNo;
    psdAccYear;
    psdCompanyId;
    psdBranchId;
    psdGodownId;
    psdItemId;
    psdUnitId;
    psdBaseUnitId;
    psdToBaseFactor;
    psdBarcode;
    psdMrp;
    psdTrackingType;
    psdBookQty;
    psdBookBaseQty;
    psdPhysicalQty;
    psdPhysicalBaseQty;
    psdDiffQty;
    psdDiffBaseQty;
    psdStockRateWot;
    psdStockRateWithTax;
    psdBookValueWot;
    psdPhysicalValueWot;
    psdDiffValueWot;
    psdDiffValueWithTax;
    psdReasonId;
    psdResolution;
    psdNotes;
    psdIsPosted;
    psdIsActive;
    psdIsDeleted;
    psdSyncDate;
    psdCreatedOn;
    psdCreatedBy;
    psdModifiedOn;
    psdModifiedBy;
    batchDetails;
}
exports.CreatePhysicalStockDetailDto = CreatePhysicalStockDetailDto;
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)({
        description: 'When provided, request updates the physical stock detail row',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)({
        description: 'Physical stock header id',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdPscId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalIntField)({
        default: 1,
        example: 1,
        min: 1,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdRowNo", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredStringField)({
        maxLength: 9,
        example: '2026-2027',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdAccYear", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdCompanyId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdBranchId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdGodownId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdItemId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdUnitId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdBaseUnitId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 1,
        example: 1,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdToBaseFactor", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 100,
        example: '8901234567890',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockDetailDto.prototype, "psdBarcode", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 120.5,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdMrp", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(transaction_enums_1.StockTrackingType, {
        default: transaction_enums_1.StockTrackingType.NONE,
        example: transaction_enums_1.StockTrackingType.NONE,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdTrackingType", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 100,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdBookQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 100,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdBookBaseQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 95,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdPhysicalQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 95,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdPhysicalBaseQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -5,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdDiffQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -5,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdDiffBaseQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 85.5,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdStockRateWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 100.89,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdStockRateWithTax", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 8550,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdBookValueWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 8122.5,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdPhysicalValueWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -427.5,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdDiffValueWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -504.45,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockDetailDto.prototype, "psdDiffValueWithTax", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdReasonId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(physical_stock_enums_1.PhysicalStockResolution, {
        default: physical_stock_enums_1.PhysicalStockResolution.ADJUST_LOSS_GAIN,
        example: physical_stock_enums_1.PhysicalStockResolution.ADJUST_LOSS_GAIN,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdResolution", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        example: 'Stock shortage adjusted after physical verification',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockDetailDto.prototype, "psdNotes", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: false,
        example: false,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockDetailDto.prototype, "psdIsPosted", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: true,
        example: true,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockDetailDto.prototype, "psdIsActive", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: false,
        example: false,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockDetailDto.prototype, "psdIsDeleted", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockDetailDto.prototype, "psdSyncDate", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T10:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockDetailDto.prototype, "psdCreatedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdCreatedBy", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockDetailDto.prototype, "psdModifiedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockDetailDto.prototype, "psdModifiedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => CreatePhysicalStockBatchDetailDto,
        isArray: true,
        description: 'Batch, lot, MRP, or serial-level physical stock detail rows',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreatePhysicalStockBatchDetailDto),
    __metadata("design:type", Array)
], CreatePhysicalStockDetailDto.prototype, "batchDetails", void 0);
class CreatePhysicalStockBatchDetailDto {
    psbId;
    psbPsdId;
    psbRowNo;
    psbAccYear;
    psbCompanyId;
    psbBranchId;
    psbGodownId;
    psbItemId;
    psbUnitId;
    psbBaseUnitId;
    psbToBaseFactor;
    psbBatchId;
    psbBatchNo;
    psbMfgBatchNo;
    psbBatchDate;
    psbMfgDate;
    psbExpiryDate;
    psbMrp;
    psbBarcode;
    psbSerialNo;
    psbBookQty;
    psbBookBaseQty;
    psbPhysicalQty;
    psbPhysicalBaseQty;
    psbDiffQty;
    psbDiffBaseQty;
    psbStockRateWot;
    psbStockRateWithTax;
    psbBookValueWot;
    psbPhysicalValueWot;
    psbDiffValueWot;
    psbDiffValueWithTax;
    psbReasonId;
    psbResolution;
    psbNotes;
    psbIsPosted;
    psbIsActive;
    psbIsDeleted;
    psbSyncDate;
    psbCreatedOn;
    psbCreatedBy;
    psbModifiedOn;
    psbModifiedBy;
}
exports.CreatePhysicalStockBatchDetailDto = CreatePhysicalStockBatchDetailDto;
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)({
        description: 'When provided, request updates the physical stock batch detail row',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)({
        description: 'Physical stock detail parent id',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbPsdId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalIntField)({
        default: 1,
        example: 1,
        min: 1,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbRowNo", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredStringField)({
        maxLength: 9,
        example: '2026-2027',
    }),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbAccYear", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbCompanyId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBranchId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbGodownId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbItemId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbUnitId", void 0);
__decorate([
    (0, dto_field_decorator_1.RequiredUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBaseUnitId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 1,
        example: 1,
        min: 0.000001,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbToBaseFactor", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBatchId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 100,
        example: 'BATCH-001',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBatchNo", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 100,
        example: 'MFG-BATCH-001',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockBatchDetailDto.prototype, "psbMfgBatchNo", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date',
        example: '2026-05-07',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBatchDate", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date',
        example: '2026-05-01',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockBatchDetailDto.prototype, "psbMfgDate", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date',
        example: '2027-05-01',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockBatchDetailDto.prototype, "psbExpiryDate", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 120.5,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbMrp", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 100,
        example: '8901234567890',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBarcode", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        maxLength: 100,
        example: 'SN-001',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockBatchDetailDto.prototype, "psbSerialNo", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 100,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBookQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 100,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBookBaseQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 95,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbPhysicalQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 95,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbPhysicalBaseQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -5,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbDiffQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -5,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbDiffBaseQty", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 85.5,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbStockRateWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 100.89,
        min: 0,
        maxDecimalPlaces: 6,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbStockRateWithTax", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 8550,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbBookValueWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDecimalField)({
        default: 0,
        example: 8122.5,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbPhysicalValueWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -427.5,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbDiffValueWot", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalSignedDecimalField)({
        default: 0,
        example: -504.45,
    }),
    __metadata("design:type", Number)
], CreatePhysicalStockBatchDetailDto.prototype, "psbDiffValueWithTax", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbReasonId", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalEnumField)(physical_stock_enums_1.PhysicalStockResolution, {
        default: physical_stock_enums_1.PhysicalStockResolution.ADJUST_LOSS_GAIN,
        example: physical_stock_enums_1.PhysicalStockResolution.ADJUST_LOSS_GAIN,
    }),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbResolution", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalStringField)({
        example: 'Batch stock shortage adjusted after physical verification',
    }),
    __metadata("design:type", Object)
], CreatePhysicalStockBatchDetailDto.prototype, "psbNotes", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: false,
        example: false,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockBatchDetailDto.prototype, "psbIsPosted", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: true,
        example: true,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockBatchDetailDto.prototype, "psbIsActive", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalBooleanField)({
        default: false,
        example: false,
    }),
    __metadata("design:type", Boolean)
], CreatePhysicalStockBatchDetailDto.prototype, "psbIsDeleted", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockBatchDetailDto.prototype, "psbSyncDate", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T10:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockBatchDetailDto.prototype, "psbCreatedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbCreatedBy", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalDateField)({
        format: 'date-time',
        example: '2026-05-07T12:00:00.000Z',
    }),
    __metadata("design:type", Date)
], CreatePhysicalStockBatchDetailDto.prototype, "psbModifiedOn", void 0);
__decorate([
    (0, dto_field_decorator_1.OptionalUuidField)(),
    __metadata("design:type", String)
], CreatePhysicalStockBatchDetailDto.prototype, "psbModifiedBy", void 0);
class CreatePhysicalStockDto extends CreatePhysicalStockHeaderDto {
    details;
}
exports.CreatePhysicalStockDto = CreatePhysicalStockDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => CreatePhysicalStockDetailDto,
        isArray: true,
        description: 'Item-level physical stock detail rows',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreatePhysicalStockDetailDto),
    __metadata("design:type", Array)
], CreatePhysicalStockDto.prototype, "details", void 0);
//# sourceMappingURL=create-physical-stock.dto.js.map