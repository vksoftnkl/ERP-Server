import { Type } from 'class-transformer';
import {
  LedGstDutyHead,
  LedGstPartyRegType,
  LedItcEligibility,
  LedLedgerType,
  LedMsmeType,
  LedRoundingMethod,
  LedTypeOfSupply,
} from '../types/account-ledger-master-enum';
import { LedgerBankAccountItemDto } from './ledger-bank-account-item.dto';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  NullableEmail,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredUuid,
  SkipOnNullish,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { toNullableUpperString } from 'src/common/dto/DtoTransforms';
// A bank-account entry is "blank" when it is null/undefined, not an object, or an
// object whose every value is null/undefined/empty string (e.g. an untouched grid row).
// Such entries are dropped so a stray {} or null doesn't fail validation or insert garbage.
const isBlankBankAccountItem = (item: unknown): boolean => {
  if (item === null || item === undefined || typeof item !== 'object') {
    return true;
  }
  return Object.values(item as Record<string, unknown>).every(
    (value) =>
      value === null || value === undefined || (typeof value === 'string' && value.trim() === ''),
  );
};

// Exported so linked masters that embed the same bank-account array (e.g. the supplier
// create/update payload, which provisions a shared account ledger) reuse one normalizer
// instead of duplicating the blank-row stripping logic.
export const normalizeBankAccountItems = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return value;
  }
  return value.filter((item) => !isBlankBankAccountItem(item));
};

