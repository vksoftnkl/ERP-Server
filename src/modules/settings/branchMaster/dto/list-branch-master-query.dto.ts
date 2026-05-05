import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
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

const toUpper = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

const toOptionalTrimmedString = (value: unknown): string | undefined | unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export class ListBranchMasterQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsUUID('all')
  compId?: string;

  @ApiPropertyOptional({ maxLength: 2 })
  @IsOptional()
  @Transform(({ value }) => toUpper(value))
  @IsString()
  @Length(2, 2)
  brStateCode?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  brIsActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  brIsDefault?: boolean;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
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
