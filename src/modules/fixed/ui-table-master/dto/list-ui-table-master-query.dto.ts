import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalTrimmedString } from 'src/common/dto/dtoDecorators';
export class ListUiTableMasterQueryDto {
  @ApiPropertyOptional({ description: 'UI table id — selects a specific configured grid for display' })
  @OptionalNumberString()
  uiTableId?: string;

  @ApiHideProperty()
  @OptionalNumberString()
  uiTblId?: string;

  @ApiPropertyOptional({ maxLength: 255, description: 'Search by UI table name' })
  @OptionalTrimmedString(255)
  search?: string;
}
