import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';
import {
  NullableString,
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from './promotion-scheme-dto.helpers';
import { PRP_KINDS } from '../utils/promotion-scheme.utils';

/**
 * One row of the `parties` array on POST /create.
 *
 * Read only when the header says prm_cust_scope = 'LIST'.
 *
 * Note what is NOT here: prp_cust_id, prp_cust_group_id, prp_area_id and
 * prp_city_id. Postgres computes those from prp_kind + prp_scope_id and rejects
 * any attempt to write them, so the grid is two columns wide and stays that way.
 *
 * A CITY row reaches a customer through their AREA and only that way; a customer
 * with no cus_area_id is in no city, whatever their free-text cus_city says.
 */
export class PromotionSchemePartyRowDto {
  @ApiPropertyOptional({ description: 'Present = update that row, absent = insert a new one' })
  @OptionalUuid()
  prp_id?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  prp_slno?: number;

  @ApiProperty({ enum: PRP_KINDS, example: 'CUSTOMER_GROUP' })
  @ValidateIf((o: PromotionSchemePartyRowDto) => o.prp_id === undefined || o.prp_kind !== undefined)
  @TrimmedString(20)
  prp_kind?: string;

  @ApiProperty({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description: 'The customer, customer group, area or city — whichever prp_kind names',
  })
  @ValidateIf(
    (o: PromotionSchemePartyRowDto) => o.prp_id === undefined || o.prp_scope_id !== undefined,
  )
  @RequiredUuid()
  prp_scope_id?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'An EXCLUDE row beats an INCLUDE row at equal priority',
  })
  @OptionalQueryBoolean()
  prp_is_exclude?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 9,
    description:
      'Narrowest wins. Defaults by kind when omitted: CUSTOMER 4, AREA 3, CITY 2, ' +
      'CUSTOMER_GROUP 1.',
  })
  @OptionalInteger(0, 9)
  prp_match_priority?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @NullableString(65535)
  prp_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  prp_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prp_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prp_modified_by?: string;
}
