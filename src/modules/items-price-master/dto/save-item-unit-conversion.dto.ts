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
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toOptionalUuid = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  return value as string;
};

const toNullableUuid = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return value as string;
};

const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value as string;
  }

  const trimmed = value.trim();
  return trimmed || null;
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

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

export class SaveItemUnitConversionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item unit conversion row',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  iuc_id?: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  iuc_company_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  iuc_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  iuc_unit_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  iuc_base_unit_id!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  iuc_to_base_factor?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  iuc_unit_slno?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  iul_unit_factor?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  iuc_is_default_unit?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  iuc_is_base_unit?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  iuc_is_big_unit?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  iuc_uom_weight?: number;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  iuc_uom_remarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  iuc_is_active?: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  iuc_sync_date?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  iuc_created_by?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  iuc_updated_by?: string | null;
}
