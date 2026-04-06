import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { toRequiredInteger } from './loyalty-dto.helpers';

export class LoyaltySchemeIdQueryDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @Transform(({ value }) => toRequiredInteger(value))
  @IsInt()
  @Min(1)
  ls_id!: number;
}
