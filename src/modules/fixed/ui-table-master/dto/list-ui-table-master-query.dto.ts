import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { FixedListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
export class ListUiTableMasterQueryDto extends FixedListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblEditable?: boolean;
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblIsActive?: boolean;
  @ApiPropertyOptional({ description: 'UI table id — selects a specific configured grid for display' })
  @OptionalNumberString()
  uiTableId?: string;
  @ApiPropertyOptional({ description: 'UI column id — column-level view configuration' })
  @OptionalNumberString()
  uiColumnId?: string;
  @ApiPropertyOptional({ type: Boolean, description: 'Filter columns by active status. Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblClmIsActive?: boolean;
}