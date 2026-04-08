import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import {
  TIME_PATTERN,
  UUID_PATTERN,
  toNullableInteger,
  toNullableString,
  toNullableUuid,
  toOptionalBoolean,
  toOptionalDateString,
  toOptionalInteger,
  toOptionalNumber,
  toOptionalTimeString,
  toOptionalUuid,
  toRequiredUuid,
  toTrimmedString,
} from './loyalty-dto.helpers';
import { SaveLoyaltyPartyDto } from './save-loyalty-party.dto';

const LOYALTY_SCHEME_TYPES = ['REDEEM', 'BOTH', 'GIFT'] as const;
const LOYALTY_SCHEME_STATUSES = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const;
const LOYALTY_SCHEME_APPLY_ON = [
  'BILL_AMOUNT',
  'ITEM_AMOUNT',
  'BILL_QTY',
  'ITEM_QTY',
  'MASTER_PV',
] as const;
const LOYALTY_SCHEME_CALC_AMOUNT_TYPES = [
  'NET_AMOUNT',
  'GROSS_AMOUNT',
  'TAXABLE_AMOUNT',
] as const;
const LOYALTY_SCHEME_BILL_TYPES = ['ALL', 'CASH', 'CREDIT'] as const;
const LOYALTY_SCHEME_CUSTOMER_TYPES = ['ALL', 'CUSTOMER_GROUP', 'CUSTOMER'] as const;
const LOYALTY_SCHEME_ITEM_TYPES = [
  'ALL',
  'ITEM_GROUP',
  'ITEM_BRAND',
  'ITEM_CATEGORY',
  'ITEM_SECTION',
  'ITEM',
] as const;
const LOYALTY_SCHEME_ROUNDING_METHODS = ['FLOOR', 'ROUND', 'CEIL'] as const;
const LOYALTY_SCHEME_EXPIRY_BASIS = [
  'EARN_DATE',
  'SCHEME_END_DATE',
  'MONTH_END',
  'YEAR_END',
  'NONE',
] as const;

@ValidatorConstraint({ name: 'LoyaltySchemeDateRange', async: false })
class LoyaltySchemeDateRangeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as SaveLoyaltySchemeDto;
    if (!dto.ls_start_date || typeof value !== 'string') {
      return true;
    }

    const start = new Date(dto.ls_start_date);
    const end = new Date(value);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return true;
    }

    return start.getTime() <= end.getTime();
  }

  defaultMessage(): string {
    return 'ls_end_date must be greater than or equal to ls_start_date';
  }
}

export class SaveLoyaltySchemeDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty scheme',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalUuid(value))
  @Matches(UUID_PATTERN)
  ls_id?: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(30)
  ls_code?: string | null;

  @ApiProperty({ maxLength: 150 })
  @ValidateIf(
    (object: SaveLoyaltySchemeDto) => object.ls_id === undefined || object.ls_name !== undefined,
  )
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ls_name?: string;

  @ApiProperty({ maxLength: 20 })
  @ValidateIf(
    (object: SaveLoyaltySchemeDto) => object.ls_id === undefined || object.ls_type !== undefined,
  )
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_TYPES)
  ls_type?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'DRAFT' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_STATUSES)
  ls_status?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_auto_apply?: boolean;

  @ApiPropertyOptional({ maxLength: 20, default: 'BILL_AMOUNT' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_APPLY_ON)
  ls_apply_on?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'NET_AMOUNT' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_CALC_AMOUNT_TYPES)
  ls_calc_on_amount_type?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'ALL' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_BILL_TYPES)
  ls_bill_type?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'ALL' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_CUSTOMER_TYPES)
  ls_cust_type?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'ALL' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_ITEM_TYPES)
  ls_item_type?: string;

  @ApiProperty({ format: 'date' })
  @ValidateIf(
    (object: SaveLoyaltySchemeDto) =>
      object.ls_id === undefined || object.ls_start_date !== undefined,
  )
  @Transform(({ value }) => toOptionalDateString(value))
  @IsDateString()
  ls_start_date?: string;

  @ApiProperty({ format: 'date' })
  @ValidateIf(
    (object: SaveLoyaltySchemeDto) =>
      object.ls_id === undefined || object.ls_end_date !== undefined,
  )
  @Transform(({ value }) => toOptionalDateString(value))
  @IsDateString()
  @Validate(LoyaltySchemeDateRangeConstraint)
  ls_end_date?: string;

  @ApiPropertyOptional({ format: 'time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalTimeString(value))
  @IsString()
  @Matches(TIME_PATTERN)
  ls_valid_from_time?: string;

  @ApiPropertyOptional({ format: 'time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalTimeString(value))
  @IsString()
  @Matches(TIME_PATTERN)
  ls_valid_to_time?: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(30)
  ls_valid_weekdays?: string | null;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltySchemeDto) => object.ls_id === undefined || object.ls_comp_id !== undefined,
  )
  @Transform(({ value }) => toRequiredUuid(value))
  @Matches(UUID_PATTERN)
  ls_comp_id?: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  ls_branch_id?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_include_tax_for_points?: boolean;

  @ApiPropertyOptional({ maxLength: 10, default: 'FLOOR' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(10)
  @IsIn(LOYALTY_SCHEME_ROUNDING_METHODS)
  ls_rounding_method?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_recur_apl?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_bal_apl?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_allow_point_redeem?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_allow_gift_redeem?: boolean;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_redeem_value_per_point?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_min_redeem_points?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_max_redeem_points_per_bill?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_max_redeem_percent_per_bill?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_redeem_min_bill_amount?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(0)
  ls_points_valid_days?: number;

  @ApiPropertyOptional({ maxLength: 20, default: 'EARN_DATE' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  @IsIn(LOYALTY_SCHEME_EXPIRY_BASIS)
  ls_expiry_basis?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  ls_remarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_is_active?: boolean;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  ls_created_by?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  ls_updated_by?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalDateString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  ls_approved_on?: string;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Matches(UUID_PATTERN)
  ls_approved_by?: string | null;

  @ApiPropertyOptional({ type: SaveLoyaltyPartyDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveLoyaltyPartyDto)
  parties?: SaveLoyaltyPartyDto[];
}
