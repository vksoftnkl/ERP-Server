import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppSettingDataType,
  AppSettingScope,
  AppSettingSource,
} from '../types/app-settings-api.types';

export class AppSettingsErrorFieldDto {
  @ApiProperty({ example: 'asvValue' })
  field!: string;
  @ApiProperty({
    example: '"150" is above the maximum 100 for setting "sales.max_discount_percent"',
  })
  message!: string;
}

export class AppSettingsErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: AppSettingsErrorFieldDto, isArray: true })
  errors!: AppSettingsErrorFieldDto[];
}

export class AppSettingValuePayloadDto {
  @ApiProperty({ format: 'uuid' })
  asvId!: string;
  @ApiProperty({ maxLength: 80, example: 'sales.max_discount_percent' })
  asvSettingKey!: string;
  @ApiProperty({ enum: AppSettingScope, enumName: 'AppSettingScope' })
  asvScope!: AppSettingScope;
  // Exactly one of the four is set — the one asvScope names — or none, for a
  // GLOBAL row (ck_asv_scope_ids).
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvCompanyId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvBranchId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvDeviceId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvUserId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'null = explicitly nothing, which blanks the setting rather than inheriting it',
  })
  asvValue!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  asvRemarks!: string | null;
  @ApiProperty()
  asvIsDeleted!: boolean;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  asvSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' })
  asvCreatedOn!: string;
  @ApiProperty({ maxLength: 50 })
  asvCreatedBy!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  asvModifiedOn!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  asvModifiedBy!: string | null;
}

export class AppSettingValueDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  asvId!: string;
  @ApiProperty({ example: 'sales.max_discount_percent' })
  asvSettingKey!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}

// The winning override, inside an effective row. Same shape /create answers
// with, minus asvIsDeleted — a reset row never wins anything — so the client can
// hand it straight back to /create or /delete.
export class AppSettingEffectiveOverrideDto {
  @ApiProperty({ format: 'uuid' })
  asvId!: string;
  @ApiProperty({ enum: AppSettingScope, enumName: 'AppSettingScope' })
  asvScope!: AppSettingScope;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvCompanyId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvBranchId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvDeviceId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  asvUserId!: string | null;
  @ApiPropertyOptional({ nullable: true })
  asvValue!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  asvRemarks!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  asvSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' })
  asvCreatedOn!: string;
  @ApiProperty({ maxLength: 50 })
  asvCreatedBy!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  asvModifiedOn!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  asvModifiedBy!: string | null;
}

export class AppSettingEffectiveItemDto {
  @ApiProperty({ format: 'uuid' })
  asdId!: string;
  @ApiProperty({ maxLength: 80, example: 'sales.max_discount_percent' })
  asdKey!: string;
  @ApiProperty({ maxLength: 30, example: 'sales' })
  asdModule!: string;
  @ApiProperty({ maxLength: 40, example: 'Billing' })
  asdGroup!: string;
  @ApiProperty({ maxLength: 120, description: 'Label to draw on the settings screen' })
  asdLabel!: string;
  @ApiPropertyOptional({ nullable: true })
  asdDescription!: string | null;
  @ApiProperty({ enum: AppSettingDataType, enumName: 'AppSettingDataType' })
  asdDataType!: AppSettingDataType;
  @ApiPropertyOptional({ nullable: true, description: 'What applies when the override is reset' })
  asdDefaultValue!: string | null;
  @ApiPropertyOptional({ type: [String], nullable: true, example: ['OFF', 'WARN', 'BLOCK'] })
  asdAllowedValues!: string[] | null;
  @ApiPropertyOptional({ nullable: true })
  asdMinValue!: number | null;
  @ApiPropertyOptional({ nullable: true })
  asdMaxValue!: number | null;
  @ApiProperty({
    enum: AppSettingScope,
    enumName: 'AppSettingScope',
    description: 'Deepest layer this setting may be overridden at — what the screen may offer',
  })
  asdMaxScope!: AppSettingScope;
  @ApiProperty({ minimum: 0 })
  asdSortOrder!: number;
  @ApiProperty({ description: 'true = the client must re-login before the change takes effect' })
  asdNeedsRelogin!: boolean;
  @ApiProperty({
    enum: AppSettingSource,
    enumName: 'AppSettingSource',
    description:
      'Where the value came from. Read from the override ROW’s existence, not from its value — ' +
      'an override that deliberately blanks a setting is still an OVERRIDE',
  })
  source!: AppSettingSource;
  @ApiPropertyOptional({
    nullable: true,
    example: '40',
    description:
      'The effective value as raw text — cast by asdDataType. null = resolves to nothing',
  })
  value!: string | null;
  @ApiPropertyOptional({
    type: AppSettingEffectiveOverrideDto,
    nullable: true,
    description: 'The override that won, or null when the catalog default stands',
  })
  override!: AppSettingEffectiveOverrideDto | null;
}

export class AppSettingsEffectiveSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Settings fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingEffectiveItemDto, isArray: true })
  data!: AppSettingEffectiveItemDto[];
}

// The saved batch, in the order it was sent — one payload per entry of `data`,
// so the client can pair each answer with the box it came from.
export class AppSettingValueSuccessSaveDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Overrides saved successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingValuePayloadDto, isArray: true })
  data!: AppSettingValuePayloadDto[];
}

export class AppSettingValueSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Override reset successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingValueDeleteResultDto })
  data!: AppSettingValueDeleteResultDto;
}
