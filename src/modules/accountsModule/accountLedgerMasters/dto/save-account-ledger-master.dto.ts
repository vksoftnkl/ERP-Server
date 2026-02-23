import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  isUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toNullableUuid = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return isUUID(trimmed, 'all') ? trimmed : null;
};

const toNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNullableDate = (value: unknown): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : new Date(Number.NaN);
  return Number.isNaN(parsed.getTime()) ? (value as Date) : parsed;
};

const toUpper = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

export class SaveAccountLedgerMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing ledger',
  })
  @IsOptional()
  @IsUUID('all')
  ledId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ledCompanyId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  ledGroupId!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  ledName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ledAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  ledShort?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ledTallyName?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  ledTallyGroupName?: string | null;

  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(64)
  ledTallyGuid?: string | null;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ledCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledIsBillByBill?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledIsCostCenterReq?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledIsInterestApplicable?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ledInterestRate?: number;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  ledContactPerson?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsEmail()
  @MaxLength(150)
  ledEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  ledTel?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  ledPhone1?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  ledPhone2?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  ledWhatsappNo?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ledAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ledAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ledAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ledCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ledDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ledStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpper(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(2)
  ledStateCode?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(10)
  ledPin?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(60)
  ledCountry?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ledRegionAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ledRegionAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ledRegionAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ledRegionCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ledRegionDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ledRegionStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(60)
  ledRegionCountry?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(30)
  ledGstPartyRegType?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpper(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(15)
  ledGstinNo?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpper(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(10)
  ledPanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  ledAadharNo?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpper(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(15)
  ledEcommerceGstin?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledIsSez?: boolean;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(80)
  ledChequeName?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(120)
  ledBankName?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(120)
  ledBankBranch?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(40)
  ledBankAcNo?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpper(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(15)
  ledBankIfsc?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(80)
  ledUpiId?: string | null;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  ledObAmount?: number;

  @ApiPropertyOptional({ enum: ['DR', 'CR'] })
  @IsOptional()
  @Transform(({ value }) => toUpper(value))
  @IsString()
  @IsIn(['DR', 'CR'])
  ledObType?: string;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableDate(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Date)
  @IsDate()
  ledObAsOn?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledIsActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledAllowEdit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledIsEntry?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ledAllowSms?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  ledRemarks?: string | null;
}
