import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, Matches } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { SettlementResolution, WriteOffTreatment } from '../types/tender-settlement-enum';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The multipart form of /import: the file is the "file" part. */
export class ImportSettlementDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The store the file is for (the one writer of its tender rows).',
  })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The terminal / VPA tender whose statement format reads the file. A line naming another ' +
      'terminal of this company resolves to that terminal’s tender.',
  })
  @RequiredUuid()
  tenderId!: string;

  @ApiPropertyOptional({
    example: 'UTR0000123456',
    description: 'The payout’s bank UTR, when the file carries no payout column.',
  })
  @OptionalTrimmedString(60)
  payoutRef?: string;

  @ApiPropertyOptional({
    example: '2026-10-08',
    description: 'The payout date (the voucher’s), when the file carries no payout column.',
  })
  @IsOptional()
  @Matches(DATE, { message: 'payoutDate must be YYYY-MM-DD' })
  payoutDate?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @NullableString(500)
  notes?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'The provider’s statement, CSV, read with the tender’s column map.',
  })
  // Swagger's picture of the multipart part; the bytes arrive through FileInterceptor.
  // Whitelisted, or forbidNonWhitelisted refuses the (own, undefined) class field.
  @IsOptional()
  file?: unknown;
}

/** The house key of a payout (an import). */
export class SettlementKeyDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    example: '2026-2027',
    description: 'The payout date’s year (both tables are partitioned by it).',
  })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  asiId!: string;
}

export class VoidSettlementDto extends SettlementKeyDto {
  @ApiProperty({ example: 'Imported the wrong terminal’s file', maxLength: 250 })
  @TrimmedString(250)
  reason!: string;
}

/** One statement line. */
export class SettlementLineKeyDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  aslId!: string;
}

export class ConfirmSettlementLineDto extends SettlementLineKeyDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omitted: accept the SUGGESTED row. Given: link this tender row by hand (MANUAL).',
  })
  @OptionalUuid()
  tdId?: string;

  @ApiPropertyOptional({ example: '2026-2027', description: 'With tdId.' })
  @IsOptional()
  @UpperMaxString(9)
  tdAccYear?: string;
}

export class IgnoreSettlementLineDto extends SettlementLineKeyDto {
  @ApiProperty({
    example: 'The provider’s own day-total row',
    description: 'Why the line is not part of this payout. It leaves the payout’s totals.',
    maxLength: 500,
  })
  @TrimmedString(500)
  notes!: string;
}

export class ResolveSettlementLineDto extends SettlementLineKeyDto {
  @ApiProperty({ enum: SettlementResolution })
  @IsEnum(SettlementResolution)
  resolution!: SettlementResolution;

  @ApiProperty({ format: 'uuid', description: 'A NONCASH till reason (UNBILLED_PAYMENT …).' })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'LINKED: the bill’s tender row on this tender.',
  })
  @OptionalUuid()
  tdId?: string;

  @ApiPropertyOptional({ example: '2026-2027', description: 'LINKED: with tdId.' })
  @IsOptional()
  @UpperMaxString(9)
  tdAccYear?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'INCOME: the income ledger the money is booked to.',
  })
  @NullableUuid()
  incomeLedgerId?: string | null;

  @ApiPropertyOptional({ maxLength: 500 })
  @NullableString(500)
  notes?: string | null;
}

export class WriteOffTenderDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The tender row that never got its money (or was charged back).',
  })
  @RequiredUuid()
  tdId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  tdAccYear!: string;

  @ApiProperty({ enum: WriteOffTreatment })
  @IsEnum(WriteOffTreatment)
  treatment!: WriteOffTreatment;

  @ApiProperty({
    format: 'uuid',
    description: 'A NONCASH till reason (NOT_PAID, DECLINED, FAKE_PROOF …).',
  })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'RECOVER: the ledger the amount is recovered from (the cashier’s, say).',
  })
  @NullableUuid()
  recoveryLedgerId?: string | null;

  @ApiPropertyOptional({ maxLength: 500 })
  @NullableString(500)
  notes?: string | null;
}

export class SettlementFormatQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tenderId!: string;
}

export class SaveSettlementFormatDto extends SettlementFormatQueryDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description:
      'The column map (settlement-format.ts): { version: 1, source, provider, columns: { gross, txnOn, ' +
      'terminalId, refNo, authCode, cardLast4, fee, tax, net, kind, payoutRef, payoutDate … }, kindMap, ' +
      'dateFormat, negativeIsRefund }. null clears it.',
  })
  @IsOptional()
  @IsObject()
  format!: Record<string, unknown> | null;
}

/** /format/test — what the map reads out of a sample file, nothing saved. */
export class TestSettlementFormatDto extends SettlementFormatQueryDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'A sample statement CSV.' })
  @IsOptional()
  file?: unknown;
}
