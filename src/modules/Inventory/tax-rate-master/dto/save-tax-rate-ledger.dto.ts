import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  NullableString,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  NullableUpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * One line of the grid: a (role, supply nature) pair that this rate posts
 * somewhere other than where accounts.acc_ledger_map would send it.
 *
 * A rate with NO lines is not misconfigured — it is the normal case, and the
 * complete one. Lines exist only for the overrides.
 */
export class SaveTaxRateLedgerDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Present = update this existing line; absent = insert a new one. A line already on the ' +
      'rate but missing from the array is soft deleted.',
  })
  @OptionalUuid()
  trl_id?: string;

  @ApiProperty({
    maxLength: 30,
    example: 'OUTPUT_CGST',
    description:
      'accounts.acc_ledger_role.alr_role. Must be a live role whose alr_by_rate is true — ' +
      'round-off, discount, write-off and advances have nothing to do with a rate and are ' +
      'rejected here.',
  })
  @TrimmedString(30)
  trl_role!: string;

  @ApiPropertyOptional({
    maxLength: 5,
    nullable: true,
    enum: ['INTRA', 'INTER'],
    description:
      'null (the default) = both natures. Only roles whose alr_by_supply is true may narrow it — ' +
      'a tax role already says the supply nature by which it is used.',
  })
  @NullableUpperMaxString(5)
  trl_supply_nature?: string | null;

  @ApiProperty({
    format: 'uuid',
    description:
      'accounts.acc_ledger_master.led_id. Validated against what the role demands — ledger type, ' +
      'GST duty head and account-group nature — and must be a global ledger, because a rate is ' +
      'shared by every company.',
  })
  @RequiredUuid()
  trl_ledger_id!: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  trl_remarks?: string | null;

  @ApiPropertyOptional({
    default: true,
    description: 'An inactive line is kept but ignored by the resolver.',
  })
  @OptionalBoolean()
  trl_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  trl_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  trl_modified_by?: string | null;
}
