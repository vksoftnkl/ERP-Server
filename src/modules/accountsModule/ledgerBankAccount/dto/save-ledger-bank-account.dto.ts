import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
  isUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toNullableUuid, toNullableString } from 'src/common/dto/dto-transforms';



const toUpper = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

export class SaveLedgerBankAccountDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing ledger bank account',
  })
  @IsOptional()
  @IsUUID('all')
  lbaId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  lbaCompanyId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  lbaLedgerId!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  lbaAccountHolder!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  lbaBankName!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  lbaBranchName?: string | null;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lbaAccountNo!: string;

  @ApiPropertyOptional({ maxLength: 11, minLength: 11, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpper(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Length(11, 11)
  lbaIfscCode?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(15)
  lbaMicrCode?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpper(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  lbaAccountType?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  lbaUpiId?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  lbaChequeName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lbaIsDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lbaIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  lbaRemarks?: string | null;
}
