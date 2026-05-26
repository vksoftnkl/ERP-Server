import { Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalTrimmedString,
  OptionalUuid,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';

const toUuidArray = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)))
            .filter((entry) => entry.length > 0);
        }
      } catch {
        return [trimmed];
      }
    }

    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [value as string];
};

export class SaveItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item row',
  })
  @OptionalUuid()
  item_id?: string;

  @ApiProperty({ format: 'uuid', description: 'Company UUID this item belongs to' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsUUID('all')
  item_company_id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_branch_id?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  item_code?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  item_sku?: string | null;

  @ApiProperty({ maxLength: 200 })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  item_name_en!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  item_name_ta?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  item_alias?: string | null;

  @ApiPropertyOptional({ maxLength: 20, default: 'FG' })
  @OptionalTrimmedString(20)
  item_stock_type?: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  item_default_barcode?: string | null;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  item_group_id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_category_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_brand_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_section_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_company_category_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_mfgr_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_supplier_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_cust_group?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_base_unit_id?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_is_service?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_is_batch_based?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_is_expiry_item?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @OptionalInteger()
  item_expiry_days?: number;

  @ApiPropertyOptional({ nullable: true })
  @OptionalInteger()
  item_intimate_before_days?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_allow_sales?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_allow_sales_return?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_allow_purchase?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_allow_po?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_allow_so?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_allow_neg_stock?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_allow_negative_so?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_price_list?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_weigh_scale?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_retail_item?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_is_kit?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_auto_break?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_auto_make?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_allow_loyalty?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_allow_promo?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_has_offer?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_damagable_product?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_is_demand?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_allow_loading?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_allow_freight?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_random_stock?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  item_barcode_sticker?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_barcode_sticker_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  item_default_tax_id?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  item_hsn_code?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  item_batch_config?: number;

  @ApiPropertyOptional({ nullable: true })
  @OptionalInteger()
  item_sort_order?: number;

  @ApiPropertyOptional({ nullable: true, description: 'Base64-encoded image bytes' })
  @NullableString()
  item_photo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  item_image_url?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  item_notes?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  item_storage_location?: string | null;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    nullable: true,
    description: 'Can be UUID array, JSON array string, or comma-separated string',
  })
  @Transform(({ value }) => toUuidArray(value))
  @IsArray()
  @IsUUID('all', { each: true })
  item_packing_item_ids?: string[];

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  item_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  item_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  item_modified_by?: string | null;
}
