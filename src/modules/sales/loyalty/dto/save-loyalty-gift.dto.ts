import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  UUID_PATTERN,
  toOptionalBoolean,
  toOptionalInteger,
  toOptionalNumber,
  toOptionalUuid,
  toNullableUuid,
} from './loyalty-dto.helpers';

export class SaveLoyaltyGiftDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty gift rule',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lsg_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) => object.lsg_id === undefined || object.lsg_ls_id !== undefined,
  )
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lsg_ls_id?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  lsg_slno?: number;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.lsg_id === undefined || object.lsg_item_id !== undefined,
  )
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lsg_item_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.lsg_id === undefined || object.lsg_unit_id !== undefined,
  )
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lsg_unit_id?: string;

  @ApiProperty({ minimum: 0.0000001, example: 1 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.lsg_id === undefined || object.lsg_item_qty !== undefined,
  )
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(Number.EPSILON)
  lsg_item_qty?: number;

  @ApiProperty({ minimum: 0, example: 100 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.lsg_id === undefined || object.lsg_redeem_points !== undefined,
  )
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  lsg_redeem_points?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  lsg_repeat?: boolean;

  @ApiPropertyOptional({ maxLength: 65535, nullable: true })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  lsg_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  lsg_is_active?: boolean;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lsg_created_by?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lsg_updated_by?: string | null;
}
