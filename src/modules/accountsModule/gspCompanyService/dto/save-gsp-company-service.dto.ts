import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? (value as Date) : parsed;
};

const toTrimmedUpper = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

export class SaveGspCompanyServiceDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing GSP company service',
  })
  @IsOptional()
  @IsUUID('all')
  csgCompanyServiceId?: string;

  @ApiProperty({ type: Number, example: 1 })
  @IsInt()
  csgCompanyId!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  csgGspProviderId!: string;

  @ApiProperty({ maxLength: 20 })
  @Transform(({ value }) => toTrimmedUpper(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  csgServiceType!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  csgEuserName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  csgEuserPassword!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  csgAuthToken?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableDate(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDate()
  csgAuthTokenValidTill?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  csgIsActive?: boolean;
}
