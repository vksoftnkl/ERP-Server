import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { TenderDetailService } from '../tenderDetail/tender-detail.service';
import {
  TenderDrCr,
  TenderSrcDocType,
  TenderSrcModule,
  type TenderDocumentScope,
} from '../tenderDetail/types/tender-detail-api.types';
import type { SaveTenderDetailDto } from '../tenderDetail/dto/save-tender-detail.dto';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import {
  allocateVoucherNumber,
  allocateVoucherSlno,
} from '../../../common/Sequence/voucher-sequence.helper';
import {
  DEFAULT_ACTOR,
  resolveActor,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import { OpenItemsService } from './open-items.service';
import { buildDraftLines, rehydrateDraft, type DraftChequeDetail } from './receipt-draft-lines';
import { describeReceiptRoleLedgers, ledgerForRole } from './receipt-ledger-roles';
import {
  normaliseOtherLines,
  normaliseTenders,
  type NormalisedOtherLine,
  type NormalisedTender,
} from './receipt-lines';
import {
  accYearOf,
  assertAccYearWritable,
  assertHeaderScope,
  loadParty,
  loadReceiptVoucherType,
} from './receipt.guards';
import type { ReceiptSettings } from './receipt.settings';
import {
  asEnum,
  money,
  sum,
  toAmount,
  toDateOnly,
  toDateString,
  toIsoString,
  todayUtc,
  trimOrNull,
  ZERO,
} from './receipt.utils';
import { SaveReceiptDto, UpdateReceiptHeaderDto } from './dto/save-receipt.dto';
import { DeleteReceiptDto, GetReceiptQueryDto } from './dto/post-receipt.dto';
import {
  PdcPostingMode,
  ReceiptLedgerRole,
  VOUCHER_STATUSES,
  VoucherStatus,
} from './types/receipt-enum';
import type {
  ReceiptDeletePayload,
  ReceiptDraftPayload,
  ReceiptErrorDetail,
  ReceiptHeader,
  ReceiptOtherLine,
  ReceiptPayload,
  ReceiptTender,
} from './types/receipt-api.types';

/**
 * §5.1, §5.4 and R14 — everything a receipt does that is not posting or
 * cancelling.
 *
 * Posting has a service of its own because it is ONE transaction with fifteen
 * ordered steps, and cancelling has one because it is the mirror of it. What is
 * left here is the draft (which writes no accounting at all), the approval
 * gate, the reads, and the header-only edit of a posted receipt.
 */

/** Every role a POST may need a ledger for, resolved up front on the draft too. */
const RECEIPT_ROLES: readonly string[] = Object.values(ReceiptLedgerRole);

/*
 * §4.6 — there is no list route here. The receipt list is a REGISTERED GRID
 * ('MAIN LIST - RECEIPTS' in fixed.grid_details, added by migration
 * 20260915120000) served by /configured-grid-sql, which is how every other
 * main list in this system works and what makes the operator's saved column
 * widths, filters and visibility apply to it.
 */

/** One save is one transaction over a header, its tenders and its draft lines. */
const RECEIPT_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

@Injectable()
export class ReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly tenderDetailService: TenderDetailService,
    private readonly openItemsService: OpenItemsService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.3 / §5.1 — the DRAFT
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Save a draft. Upsert on `avhVoucherId`.
   *
   * Writes the header (DRAFT, no number), the tender rows with
   * `td_voucher_id` NULL, and the other-ledger lines into `avh_draft_lines`.
   * **Nothing touches a bill and nothing touches `acc_vouchers`** (R10) — a
   * draft is a piece of paper on a desk, and an abandoned one must leave no
   * trace in the books and no gap in the number series.
   */
  async save(dto: SaveReceiptDto): Promise<ReceiptDraftPayload> {
    const actor = resolveActor(dto.avhUserId, this.requestContext.getUserId()) ?? DEFAULT_ACTOR;

    return this.prisma.$transaction(
      (tx) => this.saveInTransaction(tx, dto, actor),
      RECEIPT_TRANSACTION_OPTIONS,
    );
  }

  /**
   * §5.1's body, inside a transaction the CALLER owns.
   *
   * Public for `/receipts/amend` (R20 §2 step 4), which rewrites the header,
   * the tender rows and the draft lines from the new payload and then posts
   * them — all in the ONE transaction that also did the unwind. It calls this
   * rather than reproducing it, so a rule added to the draft (a new
   * normalisation, a new guard) reaches the amended receipt too.
   *
   * There is NO "allow a posted voucher" option here, and there must not be.
   * `isEditableStatus` still admits DRAFT alone, and amend satisfies it
   * honestly: by the time it calls this, its unwind has put the header back to
   * DRAFT. A flag that let a POSTED header through would be the same mistake
   * as folding amend into `/create` — see the 409 below, which is what the
   * screen's every draft save, every retry and every double-submit relies on.
   */
  async saveInTransaction(
    tx: Prisma.TransactionClient,
    dto: SaveReceiptDto,
    actor: string,
  ): Promise<ReceiptDraftPayload> {
    const receiptDate = toDateOnly(dto.avhVoucherDate);
    const replace = dto.replace ?? true;

    // The year on the header and the year the DATE falls in must be the same,
    // or the row lands in a partition that disagrees with the document. The
    // database cannot catch this: both values are individually legal.
    const derivedYear = accYearOf(receiptDate);
    if (derivedYear !== dto.avhAccYear) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: 'avhVoucherDate',
          message: `${dto.avhVoucherDate} falls in ${derivedYear}, but the receipt says ${dto.avhAccYear}`,
        },
      ]);
    }

    {
      await assertAccYearWritable(tx, dto.avhCompanyId, dto.avhAccYear, 'avhAccYear');

      // ONE partyId. cus_id IS led_id and sup_id IS led_id, so a customer, a
      // supplier and a ledger are one identity and there is nothing to resolve.
      const partyId = dto.avhPartyId;
      const [party, voucherType, settings] = await Promise.all([
        loadParty(tx, dto.avhCompanyId, partyId, 'avhPartyId'),
        loadReceiptVoucherType(tx),
        this.openItemsService.loadSettings(dto.avhCompanyId, dto.avhBranchId),
      ]);

      const existing = dto.avhVoucherId
        ? await tx.accVoucherHeader.findUnique({
            where: {
              avhVoucherId_avhAccYear: {
                avhVoucherId: dto.avhVoucherId,
                avhAccYear: dto.avhAccYear,
              },
            },
            select: {
              avhVoucherId: true,
              avhVoucherStatus: true,
              avhIsDeleted: true,
              avhVoucherRefno: true,
            },
          })
        : null;

      if (dto.avhVoucherId && !existing) {
        throwAccountsNotFound<ReceiptErrorDetail>(
          'Receipt not found',
          'avhVoucherId',
          `No receipt ${dto.avhVoucherId} in ${dto.avhAccYear}`,
        );
      }
      if (
        existing &&
        (existing.avhIsDeleted || !this.isEditableStatus(existing.avhVoucherStatus))
      ) {
        // R3 — money on a POSTED receipt is changed by cancel and re-enter. An
        // in-place edit would have to unwind allocations, cheques and advance
        // bills, and the day it half-succeeds there is no way back.
        throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be edited', [
          {
            field: 'avhVoucherId',
            message:
              `${existing.avhVoucherRefno ?? dto.avhVoucherId} is ${existing.avhVoucherStatus}. ` +
              'Only a DRAFT may be edited here; use /receipts/update-header for narration, or ' +
              'cancel and re-enter to change the money.',
          },
        ]);
      }

      const tenders = await normaliseTenders(tx, {
        tenders: dto.tenders,
        companyId: dto.avhCompanyId,
        branchId: dto.avhBranchId,
        receiptDate,
      });

      // Every date the receipt will eventually post into must be writable, and
      // a post-dated cheque may cross a year end (§5.2 step 2). Checked on the
      // DRAFT too: discovering it at post is discovering it after the money has
      // been counted.
      await this.assertInstrumentYearsWritable(tx, dto.avhCompanyId, tenders);

      const roleLedgers = await describeReceiptRoleLedgers(tx, RECEIPT_ROLES, {
        companyId: dto.avhCompanyId,
        branchId: dto.avhBranchId,
      });

      const { lines, expected } = await normaliseOtherLines(tx, {
        lines: dto.otherLines ?? [],
        tenders,
        companyId: dto.avhCompanyId,
        branchId: dto.avhBranchId,
        party,
        partyId,
        settings,
        ledgerForRole: (role) => {
          const resolved = ledgerForRole(roleLedgers, role);
          return resolved ? { ledgerId: resolved.ledgerId, ledgerName: resolved.ledgerName } : null;
        },
      });

      this.assertSalesman(dto.avhEmployeeId, settings);

      // §5.1 rule 5 — derived, never accepted. §12: "no stamped totals".
      const docAmount = sum(tenders.map((tender) => tender.amount));

      const header = await this.upsertDraftHeader(tx, {
        dto,
        existingId: existing?.avhVoucherId ?? null,
        voucherTypeId: voucherType.vchrTypeId,
        partyId,
        receiptDate,
        docAmount,
        draftLines: lines,
        cheques: chequeDetailByRow(tenders),
        actor,
      });

      await this.syncTenders(tx, {
        dto,
        voucherId: header.avhVoucherId,
        partyId,
        receiptDate,
        tenders,
        actor,
        replace,
      });

      if (!existing) {
        await appendTxnStatusLog(tx, {
          companyId: dto.avhCompanyId,
          branchId: dto.avhBranchId,
          tenantId: dto.avhTenantId ?? null,
          accYear: dto.avhAccYear,
          srcModule: TxnStatusSrcModule.ACCOUNTS,
          srcDocType: TxnStatusDocType.RECEIPT,
          srcDocId: header.avhVoucherId,
          event: TxnStatusEvent.CREATED,
          toStatus: VoucherStatus.DRAFT,
          changedBy: actor,
          deviceId: dto.avhDeviceId ?? null,
          sessionId: dto.avhSessionId ?? null,
        });
      }

      const stored = await this.loadHeaderOrThrow(tx, header.avhVoucherId, dto.avhAccYear);
      return {
        header: await this.toHeaderPayload(tx, stored),
        tenders: await this.loadTenderPayload(tx, header.avhVoucherId),
        otherLines: lines.map(toOtherLinePayload),
        expectedRoles: expected.missing,
      };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.5 — get
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The whole receipt: header, tenders, legs, allocations, credits, cheques,
   * the PDC vouchers and the advance bills.
   *
   * A POSTED receipt paints read-only from this, and it is also the dataset a
   * print template reads (the `RECEIPT_VOUCHER` purpose is already seeded in
   * `public.print_purpose`).
   */
  async get(query: GetReceiptQueryDto): Promise<ReceiptPayload> {
    const header = await this.loadHeaderOrThrow(this.prisma, query.avhVoucherId, query.avhAccYear);
    assertHeaderScope(header, {
      companyId: query.avhCompanyId,
      branchId: query.avhBranchId,
      accYear: query.avhAccYear,
      voucherId: query.avhVoucherId,
    });
    return this.loadFullReceipt(this.prisma, header);
  }

  /** Shared with the posting and cancelling services, so one shape is returned. */
  async loadFullReceipt(
    client: Prisma.TransactionClient | PrismaService,
    header: StoredHeader,
  ): Promise<ReceiptPayload> {
    const pdcHeaders = await client.accVoucherHeader.findMany({
      where: {
        avhAgainstVoucherId: header.avhVoucherId,
        avhIsDeleted: false,
      },
      select: STORED_HEADER_SELECT,
      orderBy: { avhVoucherDate: 'asc' },
    });

    const voucherIds = [header.avhVoucherId, ...pdcHeaders.map((row) => row.avhVoucherId)];
    const years = [...new Set([header.avhAccYear, ...pdcHeaders.map((row) => row.avhAccYear)])];

    const [legs, adjustments, cheques, advanceBills] = await Promise.all([
      client.accVoucher.findMany({
        where: { avVoucherId: { in: voucherIds }, avAccYear: { in: years }, avIsDeleted: false },
        select: {
          avId: true,
          avVoucherId: true,
          avRowNo: true,
          avDrCr: true,
          avLedgerId: true,
          avAmount: true,
          avRole: true,
          avRemarks: true,
          ledger: { select: { ledName: true } },
        },
        orderBy: [{ avVoucherId: 'asc' }, { avRowNo: 'asc' }],
      }),
      client.accBillAdjustment.findMany({
        where: {
          abjVoucherId: { in: voucherIds },
          abjVoucherAccYear: { in: years },
          abjIsDeleted: false,
        },
        select: {
          abjId: true,
          abjBillId: true,
          abjBillAccYear: true,
          abjAdjType: true,
          abjSettlementMode: true,
          abjDrCr: true,
          abjAmount: true,
          abjAdjDate: true,
          abjIsPostDated: true,
          abjVoucherId: true,
          abjChequeId: true,
          abjAgainstBillId: true,
          abjApprovedBy: true,
          abjRemarks: true,
          bill: { select: { ablDocRefno: true, ablDocDate: true, ablBillType: true } },
          againstBill: { select: { ablDocRefno: true } },
        },
        orderBy: [{ abjAdjDate: 'asc' }, { abjRowNo: 'asc' }],
      }),
      client.accPdcRegister.findMany({
        where: {
          apdVoucherId: { in: voucherIds },
          apdIsDeleted: false,
        },
        select: {
          apdId: true,
          apdAccYear: true,
          apdInstrumentType: true,
          apdInstrumentNo: true,
          apdInstrumentDate: true,
          apdAmount: true,
          apdBankName: true,
          apdBankBranch: true,
          apdIfsc: true,
          apdDrawerName: true,
          apdBankLedgerId: true,
          apdStatus: true,
          apdPostingMode: true,
          apdVoucherId: true,
          apdTenderId: true,
        },
        orderBy: { apdInstrumentDate: 'asc' },
      }),
      client.accBillBalance.findMany({
        where: {
          ablVoucherId: { in: voucherIds },
          ablAccYear: { in: years },
          ablBillType: 'ADVANCE',
          ablIsDeleted: false,
        },
        select: {
          ablId: true,
          ablAccYear: true,
          ablDocRefno: true,
          ablDocDate: true,
          ablBillAmount: true,
          ablPendingAmount: true,
          ablVoucherId: true,
        },
      }),
    ]);

    const today = todayUtc();
    const legsFor = (voucherId: string) =>
      legs
        .filter((leg) => leg.avVoucherId === voucherId)
        .map((leg) => ({
          avId: leg.avId,
          avRowNo: leg.avRowNo,
          avDrCr: leg.avDrCr as ReceiptPayload['legs'][number]['avDrCr'],
          avLedgerId: leg.avLedgerId,
          avLedgerName: leg.ledger?.ledName ?? null,
          avAmount: toAmount(leg.avAmount),
          avRole: leg.avRole,
          avRemarks: leg.avRemarks,
        }));

    const toAllocation = (row: (typeof adjustments)[number]) => ({
      abjId: row.abjId,
      billId: row.abjBillId,
      billAccYear: row.abjBillAccYear,
      docRefno: row.bill?.ablDocRefno ?? '',
      docDate: toDateString(row.bill?.ablDocDate ?? null) ?? '',
      adjType: row.abjAdjType as ReceiptPayload['allocations'][number]['adjType'],
      settlementMode:
        row.abjSettlementMode as ReceiptPayload['allocations'][number]['settlementMode'],
      drCr: row.abjDrCr as ReceiptPayload['allocations'][number]['drCr'],
      amount: toAmount(row.abjAmount),
      adjDate: toDateString(row.abjAdjDate)!,
      isPostDated: row.abjIsPostDated,
      // The one derived field on this payload, and the one the screen needs:
      // a post-dated row whose date has arrived is now counting against the
      // bill, and one whose date has not is a promise.
      matured: !row.abjIsPostDated || row.abjAdjDate <= today,
      voucherId: row.abjVoucherId,
      chequeId: row.abjChequeId,
      againstBillId: row.abjAgainstBillId,
      againstBillRefno: row.againstBill?.ablDocRefno ?? null,
      approvedBy: row.abjApprovedBy,
      remarks: row.abjRemarks,
    });

    const tenderRowByPdc = new Map<string, number | null>();
    const tenderRows = await client.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      select: { tdId: true, tdRowNo: true },
    });
    const rowNoByTenderId = new Map(tenderRows.map((row) => [row.tdId, row.tdRowNo]));
    for (const cheque of cheques) {
      tenderRowByPdc.set(
        cheque.apdId,
        cheque.apdTenderId ? (rowNoByTenderId.get(cheque.apdTenderId) ?? null) : null,
      );
    }

    return {
      header: await this.toHeaderPayload(client, header),
      tenders: await this.loadTenderPayload(client, header.avhVoucherId),
      otherLines: rehydrateDraft(header.avhDraftLines).otherLines,
      legs: legsFor(header.avhVoucherId),
      // A credit pair's rows are exactly the ones naming an opposite bill, so
      // the split is a property of the data and not a flag anybody has to set.
      allocations: adjustments.filter((row) => row.abjAgainstBillId === null).map(toAllocation),
      creditsApplied: adjustments.filter((row) => row.abjAgainstBillId !== null).map(toAllocation),
      cheques: cheques.map((cheque) => ({
        pdcId: cheque.apdId,
        accYear: cheque.apdAccYear,
        tenderRowNo: tenderRowByPdc.get(cheque.apdId) ?? null,
        instrumentType: cheque.apdInstrumentType,
        instrumentNo: cheque.apdInstrumentNo,
        instrumentDate: toDateString(cheque.apdInstrumentDate)!,
        amount: toAmount(cheque.apdAmount),
        bankName: cheque.apdBankName,
        bankBranch: cheque.apdBankBranch,
        ifsc: cheque.apdIfsc,
        drawerName: cheque.apdDrawerName,
        bankLedgerId: cheque.apdBankLedgerId,
        status: cheque.apdStatus as ReceiptPayload['cheques'][number]['status'],
        postingMode: cheque.apdPostingMode,
        voucherId: cheque.apdVoucherId,
      })),
      pdcVouchers: pdcHeaders.map((pdc) => ({
        voucherId: pdc.avhVoucherId,
        accYear: pdc.avhAccYear,
        voucherRefno: pdc.avhVoucherRefno,
        voucherDate: toDateString(pdc.avhVoucherDate)!,
        docAmount: toAmount(pdc.avhDocAmount),
        adjustAmount: toAmount(pdc.avhAdjustAmount),
        status: pdc.avhVoucherStatus as VoucherStatus,
        legs: legsFor(pdc.avhVoucherId),
      })),
      advanceBills: advanceBills.map((bill) => ({
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        docRefno: bill.ablDocRefno,
        docDate: toDateString(bill.ablDocDate)!,
        billAmount: toAmount(bill.ablBillAmount),
        pendingAmount: toAmount(bill.ablPendingAmount),
        voucherId: bill.ablVoucherId,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.7 / §5.4 — the header-only edit
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The four fields a POSTED receipt may still change: narration, the two
   * reference numbers, the document date and the salesman.
   *
   * Everything else is refused, and a body carrying it is a 400 rather than a
   * silent ignore (§5.4). A client that believes it changed the money must be
   * told that it did not — the alternative is an operator who "corrected" a
   * receipt and walks away believing the books moved.
   */
  async updateHeader(
    dto: UpdateReceiptHeaderDto,
    body: Record<string, unknown>,
  ): Promise<ReceiptHeader> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    const allowed = new Set([
      'avhVoucherId',
      'avhCompanyId',
      'avhBranchId',
      'avhAccYear',
      'avhRemarks',
      'avhUsrRefno',
      'avhDocRefno',
      'avhDocDate',
      'avhEmployeeId',
      'editRemark',
    ]);
    const rejected = Object.keys(body).filter((key) => !allowed.has(key));
    if (rejected.length > 0) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Only the header may be edited', [
        {
          field: rejected[0],
          message:
            `${rejected.join(', ')} cannot be changed on a posted receipt. Money is changed by ` +
            'cancelling and re-entering (R3).',
        },
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      const header = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
      assertHeaderScope(header, {
        companyId: dto.avhCompanyId,
        branchId: dto.avhBranchId,
        accYear: dto.avhAccYear,
        voucherId: dto.avhVoucherId,
      });
      if (statusOf(header) === VoucherStatus.CANCELLED) {
        throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be edited', [
          { field: 'avhVoucherId', message: 'A cancelled receipt is closed to edits' },
        ]);
      }
      await assertAccYearWritable(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');

      const now = new Date();
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: dto.avhVoucherId,
            avhAccYear: dto.avhAccYear,
          },
        },
        data: {
          ...(has(body, 'avhRemarks') ? { avhRemarks: trimOrNull(dto.avhRemarks) } : {}),
          ...(has(body, 'avhUsrRefno') ? { avhUsrRefno: trimOrNull(dto.avhUsrRefno) } : {}),
          ...(has(body, 'avhDocRefno') ? { avhDocRefno: trimOrNull(dto.avhDocRefno) } : {}),
          ...(has(body, 'avhDocDate')
            ? { avhDocDate: dto.avhDocDate ? toDateOnly(dto.avhDocDate) : null }
            : {}),
          ...(has(body, 'avhEmployeeId') ? { avhEmployeeId: dto.avhEmployeeId ?? [] } : {}),
          avhModifiedOn: now,
          avhModifiedBy: actor,
        },
      });

      await appendTxnStatusLog(tx, {
        companyId: header.avhCompanyId,
        branchId: header.avhBranchId,
        tenantId: header.avhTenantId,
        accYear: header.avhAccYear,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: TxnStatusDocType.RECEIPT,
        srcDocId: header.avhVoucherId,
        srcDocRefno: header.avhVoucherRefno,
        event: TxnStatusEvent.STATUS_CHANGED,
        fromStatus: header.avhVoucherStatus,
        toStatus: header.avhVoucherStatus,
        changedBy: actor,
        changedOn: now,
        remarks: dto.editRemark,
      });

      const updated = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
      return this.toHeaderPayload(tx, updated);
    }, RECEIPT_TRANSACTION_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  DELETE — throw a DRAFT away
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Soft-delete a DRAFT receipt: the header, its tender rows and the
   * other-ledger lines sitting in `avh_draft_lines`, in one transaction.
   *
   * ── Why this route exists at all ─────────────────────────────────────────
   * `/cancel` refuses a DRAFT, and it is right to: a draft has no legs to
   * mirror, no adjustment rows to negate and no number to keep, so there is
   * literally nothing to reverse. But nothing was built to take its place,
   * which made an abandoned draft PERMANENT — it sat in the list for ever,
   * and the only way past it was to post a receipt nobody wanted.
   *
   * ── Why DRAFT and nothing else ───────────────────────────────────────────
   * The status check is the whole safety of this route. A DRAFT wrote no
   * accounting (R10): no `acc_vouchers` legs, no `acc_bill_adjustment` rows,
   * no `acc_pdc_register` entry — `receipt-draft-lines.ts` says why the
   * register row in particular waits for the post — and no number. So nothing
   * it leaves behind has to be answered for, and the row can simply go out of
   * play.
   *
   * A POSTED receipt is the opposite of all of that and is CANCELLED, which
   * writes a reversal voucher the day book can show. A CANCELLED one has
   * already been answered for. Both are a 409 here, naming the route that does
   * apply, rather than a silent no-op.
   *
   * ── Soft, not hard ───────────────────────────────────────────────────────
   * `avh_is_deleted`, never a `DELETE`. Two reasons beyond the usual one:
   *
   *   · `TxnStatusEvent.DELETED` files a row in `txn_status_log` pointing at
   *     `avh_voucher_id`, and a trail pointing at a row that no longer exists
   *     is not a trail.
   *   · "Who threw away the 40,000 receipt I keyed this morning" is a question
   *     that gets asked, and `avh_modified_by` is the only thing that answers
   *     it.
   *
   * The status column is left at DRAFT on purpose. `DELETED` is an EVENT here,
   * not a status — `avh_voucher_status` has no such value, and stamping
   * CANCELLED instead would put a receipt that was never posted into the
   * cancelled list beside receipts that were, with no reason against it and
   * `ck_avh_cancel` rightly refusing the write.
   *
   * `avh_draft_lines` is deliberately left INTACT rather than nulled. The
   * other-ledger lines and cheque details are the deleted draft's contents;
   * a "soft" delete that destroys them is a hard delete that kept the key. The
   * header's `avh_is_deleted` already takes them out of play — every reader in
   * this module goes through `loadHeaderOrThrow`, which refuses a deleted row.
   */
  async deleteDraft(dto: DeleteReceiptDto): Promise<ReceiptDeletePayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;

    return this.prisma.$transaction(async (tx) => {
      // The same lock /post and /cancel take, and for the same reason: without
      // it a delete and a post racing on one draft both read DRAFT, and the
      // post writes legs against a header the delete is about to retire.
      await tx.$queryRaw`
        SELECT avh_voucher_id
          FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid
           AND avh_acc_year   = ${dto.avhAccYear}::bpchar
           FOR UPDATE`;

      const header = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
      assertHeaderScope(header, {
        companyId: dto.avhCompanyId,
        branchId: dto.avhBranchId,
        accYear: dto.avhAccYear,
        voucherId: dto.avhVoucherId,
      });

      const status = statusOf(header);
      if (status !== VoucherStatus.DRAFT) {
        throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be deleted', [
          {
            field: 'avhVoucherId',
            message:
              `${header.avhVoucherRefno ?? dto.avhVoucherId} is ${header.avhVoucherStatus}. ` +
              (status === VoucherStatus.POSTED
                ? 'A posted receipt is money in the books — cancel it, which reverses it and ' +
                  'leaves the trail. Only a DRAFT is deleted.'
                : 'It has already been cancelled, and its reversal is what the books stand on. ' +
                  'Only a DRAFT is deleted.'),
          },
        ]);
      }
      if (header.avhAgainstVoucherId) {
        // Can only happen if something has gone wrong: a post-dated cheque's
        // voucher is written POSTED by /post and never exists as a draft. Say
        // so rather than quietly retiring half of a posted receipt.
        throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be deleted', [
          {
            field: 'avhVoucherId',
            message:
              'This is a post-dated cheque voucher, not a receipt. It belongs to the receipt ' +
              `${header.avhAgainstVoucherId} and leaves play only when that one is cancelled.`,
          },
        ]);
      }
      await assertAccYearWritable(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');

      // R10 says a draft writes no accounting. If it somehow has, deleting the
      // header would orphan legs and adjustment rows that nothing can then find
      // — so refuse and say what was found, instead of making it worse.
      await this.assertDraftWroteNoAccounting(tx, header);

      const now = new Date();
      const otherLinesDeleted = rehydrateDraft(header.avhDraftLines).otherLines.length;

      const tenders = await tx.accTenderDetail.updateMany({
        where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
        data: { tdIsDeleted: true, tdModifiedOn: now, tdModifiedBy: actor },
      });

      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: header.avhVoucherId,
            avhAccYear: header.avhAccYear,
          },
        },
        data: {
          avhIsDeleted: true,
          avhIsActive: false,
          // avh_voucher_status stays DRAFT. See the note above: DELETED is an
          // event, not a status this column has a value for.
          avhModifiedOn: now,
          avhModifiedBy: actor,
        },
      });

      await appendTxnStatusLog(tx, {
        companyId: header.avhCompanyId,
        branchId: header.avhBranchId,
        tenantId: header.avhTenantId,
        accYear: header.avhAccYear,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: TxnStatusDocType.RECEIPT,
        srcDocId: header.avhVoucherId,
        srcDocRefno: header.avhVoucherRefno,
        event: TxnStatusEvent.DELETED,
        fromStatus: header.avhVoucherStatus,
        toStatus: header.avhVoucherStatus,
        changedBy: actor,
        changedOn: now,
      });

      return {
        avhVoucherId: header.avhVoucherId,
        avhAccYear: header.avhAccYear,
        avhVoucherRefno: header.avhVoucherRefno,
        status,
        deletedOn: toIsoString(now)!,
        deletedBy: actor,
        tendersDeleted: tenders.count,
        otherLinesDeleted,
      };
    }, RECEIPT_TRANSACTION_OPTIONS);
  }

  /**
   * A DRAFT must have written nothing into the books (R10). This is the check
   * that the delete is safe to do at all.
   *
   * It is not defensive padding: `avh_voucher_status` is the only thing
   * separating "a piece of paper on a desk" from "money in the day book", and
   * if the two ever came apart — a post that failed between writing legs and
   * flipping the status, a row edited by hand — the delete would hide legs that
   * `acc_vouchers` still holds and adjustment rows that bills are still netting
   * against. Refusing with counts is recoverable; deleting is not.
   */
  private async assertDraftWroteNoAccounting(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
  ): Promise<void> {
    const [legs, adjustments] = await Promise.all([
      tx.accVoucher.count({
        where: {
          avVoucherId: header.avhVoucherId,
          avAccYear: header.avhAccYear,
          avIsDeleted: false,
        },
      }),
      tx.accBillAdjustment.count({
        where: {
          abjVoucherId: header.avhVoucherId,
          abjVoucherAccYear: header.avhAccYear,
          abjIsDeleted: false,
        },
      }),
    ]);

    if (legs > 0 || adjustments > 0) {
      throwAccountsConflict<ReceiptErrorDetail>('Receipt cannot be deleted', [
        {
          field: 'avhVoucherId',
          message:
            `This draft has ${legs} voucher leg(s) and ${adjustments} bill adjustment row(s) ` +
            'against it, which a draft cannot have (R10). Deleting it would orphan them. It has ' +
            'most likely been posted without its status following — have the voucher looked at ' +
            'before it is removed.',
        },
      ]);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Shared internals — used by the posting and cancelling services too
  // ═════════════════════════════════════════════════════════════════════════

  async loadHeaderOrThrow(
    client: Prisma.TransactionClient | PrismaService,
    voucherId: string,
    accYear: string,
  ): Promise<StoredHeader> {
    const header = await client.accVoucherHeader.findUnique({
      where: { avhVoucherId_avhAccYear: { avhVoucherId: voucherId, avhAccYear: accYear } },
      select: STORED_HEADER_SELECT,
    });

    if (!header || header.avhIsDeleted) {
      throwAccountsNotFound<ReceiptErrorDetail>(
        'Receipt not found',
        'avhVoucherId',
        `No receipt ${voucherId} in ${accYear}`,
      );
    }
    return header;
  }

  /**
   * The number, allocated through the SAME allocator `/bills/create` uses.
   *
   * Two counters, because they count different things: `avh_voucher_no` runs
   * per voucher TYPE and is what gets printed, `avh_voucher_slno` runs across
   * every type in the company-year. Both are taken under advisory locks held
   * for the rest of the transaction, so a rollback gives both numbers back and
   * the series has no gap.
   */
  async allocateNumber(
    tx: Prisma.TransactionClient,
    scope: {
      companyId: string;
      branchId: string;
      accYear: string;
      voucherTypeId: number;
      voucherDate: Date;
    },
  ): Promise<{ voucherNo: bigint; voucherSlno: bigint; voucherRefno: string }> {
    const allocated = await allocateVoucherNumber(tx, {
      vchrTypeId: scope.voucherTypeId,
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      documentDate: scope.voucherDate,
    });
    const slno = await allocateVoucherSlno(tx, scope.companyId, scope.accYear);

    return {
      voucherNo: allocated.lastNo,
      voucherSlno: slno,
      voucherRefno: allocated.refno,
    };
  }

  /**
   * Everything the post checks that does not need a row lock — so the approver
   * cannot sign a receipt that will then refuse to post.
   */
  async assertPostable(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    settings: ReceiptSettings,
  ): Promise<void> {
    if (settings.pdcPostingMode !== PdcPostingMode.ON_RECEIPT) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Posting mode is not supported', [
        {
          field: 'accounts.pdc_posting_mode',
          message:
            'accounts.pdc_posting_mode is ON_CLEARING, which moves allocation into the Received ' +
            'Cheques screen — not built yet. Set it to ON_RECEIPT to post receipts.',
        },
      ]);
    }
    this.assertSalesman(header.avhEmployeeId, settings);

    const tenders = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      select: { tdIsPdc: true, tdInstrumentDate: true, tdAmount: true },
    });
    if (tenders.length === 0) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: 'tenders',
          message: 'A receipt with no instruments is a journal, not a receipt',
        },
      ]);
    }
    for (const tender of tenders) {
      if (!tender.tdIsPdc || !tender.tdInstrumentDate) {
        continue;
      }
      const year = accYearOf(tender.tdInstrumentDate);
      await assertAccYearWritable(tx, header.avhCompanyId, year, 'tenders.tdInstrumentDate');
    }
  }

  /** R6 — one salesman, and mandatory when the setting says so. */
  private assertSalesman(employeeIds: string[] | undefined, settings: ReceiptSettings): void {
    const ids = employeeIds ?? [];
    if (ids.length > 1) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: 'avhEmployeeId',
          message:
            'A receipt is collected by ONE person. The column is an array because every voucher ' +
            "header's is, not because a collection may be shared.",
        },
      ]);
    }
    if (settings.salesmanMandatory && ids.length === 0) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: 'avhEmployeeId',
          message:
            'accounts.receipt_salesman_mandatory is on — a receipt must say who collected it',
        },
      ]);
    }
  }

  private isEditableStatus(status: string): boolean {
    // APPROVED is deliberately NOT editable: it has been signed, and editing it
    // would leave the approver's signature on a document they did not see. It
    // is rejected back to DRAFT first.
    return asEnum(status, VOUCHER_STATUSES, VoucherStatus.CANCELLED) === VoucherStatus.DRAFT;
  }

  private async assertInstrumentYearsWritable(
    tx: Prisma.TransactionClient,
    companyId: string,
    tenders: readonly NormalisedTender[],
  ): Promise<void> {
    const years = new Set<string>();
    for (const tender of tenders) {
      if (tender.isPdc && tender.instrumentDate) {
        years.add(accYearOf(tender.instrumentDate));
      }
    }
    for (const year of years) {
      await assertAccYearWritable(tx, companyId, year, 'tenders.tdInstrumentDate');
    }
  }

  private async upsertDraftHeader(
    tx: Prisma.TransactionClient,
    params: {
      dto: SaveReceiptDto;
      existingId: string | null;
      voucherTypeId: number;
      partyId: string;
      receiptDate: Date;
      docAmount: Prisma.Decimal;
      draftLines: readonly NormalisedOtherLine[];
      cheques: Record<number, DraftChequeDetail | null>;
      actor: string;
    },
  ): Promise<{ avhVoucherId: string }> {
    const { dto } = params;
    const now = new Date();
    const common = {
      avhCompanyId: dto.avhCompanyId,
      avhBranchId: dto.avhBranchId,
      avhTenantId: dto.avhTenantId ?? null,
      avhVoucherTypeId: params.voucherTypeId,
      avhVoucherDate: params.receiptDate,
      avhPartyId: params.partyId,
      // avh_src_* stays EMPTY on a keyed receipt, and the customer does NOT go
      // in it. ux_avh_src is UNIQUE on (company, src_module, src_doc_type,
      // src_doc_id, acc_year) for every non-cancelled row — it exists to make
      // posting a source document idempotent — so filing the customer there
      // would permit exactly ONE receipt per customer per year and refuse the
      // second as a duplicate.
      //
      // Nothing is lost: sales.customers.cus_ledger_id is UNIQUE, so the
      // customer is a keyed lookup from avh_party_id whenever the payload wants
      // it (see resolveCustomerRef). The columns are left for the collection
      // import (avh_src_doc_type = 'COLLECTION'), which is what they are for.
      avhSrcModule: null,
      avhSrcDocType: null,
      avhSrcDocId: null,
      avhUsrRefno: trimOrNull(dto.avhUsrRefno),
      avhDocRefno: trimOrNull(dto.avhDocRefno),
      avhDocDate: dto.avhDocDate ? toDateOnly(dto.avhDocDate) : null,
      avhDocAmount: params.docAmount,
      avhEmployeeId: dto.avhEmployeeId ?? [],
      avhRemarks: trimOrNull(dto.avhRemarks),
      avhDeviceType: dto.avhDeviceType ?? null,
      avhDeviceId: trimOrNull(dto.avhDeviceId),
      avhSessionId: dto.avhSessionId ?? null,
      avhUserId: params.actor,
      avhDraftLines: buildDraftLines(params.draftLines.map(toOtherLinePayload), params.cheques),
    };

    if (params.existingId) {
      const updated = await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: params.existingId,
            avhAccYear: dto.avhAccYear,
          },
        },
        data: { ...common, avhModifiedOn: now, avhModifiedBy: params.actor },
        select: { avhVoucherId: true },
      });
      return updated;
    }

    const created = await tx.accVoucherHeader.create({
      data: {
        ...common,
        ...(dto.avhVoucherId ? { avhVoucherId: dto.avhVoucherId } : {}),
        avhAccYear: dto.avhAccYear,
        // No number. ck_avh_no permits this only on a DRAFT, which is the
        // constraint saying what R10 says: an abandoned draft must leave no gap
        // in the series.
        avhVoucherStatus: VoucherStatus.DRAFT,
        avhCreatedOn: now,
        avhCreatedBy: params.actor,
      },
      select: { avhVoucherId: true },
    });
    return created;
  }

  private async syncTenders(
    tx: Prisma.TransactionClient,
    params: {
      dto: SaveReceiptDto;
      voucherId: string;
      partyId: string;
      receiptDate: Date;
      tenders: readonly NormalisedTender[];
      actor: string;
      replace: boolean;
    },
  ): Promise<void> {
    const scope: TenderDocumentScope = {
      tdSrcModule: TenderSrcModule.ACCOUNTS,
      tdSrcDocType: TenderSrcDocType.RECEIPT,
      tdSrcDocId: params.voucherId,
      tdCompanyId: params.dto.avhCompanyId,
      tdBranchId: params.dto.avhBranchId,
      tdTenantId: params.dto.avhTenantId ?? null,
      tdAccYear: params.dto.avhAccYear,
      tdDocDate: params.receiptDate,
      tdPartyLedgerId: params.partyId,
      tdUserId: params.actor,
      tdSessionId: params.dto.avhSessionId ?? null,
      tdDeviceId: params.dto.avhDeviceId ?? null,
      // Money IN. The payment voucher (menu 100, next plan) is the same module
      // with this one flag flipped.
      tdDrCr: TenderDrCr.DR,
    };

    const rows: SaveTenderDetailDto[] = params.tenders.map((tender) => ({
      ...(tender.tdId ? { tdId: tender.tdId } : {}),
      tdRowNo: tender.rowNo,
      tdTenderId: tender.tenderId,
      tdTenderTypeId: tender.tenderTypeId,
      tdTenderLedgerId: tender.tenderLedgerId,
      tdSurchargeLedgerId: tender.surchargeLedgerId,
      tdAmount: tender.amount.toFixed(2),
      tdSurchargePerc: tender.surchargePerc.toFixed(3),
      tdSurchargeAmt: tender.surchargeAmt.toFixed(2),
      tdReceivedAmt: tender.receivedAmt.toFixed(2),
      tdChangeAmt: tender.changeAmt.toFixed(2),
      tdMdrAmt: tender.mdrAmt.toFixed(2),
      tdRefNo: tender.refNo,
      tdAuthCode: tender.authCode,
      tdCardLast4: tender.cardLast4,
      tdBankName: tender.bankName,
      tdPayerVpa: tender.payerVpa,
      tdInstrumentDate: toDateString(tender.instrumentDate),
      tdIsPdc: tender.isPdc,
      // The clearing ledger, when the master has one — where a card collection
      // waits until the acquirer settles it.
      tdSettleLedgerId: tender.clearingLedgerId,
      tdNotes: tender.notes,
      // NULL until post. §5.2 step 12 fills it with the voucher carrying this
      // instrument, which for a post-dated cheque is not the receipt.
      tdVoucherId: null,
    })) as SaveTenderDetailDto[];

    // syncDocumentTenders has ONE mode: the array it is given IS the document,
    // and a stored row the array leaves out is soft deleted. `replace: false`
    // is therefore implemented by putting the untouched rows back in — each as
    // a bare { tdId, tdRowNo }, which updates nothing but keeps the row alive —
    // rather than by a second code path that would have to reproduce the
    // guards and the audit trail.
    const merged = params.replace ? rows : await this.keepUnmentioned(tx, scope, rows);

    await this.tenderDetailService.syncDocumentTenders(tx, scope, merged, params.actor, {
      tableName: 'receipt tender',
      screenName: 'Receipt',
      entityName: 'Receipt tender',
    });
  }

  private async keepUnmentioned(
    tx: Prisma.TransactionClient,
    scope: TenderDocumentScope,
    rows: readonly SaveTenderDetailDto[],
  ): Promise<SaveTenderDetailDto[]> {
    const stored = await this.tenderDetailService.findDocumentTenders(
      tx,
      scope.tdSrcModule,
      scope.tdSrcDocType,
      scope.tdSrcDocId,
    );
    const mentioned = new Set(rows.map((row) => row.tdId).filter(Boolean) as string[]);
    const mentionedRowNos = new Set(rows.map((row) => row.tdRowNo));

    const kept = stored
      .filter((row) => !mentioned.has(row.tdId) && !mentionedRowNos.has(row.tdRowNo))
      .map((row) => ({ tdId: row.tdId, tdRowNo: row.tdRowNo }) as SaveTenderDetailDto);

    return [...kept, ...rows].sort((left, right) => (left.tdRowNo ?? 0) - (right.tdRowNo ?? 0));
  }

  async loadTenderPayload(
    client: Prisma.TransactionClient | PrismaService,
    voucherId: string,
  ): Promise<ReceiptTender[]> {
    const rows = await client.accTenderDetail.findMany({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      select: {
        tdId: true,
        tdRowNo: true,
        tdTenderId: true,
        tdTenderTypeId: true,
        tdTenderLedgerId: true,
        tdAmount: true,
        tdSurchargePerc: true,
        tdSurchargeAmt: true,
        tdMdrAmt: true,
        tdReceivedAmt: true,
        tdChangeAmt: true,
        tdRefNo: true,
        tdBankName: true,
        tdPayerVpa: true,
        tdInstrumentDate: true,
        tdIsPdc: true,
        tdVoucherId: true,
        tender: { select: { tndName: true } },
      },
      orderBy: { tdRowNo: 'asc' },
    });

    return rows.map((row) => ({
      tdId: row.tdId,
      tdRowNo: row.tdRowNo,
      tdTenderId: row.tdTenderId,
      tdTenderName: row.tender?.tndName ?? null,
      tdTenderTypeId: row.tdTenderTypeId,
      tdTenderLedgerId: row.tdTenderLedgerId,
      tdAmount: toAmount(row.tdAmount),
      tdSurchargePerc: toAmount(row.tdSurchargePerc),
      tdSurchargeAmt: toAmount(row.tdSurchargeAmt),
      tdMdrAmt: toAmount(row.tdMdrAmt),
      tdReceivedAmt: toAmount(row.tdReceivedAmt),
      tdChangeAmt: toAmount(row.tdChangeAmt),
      tdRefNo: row.tdRefNo,
      tdBankName: row.tdBankName,
      tdPayerVpa: row.tdPayerVpa,
      tdInstrumentDate: toDateString(row.tdInstrumentDate),
      tdIsPdc: row.tdIsPdc,
      tdVoucherId: row.tdVoucherId,
    }));
  }

  async toHeaderPayload(
    client: Prisma.TransactionClient | PrismaService,
    header: StoredHeader,
  ): Promise<ReceiptHeader> {
    const party = await client.accLedgerMaster.findUnique({
      where: { ledId: header.avhPartyId },
      select: { ledName: true },
    });

    return {
      avhVoucherId: header.avhVoucherId,
      avhCompanyId: header.avhCompanyId,
      avhBranchId: header.avhBranchId,
      avhTenantId: header.avhTenantId,
      avhAccYear: header.avhAccYear,
      avhVoucherTypeId: header.avhVoucherTypeId,
      // BigInt does not survive JSON.stringify, so both counters cross the wire
      // as strings — the same way the tender master carries tndTypeId.
      avhVoucherNo: header.avhVoucherNo === null ? null : header.avhVoucherNo.toString(),
      avhVoucherSlno: header.avhVoucherSlno === null ? null : header.avhVoucherSlno.toString(),
      avhVoucherRefno: header.avhVoucherRefno,
      avhVoucherDate: toDateString(header.avhVoucherDate)!,
      avhPartyId: header.avhPartyId,
      avhPartyName: party?.ledName ?? null,
      avhEmployeeId: header.avhEmployeeId,
      avhUsrRefno: header.avhUsrRefno,
      avhDocRefno: header.avhDocRefno,
      avhDocDate: toDateString(header.avhDocDate),
      avhDocAmount: toAmount(header.avhDocAmount),
      avhAdjustAmount: toAmount(header.avhAdjustAmount),
      avhRoundOff: toAmount(header.avhRoundOff),
      avhTotalDebit: toAmount(header.avhTotalDebit),
      avhTotalCredit: toAmount(header.avhTotalCredit),
      avhRemarks: header.avhRemarks,
      avhVoucherStatus: header.avhVoucherStatus as VoucherStatus,
      avhStatusOn: toIsoString(header.avhStatusOn),
      avhStatusBy: header.avhStatusBy,
      avhPostedOn: toIsoString(header.avhPostedOn),
      avhCancelReason: header.avhCancelReason,
      // R20 §3 item 1b — WITHOUT this the client has no baseRevision to send
      // back and the optimistic lock on /receipts/amend cannot work. It is
      // read straight off the header the client loaded, held, and returned
      // verbatim; the client never computes or increments it.
      avhRevisionNo: header.avhRevisionNo,
      avhReversalVoucherId: header.avhReversalVoucherId,
      avhAgainstVoucherId: header.avhAgainstVoucherId,
      avhPrintCount: header.avhPrintCount,
      avhDeviceType: header.avhDeviceType,
      avhUserId: header.avhUserId,
      avhCreatedOn: toIsoString(header.avhCreatedOn)!,
      avhCreatedBy: header.avhCreatedBy,
      avhModifiedOn: toIsoString(header.avhModifiedOn),
      avhModifiedBy: header.avhModifiedBy,
    };
  }
}

