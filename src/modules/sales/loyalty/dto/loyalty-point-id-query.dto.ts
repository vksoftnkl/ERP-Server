import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from './loyalty-dto.helpers';

export class LoyaltyPointIdQueryDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  lspt_id!: string;
}
