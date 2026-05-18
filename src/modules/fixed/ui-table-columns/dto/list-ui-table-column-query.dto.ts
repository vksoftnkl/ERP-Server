import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { FixedListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListUiTableColumnQueryDto extends FixedListQueryBaseDto {
  @ApiPropertyOptional({ description: 'Numeric UI table column id' })
  @OptionalNumberString()
  uiTblClmId?: string;

  @ApiPropertyOptional({ description: 'Numeric UI table column number' })
  @OptionalNumberString()
  uiTblClmNo?: string;

  @ApiPropertyOptional({ description: 'Numeric related UI table id' })
  @OptionalNumberString()
  uiTblClmTableId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblClmIsActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblClmColumnVisibility?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblClmColumnFocus?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  uiTblClmColumnNecessity?: boolean;
}
