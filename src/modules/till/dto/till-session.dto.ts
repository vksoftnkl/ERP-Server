/**
 * Request bodies and query strings of TillController's session, day, movement, event and
 * slip-check routes (/till/days/*, /till/sessions/*, /till/movements/*, /till/events/batch):
 * the class-validator shapes the pipe checks before the controller runs; a refused field
 * reaches the client through TillExceptionFilter as the house error body.
 *
 * Flow of a shape: the DTO (here) → the controller judges the menu right and reads the caller
 * from the token → an input object to the service (TillSessionService, TillDayService,
 * TillDayCloseService, TillMovementService, TillSlipCheckService, TillEventService) → a payload
 * interface of types/till-api.types.ts, wrapped in TillSuccessResponse.
 *
 * The keys build on each other: TillScopeDto (company · branch) → TillSessionKeyDto (+ accYear ·
 * tssId), TillDayKeyDto (+ accYear · tbdId), TillMovementKeyDto (+ accYear · tcmId). The year
 * rides with every id because till_session, till_business_day and till_cash_movement are
 * partitioned by it. The safe, approval and review bodies live in their own files and extend
 * TillScopeDto too.
 *
 * The session's life as these bodies drive it (README "Routes"):
 *   sessions/open-check (TillOpenCheckQueryDto, advice only)
 *   → sessions/open (OpenTillSessionDto: the counter claim, the float, the OPEN count)
 *   → suspend / resume (SuspendTillSessionDto / TillSessionKeyDto)
 *   → end-billing (EndBillingTillSessionDto, the device's sync report)
 *   → count (CountTillSessionDto, one attempt a call)
 *   → decide-variance (DecideTillVarianceDto) when the count was sent for approval
 *   → close (CloseTillSessionDto, the float left) → approve-cash (ApproveTillCashDto)
 *   with force-close / reopen / x-report (notes 117) beside them; the day's open / get /
 *   close-check / close / reopen bodies sit above the sessions, and movements/create · change ·
 *   void · receive and events/batch inside one.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import {
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import {
  APPROVABLE_TREATMENTS,
  TillFloatMode,
  TillVarianceDecision,
  type TillVarianceTreatment,
} from '../types/till-enum';

/** The house key on every verb: company · branch (· year · id for an existing record). */
export class TillScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;
}

/**
 * One existing session: the query of GET sessions/get · expected · movements/supervisors, the
 * body of POST sessions/resume · x-report, and the base of every other session verb.
 */
export class TillSessionKeyDto extends TillScopeDto {
  @ApiProperty({
    example: '2026-2027',
    description: 'till_session is partitioned by year: the id travels with it.',
  })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tssId!: string;
}

/** One line of a count (§4): a denomination for cash, an amount + slips for a SLIPS tender. */
export class TillCountLineDto {
  @ApiProperty({ example: 1, description: 'accounts.acc_tender_types.ttm_type_id (1 = CASH).' })
  @RequiredInteger(1)
  tenderTypeId!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'acc_tender_master — two card terminals are two lines. Cash ignores it (one drawer).',
  })
  @NullableUuid()
  tenderId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Cash by denomination: the note / coin. The amount is its face value × qty, worked out by the server.',
  })
  @NullableUuid()
  denominationId?: string | null;

  @ApiPropertyOptional({
    example: 4,
    description: 'Denomination: pieces. SLIPS: the number of slips.',
  })
  @OptionalInteger(0)
  qty?: number;

  @ApiPropertyOptional({
    example: 12340,
    description:
      'A SLIPS tender’s total, or loose coin typed as one figure. Ignored on a denomination line.',
  })
  @OptionalNumber(0)
  enteredAmount?: number;

  @ApiPropertyOptional({ nullable: true, description: 'EDC batch no / cheque bundle ref.' })
  @NullableString(50)
  batchRef?: string | null;
}

