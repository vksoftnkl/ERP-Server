import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from '../../dto/dtoDecorators';
import { SalesListQueryBaseDto } from '../../utils/sales-list-query.base.dto';

export class ListCityQueryDto extends SalesListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ctmStateId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ctmIsActive?: boolean;
}
