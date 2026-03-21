import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
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

const toNullableString = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNullableUuid = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return isUUID(trimmed, 'all') ? trimmed : value;
};

const toNullableInteger = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : value;
  }

  return value;
};

const toNullableNumber = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

const toOptionalIntegerArray = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => Number(entry));
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return [];
    }

    const withoutBrackets =
      normalized.startsWith('[') && normalized.endsWith(']')
        ? normalized.slice(1, -1).trim()
        : normalized;
    const splitValues = withoutBrackets.includes(',')
      ? withoutBrackets.split(',')
      : withoutBrackets
        ? [withoutBrackets]
        : [];

    return splitValues.map((entry) => Number(entry.trim()));
  }

  return value;
};

export class SaveCustomerGroupDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing customer group',
  })
  @IsOptional()
  @IsUUID('all')
  cgrId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  cgrCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  cgrBranchId?: string | null;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  cgrName!: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  cgrAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  cgrShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  cgrNarration?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  cgrOrder?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  cgrDiscPerc?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Collection days as integer array (JSON array or comma-separated values)',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalIntegerArray(value))
  @IsArray()
  @IsInt({ each: true })
  cgrCollectionDays?: number[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  cgrDebitAllowed?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  cgrDebitDays?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  cgrDebitLimit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableInteger(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  cgrBillsLimit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  cgrOverdueBilling?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  cgrIsActive?: boolean;
}
