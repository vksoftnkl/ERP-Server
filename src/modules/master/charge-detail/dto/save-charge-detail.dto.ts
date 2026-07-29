import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  NullableNumber,
  NullableStringStrict,
  NullableUpperMaxString,
  OptionalBoolean,
  OptionalInteger,
  OptionalUpperMaxString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import {
  ChargeApplyOn,
  ChargeCostAlloc,
  ChargeDocType,
  ChargeMethod,
  ChargeRole,
  ChargeType,
} from '../types/charge-detail-api.types';

// One sale_charge_detail row. Nothing is required by the decorators: a create
// needs the document scope plus the two references, an update needs only cdId
// and the fields that change, so "required on create" is enforced in the service
// (ChargeDetailService.requireField) where the stored row is available to fill
// the gaps.
export class SaveChargeDetailDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates that charge line; otherwise a new line is created',
  })
  @OptionalUuid()
  cdId?: string;

  @ApiPropertyOptional({
    enum: ChargeDocType,
    enumName: 'ChargeDocType',
    description: "Parent document's module. Required on create, immutable afterwards",
  })
  @OptionalUpperMaxString(12)
  @IsEnum(ChargeDocType)
  cdDocType?: ChargeDocType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Parent document id. Required on create, immutable afterwards',
  })
  @OptionalUuid()
  cdDocId?: string;

  @ApiPropertyOptional({
    description: 'Line order within the document. Defaults to the next free number',
  })
  @OptionalInteger()
  cdSlno?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required on create' })
  @OptionalUuid()
  cdCompId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required on create' })
  @OptionalUuid()
  cdBranchId?: string;

  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description: 'Accounting year, e.g. 2026-2027. Required on create',
  })
  @NullableStringStrict(9)
  cdAccYear?: string;

  @ApiPropertyOptional({ nullable: true, description: "Parent document's voucher number" })
  @NullableNumber()
  cdVoucherNo?: string | number | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'charge_master.chgId. Required on create',
  })
  @OptionalUuid()
  cdChgId?: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'Snapshot of chgName' })
  @NullableStringStrict(100)
  cdChgName?: string | null;

  @ApiPropertyOptional({ enum: ChargeRole, enumName: 'ChargeRole', nullable: true })
  @NullableUpperMaxString(15)
  @IsEnum(ChargeRole)
  cdRole?: ChargeRole | null;

  @ApiPropertyOptional({ enum: ChargeMethod, enumName: 'ChargeMethod', nullable: true })
  @NullableUpperMaxString(10)
  @IsEnum(ChargeMethod)
  cdMethod?: ChargeMethod | null;

  @ApiPropertyOptional({
    enum: ChargeType,
    enumName: 'ChargeType',
    default: ChargeType.ADD,
    description: 'The sign of the charge',
  })
  @OptionalUpperMaxString(10)
  @IsEnum(ChargeType)
  cdType?: ChargeType;

  @ApiPropertyOptional({
    enum: ChargeApplyOn,
    enumName: 'ChargeApplyOn',
    nullable: true,
    description: 'Distribution basis for a FIXED lump sum',
  })
  @NullableUpperMaxString(10)
  @IsEnum(ChargeApplyOn)
  cdApplyOn?: ChargeApplyOn | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'GL ledger this charge posts to. Required on create',
  })
  @OptionalUuid()
  cdLedgerCode?: string;

  @ApiPropertyOptional({ default: false, description: 'Purchase: adds to item landing cost' })
  @OptionalBoolean()
  cdLandingCost?: boolean;

  @ApiPropertyOptional({ enum: ChargeCostAlloc, enumName: 'ChargeCostAlloc', nullable: true })
  @NullableUpperMaxString(10)
  @IsEnum(ChargeCostAlloc)
  cdCostAlloc?: ChargeCostAlloc | null;

  @ApiPropertyOptional({
    default: false,
    description: "Folds the charge into the goods' taxable value (taxed at each item's own rate)",
  })
  @OptionalBoolean()
  cdBeforeTax?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'The charge carries its OWN GST, after tax. Mutually exclusive with cdBeforeTax',
  })
  @OptionalBoolean()
  cdTaxApl?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Post to its own ledger vs absorb' })
  @OptionalBoolean()
  cdSepPost?: boolean;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  cdUnit?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Qty or value basis keyed on the line' })
  @NullableNumber()
  cdQtyVal?: string | number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Weight / tonnage basis' })
  @NullableNumber()
  cdWeight?: string | number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Rate or %, per cdMethod. 0 with a non-zero cdAmount is valid: the operator typed the total',
  })
  @NullableNumber()
  cdRate?: string | number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Charge amount BEFORE tax' })
  @NullableNumber()
  cdAmount?: string | number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  cdTaxCode?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true, description: 'HSN/SAC snapshot' })
  @NullableStringStrict(15)
  cdHsn?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdTaxPerc?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdTaxAmt?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdSgstPerc?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdSgstAmt?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdCgstPerc?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdCgstAmt?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdIgstPerc?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdIgstAmt?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdCessPerc?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  cdCessAmt?: string | number | null;

  @ApiPropertyOptional({ nullable: true, description: 'cdAmount + its own tax' })
  @NullableNumber()
  cdNetAmt?: string | number | null;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @NullableStringStrict(255)
  cdRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  cdIsActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  cdCreatedBy?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  cdModifiedBy?: string;
}
