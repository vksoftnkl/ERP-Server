import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';
import {
  NullableDateString,
  NullableString,
  OptionalInteger,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from './loyalty-dto.helpers';

/**
 * One row of the `gifts` array on POST /create — the CATALOGUE of what points
 * may be exchanged for. What was actually handed over is a separate movement
 * record, not this.
 *
 * A gift redemption is NOT a tender: no money crosses the counter, stock does.
 * lsg_unit_id therefore references inventory.item_unit_conversion(iuc_id), the
 * same target sale_bill_item.fk_sbi_item_unit uses, because the gift becomes a
 * bill line and the two must agree without a conversion lookup.
 */
export class LoyaltySchemeGiftRowDto {
  @ApiPropertyOptional({ description: 'Present = update that row, absent = insert a new one' })
  @OptionalUuid()
  lsg_id?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  lsg_slno?: number;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf((o: LoyaltySchemeGiftRowDto) => o.lsg_id === undefined || o.lsg_item_id !== undefined)
  @RequiredUuid()
  lsg_item_id?: string;

  @ApiProperty({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description: 'inventory.item_unit_conversion(iuc_id), as on a bill line',
  })
  @ValidateIf((o: LoyaltySchemeGiftRowDto) => o.lsg_id === undefined || o.lsg_unit_id !== undefined)
  @RequiredUuid()
  lsg_unit_id?: string;

  @ApiPropertyOptional({ default: 1, description: 'How much stock one claim hands over' })
  @OptionalNumber(0)
  lsg_item_qty?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'What the claim costs in points' })
  @OptionalNumber(0)
  lsg_redeem_points?: number;

  @ApiPropertyOptional({ default: false, description: 'Claimable more than once' })
  @OptionalQueryBoolean()
  lsg_repeat?: boolean;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = uncapped' })
  @OptionalNumber(0)
  lsg_max_qty_per_bill?: number;

  @ApiPropertyOptional({
    default: true,
    description:
      'Refuse the claim when the issuing branch has no stock of it — a gift the shop cannot ' +
      'hand over is worse than one it never offered',
  })
  @OptionalQueryBoolean()
  lsg_stock_check?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2025-10-01' })
  @NullableDateString()
  lsg_valid_from?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2025-10-31' })
  @NullableDateString()
  lsg_valid_upto?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @NullableString(65535)
  lsg_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lsg_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lsg_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lsg_modified_by?: string;
}
