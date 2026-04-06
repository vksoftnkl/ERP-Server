import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';
import {
  toNullableInteger,
  toOptionalBoolean,
  toOptionalInteger,
  toOptionalNumber,
} from './loyalty-dto.helpers';

export class SaveLoyaltyPointDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty point slab',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  lspt_id?: number;

  @ApiProperty({ minimum: 1, example: 1 })
  @ValidateIf(
    (object: SaveLoyaltyPointDto) =>
      object.lspt_id === undefined || object.lspt_ls_id !== undefined,
  )
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  lspt_ls_id?: number;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  lspt_slno?: number;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  lspt_item_id?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  lspt_unit_id?: number | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  lspt_exceeds?: number;

  @ApiPropertyOptional({ minimum: 0.0000001, default: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(Number.EPSILON)
  lspt_each?: number;

  @ApiPropertyOptional({ minimum: 0, default: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  lspt_factor?: number;

  @ApiProperty({ minimum: 0, example: 10 })
  @ValidateIf(
    (object: SaveLoyaltyPointDto) =>
      object.lspt_id === undefined || object.lspt_points !== undefined,
  )
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  lspt_points?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  lspt_is_active?: boolean;

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
