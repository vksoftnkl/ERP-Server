import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalTrimmedString } from '../../../common/dto/dtoDecorators';

export class ListDropdownDetailQueryDto {
  @ApiPropertyOptional({ description: 'Dropdown id — selects a specific configured dropdown' })
  @OptionalNumberString()
  dropdownId?: string;

  @ApiHideProperty()
  @OptionalNumberString()
  dropdown_id?: string;

  @ApiPropertyOptional({ maxLength: 255, description: 'Search by dropdown name or description' })
  @OptionalTrimmedString(255)
  search?: string;
}
