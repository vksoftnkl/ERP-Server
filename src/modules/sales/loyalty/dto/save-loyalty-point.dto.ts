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

export class SaveLoyaltyPointDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty point slab',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lspt_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyPointDto) =>
      object.lspt_id === undefined || object.lspt_ls_id !== undefined,
  )
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lspt_ls_id?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  lspt_slno?: number;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lspt_item_id?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lspt_unit_id?: string | null;

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
  @Min(Number.EPSILON)
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

  @ApiPropertyOptional({ maxLength: 65535, nullable: true })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  lspt_notes?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lspt_created_by?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lspt_updated_by?: string | null;
}
