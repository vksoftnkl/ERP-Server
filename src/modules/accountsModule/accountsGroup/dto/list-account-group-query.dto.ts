import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { AccountsListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListAccountGroupQueryDto extends AccountsListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  accGroupCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  accGroupParentId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  accGroupIsActive?: boolean;
}
