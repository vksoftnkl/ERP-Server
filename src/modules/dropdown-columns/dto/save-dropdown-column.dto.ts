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
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toNullableString } from 'src/common/dto/dto-transforms';
const toNullableNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : (value as number);
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
const toInteger = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return Number(trimmed);
  }
  return value as number;
};
const toIdString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return value as string;
};
const toOptionalIdString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = toIdString(value);
  return normalized || undefined;
};
export class SaveDropdownColumnDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates dropdown column',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalIdString(value))
  @IsNumberString({ no_symbols: true })
  drop_columns_serial_id?: string;
  @ApiProperty({ description: 'Numeric dropdown id' })
  @Transform(({ value }) => toIdString(value))
  @IsNumberString({ no_symbols: true })
  dropdown_id!: string;
  @ApiProperty({ minimum: 1 })
  @Transform(({ value }) => toInteger(value))
  @IsInt()
  @Min(1)
  drop_columns_column_no!: number;
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  drop_columns_data_type!: string;
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  drop_columns_column_name!: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  drop_columns_column_alias?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  drop_columns_column_width?: number | null;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  drop_columns_column_visiblity?: boolean;
  @ApiPropertyOptional({ nullable: true, maxLength: 30 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(30)
  drop_columns_column_allignment?: string | null;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  drop_columns_column_filter?: boolean;
}
