import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalQueryBoolean } from '../../../common/dto/dtoDecorators';
import { ModuleListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';

export class ListGridColumnQueryDto extends ModuleListQueryBaseDto {
  @ApiPropertyOptional({ description: 'Numeric grid id' })
  @OptionalNumberString()
  grid_id?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  grid_column_visibility?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  grid_column_filter?: boolean;
}
