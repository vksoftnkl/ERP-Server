import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalDateString, OptionalQueryBoolean, OptionalQueryInt, OptionalTrimmedString, OptionalUuid } from '../../../common/dto/dtoDecorators';
import { ModuleListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';

export class ListAuditLogQueryDto extends ModuleListQueryBaseDto {
  @ApiPropertyOptional({
    description: 'Supports New/insert/update/approve/cancel',
    maxLength: 20,
  })
  @OptionalTrimmedString(20)
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by audit screen id', minimum: 1 })
  @OptionalQueryInt(1)
  screen_id?: number;

  @ApiPropertyOptional({ description: 'Filter by exact audit screen name', maxLength: 200 })
  @OptionalTrimmedString(200)
  screen_name?: string;

  @ApiPropertyOptional({ description: 'Filter by exact audit primary key value', maxLength: 200 })
  @OptionalTrimmedString(200)
  record_pk?: string;

  @ApiPropertyOptional({
    description: 'Start date/time (ISO). Date-only (YYYY-MM-DD) is accepted.',
  })
  @OptionalDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End date/time (ISO). Date-only (YYYY-MM-DD) is accepted.',
  })
  @OptionalDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'UUID v7 cursor from previous page next_cursor. Skips page/total when provided.',
    format: 'uuid',
  })
  @OptionalUuid()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Set to true to include total count. Omit to skip the COUNT(*) query.',
  })
  @OptionalQueryBoolean()
  include_total?: boolean;
}
