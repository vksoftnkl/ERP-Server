import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  toOptionalBoolean,
  toOptionalDateString,
  toOptionalInteger,
  toTrimmedString,
} from './loyalty-dto.helpers';

export class ListLoyaltySchemeQueryDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  ls_comp_id?: number;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  ls_branch_id?: number;

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
  ls_type?: string;

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
