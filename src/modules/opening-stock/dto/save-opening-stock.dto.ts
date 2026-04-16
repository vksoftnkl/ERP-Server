import { plainToInstance, Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';
import {
  OpeningStockDetailCessType,
  OpeningStockDetailTrackingType,
  OpeningStockStatus,
} from '../opening-stock.enums';
const toOptionalUuid = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return value as string;
};
const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }
  return value.trim();
};
const toNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return value as string;
  }
  const trimmed = value.trim();
  return trimmed || null;
};
const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};
const toOptionalUuidArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown[];
        if (Array.isArray(parsed)) {
          return parsed.map((entry) =>
            typeof entry === 'string' ? entry.trim() : String(entry),
          );
        }
      } catch {
        return [trimmed];
      }
    }
    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return value as string[];
};

const resolveAliasValue = (value: unknown, obj: unknown, aliases: string[]): unknown => {
  if (value !== undefined) {
    return value;
  }

  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const source = obj as Record<string, unknown>;
  for (const alias of aliases) {
    const aliasValue = source[alias];
    if (aliasValue !== undefined) {
      return aliasValue;
    }
  }

  return undefined;
};

const normalizeOpeningStockHeaderAliases = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  const header = value as Record<string, unknown>;
  const voucherTypeId =
    header.avh_voucher_type_id ?? header.vchr_type_id ?? header.voucher_type_id;
  const normalizedHeader =
    voucherTypeId === undefined
      ? header
      : {
          ...header,
          avh_voucher_type_id: voucherTypeId,
        };
  return plainToInstance(OpeningStockHeaderInputDto, normalizedHeader);
};
export class OpeningStockHeaderInputDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the document by voucher header id',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  avh_voucher_id?: string;
  @ApiProperty({ maxLength: 9 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(9)
  osh_acc_year!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  osh_company_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  osh_branch_id!: string;
  @ApiProperty({ minimum: 1 })
  @Transform(({ value, obj }) =>
    toOptionalNumber(resolveAliasValue(value, obj, ['vchr_type_id', 'voucher_type_id'])),
  )
  @ValidateIf(
    (object, value) =>
      value !== undefined ||
      (object.vchr_type_id === undefined && object.voucher_type_id === undefined),
  )
  @IsInt()
  @Min(1)
  avh_voucher_type_id?: number;
  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  vchr_type_id?: number;
  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  voucher_type_id?: number;
  @ApiProperty({ type: String, format: 'date-time' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  osh_voucher_date!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  avh_party_id!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  avh_bill_date?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  avh_opposite_ledger_id?: string | null;
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Can be UUID array, JSON array string, or comma-separated string',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuidArray(value))
  @IsArray()
  @IsUUID('all', { each: true })
  avh_employee_id?: string[];
  @ApiProperty({ enum: DeviceType })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsEnum(DeviceType)
  osh_device_type!: DeviceType;
  @ApiProperty({ maxLength: 20 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  osh_counter_id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  osh_session_id?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  osh_device_id?: string | null;
  @ApiPropertyOptional({ enum: OpeningStockStatus, default: OpeningStockStatus.DRAFT })
  @IsOptional()
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsEnum(OpeningStockStatus)
  osh_status?: OpeningStockStatus;
  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  osh_ref_no?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  osh_narration?: string | null;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  osh_total_lines?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osh_total_qty?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osh_total_value?: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  osh_user_id?: string;
}
export class OpeningStockDetailLineDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  osl_barcode?: string | null;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  osl_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  osl_unit_id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  osl_base_uom_id?: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  osl_godown_id!: string;
  @ApiPropertyOptional({ enum: OpeningStockDetailTrackingType, default: OpeningStockDetailTrackingType.NONE })
  @IsOptional()
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsEnum(OpeningStockDetailTrackingType)
  osl_tracking_type?: OpeningStockDetailTrackingType;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @IsUUID('all')
  osl_tax_id?: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_tax_perc?: number;
  @ApiPropertyOptional({ enum: OpeningStockDetailCessType, default: OpeningStockDetailCessType.NONE })
  @IsOptional()
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsEnum(OpeningStockDetailCessType)
  osl_cess_type?: OpeningStockDetailCessType;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_cess_perc?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_cess_per_unit?: number;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_qty!: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_free_qty?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_free_base_qty?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_base_qty?: number;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_conv_factor?: number;
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  osl_batch_no?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  osl_batch_id?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  osl_serial_no?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  osl_batch_date?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  osl_mfg_date?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  osl_expiry_date?: string | null;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_cost_rate?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_cost_rate_wot?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_a_wot?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_markup_perc_a?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_a?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_b_wot?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_markup_perc_b?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_b?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_c_wot?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_markup_perc_c?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_c?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_d_wot?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_markup_perc_d?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_sale_rate_d?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_mrp_rate?: number;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  osl_min_rate?: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  osl_remarks?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  item_code?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  item_name?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  godown_name?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  uom_name?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  tax_name?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  profit_type?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  round_off?: number;
}
export class SaveOpeningStockDto {
  @ApiProperty({ type: OpeningStockHeaderInputDto })
  @ValidateNested()
  @Transform(({ value }) => normalizeOpeningStockHeaderAliases(value), { toClassOnly: true })
  @Type(() => OpeningStockHeaderInputDto)
  header!: OpeningStockHeaderInputDto;
  @ApiProperty({ type: OpeningStockDetailLineDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OpeningStockDetailLineDto)
  details!: OpeningStockDetailLineDto[];
}
