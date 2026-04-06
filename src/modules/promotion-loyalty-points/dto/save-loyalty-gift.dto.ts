import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';
import {
  toNullableInteger,
  toOptionalBoolean,
  toOptionalInteger,
  toOptionalNumber,
} from './loyalty-dto.helpers';

export class SaveLoyaltyGiftDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  gift_ls_id!: number;

  @ApiPropertyOptional({
    description: 'When provided with gift_ls_id, updates an existing gift rule',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  gift_slno?: number;

  @ApiProperty({ minimum: 1, example: 100 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.gift_slno === undefined || object.gift_item_id !== undefined,
  )
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  gift_item_id?: number;

  @ApiProperty({ minimum: 1, example: 1 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.gift_slno === undefined || object.gift_unit_id !== undefined,
  )
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  gift_unit_id?: number;

  @ApiProperty({ minimum: 0.0000001, example: 1 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) => object.gift_slno === undefined || object.gift_qty !== undefined,
  )
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(Number.EPSILON)
  gift_qty?: number;

  @ApiProperty({ minimum: 0.0000001, example: 100 })
  @ValidateIf(
    (object: SaveLoyaltyGiftDto) =>
      object.gift_slno === undefined || object.gift_points !== undefined,
  )
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(Number.EPSILON)
  gift_points?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gift_repeat?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gift_is_active?: boolean;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  created_by?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  modified_by?: number | null;
}
