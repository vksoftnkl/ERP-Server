import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  NullableDateString,
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalDateString,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * The six till masters (S10). `/create` creates when the id is absent and
 * updates when it is present (the house master verb). On an update a field
 * left out keeps its value; `null` clears a nullable one.
 */

export class SaveTillCounterDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update.' })
  @OptionalUuid()
  tcnId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tcnCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tcnBranchId!: string;

  @ApiProperty({
    example: 'C01',
    description: 'Unique in the branch; printed in every session number.',
  })
  @UpperMaxString(20)
  tcnCode!: string;

  @ApiProperty({ example: 'Counter 1' })
  @TrimmedString(100)
  tcnName!: string;

  @ApiPropertyOptional({
    enum: [
      'POS',
      'EXPRESS',
      'RETURNS_DESK',
      'SERVICE_DESK',
      'CASH_OFFICE',
      'MOBILE',
      'SELF_CHECKOUT',
    ],
  })
  @NullableString(20)
  tcnKind?: string;

  @ApiPropertyOptional({
    enum: ['DRAWER', 'TRAY', 'NONE'],
    description:
      'TRAY = a cash insert that travels with the cashier; NONE = a cashless lane (nothing counted).',
  })
  @NullableString(10)
  tcnDrawerMode?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'fixed.device_master — Desktop / Mobile only, one counter per device. NULL = unlinked: a device picks it from the free list for one session at a time, and nothing is written here.',
  })
  @NullableUuid()
  tcnDeviceId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Where its cash goes; NULL = the branch default safe.',
  })
  @NullableUuid()
  tcnSafeId?: string | null;

  @ApiPropertyOptional({
    example: 2000,
    description: 'The float an ISSUED open counts out by default.',
  })
  @OptionalNumber(0)
  tcnDefaultFloat?: number;

  @ApiPropertyOptional({ description: '0 = off; above it the till shows "pickup due".' })
  @OptionalNumber(0)
  tcnCashAlertLimit?: number;

  @ApiPropertyOptional({
    description: '0 = off; above it billing stops until a pickup. Not below the alert limit.',
  })
  @OptionalNumber(0)
  tcnCashBlockLimit?: number;

  @ApiPropertyOptional({ description: 'false = money may be taken here with no session (rare).' })
  @OptionalBoolean()
  tcnRequiresSession?: boolean;

  @ApiPropertyOptional()
  @OptionalInteger(0)
  tcnSortOrder?: number;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(250)
  tcnRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  tcnIsActive?: boolean;
}

export class SaveTillSafeDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update.' })
  @OptionalUuid()
  tsfId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tsfCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tsfBranchId!: string;

  @ApiProperty({ example: 'SAFE1' })
  @UpperMaxString(20)
  tsfCode!: string;

  @ApiProperty({ example: 'Main safe' })
  @TrimmedString(100)
  tsfName!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The ledger the safe posts to. Left out on a new safe = the SAFE_CASH role’s ledger (Ledger Map).',
  })
  @OptionalUuid()
  tsfLedgerId?: string;

  @ApiPropertyOptional({ description: '0 = none; above it the day close asks for a remittance.' })
  @OptionalNumber(0)
  tsfInsuredLimit?: number;

  @ApiPropertyOptional({
    description: 'The branch default safe; setting it takes the flag off the old default.',
  })
  @OptionalBoolean()
  tsfIsDefault?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(250)
  tsfRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  tsfIsActive?: boolean;
}

export class SaveTillReasonDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update (a company row only; shipped rows are read-only).',
  })
  @OptionalUuid()
  trsId?: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The owning company. Shipped (shared) rows are not edited here.',
  })
  @RequiredUuid()
  trsCompanyId!: string;

  @ApiProperty({ example: 'VARIANCE' })
  @UpperMaxString(20)
  trsCategory!: string;

  @ApiProperty({ example: 'COUNT_ERROR' })
  @UpperMaxString(30)
  trsCode!: string;

  @ApiProperty({ example: 'Counting error' })
  @TrimmedString(100)
  trsName!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'EXPENSE / PAID_IN: the default ledger.',
  })
  @NullableUuid()
  trsLedgerId?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  trsNeedsNote?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  trsNeedsRef?: boolean;

  @ApiPropertyOptional({ description: '0 = no cap of its own.' })
  @OptionalNumber(0)
  trsMaxAmount?: number;

  @ApiPropertyOptional()
  @OptionalInteger(0)
  trsSortOrder?: number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  trsIsActive?: boolean;
}

