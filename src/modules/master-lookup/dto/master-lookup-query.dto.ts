import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LOOKUP_MODULE_KEYS, LookupModuleKey } from '../types/master-lookup-api.types';

const toOptionalTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value as string;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

export class MasterLookupQueryDto {
  @ApiPropertyOptional({
    enum: LOOKUP_MODULE_KEYS,
    description: 'When provided, returns only the selected module id-name list',
  })
  @IsOptional()
  @IsIn(LOOKUP_MODULE_KEYS)
  module?: LookupModuleKey;

  @ApiPropertyOptional({
    description: 'Case-insensitive search text for module lookup',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Max number of records to return per module',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
