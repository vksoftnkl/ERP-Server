import { Body, Controller, Get, HttpCode, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { VouchersExceptionFilter } from './vouchers-exception.filter';
import { VoucherTypesService } from './voucher-types.service';
import { VoucherLookupsService } from './voucher-lookups.service';
import { VoucherRegisterService } from './voucher-register.service';
import { VoucherCancelService } from './voucher-cancel.service';
import {
  LedgerBalanceQueryDto,
  LedgerPickQueryDto,
  OpenBillsQueryDto,
  PartyFactsQueryDto,
  TaxRatesQueryDto,
  VoucherTypesQueryDto,
} from './dto/voucher-query.dto';
import {
  CancelVoucherDto,
  DeleteVoucherDto,
  GetVoucherQueryDto,
  PostVoucherDto,
  ValidateVoucherDto,
  VoucherPayloadDto,
} from './dto/voucher-payload.dto';
import {
  CancelSuccessDto,
  DeleteSuccessDto,
  DraftSavedSuccessDto,
  LedgerBalanceSuccessDto,
  LedgerPickSuccessDto,
  OpenBillsSuccessDto,
  PartyFactsSuccessDto,
  TaxRatesSuccessDto,
  ValidateSuccessDto,
  VoucherErrorResponseDto,
  VoucherSuccessDto,
  VoucherTypesSuccessDto,
} from './dto/voucher-response.dto';
import type {
  CancelPayload,
  DeletePayload,
  DraftSavedPayload,
  LedgerBalancePayload,
  LedgerPickPayload,
  OpenBillsPayload,
  PartyFactsPayload,
  TaxRatesPayload,
  ValidatePayload,
  VoucherPayload,
  VoucherSuccessResponse,
  VoucherTypesPayload,
} from './types/vouchers-api.types';

/**
 * The Voucher Register (voucher_register.md §6): one register screen for
 * every accountant voucher — Journal, Contra, Debit Note, Credit Note,
 * Purchase (Accounting), Sales (Accounting), Receipt Voucher, Payment Voucher
 * — and ONE posting routine behind it.
 *
 * Twelve routes, no path params, no `/list` (the F8 list and the exceptions
 * report are registered grids). Every route that acts on an existing voucher
 * takes the house key `companyId · branchId · accYear · voucherId`. Rights
 * are judged on the voucher TYPE's menu (decision E), never on the menu the
 * screen was opened from.
 */
@ApiTags('Vouchers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('vouchers')
@UseFilters(VouchersExceptionFilter)
export class VouchersController {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly types: VoucherTypesService,
    private readonly lookups: VoucherLookupsService,
    private readonly register: VoucherRegisterService,
    private readonly cancelService: VoucherCancelService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Reads
  // ═════════════════════════════════════════════════════════════════════════

  @Get('types')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The register types the caller may VIEW, each with its rules and the caller’s rights',
    description:
      'Decision E: rights live on the voucher TYPE’s menu (acc_voucher_types.vchr_menu_id). ' +
      '`menuId` = a type’s own menu (101 Debit Note, 102 Credit Note, 103 Journal, 104 Contra, ' +
      '163 Purchase (Accounting), 259 Sales (Accounting), 260 Receipt Voucher, 261 Payment ' +
      'Voucher) returns that type only; the Voucher Register menu (262), or none, returns every ' +
      'type the caller may view. A type the user lacks VIEW on never reaches the band.',
  })
  @ApiOkResponse({ type: VoucherTypesSuccessDto })
  async listTypes(
    @Query() q: VoucherTypesQueryDto,
  ): Promise<VoucherSuccessResponse<VoucherTypesPayload>> {
    const menuId = q.menuId ?? null;
    const types = await this.types.typesForCaller(this.requestContext.getUserId(), menuId);
    return {
      success: true,
      message:
        types.length === 0
          ? 'You have no voucher types on this menu. Ask for Journal, Contra … rights.'
          : `${types.length} voucher type(s)`,
      data: { menuId, types },
    };
  }

  @Get('ledger-pick')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Ledgers legal on one side of one voucher type',
    description:
      'The type’s vchr_dr_groups / vchr_cr_groups, a sub-group of a listed group counting, MINUS ' +
      'instrument-controlled ledgers (Cheques in Hand, PDC holding, card / UPI clearing — those ' +
      'belong to Received / Issued Cheques, menus 51 / 52). Empty groups = any ledger.',
  })
  @ApiOkResponse({ type: LedgerPickSuccessDto })
  @ApiNotFoundResponse({ type: VoucherErrorResponseDto })
  async ledgerPick(
    @Query() q: LedgerPickQueryDto,
  ): Promise<VoucherSuccessResponse<LedgerPickPayload>> {
    const data = await this.lookups.ledgerPick(q);
    return { success: true, message: `${data.ledgers.length} ledger(s)`, data };
  }

  @Get('ledger-balance')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'A ledger’s book balance as on a date',
    description:
      'Opening (acc_opening_balance, this year) + Σ av_signed_amount of POSTED and CANCELLED ' +
      'vouchers dated ≤ asOn. Never led_total_*. The same figure the Ledger Statement closes at.',
  })
  @ApiOkResponse({ type: LedgerBalanceSuccessDto })
  async ledgerBalance(
    @Query() q: LedgerBalanceQueryDto,
  ): Promise<VoucherSuccessResponse<LedgerBalancePayload>> {
    const data = await this.lookups.ledgerBalance(q);
    return { success: true, message: `${data.amount} ${data.side} as on ${data.asOn}`, data };
  }

  @Get('party-facts')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'GSTIN, state, credit days, bill-by-bill, TDS section and rate, outstanding',
    description: 'The facts line under the party box. The TDS rate is the one in force on asOn.',
  })
  @ApiOkResponse({ type: PartyFactsSuccessDto })
  @ApiNotFoundResponse({ type: VoucherErrorResponseDto })
  async partyFacts(
    @Query() q: PartyFactsQueryDto,
  ): Promise<VoucherSuccessResponse<PartyFactsPayload>> {
    const data = await this.lookups.partyFacts(q);
    return { success: true, message: `Facts for ${data.name}`, data };
  }

  @Get('open-bills')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'A party’s open bills on one side, oldest first',
    description:
      'acc_bill_balance rows with pending > 0, every year. side DR = what the party owes ' +
      '(a CR party leg settles these); CR = what they hold (a DR party leg settles these).',
  })
  @ApiOkResponse({ type: OpenBillsSuccessDto })
  async openBills(
    @Query() q: OpenBillsQueryDto,
  ): Promise<VoucherSuccessResponse<OpenBillsPayload>> {
    const data = await this.lookups.openBills(q);
    return { success: true, message: `${data.bills.length} open bill(s)`, data };
  }

  @Get('tax-rates')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The active GST rates',
    description:
      'For the client’s preview of the generated legs. The server recomputes regardless.',
  })
  @ApiOkResponse({ type: TaxRatesSuccessDto })
  async taxRates(@Query() q: TaxRatesQueryDto): Promise<VoucherSuccessResponse<TaxRatesPayload>> {
    const data = await this.lookups.taxRates(q);
    return { success: true, message: `${data.rates.length} rate(s)`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One voucher in full',
    description:
      'Header, legs (each flagged generated, with its role), allocations, the bills it raised, ' +
      'the GST document, the TDS rows, the caller’s rights on the type’s menu, and the locks ' +
      '{editable, dayClosed, periodLocked, allocatedElsewhere}. A DRAFT also hands back the ' +
      'typed payload exactly as /create stored it (`draft`).',
  })
  @ApiOkResponse({ type: VoucherSuccessDto })
  @ApiNotFoundResponse({ type: VoucherErrorResponseDto })
  @ApiForbiddenResponse({ type: VoucherErrorResponseDto })
  async get(@Query() q: GetVoucherQueryDto): Promise<VoucherSuccessResponse<VoucherPayload>> {
    const data = await this.register.get(q);
    return {
      success: true,
      message: `${data.header.typeName} ${data.header.voucherRefno ?? '(draft)'} — ${data.header.status}`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Writes
  // ═════════════════════════════════════════════════════════════════════════

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Save or update a DRAFT',
    description:
      'The header row with NO number, and the payload verbatim in avh_draft_lines. No legs, no ' +
      'allocations, no bills, no GST or TDS rows exist for a DRAFT — it touches no balance. ' +
      'Needs CREATE (new) or EDIT (an existing draft) on the type’s menu. A POSTED voucher here ' +
      'is a 409: it is corrected by cancel and re-enter.',
  })
  @ApiCreatedResponse({ type: DraftSavedSuccessDto })
  @ApiBadRequestResponse({ type: VoucherErrorResponseDto })
  @ApiForbiddenResponse({ type: VoucherErrorResponseDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async create(
    @Body() dto: VoucherPayloadDto,
    // The raw body as well: avh_draft_lines keeps the payload BYTE-EQUAL, and
    // a DTO has already turned its numbers into strings.
    @Body() raw: Record<string, unknown>,
  ): Promise<VoucherSuccessResponse<DraftSavedPayload>> {
    const data = await this.register.create(dto, raw);
    return { success: true, message: data.created ? 'Draft saved' : 'Draft updated', data };
  }

  @Post('validate')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Derive the voucher — writes nothing',
    description:
      'The screen’s calculator. Returns the DERIVED voucher (every leg, generated legs flagged, ' +
      'the GST summary, the TDS, the party amount, the bills to be raised) plus refusals[] and ' +
      'warnings[] together, so five problems are fixed in one visit. Always a 200: a refusal is ' +
      'the ANSWER, not an error. An overridable WARN stays a WARN here and becomes a refusal on ' +
      '/post unless it is in overrides[] and the user holds um_can_override.',
  })
  @ApiOkResponse({ type: ValidateSuccessDto })
  @ApiForbiddenResponse({ type: VoucherErrorResponseDto })
  async validate(
    @Body() dto: ValidateVoucherDto,
  ): Promise<VoucherSuccessResponse<ValidatePayload>> {
    const data = await this.register.validate(dto);
    return {
      success: true,
      message: data.ok
        ? `Balanced: ${data.derived.totals.debit} = ${data.derived.totals.credit}`
        : `${data.refusals.length} refusal(s)`,
      data,
    };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post — the one posting routine, in one transaction',
    description:
      'Rights → calendar → the typed lines → the GST legs → the TDS leg → the party leg → ' +
      'Σ DR = Σ CR → number → header and legs → bills and allocations → the GST document → the ' +
      'TDS register → POSTED → the trial-mode books check. Any failure rolls everything back, ' +
      'the number included. A new voucher posts without a prior /create; a draft posts into its ' +
      'own header. Returns what /get returns.',
  })
  @ApiCreatedResponse({ type: VoucherSuccessDto })
  @ApiBadRequestResponse({ type: VoucherErrorResponseDto })
  @ApiForbiddenResponse({ type: VoucherErrorResponseDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: VoucherErrorResponseDto })
  async post(@Body() dto: PostVoucherDto): Promise<VoucherSuccessResponse<VoucherPayload>> {
    const data = await this.register.post(dto);
    return { success: true, message: `Posted ${data.header.voucherRefno}.`, data };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel = a reversal under the Rev type',
    description:
      'A Rev voucher in its own series (rev000NN), dated the ORIGINAL’s date, narration ' +
      '"Reversal of <refno>", linked both ways; every leg mirrored; own allocations reversed by ' +
      'counter-rows (never deleted); the raised bill closed; the GST document CANCELLED; a TDS ' +
      'reversal row. The original’s series never loses a number. Refused when another voucher ' +
      'has settled against a bill this one raised, when an IRN is live, or when the TDS was ' +
      'deposited by challan.',
  })
  @ApiCreatedResponse({ type: CancelSuccessDto })
  @ApiForbiddenResponse({ type: VoucherErrorResponseDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async cancel(@Body() dto: CancelVoucherDto): Promise<VoucherSuccessResponse<CancelPayload>> {
    const data = await this.cancelService.cancel(dto);
    return {
      success: true,
      message: `${data.voucherRefno} cancelled — reversed by ${data.reversalRefno}`,
      data,
    };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Throw a DRAFT away',
    description:
      'DRAFT only. A POSTED voucher is a 409 naming /cancel — money in the books is reversed, never removed.',
  })
  @ApiCreatedResponse({ type: DeleteSuccessDto })
  @ApiForbiddenResponse({ type: VoucherErrorResponseDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  @ApiNotFoundResponse({ type: VoucherErrorResponseDto })
  async delete(@Body() dto: DeleteVoucherDto): Promise<VoucherSuccessResponse<DeletePayload>> {
    const data = await this.register.deleteDraft(dto);
    return { success: true, message: 'Draft deleted', data };
  }
}
