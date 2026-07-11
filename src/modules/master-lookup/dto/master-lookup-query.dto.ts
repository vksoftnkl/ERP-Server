import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
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
}
