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
  VoucherStatus,
} from './types/receipt-enum';
import type {
  AdjacentVoucher,
  AdjacentVoucherPayload,
  DuplicateCheckPayload,
  DuplicateReceipt,
  OpenBill,
  OpenCredit,
  OpenItemsPayload,
  OpenItemsParty,
  PartyContextPayload,
  PartyContextSummary,
  PartyPendingCheque,
  PartyRecentReceipt,
  ReceiptErrorDetail,
} from './types/receipt-api.types';
import {
  AdjacentVoucherQueryDto,
  DuplicateCheckQueryDto,
  ListOpenItemsQueryDto,
  PartyContextQueryDto,
} from './dto/open-item.dto';
import { loadParty } from './receipt.guards';
import { throwAccountsNotFound } from 'src/common/utils/module-service.utils';
import { readReceiptSettings, type ReceiptSettings } from './receipt.settings';
import { suggestPpdDiscount } from './ppd-slab';
import {
  daysOverdue,
  money,
  sum,
  toAmount,
  toDateOnly,
  toDateString,
  toIsoString,
  todayUtc,
  toNullableAmount,
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

    const [loadedBills, credits] = await Promise.all([
      this.loadBills(query.companyId, partyId, onDate, settings),
      this.loadCredits(query.companyId, partyId),
    ]);
    // HANDOVER 2026-09-20 §7: the temp-credit WHO rides along, and `?mobile=`
    // narrows to the bills that person owes.
    const bills = await this.attachTempCredits(loadedBills, query.mobile?.trim() || null);

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
  private async attachTempCredits(bills: OpenBill[], mobile: string | null): Promise<OpenBill[]> {
    if (bills.length === 0) {
      return bills;
    }
    const rows = await this.prisma.$queryRaw<
      {
        atc_id: string;
        atc_abl_id: string;
        atc_abl_acc_year: string;
        atc_name: string;
        atc_mobile: string;
        atc_due_date: Date;
        atc_balance_amount: Prisma.Decimal;
        atc_status: string;
      }[]
    >`
      SELECT atc_id, atc_abl_id, atc_abl_acc_year, atc_name, atc_mobile, atc_due_date, atc_balance_amount, atc_status
        FROM accounts.acc_temp_credit
       WHERE atc_is_deleted = false AND atc_status <> 'CANCELLED'
         AND (atc_abl_id, atc_abl_acc_year) IN (${Prisma.join(bills.map((b) => Prisma.sql`(${b.billId}::uuid, ${b.billAccYear}::char(9))`))})`;
    const by = new Map(rows.map((r) => [`${r.atc_abl_id}|${r.atc_abl_acc_year.trim()}`, r]));
    const out = bills.map((b) => {
      const r = by.get(`${b.billId}|${b.billAccYear.trim()}`);
      return {
        ...b,
        tempCredit: r
          ? {
              atcId: r.atc_id,
              name: r.atc_name,
              mobile: r.atc_mobile,
              dueDate: r.atc_due_date ? r.atc_due_date.toISOString().slice(0, 10) : null,
              balance: Number(r.atc_balance_amount.toString()),
              status: r.atc_status,
            }
          : null,
      };
    });
    return mobile ? out.filter((b) => b.tempCredit?.mobile === mobile) : out;
  }

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
        ablSrcModule: true,
        ablSrcDocType: true,
        ablSrcDocId: true,
        ablSrcAccYear: true,
      },
    });

    const billKeys = bills.map((bill) => ({ billId: bill.ablId, accYear: bill.ablAccYear }));
    const [pdcByBill, tcsByBill, sourceByBill] = await Promise.all([
      this.loadPostDatedHeld(billKeys, onDate),
      this.loadBillTcs(billKeys, settings),
      this.loadSourceBillFacts(bills),
    ]);

    const rows = bills.map((bill) => {
      const pending = bill.ablPendingAmount ?? ZERO;
      const source = sourceByBill.get(`${bill.ablId}|${bill.ablAccYear}`);
      return {
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        billType: bill.ablBillType as BillType,
        docRefno: bill.ablDocRefno,
        // R-B8 / R-B7. Null when the bill has no invoice behind it to read
        // them off — an OPENING balance has no lines and no customer reference.
        usrRefno: source?.usrRefno ?? null,
        billProfit: toNullableAmount(source?.profit ?? null),
        billProfitPreTax: toNullableAmount(source?.profitPreTax ?? null),
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
   * R-B7 and R-B8 — the two things the screen wants that live on the INVOICE
   * rather than on the outstanding row: the customer's own reference, and the
   * margin the bill earned.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  WHY THESE ARE FETCHED AND NOT STORED
   * ═══════════════════════════════════════════════════════════════════════
   *
   * `acc_bill_balance` is a BALANCE. It carries the bill's identity and what is
   * left on it, and `bill-posting.helper.ts` says so where it fills the row:
   * "sb_usr_refno is not carried here". Copying either field onto the balance
   * would make it a second copy of a fact the invoice owns — stale the first
   * time the invoice is corrected, and on a screen whose whole job is to be
   * right about what is pending RIGHT NOW.
   *
   * So the balance row points at its source (`abl_src_module` /
   * `abl_src_doc_type` / `abl_src_doc_id` / `abl_src_acc_year`, which
   * `ck_abl_src_doc` keeps together), and this follows the pointer.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  ONLY A SALES BILL HAS EITHER
   * ═══════════════════════════════════════════════════════════════════════
   *
   * `RECEIVABLE_BILL_TYPES` also contains OPENING, JOURNAL, INTEREST and
   * PURCHASE_RETURN. None of those has a sale bill behind it — an OPENING
   * balance is a lump-sum legacy figure with no lines at all — so all three
   * fields stay null and the client shows them blank. A zero would be a claim
   * that the bill earned nothing, which is a different and wrong statement.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  THE PROFIT ARITHMETIC, AND ITS ONE TRAP
   * ═══════════════════════════════════════════════════════════════════════
   *
   * `sbi_item_profit` and `sbi_profit_pre_tax` are PER UNIT. This is easy to
   * get wrong because both are `numeric(15,2)` like the line amounts beside
   * them, and the schema comment that says so sits three fields above them —
   * but the data settles it: two lines of the same item at the same rate, one
   * for 3 units and one for 10, both carry `sbi_item_profit = 25.23`. So the
   * bill's margin is `Σ (per-unit profit × sbi_net_qty)`, and summing the
   * column on its own would understate a ten-unit line by ninety per cent.
   *
   * **A line with no profit figure poisons the bill's total.** Neither column
   * is NOT NULL and neither is computed server-side — `/bills/create` stores
   * what the billing screen sent — so a bill can perfectly well hold three
   * costed lines and one that was never costed. Summing the three would report
   * a margin lower than the real one, and the single decision this figure
   * exists to inform is whether a discount can be afforded. An understated
   * margin talks the operator out of a discount they could have given, and
   * quietly: there is nothing on the screen to say the figure was partial. So
   * the bill answers null unless EVERY live line carries the figure.
   */
  private async loadSourceBillFacts(
    bills: readonly {
      ablId: string;
      ablAccYear: string;
      ablSrcModule: string | null;
      ablSrcDocType: string | null;
      ablSrcDocId: string | null;
      ablSrcAccYear: string | null;
    }[],
  ): Promise<Map<string, SourceBillFacts>> {
    const sourced = bills.filter(
      (bill) =>
        bill.ablSrcModule === SALE_BILL_SRC_MODULE &&
        bill.ablSrcDocType === SALE_BILL_SRC_DOC_TYPE &&
        bill.ablSrcDocId !== null &&
        bill.ablSrcAccYear !== null,
    );
    if (sourced.length === 0) {
      return new Map();
    }

    // De-duplicated: two bills cannot share a source document today, but the
    // key is what the two queries are addressed by and a duplicate in the OR
    // list is a duplicate row back.
    const sourceKeys = new Map<string, { docId: string; accYear: string }>();
    for (const bill of sourced) {
      sourceKeys.set(`${bill.ablSrcDocId!}|${bill.ablSrcAccYear!}`, {
        docId: bill.ablSrcDocId!,
        accYear: bill.ablSrcAccYear!,
      });
    }
    const keys = [...sourceKeys.values()];

    const [saleBills, items] = await Promise.all([
      this.prisma.saleBill.findMany({
        where: { OR: keys.map((key) => ({ sbId: key.docId, sbAccYear: key.accYear })) },
        select: { sbId: true, sbAccYear: true, sbUsrRefno: true },
      }),
      this.prisma.saleBillItem.findMany({
        where: {
          sbiIsDeleted: false,
          OR: keys.map((key) => ({ sbiBillId: key.docId, sbiAccYear: key.accYear })),
        },
        select: {
          sbiBillId: true,
          sbiAccYear: true,
          sbiNetQty: true,
          sbiItemProfit: true,
          sbiProfitPreTax: true,
        },
      }),
    ]);

    const refnoBySource = new Map<string, string | null>();
    for (const bill of saleBills) {
      refnoBySource.set(`${bill.sbId}|${bill.sbAccYear}`, bill.sbUsrRefno);
    }

    const marginBySource = new Map<string, Margin>();
    for (const item of items) {
      const key = `${item.sbiBillId}|${item.sbiAccYear}`;
      const margin = marginBySource.get(key) ?? {
        profit: ZERO,
        profitPreTax: ZERO,
        profitComplete: true,
        profitPreTaxComplete: true,
      };
      if (item.sbiItemProfit === null) {
        margin.profitComplete = false;
      } else {
        margin.profit = margin.profit.plus(item.sbiItemProfit.times(item.sbiNetQty));
      }
      if (item.sbiProfitPreTax === null) {
        margin.profitPreTaxComplete = false;
      } else {
        margin.profitPreTax = margin.profitPreTax.plus(item.sbiProfitPreTax.times(item.sbiNetQty));
      }
      marginBySource.set(key, margin);
    }

    const facts = new Map<string, SourceBillFacts>();
    for (const bill of sourced) {
      const sourceKey = `${bill.ablSrcDocId!}|${bill.ablSrcAccYear!}`;
      const margin = marginBySource.get(sourceKey);
      facts.set(`${bill.ablId}|${bill.ablAccYear}`, {
        usrRefno: refnoBySource.get(sourceKey) ?? null,
        // No lines at all is "not answerable" too, not "earned nothing".
        profit: margin && margin.profitComplete ? margin.profit.toDecimalPlaces(2) : null,
        profitPreTax:
          margin && margin.profitPreTaxComplete ? margin.profitPreTax.toDecimalPlaces(2) : null,
      });
    }
    return facts;
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
    // R-B3 — the party is resolved FIRST, and an unknown id is a 404 here
    // exactly as it is on /receipts/open-items.
    //
    // It used to answer 200 with two empty lists, which reads identically to a
    // real party who has never paid before — so a client holding a stale or
    // mistyped id was shown an empty panel and had no way to tell that it was
    // looking at nothing rather than at a new customer. The two routes are
    // called together by the same screen; they cannot disagree about whether
    // the party exists.
    const party = await loadParty(this.prisma, query.companyId, query.partyId, 'partyId');

    const [receipts, cheques, summary] = await Promise.all([
      this.loadRecentReceipts(query.companyId, query.partyId),
      this.loadPendingCheques(query.companyId, query.partyId),
      this.loadPartySummary(query.companyId, query.partyId),
    ]);

    return {
      partyId: query.partyId,
      partyName: party.ledName,
      summary,
      lastReceipts: receipts,
      pendingCheques: cheques,
    };
  }

  /**
   * R-B9 — the party's position in three figures, plus the cheques still out.
   *
   * ── Why the balance is not summed from open-items ────────────────────────
   * `/receipts/open-items` answers a narrower question than "what is this
   * party's balance". It lists `RECEIVABLE_BILL_TYPES` on the left and
   * `CREDIT_BILL_TYPES` on the right, because those are the rows a RECEIPT may
   * settle and the credits it may spend. A party's actual balance includes
   * every live bill of theirs — a PURCHASE row on a party who is also a
   * supplier, for one — so a client adding up the two panels would show a
   * number that is right for the entry grid and wrong for the band above it.
   *
   * Hence one query over every live bill, grouped by side, with no bill-type
   * filter at all.
   *
   * ── No accounting year, again ───────────────────────────────────────────
   * Same reason as everywhere else here: `acc_bill_balance` is partitioned by
   * the year the bill originated in and is never carried forward. A balance
   * pinned to this year is not a balance.
   */
  private async loadPartySummary(companyId: string, partyId: string): Promise<PartyContextSummary> {
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
      // Σ of every post-dated row against this party that has not matured —
      // the figure the bill-wise pdcHeld column adds up to.
      //
      // Counted from the party's OWN adjustment rows rather than from the bills
      // open-items happened to return, so it stays right whatever that list
      // contains. The reversal rows are included and are negative, which is
      // what makes a cancelled cheque net itself back out instead of being
      // counted as still in flight.
      this.prisma.accBillAdjustment.aggregate({
        where: {
          abjCompanyId: companyId,
          abjPartyId: partyId,
          abjIsDeleted: false,
          abjIsPostDated: true,
          abjAdjDate: { gt: todayUtc() },
        },
        _sum: { abjAmount: true },
      }),
    ]);

    const bySide = new Map(sides.map((row) => [row.ablDrCr, row._sum.ablPendingAmount ?? ZERO]));
    const outstanding = bySide.get('DR') ?? ZERO;
    const credits = bySide.get('CR') ?? ZERO;

    return {
      totalBalance: toAmount(outstanding.minus(credits)),
      totalOutstanding: toAmount(outstanding),
      totalCredits: toAmount(credits),
      chequesOutstanding: toAmount(postDated._sum.abjAmount ?? ZERO),
    };
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

  // ─── R-B4 ──────────────────────────────────────────────────────────────────

  /**
   * The receipt entered just before or just after this one, in the register's
   * own order — 3.0's Ctrl+PgUp / Ctrl+PgDown, which is why every reopen is
   * currently a search.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  THE WALK KEY, AND WHY IT IS NOT JUST (DATE, SLNO)
   * ═══════════════════════════════════════════════════════════════════════
   *
   * The register orders on `(avh_voucher_date, avh_voucher_slno)`. That pair is
   * not a TOTAL order over what the register shows, and a walk needs one — a
   * walk on a key with ties either stalls on the tie or steps over it.
   *
   * `ck_avh_no` gives every non-DRAFT a slno and leaves it NULL on a DRAFT, so
   * every draft on a given day ties with every other. Two things follow:
   *
   *   · NULL sorts as the GREATEST slno, not the least. The register's
   *     `ORDER BY ... DESC` takes Postgres's NULLS FIRST, so drafts render at
   *     the top of their date — the high end of an ascending key. Coalescing to
   *     0 would put them at the wrong end of the day and the walk would visit
   *     them in an order nobody can see on screen.
   *
   *   · `avh_created_on` then `avh_voucher_id` break the remaining ties. The
   *     register does not carry those columns, so two drafts keyed in the same
   *     second may render in the opposite order to the one they are walked in.
   *     That is the honest limit of this: the walk is TOTAL and STABLE, and it
   *     agrees with the register everywhere the register itself is decided.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  WHY THE FILTERS COME BACK IN
   * ═══════════════════════════════════════════════════════════════════════
   *
   * The walk has to agree with the list the operator is looking at. A register
   * filtered to POSTED that skipped three drafts to reach the next posted
   * receipt is right; one that stopped on a draft the list does not show is a
   * bug the operator cannot account for. So the same `status` and date window
   * the grid was run with are passed here, and the same four structural
   * predicates the grid has are applied unconditionally: the receipt voucher
   * type, not deleted, and `avh_against_voucher_id IS NULL` — a post-dated
   * cheque's own voucher belongs under its receipt and is not a row of the
   * register.
   */
  async adjacent(query: AdjacentVoucherQueryDto): Promise<AdjacentVoucherPayload> {
    const current = await this.prisma.accVoucherHeader.findFirst({
      where: {
        avhVoucherId: query.voucherId,
        avhAccYear: query.accYear,
        avhCompanyId: query.companyId,
        avhBranchId: query.branchId,
        avhIsDeleted: false,
      },
      select: { avhVoucherDate: true, avhVoucherSlno: true, avhCreatedOn: true },
    });

    if (!current) {
      // The four keys, all four checked, and a miss on any of them is a 404
      // rather than a 403 — a caller scoped elsewhere does not learn that this
      // receipt exists. Same rule as every other route here.
      throwAccountsNotFound<ReceiptErrorDetail>(
        'Receipt not found',
        'voucherId',
        `No receipt ${query.voucherId} in ${query.accYear} for this company and branch`,
      );
    }

    const isPrev = query.direction === 'prev';
    // Both come from a closed set the DTO has already validated against, so
    // neither can carry anything but the token written here.
    const comparison = Prisma.raw(isPrev ? '<' : '>');
    const order = Prisma.raw(isPrev ? 'DESC' : 'ASC');

    const status = query.status ?? null;
    const fromDate = query.fromDate ? toDateOnly(query.fromDate) : null;
    const toDate = query.toDate ? toDateOnly(query.toDate) : null;

    const rows = await this.prisma.$queryRaw<AdjacentRow[]>`
      SELECT h.avh_voucher_id,
             h.avh_acc_year,
             h.avh_company_id,
             h.avh_branch_id,
             h.avh_voucher_refno,
             h.avh_voucher_date,
             h.avh_party_id,
             p.led_name,
             h.avh_doc_amount,
             h.avh_voucher_status
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id
       WHERE h.avh_company_id = ${query.companyId}::uuid
         AND h.avh_branch_id  = ${query.branchId}::uuid
         AND h.avh_acc_year   = ${query.accYear}::bpchar
         AND vt.vchr_type_code = ${RECEIPT_VOUCHER_TYPE_CODE}
         AND h.avh_is_deleted = false
         AND h.avh_against_voucher_id IS NULL
         AND (${status}::varchar IS NULL OR h.avh_voucher_status = ${status}::varchar)
         AND (${fromDate}::timestamptz IS NULL OR h.avh_voucher_date >= ${fromDate}::timestamptz)
         AND (${toDate}::timestamptz   IS NULL OR h.avh_voucher_date <= ${toDate}::timestamptz)
         AND (h.avh_voucher_date,
              COALESCE(h.avh_voucher_slno, ${DRAFT_SLNO_SENTINEL}),
              h.avh_created_on,
              h.avh_voucher_id)
             ${comparison}
             (${current.avhVoucherDate}::timestamptz,
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

  /**
   * "Has this party already paid this much on this date?"
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  A WARNING, AND NEVER ANYTHING MORE
   * ═══════════════════════════════════════════════════════════════════════
   *
   * This route has no opinion and writes nothing. A customer settling two
   * invoices with two equal cheques on one day is ordinary business, and on a
   * beat run where most collections are round figures it will happen most days
   * — so a server that refused the second, or that made the client refuse it,
   * would simply be wrong about the trade. What it is for is the OTHER case:
   * the same receipt keyed twice because the first one was not seen to save.
   * The operator is the one who can tell those apart, and this gives them what
   * they need to.
   *
   * ── Exactly, not approximately ──────────────────────────────────────────
   * The amount is matched exactly. A tolerance sounds safer and is not: on a
   * beat where the day's collections are 500, 1000 and 2000 over and over, a
   * ±5% window warns on nearly every row, and a warning that fires on nearly
   * every row is one the operator learns to dismiss without reading — which
   * costs exactly the receipt this was built to catch.
   *
   * ── What is in scope ────────────────────────────────────────────────────
   * The company and the year; the branch only if the caller asks for it. A
   * re-key that landed on another branch is still a duplicate, and is the one
   * an operator is least likely to find by themselves.
   *
   * CANCELLED receipts are excluded — a reversed receipt is not money the party
   * has paid — and so are post-dated cheque vouchers, which are part of a
   * receipt rather than receipts of their own and would otherwise report their
   * parent's collection a second time.
   */
  async duplicateCheck(query: DuplicateCheckQueryDto): Promise<DuplicateCheckPayload> {
    // The party is resolved for the same reason party-context resolves it: an
    // id that names nothing must not come back as a confident "no duplicates".
    await loadParty(this.prisma, query.companyId, query.partyId, 'partyId');

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
        voucherType: { vchrTypeCode: RECEIPT_VOUCHER_TYPE_CODE },
        // The draft being keyed must not report itself. Without this, every
        // re-check after the first save warns about the receipt on screen.
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
      // A bound, because this is on the keystroke path. Anything past a handful
      // is the same answer: the operator is being told to go and look.
      take: 10,
    });

    const rows: DuplicateReceipt[] = matches.map((match) => ({
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

/**
 * `abl_src_module` / `abl_src_doc_type` as `sales/bill/bill-posting.helper.ts`
 * stamps them when an invoice opens an outstanding row. Restated rather than
 * imported so this module does not take a dependency on the sales module for
 * two string constants — and asserted against in that module's own tests.
 */
const SALE_BILL_SRC_MODULE = 'SALES';
const SALE_BILL_SRC_DOC_TYPE = 'BILL';

/**
 * A DRAFT has no `avh_voucher_slno` (`ck_avh_no`), and the register sorts those
 * NULLs to the TOP of their date — Postgres's `DESC` default is NULLS FIRST, so
 * on the ascending key a draft is the GREATEST row of its day. This is that
 * position as a value the walk can compare against: `bigint`'s maximum.
 *
 * Coalescing to 0 instead would file every draft at the bottom of its day, and
 * the walk would step through them in an order the register never shows.
 */
const DRAFT_SLNO_SENTINEL = 9223372036854775807n;

/** One neighbouring register row, as the raw query hands it back. */
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

/** What the invoice behind a bill contributes to the open-items row. */
interface SourceBillFacts {
  usrRefno: string | null;
  profit: Prisma.Decimal | null;
  profitPreTax: Prisma.Decimal | null;
}

/** One bill's margin as its lines are walked, and whether every line had one. */
interface Margin {
  profit: Prisma.Decimal;
  profitPreTax: Prisma.Decimal;
  profitComplete: boolean;
  profitPreTaxComplete: boolean;
}
