import { IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
export class SaveAccGroupMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing account group',
  })
  @OptionalUuid()
  accGroupId?: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  accGroupName!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @NullableString(100)
  accGroupAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50 })
  @NullableString(50)
  accGroupShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250 })
  @NullableString(250)
  accGroupDescription?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  accGroupParentId?: string | null;

  @ApiPropertyOptional()
  @OptionalInteger()
  accGroupSort?: number;

  // ── The four Tally behaviour flags ──────────────────────────────────────
  // acc_group_master has carried these columns since it was created, NOT NULL
  // DEFAULT false, and until now nothing could set them: they were in neither
  // DTO and on no form, so every export wrote Tally's default for all four
  // whatever the group actually is. No schema change is needed — only a way in.
  @ApiPropertyOptional({
    description:
      'Tally ISSUBLEDGER. The group behaves as a sub-ledger of its parent: balances ' +
      'report against the parent while each ledger keeps its own identity.',
  })
  @OptionalBoolean()
  accGroupBehaveAsSubledger?: boolean;

  @ApiPropertyOptional({
    description:
      'Tally NETDEBITCREDITFORREPORTING. Report one net figure for the group instead of ' +
      'separate debit and credit totals.',
  })
  @OptionalBoolean()
  accGroupNetDebitCredit?: boolean;

  @ApiPropertyOptional({
    description:
      'Tally USEDFORCALCULATION. The group holds duty/tax ledgers whose values feed ' +
      'invoice calculation rather than standing on their own.',
  })
  @OptionalBoolean()
  accGroupUsedForCalculation?: boolean;

  @ApiPropertyOptional({
    description:
      'Tally AFFECTSGROSSPROFIT. The group counts toward gross profit rather than only ' +
      'net profit — direct expenses and direct income.',
  })
  @OptionalBoolean()
  accGroupAffectsGrossProfit?: boolean;

  // Not one of the four, but in the same hole: acc_group_is_active was in
  // neither DTO either, and the checkbox is commented out in
  // account_group_entry.cpp — a group could not be deactivated from anywhere.
  // Distinct from soft delete: an inactive group keeps its ledgers and its
  // place in the tree, it just stops being offered.
  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  accGroupIsActive?: boolean;
}
