import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import {
  UUID_PATTERN,
  toOptionalBoolean,
  toOptionalInteger,
  toRequiredUuid,
} from './loyalty-dto.helpers';

export class ListLoyaltyPointQueryDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @Transform(({ value }) => toRequiredUuid(value))
  @Matches(UUID_PATTERN)
  lspt_ls_id!: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  lspt_is_active?: boolean;

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
