import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from '../../utils/inventory-list-query.base.dto';
import { OptionalQueryBoolean, OptionalUuid } from '../../utils/inventory-dto.decorators';

export class ListItemUnitConversionQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_company_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_item_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_unit_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_base_unit_id?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Supports true/false/1/0/yes/no/on/off',
  })
  @OptionalQueryBoolean()
  iuc_is_default_unit?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Supports true/false/1/0/yes/no/on/off',
  })
  @OptionalQueryBoolean()
  iuc_is_base_unit?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Supports true/false/1/0/yes/no/on/off',
  })
  @OptionalQueryBoolean()
  iuc_is_big_unit?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Supports true/false/1/0/yes/no/on/off',
  })
  @OptionalQueryBoolean()
  iuc_is_active?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Supports true/false/1/0/yes/no/on/off',
  })
  @OptionalQueryBoolean()
  iuc_is_deleted?: boolean;
}
