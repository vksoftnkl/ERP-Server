import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsString, MaxLength } from 'class-validator';
import {
  OptionalBoolean,
  OptionalDateString,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

/** Plan 2026-10-05 §7.1 — MERGED is not settable here; merge is its own operation and is not built. */
export const SETTABLE_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];

/** `POST /loyalty/members/status` */
export class LoyaltyMemberStatusDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' })
  @RequiredUuid()
  memberId!: string;

  @ApiProperty({ enum: SETTABLE_STATUSES })
  @IsString()
  @IsIn(SETTABLE_STATUSES)
  status!: SettableStatus;

  @ApiPropertyOptional({
    maxLength: 250,
    description: 'Required for SUSPENDED and CLOSED (lmb_block_reason and the status trail).',
  })
  @OptionalTrimmedString(250)
  reason?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'D6: CLOSED is refused while the balance ≠ 0 unless force is sent. With force the wallet is ' +
      'zeroed first — one ADJUST row per open lot — which needs approvedBy and the delete right ' +
      'on menu 79.',
  })
  @OptionalBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'public.user_master.usr_id — required with force.',
  })
  @OptionalUuid()
  approvedBy?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The branch the action is taken at; absent = the member’s home branch, else the session’s.',
  })
  @OptionalUuid()
  branchId?: string;
}

/** `POST /loyalty/members/adjust` */
export class LoyaltyMemberAdjustDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The branch the adjustment is booked at (lld_branch_id).',
  })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: 'sales.loyalty_member.lmb_id' })
  @RequiredUuid()
  memberId!: string;

  @ApiProperty({
    example: 50,
    description:
      'SIGNED, ≠ 0. Positive opens a lot (never lapses unless expiresOn is sent). Negative draws ' +
      'FIFO like a redeem and is refused beyond the redeemable balance (422 SALES_LOYALTY_CAP).',
  })
  @IsNumber()
  points!: number;

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @MaxLength(250)
  reason!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'public.user_master.usr_id — ck_lld_adjust_approval refuses an ADJUST without one.',
  })
  @RequiredUuid()
  approvedBy!: string;

  @ApiPropertyOptional({
    example: '2026-10-05',
    description: 'YYYY-MM-DD; absent = today (company-local).',
  })
  @OptionalDateString()
  txnDate?: string;

  @ApiPropertyOptional({
    example: '2027-10-05',
    description: 'For a positive adjustment: when its lot lapses. Absent = never.',
  })
  @OptionalDateString()
  expiresOn?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The scheme the movement files under; absent = the member’s, else that of the latest lot.',
  })
  @OptionalUuid()
  lscId?: string;
}

/** `GET /loyalty/members/history` — the Ctrl+H trail. */
export class LoyaltyMemberHistoryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  memberId!: string;
}
