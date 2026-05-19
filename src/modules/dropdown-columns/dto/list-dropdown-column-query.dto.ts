import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalQueryBoolean } from '../../../common/dto/dtoDecorators';
import { ModuleListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';
export class ListDropdownColumnQueryDto extends ModuleListQueryBaseDto {
  @ApiPropertyOptional({ description: 'Numeric dropdown id' })
  @OptionalNumberString()
  dropdown_id?: string;
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  drop_columns_column_visiblity?: boolean;
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  drop_columns_column_filter?: boolean;
}