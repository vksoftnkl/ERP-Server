import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
const ITEM_PRICE_PROFIT_TYPES = ['BY_PERCENT', 'BY_AMOUNT', 'MANUAL'] as const;

const unwrapScalarValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const nestedValue =
    record.value ?? record.id ?? record._id ?? record.code ?? record.name ?? record.label;

  return nestedValue === undefined ? undefined : nestedValue;
};

const toOptionalUuid = (value: unknown): string | undefined => {
  const normalizedValue = unwrapScalarValue(value);
  if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
    return undefined;
  }
  if (typeof normalizedValue === 'string') {
    const trimmed = normalizedValue.trim();
    return trimmed || undefined;
  }
  return normalizedValue as string;
};
const toNullableUuid = (value: unknown): string | null | undefined => {
  const normalizedValue = unwrapScalarValue(value);
  if (normalizedValue === undefined) {
    return undefined;
  }
  if (normalizedValue === null || normalizedValue === '') {
    return null;
  }
  if (typeof normalizedValue === 'string') {
    const trimmed = normalizedValue.trim();
    return trimmed || null;
  }
  return normalizedValue as string;
};
const toRequiredTrimmedString = (value: unknown): string => {
  const normalizedValue = unwrapScalarValue(value);
  if (typeof normalizedValue !== 'string') {
    return normalizedValue as string;
  }
  return normalizedValue.trim();
};
const toNullableString = (value: unknown): string | null | undefined => {
  const normalizedValue = unwrapScalarValue(value);
  if (normalizedValue === undefined) {
    return undefined;
  }
  if (normalizedValue === null) {
    return null;
  }
  if (typeof normalizedValue !== 'string') {
    return normalizedValue as string;
  }
  const trimmed = normalizedValue.trim();
  return trimmed || null;
};
const toOptionalBoolean = (value: unknown): boolean | undefined => {
  const normalizedValue = unwrapScalarValue(value);
  if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
    return undefined;
  }
  if (typeof normalizedValue === 'boolean') {
    return normalizedValue;
  }
  if (typeof normalizedValue === 'string') {
    const normalized = normalizedValue.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return normalizedValue as boolean;
};
const toOptionalNumber = (value: unknown): number | undefined => {
  const normalizedValue = unwrapScalarValue(value);
  if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
    return undefined;
  }
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : (normalizedValue as number);
};
export class SaveItemPriceDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item price row',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  ipm_id?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ipm_company_id?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ipm_branch_id?: string | null;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ipm_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ipm_unit_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ipm_godown_id!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ipm_base_unit_id?: string | null;
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_to_base_factor?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  ipm_unit_slno?: number;
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_unit_factor?: number;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ipm_is_default_unit?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ipm_is_big_unit?: boolean;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ipm_is_base_unit?: boolean;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_cost_price?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_cost_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_sales_price_a?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_sales_price_b?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_sales_price_c?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_sales_price_d?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_a_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_b_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_c_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_d_wot?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_a_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_b_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_c_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_price_d_markup_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_max_price?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_min_price?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_disc_perc?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_disc_qty?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_addl_cess?: number;
  @ApiProperty({ maxLength: 20, enum: ITEM_PRICE_PROFIT_TYPES })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsIn(ITEM_PRICE_PROFIT_TYPES)
  ipm_profit_type!: string;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_round_off?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_loading_charge?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_freight_charge?: number;
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  ipm_loyalty_points?: number;
  @ApiPropertyOptional({ type: String, maxLength: 250, nullable: true, example: null })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  ipm_uom_remarks?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 250, nullable: true, example: null })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  ipm_cost_remarks?: string | null;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ipm_is_active?: boolean;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  ipm_sync_date?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ipm_created_by?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ipm_updated_by?: string | null;
}