/** GET sessions/open-check. The device and the user are the login token's; the client may echo them. */
export class TillOpenCheckQueryDto extends TillScopeDto {
  @ApiPropertyOptional({
    example: '2026-2027',
    description: 'Accepted for the client’s convenience; the business day decides the year.',
  })
  @NullableString(9)
  accYear?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Must be the login’s own device when sent (400 otherwise).',
  })
  @OptionalUuid()
  deviceId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Must be the login’s own user when sent (400 otherwise).',
  })
  @OptionalUuid()
  userId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The counter the cashier picked: its carried float comes back in carriedFrom. Ignored when it is not on the free list.',
  })
  @OptionalUuid()
  counterId?: string;
}

/** POST /till/sessions/open — the counter claim, the float and the opening count (§8 S1). */
export class OpenTillSessionDto extends TillScopeDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The counter (plan-till-counter-claim §2). A device linked to a counter opens on it: leave this out, or send that ' +
      'counter (any other → TILL_COUNTER_NOT_YOURS). An unlinked device names one from open-check’s free list ' +
      '(required; none free → TILL_NO_FREE_COUNTER). Nothing is written to the counter: the claim lives on the session.',
  })
  @OptionalUuid()
  counterId?: string;

  @ApiPropertyOptional({
    enum: TillFloatMode,
    description:
      'ISSUED = counted out of the safe now (a TFlt voucher); CARRIED = what the previous close on this counter left; ' +
      'NONE = no float. Left out = till.float_mode (a cashless counter is always NONE).',
  })
  @IsOptional()
  @IsIn(Object.values(TillFloatMode))
  floatMode?: TillFloatMode;

  @ApiPropertyOptional({
    example: 2000,
    description: 'ISSUED: what the safe hands over. Left out = the counter’s default float.',
  })
  @NullableNumber(0)
  floatIssued?: number | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'CARRIED: whose drawer this is. Left out = the last CLOSED session on the counter.',
  })
  @OptionalUuid()
  prevSessionId?: string;

  @ApiProperty({
    type: () => TillCountLineDto,
    isArray: true,
    description:
      'The opening count, cash only. A difference from the float issued is a FLOAT_MISMATCH variance.',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines: TillCountLineDto[] = [];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Counted ≠ issued: the reason, a till_reason of category FLOAT_MISMATCH, stored on the OPEN-stage variance. ' +
      'Left out = the shipped UNKNOWN reason, which needs `notes`. Not read when the count matches.',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Notes 124 §5 — counted ≠ issued under till.approval_gate REFUSE: an APPROVED FLOAT_MISMATCH request for ' +
      'this counter (/till/approvals/request with srcDocType TILL_COUNTER, srcDocId the counter, the difference ' +
      'as amount), after the open answered 428 TILL_APPROVAL_REQUIRED. Taken by the open; a wrong one → 422 ' +
      'TILL_APPROVAL_INVALID. Under WARN (as shipped) the open goes through and a request waits in the inbox.',
  })
  @NullableUuid()
  approvalId?: string | null;
}

/** POST /till/sessions/suspend (a break, idle); sessions/resume takes the bare key. */
export class SuspendTillSessionDto extends TillSessionKeyDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'till_reason, category SUSPEND (break, meal …).',
  })
  @NullableUuid()
  reasonId?: string | null;
}

/** POST /till/sessions/end-billing — with the device's sync report (REV 2 §2.6). */
export class EndBillingTillSessionDto extends TillSessionKeyDto {
  @ApiPropertyOptional({
    example: 0,
    description:
      'Documents the device still holds unsent. Above 0 the end is refused (TILL_DEVICE_UNSYNCED).',
  })
  @OptionalInteger(0)
  outboxCount?: number;

  @ApiPropertyOptional({
    example: 42,
    description:
      'The device’s last till-event clientSeq. Refused while the server has not received up to it.',
  })
  @OptionalInteger(0)
  lastClientSeq?: number;
}

/**
 * POST /till/sessions/count — one attempt of the close count (§5.4): cash by denomination,
 * card / UPI batches by amount + slips. Answered by TillCountResultPayload, never the figure
 * to a blind cashier.
 */