// ─── Shapes shared with the posting / cancelling services ────────────────────

export const STORED_HEADER_SELECT = {
  avhVoucherId: true,
  avhCompanyId: true,
  avhBranchId: true,
  avhTenantId: true,
  avhAccYear: true,
  avhVoucherTypeId: true,
  avhVoucherNo: true,
  avhVoucherSlno: true,
  avhVoucherRefno: true,
  avhVoucherDate: true,
  avhSrcModule: true,
  avhSrcDocType: true,
  avhSrcDocId: true,
  avhPartyId: true,
  avhEmployeeId: true,
  avhUsrRefno: true,
  avhDocRefno: true,
  avhDocDate: true,
  avhDocAmount: true,
  avhAdjustAmount: true,
  avhRoundOff: true,
  avhTotalDebit: true,
  avhTotalCredit: true,
  avhRemarks: true,
  avhVoucherStatus: true,
  avhStatusOn: true,
  avhStatusBy: true,
  avhPostedOn: true,
  avhCancelReason: true,
  avhRevisionNo: true,
  avhReversalVoucherId: true,
  avhReversalAccYear: true,
  avhAgainstVoucherId: true,
  avhAgainstAccYear: true,
  avhPrintCount: true,
  avhDeviceType: true,
  avhDeviceId: true,
  avhSessionId: true,
  avhUserId: true,
  avhDraftLines: true,
  avhIsDeleted: true,
  avhCreatedOn: true,
  avhCreatedBy: true,
  avhModifiedOn: true,
  avhModifiedBy: true,
} satisfies Prisma.AccVoucherHeaderSelect;

