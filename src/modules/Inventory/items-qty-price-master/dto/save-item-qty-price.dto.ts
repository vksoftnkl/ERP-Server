import { Transform } from 'class-transformer';
import { IsDateString, Matches, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalUpperString,
  OptionalUuid,
  RequiredUuid,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';
export class SaveItemQtyPriceDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item qty price row',
  })
  @OptionalUuid()
  iqp_id?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  iqp_company_id?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  iqp_branch_id?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Party/customer this slab is scoped to (null = applies to all)',
  })
  @NullableUuid()
  iqp_party_id?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Price level this slab applies to' })
  @NullableInteger()
  iqp_price_level?: number | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  iqp_item_id!: string;
  @ApiProperty({
    format: 'uuid',
    description:
      "A live item_unit_conversion row (iuc_id) OF iqp_item_id; another item's unit is a 400 " +
      'ITEM_QTY_PRICE_UNIT_NOT_OF_ITEM.',
  })
  @RequiredUuid()
  iqp_item_unit_id!: string;
  @ApiPropertyOptional({ example: 0, default: 0, description: 'Slab lower bound (inclusive)' })
  @OptionalNumber(0)
  iqp_from_qty?: number;
  @ApiPropertyOptional({
    example: 0,
    nullable: true,
    description: 'Slab upper bound (exclusive); null = "& above"',
  })
  @NullableNumber(0)
  iqp_to_qty?: number | null;
  @ApiPropertyOptional({
    maxLength: 1,
    default: 'P',
    description:
      "P = by % | R = by qty (flat off) | F = fixed price. The mode's own figure is required " +
      '(P: iqp_disc_pct, R: iqp_flat_off, F: iqp_price), else 400 ITEM_QTY_PRICE_VALUE_REQUIRED.',
  })
  @OptionalUpperString(1)
  @Matches(/^[PRF]$/, { message: 'iqp_price_mode must be one of P, R, F' })
  iqp_price_mode?: string;
  @ApiPropertyOptional({ example: 0, nullable: true, minimum: 0, maximum: 100 })
  @NullableNumber(0)
  @Max(100)
  iqp_disc_pct?: number | null;
  @ApiPropertyOptional({ example: 0, nullable: true })
  @NullableNumber(0)
  iqp_flat_off?: number | null;
  @ApiPropertyOptional({ example: 0, nullable: true })
  @NullableNumber(0)
  iqp_price?: number | null;
  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  iqp_is_tax_incl?: boolean;
  @ApiProperty({
    type: String,
    format: 'date',
    description: 'Slab effective-from date (inclusive)',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsDateString()
  iqp_effective_from!: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDateString()
  iqp_effective_to?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  iqp_is_active?: boolean;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @NullableDateString()
  iqp_sync_date?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  iqp_created_by?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  iqp_modified_by?: string | null;
}
