import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDateString,
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  toOptionalNumber,
  toTrimmedString,
} from '../../utils/inventory-dto.decorators';

export class SaveItemQtywiseRateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing qty-wise rate row',
  })
  @OptionalUuid()
  iqr_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  iqr_branch_id?: string | null;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  iqr_unit_rate_id!: string;

  @ApiProperty({ example: 1 })
  @OptionalInteger()
  iqr_price_level!: number;

  @ApiProperty({ example: 1 })
  @OptionalNumber()
  iqr_start_qty!: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  iqr_end_qty?: number | null;

  @ApiProperty({ example: 1 })
  @OptionalNumber()
  iqr_each_qty!: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  iqr_sales_price?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  iqr_price_wot?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  iqr_price_margin?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  iqr_disc_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  iqr_disc_qty?: number;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDateString()
  iqr_valid_from?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDateString()
  iqr_valid_to?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  iqr_priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  iqr_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  iqr_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  iqr_modified_by?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  iqr_remarks?: string | null;
}
