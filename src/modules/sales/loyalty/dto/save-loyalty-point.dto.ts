import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, ValidateIf } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
  toOptionalNumber,
} from './loyalty-dto.helpers';

export class SaveLoyaltyPointDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty point slab',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @OptionalUuid()
  lspt_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyPointDto) =>
      object.lspt_id === undefined || object.lspt_ls_id !== undefined,
  )
  @RequiredUuid()
  lspt_ls_id?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @OptionalInteger(1)
  lspt_slno?: number;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lspt_item_id?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lspt_unit_id?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @OptionalNumber(0)
  lspt_exceeds?: number;

  @ApiPropertyOptional({ minimum: 0.0000001, default: 1 })
  @OptionalNumber(Number.EPSILON)
  lspt_each?: number;

  @ApiPropertyOptional({ minimum: 0, default: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  lspt_factor?: number;

  @ApiProperty({ minimum: 0, example: 10 })
  @ValidateIf(
    (object: SaveLoyaltyPointDto) =>
      object.lspt_id === undefined || object.lspt_points !== undefined,
  )
  @RequiredNumber(0)
  lspt_points?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lspt_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 65535, nullable: true })
  @NullableString(65535)
  lspt_notes?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lspt_created_by?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lspt_updated_by?: string | null;
}
