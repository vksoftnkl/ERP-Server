import {
  OptionalBooleanField,
  OptionalDateField,
  OptionalDecimalField,
  OptionalEnumField,
  OptionalIntField,
  OptionalSignedDecimalField,
  OptionalStringField,
  OptionalUuidField,
  RequiredStringField,
  RequiredUuidField,
} from 'src/modules/utils/dto-field.decorator';

import {
  PhysicalStockCountType,
  PhysicalStockPostingMode,
  PhysicalStockRateSource,
} from '../types/physical-stock.enums';

import {
  StockTrackingType,
} from 'src/modules/utils/transaction.enums';

import {
  PhysicalStockResolution,
} from '../types/physical-stock.enums';

import { TransactionStatus } from 'src/modules/utils/transaction.enums';
import { DeviceType } from 'src/modules/utils/enum.constants';
import { Req } from '@nestjs/common';

export class CreatePhysicalStockHeaderDto {
  @OptionalUuidField({
    description: 'When provided, request updates the document by physical stock header id',
  })
  psId?: string;

  @RequiredStringField({
    maxLength: 9,
    example: '2026-2027',
  })
  psAccYear!: string;

  @RequiredUuidField()
  psCompanyId!: string;

  @RequiredUuidField()
  psBranchId!: string;

  @RequiredUuidField()
  psGodownId!: string;

  @OptionalIntField({
    example: 1001,
    min: 1,
  })
  psDocNo?: number;

  @OptionalStringField({
    maxLength: 50,
    example: 'PHY-STK-1001',
  })
  psDocRefNo?: string | null;

  @OptionalDateField({
    format: 'date',
    example: '2026-05-07',
  })
  psDocDate?: Date;

  @OptionalEnumField(PhysicalStockCountType, {
    default: PhysicalStockCountType.FULL,
    example: PhysicalStockCountType.FULL,
  })
  psCountType?: PhysicalStockCountType;

  @OptionalUuidField()
  psCountedBy?: string;

  @OptionalDateField({
    format: 'date-time',
    example: '2026-05-07T10:30:00.000Z',
  })
  psCountStartedOn?: Date;

  @OptionalDateField({
    format: 'date-time',
    example: '2026-05-07T12:30:00.000Z',
  })
  psCountCompletedOn?: Date;

  @OptionalDateField({
    format: 'date-time',
    example: '2026-05-07T10:30:00.000Z',
    default: 'now()',
  })
  psStockCutoffAt?: Date;

  @OptionalBooleanField({
    default: true,
    example: true,
  })
  psFreezeStock?: boolean;

  @OptionalDateField({
    format: 'date-time',
    example: '2026-05-07T10:30:00.000Z',
  })
  psFreezeFrom?: Date;

  @OptionalDateField({
    format: 'date-time',
    example: '2026-05-07T12:30:00.000Z',
  })
  psFreezeTo?: Date;

  @OptionalEnumField(PhysicalStockPostingMode, {
    default: PhysicalStockPostingMode.ADJUST_DIFFERENCE_ONLY,
    example: PhysicalStockPostingMode.ADJUST_DIFFERENCE_ONLY,
  })
  psPostingMode?: PhysicalStockPostingMode;

  @OptionalEnumField(PhysicalStockRateSource, {
    default: PhysicalStockRateSource.AVG_COST,
    example: PhysicalStockRateSource.AVG_COST,
  })
  psRateSource?: PhysicalStockRateSource;

  @OptionalUuidField()
  psAdjustmentVoucherId?: string;

  @OptionalIntField({
    default: 0,
    example: 10,
    min: 0,
  })
  psTotalLines?: number;

  @OptionalDecimalField({
    default: 0,
    example: 12500.5,
    min: 0,
  })
  psTotalBookValue?: number;

  @OptionalDecimalField({
    default: 0,
    example: 12300.75,
    min: 0,
  })
  psTotalCountedValue?: number;

