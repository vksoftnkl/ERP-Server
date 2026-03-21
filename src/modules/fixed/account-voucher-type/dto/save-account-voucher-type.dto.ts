import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvtDrcrType, AvtTallyReservedVch } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  isUUID,
} from 'class-validator';

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
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const toUpperCaseString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
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

export class SaveAccountVoucherTypeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing account voucher type',
  })
  @IsOptional()
  @IsUUID('all')
  avtId?: string;

  @ApiProperty({ maxLength: 30 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  avtShort!: string;

  @ApiProperty({ maxLength: 150 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  avtDesc!: string;

  @ApiPropertyOptional({
    enum: AvtDrcrType,
    enumName: 'AvtDrcrType',
    default: AvtDrcrType.BOTH,
  })
  @IsOptional()
  @Transform(({ value }) => toUpperCaseString(value))
  @IsEnum(AvtDrcrType)
  avtDrcr?: AvtDrcrType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  avtPrintEnabled?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  avtPrintStyle?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(0)
  avtSortOrder?: number;

  @ApiProperty({ maxLength: 150 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  avtTallyName!: string;

  @ApiPropertyOptional({
    enum: AvtTallyReservedVch,
    enumName: 'AvtTallyReservedVch',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => toNullableString(toUpperCaseString(value)))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsEnum(AvtTallyReservedVch)
  avtTallyReservedType?: AvtTallyReservedVch | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  avtIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  avtCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  avtModifiedBy?: string | null;
}
