import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import {
  toNullableInteger,
  toNullableString,
  toOptionalBoolean,
  toOptionalDateString,
  toOptionalInteger,
  toOptionalNumber,
  toTrimmedString,
} from './loyalty-dto.helpers';

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
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  ls_id?: number;

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
  ls_type?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'BILL_AMOUNT' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  ls_apply_on?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'ALL' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  ls_bill_type?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'ALL' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
  ls_cust_type?: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'ALL' })
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(20)
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

  @ApiProperty({ minimum: 1, example: 1 })
  @ValidateIf(
    (object: SaveLoyaltySchemeDto) => object.ls_id === undefined || object.ls_comp_id !== undefined,
  )
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  ls_comp_id?: number;

  @ApiPropertyOptional({ minimum: 1, nullable: true, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  ls_branch_id?: number | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_points_per_inr?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_points_per_qty?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_min_bill_amount?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber()
  @Min(0)
  ls_max_points_per_bill?: number;

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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_allow_point_earn?: boolean;

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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ls_is_active?: boolean;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  created_by?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  modified_by?: number | null;
}
