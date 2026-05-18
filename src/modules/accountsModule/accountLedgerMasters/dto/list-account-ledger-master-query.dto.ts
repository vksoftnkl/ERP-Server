import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalTrimmedString, OptionalUuid } from '../../dto/dtoDecorators';
import { AccountsListQueryBaseDto } from '../../utils/accounts-list-query.base.dto';

export class ListAccountLedgerMasterQueryDto extends AccountsListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ledCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ledGroupId?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @OptionalTrimmedString(30)
  ledCategory?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ledIsActive?: boolean;
}
