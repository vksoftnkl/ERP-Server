import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalQueryBoolean } from '../../../common/dto/dtoDecorators';
import { FixedListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';

export class ListGridDetailQueryDto extends FixedListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  grid_status?: boolean;

  @ApiPropertyOptional({ description: 'Grid id — selects a specific configured grid for display' })
  @OptionalNumberString()
  gridId?: string;

  @ApiPropertyOptional({ description: 'Grid serial id — filters columns to a specific column row' })
  @OptionalNumberString()
  grid_serial_id?: string;
}
