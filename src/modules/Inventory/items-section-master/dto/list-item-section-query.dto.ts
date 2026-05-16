import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from '../../utils/inventory-list-query.base.dto';
import { OptionalQueryBoolean, OptionalUuid } from '../../utils/inventory-dto.decorators';

export class ListItemSectionQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  sec_parent_id?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  sec_is_active?: boolean;
}
