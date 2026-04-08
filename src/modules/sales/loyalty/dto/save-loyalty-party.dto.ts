import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  UUID_PATTERN,
  toNullableUuid,
  toOptionalBoolean,
  toOptionalInteger,
  toOptionalUuid,
  toRequiredUuid,
  toTrimmedString,
} from './loyalty-dto.helpers';

const LOYALTY_PARTY_SCOPE_TYPES = ['CUSTOMER_GROUP', 'CUSTOMER'] as const;

export class SaveLoyaltyPartyDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty party scope row',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lps_id?: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lps_ls_id?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  lps_slno?: number;

  @ApiProperty({ example: 'CUSTOMER_GROUP', enum: LOYALTY_PARTY_SCOPE_TYPES })
  @ValidateIf(
    (object: SaveLoyaltyPartyDto) =>
      object.lps_id === undefined || object.lps_scope_type !== undefined,
  )
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(30)
  @IsIn(LOYALTY_PARTY_SCOPE_TYPES)
  lps_scope_type?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyPartyDto) => object.lps_id === undefined || object.lps_scope_id !== undefined,
  )
  @Transform(({ value }) => toRequiredUuid(value))
  @Matches(UUID_PATTERN)
  lps_scope_id?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  lps_is_exclude?: boolean;

  @ApiPropertyOptional({ maxLength: 65535, nullable: true })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  lps_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  lps_is_active?: boolean;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lps_created_by?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  lps_updated_by?: string | null;
}
