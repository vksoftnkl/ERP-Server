import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import {
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from './promotion-scheme-dto.helpers';
import { PRM_BENEFITS } from '../utils/promotion-scheme.utils';

export class PromotionSchemeSlabRowDto {
  @ApiPropertyOptional({ description: 'Present = update that row, absent = insert a new one' })
  @OptionalUuid()
  prs_id?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  prs_slno?: number;

  @ApiPropertyOptional({
    enum: PRM_BENEFITS,
    description:
      "Mirrors the header's prm_benefit and is defaulted from it when omitted. Sending a " +
      'different value is rejected — the composite foreign key would refuse the row anyway.',
  })
  @OptionalTrimmedString(20)
  prs_benefit?: string;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Lower bound. Rupees for a *_AMOUNT trigger, quantity for a *_QTY one.',
  })
  @OptionalNumber(0)
  prs_exceeds?: number;

  @ApiPropertyOptional({ nullable: true, description: 'Ceiling. NULL = open-ended.' })
  @NullableNumber(0)
  prs_upto?: number | null;

  @ApiPropertyOptional({ default: 1, description: 'Granularity when repeating' })
  @OptionalNumber(0)
  prs_each?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Give the benefit once per prs_each above prs_exceeds, not once in total',
  })
  @OptionalQueryBoolean()
  prs_is_repeat?: boolean;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = unlimited within the band' })
  @OptionalInteger(0)
  prs_max_repeats?: number;

  @ApiPropertyOptional({ nullable: true, description: 'FREE_ITEM only' })
  @NullableUuid()
  prs_free_item_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'FREE_ITEM only. Required whenever prs_free_item_id is set, and vice versa.',
  })
  @NullableUuid()
  prs_free_unit_id?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @OptionalNumber(0)
  prs_free_qty?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Refuse the free issue when the branch has no stock of it',
  })
  @OptionalQueryBoolean()
  prs_free_stock_check?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0, description: 'DISC_PERC only' })
  @OptionalNumber(0)
  prs_disc_perc?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'DISC_AMT stated as rupees off PER UNIT',
  })
  @OptionalNumber(0)
  prs_disc_qty?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'DISC_AMT stated as flat rupees off the line',
  })
  @OptionalNumber(0)
  prs_disc_amt?: number;

  @ApiPropertyOptional({ nullable: true, description: 'FIXED_PRICE only' })
  @NullableNumber(0)
  prs_fixed_price?: number | null;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = uncapped, per band' })
  @OptionalNumber(0)
  prs_max_benefit_amt?: number;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(65535)
  prs_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  prs_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prs_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prs_modified_by?: string;
}

/**
 * The offer bands. Upsert semantics — see SavePromotionSchemeBranchesDto.
 *
 * One row = one band: 0-999 -> 2%, 1000-4999 -> 5%, 5000+ -> 8% is three rows,
 * not three columns.
 *
 * Which of the benefit columns you fill is decided by the HEADER's prm_benefit,
 * and the service checks the whole matrix before writing: a DISC_PERC scheme
 * needs prs_disc_perc > 0 and everything else empty, a FREE_ITEM scheme needs an
 * item, a unit and a quantity, DISC_AMT needs exactly one of prs_disc_amt or
 * prs_disc_qty, FIXED_PRICE needs prs_fixed_price.
 */
export class SavePromotionSchemeSlabsDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  prm_id!: string;

  @ApiProperty({ type: [PromotionSchemeSlabRowDto] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PromotionSchemeSlabRowDto)
  slabs!: PromotionSchemeSlabRowDto[];
}
