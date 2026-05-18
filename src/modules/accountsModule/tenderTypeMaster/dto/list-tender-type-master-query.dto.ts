import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from '../../dto/dtoDecorators';
import { AccountsListQueryBaseDto } from '../../utils/accounts-list-query.base.dto';

export class ListTenderTypeMasterQueryDto extends AccountsListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ttmIsActive?: boolean;
}
