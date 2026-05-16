import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from '../../utils/inventory-list-query.base.dto';
import { OptionalQueryBoolean, OptionalUuid } from '../../utils/inventory-dto.decorators';

export class ListOrGetGodownQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'When present, get a single location by id' })
  @OptionalUuid()
  gdl_id?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  gdl_is_active?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  gdl_godown_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  gdl_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  gdl_parent_id?: string;
}
