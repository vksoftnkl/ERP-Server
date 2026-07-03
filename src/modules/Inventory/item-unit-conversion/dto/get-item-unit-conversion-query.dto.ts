import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class GetItemUnitConversionQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_item_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iuc_company_id?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  iuc_is_active?: boolean;
}
