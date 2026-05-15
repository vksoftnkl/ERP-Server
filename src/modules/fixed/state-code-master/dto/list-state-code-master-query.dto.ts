import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from '../../../sales/dto/dtoDecorators';
import { FixedListQueryBaseDto } from '../../utils/fixed-list-query.base.dto';

export class ListStateCodeMasterQueryDto extends FixedListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  stateUt?: boolean;
}
