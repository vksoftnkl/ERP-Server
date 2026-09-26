import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import {
  OptionalUuid,
  UUID_PATTERN,
  resolveAliasValue,
  toOptionalUuid,
} from './loyalty-dto.helpers';

/**
 * GET /list — the pick list, as opposed to /get which is one whole campaign.
 *
 * BOTH filters are optional and each one narrows the result independently: no
 * company means every company, no branch means every branch. A bare /list is
 * therefore a legitimate call — every live scheme in the database.
 *
 * What is NOT optional, because it is not a parameter at all, is
 * is_deleted = false AND is_active = true, on the header and on all five grids.
 *
 * `company` and `branch` are accepted as aliases for lsc_comp_id and
 * lsc_branch_id. The `@Expose()` on the two canonical fields is load-bearing:
 * class-transformer only runs a @Transform for keys it finds on the incoming
 * object, so without it a request carrying ONLY `company` would never reach the
 * alias resolver and the filter would be silently dropped.
 */
export class ListLoyaltySchemeQueryDto {
  @ApiPropertyOptional({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description:
      'company.comp_id — optional. Omit it to list across every company. Also accepted as ' +
      '`company`, `company_id`, `comp_id`',
  })
  @Expose()
  @IsOptional()
  @Transform(({ value, obj }) =>
    toOptionalUuid(resolveAliasValue(value, obj, ['company', 'company_id', 'comp_id'])),
  )
  @Matches(UUID_PATTERN, { message: 'lsc_comp_id must be a valid UUID' })
  lsc_comp_id?: string;

  @ApiPropertyOptional({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description:
      'branch_master.br_id — optional. Matches the lsc_branch_id column literally: omit it to ' +
      'get every scheme in scope, company-wide ones (lsc_branch_id NULL) included. Also ' +
      'accepted as `branch`, `branch_id`',
  })
  @Expose()
  @IsOptional()
  @Transform(({ value, obj }) =>
    toOptionalUuid(resolveAliasValue(value, obj, ['branch', 'branch_id'])),
  )
  @Matches(UUID_PATTERN, { message: 'lsc_branch_id must be a valid UUID' })
  lsc_branch_id?: string;

  // ─── Aliases ────────────────────────────────────────────────────────────
  // Declared only so the short spellings survive forbidNonWhitelisted; the
  // @Transform above is what actually reads them.

  @ApiHideProperty()
  @OptionalUuid()
  company?: string;

  @ApiHideProperty()
  @OptionalUuid()
  company_id?: string;

  @ApiHideProperty()
  @OptionalUuid()
  comp_id?: string;

  @ApiHideProperty()
  @OptionalUuid()
  branch?: string;

  @ApiHideProperty()
  @OptionalUuid()
  branch_id?: string;
}