export class SaveTillDenominationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update (a company row only).' })
  @OptionalUuid()
  tdnId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tdnCompanyId!: string;

  @ApiPropertyOptional({ example: 'INR' })
  @NullableString(3)
  tdnCurrency?: string;

  @ApiProperty({ example: 500 })
  @RequiredNumber(0)
  tdnValue!: number;

  @ApiProperty({ enum: ['NOTE', 'COIN'] })
  @IsIn(['NOTE', 'COIN'])
  tdnKind!: 'NOTE' | 'COIN';

  @ApiProperty({ example: '₹500' })
  @TrimmedString(20)
  tdnLabel!: string;

  @ApiPropertyOptional({ description: 'Notes per strapped bundle; 0 = not bundled.' })
  @OptionalInteger(0)
  tdnBundleQty?: number;

  @ApiPropertyOptional()
  @OptionalInteger(0)
  tdnSortOrder?: number;

  @ApiPropertyOptional({
    nullable: true,
    example: '2027-03-31',
    description: 'A withdrawn note stops being offered after this.',
  })
  @NullableDateString()
  tdnValidTo?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  tdnIsActive?: boolean;
}

export class SaveTillApprovalRuleDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update (a company / branch row only).',
  })
  @OptionalUuid()
  tarId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tarCompanyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Set = this branch only (it beats the company row).',
  })
  @NullableUuid()
  tarBranchId?: string | null;

  @ApiProperty({ example: 'CASH_VARIANCE' })
  @UpperMaxString(30)
  tarEventCode!: string;

  @ApiProperty({ enum: ['NEVER', 'ALWAYS', 'OVER_AMOUNT', 'OVER_COUNT', 'OVER_PERCENT'] })
  @UpperMaxString(12)
  tarMode!: string;

  @ApiPropertyOptional()
  @OptionalNumber(0)
  tarThresholdAmount?: number;

  @ApiPropertyOptional({ description: 'Per session.' })
  @OptionalInteger(0)
  tarThresholdCount?: number;

  @ApiPropertyOptional()
  @OptionalNumber(0)
  tarThresholdPercent?: number;

  @ApiPropertyOptional({ enum: ['COUNTER', 'REMOTE', 'EITHER'] })
  @NullableString(12)
  tarChannel?: string;

  @ApiPropertyOptional({
    enum: ['SUPERVISOR', 'STORE_MANAGER', 'CASH_OFFICE', 'AREA_MANAGER', 'HO_FINANCE'],
  })
  @NullableString(20)
  tarMinRole?: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  tarTwoPerson?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  tarAllowSelf?: boolean;

  @ApiPropertyOptional({ description: 'false = record now, review later.' })
  @OptionalBoolean()
  tarBlocksTill?: boolean;

  @ApiPropertyOptional({ description: '0 = a PENDING request never expires.' })
  @OptionalInteger(0)
  tarExpireMinutes?: number;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @OptionalDateString()
  tarEffectiveFrom?: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(250)
  tarRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  tarIsActive?: boolean;
}

export class SaveTillApprovalAuthorityDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update.' })
  @OptionalUuid()
  taaId?: string;

  @ApiProperty({ format: 'uuid', description: 'user_master.usr_id of the approver.' })
  @RequiredUuid()
  taaUserId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = every company (group finance).',
  })
  @NullableUuid()
  taaCompanyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = every branch of the company.',
  })
  @NullableUuid()
  taaBranchId?: string | null;

  @ApiProperty({
    enum: ['SUPERVISOR', 'STORE_MANAGER', 'CASH_OFFICE', 'AREA_MANAGER', 'HO_FINANCE'],
  })
  @UpperMaxString(20)
  taaRole!: string;

  @ApiPropertyOptional({ nullable: true, description: 'NULL = every event.' })
  @NullableString(30)
  taaEventCode?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'NULL = no ceiling.' })
  @NullableNumber(0)
  taaMaxAmount?: number | null;

  @ApiPropertyOptional({
    description: 'May approve from the inbox / mobile, not only at the counter.',
  })
  @OptionalBoolean()
  taaCanRemote?: boolean;

  @ApiPropertyOptional({ example: '2026-10-08' })
  @OptionalDateString()
  taaValidFrom?: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  taaValidTo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(250)
  taaRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  taaIsActive?: boolean;
}

/** `?id=&companyId=` — delete / get of a master row. */
export class TillMasterKeyQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The caller’s company: a row of another company is not found.',
  })
  @RequiredUuid()
  companyId!: string;
}

export class TillDenominationListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;
}
