import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
import { OptionalQueryBoolean, OptionalTrimmedString, OptionalUuid } from 'src/common/dto/dtoDecorators';

export class ListItemReorderQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  ir_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ir_item_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ir_unit_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  ir_godown_id?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @OptionalTrimmedString(20)
  ir_reorder_type?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ir_is_active?: boolean;
}
