import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalUuid,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * §4.1 / §4.3. Company and year are required because an opening balance has no
 * meaning without both; branch is optional and its ABSENCE is meaningful —
 * omitting it asks for the company-level set (`op_branch_id IS NULL`), which is
 * a different set from any branch's, not a superset of them.
 */
export class ListOpeningBalanceQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: '2026-2027', description: "'YYYY-YYYY', second half = first + 1." })
  @UpperMaxString(9)
  accYear!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Omit for the company-level set (op_branch_id IS NULL). A branch id asks for that ' +
      "branch's own set — the two coexist and ux_op_scope keeps them apart.",
  })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Whether to list a ledger that has NO opening and NO prior-year closing. Defaults to ' +
      'true: the screen is a review surface over the whole chart, and on a company that has ' +
      'never been opened every ledger is in that state — so a default of false hands the ' +
      'operator an empty screen at the one moment the screen exists for. Send false to narrow ' +
      'to ledgers that have a figure or had one last year.',
  })
  @OptionalQueryBoolean()
  includeZero?: boolean;
}
