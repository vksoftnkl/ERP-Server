import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  isUUID,
} from 'class-validator';

const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toOptionalTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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

const toOptionalDate = (value: unknown): Date | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return value as Date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? (value as unknown as Date) : parsed;
};

const toNullableDate = (value: unknown): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return value as Date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? (value as unknown as Date) : parsed;
};

export class SaveUserLoginSessionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing user login session row',
  })
  @IsOptional()
  @IsUUID('all')
  ulsId?: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ulsCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ulsBranchId!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ulsUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ulsDeviceId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  ulsSessionId?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ulsSessionToken?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  ulsRefreshTokenId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Transform(({ value }) => toOptionalDate(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsDate()
  ulsLoginOn?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableDate(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDate()
  ulsLogoutOn?: Date | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  ulsLogoutType?: string | null;

  @ApiPropertyOptional({ maxLength: 20, default: 'SUCCESS' })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(20)
  ulsLoginStatus?: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  ulsFailReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIP()
  ulsIpAddress?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  ulsUserAgent?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(40)
  ulsAppVersion?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ulsIsActiveSession?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ulsIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ulsCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  ulsModifiedBy?: string | null;
}
