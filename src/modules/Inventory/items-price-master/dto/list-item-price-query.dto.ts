import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
import { OptionalQueryBoolean, OptionalTrimmedString, OptionalUuid } from 'src/common/dto/dtoDecorators';

export class ListItemPriceQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ipm_company_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ipm_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ipm_item_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ipm_unit_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ipm_godown_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ipm_base_unit_id?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @OptionalTrimmedString(20)
  ipm_profit_type?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ipm_is_active?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ipm_is_deleted?: boolean;
}
