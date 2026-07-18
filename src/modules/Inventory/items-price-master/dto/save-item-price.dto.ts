import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  toNullableString,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';

const ITEM_PRICE_PROFIT_TYPES = ['By %', 'By Rs', 'By User'] as const;

export class SaveItemPriceDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item price row',
  })
  @OptionalUuid()
  ipm_id?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @NullableUuid()
  ipm_company_id?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @NullableUuid()
  ipm_branch_id?: string | null;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ipm_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ipm_unit_id!: string;
  // NULL / omitted = the price applies to every godown.
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @NullableUuid()
  ipm_godown_id?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @NullableUuid()
  ipm_base_unit_id?: string | null;
  @ApiPropertyOptional({ example: 1 })
  @OptionalNumber()
  ipm_to_base_factor?: number;
  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  ipm_unit_slno?: number;
  @ApiPropertyOptional({ example: 1 })
  @OptionalNumber()
  ipm_unit_factor?: number;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  ipm_is_default_unit?: boolean;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  ipm_is_big_unit?: boolean;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  ipm_is_base_unit?: boolean;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_cost_price?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_cost_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_sales_price_a?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_sales_price_b?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_sales_price_c?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_sales_price_d?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_a_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_b_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_c_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_d_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_a_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_b_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_c_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_price_d_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_max_price?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_min_price?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_disc_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_disc_qty?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_addl_cess?: number;
  @ApiProperty({ maxLength: 20, enum: ITEM_PRICE_PROFIT_TYPES })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsIn(ITEM_PRICE_PROFIT_TYPES)
  ipm_profit_type!: string;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_round_off?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_loading_charge?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_freight_charge?: number;
  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ipm_loyalty_points?: number;
  @ApiPropertyOptional({ type: String, maxLength: 250, nullable: true, example: null })
  @NullableString(250)
  ipm_uom_remarks?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 250, nullable: true, example: null })
  @NullableString(250)
  ipm_cost_remarks?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ipm_is_active?: boolean;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  ipm_sync_date?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @NullableUuid()
  ipm_created_by?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @NullableUuid()
  ipm_updated_by?: string | null;
}
