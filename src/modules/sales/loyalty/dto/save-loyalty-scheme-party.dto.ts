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
} from './loyalty-dto.helpers';
import { LSP_KINDS } from '../utils/loyalty.utils';

/**
 * One row of the `parties` array on POST /create.
 *
 * Read only when the header says lsc_cust_scope = 'LIST'.
 *
 * Note what is NOT here: lsp_cust_id and lsp_cust_group_id. Postgres computes
 * those from lsp_kind + lsp_scope_id and rejects any attempt to write them, so
 * the grid is two columns wide and stays that way.
 *
 * Loyalty deliberately offers no AREA or CITY kind, unlike the promotion party
 * grid: a wallet follows the person, not the route.
 */
export class LoyaltySchemePartyRowDto {
  @ApiPropertyOptional({ description: 'Present = update that row, absent = insert a new one' })
  @OptionalUuid()
  lsp_id?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  lsp_slno?: number;

  @ApiProperty({ enum: LSP_KINDS, example: 'CUSTOMER_GROUP' })
  @ValidateIf((o: LoyaltySchemePartyRowDto) => o.lsp_id === undefined || o.lsp_kind !== undefined)
  @TrimmedString(20)
  lsp_kind?: string;

  @ApiProperty({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description: 'The customer or the customer group — whichever lsp_kind names',
  })
  @ValidateIf(
    (o: LoyaltySchemePartyRowDto) => o.lsp_id === undefined || o.lsp_scope_id !== undefined,
  )
  @RequiredUuid()
  lsp_scope_id?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'An EXCLUDE row beats an INCLUDE row at equal priority',
  })
  @OptionalQueryBoolean()
  lsp_is_exclude?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 9,
    description: 'Narrowest wins. Defaults by kind when omitted: CUSTOMER 2, CUSTOMER_GROUP 1.',
  })
  @OptionalInteger(0, 9)
  lsp_match_priority?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @NullableString(65535)
  lsp_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lsp_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lsp_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lsp_modified_by?: string;
}
