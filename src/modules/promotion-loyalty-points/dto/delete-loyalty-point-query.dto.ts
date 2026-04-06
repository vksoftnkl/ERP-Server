import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { LoyaltyPointIdQueryDto } from './loyalty-point-id-query.dto';
import { toOptionalInteger } from './loyalty-dto.helpers';

export class DeleteLoyaltyPointQueryDto extends LoyaltyPointIdQueryDto {
  @ApiPropertyOptional({ minimum: 1, example: 1001 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  modified_by?: number;
}
