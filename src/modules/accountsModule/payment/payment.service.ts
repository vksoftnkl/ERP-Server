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
import { STORED_HEADER_SELECT, statusOf, type StoredHeader } from '../receipt/receipt.service';
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
} from '../receipt/receipt.utils';
import { PaymentOpenItemsService } from './payment-open-items.service';
import {
  buildPaymentDraftLines,
  rehydratePaymentDraft,
  type DraftAllocation,
  type DraftCredit,
  type PaymentDraftChequeDetail,
  type PaymentDraftLines,
} from './payment-draft-lines';
import { describePaymentRoleLedgers, ledgerForRole } from './payment-ledger-roles';
import { paymentChequeFilter, paymentPdcVoucherWhere } from './payment-cheque-links';
import { loadChequeBooks } from '../vouchers/cheque-book.helper';
import {
  normalisePaymentOtherLines,
  normalisePaymentTenders,
  type NormalisedPaymentOtherLine,
  type NormalisedPaymentTender,
} from './payment-lines';
import { loadPaymentTdsFacts } from './payment-tds';
import {
  accYearOf,
  assertAccYearWritable,
  assertHeaderScope,
  loadPayee,
  loadPaymentVoucherType,
  type PaymentWriteClient,
} from './payment.guards';
import type { PaymentSettings } from './payment.settings';
import {
  SaveDraftPaymentDto,
  SavePaymentDto,
  UpdatePaymentHeaderDto,
} from './dto/save-payment.dto';
import { DeletePaymentDto, GetPaymentQueryDto } from './dto/post-payment.dto';
import {
  BillAdjType,
  BillSettlementMode,
  BillStatus,
  BillType,
  CHEQUE_TENDER_TYPE_ID,
  debitRouting,
  DrCr,
  PAYMENT_VOUCHER_TYPE_CODE,
  PaymentLedgerRole,
  PdcPostingMode,
  VOUCHER_STATUSES,
  VoucherStatus,
} from './types/payment-enum';
import type {
  PaymentAllocation,
  PaymentBeneficiary,
  PaymentDeletePayload,
  PaymentDraftPayload,
  PaymentErrorDetail,
  PaymentHeader,
  PaymentOtherLine,
  PaymentPayload,
  PaymentTender,
  PaymentTenderCheque,
} from './types/payment-api.types';

/**
 * §5.1, §5.4 and R14 for the PAYMENT — everything a payment does that is not
 * posting or cancelling: the draft (which writes no accounting), the reads,
 * the header-only edit and the delete. `receipt.service.ts` mirrored, route
 * for route; where this file is silent, it does what the receipt does.
 *
 * The header shape, its SELECT and the status narrowing are the receipt's own
 * exports: `acc_voucher_header` does not know which way the money went.
 */

/** Every role a POST may need a ledger for, resolved up front on the draft too. */
const PAYMENT_ROLES: readonly string[] = Object.values(PaymentLedgerRole);

const PAYMENT_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

