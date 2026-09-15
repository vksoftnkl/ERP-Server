import { Body, Controller, Get, Post, Put, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { ReceiptExceptionFilter } from './receipt-exception.filter';
import { ReceiptService } from './receipt.service';
import { ReceiptPostingService } from './receipt-posting.service';
import { ReceiptCancelService } from './receipt-cancel.service';
import { OpenItemsService } from './open-items.service';
import { ListOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { RegularisePdcDto, SaveReceiptDto, UpdateReceiptHeaderDto } from './dto/save-receipt.dto';
import { CancelReceiptDto, GetReceiptQueryDto, PostReceiptDto } from './dto/post-receipt.dto';
import {
  OpenItemsSuccessDto,
  PartyContextSuccessDto,
  ReceiptCancelSuccessDto,
  ReceiptDraftSuccessDto,
  ReceiptErrorResponseDto,
  ReceiptHeaderSuccessDto,
  ReceiptPostSuccessDto,
  ReceiptSuccessDto,
  RegularisePdcSuccessDto,
} from './dto/receipt-response.dto';
import { toDateOnly } from './receipt.utils';
import type {
  OpenItemsPayload,
  PartyContextPayload,
  ReceiptCancelPayload,
  ReceiptDraftPayload,
  ReceiptHeader,
  ReceiptPayload,
  ReceiptPostPayload,
  ReceiptSuccessResponse,
  RegularisePdcPayload,
} from './types/receipt-api.types';

/**
 * Money received from a party, split across instruments, allocated due-date
 * first against their open bills and any credit they hold.
 *
 * ── The surface, and what is deliberately not on it ──────────────────────
 * SIX routes, plus `/update-header` (header editing on a posted receipt) and
 * `/regularise-pdc` (the maintenance sweep). There is:
 *
 *   · no `/approve` and no `/reject` — a receipt is DRAFT, then POSTED, then
 *     CANCELLED, and `/post` runs straight from the DRAFT;
 *   · no `/list` — the list is a REGISTERED GRID served by
 *     `/configured-grid-sql`, which is how every other main list here works
 *     and what makes the operator's saved columns and filters apply to it.
 *
 * ── The four keys ────────────────────────────────────────────────────────
 * Every route that acts on an existing voucher takes
 * `avhCompanyId · avhBranchId · avhAccYear · avhVoucherId`. The year is part
 * of the primary key (the table is partitioned on it); the company and the
 * branch are what stop a bare uuid from reaching another company's receipt.
 */
@ApiTags('Receipts')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('receipts')
@UseFilters(ReceiptExceptionFilter)
export class ReceiptController {
  constructor(
    private readonly receiptService: ReceiptService,
    private readonly postingService: ReceiptPostingService,
    private readonly cancelService: ReceiptCancelService,
    private readonly openItemsService: OpenItemsService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Reads
  // ═════════════════════════════════════════════════════════════════════════

  @Get('open-items')
  @Version(API_VERSION)
  // No cache. The whole point of this read is "what is pending RIGHT NOW", and
  // a cached answer is how one bill gets collected twice.
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Everything a party owes and everything of theirs the company holds',
    description:
      'The ONE answer to that question — /transactions/party-balance calls the same code for its ' +
      'credit panel, so the two cannot disagree.\n\n' +
      'No accounting year: acc_bill_balance is partitioned by the year a bill ORIGINATED in and ' +
      'is never carried forward, so filtering on this year would hide every bill raised before ' +
      'it. No branch: a customer pays one cheque for bills raised at three. **No paging**: a ' +
      'capped list is a wrong collection, not a slow one.',
  })
  @ApiOkResponse({ type: OpenItemsSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async openItems(
    @Query() query: ListOpenItemsQueryDto,
  ): Promise<ReceiptSuccessResponse<OpenItemsPayload>> {
    const data = await this.openItemsService.listOpenItems(query);

    return {
      success: true,
      message: `${data.bills.length} open bill(s) and ${data.credits.length} credit(s) for ${data.party.ledName}`,
      data,
    };
  }

  @Get('party-context')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: "The party's last ten receipts and the cheques of theirs still in flight",
    description:
      'The two side panels of the 3.0 screen. Read-only, and small by construction, so there is ' +
      'no cap: a party with a hundred uncleared cheques is a collections problem the panel should ' +
      'show, not hide behind a "more" button.',
  })
  @ApiOkResponse({ type: PartyContextSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  async partyContext(
    @Query() query: PartyContextQueryDto,
  ): Promise<ReceiptSuccessResponse<PartyContextPayload>> {
    const data = await this.openItemsService.partyContext(query);

    return { success: true, message: 'Party context fetched successfully', data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'One receipt in full',
    description:
      'Header, tenders, other-ledger lines, legs (each with avRole), allocations, credits ' +
      'applied, cheques, the post-dated vouchers and the advance bills. A POSTED receipt paints ' +
      'read-only from this, and it is what the RECEIPT_VOUCHER print purpose reads.\n\n' +
      'avhAccYear is not optional: acc_voucher_header is partitioned on the year, so an id alone ' +
      'does not name a row.',
  })
  @ApiOkResponse({ type: ReceiptSuccessDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async get(@Query() query: GetReceiptQueryDto): Promise<ReceiptSuccessResponse<ReceiptPayload>> {
    const data = await this.receiptService.get(query);

    return { success: true, message: 'Receipt fetched successfully', data };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Writes
  // ═════════════════════════════════════════════════════════════════════════

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Save a draft receipt',
    description:
      'Upsert on avhVoucherId. Writes the header (DRAFT, NO number — an abandoned draft must ' +
      'leave no gap in the series), the tender rows with td_voucher_id NULL, and the ' +
      'other-ledger lines into avh_draft_lines.\n\n' +
      '**Nothing touches a bill and nothing touches acc_vouchers** (R10). Allocation happens at ' +
      'post, against what is pending then.\n\n' +
      'tdIsPdc is never sent — it is computed from tdInstrumentDate against the receipt date. ' +
      'BANK_CHARGES and SURCHARGE_RECOVERED lines are seeded from the tenders if the client omits ' +
      'them, and refused if the client sends figures that disagree.',
  })
  @ApiCreatedResponse({ type: ReceiptDraftSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async create(@Body() dto: SaveReceiptDto): Promise<ReceiptSuccessResponse<ReceiptDraftPayload>> {
    const data = await this.receiptService.save(dto);

    return {
      success: true,
      message:
        data.expectedRoles.length > 0
          ? `Receipt draft saved — this party normally also needs ${data.expectedRoles.join(', ')}`
          : 'Receipt draft saved successfully',
      data,
    };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post the receipt — the one-way door',
    description:
      'ONE transaction, fifteen ordered steps. Everything in the body is a PREVIEW: the server ' +
      're-reads every bill under a row lock, re-runs the allocation engine and refuses a ' +
      'mismatch — including an onAccount that disagrees with its own, which is the single figure ' +
      'that proves the client and the server read the same receipt.\n\n' +
      "Writes: the receipt's legs; one voucher per POST-DATED cheque, dated the cheque and " +
      'numbered in its own right; one acc_pdc_register row per cheque; the adjustment rows; one ' +
      'ADVANCE bill per voucher with a remainder; and the bill caches, recomputed.\n\n' +
      'A post-dated row is written today and counts only when its date arrives — which is why a ' +
      'cheque dated today settles immediately and one dated next week leaves the bill open.\n\n' +
      'Two concurrent posts against one bill: one gets a 409 naming the bill and its current ' +
      'pending amount, never a 500.',
  })
  @ApiCreatedResponse({ type: ReceiptPostSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  async postReceipt(
    @Body() dto: PostReceiptDto,
  ): Promise<ReceiptSuccessResponse<ReceiptPostPayload>> {
    const data = await this.postingService.post(dto);
    const pdcCount = data.numberedVouchers.filter((voucher) => voucher.isPdcVoucher).length;

    return {
      success: true,
      message:
        `Receipt ${data.header.avhVoucherRefno} posted` +
        (pdcCount > 0 ? ` with ${pdcCount} post-dated cheque voucher(s)` : ''),
      data,
    };
  }

  @Put('update-header')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Change the narration and references on a posted receipt',
    description:
      'The ONLY edit a posted receipt accepts: remarks, the two reference numbers, the document ' +
      'date and the salesman. Money is changed by cancelling and re-entering (R3).\n\n' +
      'A body carrying anything else — tenders, allocations, an amount — is a 400 and not a ' +
      'silent ignore: a client that believes it changed the money must be told that it did not.',
  })
  @ApiOkResponse({ type: ReceiptHeaderSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  async updateHeader(
    @Body() dto: UpdateReceiptHeaderDto,
    // The raw body as well as the validated DTO: the whitelist check has to see
    // the keys the CALLER sent, and a DTO has already dropped the ones it does
    // not declare.
    @Body() body: Record<string, unknown>,
  ): Promise<ReceiptSuccessResponse<ReceiptHeader>> {
    const data = await this.receiptService.updateHeader(dto, body);

    return { success: true, message: 'Receipt header updated successfully', data };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Reverse a posted receipt',
    description:
      'A reversal voucher for the receipt AND for every post-dated cheque voucher, with mirrored ' +
      'legs; a negative adjustment row for every row the post wrote; the advance bills soft ' +
      'deleted; the register rows CANCELLED; the tender rows soft deleted; and the originals ' +
      'CANCELLED, keeping their numbers.\n\n' +
      'Refused when any cheque has gone past HELD — deposited money is unwound on the Received ' +
      'Cheques screen — and refused when the on-account balance has already been spent.',
  })
  @ApiCreatedResponse({ type: ReceiptCancelSuccessDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  async cancel(
    @Body() dto: CancelReceiptDto,
  ): Promise<ReceiptSuccessResponse<ReceiptCancelPayload>> {
    const data = await this.cancelService.cancel(dto);

    return {
      success: true,
      message: `Receipt ${data.avhVoucherRefno} cancelled — ${data.reversals.length} voucher(s) reversed`,
      data,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Maintenance
  // ═════════════════════════════════════════════════════════════════════════

  @Post('regularise-pdc')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Bring every matured post-dated settlement into the bills' cached totals",
    description:
      'Tally\'s "Regularised". A post-dated adjustment row is written when the receipt posts and ' +
      'counts only once its date arrives, so a bill settled by a cheque maturing today becomes ' +
      'CLOSED without anybody posting anything — this is what makes that visible in the stored ' +
      'columns.\n\n' +
      'Run it from cron just after midnight:\n' +
      "`curl -X POST https://host/api/v1/receipts/regularise-pdc -d '{}'`\n\n" +
      'It sweeps everything maturing ON OR BEFORE the date, not only on it, so a run after an ' +
      'outage repairs every day that was missed. Idempotent.',
  })
  @ApiCreatedResponse({ type: RegularisePdcSuccessDto })
  async regularise(
    @Body() dto: RegularisePdcDto,
  ): Promise<ReceiptSuccessResponse<RegularisePdcPayload>> {
    const data = await this.recompute.regularisePostDated(
      dto.asOf ? toDateOnly(dto.asOf) : new Date(),
    );

    return {
      success: true,
      message: `${data.billsRegularised} bill(s) regularised as at ${data.asOf}`,
      data,
    };
  }
}