  @OptionalSignedDecimalField({
    default: 0,
    example: -199.75,
  })
  psNetVarianceValue?: number;

  @OptionalEnumField(TransactionStatus, {
    default: TransactionStatus.DRAFT,
    example: TransactionStatus.DRAFT,
  })
  psStatus?: TransactionStatus;

  @OptionalDateField({
    format: 'date-time',
    example: '2026-05-07T10:30:00.000Z',
  })
  psApprovedOn?: Date;

  @OptionalUuidField()
  psApprovedBy?: string;

  @OptionalDateField({
    format: 'date-time',
    example: '2026-05-07T11:00:00.000Z',
  })
  psPostedOn?: Date;

  @OptionalUuidField()
  psPostedBy?: string;

  @OptionalEnumField(DeviceType, {
    default: DeviceType.WEB,
    example: DeviceType.WEB,
  })
  psDeviceType?: DeviceType;

  @OptionalUuidField()
  psDeviceId?: string;

  @OptionalStringField({
    maxLength: 20,
    example: 'COUNTER-1',
  })
  psCounterId?: string | null;

  @OptionalUuidField()
  psSessionId?: string;

  @OptionalStringField({
    example: 'Physical stock verified and adjusted',
  })
  psRemarks?: string | null;

  @RequiredUuidField()
  psCreatedBy!: string;

  @OptionalUuidField()
  psModifiedBy?: string;
}


export class CreatePhysicalStockDetailDto {

  @RequiredUuidField({
    description: 'Physical stock header id',
  })
  psdPscId!: string;

  @OptionalIntField({
    default: 1,
    example: 1,
    min: 1,
  })
  psdRowNo?: number;

  // Scope
  @RequiredStringField({
    maxLength: 9,
    example: '2026-2027',
  })
  psdAccYear!: string;

  @RequiredUuidField()
  psdCompanyId!: string;

  @RequiredUuidField()
  psdBranchId!: string;

  @RequiredUuidField()
  psdGodownId!: string;

  // Item
  @RequiredUuidField()
  psdItemId!: string;

  @RequiredUuidField()
  psdUnitId!: string;

  @RequiredUuidField()
  psdBaseUnitId!: string;

