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

export class ListOrGetGodownQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'When present, get a single location by id' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  gdl_id?: string;

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

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gdl_is_active?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  gdl_godown_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  gdl_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  gdl_parent_id?: string;
}
