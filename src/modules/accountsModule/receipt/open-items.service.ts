import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import {
  BillAdjType,
  BillSettlementMode,
  BillType,
  CREDIT_BILL_TYPES,
  RECEIPT_VOUCHER_TYPE_CODE,
  RECEIVABLE_BILL_TYPES,
  ReceiptBillSort,
  TcsBasis,
} from './types/receipt-enum';
import type {
  OpenBill,
  OpenCredit,
  OpenItemsPayload,
  OpenItemsParty,
  PartyContextPayload,
  PartyPendingCheque,
  PartyRecentReceipt,
} from './types/receipt-api.types';
import { ListOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { loadParty } from './receipt.guards';
import { readReceiptSettings, type ReceiptSettings } from './receipt.settings';
import { suggestPpdDiscount } from './ppd-slab';
import {
  daysOverdue,
  money,
  sum,
  toAmount,
  toDateOnly,
  toDateString,
  todayUtc,
  ZERO,
} from './receipt.utils';

/**
 * §4.1 and §4.2 — everything the receipt screen reads before a single figure is
 * keyed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ONE ANSWER TO "WHAT DOES THIS PARTY OWE AND HOLD"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * §12: "no second SELECT for what this party owes — open-items is it;
 * party-balance calls it." `TransactionService.getPartyAdjustableCredits` now
 * delegates to `loadCredits` below rather than keeping its own statement, so
 * the credit panel on the sale bill and the credit panel on the receipt cannot
 * come to different answers about the same advance.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NO ACCOUNTING YEAR, NO BRANCH, NO PAGING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No year: `acc_bill_balance` is partitioned by the year a bill ORIGINATED in
 * and is never carried forward. Filtering on the entry screen's year would drop
 * every bill raised before it — and since clients run year-end generation on
 * 1 April and then key the March receipts they missed, those are precisely the
 * bills the operator is looking for.
 *
 * No branch: a customer pays one cheque for bills raised at three branches.
 *
 * No paging (§12): a capped list is a WRONG collection, not a slow one. The
 * operator ticks bills until the money runs out, and a bill below the cap is a
 * bill that gets collected twice.
 */
@Injectable()
export class OpenItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingValueService: AppSettingValueService,
  ) {}

  // ─── §4.1 ──────────────────────────────────────────────────────────────────

  async listOpenItems(query: ListOpenItemsQueryDto): Promise<OpenItemsPayload> {
    // ONE partyId. A customer id, a supplier id and a ledger id are the same
    // value in this database — sales.customers.cus_id IS
    // accounts.acc_ledger_master.led_id, set that way when the customer is
    // created — so there is nothing to resolve and no bridge to be missing.
    const partyId = query.partyId;
    const onDate = query.onDate ? toDateOnly(query.onDate) : todayUtc();

    const [party, settings] = await Promise.all([
      loadParty(this.prisma, query.companyId, partyId, 'partyId'),
      this.loadSettings(query.companyId),
    ]);

    const [bills, credits] = await Promise.all([
      this.loadBills(query.companyId, partyId, onDate, settings),
      this.loadCredits(query.companyId, partyId),
    ]);

    const partyPayload: OpenItemsParty = {
      ledId: party.ledId,
      ledName: party.ledName,
      groupName: party.groupName,
      isBillByBill: party.ledIsBillByBill,
      isTdsApplicable: party.ledIsTdsApplicable,
      tdsDeducteeType: party.ledTdsDeducteeType,
      isTcsApplicable: party.ledIsTcsApplicable,
      tcsBasis: settings.tcsBasis,
      tanNo: party.ledTanNo,
    };

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
      party: partyPayload,
    };
  }

  /**
   * The party's open receivables, each with what is promised against it but not
   * yet matured.
   *
   * `pdcHeld` is the field this screen cannot do without. A bill settled
   * entirely by a cheque maturing next week still shows its full pending amount
   * — correctly, because the money has not arrived — and without a column
   * saying WHY, it is indistinguishable from a bill nobody has paid. The
   * operator collects it a second time.
   */
  private async loadBills(
    companyId: string,
    partyId: string,
    onDate: Date,
    settings: ReceiptSettings,
  ): Promise<OpenBill[]> {
    const bills = await this.prisma.accBillBalance.findMany({
      where: {
        ablCompanyId: companyId,
        ablPartyId: partyId,
        ablIsDeleted: false,
        ablIsActive: true,
        ablDrCr: 'DR',
        ablBillType: { in: [...RECEIVABLE_BILL_TYPES] },
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
      },
    });

    const billKeys = bills.map((bill) => ({ billId: bill.ablId, accYear: bill.ablAccYear }));
    const [pdcByBill, tcsByBill] = await Promise.all([
      this.loadPostDatedHeld(billKeys, onDate),
      this.loadBillTcs(billKeys, settings),
    ]);

    const rows = bills.map((bill) => {
      const pending = bill.ablPendingAmount ?? ZERO;
      return {
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        billType: bill.ablBillType as BillType,
        docRefno: bill.ablDocRefno,
        docDate: toDateString(bill.ablDocDate)!,
        dueDate: toDateString(bill.ablDueDate),
        billAmount: toAmount(bill.ablBillAmount),
        pendingAmount: toAmount(pending),
        status: (bill.ablStatus ?? 'OPEN') as OpenBill['status'],
        daysOverdue: daysOverdue(bill.ablDueDate, onDate),
        pdcHeld: toAmount(pdcByBill.get(`${bill.ablId}|${bill.ablAccYear}`) ?? ZERO),
        ppdSuggested: toAmount(
          suggestPpdDiscount({
            docDate: bill.ablDocDate,
            onDate,
            pendingAmount: money(pending),
            slabs: settings.ppdSlabs,
          }),
        ),
        // §2.13. Both 0 on the RECEIPT basis, where the invoice carries no TCS
        // and the receipt collects it instead.
        tcsAmount: toAmount(tcsByBill.get(`${bill.ablId}|${bill.ablAccYear}`)?.amount ?? ZERO),
        tcsPending: toAmount(tcsByBill.get(`${bill.ablId}|${bill.ablAccYear}`)?.pending ?? ZERO),
      };
    });

    // The sort keys live BESIDE the rows rather than on them, so the payload
    // type stays exactly OpenBill and nothing has to be stripped back off it.
    const sortKeys = new Map(
      bills.map((bill) => [
        `${bill.ablId}|${bill.ablAccYear}`,
        { due: bill.ablDueDate ?? bill.ablDocDate, doc: bill.ablDocDate },
      ]),
    );

    // R12 — the order is a setting, and it is not cosmetic: it is the order
    // money fills the bills in at post, so DUE_DATE settles what is most
    // overdue first and BILL_DATE is plain FIFO. The refno tie-break is not
    // decoration either — two bills of the same date must not swap places
    // between two fetches, or the operator's ticks land on different rows than
    // the ones they looked at.
    const byBillDate = settings.billSort === ReceiptBillSort.BILL_DATE;
    const primary = (row: OpenBill): number => {
      const keys = sortKeys.get(`${row.billId}|${row.billAccYear}`)!;
      return (byBillDate ? keys.doc : keys.due).getTime();
    };

    rows.sort(
      (left, right) =>
        primary(left) - primary(right) || left.docRefno.localeCompare(right.docRefno),
    );

    return rows;
  }

  /**
   * Post-dated money already promised against these bills, per bill.
   *
   * The same predicate `BillBalanceRecomputeService` excludes from the cached
   * totals — a row that is post-dated and has not matured. The two must agree:
   * this is what the bill's pending amount will FALL BY when the cheque
   * matures, so if they disagreed the screen would promise a settlement that
   * never arrives.
   */
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
   * §2.13 — bill-wise TCS: how much is charged inside each bill, and how much
   * of it has not been collected yet.
   *
   * ── Why this reads a VIEW and not the column ─────────────────────────────
   * `abl_tcs_amount` is the charge; the PENDING half is a function of
   * `abl_alloc_amount`, which the recompute service rewrites on every post,
   * cancel and PDC maturity. `accounts.v_bill_tcs` derives both in one place,
   * pro-rata, so this screen and any TCS report cannot come to different
   * answers about the same bill — the same rule §12 applies to "what does this
   * party owe".
   *
   * Pro-rata is the only defensible split: a part payment pays the WHOLE bill
   * proportionally, because the customer does not get to pay for the goods and
   * withhold the tax, and the department does not accept that they did.
   *
   * ── Why it returns nothing on the RECEIPT basis ──────────────────────────
   * On `accounts.tcs_basis = 'RECEIPT'` the invoice carries no TCS: the receipt
   * collects it, as a TCS_PAYABLE leg. Every bill would answer 0, so the query
   * is skipped entirely rather than run to produce a map of zeroes — and the
   * two bases never both apply.
   */
  private async loadBillTcs(
    bills: readonly { billId: string; accYear: string }[],
    settings: ReceiptSettings,
  ): Promise<Map<string, { amount: Prisma.Decimal; pending: Prisma.Decimal }>> {
    if (bills.length === 0 || settings.tcsBasis !== TcsBasis.SALES) {
      return new Map();
    }

    // Raw, because the view is not a Prisma model. Parameterised as two arrays
    // zipped by ordinality — never interpolated — so a bill id can carry no SQL.
    const rows = await this.prisma.$queryRaw<
      Array<{
        bill_id: string;
        bill_acc_year: string;
        abl_tcs_amount: Prisma.Decimal;
        tcs_pending: Prisma.Decimal;
      }>
    >`
      SELECT v.bill_id, v.bill_acc_year, v.abl_tcs_amount, v.tcs_pending
        FROM accounts.v_bill_tcs v
        JOIN unnest(${bills.map((bill) => bill.billId)}::uuid[],
                    ${bills.map((bill) => bill.accYear)}::bpchar[]) AS k(bill_id, acc_year)
          ON k.bill_id = v.bill_id AND k.acc_year = v.bill_acc_year
       WHERE v.abl_tcs_amount > 0`;

    const tcs = new Map<string, { amount: Prisma.Decimal; pending: Prisma.Decimal }>();
    for (const row of rows) {
      tcs.set(`${row.bill_id}|${row.bill_acc_year}`, {
        amount: row.abl_tcs_amount,
        pending: row.tcs_pending,
      });
    }
    return tcs;
  }

  /**
   * Every unspent credit the party holds, oldest first.
   *
   * PUBLIC and exported by the module because `/transactions/party-balance`
   * calls it (§12). The routing — which `abj_adj_type` and
   * `abj_settlement_mode` each credit settles as — is decided here and returned
   * on the row, so one tender can hold a mixed set of credits and no client has
   * to re-derive a rule that `ck_abj_adj_type` is the real authority on.
   */
  async loadCredits(
    companyId: string,
    partyId: string,
    /**
     * CR — the default, and what a RECEIPT offers — is what the company owes
     * the party. DR is the mirror, for the payment voucher: a supplier advance
     * this company has already paid out.
     *
     * Never left unfiltered. ADVANCE is bidirectional in this schema, so a
     * party who is both customer and supplier would otherwise be offered their
     * own supplier advances to settle a sales invoice.
     */
    side: 'CR' | 'DR' = 'CR',
  ): Promise<OpenCredit[]> {
    const credits = await this.prisma.accBillBalance.findMany({
      where: {
        ablCompanyId: companyId,
        ablPartyId: partyId,
        ablIsDeleted: false,
        ablIsActive: true,
        ablDrCr: side,
        ablBillType: { in: [...CREDIT_BILL_TYPES] },
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
      // Oldest first. FIFO is what the ageing report assumes and what a
      // customer expects of their own money; the refno tie-break keeps two
      // credits of the same date from swapping places between two fetches.
      orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
    });

    return credits.map((credit) => {
      const routing = creditRouting(credit.ablBillType as BillType);
      return {
        billId: credit.ablId,
        billAccYear: credit.ablAccYear,
        billType: credit.ablBillType as BillType,
        docRefno: credit.ablDocRefno,
        docDate: toDateString(credit.ablDocDate)!,
        billAmount: toAmount(credit.ablBillAmount),
        pendingAmount: toAmount(credit.ablPendingAmount),
        srcModule: credit.ablSrcModule,
        srcDocType: credit.ablSrcDocType,
        srcDocId: credit.ablSrcDocId,
        srcAccYear: credit.ablSrcAccYear,
        narration: credit.ablNarration,
        status: (credit.ablStatus ?? 'OPEN') as OpenCredit['status'],
        drCr: credit.ablDrCr as OpenCredit['drCr'],
        adjType: routing.adjType,
        settlementMode: routing.settlementMode,
      };
    });
  }

  // ─── §4.2 ──────────────────────────────────────────────────────────────────

  /**
   * The two panels 3.0's screen shows beside the entry grid: what this party
   * paid last, and what of theirs the drawer is still holding.
   *
   * Read-only context, and small by construction — ten receipts and however
   * many cheques are outstanding — so it needs no cap. A party with a hundred
   * uncleared cheques is a collections problem the panel should show, not hide
   * behind a "more" button.
   */
  async partyContext(query: PartyContextQueryDto): Promise<PartyContextPayload> {
    const [receipts, cheques] = await Promise.all([
      this.loadRecentReceipts(query.companyId, query.partyId),
      this.loadPendingCheques(query.companyId, query.partyId),
    ]);

    return { partyId: query.partyId, lastReceipts: receipts, pendingCheques: cheques };
  }

  private async loadRecentReceipts(
    companyId: string,
    partyId: string,
  ): Promise<PartyRecentReceipt[]> {
    // ix_avh_party is (company, party, date) WHERE not deleted AND POSTED —
    // which is exactly this predicate, so the ORDER BY and the LIMIT are served
    // from the index.
    const headers = await this.prisma.accVoucherHeader.findMany({
      where: {
        avhCompanyId: companyId,
        avhPartyId: partyId,
        avhIsDeleted: false,
        avhVoucherStatus: 'POSTED',
        voucherType: { vchrTypeCode: RECEIPT_VOUCHER_TYPE_CODE },
        // A post-dated cheque's own voucher is part of its receipt, not a
        // receipt of its own. Showing both would report one collection twice.
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

  private async loadPendingCheques(
    companyId: string,
    partyId: string,
  ): Promise<PartyPendingCheque[]> {
    const cheques = await this.prisma.accPdcRegister.findMany({
      where: {
        apdCompanyId: companyId,
        apdPartyId: partyId,
        apdIsDeleted: false,
        // HELD and DEPOSITED — money still in flight. ix_apd_party is built on
        // exactly this pair.
        apdStatus: { in: ['HELD', 'DEPOSITED'] },
      },
      select: {
        apdId: true,
        apdAccYear: true,
        apdInstrumentNo: true,
        apdInstrumentDate: true,
        apdAmount: true,
        apdBankName: true,
        apdStatus: true,
        apdVoucherId: true,
        receiptVoucher: { select: { avhVoucherRefno: true } },
      },
      orderBy: [{ apdInstrumentDate: 'asc' }, { apdInstrumentNo: 'asc' }],
    });

    return cheques.map((cheque) => ({
      pdcId: cheque.apdId,
      accYear: cheque.apdAccYear,
      instrumentNo: cheque.apdInstrumentNo,
      instrumentDate: toDateString(cheque.apdInstrumentDate)!,
      amount: toAmount(cheque.apdAmount),
      bankName: cheque.apdBankName,
      status: cheque.apdStatus as PartyPendingCheque['status'],
      voucherId: cheque.apdVoucherId,
      voucherRefno: cheque.receiptVoucher?.avhVoucherRefno ?? null,
    }));
  }

  // ─── Shared ────────────────────────────────────────────────────────────────

  /** The seven settings, resolved once, through the resolver and never around it. */
  async loadSettings(companyId: string, branchId?: string | null): Promise<ReceiptSettings> {
    const effective = await this.appSettingValueService.resolveEffective({
      companyId,
      branchId: branchId ?? undefined,
    });
    return readReceiptSettings(effective);
  }
}

/**
 * How each kind of credit settles. A superset of `CREDIT_ADJUSTMENT_ROUTING`
 * in the transaction module, restated here because this module owns the write
 * side: `ck_abj_adj_type` is the authority, and an advance posts as
 * ADVANCE_ADJUST while a credit note posts as NOTE_ADJUST.
 *
 * SALES_RETURN is a note — there is a document the customer was handed, and
 * NOTE_ADJUST / CREDIT_NOTE is what a credit-note register reports on.
 * Everything else in `CREDIT_BILL_TYPES` is money the company holds and has
 * not earned, which is what an advance IS whether a receipt, an opening
 * balance or a journal put it there — so ADVANCE, OPENING and JOURNAL all post
 * as ADVANCE_ADJUST / ADVANCE. Both routes name the opposite bill, so both
 * satisfy `ck_abj_against` with no migration.
 */
function creditRouting(billType: BillType): {
  adjType: BillAdjType;
  settlementMode: BillSettlementMode;
} {
  return billType === BillType.SALES_RETURN
    ? { adjType: BillAdjType.NOTE_ADJUST, settlementMode: BillSettlementMode.CREDIT_NOTE }
    : { adjType: BillAdjType.ADVANCE_ADJUST, settlementMode: BillSettlementMode.ADVANCE };
}

export { creditRouting };
