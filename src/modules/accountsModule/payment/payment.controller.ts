import { Body, Controller, Get, Post, Put, Query, UseFilters, Version } from '@nestjs/common';
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
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { assertMenuRight, type MenuRight } from '../../../common/posting/rights';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { PaymentExceptionFilter } from './payment-exception.filter';
import { PaymentService } from './payment.service';
import { PaymentPostingService } from './payment-posting.service';
import { PaymentCancelService } from './payment-cancel.service';
import { PaymentAmendService } from './payment-amend.service';
import { PaymentOpenItemsService } from './payment-open-items.service';
import {
  AdjacentVoucherQueryDto,
  DuplicateCheckQueryDto,
  ListPaymentOpenItemsQueryDto,
  PartyContextQueryDto,
} from './dto/open-item.dto';
import { AmendPaymentDto } from './dto/amend-payment.dto';
import { SaveDraftPaymentDto, UpdatePaymentHeaderDto } from './dto/save-payment.dto';
import {
  CancelPaymentDto,
  DeletePaymentDto,
  GetPaymentQueryDto,
  PostPaymentDto,
} from './dto/post-payment.dto';
import {
  AdjacentVoucherSuccessDto,
  DuplicateCheckSuccessDto,
  PaymentAmendSuccessDto,
  PaymentCancelSuccessDto,
  PaymentDeleteSuccessDto,
  PaymentDraftSuccessDto,
  PaymentErrorResponseDto,
  PaymentHeaderSuccessDto,
  PaymentOpenItemsSuccessDto,
  PaymentPartyContextSuccessDto,
  PaymentPostSuccessDto,
  PaymentSuccessDto,
} from './dto/payment-response.dto';
import type {
  AdjacentVoucherPayload,
  DuplicateCheckPayload,
  PaymentAmendPayload,
  PaymentCancelPayload,
  PaymentDeletePayload,
  PaymentDraftPayload,
  PaymentHeader,
  PaymentOpenItemsPayload,
  PaymentPartyContextPayload,
  PaymentPayload,
  PaymentPostPayload,
  PaymentSuccessResponse,
} from './types/payment-api.types';
import { PAYMENT_MENU_ID } from './types/payment-enum';

/**
 * Money paid to a party, split across instruments, allocated due-date first
 * against the bills we owe them and any debit of ours they hold.
 *
 * `/receipts/*` mirrored, route for route (plan-backend-payment rev 2 §4):
 * the same eleven routes less `/regularise-pdc` — the receipt's sweep is
 * company-wide over `acc_bill_adjustment` and regularises a post-dated
 * PAYMENT row too (`BillBalanceRecomputeService` never looks at `abj_dr_cr`;
 * it sums by adjustment type). The four `avh*` keys, the DRAFT → POSTED →
 * CANCELLED life, `/delete` for a draft and `/amend` behind
 * `accounts.allow_posted_amend` are all as the receipt has them. The list is
 * the registered grid 'MAIN LIST - PAYMENTS' through /configured-grid-sql.
 */
