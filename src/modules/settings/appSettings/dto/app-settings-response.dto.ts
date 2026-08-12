import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppSettingDataType, AppSettingScope } from '../types/app-settings-api.types';

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

export class AppSettingDefPayloadDto {
  @ApiProperty({ format: 'uuid' })
  asdId!: string;
  @ApiProperty({ maxLength: 80, example: 'sales.max_discount_percent' })
  asdKey!: string;
  @ApiProperty({ maxLength: 30, example: 'sales' })
  asdModule!: string;
  @ApiProperty({ maxLength: 40, example: 'Billing' })
  asdGroup!: string;
  @ApiProperty({ enum: AppSettingDataType, enumName: 'AppSettingDataType' })
  asdDataType!: AppSettingDataType;
  @ApiPropertyOptional({ nullable: true, description: 'Stored as text whatever the type' })
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
    description: 'Deepest layer this setting may be overridden at',
  })
  asdMaxScope!: AppSettingScope;
  @ApiProperty({ maxLength: 120 })
  asdLabel!: string;
  @ApiPropertyOptional({ nullable: true })
  asdDescription!: string | null;
  @ApiProperty({ minimum: 0 })
  asdSortOrder!: number;
  @ApiProperty({ description: 'false = retired; overrides stay, no new one may be written' })
  asdIsActive!: boolean;
  @ApiProperty({ description: 'true = the client must re-login before the change takes effect' })
  asdNeedsRelogin!: boolean;
  @ApiProperty()
  asdIsDeleted!: boolean;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  asdSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' })
  asdCreatedOn!: string;
  @ApiProperty({ maxLength: 50 })
  asdCreatedBy!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  asdModifiedOn!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  asdModifiedBy!: string | null;
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

export class AppSettingsListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 20 })
  total!: number;
  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class AppSettingDefDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  asdId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}

export class AppSettingValueDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  asvId!: string;
  @ApiProperty({ example: 'sales.max_discount_percent' })
  asvSettingKey!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}

export class AppSettingResolvedValueDto {
  @ApiProperty({ example: 'sales.max_discount_percent' })
  key!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: '30',
    description: 'Raw text — cast at the call site. null = resolves to nothing, or no such key',
  })
  value!: string | null;
}

export class AppSettingDefSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Setting fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingDefPayloadDto })
  data!: AppSettingDefPayloadDto;
}

export class AppSettingDefSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Settings fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingDefPayloadDto, isArray: true })
  data!: AppSettingDefPayloadDto[];
  @ApiProperty({ type: AppSettingsListMetaDto })
  meta!: AppSettingsListMetaDto;
}

export class AppSettingDefSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Setting deleted successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingDefDeleteResultDto })
  data!: AppSettingDefDeleteResultDto;
}

export class AppSettingValueSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Override fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingValuePayloadDto })
  data!: AppSettingValuePayloadDto;
}

export class AppSettingValueSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Overrides fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingValuePayloadDto, isArray: true })
  data!: AppSettingValuePayloadDto[];
  @ApiProperty({ type: AppSettingsListMetaDto })
  meta!: AppSettingsListMetaDto;
}

export class AppSettingValueSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Override reset successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingValueDeleteResultDto })
  data!: AppSettingValueDeleteResultDto;
}

export class AppSettingsResolvedSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Settings resolved successfully' })
  message!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The resolved object, keyed by asdKey and cast per asdDataType. Keys resolving to nothing ' +
      'are absent rather than null',
    example: {
      'sales.max_discount_percent': 30,
      'sales.allow_rate_edit': true,
      'system.date_format': 'dd-MM-yyyy',
    },
  })
  data!: Record<string, unknown>;
}

export class AppSettingResolvedValueSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Setting resolved successfully' })
  message!: string;
  @ApiProperty({ type: AppSettingResolvedValueDto })
  data!: AppSettingResolvedValueDto;
}
