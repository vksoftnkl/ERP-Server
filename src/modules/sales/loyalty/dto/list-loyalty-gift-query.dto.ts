import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalQueryInt, RequiredUuid } from './loyalty-dto.helpers';

export class ListLoyaltyGiftQueryDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  lsg_ls_id!: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @OptionalQueryBoolean()
  lsg_is_active?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalQueryInt(1, 100)
  limit?: number;
}
