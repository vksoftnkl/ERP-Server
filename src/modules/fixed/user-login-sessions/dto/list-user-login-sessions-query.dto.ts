import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
} from '../../../sales/dto/dtoDecorators';
import { FixedListQueryBaseDto } from '../../utils/fixed-list-query.base.dto';

export class ListUserLoginSessionsQueryDto extends FixedListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ulsCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ulsBranchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ulsUserId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  ulsDeviceId?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @OptionalTrimmedString(20)
  ulsLoginStatus?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ulsIsActiveSession?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ulsIsActive?: boolean;
}
