import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
export class GetItemReorderQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ir_id?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ir_item_id?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ir_branch_id?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ir_unit_id?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ir_godown_id?: string;
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ir_is_active?: boolean;
}