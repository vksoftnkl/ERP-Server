import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
} from './loyalty-dto.helpers';

export class SaveLoyaltyGiftDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty gift rule',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @OptionalUuid()
  lsg_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) => object.lsg_id === undefined || object.lsg_ls_id !== undefined,
  )
  @RequiredUuid()
  lsg_ls_id?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @OptionalInteger(1)
  lsg_slno?: number;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) => object.lsg_id === undefined || object.lsg_item_id !== undefined,
  )
  @RequiredUuid()
  lsg_item_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) => object.lsg_id === undefined || object.lsg_unit_id !== undefined,
  )
  @RequiredUuid()
  lsg_unit_id?: string;

  @ApiProperty({ minimum: 0.0000001, example: 1 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.lsg_id === undefined || object.lsg_item_qty !== undefined,
  )
  @RequiredNumber(Number.EPSILON)
  lsg_item_qty?: number;

  @ApiProperty({ minimum: 0, example: 100 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.lsg_id === undefined || object.lsg_redeem_points !== undefined,
  )
  @RequiredNumber(0)
  lsg_redeem_points?: number;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  lsg_repeat?: boolean;

  @ApiPropertyOptional({ maxLength: 65535, nullable: true })
  @NullableString(65535)
  lsg_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lsg_is_active?: boolean;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lsg_created_by?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lsg_updated_by?: string | null;
}
