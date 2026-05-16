import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toOptionalUuid, toNullableUuid, toNullableString, toOptionalNumber, toOptionalBoolean } from 'src/common/dto/dto-transforms';



const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toOptionalTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value as string;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};


const toNullableUppercaseString = (value: unknown): string | null | undefined => {
  const parsed = toNullableString(value);
  return parsed === null ? null : parsed?.toUpperCase();
};



export class SaveItemCustRateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing customer item rate row',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  csr_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  csr_branch_id?: string | null;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  csr_customer_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  csr_unit_rate_id!: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'FIXED' })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString()
  @MaxLength(20)
  csr_rate_type?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  csr_item_rate?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  csr_disc_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  csr_disc_qty?: number;

  @ApiPropertyOptional({ maxLength: 1, nullable: true, description: 'A/B/C/D' })
  @IsOptional()
  @Transform(({ value }) => toNullableUppercaseString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(1)
  @Matches(/^[A-D]$/, { message: 'csr_price_level must be one of A, B, C, D' })
  csr_price_level?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  csr_valid_from?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  csr_valid_to?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  csr_priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  csr_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  csr_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  csr_modified_by?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  csr_uploaded_at?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  csr_uploaded_by?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  csr_remarks?: string | null;
}
