import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
import { OptionalQueryBoolean, OptionalTrimmedString } from 'src/common/dto/dtoDecorators';

export class ListItemTaxQueryDto extends InventoryListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  tax_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 30 })
  @OptionalTrimmedString(30)
  tax_taxability_type?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  tax_is_reverse_charge?: boolean;
}