export { STORED_HEADER_SELECT, statusOf };
export type { StoredHeader };

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly tenderDetailService: TenderDetailService,
    private readonly openItemsService: PaymentOpenItemsService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.3 / §5.1 — the DRAFT
  // ═════════════════════════════════════════════════════════════════════════

  async save(dto: SaveDraftPaymentDto): Promise<PaymentDraftPayload> {
    const actor = resolveActor(dto.avhUserId, this.requestContext.getUserId()) ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(
      (tx) => this.saveInTransaction(tx, dto, actor),
      PAYMENT_TRANSACTION_OPTIONS,
    );
  }

  /** §5.1's body, inside a transaction the CALLER owns. Public for `/payments/amend`. */
  async saveInTransaction(
    tx: Prisma.TransactionClient,
    dto: SaveDraftPaymentDto,
    actor: string,
  ): Promise<PaymentDraftPayload> {
    const paymentDate = toDateOnly(dto.avhVoucherDate);
    const replace = dto.replace ?? true;

    const derivedYear = accYearOf(paymentDate);
    if (derivedYear !== dto.avhAccYear) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: 'avhVoucherDate',
          message: `${dto.avhVoucherDate} falls in ${derivedYear}, but the payment says ${dto.avhAccYear}`,
        },
      ]);
    }

    await assertAccYearWritable(tx, dto.avhCompanyId, dto.avhAccYear, 'avhAccYear');

    const partyId = dto.avhPartyId;
    const [party, voucherType, settings] = await Promise.all([
      loadPayee(tx, dto.avhCompanyId, partyId, 'avhPartyId'),
      loadPaymentVoucherType(tx),
      this.openItemsService.loadSettings(dto.avhCompanyId, dto.avhBranchId),
    ]);

    const existing = dto.avhVoucherId
      ? await tx.accVoucherHeader.findUnique({
          where: {
            avhVoucherId_avhAccYear: { avhVoucherId: dto.avhVoucherId, avhAccYear: dto.avhAccYear },
          },
          select: {
            avhVoucherId: true,
            avhVoucherStatus: true,
            avhIsDeleted: true,
            avhVoucherRefno: true,
            avhDraftLines: true,
            avhVoucherTypeId: true,
            avhCompanyId: true,
            avhBranchId: true,
          },
        })
      : null;

    // notes (62) A2: the save rewrites the header's type, company and branch
    // from the payload, so an id that names a receipt draft — or another
    // company's payment — would be turned into this payment. It is not a
    // payment here, so it is a 404 like any other miss.
    if (
      dto.avhVoucherId &&
      (!existing ||
        existing.avhVoucherTypeId !== voucherType.vchrTypeId ||
        existing.avhCompanyId !== dto.avhCompanyId ||
        existing.avhBranchId !== dto.avhBranchId)
    ) {
      throwAccountsNotFound<PaymentErrorDetail>(
        'Payment not found',
        'avhVoucherId',
        `No payment ${dto.avhVoucherId} in ${dto.avhAccYear}`,
      );
    }
    if (existing && (existing.avhIsDeleted || !this.isEditableStatus(existing.avhVoucherStatus))) {
      throwAccountsConflict<PaymentErrorDetail>('Payment cannot be edited', [
        {
          field: 'avhVoucherId',
          message:
            `${existing.avhVoucherRefno ?? dto.avhVoucherId} is ${existing.avhVoucherStatus}. ` +
            'Only a DRAFT may be edited here; use /payments/update-header for narration, or ' +
            'cancel and re-enter to change the money.',
        },
      ]);
    }

    const tenders = await normalisePaymentTenders(tx, {
      tenders: dto.tenders,
      companyId: dto.avhCompanyId,
      branchId: dto.avhBranchId,
      paymentDate,
      partyName: party.ledName,
    });
    await this.assertInstrumentYearsWritable(tx, dto.avhCompanyId, tenders);

    const roleLedgers = await describePaymentRoleLedgers(tx, PAYMENT_ROLES, {
      companyId: dto.avhCompanyId,
      branchId: dto.avhBranchId,
    });
    const tdsFacts = await loadPaymentTdsFacts(tx, {
      companyId: dto.avhCompanyId,
      party,
      accYear: dto.avhAccYear,
      date: dto.avhVoucherDate,
    });

    const { lines } = await normalisePaymentOtherLines(tx, {
      lines: dto.otherLines ?? [],
      tenders,
      companyId: dto.avhCompanyId,
      branchId: dto.avhBranchId,
      party,
      partyId,
      settings,
      tds: tdsFacts,
      ledgerForRole: (role) => {
        const resolved = ledgerForRole(roleLedgers, role);
        return resolved ? { ledgerId: resolved.ledgerId, ledgerName: resolved.ledgerName } : null;
      },
    });

    this.assertSalesman(dto.avhEmployeeId, settings);

    // §5.1 rule 5 — derived, never accepted: Σ paid.
    const docAmount = sum(tenders.map((tender) => tender.amount));

    const header = await this.upsertDraftHeader(tx, {
      dto,
      existingId: existing?.avhVoucherId ?? null,
      voucherTypeId: voucherType.vchrTypeId,
      partyId,
      paymentDate,
      docAmount,
      draftLines: lines,
      cheques: chequeDetailByRow(tenders),
      beneficiaries: beneficiaryByRow(tenders),
      allocations: rememberedAllocations(dto, existing?.avhDraftLines),
      creditsApplied: rememberedCredits(dto, existing?.avhDraftLines),
      actor,
    });

    await this.syncTenders(tx, {
      dto,
      voucherId: header.avhVoucherId,
      partyId,
      paymentDate,
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
        srcDocType: TxnStatusDocType.PAYMENT,
        srcDocId: header.avhVoucherId,
        event: TxnStatusEvent.CREATED,
        toStatus: VoucherStatus.DRAFT,
        changedBy: actor,
        deviceId: this.requestContext.getDeviceId() ?? dto.avhDeviceId ?? null,
        sessionId: dto.avhSessionId ?? null,
      });
    }

    const stored = await this.loadHeaderOrThrow(tx, header.avhVoucherId, dto.avhAccYear);
    return {
      header: await this.toHeaderPayload(tx, stored),
      tenders: await this.loadTenderPayload(tx, header.avhVoucherId),
      otherLines: lines.map(toOtherLinePayload),
      // TDS is SEEDED on a payment, so nothing is left to report.
      expectedRoles: [],
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.5 — get
  // ═════════════════════════════════════════════════════════════════════════

  async get(query: GetPaymentQueryDto): Promise<PaymentPayload> {
    const header = await this.loadHeaderOrThrow(this.prisma, query.avhVoucherId, query.avhAccYear);
    assertHeaderScope(header, {
      companyId: query.avhCompanyId,
      branchId: query.avhBranchId,
      accYear: query.avhAccYear,
      voucherId: query.avhVoucherId,
    });
    return this.loadFullPayment(this.prisma, header);
  }

  /** Shared with the posting, cancelling and amending services, so one shape is returned. */
  async loadFullPayment(
    client: Prisma.TransactionClient | PrismaService,
    header: StoredHeader,
  ): Promise<PaymentPayload> {
    const pdcHeaders = await client.accVoucherHeader.findMany({
      where: paymentPdcVoucherWhere(header),
      select: STORED_HEADER_SELECT,
      orderBy: { avhVoucherDate: 'asc' },
    });
    const voucherIds = [header.avhVoucherId, ...pdcHeaders.map((row) => row.avhVoucherId)];
    const years = [...new Set([header.avhAccYear, ...pdcHeaders.map((row) => row.avhAccYear)])];

    const tenderRows = await client.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      select: { tdId: true, tdRowNo: true },
    });
    const chequeFilter = await paymentChequeFilter(client, {
      receiptVoucherId: header.avhVoucherId,
      voucherIds,
    });

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
          abjReversalOfId: true,
          bill: {
            select: {
              ablDocRefno: true,
              ablDocDate: true,
              ablBillType: true,
              ablBillAmount: true,
              ablPendingAmount: true,
              ablDueDate: true,
              ablStatus: true,
            },
          },
          againstBill: { select: { ablDocRefno: true } },
        },
        orderBy: [{ abjAdjDate: 'asc' }, { abjRowNo: 'asc' }],
      }),
      client.$queryRaw<ChequeRow[]>`
        SELECT p.apd_id, p.apd_acc_year, p.apd_instrument_type, p.apd_instrument_no, p.apd_instrument_date,
               p.apd_amount, p.apd_bank_name, p.apd_bank_ledger_id, p.apd_cheque_book_id, b.acb_book_no,
               p.apd_favouring, p.apd_ac_payee, p.apd_printed_on, p.apd_print_count, p.apd_status,
               p.apd_voucher_id, p.apd_tender_id
          FROM accounts.acc_pdc_register p
          LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id
         WHERE p.apd_is_deleted = false
           AND (p.apd_voucher_id = ANY(${voucherIds}::uuid[])
                OR p.apd_tender_id = ANY(${tenderRows.map((row) => row.tdId)}::uuid[]))
         ORDER BY p.apd_instrument_date, p.apd_instrument_no`,
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
    // The Prisma filter the guards use is the same union the raw query above
    // spells out; it is kept to prove they agree in a test, not for the read.
    void chequeFilter;

    const reversedIds = new Set<string>(
      adjustments.length === 0
        ? []
        : (
            await client.accBillAdjustment.findMany({
              where: {
                abjReversalOfId: { in: adjustments.map((row) => row.abjId) },
                abjIsDeleted: false,
              },
              select: { abjReversalOfId: true },
            })
          ).map((row) => row.abjReversalOfId as string),
    );

    const today = todayUtc();
    const legsFor = (voucherId: string) =>
      legs
        .filter((leg) => leg.avVoucherId === voucherId)
        .map((leg) => ({
          avId: leg.avId,
          avRowNo: leg.avRowNo,
          avDrCr: leg.avDrCr as PaymentPayload['legs'][number]['avDrCr'],
          avLedgerId: leg.avLedgerId,
          avLedgerName: leg.ledger?.ledName ?? null,
          avAmount: toAmount(leg.avAmount),
          avRole: leg.avRole,
          avRemarks: leg.avRemarks,
        }));

    const toAllocation = (row: (typeof adjustments)[number]): PaymentAllocation => ({
      abjId: row.abjId,
      billId: row.abjBillId,
      billAccYear: row.abjBillAccYear,
      docRefno: row.bill?.ablDocRefno ?? '',
      docDate: toDateString(row.bill?.ablDocDate ?? null) ?? '',
      billType: (row.bill?.ablBillType as BillType | undefined) ?? null,
      billAmount: row.bill ? toAmount(row.bill.ablBillAmount) : null,
      pendingAmount: row.bill ? toAmount(row.bill.ablPendingAmount) : null,
      dueDate: toDateString(row.bill?.ablDueDate ?? null),
      status: (row.bill?.ablStatus as BillStatus | undefined) ?? null,
      adjType: row.abjAdjType as PaymentAllocation['adjType'],
      settlementMode: row.abjSettlementMode as PaymentAllocation['settlementMode'],
      drCr: row.abjDrCr as PaymentAllocation['drCr'],
      amount: toAmount(row.abjAmount),
      adjDate: toDateString(row.abjAdjDate)!,
      isPostDated: row.abjIsPostDated,
      matured: !row.abjIsPostDated || row.abjAdjDate <= today,
      voucherId: row.abjVoucherId,
      chequeId: row.abjChequeId,
      againstBillId: row.abjAgainstBillId,
      againstBillRefno: row.againstBill?.ablDocRefno ?? null,
      reversalOfId: row.abjReversalOfId,
      isReversed: reversedIds.has(row.abjId),
      approvedBy: row.abjApprovedBy,
      remarks: row.abjRemarks,
    });

    const rowNoByTenderId = new Map(tenderRows.map((row) => [row.tdId, row.tdRowNo]));
    const draft = rehydratePaymentDraft(header.avhDraftLines);
    const remembered =
      statusOf(header) === VoucherStatus.DRAFT
        ? await this.rememberedSettlement(client, header, draft)
        : null;

    return {
      header: await this.toHeaderPayload(client, header),
      tenders: await this.loadTenderPayload(client, header.avhVoucherId),
      otherLines: draft.otherLines,
      legs: legsFor(header.avhVoucherId),
      allocations:
        remembered?.allocations ??
        adjustments.filter((row) => row.abjAgainstBillId === null).map(toAllocation),
      creditsApplied:
        remembered?.creditsApplied ??
        adjustments.filter((row) => row.abjAgainstBillId !== null).map(toAllocation),
      chequesIssued: cheques.map((cheque) => ({
        pdcId: cheque.apd_id,
        accYear: cheque.apd_acc_year.trim(),
        tenderRowNo: cheque.apd_tender_id
          ? (rowNoByTenderId.get(cheque.apd_tender_id) ?? null)
          : null,
        instrumentType: cheque.apd_instrument_type,
        instrumentNo: cheque.apd_instrument_no,
        instrumentDate: toDateString(cheque.apd_instrument_date)!,
        amount: toAmount(cheque.apd_amount),
        bankName: cheque.apd_bank_name,
        bankLedgerId: cheque.apd_bank_ledger_id,
        chequeBookId: cheque.apd_cheque_book_id,
        bookNo: cheque.acb_book_no,
        favouring: cheque.apd_favouring,
        acPayee: cheque.apd_ac_payee ?? true,
        printed: cheque.apd_printed_on !== null,
        printCount: cheque.apd_print_count ?? 0,
        status: cheque.apd_status as PaymentPayload['chequesIssued'][number]['status'],
        voucherId: cheque.apd_voucher_id,
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

  /** The settlement a DRAFT remembers, shaped like the rows a post would write. See the receipt's. */
  private async rememberedSettlement(
    client: PaymentWriteClient,
    header: StoredHeader,
    draft: PaymentDraftLines,
  ): Promise<{ allocations: PaymentAllocation[]; creditsApplied: PaymentAllocation[] } | null> {
    if (draft.allocations.length === 0 && draft.creditsApplied.length === 0) {
      return null;
    }
    const keys = [...draft.allocations, ...draft.creditsApplied];
    const bills = await client.accBillBalance.findMany({
      where: { OR: keys.map((row) => ({ ablId: row.billId, ablAccYear: row.billAccYear })) },
      select: {
        ablId: true,
        ablAccYear: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablBillType: true,
        ablBillAmount: true,
        ablPendingAmount: true,
        ablDueDate: true,
        ablStatus: true,
      },
    });
    const billByKey = new Map(bills.map((bill) => [`${bill.ablId}|${bill.ablAccYear}`, bill]));
    const adjDate = toDateString(header.avhVoucherDate)!;
    const base = (row: {
      billId: string;
      billAccYear: string;
    }): Omit<PaymentAllocation, 'adjType' | 'settlementMode' | 'amount' | 'approvedBy'> => {
      const bill = billByKey.get(`${row.billId}|${row.billAccYear}`);
      return {
        abjId: null,
        billId: row.billId,
        billAccYear: row.billAccYear,
        docRefno: bill?.ablDocRefno ?? '',
        docDate: toDateString(bill?.ablDocDate),
        billType: (bill?.ablBillType as BillType | undefined) ?? null,
        billAmount: bill ? toAmount(bill.ablBillAmount) : null,
        pendingAmount: bill ? toAmount(bill.ablPendingAmount) : null,
        dueDate: toDateString(bill?.ablDueDate),
        status: (bill?.ablStatus as BillStatus | undefined) ?? null,
        // A payable is settled by a DEBIT to the party.
        drCr: DrCr.DR,
        adjDate,
        isPostDated: false,
        matured: true,
        voucherId: null,
        chequeId: null,
        againstBillId: null,
        againstBillRefno: null,
        reversalOfId: null,
        isReversed: false,
        remarks: null,
      };
    };

    const allocations: PaymentAllocation[] = [];
    for (const row of draft.allocations) {
      allocations.push({
        ...base(row),
        adjType: BillAdjType.ALLOCATION,
        settlementMode: null,
        amount: row.amount,
        approvedBy: null,
      });
      if (row.discount > 0) {
        allocations.push({
          ...base(row),
          adjType: BillAdjType.DISCOUNT,
          settlementMode: BillSettlementMode.DISCOUNT,
          amount: row.discount,
          approvedBy: null,
        });
      }
      if (row.writeoff > 0) {
        allocations.push({
          ...base(row),
          adjType: BillAdjType.WRITEOFF,
          settlementMode: BillSettlementMode.WRITEOFF,
          amount: row.writeoff,
          approvedBy: row.writeoffApprovedBy,
        });
      }
      if (row.roundoff > 0) {
        allocations.push({
          ...base(row),
          adjType: BillAdjType.ROUND_OFF,
          settlementMode: BillSettlementMode.ROUND_OFF,
          amount: row.roundoff,
          approvedBy: null,
        });
      }
    }
    const creditsApplied: PaymentAllocation[] = draft.creditsApplied.map((row) => {
      const bill = billByKey.get(`${row.billId}|${row.billAccYear}`);
      const routing = bill ? debitRouting(bill.ablBillType as BillType) : null;
      return {
        ...base(row),
        adjType: routing?.adjType ?? BillAdjType.ADVANCE_ADJUST,
        settlementMode: routing?.settlementMode ?? null,
        amount: row.amount,
        approvedBy: null,
      };
    });
    return { allocations, creditsApplied };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.7 / §5.4 — the header-only edit
  // ═════════════════════════════════════════════════════════════════════════

  async updateHeader(
    dto: UpdatePaymentHeaderDto,
    body: Record<string, unknown>,
  ): Promise<PaymentHeader> {
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
      throwAccountsBadRequest<PaymentErrorDetail>('Only the header may be edited', [
        {
          field: rejected[0],
          message:
            `${rejected.join(', ')} cannot be changed on a posted payment. Money is changed by ` +
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
        throwAccountsConflict<PaymentErrorDetail>('Payment cannot be edited', [
          { field: 'avhVoucherId', message: 'A cancelled payment is closed to edits' },
        ]);
      }
      await assertAccYearWritable(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
      if (has(body, 'avhEmployeeId')) {
        const settings = await this.openItemsService.loadSettings(
          header.avhCompanyId,
          header.avhBranchId,
        );
        this.assertSalesman(dto.avhEmployeeId ?? [], settings);
      }

      const now = new Date();
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: { avhVoucherId: dto.avhVoucherId, avhAccYear: dto.avhAccYear },
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
        srcDocType: TxnStatusDocType.PAYMENT,
        srcDocId: header.avhVoucherId,
        srcDocRefno: header.avhVoucherRefno,
        event: TxnStatusEvent.STATUS_CHANGED,
        fromStatus: header.avhVoucherStatus,
        toStatus: header.avhVoucherStatus,
        changedBy: actor,
        deviceId: this.requestContext.getDeviceId(),
        changedOn: now,
        remarks: dto.editRemark,
      });

      const updated = await this.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
      return this.toHeaderPayload(tx, updated);
    }, PAYMENT_TRANSACTION_OPTIONS);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  DELETE — throw a DRAFT away
  // ═════════════════════════════════════════════════════════════════════════

  async deleteDraft(dto: DeletePaymentDto): Promise<PaymentDeletePayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT avh_voucher_id FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid AND avh_acc_year = ${dto.avhAccYear}::bpchar
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
        throwAccountsConflict<PaymentErrorDetail>('Payment cannot be deleted', [
          {
            field: 'avhVoucherId',
            message:
              `${header.avhVoucherRefno ?? dto.avhVoucherId} is ${header.avhVoucherStatus}. ` +
              (status === VoucherStatus.POSTED
                ? 'A posted payment is money in the books — cancel it, which reverses it and leaves the trail. Only a DRAFT is deleted.'
                : 'It has already been cancelled, and its reversal is what the books stand on. Only a DRAFT is deleted.'),
          },
        ]);
      }
      if (header.avhAgainstVoucherId) {
        throwAccountsConflict<PaymentErrorDetail>('Payment cannot be deleted', [
          {
            field: 'avhVoucherId',
            message:
              'This is a post-dated cheque voucher, not a payment. It belongs to the payment ' +
              `${header.avhAgainstVoucherId} and leaves play only when that one is cancelled.`,
          },
        ]);
      }
      await assertAccYearWritable(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
      await this.assertDraftWroteNoAccounting(tx, header);

      const now = new Date();
      const otherLinesDeleted = rehydratePaymentDraft(header.avhDraftLines).otherLines.length;
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
        data: { avhIsDeleted: true, avhIsActive: false, avhModifiedOn: now, avhModifiedBy: actor },
      });
      await appendTxnStatusLog(tx, {
        companyId: header.avhCompanyId,
        branchId: header.avhBranchId,
        tenantId: header.avhTenantId,
        accYear: header.avhAccYear,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: TxnStatusDocType.PAYMENT,
        srcDocId: header.avhVoucherId,
        srcDocRefno: header.avhVoucherRefno,
        event: TxnStatusEvent.DELETED,
        fromStatus: header.avhVoucherStatus,
        toStatus: header.avhVoucherStatus,
        changedBy: actor,
        deviceId: this.requestContext.getDeviceId(),
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
    }, PAYMENT_TRANSACTION_OPTIONS);
  }

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
      throwAccountsConflict<PaymentErrorDetail>('Payment cannot be deleted', [
        {
          field: 'avhVoucherId',
          message:
            `This draft has ${legs} voucher leg(s) and ${adjustments} bill adjustment row(s) against it, ` +
            'which a draft cannot have (R10). Deleting it would orphan them — have the voucher looked at first.',
        },
      ]);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Shared internals — used by the posting, cancelling and amending services
  // ═════════════════════════════════════════════════════════════════════════

  async loadHeaderOrThrow(
    client: Prisma.TransactionClient | PrismaService,
    voucherId: string,
    accYear: string,
  ): Promise<StoredHeader> {
    // notes (62) A2: a `Pmt` and nothing else. Without the type every route
    // here — /get, /post, /cancel, /delete, /amend — would act on a receipt
    // or a Voucher Register voucher handed its id. A 404, as for a miss on
    // any other key: the caller learns nothing about what the id is.
    const header = await client.accVoucherHeader.findFirst({
      where: {
        avhVoucherId: voucherId,
        avhAccYear: accYear,
        voucherType: { vchrTypeCode: PAYMENT_VOUCHER_TYPE_CODE },
      },
      select: STORED_HEADER_SELECT,
    });
    if (!header || header.avhIsDeleted) {
      throwAccountsNotFound<PaymentErrorDetail>(
        'Payment not found',
        'avhVoucherId',
        `No payment ${voucherId} in ${accYear}`,
      );
    }
    if (header.avhPartyId === null) {
      throwAccountsNotFound<PaymentErrorDetail>(
        'Payment not found',
        'avhPartyId',
        `Voucher ${voucherId} in ${accYear} carries no party, so it is not a payment`,
      );
    }
    return { ...header, avhPartyId: header.avhPartyId };
  }

  /** The number, through the SAME allocator every voucher uses. */
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
    return { voucherNo: allocated.lastNo, voucherSlno: slno, voucherRefno: allocated.refno };
  }

  /** Everything the post checks that does not need a row lock. */
  async assertPostable(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    settings: PaymentSettings,
  ): Promise<void> {
    if (settings.pdcPostingMode !== PdcPostingMode.ON_RECEIPT) {
      throwAccountsBadRequest<PaymentErrorDetail>('Posting mode is not supported', [
        {
          field: 'accounts.pdc_posting_mode',
          message:
            'accounts.pdc_posting_mode is ON_CLEARING, which moves allocation into the cheques ' +
            'screens — not built yet. Set it to ON_RECEIPT to post payments.',
        },
      ]);
    }
    this.assertSalesman(header.avhEmployeeId, settings);
    const tenders = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      select: { tdIsPdc: true, tdInstrumentDate: true },
    });
    if (tenders.length === 0) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        { field: 'tenders', message: 'A payment with no instruments is a journal, not a payment' },
      ]);
    }
    for (const tender of tenders) {
      if (!tender.tdIsPdc || !tender.tdInstrumentDate) {
        continue;
      }
      await assertAccYearWritable(
        tx,
        header.avhCompanyId,
        accYearOf(tender.tdInstrumentDate),
        'tenders.tdInstrumentDate',
      );
    }
  }

  /** One "paid by", and mandatory when the setting says so. */
  private assertSalesman(employeeIds: string[] | undefined, settings: PaymentSettings): void {
    const ids = employeeIds ?? [];
    if (ids.length > 1) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: 'avhEmployeeId',
          message:
            'A payment is made by ONE person. The column is an array because every voucher ' +
            "header's is, not because a payment may be shared.",
        },
      ]);
    }
    if (settings.salesmanMandatory && ids.length === 0) {
      throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
        {
          field: 'avhEmployeeId',
          message: 'accounts.payment_salesman_mandatory is on — a payment must say who made it',
        },
      ]);
    }
  }

  private isEditableStatus(status: string): boolean {
    return asEnum(status, VOUCHER_STATUSES, VoucherStatus.CANCELLED) === VoucherStatus.DRAFT;
  }

  private async assertInstrumentYearsWritable(
    tx: Prisma.TransactionClient,
    companyId: string,
    tenders: readonly NormalisedPaymentTender[],
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
      dto: SaveDraftPaymentDto;
      existingId: string | null;
      voucherTypeId: number;
      partyId: string;
      paymentDate: Date;
      docAmount: Prisma.Decimal;
      draftLines: readonly NormalisedPaymentOtherLine[];
      cheques: Record<number, PaymentDraftChequeDetail | null>;
      beneficiaries: Record<number, PaymentBeneficiary | null>;
      allocations: readonly DraftAllocation[];
      creditsApplied: readonly DraftCredit[];
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
      avhVoucherDate: params.paymentDate,
      avhPartyId: params.partyId,
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
      avhDraftLines: buildPaymentDraftLines(
        params.draftLines.map(toOtherLinePayload),
        params.cheques,
        params.beneficiaries,
        params.allocations,
        params.creditsApplied,
      ),
    };
    if (params.existingId) {
      return tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: { avhVoucherId: params.existingId, avhAccYear: dto.avhAccYear },
        },
        data: { ...common, avhModifiedOn: now, avhModifiedBy: params.actor },
        select: { avhVoucherId: true },
      });
    }
    return tx.accVoucherHeader.create({
      data: {
        ...common,
        ...(dto.avhVoucherId ? { avhVoucherId: dto.avhVoucherId } : {}),
        avhAccYear: dto.avhAccYear,
        avhVoucherStatus: VoucherStatus.DRAFT,
        avhCreatedOn: now,
        avhCreatedBy: params.actor,
      },
      select: { avhVoucherId: true },
    });
  }

  /**
   * The tender rows, written by the SAME service the sale bill and the receipt
   * write them with — money OUT (`td_dr_cr` CR). The beneficiary columns the
   * DTO has no fields for are stamped after the sync, by the row's id.
   */
  private async syncTenders(
    tx: Prisma.TransactionClient,
    params: {
      dto: SavePaymentDto;
      voucherId: string;
      partyId: string;
      paymentDate: Date;
      tenders: readonly NormalisedPaymentTender[];
      actor: string;
      replace: boolean;
    },
  ): Promise<void> {
    const scope: TenderDocumentScope = {
      tdSrcModule: TenderSrcModule.ACCOUNTS,
      tdSrcDocType: TenderSrcDocType.PAYMENT,
      tdSrcDocId: params.voucherId,
      tdCompanyId: params.dto.avhCompanyId,
      tdBranchId: params.dto.avhBranchId,
      tdTenantId: params.dto.avhTenantId ?? null,
      tdAccYear: params.dto.avhAccYear,
      tdDocDate: params.paymentDate,
      tdPartyLedgerId: params.partyId,
      tdUserId: params.actor,
      tdSessionId: params.dto.avhSessionId ?? null,
      tdDeviceId: params.dto.avhDeviceId ?? null,
      tdDrCr: TenderDrCr.CR,
    };
    const rows: SaveTenderDetailDto[] = params.tenders.map((tender) => ({
      ...(tender.tdId ? { tdId: tender.tdId } : {}),
      tdRowNo: tender.rowNo,
      tdTenderId: tender.tenderId,
      tdTenderTypeId: tender.tenderTypeId,
      tdTenderLedgerId: tender.tenderLedgerId,
      tdAmount: tender.amount.toFixed(2),
      tdReceivedAmt: tender.receivedAmt.toFixed(2),
      tdChangeAmt: tender.changeAmt.toFixed(2),
      tdMdrAmt: tender.mdrAmt.toFixed(2),
      // NULL on a cheque until post takes the leaf.
      tdRefNo: tender.refNo,
      tdBankName: tender.bankName,
      tdPayerVpa: tender.payerVpa,
      tdInstrumentDate: toDateString(tender.instrumentDate),
      tdIsPdc: tender.isPdc,
      tdSettleLedgerId: tender.clearingLedgerId,
      tdNotes: tender.notes,
      tdVoucherId: null,
    })) as SaveTenderDetailDto[];

    const merged = params.replace ? rows : await this.keepUnmentioned(tx, scope, rows);
    const written = await this.tenderDetailService.syncDocumentTenders(
      tx,
      scope,
      merged,
      params.actor,
      {
        tableName: 'payment tender',
        screenName: 'Payment',
        entityName: 'Payment tender',
      },
    );

    const byRow = new Map(written.map((row) => [row.tdRowNo, row.tdId]));
    for (const tender of params.tenders) {
      const tdId = byRow.get(tender.rowNo);
      if (!tdId) {
        continue;
      }
      await tx.$executeRaw`
        UPDATE accounts.acc_tender_detail
           SET td_beneficiary_name       = ${tender.beneficiary?.name?.slice(0, 150) ?? null},
               td_beneficiary_account_no = ${tender.beneficiary?.accountNo?.slice(0, 50) ?? null},
               td_beneficiary_ifsc       = ${tender.beneficiary?.ifsc?.slice(0, 11) ?? null}
         WHERE td_id = ${tdId}::uuid AND td_acc_year = ${params.dto.avhAccYear}::char(9)`;
    }
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
  ): Promise<PaymentTender[]> {
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
    const beneficiaries = await client.$queryRaw<
      {
        td_id: string;
        td_beneficiary_name: string | null;
        td_beneficiary_account_no: string | null;
        td_beneficiary_ifsc: string | null;
      }[]
    >`
      SELECT td_id, td_beneficiary_name, td_beneficiary_account_no, td_beneficiary_ifsc
        FROM accounts.acc_tender_detail
       WHERE td_src_doc_id = ${voucherId}::uuid AND td_is_deleted = false`;
    const beneficiaryById = new Map(beneficiaries.map((row) => [row.td_id, row]));
    const chequeByRowNo = await this.loadTenderCheques(client, voucherId, rows);
    return rows.map((row) => {
      const b = beneficiaryById.get(row.tdId);
      const beneficiary =
        b && (b.td_beneficiary_name || b.td_beneficiary_account_no || b.td_beneficiary_ifsc)
          ? {
              name: b.td_beneficiary_name,
              accountNo: b.td_beneficiary_account_no,
              ifsc: b.td_beneficiary_ifsc,
            }
          : null;
      return {
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
        beneficiary,
        cheque: chequeByRowNo.get(row.tdRowNo) ?? null,
      };
    });
  }

  /**
   * notes (62) A3 — the `cheque {}` of every cheque row. `acc_tender_detail`
   * has no column for the book, so a DRAFT keeps it in `avh_draft_lines`;
   * once posted the register row carries it. Without it a reopened draft
   * could not be saved again (`cheque.chequeBookId` is required) until the
   * operator picked the book a second time.
   */
  private async loadTenderCheques(
    client: Prisma.TransactionClient | PrismaService,
    voucherId: string,
    rows: readonly { tdId: string; tdRowNo: number; tdTenderTypeId: number }[],
  ): Promise<Map<number, PaymentTenderCheque>> {
    const out = new Map<number, PaymentTenderCheque>();
    const chequeRows = rows.filter((row) => row.tdTenderTypeId === CHEQUE_TENDER_TYPE_ID);
    if (chequeRows.length === 0) {
      return out;
    }
    const [header, registered] = await Promise.all([
      client.accVoucherHeader.findFirst({
        where: { avhVoucherId: voucherId },
        select: { avhDraftLines: true },
      }),
      client.accPdcRegister.findMany({
        where: {
          apdTenderId: { in: chequeRows.map((row) => row.tdId) },
          apdIsDeleted: false,
          apdChequeBookId: { not: null },
        },
        select: {
          apdTenderId: true,
          apdChequeBookId: true,
          apdFavouring: true,
          apdAcPayee: true,
          apdBankBranch: true,
          apdIfsc: true,
          apdMicr: true,
          apdDrawerName: true,
        },
      }),
    ]);
    const draft = rehydratePaymentDraft(header?.avhDraftLines);
    const registerByTenderId = new Map(registered.map((row) => [row.apdTenderId, row]));

    for (const row of chequeRows) {
      const stored = draft.cheques[row.tdRowNo];
      const register = registerByTenderId.get(row.tdId);
      if (stored) {
        out.set(row.tdRowNo, { ...stored, bookNo: null });
      } else if (register?.apdChequeBookId) {
        out.set(row.tdRowNo, {
          chequeBookId: register.apdChequeBookId,
          bookNo: null,
          favouring: register.apdFavouring,
          acPayee: register.apdAcPayee,
          bankBranch: register.apdBankBranch,
          ifsc: register.apdIfsc,
          micr: register.apdMicr,
          drawerName: register.apdDrawerName,
        });
      }
    }
    const books = await loadChequeBooks(
      client,
      [...out.values()].map((cheque) => cheque.chequeBookId),
    );
    for (const cheque of out.values()) {
      cheque.bookNo = books.get(cheque.chequeBookId)?.bookNo ?? null;
    }
    return out;
  }

  async toHeaderPayload(
    client: Prisma.TransactionClient | PrismaService,
    header: StoredHeader,
  ): Promise<PaymentHeader> {
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

interface ChequeRow {
  apd_id: string;
  apd_acc_year: string;
  apd_instrument_type: string;
  apd_instrument_no: string;
  apd_instrument_date: Date;
  apd_amount: Prisma.Decimal;
  apd_bank_name: string | null;
  apd_bank_ledger_id: string | null;
  apd_cheque_book_id: string | null;
  acb_book_no: string | null;
  apd_favouring: string | null;
  apd_ac_payee: boolean | null;
  apd_printed_on: Date | null;
  apd_print_count: number | null;
  apd_status: string;
  apd_voucher_id: string | null;
  apd_tender_id: string | null;
}

function rememberedAllocations(
  dto: SaveDraftPaymentDto,
  stored: Prisma.JsonValue | null | undefined,
): DraftAllocation[] {
  if (dto.allocations === undefined) {
    return rehydratePaymentDraft(stored).allocations;
  }
  return dto.allocations.map((row) => ({
    billId: row.billId,
    billAccYear: row.billAccYear,
    amount: row.amount,
    discount: row.discount ?? 0,
    writeoff: row.writeoff ?? 0,
    roundoff: row.roundoff ?? 0,
    writeoffApprovedBy: row.writeoffApprovedBy ?? null,
  }));
}

function rememberedCredits(
  dto: SaveDraftPaymentDto,
  stored: Prisma.JsonValue | null | undefined,
): DraftCredit[] {
  if (dto.creditsApplied === undefined) {
    return rehydratePaymentDraft(stored).creditsApplied;
  }
  return dto.creditsApplied.map((row) => ({
    billId: row.billId,
    billAccYear: row.billAccYear,
    amount: row.amount,
  }));
}

export function toOtherLinePayload(line: NormalisedPaymentOtherLine): PaymentOtherLine {
  return {
    lineNo: line.lineNo,
    role: line.role,
    ledgerId: line.ledgerId,
    ledgerName: line.ledgerName,
    drCr: line.drCr,
    amount: toAmount(line.amount),
    settlesBill: line.settlesBill,
    narration: line.narration,
    approvedBy: line.approvedBy,
  };
}

function chequeDetailByRow(
  tenders: readonly NormalisedPaymentTender[],
): Record<number, PaymentDraftChequeDetail | null> {
  const detail: Record<number, PaymentDraftChequeDetail | null> = {};
  for (const tender of tenders) {
    if (tender.isCheque && tender.cheque) {
      detail[tender.rowNo] = {
        chequeBookId: tender.cheque.chequeBookId,
        favouring: tender.cheque.favouring,
        acPayee: tender.cheque.acPayee,
        bankBranch: tender.cheque.bankBranch,
        ifsc: tender.cheque.ifsc,
        micr: tender.cheque.micr,
        drawerName: tender.cheque.drawerName,
      };
    }
  }
  return detail;
}

function beneficiaryByRow(
  tenders: readonly NormalisedPaymentTender[],
): Record<number, PaymentBeneficiary | null> {
  const detail: Record<number, PaymentBeneficiary | null> = {};
  for (const tender of tenders) {
    if (tender.beneficiary) {
      detail[tender.rowNo] = tender.beneficiary;
    }
  }
  return detail;
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export { ZERO, money, sum };
