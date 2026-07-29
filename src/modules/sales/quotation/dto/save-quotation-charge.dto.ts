import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  NullableNumber,
  NullableStringStrict,
  NullableUpperMaxString,
  OptionalBoolean,
  OptionalInteger,
  OptionalUpperMaxString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import {
  ChargeApplyOn,
  ChargeCostAlloc,
  ChargeMethod,
  ChargeRole,
  ChargeType,
} from '../../../master/charge-master/types/charge-enum';
// One applied charge line on a quotation (sale_charge_detail row with
// cdDocType = 'QUOTATION'). Every cd* value except the amounts is a SNAPSHOT of
// the charge master taken at save time, so the client sends them explicitly
// rather than the server re-reading the master on each save.
export class SaveQuotationChargeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates the existing charge line; otherwise a new line is created',
  })
  @OptionalUuid()
  cdId?: string;
  @ApiPropertyOptional({ description: 'Defaults to the 1-based position within the charges array' })
  @OptionalInteger()
  cdSlno?: number;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent quotation scope' })
  @OptionalUuid()
  cdCompId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent quotation scope' })
  @OptionalUuid()
  cdBranchId?: string;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description: 'Defaults to the parent quotation scope',
  })
  @NullableStringStrict(9)
  cdAccYear?: string;
  @ApiPropertyOptional({
    nullable: true,
    description: "Defaults to the quotation's sqQuoteSlno",
  })
  @NullableNumber()
  cdVoucherNo?: string | number | null;
  @ApiProperty({ format: 'uuid', description: 'charge_master.chgId' })
  @RequiredUuid()
  cdChgId!: string;
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
  @ApiProperty({ format: 'uuid', description: 'GL ledger this charge posts to' })
  @RequiredUuid()
  cdLedgerCode!: string;
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
  // cd_created_by / cd_modified_by became text columns in migration
  // 20260729121956: the actor is whatever resolveActor settles on — a user id,
  // but equally a name or login the caller passed — so the uuid pattern no
  // longer fits. Free text, no length cap, matching the column and the header's
  // sqCreatedBy / sqModifiedBy.
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  cdCreatedBy?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  cdModifiedBy?: string | null;
}
