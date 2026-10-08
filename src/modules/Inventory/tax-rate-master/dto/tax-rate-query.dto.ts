import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';

export class TaxRateIdQueryDto {
  @ApiPropertyOptional({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  @RequiredUuid()
  tax_id!: string;
}

export class DeleteTaxRateQueryDto extends TaxRateIdQueryDto {
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  tax_modified_by?: string | null;
}

/**
 * GET /list — the picker, as opposed to /get which is one rate to edit.
 *
 * Every filter is optional and narrows independently; a bare /list is every
 * live rate there is. What is NOT a parameter is tax_is_deleted = false: a
 * deleted rate never comes back, and its lines never come back with it.
 */
export class ListTaxRateQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive substring of tax_name or tax_code.',
    example: '18',
  })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ['TAXABLE', 'EXEMPT', 'NIL_RATED', 'NON_GST', 'ZERO_RATED'],
    description: 'Narrow to one taxability.',
  })
  @OptionalUpperMaxString(15)
  tax_taxability?: string;

  @ApiPropertyOptional({
    example: 18,
    description: 'Exact total rate — 18 finds the 18% slab, not the 18% cess.',
  })
  @OptionalNumber(0)
  tax_rate_perc?: number;

  @ApiPropertyOptional({
    description:
      'Default true — the picker wants live rates. Send false to include deactivated ones, ' +
      'which a maintenance screen needs in order to switch them back on.',
  })
  @OptionalQueryBoolean()
  active_only?: boolean;
}

/**
 * GET /resolve — "where does this rate actually post?"
 *
 * The rate's own overrides answer only where it differs; everything else falls
 * through to accounts.acc_ledger_map. This asks the resolver the same question
 * posting will ask, so a screen can show the EFFECTIVE ledger per role rather
 * than the handful of rows the grid happens to carry.
 */
export class ResolveTaxRateQueryDto extends TaxRateIdQueryDto {
  @ApiPropertyOptional({
    enum: ['INTRA', 'INTER'],
    description:
      'The supply nature to resolve for. Omit to resolve the nature-neutral answer — the row ' +
      'that serves both. It changes nothing for the tax roles: CGST and SGST exist only on an ' +
      'intra-state sale and IGST only on an inter-state one, so those roles already say it.',
  })
  @OptionalUpperMaxString(5)
  supply_nature?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'RESERVED — every acc_ledger_map row is global today, so this changes no answer. Present ' +
      'because a company-scoped mapping, once one exists, is preferred over the global one.',
  })
  @OptionalUuid()
  company_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'RESERVED — see company_id.' })
  @OptionalUuid()
  branch_id?: string;
}
