import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { AccountsListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListLedgerBankAccountQueryDto extends AccountsListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lbaCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lbaLedgerId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  lbaIsActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  lbaIsDefault?: boolean;
}
