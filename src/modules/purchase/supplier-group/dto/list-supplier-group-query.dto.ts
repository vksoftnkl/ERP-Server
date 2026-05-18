import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from '../../dto/dtoDecorators';
import { PurchaseListQueryBaseDto } from '../../utils/purchase-list-query.base.dto';

export class ListSupplierGroupQueryDto extends PurchaseListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  spgIsActive?: boolean;
}
