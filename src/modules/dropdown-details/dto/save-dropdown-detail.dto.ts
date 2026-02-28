import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  return trimmed ? trimmed : null;
};

const toOptionalIdString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  return value as string;
};

const toOptionalInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : (value as number);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : (value as unknown as number);
  }

  return value as number;
};

const toNullableInteger = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : (value as number);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : (value as unknown as number);
  }

  return value as number;
};

export class SaveDropdownDetailDto {
  @ApiPropertyOptional({ description: 'When provided, request updates dropdown details' })
  @IsOptional()
  @Transform(({ value }) => toOptionalIdString(value))
  @IsNumberString({ no_symbols: true })
  dropdown_id?: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  dropdown_name!: string;

  @ApiProperty({ description: 'SQL query for dropdown source' })
  @IsString()
  @IsNotEmpty()
  dropdown_sql!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  dropdown_description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  dropdown_sort_order?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  dropdown_sort_column?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  dropdown_completion?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  dropdown_sql_regional?: string | null;

  @ApiPropertyOptional({ minimum: 1, default: 10 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  dropdown_max_visible_items?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dropdown_show_header?: boolean;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  dropdown_width?: number | null;
}
