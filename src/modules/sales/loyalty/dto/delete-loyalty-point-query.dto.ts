import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import { LoyaltyPointIdQueryDto } from './loyalty-point-id-query.dto';
import { UUID_PATTERN, toOptionalUuid } from './loyalty-dto.helpers';

export class DeleteLoyaltyPointQueryDto extends LoyaltyPointIdQueryDto {
  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  lspt_updated_by?: string;
}
