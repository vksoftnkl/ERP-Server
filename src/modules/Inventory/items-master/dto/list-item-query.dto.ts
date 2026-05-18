import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
import { OptionalQueryBoolean, OptionalTrimmedString, OptionalUuid } from 'src/common/dto/dtoDecorators';

export class ListItemQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  item_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  item_group_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  item_category_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  item_brand_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  item_section_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  item_base_unit_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  item_default_tax_id?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @OptionalTrimmedString(20)
  item_stock_type?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  item_is_active?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  item_is_service?: boolean;
}
