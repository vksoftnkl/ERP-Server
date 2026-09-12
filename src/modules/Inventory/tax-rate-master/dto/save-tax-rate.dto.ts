import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalUpperMaxString,
  OptionalUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveTaxRateLedgerDto } from './save-tax-rate-ledger.dto';

/**
 * The whole rate in one body: the header, plus the ledger overrides as `lines`.
 *
 * The three component rates (tax_cgst_perc / tax_sgst_perc / tax_igst_perc) are
 * NOT here. They are GENERATED ALWAYS columns computed from tax_rate_perc, so
 * there is nothing to send — 18 becomes 9 + 9 locally and 18 inter-state, and
 * the two can no longer disagree.
 */
export class SaveTaxRateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omit to create; send it to update the existing rate.',
  })
  @OptionalUuid()
  tax_id?: string;

  @ApiProperty({
    maxLength: 100,
    example: 'GST 18%',
    description: 'Unique among live rates, case-insensitively. A soft-deleted name is reusable.',
  })
  @TrimmedString(100)
  tax_name!: string;

  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    example: 'GST18',
    description: 'Unique among live rates, case-insensitively, when present.',
  })
  @NullableString(30)
  tax_code?: string | null;

  @ApiPropertyOptional({ default: 0, description: "The picker's display order." })
  @OptionalInteger(0)
  tax_sort_order?: number;

  @ApiPropertyOptional({
    enum: ['TAXABLE', 'EXEMPT', 'NIL_RATED', 'NON_GST', 'ZERO_RATED'],
    default: 'TAXABLE',
    description:
      'EXEMPT / NIL_RATED / NON_GST must charge nothing at all. ZERO_RATED must not be used for ' +
      'them: an export is taxable at 0% and has to stay distinguishable on the return.',
  })
  @OptionalUpperMaxString(15)
  tax_taxability?: string;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  tax_is_reverse_charge?: boolean;

  @ApiPropertyOptional({
    example: 18,
    default: 0,
    description:
      'The TOTAL GST rate, 0…100. CGST, SGST and IGST are derived from it by the database.',
  })
  @OptionalNumber(0)
  tax_rate_perc?: number;

  @ApiPropertyOptional({
    enum: ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'],
    default: 'NONE',
    description:
      'Says which of the two cess figures is in play, so a zero is never ambiguous. The basis and ' +
      'the figures must agree: PERCENT needs tax_cess_perc > 0 and tax_cess_per_unit = 0, ' +
      'PER_UNIT the reverse, BOTH needs both > 0, NONE needs both = 0.',
  })
  @OptionalUpperMaxString(10)
  tax_cess_basis?: string;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber(0)
  tax_cess_perc?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber(0)
  tax_cess_per_unit?: number;

  @ApiPropertyOptional({
    enum: ['NONE', 'PERCENT', 'PER_UNIT', 'BOTH'],
    default: 'NONE',
    description:
      'The SECOND, state cess — Kerala flood cess beside compensation cess is the standard ' +
      'example. Same agreement rule as tax_cess_basis.',
  })
  @OptionalUpperMaxString(10)
  tax_acess_basis?: string;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber(0)
  tax_acess_perc?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber(0)
  tax_acess_per_unit?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The rate this one replaced. A rate change makes a NEW row rather than editing the old ' +
      'one, and this keeps the chain followable. Must not point at itself or close a loop.',
  })
  @NullableUuid()
  tax_supersedes_id?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  tax_is_active?: boolean;

  @ApiPropertyOptional({
    type: () => SaveTaxRateLedgerDto,
    isArray: true,
    description:
      'The ledger overrides. Sending the key REPLACES the grid: lines carrying trl_id are ' +
      'updated, lines without one are inserted, and lines already on the rate but missing from ' +
      'the array are soft deleted. OMIT the key to leave the grid untouched — `"lines": []` ' +
      'means "delete every override", which is not the same thing.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTaxRateLedgerDto)
  lines?: SaveTaxRateLedgerDto[];

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  tax_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  tax_modified_by?: string | null;
}
