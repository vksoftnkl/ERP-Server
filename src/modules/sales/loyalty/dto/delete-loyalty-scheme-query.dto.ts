import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltySchemeIdQueryDto } from './loyalty-scheme-id-query.dto';
import { OptionalUuid } from './loyalty-dto.helpers';

export class DeleteLoyaltySchemeQueryDto extends LoyaltySchemeIdQueryDto {
  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @OptionalUuid()
  ls_updated_by?: string;
}
