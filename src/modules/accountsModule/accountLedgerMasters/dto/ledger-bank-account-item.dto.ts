import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalUuid,
  SkipOnNullish,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { toNullableUpperString } from 'src/common/dto/DtoTransforms';
import { BankAccountType } from '../types/account-ledger-master-enum';

/**
 * A single bank account nested inside an account ledger create/update payload.
 *
 * - `lbaLedgerId` is accepted (the reference payload carries it) but is ignored:
 *   the server always injects the parent ledger's id, so a client cannot attach a
 *   bank account to a different ledger.
 * - `lbaId` present  → update that existing row (must belong to the parent ledger).
 * - `lbaId` absent   → insert a new row.
 */
export class LedgerBankAccountItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates the existing bank account row of this ledger',
  })
  @OptionalUuid()
  lbaId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored — the server injects the parent ledger id',
  })
  @OptionalUuid()
  lbaLedgerId?: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  lbaAccountHolder!: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  lbaBankName!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  lbaBranchName?: string | null;

  @ApiProperty({ maxLength: 50 })
  @TrimmedString(50)
  @IsNotEmpty()
  lbaAccountNo!: string;

  @ApiPropertyOptional({ maxLength: 11, minLength: 11, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @IsString()
  @Length(11, 11)
  lbaIfscCode?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableString(15)
  lbaMicrCode?: string | null;

  @ApiPropertyOptional({
    enum: BankAccountType,
    enumName: 'BankAccountType',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @IsEnum(BankAccountType)
  lbaAccountType?: BankAccountType | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  lbaUpiId?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  lbaChequeName?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  lbaIsDefault?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  lbaIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  lbaRemarks?: string | null;
}