@ApiTags('Payments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: PaymentErrorResponseDto })
@Controller('payments')
@UseFilters(PaymentExceptionFilter)
export class PaymentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly postingService: PaymentPostingService,
    private readonly cancelService: PaymentCancelService,
    private readonly amendService: PaymentAmendService,
    private readonly openItemsService: PaymentOpenItemsService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Reads
  // ═════════════════════════════════════════════════════════════════════════

  @Get('open-items')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Everything we owe a party and everything of ours they hold',
    description:
      'bills = the party’s CR bills pending (PURCHASE, OPENING, JOURNAL); credits = the DR items ' +
      'we hold on them (an ADVANCE paid, a PURCHASE_RETURN / debit note, OPENING / JOURNAL ' +
      'debits). party adds the TDS rate in force (accounts.tds_rates), the party’s default ' +
      'bank account for a transfer’s beneficiary, who a cheque is made out to, and ' +
      'isMoneyLedger — a payment to a cash / bank ledger is a Contra and /create refuses it.\n\n' +
      'No accounting year, no branch, no paging — for the reasons /receipts/open-items gives.',
  })
  @ApiOkResponse({ type: PaymentOpenItemsSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  @ApiNotFoundResponse({ type: PaymentErrorResponseDto })
  async openItems(
    @Query() query: ListPaymentOpenItemsQueryDto,
  ): Promise<PaymentSuccessResponse<PaymentOpenItemsPayload>> {
    await this.requireRight('view', 'view payments');
    const data = await this.openItemsService.listOpenItems(query);
    return {
      success: true,
      message: `${data.bills.length} open bill(s) and ${data.credits.length} debit(s) held for ${data.party.ledName}`,
      data,
    };
  }

  @Get('party-context')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The party’s last ten payments and our cheques to them still out',
    description:
      'lastPayments[10]; ourChequesOut[] = apd_tra_type P rows still HELD; the summary totals.',
  })
  @ApiOkResponse({ type: PaymentPartyContextSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  async partyContext(
    @Query() query: PartyContextQueryDto,
  ): Promise<PaymentSuccessResponse<PaymentPartyContextPayload>> {
    await this.requireRight('view', 'view payments');
    const data = await this.openItemsService.partyContext(query);
    return { success: true, message: 'Party context fetched successfully', data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'One payment in full',
    description:
      'Header, tenders (each bank row with its beneficiary), other-ledger lines, legs, ' +
      'allocations, debits applied, chequesIssued[] (leaf, book, printed, status), the ' +
      'post-dated vouchers and the ADVANCE (DR) bills. On a DRAFT, allocations[] and ' +
      'creditsApplied[] are what /payments/create REMEMBERED (abjId null) — a suggestion, ' +
      'never validated: re-read /payments/open-items and clamp.',
  })
  @ApiOkResponse({ type: PaymentSuccessDto })
  @ApiNotFoundResponse({ type: PaymentErrorResponseDto })
  async get(@Query() query: GetPaymentQueryDto): Promise<PaymentSuccessResponse<PaymentPayload>> {
    await this.requireRight('view', 'view payments');
    const data = await this.paymentService.get(query);
    return { success: true, message: 'Payment fetched successfully', data };
  }

  @Get('adjacent')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The payment entered just before or just after this one',
    description:
      'R-B4, as /receipts/adjacent — the register’s order, the register’s filters, a KEY back.',
  })
  @ApiOkResponse({ type: AdjacentVoucherSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  @ApiNotFoundResponse({ type: PaymentErrorResponseDto })
  async adjacent(
    @Query() query: AdjacentVoucherQueryDto,
  ): Promise<PaymentSuccessResponse<AdjacentVoucherPayload>> {
    await this.requireRight('view', 'view payments');
    const data = await this.openItemsService.adjacent(query);
    return {
      success: true,
      message: data.voucher
        ? `${data.voucher.voucherRefno ?? data.voucher.voucherId} is the ${query.direction} payment`
        : `No ${query.direction} payment — this is the end of the register`,
      data,
    };
  }

  @Get('duplicate-check')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Has this party already been paid this amount on this date?',
    description:
      'R-B6 — Σ tender amount paid to this party today, matched EXACTLY. A WARNING, never a refusal.',
  })
  @ApiOkResponse({ type: DuplicateCheckSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  @ApiNotFoundResponse({ type: PaymentErrorResponseDto })
  async duplicateCheck(
    @Query() query: DuplicateCheckQueryDto,
  ): Promise<PaymentSuccessResponse<DuplicateCheckPayload>> {
    await this.requireRight('view', 'view payments');
    const data = await this.openItemsService.duplicateCheck(query);
    return {
      success: true,
      message: data.isDuplicate
        ? `${data.matches.length} payment(s) already made to this party for this amount on this date`
        : 'No matching payment — this does not look like a duplicate',
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Writes
  // ═════════════════════════════════════════════════════════════════════════

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Save a draft payment',
    description:
      'Upsert on avhVoucherId. Writes the header (DRAFT, no number), the tender rows (td_dr_cr ' +
      'CR, td_voucher_id NULL) and the other-ledger lines into avh_draft_lines. Nothing touches a ' +
      'bill (R10).\n\n' +
      'A CHEQUE row names its BOOK (cheque.chequeBookId) and never a number: the leaf is taken at ' +
      'post. A bank row may carry a beneficiary. BANK_CHARGES is seeded from tdMdrAmt and, for a ' +
      'TDS-applicable party, TDS_PAYABLE is seeded from accounts.tds_rates — a client figure that ' +
      'disagrees is a 409.\n\n' +
      'allocations[] and creditsApplied[] are REMEMBERED, not applied (notes 30).',
  })
  @ApiCreatedResponse({ type: PaymentDraftSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  @ApiConflictResponse({ type: PaymentErrorResponseDto })
  @ApiNotFoundResponse({ type: PaymentErrorResponseDto })
  async create(
    @Body() dto: SaveDraftPaymentDto,
  ): Promise<PaymentSuccessResponse<PaymentDraftPayload>> {
    await this.requireRight(dto.avhVoucherId ? 'edit' : 'create', 'save payment drafts');
    const data = await this.paymentService.save(dto);
    return { success: true, message: 'Payment draft saved successfully', data };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post the payment — the one-way door',
    description:
      'ONE transaction, the receipt’s steps with the money going OUT. Everything in the body is a ' +
      'PREVIEW: the server re-reads every bill under a row lock, re-runs the allocation engine ' +
      '(direction OUT) and refuses a mismatch. Each cheque row takes its book’s next leaf under ' +
      'the book’s row lock and gets an acc_pdc_register row (apd_tra_type P); a post-dated cheque ' +
      'gets a voucher of its own dated the cheque; a remainder becomes an ADVANCE (DR) bill; TDS ' +
      'goes on the register.',
  })
  @ApiCreatedResponse({ type: PaymentPostSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  @ApiConflictResponse({ type: PaymentErrorResponseDto })
  async postPayment(
    @Body() dto: PostPaymentDto,
  ): Promise<PaymentSuccessResponse<PaymentPostPayload>> {
    await this.requireRight('post', 'post payments');
    const data = await this.postingService.post(dto);
    const pdcCount = data.numberedVouchers.filter((voucher) => voucher.isPdcVoucher).length;
    return {
      success: true,
      message:
        `Payment ${data.header.avhVoucherRefno} posted` +
        (data.cheques.length > 0
          ? ` — cheque ${data.cheques.map((c) => c.leaf).join(', ')} issued`
          : '') +
        (pdcCount > 0 ? ` with ${pdcCount} post-dated cheque voucher(s)` : ''),
      data,
    };
  }

  @Put('update-header')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Change the narration and references on a posted payment',
    description: 'The ONLY edit a posted payment accepts. A body carrying anything else is a 400.',
  })
  @ApiOkResponse({ type: PaymentHeaderSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  @ApiConflictResponse({ type: PaymentErrorResponseDto })
  async updateHeader(
    @Body() dto: UpdatePaymentHeaderDto,
    @Body() body: Record<string, unknown>,
  ): Promise<PaymentSuccessResponse<PaymentHeader>> {
    await this.requireRight('edit', 'edit payments');
    const data = await this.paymentService.updateHeader(dto, body);
    return { success: true, message: 'Payment header updated successfully', data };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Reverse a posted payment',
    description:
      'A reversal voucher for the payment AND for every post-dated cheque voucher; a negative ' +
      'adjustment row per row the post wrote; the advance bills soft-deleted; the register rows ' +
      'CANCELLED; the TDS register reversed. Refused when a cheque has gone past HELD (unwind it ' +
      'on Issued Cheques, menu 52), when a transfer is SETTLED by the bank, or when the advance ' +
      'has already been spent.',
  })
  @ApiCreatedResponse({ type: PaymentCancelSuccessDto })
  @ApiConflictResponse({ type: PaymentErrorResponseDto })
  async cancel(
    @Body() dto: CancelPaymentDto,
  ): Promise<PaymentSuccessResponse<PaymentCancelPayload>> {
    await this.requireRight('cancel', 'cancel payments');
    const data = await this.cancelService.cancel(dto);
    return {
      success: true,
      message: `Payment ${data.avhVoucherRefno} cancelled — ${data.reversals.length} voucher(s) reversed`,
      data,
    };
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Throw a draft away',
    description: 'DRAFT only, the four keys only. A POSTED payment is a 409 naming /cancel.',
  })
  @ApiCreatedResponse({ type: PaymentDeleteSuccessDto })
  @ApiConflictResponse({ type: PaymentErrorResponseDto })
  @ApiNotFoundResponse({ type: PaymentErrorResponseDto })
  async delete(
    @Body() dto: DeletePaymentDto,
  ): Promise<PaymentSuccessResponse<PaymentDeletePayload>> {
    await this.requireRight('delete', 'delete payment drafts');
    const data = await this.paymentService.deleteDraft(dto);
    return {
      success: true,
      message:
        'Draft payment deleted' +
        (data.tendersDeleted > 0 ? ` — ${data.tendersDeleted} tender row(s) removed` : ''),
      data,
    };
  }

  @Post('amend')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restate a posted payment in place — behind a company setting, default OFF',
    description:
      'R20, as /receipts/amend: the whole payload plus baseRevision and editRemark; the same ' +
      'setting (accounts.allow_posted_amend), the same refusals as /cancel, the same audit rows. ' +
      'The old cheques’ leaves stay used; the re-apply takes fresh ones.',
  })
  @ApiCreatedResponse({ type: PaymentAmendSuccessDto })
  @ApiBadRequestResponse({ type: PaymentErrorResponseDto })
  @ApiConflictResponse({ type: PaymentErrorResponseDto })
  @ApiNotFoundResponse({ type: PaymentErrorResponseDto })
  async amend(@Body() dto: AmendPaymentDto): Promise<PaymentSuccessResponse<PaymentAmendPayload>> {
    await this.requireRight('amend', 'amend posted payments');
    const data = await this.amendService.amend(dto);
    return {
      success: true,
      message: `Payment ${data.header.avhVoucherRefno ?? data.header.avhVoucherId} amended — now revision ${data.toRevision}`,
      data,
    };
  }

  /**
   * notes (62) D2 — every route is judged on menu PAYMENT_MENU_ID's `user_menus` row
   * for the caller, as the Voucher Register and the sales documents are:
   * reads need view, a new draft create, a draft change edit, and post /
   * cancel / amend / delete their own right. No row, no rights.
   */
  private async requireRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: PAYMENT_MENU_ID,
      right,
      codePrefix: 'PMT',
      action,
    });
  }
}
