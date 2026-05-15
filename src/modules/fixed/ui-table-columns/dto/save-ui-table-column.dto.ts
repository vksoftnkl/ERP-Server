import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, ValidateIf } from 'class-validator';
import {
  NullableNumberString,
  NullableString,
  OptionalBoolean,
  OptionalNumberString,
  TrimmedString,
} from '../../../sales/dto/dtoDecorators';

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

export class SaveUiTableColumnDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates the existing UI table column row',
    example: '1',
  })
  @OptionalNumberString()
  uiTblClmId?: string;

  @ApiPropertyOptional({
    description: 'UI table column sequence number',
    example: '10',
  })
  @OptionalNumberString()
  uiTblClmNo?: string;

  @ApiProperty({ description: 'UI table column name', example: 'Item Name' })
  @TrimmedString(500)
  @IsNotEmpty()
  uiTblClmName!: string;

  @ApiPropertyOptional({
    description: 'Related UI table id',
    example: '1',
    nullable: true,
  })
  @NullableNumberString()
  uiTblClmTableId?: string | null;

  @ApiPropertyOptional({ example: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  uiTblClmColumnWidth?: number | null;

  @ApiPropertyOptional({ example: true })
  @OptionalBoolean()
  uiTblClmColumnVisibility?: boolean;

  @ApiPropertyOptional({ example: false })
  @OptionalBoolean()
  uiTblClmColumnFocus?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  uiTblClmColumnPosition?: number;

  @ApiPropertyOptional({ example: false })
  @OptionalBoolean()
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
  @OptionalBoolean()
  uiTblClmIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  uiTblClmCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  uiTblClmModifiedBy?: string | null;
}