export class CountTillSessionDto extends TillSessionKeyDto {
  @ApiProperty({
    type: () => TillCountLineDto,
    isArray: true,
    description: 'Cash by denomination, SLIPS tenders by amount + slips.',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines: TillCountLineDto[] = [];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'A second person at the count (till.close_witness).',
  })
  @NullableUuid()
  witnessBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** POST /till/sessions/close — once the count is final: what stays in the drawer, the rest is handed over. */
export class CloseTillSessionDto extends TillSessionKeyDto {
  @ApiPropertyOptional({
    example: 2000,
    nullable: true,
    description:
      'Cash left in the drawer for the next session. Left out = the counter’s default float under till.float_mode CARRIED, else 0. ' +
      'The rest of the cash counted is handed to the safe (a TDrp voucher).',
  })
  @NullableNumber(0)
  floatLeft?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** /till/sessions/decide-variance (notes 105 A1). */
export class DecideTillVarianceDto extends TillSessionKeyDto {
  @ApiProperty({
    enum: TillVarianceDecision,
    description:
      'APPROVE: the PENDING variances take `treatment`, the session returns to COUNTING and /close posts them. ' +
      'RECOUNT: back to COUNTING with one more count attempt; the next final count replaces the variances.',
  })
  @IsIn(Object.values(TillVarianceDecision))
  decision!: TillVarianceDecision;

  @ApiPropertyOptional({
    enum: APPROVABLE_TREATMENTS,
    nullable: true,
    description:
      'APPROVE only. EXPENSE → Cash Short & Excess · RECOVER → the cashier’s staff advance ledger (notes 95; ' +
      'none → 422 TILL_LEDGER_UNMAPPED on this field) · SUSPENSE → Tender suspense, cleared later by a journal.',
  })
  @IsOptional()
  @IsIn([...APPROVABLE_TREATMENTS])
  treatment?: TillVarianceTreatment | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'APPROVE only: a till_reason of category VARIANCE (a cash gap) or NONCASH (a slip gap) — 422 TILL_REASON_INVALID otherwise.',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiProperty({ maxLength: 500, description: 'The decision note. Required.' })
  @TrimmedString(500)
  note!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The approver’s till PIN (usr_pin_hash, notes 95). Required when the rule’s channel is COUNTER; on EITHER it ' +
      'stands in for remote authority (taa_can_remote). Wrong → 403 TILL_APPROVER_PIN, journalled PIN_FAIL; none set → 422 TILL_APPROVER_NO_PIN.',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Notes 113: a received bag (the hand-over / drop, of this session) whose RECEIVE-stage difference is ' +
      'PENDING. The session may be in any status. APPROVE only (400 on RECOUNT: the count stands); the TVar ' +
      'posts at once, Dr / Cr Till cash awaiting receipt. Neither the receiver nor the bag’s cashier decides it. ' +
      'Left out = the close variance of a PENDING_APPROVAL session, as before.',
  })
  @NullableUuid()
  tcmId?: string | null;
}

/** POST /till/sessions/approve-cash (notes 114). */
export class ApproveTillCashDto extends TillSessionKeyDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'The caller’s own till PIN (usr_pin_hash, notes 95). None set → 422 TILL_RECEIVER_NO_PIN; none typed → ' +
      '403 TILL_RECEIVER_PIN_REQUIRED; wrong → 403 TILL_RECEIVER_PIN, journalled PIN_FAIL. May be left out only ' +
      'under till.single_operator by the session’s own cashier; the cashier approving their own cash under a ' +
      'CASH_VARIANCE rule with tar_allow_self always types it (notes 127 §3).',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({
    example: 500,
    nullable: true,
    description:
      'What the supervisor received for the whole session (hand-over + drops awaiting receipt). Left out = ' +
      'exactly what was handed over. A difference beyond till.cash_tolerance needs `treatment` to be decided ' +
      'here, else it is sent for approval.',
  })
  @NullableNumber(0)
  receivedAmount?: number | null;

  @ApiPropertyOptional({
    enum: APPROVABLE_TREATMENTS,
    nullable: true,
    description:
      'Only read for a gap beyond tolerance: decide it in this step (the caller’s Till Approval Authority grant ' +
      'for CASH_VARIANCE must cover it — 403 TILL_APPROVER_NO_GRANT / TILL_APPROVER_LIMIT otherwise, nothing ' +
      'written). Left out = SENT_FOR_APPROVAL. EXPENSE → Cash Short & Excess · RECOVER → the cashier’s staff ' +
      'advance ledger · SUSPENSE → Tender suspense.',
  })
  @IsOptional()
  @IsIn([...APPROVABLE_TREATMENTS])
  treatment?: TillVarianceTreatment | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'With `treatment`: a till_reason of category VARIANCE (422 TILL_REASON_INVALID otherwise).',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** Notes 117 §4 — POST /till/sessions/force-close. */
