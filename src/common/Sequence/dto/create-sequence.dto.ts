import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    return value as string;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

export class CreateSequenceDto {
  @ApiProperty({ example: 1 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  vchrTypeId!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  branchId!: string;

  @ApiProperty({ maxLength: 9, example: '2026-27' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(9)
  accYear!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  deviceId?: string | null;

  @ApiPropertyOptional({ maxLength: 20, default: 'MAIN' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deviceCode?: string;

  @ApiProperty({ maxLength: 20, example: '2026-27' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  periodKey!: string;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  voucherPrefix?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  companyCode?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  branchCode?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  voucherSuffix?: string | null;

  @ApiPropertyOptional({ minimum: 1, default: 5 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  noWidth?: number;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  lastRefno?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  createdBy?: string | null;
}
