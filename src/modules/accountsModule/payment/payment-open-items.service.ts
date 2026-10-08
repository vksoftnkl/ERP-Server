import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { throwAccountsNotFound } from 'src/common/utils/module-service.utils';
import { suggestPpdDiscount, type PpdSlab } from '../receipt/ppd-slab';
import {
  daysOverdue,
  money,
  sum,
  toAmount,
  toDateOnly,
  toDateString,
  toIsoString,
  todayUtc,
  ZERO,
} from '../receipt/receipt.utils';
import type {
  AdjacentVoucherQueryDto,
  DuplicateCheckQueryDto,
  ListPaymentOpenItemsQueryDto,
  PartyContextQueryDto,
} from './dto/open-item.dto';
import { accYearOf, loadPayee } from './payment.guards';
import { loadPaymentTdsFacts } from './payment-tds';
import { readPaymentSettings, type PaymentSettings } from './payment.settings';
import type {
  AdjacentVoucher,
  AdjacentVoucherPayload,
  DuplicateCheckPayload,
  OpenCredit,
  PartyChequeOut,
  PartyRecentPayment,
  PayableBill,
  PaymentErrorDetail,
  PaymentOpenItemsPayload,
  PaymentPartyContextPayload,
  PaymentPartyContextSummary,
} from './types/payment-api.types';
import {
  BillType,
  debitRouting,
  HELD_DEBIT_BILL_TYPES,
  PAYABLE_BILL_TYPES,
  PAYMENT_VOUCHER_TYPE_CODE,
  PdcTraType,
  ReceiptBillSort,
  VoucherStatus,
} from './types/payment-enum';

/**
 * §4.1 and §4.2 for the payment — what the screen reads before a figure is
 * keyed. `open-items.service.ts` mirrored: no accounting year, no branch, no
 * paging, for the reasons given there. The party facts a payment needs on
 * top: the TDS rate in force, the party's bank account and who a cheque is
 * made out to.
 */
