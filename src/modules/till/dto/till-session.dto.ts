import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { TillFloatMode } from '../types/till-enum';

/** The house key on every verb: company · branch (· year · id for an existing record). */
export class TillScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;
}

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
}

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
      'DROP / PAID_IN / EXCHANGE: the session’s cashier. PICKUP / TOP_UP: a supervisor (Till Sessions OVERRIDE); ' +
      'a pickup’s witness is the cashier.',
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
      'A second person. PICKUP: defaults to the session’s cashier, and is never the supervisor.',
  })
  @NullableUuid()
  witnessBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;
}

export class TillMovementKeyDto extends TillScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tcmId!: string;
}

export class VoidTillMovementDto extends TillMovementKeyDto {
  @ApiProperty({ format: 'uuid', description: 'till_reason, category MOVEMENT_VOID.' })
  @RequiredUuid()
  reasonId!: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(500)
  notes?: string | null;
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
