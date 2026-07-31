import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDateString,
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { Transform } from 'class-transformer';
import { toOptionalIdString, toNullableNumberStrict } from 'src/common/dto/DtoTransforms';
import { SkipOnNullish } from 'src/common/dto/dtoDecorators';
// Mirrors ck_tnd_colour — #RRGGBB or #RRGGBBAA.
const TENDER_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
export class SaveTenderMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing tender',
  })
  @OptionalUuid()
  tndId?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tndCompanyId!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Owning branch. Omit or send null to make the tender company-wide.',
  })
  @NullableUuid()
  tndBranchId?: string | null;
  @ApiProperty({ example: '1', description: 'acc_tender_types.ttm_type_id' })
  @Transform(({ value }) => toOptionalIdString(value))
  @Matches(/^\d+$/)
  tndTypeId!: string;
  @ApiProperty({ maxLength: 100 })
  @TrimmedString(100)
  @IsNotEmpty()
  tndName!: string;
  @ApiPropertyOptional({
    maxLength: 30,
    description: 'Short label for POS keys. Defaults to the first 30 chars of tndName.',
  })
  @OptionalTrimmedString(30)
  tndShortName?: string;
  @ApiProperty({ format: 'uuid', description: 'Final posting ledger' })
  @RequiredUuid()
  tndLedgerId!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Clearing/suspense ledger money sits in until settlement (card, UPI).',
  })
  @NullableUuid()
  tndSettlementLedgerId?: string | null;
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 90,
    description: 'T+n days before the settlement ledger is expected to clear.',
  })
  @OptionalInteger(0, 90)
  tndSettlementDays?: number;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'acc_ledger_bank_accounts row credited for cheque/bank tenders.',
  })
  @NullableUuid()
  tndBankAccountId?: string | null;
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  tndMinAmount!: number;
  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableNumberStrict(value))
  @SkipOnNullish()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  tndMaxAmount?: number | null;
  @ApiPropertyOptional({ nullable: true, minimum: 0, description: 'Per-day cap; null = no cap.' })
  @NullableNumber(0)
  tndDailyLimit?: number | null;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @OptionalNumber(0)
  @Max(100)
  tndSurchargePerc?: number;
  @ApiPropertyOptional({
    minimum: 0,
    description: 'Flat surcharge added on top of the percentage.',
  })
  @OptionalNumber(0)
  tndSurchargeAmount?: number;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Income ledger the surcharge/MDR is booked to.',
  })
  @NullableUuid()
  tndSurchargeLedgerId?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  tndEditSurcharge?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  tndEditLedger?: boolean;
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  tndUpiVpa?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Static QR string shown on the device.' })
  @NullableString()
  tndUpiQrPayload?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 50, description: 'MID' })
  @NullableString(50)
  tndMerchantId?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 50, description: 'TID' })
  @NullableString(50)
  tndTerminalId?: string | null;
  @ApiPropertyOptional({
    exclusiveMinimum: true,
    minimum: 0,
    description: 'Loyalty points / voucher units to INR. Must be greater than 0.',
  })
  @OptionalNumber()
  @IsPositive()
  tndConversionRate?: number;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Override for the tender type flag. null = inherit from the tender type.',
  })
  @OptionalBoolean()
  tndNeedsRef?: boolean | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Override for the tender type flag. null = inherit from the tender type.',
  })
  @OptionalBoolean()
  tndAllowChange?: boolean | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Override for the tender type flag. null = inherit from the tender type.',
  })
  @OptionalBoolean()
  tndAllowInReturn?: boolean | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  tndOpenCashDrawer?: boolean;
  @ApiPropertyOptional({ description: 'Only one default tender per company/branch.' })
  @OptionalBoolean()
  tndIsDefault?: boolean;
  @ApiPropertyOptional({ minimum: 0 })
  @OptionalInteger(0)
  tndDisplayPosition?: number;
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 10,
    description: 'POS shortcut key; unique per company/branch.',
  })
  @NullableString(10)
  tndHotkey?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 9, example: '#00A3FF' })
  @NullableString(9)
  @Matches(TENDER_COLOUR_PATTERN, {
    message: 'tndColour must be a hex colour (#RRGGBB or #RRGGBBAA)',
  })
  tndColour?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  tndEffectiveFrom?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  tndEffectiveTo?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @NullableString(250)
  tndRemarks?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  tndIsActive?: boolean;
  @ApiPropertyOptional({ nullable: true, maxLength: 64, description: 'Tally sync identity.' })
  @NullableString(64)
  tndTallyGuid?: string | null;
}
