import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from '../../utils/inventory-list-query.base.dto';
import { OptionalDateString, OptionalUuid } from '../../utils/inventory-dto.decorators';

export class ListItemTaxHistoryQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ith_item_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ith_tax_id?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @OptionalDateString()
  ith_effective_from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @OptionalDateString()
  ith_effective_to?: string;
}