export class ForceCloseTillSessionDto extends TillSessionKeyDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'A FORCE_CLOSE reason (Cashier left, Shift over time, Device failure, Day close, Other).',
  })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'The caller’s till PIN for the FORCE_CLOSE rule (STORE_MANAGER, EITHER: a PIN, else remote authority). ' +
      'Wrong → 403 TILL_APPROVER_PIN, journalled PIN_FAIL; none set → 422 TILL_APPROVER_NO_PIN.',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiProperty({
    type: () => TillCountLineDto,
    isArray: true,
    description: 'The supervisor’s count of the drawer, as /count takes it.',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines: TillCountLineDto[] = [];

  @ApiPropertyOptional({
    nullable: true,
    description: 'As /close: left out = the counter’s default float under CARRIED, else 0.',
  })
  @NullableNumber(0)
  floatLeft?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Needed when the reason needs a note.' })
  @NullableString(500)
  notes?: string | null;
}

/** Notes 117 §5 — POST /till/sessions/reopen. */
export class ReopenTillSessionDto extends TillSessionKeyDto {
  @ApiProperty({
    format: 'uuid',
    description: 'A REOPEN reason (Count keyed wrong, Transaction missed …).',
  })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The caller’s till PIN for the SESSION_REOPEN rule (STORE_MANAGER, EITHER).',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Needed when the reason needs a note.' })
  @NullableString(500)
  notes?: string | null;
}

/** The business day's key (notes 117): company · branch · year · id. */
export class TillDayKeyDto extends TillScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tbdId!: string;
}

/** One live session's drawer, counted by the supervisor closing the day over it. */
export class TillDayCloseCountDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tssId!: string;

  @ApiProperty({ type: () => TillCountLineDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines: TillCountLineDto[] = [];

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber(0)
  floatLeft?: number | null;
}

/**
 * The DAY_CLOSE_EXCEPTION of POST /till/days/close (notes 117 §2): the reason, the approver
 * typing their PIN at this desk, and one count per live session the close force-closes.
 */
export class TillDayCloseExceptionDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'A DAY_CLOSE reason (Cashier gone: drawer counted by the supervisor · Safe counted next morning · Other).',
  })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Who approves (DAY_CLOSE_EXCEPTION, STORE_MANAGER): someone other than the caller, who types their own ' +
      'till PIN here. Left out = the caller, refused (TILL_APPROVER_SELF) unless the rule allows self.',
  })
  @NullableUuid()
  approverId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({
    type: () => TillDayCloseCountDto,
    isArray: true,
    description:
      'One per live session (SESSIONS_LIVE): the supervisor’s count of its drawer. The session is force-closed ' +
      '(reason “Day close”) and its hand-over received on that count. A live session left out → 422 ' +
      'TILL_FORCE_COUNT_REQUIRED.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TillDayCloseCountDto)
  counts?: TillDayCloseCountDto[];
}

/** Notes 117 §2 — POST /till/days/close. */
export class CloseTillDayDto extends TillDayKeyDto {
  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;

  @ApiPropertyOptional({
    type: () => TillDayCloseExceptionDto,
    nullable: true,
    description: 'Only to close over RED items an exception may cover (SESSIONS_LIVE).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TillDayCloseExceptionDto)
  exception?: TillDayCloseExceptionDto | null;
}

/** Notes 117 §3 — POST /till/days/reopen. */
export class ReopenTillDayDto extends TillDayKeyDto {
  @ApiProperty({
    format: 'uuid',
    description: 'A DAY_REOPEN reason (Correction, Late transaction).',
  })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The caller’s till PIN for the DAY_REOPEN rule (AREA_MANAGER, EITHER).',
  })
  @NullableString(20)
  approverPin?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Needed when the reason needs a note.' })
  @NullableString(500)
  notes?: string | null;
}

/** GET /till/days/get — one business day by id, or today's when tbdId is left out. */
export class TillDayGetQueryDto extends TillScopeDto {
  @ApiPropertyOptional({
    example: '2026-2027',
    description: 'With tbdId; left out = today’s business date.',
  })
  @IsOptional()
  @UpperMaxString(9)
  accYear?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  tbdId?: string;
}

/** POST /till/days/open — a manager's Day Open (the only way in under till.day_auto_open = false). */
export class OpenTillDayDto extends TillScopeDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;
}

