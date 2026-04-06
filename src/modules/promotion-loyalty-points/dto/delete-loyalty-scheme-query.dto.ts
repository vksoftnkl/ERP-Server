import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { LoyaltySchemeIdQueryDto } from './loyalty-scheme-id-query.dto';
import { toOptionalInteger } from './loyalty-dto.helpers';

export class DeleteLoyaltySchemeQueryDto extends LoyaltySchemeIdQueryDto {
  @ApiPropertyOptional({ minimum: 1, example: 1001 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  modified_by?: number;
}
