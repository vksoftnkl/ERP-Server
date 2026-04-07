import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  UUID_PATTERN,
  toOptionalBoolean,
  toOptionalDateString,
  toOptionalInteger,
  toOptionalUuid,
  toTrimmedString,
} from './loyalty-dto.helpers';

const LOYALTY_SCHEME_TYPES = ['REDEEM', 'BOTH', 'GIFT'] as const;
const LOYALTY_SCHEME_STATUSES = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const;

export class ListLoyaltySchemeQueryDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  ls_comp_id?: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  ls_branch_id?: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 20, example: 'GENERAL' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_TYPES)
  ls_type?: string;

  @ApiPropertyOptional({ maxLength: 20, example: 'ACTIVE' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_STATUSES)
  ls_status?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Transform(({ value }) => toOptionalDateString(value))
  @IsDateString()
  ls_start_date_from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Transform(({ value }) => toOptionalDateString(value))
  @IsDateString()
  ls_start_date_to?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Transform(({ value }) => toOptionalDateString(value))
  @IsDateString()
  ls_end_date_from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Transform(({ value }) => toOptionalDateString(value))
  @IsDateString()
  ls_end_date_to?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
