import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalInteger, OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class GetItemQtyPriceQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iqp_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iqp_item_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iqp_item_unit_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iqp_company_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iqp_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iqp_party_id?: string;

  @ApiPropertyOptional({ description: 'Price level filter' })
  @OptionalInteger()
  iqp_price_level?: number;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  iqp_is_active?: boolean;
}
