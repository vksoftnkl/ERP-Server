import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { PurchaseListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

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