/** One client fact for /till/events/batch. */
export class TillClientEventDto {
  @ApiProperty({
    example: 'NO_SALE',
    description:
      'DRAWER_OPEN_SALE · NO_SALE · DRAWER_LEFT_OPEN · X_REPORT · REPRINT · SESSION_IDLE_LOCK · CASH_ALERT · ' +
      'OFFLINE_START · OFFLINE_END · LOGIN · LOGOUT · SYNC_PENDING_AT_CLOSE',
  })
  @UpperMaxString(30)
  code!: string;

  @ApiProperty({
    example: '2026-10-08T10:15:00+05:30',
    description: 'When it happened, by the DEVICE clock.',
  })
  @IsDateString()
  eventOn!: string;

  @ApiProperty({
    example: 42,
    description: 'The device’s own running number: a batch sent twice is stored once.',
  })
  @RequiredInteger(1)
  clientSeq!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sessionId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'SALE_BILL' })
  @NullableString(30)
  srcDocType?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srcDocId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(100)
  srcRefno?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber(0)
  amount?: number | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'till_reason (a no-sale’s reason).',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  payload?: Record<string, unknown> | null;
}

/** POST /till/events/batch — a device's own facts, up to 500 a call (TillEventService.ingestBatch). */
export class TillEventBatchDto extends TillScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ type: () => TillClientEventDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TillClientEventDto)
  events!: TillClientEventDto[];
}

/** POST /till/movements/create — one drawer movement (S3). */
export class CreateTillMovementDto extends TillSessionKeyDto {
  @ApiProperty({
    enum: ['DROP', 'PAID_IN', 'EXCHANGE', 'PICKUP', 'TOP_UP'],
    description:
      'Every kind is entered at the counter by the session’s cashier, on its device (Open Till 272 EDIT). ' +
      'PICKUP / TOP_UP are two signatures (notes 110): the cashier calling, and the supervisor standing there ' +
      '(supervisorId + supervisorPin). On a PICKUP the cashier gives and the supervisor receives; on a TOP_UP ' +
      'the supervisor gives and the cashier receives. Recorded as tcmDoneBy = the cashier, tcmWitnessBy = the ' +
      'supervisor, tcmWitnessVerifiedOn = when the supervisor’s PIN was checked. A DROP goes into the counter’s ' +
      'own drop safe (422 TILL_NO_DROP_SAFE when it has none).',
  })
  @IsIn(['DROP', 'PAID_IN', 'EXCHANGE', 'PICKUP', 'TOP_UP'])
  kind!: 'DROP' | 'PAID_IN' | 'EXCHANGE' | 'PICKUP' | 'TOP_UP';

  @ApiPropertyOptional({
    example: 5000,
    description:
      'The amount. With denomination lines it is worked out from them (and must agree if both are sent).',
  })
  @NullableNumber(0)
  amount?: number | null;

