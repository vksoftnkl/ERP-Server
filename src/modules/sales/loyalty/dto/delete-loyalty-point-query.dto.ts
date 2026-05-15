import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltyPointIdQueryDto } from './loyalty-point-id-query.dto';
import { OptionalUuid } from './loyalty-dto.helpers';

export class DeleteLoyaltyPointQueryDto extends LoyaltyPointIdQueryDto {
  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @OptionalUuid()
  lspt_updated_by?: string;
}
