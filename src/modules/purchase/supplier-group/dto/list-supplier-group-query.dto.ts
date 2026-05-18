import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { PurchaseListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListSupplierGroupQueryDto extends PurchaseListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  spgIsActive?: boolean;
}
