import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from '../../utils/inventory-list-query.base.dto';
import { OptionalQueryBoolean, OptionalUuid } from '../../utils/inventory-dto.decorators';

export class ListItemEanCodeQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ean_item_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ean_unit_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  ean_godown_id?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ean_is_active?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ean_is_default?: boolean;
}