export type StoredHeader = Prisma.AccVoucherHeaderGetPayload<{
  select: typeof STORED_HEADER_SELECT;
}>;

/**
 * `avh_voucher_status` is VARCHAR + CHECK and not a PG enum, so Prisma hands it
 * back as a plain string. Narrowed HERE, once, so every comparison downstream is
 * between two members of the same enum and a typo is a compile error rather than
 * a status gate that silently never fires.
 *
 * An unrecognised value reads as DRAFT — the status with the fewest rights.
 */
export function statusOf(header: Pick<StoredHeader, 'avhVoucherStatus'>): VoucherStatus {
  return asEnum(header.avhVoucherStatus, VOUCHER_STATUSES, VoucherStatus.DRAFT);
}

export function toOtherLinePayload(line: NormalisedOtherLine): ReceiptOtherLine {
  return {
    lineNo: line.lineNo,
    role: line.role,
    ledgerId: line.ledgerId,
    ledgerName: line.ledgerName,
    drCr: line.drCr,
    amount: toAmount(line.amount),
    settlesBill: line.settlesBill,
    narration: line.narration,
  };
}

/**
 * The cheque detail a draft has to remember, keyed by tender row number.
 *
 * `acc_tender_detail` has columns for the cheque NUMBER, the bank NAME and the
 * instrument DATE and for nothing else — no branch, no IFSC, no MICR, no drawer,
 * no bank to deposit into — while `acc_pdc_register` needs all five at post.
 * They ride along in `avh_draft_lines`; see receipt-draft-lines.ts for why that
 * beats both alternatives.
 */
function chequeDetailByRow(
  tenders: readonly NormalisedTender[],
): Record<number, DraftChequeDetail | null> {
  const detail: Record<number, DraftChequeDetail | null> = {};
  for (const tender of tenders) {
    if (tender.isCheque && tender.cheque) {
      detail[tender.rowNo] = tender.cheque;
    }
  }
  return detail;
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export { ZERO, money, sum };
