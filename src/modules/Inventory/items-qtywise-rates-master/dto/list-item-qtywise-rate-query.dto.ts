import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
import { OptionalInteger, OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';

export class ListItemQtywiseRateQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  iqr_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  iqr_unit_rate_id?: string;

  @ApiPropertyOptional({ example: 1 })
  @OptionalInteger()
  iqr_price_level?: number;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  iqr_is_active?: boolean;
}
