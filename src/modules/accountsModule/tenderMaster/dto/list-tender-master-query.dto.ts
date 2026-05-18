import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalNumberString, OptionalQueryBoolean, OptionalUuid } from '../../dto/dtoDecorators';
import { AccountsListQueryBaseDto } from '../../utils/accounts-list-query.base.dto';
export class ListTenderMasterQueryDto extends AccountsListQueryBaseDto {
  @ApiPropertyOptional({ example: '1' })
  @OptionalNumberString()
  tndTypeId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  tndLedgerId?: string;
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  tndIsActive?: boolean;
}