import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltyGiftIdQueryDto } from './loyalty-gift-id-query.dto';
import { OptionalUuid } from './loyalty-dto.helpers';

export class DeleteLoyaltyGiftQueryDto extends LoyaltyGiftIdQueryDto {
  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @OptionalUuid()
  lsg_updated_by?: string;
}
