import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
} from '../../../common/dto/dtoDecorators';
import { ModuleListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';

export class ListItemCustRateQueryDto extends ModuleListQueryBaseDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @OptionalTrimmedString(120)
  declare search?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  csr_branch_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  csr_customer_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  csr_unit_rate_id?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @OptionalTrimmedString(20)
  csr_rate_type?: string;

  @ApiPropertyOptional({ maxLength: 1, description: 'A/B/C/D' })
  @OptionalUpperMaxString(1)
  csr_price_level?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  csr_is_active?: boolean;
}
