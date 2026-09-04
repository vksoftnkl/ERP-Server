import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalDate,
  OptionalLowerMaxString,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import { AppSettingScope } from '../types/app-settings-api.types';

/**
 * One override. Send the setting key, the scope, and the id that scope names —
 * the OTHER id columns must be absent, because ck_asv_scope_ids allows an
 * override to carry its target and nothing else.
 *
 * Writing is an UPSERT on (asvSettingKey, target): posting the same scope
 * target twice moves the existing row rather than answering 409, which is what
 * a settings screen means by "save". Resetting is DELETE, never a write of the
 * default value.
 */
export class SaveAppSettingValueDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'When provided, updates that override in place. The key and the scope target are ' +
      'immutable — pointing an override at a different setting or a different branch is a ' +
      'delete plus a create, not an edit',
  })
  @OptionalUuid()
  asvId?: string;

  @ApiPropertyOptional({
    maxLength: 80,
    example: 'sales.max_discount_percent',
    description: 'app_setting_def.asdKey. Required unless asvId is sent',
  })
  @OptionalLowerMaxString(80)
  asvSettingKey?: string;

  @ApiPropertyOptional({
    enum: AppSettingScope,
    enumName: 'AppSettingScope',
    description:
      'Which layer this override sits in. Required unless asvId is sent, and may not be deeper ' +
      'than the setting’s asdMaxScope',
  })
  @OptionalUpperMaxString(10)
  @IsEnum(AppSettingScope)
  asvScope?: AppSettingScope;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Required when asvScope = COMPANY',
  })
  @NullableUuid()
  asvCompanyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Required when asvScope = BRANCH',
  })
  @NullableUuid()
  asvBranchId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Required when asvScope = DEVICE',
  })
  @NullableUuid()
  asvDeviceId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Required when asvScope = USER',
  })
  @NullableUuid()
  asvUserId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The value, as text whatever the setting’s type — it is checked against asdDataType, ' +
      'asdAllowedValues and the min/max before it is stored. null is "explicitly nothing", ' +
      'which blanks the setting for this layer rather than inheriting the one above',
  })
  @NullableStringStrict()
  asvValue?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true, description: 'Why it was changed' })
  @NullableStringStrict(250)
  asvRemarks?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @OptionalDate()
  asvSyncDate?: Date;

  @ApiPropertyOptional({ maxLength: 50, description: 'Defaults to the authenticated user' })
  @OptionalTrimmedString(50)
  asvCreatedBy?: string;

  @ApiPropertyOptional({ maxLength: 50, description: 'Defaults to the authenticated user' })
  @OptionalTrimmedString(50)
  asvModifiedBy?: string;
}
