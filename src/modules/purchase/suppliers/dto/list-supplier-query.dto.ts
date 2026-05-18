import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from '../../dto/dtoDecorators';
import { PurchaseListQueryBaseDto } from '../../utils/purchase-list-query.base.dto';

export class ListSupplierQueryDto extends PurchaseListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  supCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  supGroupId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  supIsActive?: boolean;
}