export class SaveAccountLedgerMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing ledger',
  })
  @OptionalUuid()
  ledId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ledCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  ledBranchId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ledGroupId!: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  ledName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  ledShort?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledTallyName?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  ledTallyGroupName?: string | null;

  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  @NullableString(64)
  ledTallyGuid?: string | null;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @TrimmedString(30)
  ledCategory?: string;

  // §3.4 — this was @NullableString(20) against a live CHECK, so
  // {"ledLedgerType": "NONSENSE"} produced a 500 with errors: [] while every other
  // bad value on this endpoint gave a clean 400 with a field. Same for the four
  // below.
  @ApiPropertyOptional({
    enum: LedLedgerType,
    enumName: 'LedLedgerType',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @IsEnum(LedLedgerType)
  ledLedgerType?: LedLedgerType | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledMailingName?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsBillByBill?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsCostCenterReq?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsInterestApplicable?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledInterestRate?: number;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  ledContactPerson?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableEmail(150)
  ledEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledTel?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledPhone1?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledPhone2?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledWhatsappNo?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(2)
  ledStateCode?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  ledPin?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  ledCountry?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  ledRegionName?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledRegionAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledRegionAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ledRegionAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledRegionCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledRegionDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ledRegionStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  ledRegionCountry?: string | null;

  @ApiPropertyOptional({
    enum: LedGstPartyRegType,
    enumName: 'LedGstPartyRegType',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @IsEnum(LedGstPartyRegType)
  ledGstPartyRegType?: LedGstPartyRegType | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(15)
  ledGstinNo?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(10)
  ledPanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ledAadharNo?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(15)
  ledEcommerceGstin?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsSez?: boolean;

  @ApiPropertyOptional({
    enum: LedTypeOfSupply,
    enumName: 'LedTypeOfSupply',
    nullable: true,
  })
  @IsOptional()
  @SkipOnNullish()
  @IsEnum(LedTypeOfSupply)
  ledTypeOfSupply?: LedTypeOfSupply | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  ledHsnSac?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The inventory.tax_rate_master row this ledger carries when it appears as a taxable ' +
      'line — a service ledger such as freight or packing. Replaces ledGstRate / ledTaxability ' +
      '/ ledTaxRate, which held a bare percentage and could express neither cess nor ' +
      'taxability. Null on a party or bank ledger.',
  })
  @NullableUuid()
  ledTaxId?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  ledGstPartyType?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(10)
  ledTanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 21, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(21)
  ledCin?: string | null;

  @ApiPropertyOptional({ maxLength: 25, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @TrimmedString(25)
  ledUdyamNo?: string | null;

  @ApiPropertyOptional({
    enum: LedMsmeType,
    enumName: 'LedMsmeType',
    nullable: true,
  })
  @IsOptional()
  @SkipOnNullish()
  @IsEnum(LedMsmeType)
  ledMsmeType?: LedMsmeType | null;

  @ApiPropertyOptional({
    enum: LedGstDutyHead,
    enumName: 'LedGstDutyHead',
    nullable: true,
  })
  @IsOptional()
  @SkipOnNullish()
  @IsEnum(LedGstDutyHead)
  ledGstDutyHead?: LedGstDutyHead | null;

  @ApiPropertyOptional({
    enum: LedRoundingMethod,
    enumName: 'LedRoundingMethod',
    nullable: true,
  })
  @IsOptional()
  @SkipOnNullish()
  @IsEnum(LedRoundingMethod)
  ledRoundingMethod?: LedRoundingMethod | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledRoundingLimit?: number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsTdsApplicable?: boolean;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @NullableString(40)
  ledTdsDeducteeType?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @NullableString(80)
  ledTdsNatureOfPayment?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsTcsApplicable?: boolean;

  @ApiPropertyOptional({
    enum: LedItcEligibility,
    enumName: 'LedItcEligibility',
    nullable: true,
    description:
      'GST input tax credit eligibility for this purchase or expense ledger. Drives ' +
      'GSTR-3B 4(A) vs 4(D) "Ineligible ITC": without it a blocked s.17(5) credit — ' +
      'motor vehicles, food and beverage, works contract, personal consumption — ' +
      'cannot be told apart from an eligible one, and 4(A) is overstated by exactly ' +
      'that amount. Null on a ledger with no ITC question to answer (bank, cash, ' +
      'party, income). Tally: ledger GST details -> Eligibility for input credit.',
  })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @IsEnum(LedItcEligibility)
  ledItcEligibility?: LedItcEligibility | null;

  @ApiPropertyOptional({
    description:
      'This party or expense attracts reverse charge — unregistered purchase, GTA, ' +
      "legal services, director's fees, import of services. It belongs here and not " +
      'on inventory.tax_rate_master, because a rate row is shared with ordinary ' +
      'forward-charge sales at the same percentage; the document flag ' +
      'gdr_is_reverse_charge defaults from this one.',
  })
  @OptionalBoolean()
  ledIsReverseCharge?: boolean;

  // §3.1 — ledObAmount / ledObType / ledObAsOn / ledTotalDr / ledTotalCr /
  // ledTotalBalance are GONE from this payload, deliberately.
  //
  // A SHARED ledger (led_company_id IS NULL — 50 of 61 rows) spans every company,
  // so a single opening balance sitting on its row cannot be right for all of
  // them. accounts.acc_opening_balance already keys on
  // op_company_id + op_branch_id + op_acc_year, which is the correct grain, and it
  // is built and working behind menu 55.
  //
  // The six columns remain on the table and remain in the GET payload — they are 0
  // on every row today, so nothing depended on them — but a client must not be able
  // to write them. Same treatment led_is_deleted already had.

  @ApiPropertyOptional()
  @OptionalInteger()
  ledSortOrder?: number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsActive?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledAllowEdit?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledIsEntry?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ledAllowSms?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  ledRemarks?: string | null;

  @ApiPropertyOptional({
    type: LedgerBankAccountItemDto,
    isArray: true,
    description:
      'Bank accounts to persist alongside the ledger. On create every item is inserted; ' +
      'on update an item with `lbaId` updates that row, an item without `lbaId` is inserted. ' +
      'Omitting the array (or sending an empty one) leaves existing bank accounts untouched — ' +
      'use the dedicated delete endpoint to remove them.',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeBankAccountItems(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerBankAccountItemDto)
  ledgerBankAccount?: LedgerBankAccountItemDto[];
}