  @ApiPropertyOptional({
    type: () => TillCountLineDto,
    isArray: true,
    description:
      'Cash by denomination: what moved (PICKUP, TOP_UP) or what came IN (EXCHANGE). Not on a DROP (sealed bag).',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines: TillCountLineDto[] = [];

  @ApiPropertyOptional({
    type: () => TillCountLineDto,
    isArray: true,
    description: 'EXCHANGE only: what went OUT.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  outLines: TillCountLineDto[] = [];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'till_reason — PAID_IN and PICKUP must name one.',
  })
  @NullableUuid()
  reasonId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'PAID_IN: the ledger the money comes from (default: the reason’s).',
  })
  @NullableUuid()
  ledgerId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Bill / slip / voucher no (a reason may demand it).',
  })
  @NullableString(50)
  refNo?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-10-08' })
  @NullableString(10)
  refDate?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Who gave the cash (free text).' })
  @NullableString(150)
  partyName?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'DROP: the tamper-evident bag.' })
  @NullableString(30)
  bagNo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(30)
  sealNo?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'DROP / PAID_IN / EXCHANGE: a second person, named only (never the caller). Not read on PICKUP / ' +
      'TOP_UP, whose second person is supervisorId (notes 110).',
  })
  @NullableUuid()
  witnessBy?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    deprecated: true,
    description:
      'Notes 108, retired by notes 110: no longer read. A PICKUP / TOP_UP is signed by supervisorPin. Still ' +
      'accepted so a client built for notes 108 is not refused on an unknown field.',
  })
  @NullableString(20)
  witnessPin?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Notes 110 — PICKUP / TOP_UP, required: the supervisor signing at the counter (GET ' +
      '/till/movements/supervisors lists who can). On a PICKUP they receive the cash from the cashier; on a ' +
      'TOP_UP they give it. An active user (422 TILL_MOVEMENT_INVALID), not the session’s cashier (422 ' +
      'TILL_SUPERVISOR_SELF), holding Till Sessions (273) OVERRIDE themselves (403 TILL_SUPERVISOR_RIGHT). ' +
      'Ignored on DROP / PAID_IN / EXCHANGE.',
  })
  @NullableUuid()
  supervisorId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '4321',
    description:
      'Notes 110 — PICKUP / TOP_UP, required: the supervisor’s till PIN (usr_pin_hash, notes 95), typed by the ' +
      'supervisor on the cashier’s screen after the count, so it signs the counted amount. Checked before ' +
      'anything is written: none set → 422 TILL_SUPERVISOR_NO_PIN, none typed → 403 ' +
      'TILL_SUPERVISOR_PIN_REQUIRED, wrong → 403 TILL_SUPERVISOR_PIN (journalled PIN_FAIL). Ignored on DROP / ' +
      'PAID_IN / EXCHANGE.',
  })
  @NullableString(20)
  supervisorPin?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** One movement: the query of GET /till/movements/get, the base of movements/void. */
export class TillMovementKeyDto extends TillScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tcmId!: string;
}

/** POST /till/movements/void — a hand-posted movement of a session still live, with a MOVEMENT_VOID reason (REV 2 §2.8). */
export class VoidTillMovementDto extends TillMovementKeyDto {
  @ApiProperty({ format: 'uuid', description: 'till_reason, category MOVEMENT_VOID.' })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** GET /till/movements/awaiting-receipt (notes 113). */
export class TillAwaitingReceiptQueryDto extends TillScopeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'One business day’s bags (with accYear); left out = every unreceived bag of the branch.',
  })
  @OptionalUuid()
  dayId?: string;

  @ApiPropertyOptional({ example: '2026-2027', description: 'With dayId.' })
  @IsOptional()
  @UpperMaxString(9)
  accYear?: string;
}

