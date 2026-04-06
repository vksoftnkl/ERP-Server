import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { toOptionalBoolean, toOptionalInteger, toRequiredInteger } from './loyalty-dto.helpers';

export class ListLoyaltyGiftQueryDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @Transform(({ value }) => toRequiredInteger(value))
  @IsInt()
  @Min(1)
  gift_ls_id!: number;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  gift_is_active?: boolean;

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
