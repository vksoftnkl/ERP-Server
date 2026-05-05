import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
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

export class SaveItemEanCodeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing EAN code row',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  ean_id?: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ean_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ean_unit_id!: string;

  @ApiProperty({ maxLength: 64 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ean_code!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ean_godown_id?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ean_is_default?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ean_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ean_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ean_modified_by?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  ean_remarks?: string | null;
}
