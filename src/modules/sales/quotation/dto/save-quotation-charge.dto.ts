import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
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
  CHARGE_APPLY_ONS,
  CHARGE_COST_ALLOCS,
  CHARGE_METHODS,
  CHARGE_ROLES,
  CHARGE_TYPES,
} from '../../../master/charge-master/types/charge-master-api.types';

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

  @ApiPropertyOptional({ enum: CHARGE_ROLES, nullable: true })
  @NullableUpperMaxString(15)
  @IsIn(CHARGE_ROLES, { message: `cdRole must be one of: ${CHARGE_ROLES.join(', ')}` })
  cdRole?: string | null;

  @ApiPropertyOptional({ enum: CHARGE_METHODS, nullable: true })
  @NullableUpperMaxString(10)
  @IsIn(CHARGE_METHODS, { message: `cdMethod must be one of: ${CHARGE_METHODS.join(', ')}` })
  cdMethod?: string | null;

  @ApiPropertyOptional({
    enum: CHARGE_TYPES,
    default: 'ADD',
    description: 'The sign of the charge',
  })
  @OptionalUpperMaxString(10)
  @IsIn(CHARGE_TYPES)
  cdType?: string;

  @ApiPropertyOptional({
    enum: CHARGE_APPLY_ONS,
    nullable: true,
    description: 'Distribution basis for a FIXED lump sum',
  })
  @NullableUpperMaxString(10)
  @IsIn(CHARGE_APPLY_ONS, { message: `cdApplyOn must be one of: ${CHARGE_APPLY_ONS.join(', ')}` })
  cdApplyOn?: string | null;

  @ApiProperty({ format: 'uuid', description: 'GL ledger this charge posts to' })
  @RequiredUuid()
  cdLedgerCode!: string;

  @ApiPropertyOptional({ default: false, description: 'Purchase: adds to item landing cost' })
  @OptionalBoolean()
  cdLandingCost?: boolean;

  @ApiPropertyOptional({ enum: CHARGE_COST_ALLOCS, nullable: true })
  @NullableUpperMaxString(10)
  @IsIn(CHARGE_COST_ALLOCS, {
    message: `cdCostAlloc must be one of: ${CHARGE_COST_ALLOCS.join(', ')}`,
  })
  cdCostAlloc?: string | null;

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
