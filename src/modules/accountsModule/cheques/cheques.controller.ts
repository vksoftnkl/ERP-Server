import { Body, Controller, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ChequesExceptionFilter } from './cheques-exception.filter';
import { ChequesService } from './cheques.service';
import { ChequeDepositService } from './cheque-deposit.service';
import { ChequeClearService } from './cheque-clear.service';
import { ChequeBounceService } from './cheque-bounce.service';
import { ChequeReissueService } from './cheque-reissue.service';
import { ChequeReturnService } from './cheque-return.service';
import { PdcStatus } from '../receipt/types/receipt-enum';
import {
  ChequeHistoryQueryDto,
  DepositSlipQueryDto,
  GetChequeQueryDto,
  ListChequesQueryDto,
} from './dto/cheque-query.dto';
import { DepositChequesDto } from './dto/deposit-cheques.dto';
import {
  BounceChequeDto,
  ClearChequeDto,
  ReplaceChequeDto,
  RepresentChequeDto,
  ReturnChequeDto,
} from './dto/cheque-actions.dto';
import {
  ChequeBounceSuccessDto,
  ChequeClearSuccessDto,
  ChequeDepositSuccessDto,
  ChequeDetailSuccessDto,
  ChequeErrorResponseDto,
  ChequeHistorySuccessDto,
  ChequeListSuccessDto,
  ChequeReplaceSuccessDto,
  ChequeRepresentSuccessDto,
  ChequeReturnSuccessDto,
  DepositSlipSuccessDto,
} from './dto/cheque-response.dto';
import type {
  ChequeBouncePayload,
  ChequeClearPayload,
  ChequeDepositPayload,
  ChequeDetailPayload,
  ChequeHistoryPayload,
  ChequeListPayload,
  ChequeReplacePayload,
  ChequeRepresentPayload,
  ChequeReturnPayload,
  ChequeSuccessResponse,
  DepositSlipPayload,
} from './types/cheque-api.types';

/**
 * Received cheques — menu 51.
 *
 * ── The whole module in one line ─────────────────────────────────────────
 * Move a received cheque through HELD → DEPOSITED → CLEARED | BOUNCED →
 * re-presented | REPLACED, or HELD → RETURNED | CANCELLED, writing one
 * register update, one status-log row and — when money moves — one voucher per
 * step, never editing a row.
 *
 * ── The four keys ────────────────────────────────────────────────────────
 * Every route that acts on an existing cheque takes
 * `apdId · apdAccYear · apdCompanyId · apdBranchId`. The year is part of the
 * primary key (the table is partitioned on it); the company and the branch are
 * what stop a bare uuid from reaching another company's cheque. A mismatch is
 * a 404, not a 403.
 *
 * ── What is deliberately not on this surface (§10) ───────────────────────
 *   · no `PUT /cheques/update` — a register row's cheque facts are never
 *     edited. Return it and re-key, or replace it;
 *   · no `DELETE` — CANCELLED is the deletion, and it keeps the history;
 *   · no route that clears a bounced cheque straight to the party — re-issue
 *     first (C5), which is what keeps `/clear` with one shape.
 */