  @OptionalDecimalField({
    default: 1,
    example: 1,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdToBaseFactor?: number;

  // Quick identity / scan fields
  @OptionalStringField({
    maxLength: 100,
    example: '8901234567890',
  })
  psdBarcode?: string | null;

  @OptionalDecimalField({
    default: 0,
    example: 120.5,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdMrp?: number;

  // Tracking
  @OptionalEnumField(StockTrackingType, {
    default: StockTrackingType.NONE,
    example: StockTrackingType.NONE,
  })
  psdTrackingType?: StockTrackingType;

  // Book stock
  @OptionalDecimalField({
    default: 0,
    example: 100,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdBookQty?: number;

  @OptionalDecimalField({
    default: 0,
    example: 100,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdBookBaseQty?: number;

  // Physical counted stock
  @OptionalDecimalField({
    default: 0,
    example: 95,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdPhysicalQty?: number;

  @OptionalDecimalField({
    default: 0,
    example: 95,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdPhysicalBaseQty?: number;

  // Valuation
  @OptionalDecimalField({
    default: 0,
    example: 85.5,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdStockRateWot?: number;

  @OptionalDecimalField({
    default: 0,
    example: 100.89,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psdStockRateWithTax?: number;

  // Resolution
  @OptionalUuidField()
  psdReasonId?: string;

  @OptionalEnumField(PhysicalStockResolution, {
    default: PhysicalStockResolution.ADJUST_LOSS_GAIN,
    example: PhysicalStockResolution.ADJUST_LOSS_GAIN,
  })
  psdResolution?: PhysicalStockResolution;

  @OptionalStringField({
    example: 'Stock shortage adjusted after physical verification',
  })
  psdNotes?: string | null;

  // Posting / status
  @OptionalBooleanField({
    default: false,
    example: false,
  })
  psdIsPosted?: boolean;

  // Audit
  @RequiredUuidField()
  psdCreatedBy!: string;

  @OptionalUuidField()
  psdModifiedBy?: string;
}


export class CreatePhysicalStockBatchDetailDto {

  @RequiredUuidField({
    description: 'Physical stock detail parent id',
  })
  psbPsdId!: string;

  @OptionalIntField({
    default: 1,
    example: 1,
    min: 1,
  })
  psbRowNo?: number;

  // Scope snapshot
  @RequiredStringField({
    maxLength: 9,
    example: '2026-2027',
  })
  psbAccYear!: string;

  @RequiredUuidField()
  psbCompanyId!: string;

  @RequiredUuidField()
  psbBranchId!: string;

  @RequiredUuidField()
  psbGodownId!: string;

  // Item snapshot
  @RequiredUuidField()
  psbItemId!: string;

  @RequiredUuidField()
  psbUnitId!: string;

  @RequiredUuidField()
  psbBaseUnitId!: string;

  @OptionalDecimalField({
    default: 1,
    example: 1,
    min: 0.000001,
    maxDecimalPlaces: 6,
  })
  psbToBaseFactor?: number;

  // Batch / lot / MRP identity
  @OptionalUuidField()
  psbBatchId?: string;

  @OptionalStringField({
    maxLength: 100,
    example: 'BATCH-001',
  })
  psbBatchNo?: string | null;

  @OptionalStringField({
    maxLength: 100,
    example: 'MFG-BATCH-001',
  })
  psbMfgBatchNo?: string | null;

  @OptionalDateField({
    format: 'date',
    example: '2026-05-07',
  })
  psbBatchDate?: Date;

  @OptionalDateField({
    format: 'date',
    example: '2026-05-01',
  })
  psbMfgDate?: Date;

  @OptionalDateField({
    format: 'date',
    example: '2027-05-01',
  })
  psbExpiryDate?: Date;

  @OptionalDecimalField({
    default: 0,
    example: 120.5,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psbMrp?: number;

  @OptionalStringField({
    maxLength: 100,
    example: '8901234567890',
  })
  psbBarcode?: string | null;

  @OptionalStringField({
    maxLength: 100,
    example: 'SN-001',
  })
  psbSerialNo?: string | null;

  // System/book stock for this batch
  @OptionalDecimalField({
    default: 0,
    example: 100,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psbBookQty?: number;

  @OptionalDecimalField({
    default: 0,
    example: 100,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psbBookBaseQty?: number;

  // Physical counted stock for this batch
  @OptionalDecimalField({
    default: 0,
    example: 95,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psbPhysicalQty?: number;

  @OptionalDecimalField({
    default: 0,
    example: 95,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psbPhysicalBaseQty?: number;

  // Batch valuation
  @OptionalDecimalField({
    default: 0,
    example: 85.5,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psbStockRateWot?: number;

  @OptionalDecimalField({
    default: 0,
    example: 100.89,
    min: 0,
    maxDecimalPlaces: 6,
  })
  psbStockRateWithTax?: number;

  // Resolution
  @OptionalUuidField()
  psbReasonId?: string;

  @OptionalEnumField(PhysicalStockResolution, {
    default: PhysicalStockResolution.ADJUST_LOSS_GAIN,
    example: PhysicalStockResolution.ADJUST_LOSS_GAIN,
  })
  psbResolution?: PhysicalStockResolution;

  @OptionalStringField({
    example: 'Batch stock shortage adjusted after physical verification',
  })
  psbNotes?: string | null;

  // Posting
  @OptionalBooleanField({
    default: false,
    example: false,
  })
  psbIsPosted?: boolean;

  // Audit
  @RequiredUuidField()
  psbCreatedBy!: string;

  @OptionalUuidField()
  psbModifiedBy?: string;
}