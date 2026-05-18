import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { FixedListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListUiTableMasterQueryDto extends FixedListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblEditable?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblIsActive?: boolean;
}
