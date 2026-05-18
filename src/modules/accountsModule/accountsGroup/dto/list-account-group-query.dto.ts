import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from '../../dto/dtoDecorators';
import { AccountsListQueryBaseDto } from '../../utils/accounts-list-query.base.dto';

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
