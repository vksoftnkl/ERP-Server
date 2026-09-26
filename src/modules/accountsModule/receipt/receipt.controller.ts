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
import {
  AdjacentVoucherQueryDto,
  DuplicateCheckQueryDto,
  ListOpenItemsQueryDto,
  PartyContextQueryDto,
} from './dto/open-item.dto';
import { AmendReceiptDto } from './dto/amend-receipt.dto';
import {
  RegularisePdcDto,
  SaveDraftReceiptDto,
  UpdateReceiptHeaderDto,
} from './dto/save-receipt.dto';
import {
  CancelReceiptDto,
  DeleteReceiptDto,
  GetReceiptQueryDto,
  PostReceiptDto,
} from './dto/post-receipt.dto';
import {
  AdjacentVoucherSuccessDto,
  DuplicateCheckSuccessDto,
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
  AdjacentVoucherPayload,
  DuplicateCheckPayload,
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
      'On a **DRAFT**, allocations[] and creditsApplied[] are what /receipts/create REMEMBERED — ' +
      'no adjustment row exists, so every row carries `abjId: null`. They are a suggestion: ' +
      'nothing re-checks them, so an amount may exceed what its bill can still take. Re-read ' +
      '/receipts/open-items and clamp. One more difference on a draft — a creditsApplied row ' +
      'names the CREDIT in billId with againstBillId null, because which invoices it settles is ' +
      "the allocation engine's decision at post.\n\n" +
      'Each allocations[] / creditsApplied[] row carries the BILL it names — `billAmount`, ' +
      '`pendingAmount` (as it stands NOW, after this receipt), `dueDate`, `billType` and ' +
      '`status` — because a posted receipt is painted from this payload alone and must not call ' +
      '/receipts/open-items: what a receipt shows is what it DID, not what the party owes ' +
      'today.\n\n' +
      "allocations[] is the voucher's HISTORY, not its current state. acc_bill_adjustment never " +
      'rewrites a row and never soft-deletes one, so an AMENDED receipt answers with the ' +
      'original row, its exact negative and the replacement — three rows against one bill. NET ' +
      'PER BILL before painting; `reversalOfId` and `isReversed` say which row retracted ' +
      'which.\n\n' +
      'A settlement, its discount, its write-off and its round-off are four rows against ONE ' +
      'bill, each with its own `adjType`. Route by it — there are no `discount` / `writeoff` ' +
      'fields.\n\n' +
      'avhAccYear is not optional: acc_voucher_header is partitioned on the year, so an id alone ' +
      'does not name a row.',
  })
  @ApiOkResponse({ type: ReceiptSuccessDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async get(@Query() query: GetReceiptQueryDto): Promise<ReceiptSuccessResponse<ReceiptPayload>> {
    const data = await this.receiptService.get(query);

    return { success: true, message: 'Receipt fetched successfully', data };
  }

  @Get('adjacent')
  @Version(API_VERSION)
  // No cache. The register changes under the operator all day, and a cached
  // neighbour is a walk that loops or that skips a receipt somebody just keyed.
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The receipt entered just before or just after this one',
    description:
      "R-B4 — 3.0's Ctrl+PgUp / Ctrl+PgDown. Without it every reopen is a search.\n\n" +
      'Returns a KEY, not a receipt: the client calls /receipts/get with it, which is what it ' +
      'was going to do next anyway, and the walk stays cheap enough to hold a key down on.\n\n' +
      '**prev is the receipt entered BEFORE this one; next is the one entered after.** Both are ' +
      'named for the ordering key — (voucher date, then voucher no) — and not for the direction ' +
      'the register happens to be drawn in, which is descending today and is a display choice.\n\n' +
      'Pass back the same `status` and date window the register was run with, so the walk visits ' +
      'exactly the rows the operator can see. The structural filters are always applied: receipt ' +
      'vouchers only, not deleted, and post-dated cheque vouchers excluded — those belong under ' +
      'their receipt and are not rows of the register.\n\n' +
      '`voucher` is **null at the end of the walk**, and that null is what greys the key out. ' +
      'There is no separate hasNext flag: a second thing saying the same thing is a second thing ' +
      'to keep true.',
  })
  @ApiOkResponse({ type: AdjacentVoucherSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async adjacent(
    @Query() query: AdjacentVoucherQueryDto,
  ): Promise<ReceiptSuccessResponse<AdjacentVoucherPayload>> {
    const data = await this.openItemsService.adjacent(query);

    return {
      success: true,
      message: data.voucher
        ? `${data.voucher.voucherRefno ?? data.voucher.voucherId} is the ${query.direction} receipt`
        : `No ${query.direction} receipt — this is the end of the register`,
      data,
    };
  }

  @Get('duplicate-check')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Has this party already paid this amount on this date?',
    description:
      'R-B6. On a beat run this is the only thing between a re-key and a double receipt.\n\n' +
      '**A WARNING, never a refusal.** It writes nothing and has no opinion: a customer settling ' +
      'two invoices with two equal cheques on one day is ordinary, so the answer goes to the ' +
      'operator and the operator decides. A 200 with an empty `matches` is the common case.\n\n' +
      'The amount is matched EXACTLY — Σ of the tender rows, the figure that becomes ' +
      'avh_doc_amount. A tolerance sounds safer and is not: on a beat where the day is 500, 1000 ' +
      'and 2000 over and over it would fire on nearly every row, and a prompt that fires on ' +
      'nearly every row is one nobody reads.\n\n' +
      'Scoped to the company and the year; `branchId` narrows it only if you send it, because a ' +
      're-key that landed on another branch is still a duplicate and is the one hardest to find ' +
      'by hand. CANCELLED receipts and post-dated cheque vouchers are excluded.\n\n' +
      'Send `excludeVoucherId` as soon as /create has returned one, or the draft on screen ' +
      'reports itself on every re-check.',
  })
  @ApiOkResponse({ type: DuplicateCheckSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async duplicateCheck(
    @Query() query: DuplicateCheckQueryDto,
  ): Promise<ReceiptSuccessResponse<DuplicateCheckPayload>> {
    const data = await this.openItemsService.duplicateCheck(query);

    return {
      success: true,
      message: data.isDuplicate
        ? `${data.matches.length} receipt(s) already taken from this party for this amount on this date`
        : 'No matching receipt — this does not look like a duplicate',
      data,
    };
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
      'them, and refused if the client sends figures that disagree.\n\n' +
      '**allocations[] and creditsApplied[] are REMEMBERED, not applied.** Send the bill-wise ' +
      'settlement as the operator left it and /receipts/get hands it back when the draft is ' +
      'reopened, so a split or a deliberately out-of-order settlement is not re-keyed by hand. ' +
      'Still no acc_bill_adjustment row and still no movement in abl_pending_amount — R10 is ' +
      'unchanged, and two people may hold drafts against the same party without reserving each ' +
      "other's outstanding.\n\n" +
      '**Nothing about them is validated, deliberately.** A remembered figure goes stale if ' +
      'somebody else settles the same bill in the meantime, and it is handed back exactly as ' +
      'stored: re-read /receipts/open-items on reopen and clamp. Refusing the load would cost the ' +
      'operator the whole draft to save one number. Omit either key to leave what is already ' +
      'remembered alone; send [] to clear it.',
  })
  @ApiCreatedResponse({ type: ReceiptDraftSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  @ApiConflictResponse({ type: ReceiptErrorResponseDto })
  @ApiNotFoundResponse({ type: ReceiptErrorResponseDto })
  async create(
    @Body() dto: SaveDraftReceiptDto,
  ): Promise<ReceiptSuccessResponse<ReceiptDraftPayload>> {
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
      'Run it from cron just after midnight, **once per company**:\n' +
      '`curl -X POST https://host/api/v1/receipts/regularise-pdc -d \'{"companyId":"…"}\'`\n\n' +
      'It sweeps everything maturing ON OR BEFORE the date, not only on it, so a run after an ' +
      'outage repairs every day that was missed. Idempotent.\n\n' +
      '**companyId is required** (R-B1). This route used to take nothing but `asOf`, so one ' +
      'authenticated call regularised every company in the database — idempotent, and still a ' +
      'write across a tenant boundary.\n\n' +
      '`branchId` and `accYear` are FILTERS and are not the house keys here: omit both on the ' +
      'nightly run. Outstanding is company-wide and a bill raised at one branch is settled at ' +
      'another; and acc_bill_balance is partitioned by the year the bill ORIGINATED in and is ' +
      'never carried forward, so a sweep pinned to this year walks past almost everything.\n\n' +
      '`billsRegularised` counts bills whose stored figures actually MOVED, so a second run over ' +
      'the same data reports 0 — it used to report the size of the batch, which told an operator ' +
      'nothing. `billsExamined` is beside it so that 0 reads as "nothing left to do" rather than ' +
      'as "nothing ran".',
  })
  @ApiCreatedResponse({ type: RegularisePdcSuccessDto })
  @ApiBadRequestResponse({ type: ReceiptErrorResponseDto })
  async regularise(
    @Body() dto: RegularisePdcDto,
  ): Promise<ReceiptSuccessResponse<RegularisePdcPayload>> {
    const result = await this.recompute.regularisePostDated(
      { companyId: dto.companyId, branchId: dto.branchId, accYear: dto.accYear },
      dto.asOf ? toDateOnly(dto.asOf) : new Date(),
    );
    const data: RegularisePdcPayload = { ...result, companyId: dto.companyId };

    return {
      success: true,
      message: `${data.billsRegularised} of ${data.billsExamined} bill(s) regularised as at ${data.asOf}`,
      data,
    };
  }
}
