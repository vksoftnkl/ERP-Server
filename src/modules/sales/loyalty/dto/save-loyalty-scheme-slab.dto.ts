import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
} from './loyalty-dto.helpers';

/**
 * One row of the `slabs` array on POST /create — one earn BAND, not one scheme:
 * 0-999 -> 1pt/100, 1000-4999 -> 2pt/100, 5000+ -> 3pt/100 is three rows, not
 * three columns.
 *
 * Read as: for every lss_each units above lss_exceeds, award lss_points, scaled
 * by lss_factor. "units" are RUPEES when the header's lsc_apply_on is
 * BILL_AMOUNT or ITEM_AMOUNT, and QUANTITY when it is BILL_QTY or ITEM_QTY —
 * one column pair serving both.
 *
 * lss_item_id narrows a band to ONE item; leave it null for a whole-bill band.
 * Anything broader than one item (group, brand, category) belongs in the
 * `items` array, which multiplies what this computes.
 */
export class LoyaltySchemeSlabRowDto {
  @ApiPropertyOptional({ description: 'Present = update that row, absent = insert a new one' })
  @OptionalUuid()
  lss_id?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  lss_slno?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'inventory.item_master(item_id). NULL = the band applies to the whole bill.',
  })
  @NullableUuid()
  lss_item_id?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'inventory.item_unit_conversion(iuc_id) — the same target a bill line uses, NOT ' +
      'item_unit_master(unit_id).',
  })
  @NullableUuid()
  lss_unit_id?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Band lower bound. Rupees for an *_AMOUNT trigger, quantity for a *_QTY one.',
  })
  @OptionalNumber(0)
  lss_exceeds?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Band ceiling. NULL = open-ended.',
  })
  @NullableNumber(0)
  lss_upto?: number | null;

  @ApiPropertyOptional({ default: 1, description: 'Granularity — points are awarded per this' })
  @OptionalNumber(0)
  lss_each?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'Awarded per lss_each' })
  @OptionalNumber(0)
  lss_points?: number;

  @ApiPropertyOptional({ default: 1 })
  @OptionalNumber(0)
  lss_factor?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = uncapped' })
  @OptionalNumber(0)
  lss_max_points?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @NullableString(65535)
  lss_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lss_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lss_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lss_modified_by?: string;
}