@ApiTags('Received Cheques')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('cheques')
@UseFilters(ChequesExceptionFilter)
export class ChequesController {
  constructor(
    private readonly chequesService: ChequesService,
    private readonly depositService: ChequeDepositService,
    private readonly clearService: ChequeClearService,
    private readonly bounceService: ChequeBounceService,
    private readonly reissueService: ChequeReissueService,
    private readonly returnService: ChequeReturnService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.1 — the reads
  // ═════════════════════════════════════════════════════════════════════════

  @Get('list')
  @Version(API_VERSION)
  // §6.4 — no cache. The due buckets change at midnight, and a list cached for
  // ten minutes says FUTURE about a cheque that matured this morning.
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The register, with the summary strip',
    description:
      'The rows AND the aggregate. The grid `MAIN LIST - RECEIVED CHEQUES` serves TxnMainView ' +
      'through /configured-grid-sql — this route exists for the summary strip, which is an ' +
      'aggregate over the whole register and not over the page the grid returned.\n\n' +
      'The due bucket (FUTURE / DUE_TODAY / OVERDUE / STALE) is computed from the instrument ' +
      'date and today, never stored.',
  })
  @ApiOkResponse({ type: ChequeListSuccessDto })
  @ApiBadRequestResponse({ type: ChequeErrorResponseDto })
  async list(
    @Query() query: ListChequesQueryDto,
  ): Promise<ChequeSuccessResponse<ChequeListPayload>> {
    const data = await this.chequesService.list(query);

    return { success: true, message: `${data.total} cheque(s)`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One cheque, and everything hanging off it',
    description:
      'The row, the ledger it was posted to, the four vouchers (receipt, clearing, bounce, ' +
      're-issue), every bill its adjustment rows name with what that bill owes NOW, the ' +
      'bounce-charge bill, and both ends of the replacement chain. One snapshot.',
  })
  @ApiOkResponse({ type: ChequeDetailSuccessDto })
  @ApiNotFoundResponse({ type: ChequeErrorResponseDto })
  async get(
    @Query() query: GetChequeQueryDto,
  ): Promise<ChequeSuccessResponse<ChequeDetailPayload>> {
    const data = await this.chequesService.get(query);

    return {
      success: true,
      message: `Cheque ${data.cheque.apdInstrumentNo} fetched successfully`,
      data,
    };
  }

  @Get('history')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Every transition, with who and when',
    description:
      "The cheque's own public.txn_status_log rows, newest first. Append-only: correcting " +
      'history means appending another row, which is why a cheque that was bounced and then ' +
      're-presented shows both.',
  })
  @ApiOkResponse({ type: ChequeHistorySuccessDto })
  @ApiNotFoundResponse({ type: ChequeErrorResponseDto })
  async history(
    @Query() query: ChequeHistoryQueryDto,
  ): Promise<ChequeSuccessResponse<ChequeHistoryPayload>> {
    const data = await this.chequesService.history(query);

    return { success: true, message: `${data.entries.length} status step(s)`, data };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.2 — deposit
  // ═════════════════════════════════════════════════════════════════════════

  @Post('deposit')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Send a bundle of cheques to the bank',
    description:
      'A BATCH, because a deposit slip is a batch: one bank, one date, one slip number, many ' +
      'cheques. All or nothing.\n\n' +
      '**No voucher is posted.** Handing paper over a counter moves no money — the bank has not ' +
      'paid us, it has taken custody. Crediting the bank here would leave every reconciliation ' +
      'afterwards with a permanent difference of whatever was in transit that night.\n\n' +
      "Every row must be HELD, and the deposit date must be on or after each cheque's own " +
      'instrument date. A BOUNCED row is refused with a pointer to /cheques/re-present.',
  })
  @ApiOkResponse({ type: ChequeDepositSuccessDto })
  @ApiBadRequestResponse({ type: ChequeErrorResponseDto })
  @ApiConflictResponse({ type: ChequeErrorResponseDto })
  async deposit(
    @Body() dto: DepositChequesDto,
  ): Promise<ChequeSuccessResponse<ChequeDepositPayload>> {
    const data = await this.depositService.deposit(dto);

    return {
      success: true,
      message: `${data.slip.chequeCount} cheque(s) deposited on slip ${data.slip.slipNo}`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.3 — clear
  // ═════════════════════════════════════════════════════════════════════════

  @Post('clear')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The bank paid',
    description:
      '**ON_RECEIPT** — a ChqClr CONTRA: DR the bank, CR Cheques in Hand. Two legs, no party, no ' +
      'bills: the party was credited and the bills settled when the receipt was keyed, and ' +
      'touching them again would credit one payment twice. `av_recon_date` on the bank leg ' +
      'carries `bankDate`.\n\n' +
      '**ON_CLEARING** — an Rct: DR the bank, CR the party, with allocations through the ' +
      "receipt's own engine. Under this mode nothing was posted when the cheque arrived, so the " +
      'clearing IS the receipt.\n\n' +
      'The mode is read off the ROW (`apd_posting_mode`), never off the setting.\n\n' +
      'A second clearing is refused by `ux_avh_src` as "already cleared".',
  })
  @ApiOkResponse({ type: ChequeClearSuccessDto })
  @ApiBadRequestResponse({ type: ChequeErrorResponseDto })
  @ApiConflictResponse({ type: ChequeErrorResponseDto })
  async clear(@Body() dto: ClearChequeDto): Promise<ChequeSuccessResponse<ChequeClearPayload>> {
    const data = await this.clearService.clear(dto);

    return { success: true, message: `Cheque ${data.cheque.apdInstrumentNo} cleared`, data };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.4 — bounce
  // ═════════════════════════════════════════════════════════════════════════

  @Post('bounce')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The bank sent it back',
    description:
      'Nine ordered steps in one transaction. Under ON_RECEIPT, five legs — DR party (amount + ' +
      'party charge), CR Cheques in Hand, CR BOUNCE_CHARGES_RECOVERED, DR BANK_CHARGES, CR the ' +
      'bank — then a negative adjustment row for everything this cheque settled, the C4 cascade ' +
      'over any advance it funded, and a JOURNAL bill for what the party now owes.\n\n' +
      'Under ON_CLEARING only the charge legs, because nothing was posted when it arrived.\n\n' +
      'A bounce is **never refused because an advance was spent** (§10): the bank has returned ' +
      'the cheque and that has to be recordable. The cascade unwinds the applications instead.\n\n' +
      'A charge with no role mapped is refused BY ROLE NAME before anything is written.',
  })
  @ApiOkResponse({ type: ChequeBounceSuccessDto })
  @ApiBadRequestResponse({ type: ChequeErrorResponseDto })
  @ApiConflictResponse({ type: ChequeErrorResponseDto })
  @ApiNotFoundResponse({ type: ChequeErrorResponseDto })
  async bounce(@Body() dto: BounceChequeDto): Promise<ChequeSuccessResponse<ChequeBouncePayload>> {
    const data = await this.bounceService.bounce(dto);

    return {
      success: true,
      message: `Cheque ${data.cheque.apdInstrumentNo} bounced — ${data.cheque.apdBounceReason}`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.5 — re-present
  // ═════════════════════════════════════════════════════════════════════════

  @Post('re-present')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Send the same bounced cheque back to the bank',
    description:
      'Not "undo the bounce" (C5). The bounce debited the party and relieved Cheques in Hand, ' +
      'and between the bounce and now the party genuinely was in debt. So this is a fresh act ' +
      'of taking a cheque in: an Rct re-issue voucher (DR Cheques in Hand / CR the party) ' +
      'against the bounce voucher, fresh allocations, then the deposit with ' +
      '`apd_present_count` going to 2.\n\n' +
      'The bounce columns are LEFT ALONE — that it bounced on the 14th stays true.\n\n' +
      "The bounce-charge bill is in the party's open items and may be allocated to.",
  })
  @ApiOkResponse({ type: ChequeRepresentSuccessDto })
  @ApiBadRequestResponse({ type: ChequeErrorResponseDto })
  @ApiConflictResponse({ type: ChequeErrorResponseDto })
  async represent(
    @Body() dto: RepresentChequeDto,
  ): Promise<ChequeSuccessResponse<ChequeRepresentPayload>> {
    const data = await this.reissueService.represent(dto);

    return {
      success: true,
      message:
        `Cheque ${data.cheque.apdInstrumentNo} re-presented ` +
        `(presentation ${data.cheque.apdPresentCount})`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.6 — replace
  // ═════════════════════════════════════════════════════════════════════════

  @Post('replace')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The party handed over different paper',
    description:
      'A NEW register row, HELD, and the old one marked REPLACED pointing at it — never an edit ' +
      'of the old row (§10).\n\n' +
      'From BOUNCED the bounce has already taken it off the books. From HELD the old cheque is ' +
      'RETURNED first, with no charges, because nothing was dishonoured — the party simply ' +
      'swapped the paper.\n\n' +
      'The new amount need not equal the old one. A post-dated replacement gets its own voucher ' +
      'dated the cheque, and its adjustment rows carry `abj_is_post_dated` so the bills stay ' +
      'open until it matures.',
  })
  @ApiOkResponse({ type: ChequeReplaceSuccessDto })
  @ApiBadRequestResponse({ type: ChequeErrorResponseDto })
  @ApiConflictResponse({ type: ChequeErrorResponseDto })
  async replace(
    @Body() dto: ReplaceChequeDto,
  ): Promise<ChequeSuccessResponse<ChequeReplacePayload>> {
    const data = await this.reissueService.replace(dto);

    return {
      success: true,
      message: `Cheque ${data.oldCheque.apdInstrumentNo} replaced by ${data.newCheque.apdInstrumentNo}`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.7 — return
  // ═════════════════════════════════════════════════════════════════════════

  @Post('return')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Give the paper back, or void it',
    description:
      "**HELD only.** Once a cheque has gone to the bank, the bank's record and ours have to " +
      'agree: a cheque this system says was handed back cannot also be on a slip the bank is ' +
      'holding. A DEPOSITED cheque waits for the bank to say cleared or bounced.\n\n' +
      'RETURNED — the party has the paper. CANCELLED — it is void, and `ux_apd_instrument` ' +
      'excludes CANCELLED so the same cheque number can be keyed again.\n\n' +
      'Under ON_RECEIPT this posts the reversal (DR party / CR Cheques in Hand), reopens the ' +
      'bills and runs the C4 cascade. Under ON_CLEARING the register moves alone.',
  })
  @ApiOkResponse({ type: ChequeReturnSuccessDto })
  @ApiBadRequestResponse({ type: ChequeErrorResponseDto })
  @ApiConflictResponse({ type: ChequeErrorResponseDto })
  async return(@Body() dto: ReturnChequeDto): Promise<ChequeSuccessResponse<ChequeReturnPayload>> {
    const data = await this.returnService.return(dto);

    return {
      success: true,
      message:
        `Cheque ${data.cheque.apdInstrumentNo} ` +
        (dto.action === PdcStatus.CANCELLED ? 'cancelled' : 'returned to the party'),
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.8 — the deposit slip
  // ═════════════════════════════════════════════════════════════════════════

  @Get('deposit-slip')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The dataset behind the printed slip',
    description:
      "Keyed by (company, bank ledger, deposit date, slip no): the bank's own account from " +
      'accounts.acc_ledger_bank_accounts, then one line per cheque deposited under that slip.\n\n' +
      'The print purpose CHEQUE_DEPOSIT_SLIP is seeded; until a template version carries the ' +
      'dataset, this route is what prints it.',
  })
  @ApiOkResponse({ type: DepositSlipSuccessDto })
  @ApiNotFoundResponse({ type: ChequeErrorResponseDto })
  async depositSlip(
    @Query() query: DepositSlipQueryDto,
  ): Promise<ChequeSuccessResponse<DepositSlipPayload>> {
    const data = await this.chequesService.depositSlip(query);

    return {
      success: true,
      message: `Slip ${data.slipNo}: ${data.chequeCount} cheque(s)`,
      data,
    };
  }
}
