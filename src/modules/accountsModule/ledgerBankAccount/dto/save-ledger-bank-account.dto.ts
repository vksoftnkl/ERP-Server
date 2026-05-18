import { IsNotEmpty, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from '../../dto/dtoDecorators';
import { Transform } from 'class-transformer';
import { toNullableUpperString } from '../../dto/DtoTransforms';
import { SkipOnNullish } from '../../dto/dtoDecorators';
import { IsOptional, IsString } from 'class-validator';

export class SaveLedgerBankAccountDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing ledger bank account',
  })
  @OptionalUuid()
  lbaId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  lbaCompanyId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  lbaLedgerId!: string;

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

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUpperString(value))
  @SkipOnNullish()
  @IsString()
  lbaAccountType?: string | null;

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
