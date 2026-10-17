import { Body, Controller, Get, HttpCode, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { TillContextService } from './till-context.service';
import { TillExceptionFilter } from './till-exception.filter';
import { TillSafeService } from './services/till-safe.service';
import {
  ConfirmTillRemitDto,
  CountTillSafeDto,
  DecideTillSafeVarianceDto,
  RemitTillCashDto,
  TillSafeBalanceQueryDto,
} from './dto/till-safe.dto';
import { TillErrorResponseDto, TillSuccessDto } from './dto/till-response.dto';
import { TILL_MENU, TillSafeGapOutcome } from './types/till-enum';
import type {
  TillRemitConfirmPayload,
  TillRemitPayload,
  TillSafeBalancePayload,
  TillSafeCountPayload,
  TillSafeDecisionPayload,
  TillSuccessResponse,
} from './types/till-api.types';

/**
 * Notes 118 — the safe (TILL_DESIGN §13 phase 5): its balance, its count, and
 * remittance to the bank, on the Cash Office screen (menu 287 — a new id; the
 * notes-113 Cash Office 286 stays retired). No SUPER ADMIN bypass.
 *
 *   Cash Office (287)    VIEW the balance (Till Sessions 273 VIEW also opens it) ·
 *                        CREATE count / remit / confirm · OVERRIDE decide a safe gap
 *
 * A REMIT is voided on movements/void (TillController), judged on 287 OVERRIDE.
 */
@ApiTags('Till')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: TillErrorResponseDto })
@Controller('till')
@UseFilters(TillExceptionFilter)
export class TillSafeController {
  constructor(
    private readonly context: TillContextService,
    private readonly safes: TillSafeService,
  ) {}

