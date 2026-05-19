import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from '../../../common/dto/dtoDecorators';
import { ModuleListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';

export class ListDropdownDetailQueryDto extends ModuleListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  dropdown_show_header?: boolean;
}
