import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalLowerMaxString, OptionalUuid } from 'src/common/dto/dtoDecorators';

/**
 * Who is asking. Every id is optional and additive: a layer whose id is absent
 * simply never matches, so a caller that knows only its company resolves
 * GLOBAL + COMPANY and nothing deeper.
 *
 * The ids are NOT inferred from each other — passing a branch does not imply
 * its company — because an override row carries only its own target, so each
 * layer is looked up by the id the caller states.
 */
export class ResolveAppSettingsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'fixed.device_master.dev_id — the till asking',
  })
  @OptionalUuid()
  deviceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  userId?: string;
}

export class ResolveOneAppSettingQueryDto extends ResolveAppSettingsQueryDto {
  @ApiPropertyOptional({ maxLength: 80, example: 'sales.max_discount_percent' })
  @OptionalLowerMaxString(80)
  key?: string;
}