/** One bag of POST /till/movements/receive (notes 113). */
export class TillReceiveBagDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'The CLOSE_HANDOVER / DROP awaiting receipt.' })
  @RequiredUuid()
  tcmId!: string;

  @ApiProperty({
    type: () => TillCountLineDto,
    isArray: true,
    description:
      'The receiver’s blind count of the bag, cash by denomination (loose coin as enteredAmount). Empty = an ' +
      'empty bag: received 0.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines: TillCountLineDto[] = [];

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @NullableString(500)
  notes?: string | null;
}

/** POST /till/movements/receive (notes 113). */
export class TillReceiveDto extends TillScopeDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'The receiver’s own till PIN (usr_pin_hash, notes 95), once for the sitting. None set → 422 ' +
      'TILL_RECEIVER_NO_PIN; none typed → 403 TILL_RECEIVER_PIN_REQUIRED; wrong → 403 TILL_RECEIVER_PIN, ' +
      'journalled PIN_FAIL.',
  })
  @NullableString(20)
  receiverPin?: string | null;

  @ApiProperty({
    type: () => TillReceiveBagDto,
    isArray: true,
    description: 'One or more bags, each with its own count. All are received, or none.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TillReceiveBagDto)
  bags!: TillReceiveBagDto[];
}

/** POST /till/movements/change — change carried from one counter to another (REV 2 §2.14). */
export class TillChangeDto extends TillScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The session GIVING the change (its cashier witnesses).',
  })
  @RequiredUuid()
  fromTssId!: string;

  @ApiProperty({ format: 'uuid', description: 'The session receiving it.' })
  @RequiredUuid()
  toTssId!: string;

  @ApiProperty({
    type: () => TillCountLineDto,
    isArray: true,
    description: 'The change, by denomination.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TillCountLineDto)
  lines!: TillCountLineDto[];

  @ApiProperty({ format: 'uuid', description: 'A PICKUP reason, as every pickup names one.' })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '4321',
    description:
      'Notes 108 — the GIVING cashier’s till PIN (they witness the pickup). Required. Refusals on this field: ' +
      '422 TILL_WITNESS_NO_PIN, 403 TILL_WITNESS_PIN_REQUIRED, 403 TILL_WITNESS_PIN (journalled PIN_FAIL).',
  })
  @NullableString(20)
  fromWitnessPin?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '8642',
    description:
      'Notes 108 — the RECEIVING cashier’s till PIN (they witness the top-up). Required unless the caller is that ' +
      'cashier; the same refusals, on this field.',
  })
  @NullableString(20)
  toWitnessPin?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;
}

/** Non-cash plan §4.2 — one terminal of a counted session. */
export class TillSlipCheckQueryDto extends TillSessionKeyDto {
  @ApiProperty({ format: 'uuid', description: 'The terminal / VPA tender whose rows are checked.' })
  @RequiredUuid()
  tenderId!: string;
}

/** A paper slip the slip check found no tender row for (§4.2): paid on the machine, billed as another tender? */
export class TillSlipWithoutRowDto {
  @ApiProperty({ example: 160 })
  @OptionalNumber(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'A81K2Z', nullable: true })
  @NullableString(20)
  authCode?: string | null;

  @ApiPropertyOptional({ example: '4432', nullable: true })
  @NullableString(4)
  cardLast4?: string | null;
}

/** The approver's verdict: counts and exceptions. The ticks themselves are not kept (§4.2). */
export class TillSlipCheckDto extends TillSlipCheckQueryDto {
  @ApiProperty({ example: 13, description: 'Rows ticked against a slip.' })
  @RequiredInteger(0)
  ticked!: number;

  @ApiProperty({ type: [String], description: 'Rows with no slip (tdId): payment never taken?' })
  @IsArray()
  @ArrayMaxSize(500)
  noSlip!: string[];

  @ApiProperty({ type: [String], description: 'Rows whose slip shows another amount (tdId).' })
  @IsArray()
  @ArrayMaxSize(500)
  amountDiffers!: string[];

  @ApiProperty({
    type: [TillSlipWithoutRowDto],
    description: 'Slips with no row: paid on the machine, billed as another tender?',
  })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TillSlipWithoutRowDto)
  slipsWithoutRow!: TillSlipWithoutRowDto[];

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  notes?: string | null;
}
