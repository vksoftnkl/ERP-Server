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
import { ReceiptAmendService } from './receipt-amend.service';
import { OpenItemsService } from './open-items.service';
import { ListOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { AmendReceiptDto } from './dto/amend-receipt.dto';
import { RegularisePdcDto, SaveReceiptDto, UpdateReceiptHeaderDto } from './dto/save-receipt.dto';
import {
  CancelReceiptDto,
  DeleteReceiptDto,
  GetReceiptQueryDto,
  PostReceiptDto,
} from './dto/post-receipt.dto';
import {
  OpenItemsSuccessDto,
  PartyContextSuccessDto,
  ReceiptAmendSuccessDto,
  ReceiptCancelSuccessDto,
  ReceiptDeleteSuccessDto,
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
  ReceiptAmendPayload,
  ReceiptCancelPayload,
  ReceiptDeletePayload,
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
 * SIX routes, plus `/delete` (throw a draft away), `/update-header` (header
 * editing on a posted receipt), `/amend` (R20 — restate a posted receipt whole,
 * behind a company setting, default OFF) and `/regularise-pdc` (the maintenance
 * sweep). There is:
 *
 *   · no `/approve` and no `/reject` — a receipt is DRAFT, then POSTED, then
 *     CANCELLED, and `/post` runs straight from the DRAFT;
 *   · no `/list` — the list is a REGISTERED GRID served by
 *     `/configured-grid-sql`, which is how every other main list here works
 *     and what makes the operator's saved columns and filters apply to it.
 *
 * ── `/amend` is not a second `/post`, and not a mode on `/create` ────────
 * It is the ONE route here gated by a setting (`accounts.allow_posted_amend`,
 * default off), and it exists separately because `/create` is what the screen
 * calls on every draft save, every retry and every double-submit — so a POSTED
 * voucher reaching `/create` must stay a 409 rather than silently restating a
 * posted document. Amend calls `/post`'s own transaction rather than
 * reproducing it, and refuses on exactly what `/cancel` refuses on.
 *
 * ── `/delete` and `/cancel` are not two names for one thing ─────────────
 * They apply to disjoint statuses and do opposite things. `/cancel` takes a
 * POSTED receipt and REVERSES it — a numbered reversal voucher, negative
 * adjustment rows, a mandatory reason — because money in the books is answered
 * for, never removed. `/delete` takes a DRAFT, which wrote no accounting at
 * all, and simply retires the row. Neither will do the other's job, and each
 * refuses the other's status with a 409 naming the route that applies.
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
    private readonly amendService: ReceiptAmendService,
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

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Throw a draft away',
    description:
      'DRAFT only, and the four keys only — there is no reason field, because there is nothing ' +
      'to justify. A draft took no number, touched no bill and wrote nothing into acc_vouchers ' +
      '(R10), so abandoning one is abandoning a piece of paper on a desk.\n\n' +
      'Soft-deletes the header, its tender rows and the other-ledger lines in one transaction. ' +
      'avh_voucher_status is left at DRAFT: the row leaves play through avh_is_deleted, and the ' +
      'trail is a DELETED event in txn_status_log, which is the distinction that keeps an ' +
      'abandoned draft out of the cancelled list.\n\n' +
      'A POSTED receipt is a 409 naming /cancel — money in the books is reversed, never removed ' +
      '— and a CANCELLED one is a 409 too. This route exists because /cancel refuses a DRAFT, ' +
      'correctly, and without it an abandoned draft would be permanent.',
  })
  @ApiCreatedResponse({ type: ReceiptDeleteSuccessDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async delete(
    @Body() dto: DeleteReceiptDto,
  ): Promise<ReceiptSuccessResponse<ReceiptDeletePayload>> {
    const data = await this.receiptService.deleteDraft(dto);

    return {
      success: true,
      message:
        'Draft receipt deleted' +
        (data.tendersDeleted > 0 ? ` — ${data.tendersDeleted} tender row(s) removed` : ''),
      data,
    };
  }

  @Post('amend')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restate a posted receipt in place — behind a company setting, default OFF',
    description:
      'R20. Takes EXACTLY what /create and /post take together — the same object the screen ' +
      'already assembles — plus the four keys, a baseRevision and an editRemark. ONE ' +
      'transaction: the old money is unwound in place, the bills are recomputed, and §5.2’s ' +
      'fifteen steps re-run from the new payload.\n\n' +
      '**Not a second way to post.** It calls /post’s own transaction rather than reproducing ' +
      'it, so everything /post validates is validated here — including the identity to the ' +
      'paisa and an onAccount that must agree with the server’s own, recomputed against the ' +
      'REOPENED bills.\n\n' +
      '**The document keeps its identity**: same avhVoucherId, same avhVoucherNo, same ' +
      'avhVoucherRefno, POSTED before and POSTED after. No reversal voucher is written and the ' +
      'status never becomes CANCELLED — that is the whole difference from /cancel. ' +
      'avh_revision_no carries the change instead, because a receipt is not a GST document and ' +
      'the customer is holding a slip with that number on it.\n\n' +
      '**baseRevision is mandatory** and is the avhRevisionNo /receipts/get returned. A ' +
      'mismatch is a 409 naming the current revision: an amend carries the WHOLE document, so ' +
      'last-writer-wins would silently undo somebody else’s correction — on ledger legs, not ' +
      'on a master record. Reload on that 409; never retry with the number you were just told.\n\n' +
      '**Refused on exactly what /cancel is refused on**, and no setting makes these ' +
      'negotiable: a cheque DEPOSITED or later, an on-account balance already spent, a locked ' +
      'period or closed year, a receipt that is not POSTED. And refused as a 409 naming the ' +
      'setting key when accounts.allow_posted_amend is off — which is the default, and is the ' +
      'current cancel-and-re-enter model unchanged.\n\n' +
      'audit.audit_log carries the before and after of acc_voucher_header, acc_vouchers, ' +
      'acc_bill_adjustment and acc_pdc_register; txn_status_log reads POSTED → AMENDED → ' +
      'POSTED, carrying the editRemark.',
  })
  @ApiCreatedResponse({ type: ReceiptAmendSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async amend(@Body() dto: AmendReceiptDto): Promise<ReceiptSuccessResponse<ReceiptAmendPayload>> {
    const data = await this.amendService.amend(dto);

    return {
      success: true,
      message:
        `Receipt ${data.header.avhVoucherRefno ?? data.header.avhVoucherId} amended — now ` +
        `revision ${data.toRevision}`,
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
