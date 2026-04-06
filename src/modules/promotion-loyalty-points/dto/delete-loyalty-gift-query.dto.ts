import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { LoyaltyGiftIdQueryDto } from './loyalty-gift-id-query.dto';
import { toOptionalInteger } from './loyalty-dto.helpers';

export class DeleteLoyaltyGiftQueryDto extends LoyaltyGiftIdQueryDto {
  @ApiPropertyOptional({ minimum: 1, example: 1001 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  modified_by?: number;
}
