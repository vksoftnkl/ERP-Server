import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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

const toTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toNullableUuid = (value: unknown): string | null | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return value as string;
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

const toOptionalInteger = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : (value as number);
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
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

export class SaveGodownDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the godown location',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  gdl_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for create, optional for update' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  gdl_godown_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for create, optional for update' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  gdl_branch_id?: string;

  @ApiPropertyOptional({ description: 'Required for create, optional for update' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(200)
  gdl_name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @IsString()
  @MaxLength(50)
  gdl_short?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 30 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @IsString()
  @MaxLength(30)
  gdl_code?: string | null;

  @ApiPropertyOptional({ maxLength: 20, default: 'BIN' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  gdl_type?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @IsUUID('all')
  gdl_parent_id?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  gdl_sort?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  gdl_level?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gdl_del_sheet?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gdl_split_stock?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gdl_is_active?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gdl_negative_stock?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  gdl_volume?: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @IsString()
  @MaxLength(250)
  gdl_remarks?: string | null;
}
