import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ═══════════════════════════════════════════════════════════════════════════
//  §4.9 — cheque books
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeBookKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  chequeBookId!: string;
}

/**
 * `POST /cheque-books/create` — an UPSERT: no `chequeBookId` opens a new book;
 * with one, the book is edited. A book that has handed out a leaf keeps its
 * bank and its first leaf (they are on paper already); its last leaf may move
 * only as far as the leaves already taken.
 */
export class SaveChequeBookDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Omit to open a new book.' })
  @OptionalUuid()
  chequeBookId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Keep the book for one branch; null / omitted = every branch.',
  })
  @NullableUuid()
  branchId?: string | null;

  @ApiProperty({
    format: 'uuid',
    description: 'The bank account (Bank Accounts / Bank OD) the leaves are drawn on.',
  })
  @RequiredUuid()
  bankLedgerId!: string;

  @ApiProperty({ maxLength: 30, example: 'KVB-2026-03' })
  @TrimmedString(30)
  bookNo!: string;

  @ApiProperty({ example: 100001, description: 'The first leaf number, as printed.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999_999_999_999)
  leafFrom!: number;

  @ApiProperty({ example: 100050, description: 'The last leaf number (inclusive).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999_999_999_999)
  leafTo!: number;

  @ApiPropertyOptional({
    default: 6,
    minimum: 1,
    maximum: 12,
    description: 'Leaves print zero-padded to this many digits.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  leafWidth?: number;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 30,
    description: 'The print layout the leaves take (printing is a later phase).',
  })
  @NullableString(30)
  format?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @NullableString(250)
  remarks?: string | null;
}

export class CloseChequeBookDto extends ChequeBookKeysDto {
  @ApiProperty({ maxLength: 250, example: 'Book damaged — unused leaves destroyed' })
  @TrimmedString(250)
  reason!: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.10 — issued cheques
// ═══════════════════════════════════════════════════════════════════════════

/** The register row's house key: an issued cheque is an `acc_pdc_register` row with apd_tra_type P. */
export class IssuedChequeKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  apdAccYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;
}

export class PresentedChequeDto extends IssuedChequeKeysDto {
  @ApiProperty({
    example: '2026-10-02',
    description: 'The day the bank paid it (the statement date). Not before the cheque’s date.',
  })
  @Matches(ISO_DATE)
  date!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @NullableString(250)
  remarks?: string | null;
}

/** Returned (dishonoured by our bank) and stopped both reverse the cheque's one line. */
export class ReverseChequeDto extends IssuedChequeKeysDto {
  @ApiProperty({
    example: '2026-10-02',
    description: 'The day it happened; the reversal voucher is dated this.',
  })
  @Matches(ISO_DATE)
  date!: string;

  @ApiProperty({ maxLength: 200, example: 'Funds insufficient' })
  @TrimmedString(200)
  reason!: string;

  @ApiPropertyOptional({
    default: 0,
    description:
      'What the bank charged us for it (return / stop-payment fee): DR BANK_CHARGES / CR the bank, ' +
      'on the same voucher.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  charges?: number;
}

export class VoidChequeDto extends IssuedChequeKeysDto {
  @ApiPropertyOptional({
    example: '2026-10-02',
    description: 'The day it was voided; omitted = today. The reversal voucher is dated this.',
  })
  @IsOptional()
  @Matches(ISO_DATE)
  date?: string;

  @ApiProperty({ maxLength: 200, example: 'Leaf spoilt while writing' })
  @TrimmedString(200)
  reason!: string;
}

export class ReplaceChequeDto extends IssuedChequeKeysDto {
  @ApiProperty({
    example: '2026-10-03',
    description:
      'The new Payment Voucher’s date (and the stop’s, when the old cheque is still out).',
  })
  @Matches(ISO_DATE)
  date!: string;

  @ApiProperty({ format: 'uuid', description: 'The book the new leaf comes from.' })
  @RequiredUuid()
  chequeBookId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The bank the new cheque is drawn on. Omitted = the book’s bank.',
  })
  @NullableUuid()
  bankLedgerId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-10-03',
    description: 'The date on the new cheque. Omitted = `date`; later = post-dated.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(ISO_DATE)
  instrumentDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 150,
    description: 'Omitted = the old cheque’s.',
  })
  @NullableString(150)
  favouring?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Omitted = the old cheque’s.' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  acPayee?: boolean | null;

  @ApiProperty({ maxLength: 200, example: 'Supplier lost the cheque' })
  @TrimmedString(200)
  reason!: string;
}
