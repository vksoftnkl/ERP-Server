import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalTrimmedString } from '../../../common/dto/dtoDecorators';

export class ListGridDetailQueryDto {
  @ApiPropertyOptional({ description: 'Grid id — selects a specific configured grid for display' })
  @OptionalNumberString()
  gridId?: string;

  @ApiHideProperty()
  @OptionalNumberString()
  grid_id?: string;

  @ApiPropertyOptional({ maxLength: 255, description: 'Search by grid name or description' })
  @OptionalTrimmedString(255)
  search?: string;
}
