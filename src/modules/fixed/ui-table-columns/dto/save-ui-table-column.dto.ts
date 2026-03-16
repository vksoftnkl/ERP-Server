import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toOptionalIdString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
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

const toNullableIdString = (value: unknown): string | null | undefined => {
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

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  return value as string;
};

const toNullableNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : (value as unknown as number);
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
    return Number.isInteger(value) ? value : value;
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

const toNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export class SaveUiTableColumnDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates the existing UI table column row',
    example: '1',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalIdString(value))
  @IsNumberString({ no_symbols: true })
  uiTblClmId?: string;

  @ApiPropertyOptional({
    description: 'UI table column sequence number',
    example: '10',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalIdString(value))
  @IsNumberString({ no_symbols: true })
  uiTblClmNo?: string;

  @ApiProperty({ description: 'UI table column name', example: 'Item Name' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  uiTblClmName!: string;

  @ApiPropertyOptional({
    description: 'Related UI table id',
    example: '1',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => toNullableIdString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumberString({ no_symbols: true })
  uiTblClmTableId?: string | null;

  @ApiPropertyOptional({ example: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  uiTblClmColumnWidth?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  uiTblClmColumnVisibility?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  uiTblClmColumnFocus?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  uiTblClmColumnPosition?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  uiTblClmColumnNecessity?: boolean;

  @ApiPropertyOptional({ example: 2, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  uiTblClmNextColumn?: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  uiTblClmPreviousColumn?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  uiTblClmIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  uiTblClmCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  uiTblClmModifiedBy?: string | null;
}