@Injectable()
export class PaymentOpenItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingValueService: AppSettingValueService,
  ) {}

  // ─── §4.1 ──────────────────────────────────────────────────────────────────

  async listOpenItems(query: ListPaymentOpenItemsQueryDto): Promise<PaymentOpenItemsPayload> {
    const onDate = query.onDate ? toDateOnly(query.onDate) : todayUtc();
    const onIso = onDate.toISOString().slice(0, 10);
    const [party, settings] = await Promise.all([
      loadPayee(this.prisma, query.companyId, query.partyId, 'partyId', { allowMoneyLedger: true }),
      this.loadSettings(query.companyId),
    ]);

    const slabs = await this.loadSupplierDiscountTerms(query.partyId);
    const [bills, credits, tds, bank] = await Promise.all([
      this.loadPayables(query.companyId, query.partyId, onDate, settings, slabs),
      this.loadHeldDebits(query.companyId, query.partyId),
      loadPaymentTdsFacts(this.prisma as unknown as Prisma.TransactionClient, {
        companyId: query.companyId,
        party,
        accYear: accYearOf(onDate),
        date: onIso,
      }),
      this.loadDefaultBank(query.partyId),
    ]);

    return {
      bills,
      credits,
      summary: {
        totalPending: toAmount(sum(bills.map((bill) => money(bill.pendingAmount)))),
        billCount: bills.length,
        overdueCount: bills.filter((bill) => bill.daysOverdue > 0).length,
        creditsHeld: toAmount(sum(credits.map((credit) => money(credit.pendingAmount)))),
        pdcHeld: toAmount(sum(bills.map((bill) => money(bill.pdcHeld)))),
      },
      party: {
        ledId: party.ledId,
        ledName: party.ledName,
        groupName: party.groupName,
        isBillByBill: party.ledIsBillByBill,
        isMoneyLedger: party.isMoneyLedger,
        isTdsApplicable: party.ledIsTdsApplicable,
        tdsSection: party.ledTdsSection,
        tdsDeducteeType: party.ledTdsDeducteeType,
        tdsRate: tds?.rate ? toAmount(party.ledPanNo ? tds.rate.rate : tds.rate.noPanRate) : null,
        tdsRateSource: tds?.rate ? (party.ledPanNo ? 'MASTER' : 'NO_PAN') : null,
        tdsThresholdSingle: tds?.rate ? toAmount(tds.rate.thresholdSingle) : null,
        tdsThresholdAnnual: tds?.rate ? toAmount(tds.rate.thresholdAnnual) : null,
        tdsPaidThisYear: toAmount(tds?.annualBaseSoFar ?? ZERO),
        panPresent: party.ledPanNo !== null,
        bank: bank
          ? { name: bank.lbaBankName, accountNo: bank.lbaAccountNo, ifsc: bank.lbaIfscCode ?? null }
          : null,
        favouringName:
          bank?.lbaChequeName?.trim() || bank?.lbaAccountHolder?.trim() || party.ledName,
      },
    };
  }

  /**
   * notes (62) A4 — the prompt-payment discount the SUPPLIER gives us: their
   * `sup_cash_disc_perc` when we pay within their `sup_credit_days` of the bill
   * date, as one slab for the receipt's own parser (plan §3: "the same slab
   * parser seeds DISCOUNT_RECEIVED from the supplier's terms").
   * `accounts.ppd_slabs` is the discount WE give customers and was being
   * offered on every supplier bill.
   *
   * `sup_id` IS the ledger id (the two masters share one identity), so the
   * party names the supplier directly. A party that is not a supplier — a
   * customer being refunded, an expense ledger — has no terms and no discount.
   * The slab rules are the parser's: a percentage of 100 or more is not a
   * discount and is ignored.
   */
  private async loadSupplierDiscountTerms(partyId: string): Promise<PpdSlab[]> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { supId: partyId, supIsDeleted: false },
      select: { supCreditDays: true, supCashDiscPerc: true },
    });
    const perc = supplier ? supplier.supCashDiscPerc.toNumber() : 0;
    if (!supplier || perc <= 0 || perc >= 100 || supplier.supCreditDays < 0) {
      return [];
    }
    return [{ days: supplier.supCreditDays, perc }];
  }

  /** The party's open PAYABLES — CR on the party, what we owe them. */
  private async loadPayables(
    companyId: string,
    partyId: string,
    onDate: Date,
    settings: PaymentSettings,
    slabs: readonly PpdSlab[],
  ): Promise<PayableBill[]> {
    const bills = await this.prisma.accBillBalance.findMany({
      where: {
        ablCompanyId: companyId,
        ablPartyId: partyId,
        ablIsDeleted: false,
        ablIsActive: true,
        ablDrCr: 'CR',
        ablBillType: { in: [...PAYABLE_BILL_TYPES] },
        ablPendingAmount: { gt: 0 },
      },
      select: {
        ablId: true,
        ablAccYear: true,
        ablBillType: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablDueDate: true,
        ablBillAmount: true,
        ablPendingAmount: true,
        ablStatus: true,
        ablVoucherId: true,
      },
    });
    const keys = bills.map((bill) => ({ billId: bill.ablId, accYear: bill.ablAccYear }));
    const [pdcByBill, usrRefnoByVoucher] = await Promise.all([
      this.loadPostDatedHeld(keys, onDate),
      this.loadSupplierRefnos(
        bills.map((bill) => bill.ablVoucherId).filter((id): id is string => !!id),
      ),
    ]);

    const rows: PayableBill[] = bills.map((bill) => {
      const pending = bill.ablPendingAmount ?? ZERO;
      return {
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        billType: bill.ablBillType as BillType,
        docRefno: bill.ablDocRefno,
        usrRefno: bill.ablVoucherId ? (usrRefnoByVoucher.get(bill.ablVoucherId) ?? null) : null,
        docDate: toDateString(bill.ablDocDate)!,
        dueDate: toDateString(bill.ablDueDate),
        billAmount: toAmount(bill.ablBillAmount),
        pendingAmount: toAmount(pending),
        status: (bill.ablStatus ?? 'OPEN') as PayableBill['status'],
        daysOverdue: daysOverdue(bill.ablDueDate, onDate),
        pdcHeld: toAmount(pdcByBill.get(`${bill.ablId}|${bill.ablAccYear}`) ?? ZERO),
        ppdSuggested: toAmount(
          suggestPpdDiscount({
            docDate: bill.ablDocDate,
            onDate,
            pendingAmount: money(pending),
            slabs,
          }),
        ),
      };
    });

    const sortKeys = new Map(
      bills.map((bill) => [
        `${bill.ablId}|${bill.ablAccYear}`,
        { due: bill.ablDueDate ?? bill.ablDocDate, doc: bill.ablDocDate },
      ]),
    );
    const byBillDate = settings.billSort === ReceiptBillSort.BILL_DATE;
    const primary = (row: PayableBill): number => {
      const keys = sortKeys.get(`${row.billId}|${row.billAccYear}`)!;
      return (byBillDate ? keys.doc : keys.due).getTime();
    };
    rows.sort(
      (left, right) =>
        primary(left) - primary(right) || left.docRefno.localeCompare(right.docRefno),
    );
    return rows;
  }

  /** The supplier's own bill number, off the purchase voucher that raised the bill. */
  private async loadSupplierRefnos(
    voucherIds: readonly string[],
  ): Promise<Map<string, string | null>> {
    if (voucherIds.length === 0) {
      return new Map();
    }
    const headers = await this.prisma.accVoucherHeader.findMany({
      where: { avhVoucherId: { in: [...new Set(voucherIds)] } },
      select: { avhVoucherId: true, avhDocRefno: true },
    });
    return new Map(headers.map((header) => [header.avhVoucherId, header.avhDocRefno]));
  }

  private async loadPostDatedHeld(
    bills: readonly { billId: string; accYear: string }[],
    onDate: Date,
  ): Promise<Map<string, Prisma.Decimal>> {
    if (bills.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.accBillAdjustment.findMany({
      where: {
        abjIsDeleted: false,
        abjIsPostDated: true,
        abjAdjDate: { gt: onDate },
        OR: bills.map((bill) => ({ abjBillId: bill.billId, abjBillAccYear: bill.accYear })),
      },
      select: { abjBillId: true, abjBillAccYear: true, abjAmount: true },
    });
    const held = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const key = `${row.abjBillId}|${row.abjBillAccYear}`;
      held.set(key, (held.get(key) ?? ZERO).plus(row.abjAmount));
    }
    return held;
  }

  /**
   * Every unspent DEBIT the party holds of ours, oldest first: an advance we
   * paid, a debit note (PURCHASE_RETURN), an OPENING or JOURNAL debit. The
   * routing — which `abj_adj_type` it settles as — is decided here and returned
   * on the row, as the receipt's `loadCredits` does.
   */
  async loadHeldDebits(companyId: string, partyId: string): Promise<OpenCredit[]> {
    const debits = await this.prisma.accBillBalance.findMany({
      where: {
        ablCompanyId: companyId,
        ablPartyId: partyId,
        ablIsDeleted: false,
        ablIsActive: true,
        ablDrCr: 'DR',
        ablBillType: { in: [...HELD_DEBIT_BILL_TYPES] },
        ablPendingAmount: { gt: 0 },
      },
      select: {
        ablId: true,
        ablAccYear: true,
        ablBillType: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablBillAmount: true,
        ablPendingAmount: true,
        ablStatus: true,
        ablDrCr: true,
        ablSrcModule: true,
        ablSrcDocType: true,
        ablSrcDocId: true,
        ablSrcAccYear: true,
        ablNarration: true,
      },
      orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
    });
    return debits.map((debit) => {
      const routing = debitRouting(debit.ablBillType as BillType);
      return {
        billId: debit.ablId,
        billAccYear: debit.ablAccYear,
        billType: debit.ablBillType as BillType,
        docRefno: debit.ablDocRefno,
        docDate: toDateString(debit.ablDocDate)!,
        billAmount: toAmount(debit.ablBillAmount),
        pendingAmount: toAmount(debit.ablPendingAmount),
        srcModule: debit.ablSrcModule,
        srcDocType: debit.ablSrcDocType,
        srcDocId: debit.ablSrcDocId,
        srcAccYear: debit.ablSrcAccYear,
        narration: debit.ablNarration,
        status: (debit.ablStatus ?? 'OPEN') as OpenCredit['status'],
        drCr: debit.ablDrCr as OpenCredit['drCr'],
        adjType: routing.adjType,
        settlementMode: routing.settlementMode,
      };
    });
  }

  /** The party's default bank account (`acc_ledger_bank_accounts`), else its first live one. */
  private async loadDefaultBank(partyId: string) {
    return this.prisma.accLedgerBankAccount.findFirst({
      where: { lbaLedgerId: partyId, lbaIsDeleted: false, lbaIsActive: true },
      orderBy: [{ lbaIsDefault: 'desc' }],
      select: {
        lbaBankName: true,
        lbaAccountNo: true,
        lbaIfscCode: true,
        lbaChequeName: true,
        lbaAccountHolder: true,
      },
    });
  }

  // ─── §4.2 ──────────────────────────────────────────────────────────────────

  async partyContext(query: PartyContextQueryDto): Promise<PaymentPartyContextPayload> {
    const party = await loadPayee(this.prisma, query.companyId, query.partyId, 'partyId', {
      allowMoneyLedger: true,
    });
    const [payments, cheques, summary] = await Promise.all([
      this.loadRecentPayments(query.companyId, query.partyId),
      this.loadChequesOut(query.companyId, query.partyId),
      this.loadPartySummary(query.companyId, query.partyId),
    ]);
    return {
      partyId: query.partyId,
      partyName: party.ledName,
      summary,
      lastPayments: payments,
      ourChequesOut: cheques,
    };
  }

  private async loadPartySummary(
    companyId: string,
    partyId: string,
  ): Promise<PaymentPartyContextSummary> {
    const [sides, postDated] = await Promise.all([
      this.prisma.accBillBalance.groupBy({
        by: ['ablDrCr'],
        where: {
          ablCompanyId: companyId,
          ablPartyId: partyId,
          ablIsDeleted: false,
          ablIsActive: true,
        },
        _sum: { ablPendingAmount: true },
      }),
      // Our post-dated rows against this party not yet matured — the payment's
      // side of the party's account, so a party who is also a customer does not
      // have their own cheques counted as ours.
      this.prisma.accBillAdjustment.aggregate({
        where: {
          abjCompanyId: companyId,
          abjPartyId: partyId,
          abjIsDeleted: false,
          abjIsPostDated: true,
          abjDrCr: 'DR',
          abjAdjDate: { gt: todayUtc() },
        },
        _sum: { abjAmount: true },
      }),
    ]);
    const bySide = new Map(sides.map((row) => [row.ablDrCr, row._sum.ablPendingAmount ?? ZERO]));
    const outstanding = bySide.get('CR') ?? ZERO;
    const debits = bySide.get('DR') ?? ZERO;
    return {
      totalBalance: toAmount(outstanding.minus(debits)),
      totalOutstanding: toAmount(outstanding),
      totalCredits: toAmount(debits),
      chequesOutstanding: toAmount(postDated._sum.abjAmount ?? ZERO),
    };
  }

  private async loadRecentPayments(
    companyId: string,
    partyId: string,
  ): Promise<PartyRecentPayment[]> {
    const headers = await this.prisma.accVoucherHeader.findMany({
      where: {
        avhCompanyId: companyId,
        avhPartyId: partyId,
        avhIsDeleted: false,
        avhVoucherStatus: 'POSTED',
        voucherType: { vchrTypeCode: PAYMENT_VOUCHER_TYPE_CODE },
        avhAgainstVoucherId: null,
      },
      select: {
        avhVoucherId: true,
        avhAccYear: true,
        avhVoucherRefno: true,
        avhVoucherDate: true,
        avhDocAmount: true,
        avhAdjustAmount: true,
      },
      orderBy: [{ avhVoucherDate: 'desc' }, { avhVoucherSlno: 'desc' }],
      take: 10,
    });
    if (headers.length === 0) {
      return [];
    }
    const tenders = await this.prisma.accTenderDetail.findMany({
      where: {
        tdSrcDocId: { in: headers.map((header) => header.avhVoucherId) },
        tdIsDeleted: false,
      },
      select: { tdSrcDocId: true, tenderType: { select: { ttmDisplayName: true } } },
    });
    const instrumentsByVoucher = new Map<string, Set<string>>();
    for (const tender of tenders) {
      const name = tender.tenderType?.ttmDisplayName;
      if (!name) {
        continue;
      }
      const set = instrumentsByVoucher.get(tender.tdSrcDocId) ?? new Set<string>();
      set.add(name);
      instrumentsByVoucher.set(tender.tdSrcDocId, set);
    }
    return headers.map((header) => ({
      voucherId: header.avhVoucherId,
      accYear: header.avhAccYear,
      voucherRefno: header.avhVoucherRefno,
      voucherDate: toDateString(header.avhVoucherDate)!,
      docAmount: toAmount(header.avhDocAmount),
      adjustAmount: toAmount(header.avhAdjustAmount),
      instruments:
        [...(instrumentsByVoucher.get(header.avhVoucherId) ?? [])].sort().join(', ') || null,
    }));
  }

  /** OUR cheques to the party still HELD — `apd_tra_type 'P'`, with the book they came from. */
  private async loadChequesOut(companyId: string, partyId: string): Promise<PartyChequeOut[]> {
    const rows = await this.prisma.$queryRaw<
      {
        apd_id: string;
        apd_acc_year: string;
        apd_instrument_no: string;
        apd_instrument_date: Date;
        apd_amount: Prisma.Decimal;
        apd_bank_name: string | null;
        acb_book_no: string | null;
        apd_status: string;
        apd_voucher_id: string | null;
        avh_voucher_refno: string | null;
      }[]
    >`
      SELECT p.apd_id, p.apd_acc_year, p.apd_instrument_no, p.apd_instrument_date, p.apd_amount,
             p.apd_bank_name, b.acb_book_no, p.apd_status, p.apd_voucher_id, h.avh_voucher_refno
        FROM accounts.acc_pdc_register p
        LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year
       WHERE p.apd_company_id = ${companyId}::uuid
         AND p.apd_party_id   = ${partyId}::uuid
         AND p.apd_tra_type   = ${PdcTraType.PAID}
         AND p.apd_is_deleted = false
         AND p.apd_status     = 'HELD'
       ORDER BY p.apd_instrument_date, p.apd_instrument_no`;
    return rows.map((row) => ({
      pdcId: row.apd_id,
      accYear: row.apd_acc_year.trim(),
      instrumentNo: row.apd_instrument_no,
      instrumentDate: toDateString(row.apd_instrument_date)!,
      amount: toAmount(row.apd_amount),
      bankName: row.apd_bank_name,
      bookNo: row.acb_book_no,
      status: row.apd_status as PartyChequeOut['status'],
      voucherId: row.apd_voucher_id,
      voucherRefno: row.avh_voucher_refno,
    }));
  }

  // ─── R-B4 ──────────────────────────────────────────────────────────────────

  async adjacent(query: AdjacentVoucherQueryDto): Promise<AdjacentVoucherPayload> {
    const current = await this.prisma.accVoucherHeader.findFirst({
      where: {
        avhVoucherId: query.voucherId,
        avhAccYear: query.accYear,
        avhCompanyId: query.companyId,
        avhBranchId: query.branchId,
        avhIsDeleted: false,
        // notes (62) A2: walked FROM one of this module's own vouchers only.
        voucherType: { vchrTypeCode: PAYMENT_VOUCHER_TYPE_CODE },
      },
      select: { avhVoucherDate: true, avhVoucherSlno: true, avhCreatedOn: true },
    });
    if (!current) {
      throwAccountsNotFound<PaymentErrorDetail>(
        'Payment not found',
        'voucherId',
        `No payment ${query.voucherId} in ${query.accYear} for this company and branch`,
      );
    }
    const isPrev = query.direction === 'prev';
    const comparison = Prisma.raw(isPrev ? '<' : '>');
    const order = Prisma.raw(isPrev ? 'DESC' : 'ASC');
    const status = query.status ?? null;
    // `avh_voucher_date` is a DATE, so every bound is passed and compared as
    // one. Passing a JS Date and casting it to timestamptz — what the receipt's
    // walk does — compares midnight UTC with the date read in the SESSION
    // timezone (Asia/Kolkata here): 2026-09-29 becomes 2026-09-28 18:30Z, a
    // window of one day matches nothing, and every same-day row sorts below
    // the voucher being walked from.
    const fromDate = query.fromDate ? query.fromDate.slice(0, 10) : null;
    const toDate = query.toDate ? query.toDate.slice(0, 10) : null;
    const currentDate = toDateString(current.avhVoucherDate)!;

    const rows = await this.prisma.$queryRaw<AdjacentRow[]>`
      SELECT h.avh_voucher_id, h.avh_acc_year, h.avh_company_id, h.avh_branch_id,
             h.avh_voucher_refno, h.avh_voucher_date, h.avh_party_id, p.led_name,
             h.avh_doc_amount, h.avh_voucher_status
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id
       WHERE h.avh_company_id = ${query.companyId}::uuid
         AND h.avh_branch_id  = ${query.branchId}::uuid
         AND h.avh_acc_year   = ${query.accYear}::bpchar
         AND vt.vchr_type_code = ${PAYMENT_VOUCHER_TYPE_CODE}
         AND h.avh_is_deleted = false
         AND h.avh_against_voucher_id IS NULL
         AND (${status}::varchar IS NULL OR h.avh_voucher_status = ${status}::varchar)
         AND (${fromDate}::date IS NULL OR h.avh_voucher_date >= ${fromDate}::date)
         AND (${toDate}::date   IS NULL OR h.avh_voucher_date <= ${toDate}::date)
         AND (h.avh_voucher_date,
              COALESCE(h.avh_voucher_slno, ${DRAFT_SLNO_SENTINEL}),
              h.avh_created_on,
              h.avh_voucher_id)
             ${comparison}
             (${currentDate}::date,
              COALESCE(${current.avhVoucherSlno}::bigint, ${DRAFT_SLNO_SENTINEL}),
              ${current.avhCreatedOn}::timestamptz,
              ${query.voucherId}::uuid)
       ORDER BY h.avh_voucher_date ${order},
                COALESCE(h.avh_voucher_slno, ${DRAFT_SLNO_SENTINEL}) ${order},
                h.avh_created_on ${order},
                h.avh_voucher_id ${order}
       LIMIT 1`;
    const row = rows[0];
    return {
      direction: query.direction,
      fromVoucherId: query.voucherId,
      voucher: row ? toAdjacentVoucher(row) : null,
    };
  }

  // ─── R-B6 ──────────────────────────────────────────────────────────────────

  /** "Has this party already been paid this much on this date?" A WARNING, never a refusal. */
  async duplicateCheck(query: DuplicateCheckQueryDto): Promise<DuplicateCheckPayload> {
    await loadPayee(this.prisma, query.companyId, query.partyId, 'partyId', {
      allowMoneyLedger: true,
    });
    const matches = await this.prisma.accVoucherHeader.findMany({
      where: {
        avhCompanyId: query.companyId,
        avhAccYear: query.accYear,
        avhPartyId: query.partyId,
        ...(query.branchId ? { avhBranchId: query.branchId } : {}),
        avhVoucherDate: toDateOnly(query.voucherDate),
        avhDocAmount: money(query.amount),
        avhIsDeleted: false,
        avhVoucherStatus: { not: VoucherStatus.CANCELLED },
        avhAgainstVoucherId: null,
        voucherType: { vchrTypeCode: PAYMENT_VOUCHER_TYPE_CODE },
        ...(query.excludeVoucherId ? { avhVoucherId: { not: query.excludeVoucherId } } : {}),
      },
      select: {
        avhVoucherId: true,
        avhAccYear: true,
        avhBranchId: true,
        avhVoucherRefno: true,
        avhVoucherDate: true,
        avhDocAmount: true,
        avhVoucherStatus: true,
        avhCreatedBy: true,
        avhCreatedOn: true,
      },
      orderBy: [{ avhCreatedOn: 'desc' }],
      take: 10,
    });
    const rows = matches.map((match) => ({
      voucherId: match.avhVoucherId,
      accYear: match.avhAccYear,
      branchId: match.avhBranchId,
      voucherRefno: match.avhVoucherRefno,
      voucherDate: toDateString(match.avhVoucherDate)!,
      docAmount: toAmount(match.avhDocAmount),
      status: match.avhVoucherStatus as VoucherStatus,
      createdBy: match.avhCreatedBy,
      createdOn: toIsoString(match.avhCreatedOn)!,
    }));
    return { isDuplicate: rows.length > 0, matches: rows };
  }

  // ─── Shared ────────────────────────────────────────────────────────────────

  async loadSettings(companyId: string, branchId?: string | null): Promise<PaymentSettings> {
    const effective = await this.appSettingValueService.resolveEffective({
      companyId,
      branchId: branchId ?? undefined,
    });
    return readPaymentSettings(effective);
  }
}

const DRAFT_SLNO_SENTINEL = 9223372036854775807n;

interface AdjacentRow {
  avh_voucher_id: string;
  avh_acc_year: string;
  avh_company_id: string;
  avh_branch_id: string;
  avh_voucher_refno: string | null;
  avh_voucher_date: Date;
  avh_party_id: string;
  led_name: string | null;
  avh_doc_amount: Prisma.Decimal;
  avh_voucher_status: string;
}

function toAdjacentVoucher(row: AdjacentRow): AdjacentVoucher {
  return {
    voucherId: row.avh_voucher_id,
    accYear: row.avh_acc_year,
    companyId: row.avh_company_id,
    branchId: row.avh_branch_id,
    voucherRefno: row.avh_voucher_refno,
    voucherDate: toDateString(row.avh_voucher_date)!,
    partyId: row.avh_party_id,
    partyName: row.led_name,
    docAmount: toAmount(row.avh_doc_amount),
    status: row.avh_voucher_status as VoucherStatus,
  };
}