  @Get('safes/balance')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The safes of a branch: what each should hold, and how it got there (notes 118 §1)',
    description:
      'Per safe: opening (the last SAFE count; before any, the safe expects what its ledger holds), in (hand-overs ' +
      'and drops straight in or once received, pickups, transfers in, back-office cash receipts on its ledger), out ' +
      '(float issues, top-ups, remittances, transfers out, back-office cash payments / expenses), exchanges (counted, ' +
      'net zero), expected, the ledger’s own balance and the drift between the two, the insured limit, the last count ' +
      '(when, by whom, the difference), the remittances in transit and the gaps still pending. Under till.blind_close ' +
      'the figures are null (`figuresVisible` false) unless the caller holds Cash Office (287) or Till Sessions (273) ' +
      'OVERRIDE: the count is blind. Plus the branch’s CIT remittances not yet confirmed, oldest first. Cash Office ' +
      '(287) VIEW, or Till Sessions (273) VIEW.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  async balance(
    @Query() query: TillSafeBalanceQueryDto,
  ): Promise<TillSuccessResponse<TillSafeBalancePayload>> {
    await this.requireAny(
      [
        [TILL_MENU.CASH_OFFICE, 'view'],
        [TILL_MENU.SESSIONS, 'view'],
      ],
      'see the safe',
    );
    const data = await this.safes.balance(query);
    return {
      success: true,
      message: `${data.safes.length} safe(s), ${data.inTransit.length} remittance(s) in transit`,
      data,
    };
  }

  @Post('safes/count')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Count the safe — blind; the answer shows what it should have held (notes 118 §2)',
    description:
      'A SAFE till_count of today’s business day (more than one a day: the last is the day’s), `tct_expected` what ' +
      'the safe should hold, SAFE_COUNT journalled; tbd_safe_counted / _expected kept current, SAFE_NOT_COUNTED ' +
      'cleared. The difference is a till_variance of stage SAFE (no session): EXACT · within till.cash_tolerance ' +
      'posted at once (TVar WITHIN_TOLERANCE, Cash Short & Excess against the safe) · beyond it decided here with ' +
      '`treatment` + `reasonId` + `approverPin` under SAFE_VARIANCE (the caller’s grant must cover it — 403 ' +
      'TILL_APPROVER_NO_GRANT / _LIMIT / _PIN otherwise, nothing written; a two-person rule takes the witness as ' +
      'its second signature, none → 403 TILL_APPROVER_SECOND) · else SENT_FOR_APPROVAL for safes/decide-variance. ' +
      'A day CLOSED → 409 TILL_DAY_CLOSED. Cash Office (287) CREATE; `treatment` needs OVERRIDE too.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  @ApiForbiddenResponse({
    type: TillErrorResponseDto,
    description:
      'TILL_RIGHT_CREATE · TILL_RIGHT_OVERRIDE · TILL_WITNESS_PIN_REQUIRED · TILL_WITNESS_PIN · TILL_APPROVER_NO_GRANT · ' +
      'TILL_APPROVER_LIMIT · TILL_APPROVER_PIN · TILL_APPROVER_SECOND',
  })
  @ApiConflictResponse({
    type: TillErrorResponseDto,
    description:
      'TILL_DAY_CLOSED · TILL_DAY_NOT_OPEN · TILL_SAFE_CHANGED (the safe moved while it was judged)',
  })
  @ApiUnprocessableEntityResponse({
    type: TillErrorResponseDto,
    description:
      'TILL_COUNT_INVALID · TILL_SAFE_MISSING (inactive) · TILL_WITNESS_NO_PIN · TILL_REASON_INVALID · TILL_LEDGER_UNMAPPED',
  })
  async count(@Body() dto: CountTillSafeDto): Promise<TillSuccessResponse<TillSafeCountPayload>> {
    await this.context.requireRight(TILL_MENU.CASH_OFFICE, 'create', 'count the safe');
    if (dto.treatment) {
      await this.context.requireRight(TILL_MENU.CASH_OFFICE, 'override', 'decide a safe gap');
    }
    const data = await this.safes.count({
      companyId: dto.companyId,
      branchId: dto.branchId,
      tenantId: dto.tenantId ?? null,
      safeId: dto.safeId,
      lines: dto.lines,
      notes: dto.notes ?? null,
      witnessId: dto.witnessId ?? null,
      witnessPin: dto.witnessPin ?? null,
      treatment: dto.treatment ?? null,
      reasonId: dto.reasonId ?? null,
      approverPin: dto.approverPin ?? null,
    });
    return {
      success: true,
      message:
        data.outcome === TillSafeGapOutcome.EXACT
          ? `${data.safeName}: ${data.counted.toFixed(2)} counted, exactly as expected`
          : `${data.safeName}: ${data.counted.toFixed(2)} counted against ${data.expected.toFixed(2)} (${data.outcome})`,
      data,
    };
  }

  @Post('safes/decide-variance')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Decide a pending safe gap — a safe count’s or a short bank credit’s (notes 118 §2)',
    description:
      'A till_variance of stage SAFE / REMIT still PENDING (else 409 TILL_VARIANCE_NOT_PENDING): SAFE_VARIANCE with ' +
      'the caller the approver (grant + PIN by the rule’s channel), the no-self flag not binding; a two-person rule ' +
      'wants `secondId` + `secondPin` (not the caller, not whoever raised the gap). EXPENSE or SUSPENSE, a VARIANCE ' +
      'reason; the TVar posts dated today’s business day; a till_approval row; VARIANCE_DECIDED. Cash Office (287) ' +
      'OVERRIDE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  @ApiConflictResponse({ type: TillErrorResponseDto, description: 'TILL_VARIANCE_NOT_PENDING' })
  async decideVariance(
    @Body() dto: DecideTillSafeVarianceDto,
  ): Promise<TillSuccessResponse<TillSafeDecisionPayload>> {
    await this.context.requireRight(TILL_MENU.CASH_OFFICE, 'override', 'decide a safe gap');
    const data = await this.safes.decideVariance({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      tvrId: dto.tvrId,
      treatment: dto.treatment,
      reasonId: dto.reasonId,
      notes: dto.notes ?? null,
      approverPin: dto.approverPin ?? null,
      secondId: dto.secondId ?? null,
      secondPin: dto.secondPin ?? null,
    });
    return {
      success: true,
      message: `Safe gap ${data.variance.toFixed(2)} decided: ${data.treatment}`,
      data,
    };
  }

  @Post('movements/remit')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remit cash from the safe to the bank (notes 118 §3)',
    description:
      'A REMIT movement with no session, dated today’s business day, numbered by its CRem: BANK_DEPOSIT (staff) Dr ' +
      'Bank / Cr Safe, DEPOSITED · CIT (an agency) Dr Cash in transit / Cr Safe, IN_TRANSIT until remit-confirm. ' +
      'Above what the safe should hold → 422 TILL_REMIT_OVER_BALANCE. `lines` (optional) are the notes sent and must ' +
      'make `amount`. The REMITTANCE rule as set (shipped NEVER: nothing asked); when it asks, `approverId` (left out ' +
      '= the caller) types `approverPin` here. tbd_remitted kept current — and SAFE_OVER_INSURED reads the safe ' +
      'ledger, which the CRem lowers. Cash Office (287) CREATE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiNotFoundResponse({ type: TillErrorResponseDto })
  @ApiConflictResponse({
    type: TillErrorResponseDto,
    description: 'TILL_DAY_CLOSED · TILL_DAY_NOT_OPEN',
  })
  @ApiUnprocessableEntityResponse({
    type: TillErrorResponseDto,
    description:
      'TILL_REMIT_OVER_BALANCE · TILL_MOVEMENT_INVALID (bankLedgerId, mode, amount) · TILL_COUNT_INVALID · ' +
      'TILL_LEDGER_UNMAPPED (CASH_IN_TRANSIT) · TILL_SAFE_MISSING',
  })
  async remit(@Body() dto: RemitTillCashDto): Promise<TillSuccessResponse<TillRemitPayload>> {
    await this.context.requireRight(TILL_MENU.CASH_OFFICE, 'create', 'remit cash from the safe');
    const data = await this.safes.remit({
      companyId: dto.companyId,
      branchId: dto.branchId,
      tenantId: dto.tenantId ?? null,
      safeId: dto.safeId,
      amount: dto.amount,
      bankLedgerId: dto.bankLedgerId,
      mode: dto.mode,
      bagNo: dto.bagNo ?? null,
      sealNo: dto.sealNo ?? null,
      citAgency: dto.citAgency ?? null,
      slipNo: dto.slipNo ?? null,
      slipDate: dto.slipDate ?? null,
      lines: dto.lines ?? null,
      notes: dto.notes ?? null,
      approverId: dto.approverId ?? null,
      approverPin: dto.approverPin ?? null,
    });
    return {
      success: true,
      message: `REMIT ${data.movement.tcmDocNo}: ${data.movement.tcmAmount.toFixed(2)} ${data.movement.tcmRemitStatus}`,
      data,
    };
  }

  @Post('movements/remit-confirm')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm a CIT remittance against the bank statement (notes 118 §3)',
    description:
      'On a CIT REMIT IN_TRANSIT (else 409 TILL_REMIT_NOT_IN_TRANSIT): the Contra (CRem) Dr Bank / Cr Cash in transit ' +
      'for `bankAmount` (left out = what was sent; none for 0), dated `bankDate`, the row CONFIRMED, REMIT_CONFIRMED ' +
      'journalled. A difference is a REMIT-stage gap against Cash in transit, judged as a safe count’s (within ' +
      'tolerance posted; beyond it decided here with `treatment` — Cash Office (287) OVERRIDE — else PENDING). Cash ' +
      'Office (287) CREATE.',
  })
  @ApiOkResponse({ type: TillSuccessDto })
  @ApiConflictResponse({ type: TillErrorResponseDto, description: 'TILL_REMIT_NOT_IN_TRANSIT' })
  @ApiUnprocessableEntityResponse({
    type: TillErrorResponseDto,
    description:
      'TILL_MOVEMENT_INVALID (bankDate, not a REMIT) · TILL_REASON_INVALID · TILL_LEDGER_UNMAPPED',
  })
  async confirmRemit(
    @Body() dto: ConfirmTillRemitDto,
  ): Promise<TillSuccessResponse<TillRemitConfirmPayload>> {
    await this.context.requireRight(TILL_MENU.CASH_OFFICE, 'create', 'confirm a remittance');
    if (dto.treatment) {
      await this.context.requireRight(TILL_MENU.CASH_OFFICE, 'override', 'decide a safe gap');
    }
    const data = await this.safes.confirmRemit({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      tcmId: dto.tcmId,
      bankDate: dto.bankDate,
      bankRef: dto.bankRef,
      bankAmount: dto.bankAmount ?? null,
      treatment: dto.treatment ?? null,
      reasonId: dto.reasonId ?? null,
      notes: dto.notes ?? null,
      approverPin: dto.approverPin ?? null,
      witnessId: dto.witnessId ?? null,
      witnessPin: dto.witnessPin ?? null,
    });
    return {
      success: true,
      message: `REMIT ${data.docNo} confirmed: ${data.credited.toFixed(2)} credited of ${data.sent.toFixed(2)}`,
      data,
    };
  }

  /** The first right the caller holds, else the 403 of the first. */
  private async requireAny(
    options: [number, 'view' | 'create' | 'override'][],
    action: string,
  ): Promise<void> {
    for (const [menuId, right] of options) {
      if ((await this.context.rights(menuId))[right]) {
        return;
      }
    }
    const [menuId, right] = options[0];
    await this.context.requireRight(menuId, right, action);
  }
}
