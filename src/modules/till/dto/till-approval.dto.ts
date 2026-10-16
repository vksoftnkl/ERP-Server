import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { TILL_APPROVAL_EVENTS } from '../types/till-enum';
import { TillScopeDto } from './till-session.dto';

/** POST /till/approvals/request (notes 124 §5). */
export class RequestTillApprovalDto extends TillScopeDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;

  @ApiProperty({
    enum: TILL_APPROVAL_EVENTS,
    description:
      'What needs the approval (ck_tap_event): EXPENSE, CASH_PAYMENT, FLOAT_MISMATCH, VOID_BILL, VOID_LINE … A rule ' +
      'that asks nothing for this amount answers 422 TILL_APPROVAL_INVALID (`needed: false`): go ahead.',
  })
  @IsIn([...TILL_APPROVAL_EVENTS])
  event!: string;

  @ApiProperty({ example: 1200, description: 'The amount judged against the rule and the grant ceiling.' })
  @RequiredNumber(0)
  amount!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The till session it is about. Left out: the caller’s counter (device) if any.',
  })
  @NullableUuid()
  sessionId?: string | null;

  @ApiPropertyOptional({
    example: '2026-2027',
    nullable: true,
    description: 'The year of `sessionId` / of the document; left out = today’s.',
  })
  @NullableString(9)
  accYear?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'EXPENSE',
    description:
      'The document an approved request unlocks, as the 428 TILL_APPROVAL_REQUIRED named it: EXPENSE / PAYMENT ' +
      '(the voucher id), TILL_COUNTER (an open’s float difference: the counter id), SALE_BILL … With `srcDocId`.',
  })
  @NullableString(30)
  srcDocType?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srcDocId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Its number, for the inbox.' })
  @NullableString(100)
  srcRefno?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'A till_reason, when one applies.' })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, description: 'Why — the approver reads it.' })
  @NullableString(500)
  note?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Decided here, at the counter: the approver standing there (their grant judged, `approverPin` typed). Left ' +
      'out = PENDING, for an approver to decide on approvals/decide from their own login.',
  })
  @NullableUuid()
  approverId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'A two-person rule: the second person, typing `secondPin`.',
  })
  @NullableUuid()
  secondId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(20)
  secondPin?: string | null;
}

/** One request: get · cancel. */
export class TillApprovalKeyDto extends TillScopeDto {
  @ApiProperty({ example: '2026-2027', description: 'till_approval is partitioned by year.' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tapId!: string;
}

export class CancelTillApprovalDto extends TillApprovalKeyDto {
  @ApiPropertyOptional({ maxLength: 400, nullable: true })
  @NullableString(400)
  note?: string | null;
}

/** POST /till/approvals/decide. */
export class DecideTillApprovalDto extends TillApprovalKeyDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ApiProperty({ maxLength: 500, example: 'Checked the bill with the customer' })
  @TrimmedString(500)
  note!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The caller’s till PIN (the rule’s channel: COUNTER wants it, EITHER takes it).',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'APPROVE under a two-person rule: the second person — not the caller, not whoever asked — typing `secondPin`.',
  })
  @NullableUuid()
  secondId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(20)
  secondPin?: string | null;
}
