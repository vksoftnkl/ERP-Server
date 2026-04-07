import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { UUID_PATTERN, toRequiredUuid } from './loyalty-dto.helpers';

export class LoyaltySchemeIdQueryDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @Transform(({ value }) => toRequiredUuid(value))
  @Matches(UUID_PATTERN)
  ls_id!: string;
}
