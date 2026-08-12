import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  NullableNumber,
  NullableString,
  NullableStringStrict,
  OptionalBoolean,
  OptionalDate,
  OptionalInteger,
  OptionalLowerMaxString,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import { AppSettingDataType, AppSettingScope } from '../types/app-settings-api.types';

/**
 * One catalog row. Nothing is required by the decorators: a create needs
 * asdKey, asdModule, asdDataType and asdLabel, an update needs asdId plus the
 * fields that change, so "required on create" is enforced in the service where
 * the stored row fills the gaps.
 */
export class SaveAppSettingDefDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates that setting; otherwise a new one is created',
  })
  @OptionalUuid()
  asdId?: string;

  @ApiPropertyOptional({
    maxLength: 80,
    example: 'sales.max_discount_percent',
    description:
      'Dotted, lowercase, module-prefixed. Required on create and IMMUTABLE afterwards — ' +
      'overrides point at the key, not the id, so renaming one would strand them. Retire the ' +
      'setting (asdIsActive = false) and add a new key instead',
  })
  @OptionalLowerMaxString(80)
  asdKey?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    example: 'sales',
    description: 'Top level of the settings-screen tree. Required on create',
  })
  @OptionalTrimmedString(30)
  asdModule?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    default: 'General',
    description: 'Second level of the tree',
  })
  @OptionalTrimmedString(40)
  asdGroup?: string;

  @ApiPropertyOptional({
    enum: AppSettingDataType,
    enumName: 'AppSettingDataType',
    description:
      'How the stored text is read back. Required on create. Changing it re-validates the ' +
      'default AND every live override, and is refused if any of them would stop casting',
  })
  @OptionalUpperMaxString(10)
  @IsEnum(AppSettingDataType)
  asdDataType?: AppSettingDataType;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The value when nobody has overridden it. Stored as text whatever the type; null means ' +
      'the resolver omits the key entirely',
  })
  @NullableStringStrict()
  asdDefaultValue?: string | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['OFF', 'WARN', 'BLOCK'],
    description: 'Legal values for an enum-ish TEXT setting. null = free text',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(250, { each: true })
  asdAllowedValues?: string[] | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'INT / DECIMAL only — inclusive lower bound',
  })
  @NullableNumber()
  asdMinValue?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'INT / DECIMAL only — inclusive upper bound',
  })
  @NullableNumber()
  asdMaxValue?: number | null;

  @ApiPropertyOptional({
    enum: AppSettingScope,
    enumName: 'AppSettingScope',
    default: AppSettingScope.COMPANY,
    description:
      'Deepest layer this setting may be overridden at. Lowering it is refused while overrides ' +
      'deeper than the new limit are still live',
  })
  @OptionalUpperMaxString(10)
  @IsEnum(AppSettingScope)
  asdMaxScope?: AppSettingScope;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Label on the settings screen. Required on create',
  })
  @OptionalTrimmedString(120)
  asdLabel?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Help text under the label' })
  @NullableString()
  asdDescription?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'Position within the group' })
  @OptionalInteger(0)
  asdSortOrder?: number;

  @ApiPropertyOptional({
    description:
      'false retires the setting: existing overrides stay but no new one may be written, and ' +
      'the resolver stops answering with it',
  })
  @OptionalBoolean()
  asdIsActive?: boolean;

  @ApiPropertyOptional({
    description: 'true = the client must re-login before the change takes effect',
  })
  @OptionalBoolean()
  asdNeedsRelogin?: boolean;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @OptionalDate()
  asdSyncDate?: Date;

  @ApiPropertyOptional({ maxLength: 50, description: 'Defaults to the authenticated user' })
  @OptionalTrimmedString(50)
  asdCreatedBy?: string;

  @ApiPropertyOptional({ maxLength: 50, description: 'Defaults to the authenticated user' })
  @OptionalTrimmedString(50)
  asdModifiedBy?: string;
}
