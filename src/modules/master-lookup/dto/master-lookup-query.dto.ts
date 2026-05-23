import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  LOOKUP_MODULE_ALIASES,
  LOOKUP_MODULE_KEYS,
  LookupModuleKey,
} from '../types/master-lookup-api.types';
const normalizeLookupModuleAlias = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const LOOKUP_MODULE_ALIAS_MAP: Record<string, LookupModuleKey> = Object.fromEntries(
  LOOKUP_MODULE_KEYS.flatMap((moduleKey) =>
    [moduleKey, ...LOOKUP_MODULE_ALIASES[moduleKey]].map((alias) => [
      normalizeLookupModuleAlias(alias),
      moduleKey,
    ]),
  ),
) as Record<string, LookupModuleKey>;
const toOptionalLookupModule = (value: unknown): LookupModuleKey | string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return value as string;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const canonical = LOOKUP_MODULE_KEYS.find(
    (moduleKey) => moduleKey.toLowerCase() === trimmed.toLowerCase(),
  );
  if (canonical) {
    return canonical;
  }
  return LOOKUP_MODULE_ALIAS_MAP[normalizeLookupModuleAlias(trimmed)] ?? trimmed;
};
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
export class DropdownSqlQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive search text', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Max number of records to return', minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MasterLookupQueryDto {
  @ApiPropertyOptional({
    enum: LOOKUP_MODULE_KEYS,
    description:
      'When provided, returns only the selected module id-name list. Also accepts route/display aliases such as item-group-master, tax-master, gsp-service-master, statecode, pricelevel, and hsncode.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalLookupModule(value))
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
