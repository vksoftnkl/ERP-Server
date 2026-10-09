import { Body, Controller, Get, HttpCode, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { API_VERSION } from '../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TillContextService } from './till-context.service';
import { TillExceptionFilter } from './till-exception.filter';
import { throwTill } from './till-errors';
import { TillDayService } from './services/till-day.service';
import { TillEventService } from './services/till-event.service';
import { TillSessionService } from './services/till-session.service';
import { TillMovementService } from './services/till-movement.service';
import { TillSlipCheckService } from './services/till-slip-check.service';
import {
  CloseTillSessionDto,
  CountTillSessionDto,
  EndBillingTillSessionDto,
  OpenTillDayDto,
  OpenTillSessionDto,
  SuspendTillSessionDto,
  TillDayGetQueryDto,
  TillEventBatchDto,
  TillOpenCheckQueryDto,
  TillScopeDto,
  TillSessionKeyDto,
  CreateTillMovementDto,
  TillMovementKeyDto,
  VoidTillMovementDto,
  TillChangeDto,
  TillSlipCheckDto,
  TillSlipCheckQueryDto,
} from './dto/till-session.dto';
import { TillErrorResponseDto, TillSuccessDto } from './dto/till-response.dto';
import {
  SUPERVISOR_MOVEMENTS,
  TILL_MENU,
  TillErrorCode,
  TillMovementKind,
} from './types/till-enum';
import type {
  TillCountResultPayload,
  TillDayPayload,
  TillEventBatchPayload,
  TillMovementDetailPayload,
  TillOpenCheckPayload,
  TillSessionPayload,
  TillSlipCheckPayload,
  TillSlipCheckResultPayload,
  TillSuccessResponse,
} from './types/till-api.types';

/**
 * /till/* — the business day, the cashier's session and the till journal
 * (TILL_DESIGN.md REV 1 §7.2, build phase 1). Every route is judged on a
 * user_menus flag (menus 271–276); GETs are never cached (@CacheTTL(0)): a
 * session's state is exactly what must not be served stale.
 *
 *   Open Till (272)      VIEW current / get my session · CREATE open · EDIT the rest
 *   Till Sessions (273)  VIEW another cashier's session · OVERRIDE the expected figures
 *   Business Day (274)   VIEW · CREATE (Day Open)
 */
@ApiTags('Till')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: TillErrorResponseDto })
@Controller('till')
@UseFilters(TillExceptionFilter)
export class TillController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly days: TillDayService,
    private readonly sessions: TillSessionService,
    private readonly events: TillEventService,
    private readonly movements: TillMovementService,
    private readonly slipCheck: TillSlipCheckService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Business day
  // ═════════════════════════════════════════════════════════════════════════

  @Post('days/open')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Day Open — open today’s business day for the branch',
    description:
      'The only way in when till.day_auto_open is false. Idempotent: an open day is returned as it is. ' +
      'Business Day (274) CREATE.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  @ApiConflictResponse({
    type: TillErrorResponseDto,
    description: 'TILL_DAY_CLOSING · SALES_DAY_CLOSED · TILL_YEAR_NOT_SET_UP',
  })
  async openDay(@Body() dto: OpenTillDayDto): Promise<TillSuccessResponse<TillDayPayload>> {
    await this.context.requireRight(TILL_MENU.BUSINESS_DAY, 'create', 'open the business day');
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      ...dto,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const { day, created } = await this.days.open(
      { companyId: dto.companyId, branchId: dto.branchId, tenantId: dto.tenantId ?? null },
      settings,
      caller,
    );
    return {
      success: true,
      message: created
        ? `Business day ${day.tbdBusinessDate} opened`
        : `Business day ${day.tbdBusinessDate} is already open`,
      data: day,
    };
  }

  @Get('days/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'A business day — today’s when no id is given',
    description:
      'Status and the sessions hanging off it, by status. Business Day (274) VIEW, or Open Till (272) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  async getDay(@Query() query: TillDayGetQueryDto): Promise<TillSuccessResponse<TillDayPayload>> {
    await this.requireAny(
      [
        [TILL_MENU.BUSINESS_DAY, 'view'],
        [TILL_MENU.OPEN_TILL, 'view'],
      ],
      'view the business day',
    );
    if (query.tbdId && !query.accYear) {
      throwTill(TillErrorCode.SESSION_NOT_FOUND, 'tbdId travels with its accYear', 'accYear');
    }
    const caller = await this.context.caller();
    const settings = await this.context.settings({
      ...query,
      deviceId: caller.deviceId,
      userId: caller.userId,
    });
    const day = await this.days.get(
      {
        companyId: query.companyId,
        branchId: query.branchId,
        accYear: query.accYear ?? '',
        tbdId: query.tbdId ?? null,
      },
      settings,
    );
    return {
      success: true,
      message: `Business day ${day.tbdBusinessDate} is ${day.tbdStatus}`,
      data: day,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Session
  // ═════════════════════════════════════════════════════════════════════════

  @Get('sessions/open-check')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Everything S1 needs before an open, in one call (plan-till-counter-claim §4)',
    description:
      'requireSession (false = back office: no S1) · the business day · the counter this device is linked to, or the ' +
      'free counters it may pick (and the busy ones, with who holds them) · a session this device already holds · this ' +
      'user’s session on another device · the carried float. Every free counter carries its own carriedFrom; the ' +
      'top-level one is the linked counter’s, or the counterId asked for. The device and the user are the login’s. ' +
      'Read-only advice: open checks it all again. Open Till (272) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiConflictResponse({
    type: TillErrorResponseDto,
    description: 'TILL_DEVICE_REQUIRED · TILL_DEVICE_UNKNOWN',
  })
  @ApiForbiddenResponse({ type: TillErrorResponseDto, description: 'TILL_DEVICE_BLOCKED' })
  async openCheck(
    @Query() query: TillOpenCheckQueryDto,
  ): Promise<TillSuccessResponse<TillOpenCheckPayload>> {
    await this.context.requireRight(TILL_MENU.OPEN_TILL, 'view', 'check a till open');
    const data = await this.sessions.openCheck({
      companyId: query.companyId,
      branchId: query.branchId,
      deviceId: query.deviceId ?? null,
      userId: query.userId ?? null,
      counterId: query.counterId ?? null,
    });
    const where = data.linkedCounter
      ? `linked to ${data.linkedCounter.code}`
      : `${data.freeCounters.length} free counter(s)`;
    return {
      success: true,
      message: data.requireSession
        ? `This device needs a till session: ${where}`
        : 'No till session needed here',
      data,
    };
  }

  @Post('sessions/open')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Open a till session on this device’s counter (S1)',
    description:
      'Counter (plan-till-counter-claim §2): a device linked to a counter opens there; an unlinked one names a counter ' +
      'from open-check’s free list. Nothing is written to the counter: the session is stamped with this device and ' +
      'money posts only from it. One live session per counter, per device and per cashier. Opens the business day ' +
      'if till.day_auto_open. The float: ISSUED posts a TFlt (Dr till cash / Cr safe) for what the safe hands over; ' +
      'CARRIED inherits what the previous close left. The opening count is cash only; counted ≠ issued posts the ' +
      'difference at once as an OPEN-stage variance (TVar Dr / Cr Cash Short & Excess against till cash, treatment ' +
      'EXPENSE, the FLOAT_MISMATCH `reasonId` or the UNKNOWN reason) — the phase-3 approver re-treats it. ' +
      'Open Till (272) CREATE.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  @ApiConflictResponse({
    type: TillErrorResponseDto,
    description:
      'TILL_DEVICE_REQUIRED · TILL_DEVICE_UNKNOWN · TILL_COUNTER_INACTIVE · TILL_COUNTER_NOT_YOURS · ' +
      'TILL_NO_FREE_COUNTER · TILL_COUNTER_BUSY · TILL_OPERATOR_BUSY · TILL_DAY_NOT_OPEN · TILL_DAY_CLOSING · ' +
      'SALES_DAY_CLOSED',
  })
  @ApiForbiddenResponse({ type: TillErrorResponseDto, description: 'TILL_DEVICE_BLOCKED' })
  @ApiUnprocessableEntityResponse({
    type: TillErrorResponseDto,
    description:
      'TILL_FLOAT_INVALID · TILL_COUNT_INVALID · TILL_REASON_INVALID · TILL_SAFE_MISSING · TILL_LEDGER_UNMAPPED',
  })
  async open(@Body() dto: OpenTillSessionDto): Promise<TillSuccessResponse<TillSessionPayload>> {
    await this.context.requireRight(TILL_MENU.OPEN_TILL, 'create', 'open a till session');
    const data = await this.sessions.open({
      companyId: dto.companyId,
      branchId: dto.branchId,
      tenantId: dto.tenantId ?? null,
      counterId: dto.counterId ?? null,
      floatMode: dto.floatMode ?? null,
      floatIssued: dto.floatIssued ?? null,
      prevSessionId: dto.prevSessionId ?? null,
      lines: dto.lines,
      reasonId: dto.reasonId ?? null,
      notes: dto.notes ?? null,
    });
    return { success: true, message: `Session ${data.tssSessionNo} opened`, data };
  }

  @Get('sessions/current')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The live session for this device or this user — resume at login',
    description:
      '`data` is null when there is none. Superseded by sessions/open-check (plan-till-counter-claim §0). ' +
      'Open Till (272) VIEW.',
    deprecated: true,
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async current(
    @Query() query: TillScopeDto,
  ): Promise<TillSuccessResponse<TillSessionPayload | null>> {
    await this.context.requireRight(TILL_MENU.OPEN_TILL, 'view', 'view your till session');
    const data = await this.sessions.current(query);
    return {
      success: true,
      message: data ? `Session ${data.tssSessionNo} is ${data.tssStatus}` : 'No live till session',
      data,
    };
  }

  @Get('sessions/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One session: header, tenders, the vouchers it posted, its variances',
    description:
      'Your own session needs Open Till (272) VIEW; another cashier’s, Till Sessions (273) VIEW. In a hidden-expected count (till.blind_close) the ' +
      'expected / variance figures come back null to the cashier (expectedVisible = false) until the session closes.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  async get(@Query() query: TillSessionKeyDto): Promise<TillSuccessResponse<TillSessionPayload>> {
    const asOperator = await this.requireSessionView(query);
    const data = await this.sessions.get(query, { asOperator });
    return { success: true, message: `Session ${data.tssSessionNo} is ${data.tssStatus}`, data };
  }

  @Get('sessions/slip-check')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary:
      'The slip check: the rows behind one terminal of a counted session (non-cash plan §4.2)',
    description:
      'Expected, the batch total and batch no the cashier entered, and every live row of that tender in the ' +
      'session (time, bill, amount, approval code, last 4, reference) to tick against the slips. Till Sessions ' +
      '(273) OVERRIDE; refused to the session’s own cashier before it closes (TILL_BLIND_CLOSE).',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async slipCheckRows(
    @Query() query: TillSlipCheckQueryDto,
  ): Promise<TillSuccessResponse<TillSlipCheckPayload>> {
    await this.assertApprover(query, 'check the slips of a till session');
    const data = await this.slipCheck.rows(query);
    return {
      success: true,
      message: `${data.rows.length} row(s) on ${data.tenderName ?? 'the terminal'}`,
      data,
    };
  }

  @Post('sessions/slip-check')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record a slip check: a SLIP_CHECK event with the counts and the exceptions',
    description:
      'The ticks are not stored (§4.2): the rows with no slip, the slips with no row and the amounts that ' +
      'differ are. Fixes are re-tenders; what they cannot explain is the NONCASH_VARIANCE the approver ' +
      'decides. Till Sessions (273) OVERRIDE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async slipCheckRecord(
    @Body() dto: TillSlipCheckDto,
  ): Promise<TillSuccessResponse<TillSlipCheckResultPayload>> {
    await this.assertApprover(dto, 'record a slip check');
    const data = await this.slipCheck.record(dto);
    return { success: true, message: 'Slip check recorded', data };
  }

  @Get('sessions/expected')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'A session with every expected figure shown — supervisor only',
    description:
      'What a hidden-expected count hides from the cashier (§5.4). Till Sessions (273) OVERRIDE; refused to the session’s own ' +
      'cashier while it is not closed (TILL_BLIND_CLOSE).',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async expected(
    @Query() query: TillSessionKeyDto,
  ): Promise<TillSuccessResponse<TillSessionPayload>> {
    await this.context.requireRight(
      TILL_MENU.SESSIONS,
      'override',
      'see the expected till figures',
    );
    const caller = await this.context.caller();
    const owner = await this.operatorOf(query);
    if (owner.tssOperatorId === caller.userId && owner.tssStatus !== 'CLOSED') {
      throwTill(
        TillErrorCode.BLIND_CLOSE,
        'The cashier of a session does not see its expected figures before it closes',
        'tssId',
      );
    }
    const data = await this.sessions.getWithExpected(query);
    return { success: true, message: `Session ${data.tssSessionNo} — expected figures`, data };
  }

  @Post('sessions/suspend')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Suspend — a break; nothing can be billed until resumed',
    description: 'Open Till (272) EDIT, the session’s own cashier.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async suspend(
    @Body() dto: SuspendTillSessionDto,
  ): Promise<TillSuccessResponse<TillSessionPayload>> {
    await this.context.requireRight(TILL_MENU.OPEN_TILL, 'edit', 'suspend a till session');
    const data = await this.sessions.suspend(dto, dto.reasonId ?? null);
    return { success: true, message: `Session ${data.tssSessionNo} suspended`, data };
  }

  @Post('sessions/resume')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resume a suspended session',
    description: 'Open Till (272) EDIT, the session’s own cashier.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async resume(@Body() dto: TillSessionKeyDto): Promise<TillSuccessResponse<TillSessionPayload>> {
    await this.context.requireRight(TILL_MENU.OPEN_TILL, 'edit', 'resume a till session');
    const data = await this.sessions.resume(dto);
    return { success: true, message: `Session ${data.tssSessionNo} resumed`, data };
  }

  @Post('sessions/end-billing')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'End billing — the session stops taking money and waits to be counted',
    description:
      'Held bills go to the branch pool (till.close_with_holds RELEASE) or refuse the end (BLOCK → TILL_HOLDS_OPEN). ' +
      'Open Till (272) EDIT.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async endBilling(
    @Body() dto: EndBillingTillSessionDto,
  ): Promise<TillSuccessResponse<TillSessionPayload>> {
    await this.context.requireRight(TILL_MENU.OPEN_TILL, 'edit', 'end billing on a till session');
    const data = await this.sessions.endBilling(
      { companyId: dto.companyId, branchId: dto.branchId, accYear: dto.accYear, tssId: dto.tssId },
      { outboxCount: dto.outboxCount ?? null, lastClientSeq: dto.lastClientSeq ?? null },
    );
    return { success: true, message: `Session ${data.tssSessionNo} stopped billing`, data };
  }

  @Post('sessions/count')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'One count attempt — answers ACCEPTED / RECOUNT_REQUIRED / SENT_FOR_APPROVAL',
    description:
      'Every attempt is kept. In a hidden-expected count the cashier is never told the figure (variances = null). Out of tolerance ' +
      'after the last recount (till.max_recounts) the session goes PENDING_APPROVAL. Only the drawer decides: a card / UPI slip ' +
      'total out of tolerance never asks for a recount — the count is final with slipCheckRequired = true, the gap PENDING for ' +
      "the supervisor's slip check; the session still closes. Open Till (272) EDIT by the " +
      'cashier, or Till Sessions (273) OVERRIDE (cash office / supervisor).',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiResponse({ status: 428, type: TillErrorResponseDto, description: 'TILL_RECOUNT_LIMIT' })
  async count(
    @Body() dto: CountTillSessionDto,
  ): Promise<TillSuccessResponse<TillCountResultPayload>> {
    await this.requireAny(
      [
        [TILL_MENU.OPEN_TILL, 'edit'],
        [TILL_MENU.SESSIONS, 'override'],
      ],
      'count a till session',
    );
    const data = await this.sessions.count(dto, {
      lines: dto.lines,
      witnessBy: dto.witnessBy ?? null,
      notes: dto.notes ?? null,
    });
    return { success: true, message: `Count ${data.attemptNo}: ${data.outcome}`, data };
  }

  @Post('sessions/close')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Close — post the variances (TVar) and the hand-over (TDrp), freeze the totals, issue the Z number',
    description:
      'floatLeft stays in the drawer; the rest of the cash counted goes to the safe. A session PENDING_APPROVAL ' +
      'answers 428 TILL_APPROVAL_REQUIRED (the approval gate is build phase 3). Open Till (272) EDIT, or Till ' +
      'Sessions (273) OVERRIDE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiResponse({ status: 428, type: TillErrorResponseDto, description: 'TILL_APPROVAL_REQUIRED' })
  async close(@Body() dto: CloseTillSessionDto): Promise<TillSuccessResponse<TillSessionPayload>> {
    await this.requireAny(
      [
        [TILL_MENU.OPEN_TILL, 'edit'],
        [TILL_MENU.SESSIONS, 'override'],
      ],
      'close a till session',
    );
    const data = await this.sessions.close(dto, {
      floatLeft: dto.floatLeft ?? null,
      notes: dto.notes ?? null,
    });
    return {
      success: true,
      message: `Session ${data.tssSessionNo} closed — Z ${data.tssZNo}`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Movements (build phase 2)
  // ═════════════════════════════════════════════════════════════════════════

  @Post('movements/create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'A drawer movement — drop, paid-in, exchange (cashier) · pickup, top-up (supervisor)',
    description:
      'Each posts its voucher in the session: DROP / PICKUP a TDrp (Dr safe / Cr till cash), TOP_UP a TFlt, ' +
      'PAID_IN a TPIn (Dr till cash / Cr the ledger); an EXCHANGE posts none and counts both sides. The ' +
      'session must still take money (OPEN / SUSPENDED). Cashier kinds: Open Till (272) EDIT, the session’s ' +
      'cashier on its device. PICKUP / TOP_UP: Till Sessions (273) OVERRIDE; a pickup’s witness is the cashier.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  @ApiUnprocessableEntityResponse({
    type: TillErrorResponseDto,
    description: 'TILL_MOVEMENT_INVALID · TILL_REASON_INVALID · TILL_SAFE_MISSING',
  })
  async createMovement(
    @Body() dto: CreateTillMovementDto,
  ): Promise<TillSuccessResponse<TillMovementDetailPayload>> {
    const kind = dto.kind as TillMovementKind;
    if (SUPERVISOR_MOVEMENTS.includes(kind)) {
      await this.context.requireRight(
        TILL_MENU.SESSIONS,
        'override',
        `take a till ${kind.toLowerCase()}`,
      );
    } else {
      await this.context.requireRight(
        TILL_MENU.OPEN_TILL,
        'edit',
        `post a till ${kind.toLowerCase()}`,
      );
    }
    const data = await this.movements.create({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      tssId: dto.tssId,
      kind,
      amount: dto.amount ?? null,
      lines: dto.lines,
      outLines: dto.outLines,
      reasonId: dto.reasonId ?? null,
      ledgerId: dto.ledgerId ?? null,
      refNo: dto.refNo ?? null,
      refDate: dto.refDate ?? null,
      partyName: dto.partyName ?? null,
      bagNo: dto.bagNo ?? null,
      sealNo: dto.sealNo ?? null,
      witnessBy: dto.witnessBy ?? null,
      notes: dto.notes ?? null,
    });
    return { success: true, message: `${data.tcmKind} ${data.tcmDocNo} posted`, data };
  }

  @Post('movements/change')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Change from another counter — a PICKUP there and a TOP_UP here, in one call',
    description:
      'REV 2 §2.14: no till-to-till movement; the pair passes each counter’s safe (TDrp on the giving session, ' +
      'TFlt on the receiving one). Both sessions OPEN / SUSPENDED. Till Sessions (273) OVERRIDE; the giving cashier ' +
      'witnesses and is never the supervisor.',
  })
  @ApiCreatedResponse({ type: TillSuccessDto })
  async change(
    @Body() dto: TillChangeDto,
  ): Promise<
    TillSuccessResponse<{ from: TillMovementDetailPayload; to: TillMovementDetailPayload }>
  > {
    await this.context.requireRight(
      TILL_MENU.SESSIONS,
      'override',
      'carry change between counters',
    );
    const data = await this.movements.change({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      fromTssId: dto.fromTssId,
      toTssId: dto.toTssId,
      lines: dto.lines,
      reasonId: dto.reasonId,
      notes: dto.notes ?? null,
    });
    return {
      success: true,
      message: `${data.from.tcmDocNo} → ${data.to.tcmDocNo}: ${data.from.tcmAmount} carried`,
      data,
    };
  }

  @Get('movements/get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One movement with its denomination counts — the slip',
    description: 'Your own session’s: Open Till (272) VIEW; another’s: Till Sessions (273) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  async getMovement(
    @Query() query: TillMovementKeyDto,
  ): Promise<TillSuccessResponse<TillMovementDetailPayload>> {
    const caller = await this.context.caller();
    const operator = await this.movements.operatorOf(query);
    if (operator && operator === caller.userId) {
      await this.context.requireRight(TILL_MENU.OPEN_TILL, 'view', 'view your till movements');
    } else {
      await this.context.requireRight(TILL_MENU.SESSIONS, 'view', 'view till movements');
    }
    const data = await this.movements.get(query);
    return { success: true, message: `${data.tcmKind} ${data.tcmDocNo}`, data };
  }

  @Post('movements/void')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Void a movement — its voucher mirrored (Rev), the row VOIDED with a MOVEMENT_VOID reason',
    description:
      'Only a hand-posted movement, and only while its session still takes money. Till Sessions (273) OVERRIDE ' +
      '(MOVEMENT_VOID is ALWAYS a supervisor’s).',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiConflictResponse({
    type: TillErrorResponseDto,
    description: 'TILL_MOVEMENT_NOT_VOIDABLE · TILL_SESSION_NOT_OPEN',
  })
  async voidMovement(
    @Body() dto: VoidTillMovementDto,
  ): Promise<TillSuccessResponse<TillMovementDetailPayload>> {
    await this.context.requireRight(TILL_MENU.SESSIONS, 'override', 'void a till movement');
    const data = await this.movements.void({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      tcmId: dto.tcmId,
      reasonId: dto.reasonId,
      notes: dto.notes ?? null,
    });
    return { success: true, message: `${data.tcmKind} ${data.tcmDocNo} voided`, data };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The till journal
  // ═════════════════════════════════════════════════════════════════════════

  @Post('events/batch')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'A device reports what only it saw — drawer kicks, no-sales, X reads, idle locks',
    description:
      'Device time is kept as the event time. (device, clientSeq) makes a re-sent batch a no-op. A device may not ' +
      'report a server event (SESSION_CLOSE …). Open Till (272) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  async batch(@Body() dto: TillEventBatchDto): Promise<TillSuccessResponse<TillEventBatchPayload>> {
    await this.context.requireRight(TILL_MENU.OPEN_TILL, 'view', 'report till events');
    const caller = await this.context.caller();
    if (!caller.deviceId) {
      throwTill(
        TillErrorCode.DEVICE_REQUIRED,
        'Till events come from a registered device',
        'deviceId',
      );
    }
    const data = await this.events.ingestBatch({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      deviceId: caller.deviceId,
      userId: caller.userId,
      events: dto.events.map((e) => ({
        code: e.code,
        eventOn: new Date(e.eventOn),
        clientSeq: BigInt(e.clientSeq),
        sessionId: e.sessionId ?? null,
        srcDocType: e.srcDocType ?? null,
        srcDocId: e.srcDocId ?? null,
        srcRefno: e.srcRefno ?? null,
        amount: e.amount === null || e.amount === undefined ? null : new Prisma.Decimal(e.amount),
        reasonId: e.reasonId ?? null,
        payload: (e.payload ?? null) as Prisma.InputJsonValue | null,
      })),
    });
    return {
      success: true,
      message: `${data.accepted} event(s) stored, ${data.duplicates} already had`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════

  /** The first right the caller holds, else the 403 of the first. */
  private async requireAny(
    options: [number, 'view' | 'edit' | 'override' | 'create'][],
    action: string,
  ): Promise<void> {
    for (const [menuId, right] of options) {
      const rights = await this.context.rights(menuId);
      if (rights[right]) {
        return;
      }
    }
    const [menuId, right] = options[0];
    await this.context.requireRight(menuId, right, action);
  }

  /** Own session: 272 VIEW. Anyone else's: 273 VIEW. Returns whether the caller is its cashier. */
  private async requireSessionView(key: TillSessionKeyDto): Promise<boolean> {
    const caller = await this.context.caller();
    const owner = await this.operatorOf(key);
    if (owner.tssOperatorId === caller.userId) {
      await this.context.requireRight(TILL_MENU.OPEN_TILL, 'view', 'view your till session');
      return true;
    }
    await this.context.requireRight(
      TILL_MENU.SESSIONS,
      'view',
      'view another cashier’s till session',
    );
    return false;
  }

  /** 273 OVERRIDE, and never the session's own cashier before it closes (the blind rule). */
  private async assertApprover(key: TillSessionKeyDto, action: string): Promise<void> {
    await this.context.requireRight(TILL_MENU.SESSIONS, 'override', action);
    const caller = await this.context.caller();
    const owner = await this.operatorOf(key);
    if (owner.tssOperatorId === caller.userId && owner.tssStatus !== 'CLOSED') {
      throwTill(
        TillErrorCode.BLIND_CLOSE,
        'The cashier of a session does not see its expected figures before it closes',
        'tssId',
      );
    }
  }

  private async operatorOf(
    key: TillSessionKeyDto,
  ): Promise<{ tssOperatorId: string; tssStatus: string }> {
    const row = await this.prisma.tillSession.findFirst({
      where: {
        tssId: key.tssId,
        tssAccYear: key.accYear,
        tssCompanyId: key.companyId,
        tssBranchId: key.branchId,
        tssIsDeleted: false,
      },
      select: { tssOperatorId: true, tssStatus: true },
    });
    if (!row) {
      throwTill(
        TillErrorCode.SESSION_NOT_FOUND,
        `Till session ${key.tssId} was not found`,
        'tssId',
      );
    }
    return row;
  }
}
