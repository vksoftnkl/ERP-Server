import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return value as boolean;
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

const toOptionalUppercaseTrimmedString = (value: unknown): string | undefined => {
  const trimmed = toOptionalTrimmedString(value);
  return trimmed?.toUpperCase();
};

export class ListItemCustRateQueryDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('all')
  csr_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  csr_customer_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  csr_unit_rate_id?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString()
  @MaxLength(20)
  csr_rate_type?: string;

  @ApiPropertyOptional({ maxLength: 1, description: 'A/B/C/D' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUppercaseTrimmedString(value))
  @IsString()
  @MaxLength(1)
  csr_price_level?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  csr_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
