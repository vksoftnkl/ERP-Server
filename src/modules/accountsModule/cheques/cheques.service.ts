import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { throwAccountsNotFound } from 'src/common/utils/module-service.utils';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { BillType, PdcPostingMode, PdcStatus } from '../receipt/types/receipt-enum';
import {
  sum,
  toAmount,
  toDateOnly,
  toDateString,
  toIsoString,
  ZERO,
} from '../receipt/receipt.utils';
import { toChequeRow } from './cheques.utils';
import { loadVoucherRef } from './cheque-voucher.helper';
import { BOUNCE_CHARGE_SRC_DOC_TYPE } from './types/cheque-enum';
import {
  ChequeHistoryQueryDto,
  DepositSlipQueryDto,
  GetChequeQueryDto,
  ListChequesQueryDto,
} from './dto/cheque-query.dto';
import type {
  ChequeBillRef,
  ChequeDetailPayload,
  ChequeErrorDetail,
  ChequeHistoryPayload,
  ChequeListPayload,
  ChequeRow,
  DepositSlipPayload,
} from './types/cheque-api.types';

/**
 * §4.1 and §4.8 — the reads. Nothing here writes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY `/list` EXISTS WHEN THE RECEIPT HAS NO `/list`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The receipt module has no list route on purpose: its list is a registered
 * grid and a second query would be a second definition of the same thing.
 * This module has the grid TOO — `MAIN LIST - RECEIVED CHEQUES`, seeded by
 * 20260916120000 §5 and served through `/configured-grid-sql`, which is what
 * TxnMainView reads and what makes the operator's saved widths and filters
 * apply.
 *
 * `/cheques/list` answers what the grid structurally cannot: the SUMMARY
 * STRIP. "In hand 14 / 2,18,400 · With the bank 6 / 91,000" is an aggregate
 * over the WHOLE register, not over the page the grid returned, and §7's last
 * check — "the summary strip's IN HAND + WITH THE BANK equals the Cheques In
 * Hand ledger" — is a statement about that total. A grid row count cannot
 * answer it, and paging the grid to get one would be a table scan per
 * keystroke.
 *
 * The plan asks for both (§2.3 the grid, §4.1 the route), and this is why
 * that is not a duplication.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  NO CACHE (§6.4)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The due buckets change at midnight. A list cached for ten minutes is a list
 * that says FUTURE about a cheque that matured this morning, and the whole
 * purpose of the screen is to tell the operator what to bank today.
 */

@Injectable()
export class ChequesService {
  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.1 — the list
  // ═════════════════════════════════════════════════════════════════════════

  async list(query: ListChequesQueryDto): Promise<ChequeListPayload> {
    const where = this.buildWhere(query);

    const [rows, total, summaryRows] = await Promise.all([
      this.prisma.accPdcRegister.findMany({
        where,
        orderBy: [{ apdInstrumentDate: 'asc' }, { apdCreatedOn: 'asc' }],
        skip: query.offset ?? 0,
        take: query.limit ?? 200,
        include: {
          party: { select: { ledName: true } },
          bankLedger: { select: { ledName: true } },
        },
      }),
      this.prisma.accPdcRegister.count({ where }),
      // The summary is over the WHOLE register for the scope, NOT over the
      // filtered set: the strip answers "what is in the drawer", and a strip
      // that changed when the operator typed in the search box would be
      // telling them something different every keystroke.
      this.prisma.accPdcRegister.groupBy({
        by: ['apdStatus'],
        where: {
          apdCompanyId: query.apdCompanyId,
          apdBranchId: query.apdBranchId,
          apdAccYear: query.apdAccYear,
          apdTraType: 'R',
          apdIsDeleted: false,
        },
        _count: { _all: true },
        _sum: { apdAmount: true },
      }),
    ]);

    const byStatus = new Map(
      summaryRows.map((row) => [
        row.apdStatus,
        { count: row._count._all, amount: row._sum.apdAmount ?? ZERO },
      ]),
    );
    const pick = (status: PdcStatus) => byStatus.get(status) ?? { count: 0, amount: ZERO };

    return {
      rows: rows.map((row) => this.toRow(row)),
      total,
      summary: {
        inHandCount: pick(PdcStatus.HELD).count,
        inHandAmount: toAmount(pick(PdcStatus.HELD).amount),
        withBankCount: pick(PdcStatus.DEPOSITED).count,
        withBankAmount: toAmount(pick(PdcStatus.DEPOSITED).amount),
        bouncedCount: pick(PdcStatus.BOUNCED).count,
        bouncedAmount: toAmount(pick(PdcStatus.BOUNCED).amount),
        clearedCount: pick(PdcStatus.CLEARED).count,
        clearedAmount: toAmount(pick(PdcStatus.CLEARED).amount),
      },
    };
  }

  /** §2.3's five filters, and the search across the four fields it names. */
  private buildWhere(query: ListChequesQueryDto): Prisma.AccPdcRegisterWhereInput {
    const statuses = (query.status ?? '')
      .split(',')
      .map((token) => token.trim().toUpperCase())
      .filter((token) => token.length > 0);

    const search = query.search?.trim();

    return {
      apdCompanyId: query.apdCompanyId,
      apdBranchId: query.apdBranchId,
      apdAccYear: query.apdAccYear,
      // 'R' only. Menu 52 (Issued Cheques) is its own plan and its own screen.
      apdTraType: 'R',
      apdIsDeleted: false,
      ...(statuses.length > 0 ? { apdStatus: { in: statuses } } : {}),
      ...(query.from || query.to
        ? {
            apdInstrumentDate: {
              ...(query.from ? { gte: toDateOnly(query.from) } : {}),
              ...(query.to ? { lte: toDateOnly(query.to) } : {}),
            },
          }
        : {}),
      ...(query.bankLedgerId ? { apdBankLedgerId: query.bankLedgerId } : {}),
      ...(query.partyId ? { apdPartyId: query.partyId } : {}),
      ...(search
        ? {
            OR: [
              { apdInstrumentNo: { contains: search, mode: 'insensitive' } },
              { apdDrawerName: { contains: search, mode: 'insensitive' } },
              { apdBankName: { contains: search, mode: 'insensitive' } },
              { party: { ledName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.1 — get
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * One cheque and everything hanging off it: the four vouchers, every bill
   * its adjustment rows name with what that bill owes NOW, the charge bill,
   * and both ends of the replacement chain.
   *
   * Read in one transaction so the bills and the vouchers are the same
   * snapshot. Without it a clearing committing between two of these reads
   * would produce a page showing a CLEARED cheque with no clearing voucher.
   */
  async get(query: GetChequeQueryDto): Promise<ChequeDetailPayload> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.accPdcRegister.findFirst({
        where: {
          apdId: query.apdId,
          apdAccYear: query.apdAccYear,
          apdCompanyId: query.apdCompanyId,
          apdBranchId: query.apdBranchId,
          apdIsDeleted: false,
        },
        include: {
          party: { select: { ledName: true } },
          bankLedger: { select: { ledName: true } },
        },
      });

      if (!row) {
        throwAccountsNotFound<ChequeErrorDetail>(
          'Cheque not found',
          'apdId',
          `No live cheque ${query.apdId} at this company / branch in ${query.apdAccYear}`,
        );
      }

      const cheque = this.toRow(row);

      // §5 — the ledger it was posted to comes from its OWN tender row, never
      // from today's master. Reported as null rather than refused: this is a
      // read, and a screen that cannot open a cheque because its tender row
      // went missing is worse than one that shows a blank field.
      const tender = row.apdTenderId
        ? await tx.accTenderDetail.findFirst({
            where: { tdId: row.apdTenderId, tdIsDeleted: false },
            select: { tdTenderLedgerId: true, ledger: { select: { ledName: true } } },
          })
        : null;

      const [receiptVoucher, clearVoucher, bounceVoucher] = await Promise.all([
        loadVoucherRef(tx, row.apdVoucherId, row.apdVoucherAccYear),
        loadVoucherRef(tx, row.apdClearVoucherId, row.apdClearAccYear),
        loadVoucherRef(tx, row.apdBounceVoucherId, row.apdBounceAccYear),
      ]);

      // A re-issue is an Rct raised AGAINST the bounce, and it is not on the
      // register: apd_voucher_id has already moved on to point at it, so the
      // only way to name it distinctly is by what it answers.
      const reissue = row.apdBounceVoucherId
        ? await tx.accVoucherHeader.findFirst({
            where: {
              avhAgainstVoucherId: row.apdBounceVoucherId,
              avhIsDeleted: false,
            },
            orderBy: { avhCreatedOn: 'desc' },
            select: { avhVoucherId: true, avhAccYear: true },
          })
        : null;

      const bills = await this.loadTouchedBills(tx, row.apdId, row.apdAccYear);

      const chargeBillRow = await tx.accBillBalance.findFirst({
        where: {
          ablSrcDocType: BOUNCE_CHARGE_SRC_DOC_TYPE,
          ablSrcDocId: row.apdId,
          ablBillType: BillType.JOURNAL,
          ablIsDeleted: false,
        },
      });

      const [replaces, replacedBy] = await Promise.all([
        this.loadChainRow(tx, { replacedById: row.apdId, accYear: row.apdAccYear }),
        row.apdReplacedById && row.apdReplacedByAccYear
          ? this.loadRowByKey(tx, row.apdReplacedById, row.apdReplacedByAccYear)
          : Promise.resolve(null),
      ]);

      return {
        cheque,
        chequesInHandLedgerId: tender?.tdTenderLedgerId ?? null,
        chequesInHandLedgerName: tender?.ledger?.ledName ?? null,
        receiptVoucher,
        clearVoucher,
        bounceVoucher,
        reissueVoucher: reissue
          ? await loadVoucherRef(tx, reissue.avhVoucherId, reissue.avhAccYear)
          : null,
        bills,
        chargeBill: chargeBillRow
          ? {
              billId: chargeBillRow.ablId,
              billAccYear: chargeBillRow.ablAccYear,
              billType: chargeBillRow.ablBillType,
              docRefno: chargeBillRow.ablDocRefno,
              docDate: toDateString(chargeBillRow.ablDocDate) ?? '',
              dueDate: toDateString(chargeBillRow.ablDueDate),
              billAmount: toAmount(chargeBillRow.ablBillAmount),
              pendingAmount: toAmount(chargeBillRow.ablPendingAmount ?? ZERO),
              settledByThisCheque: 0,
            }
          : null,
        replaces,
        replacedBy,
      };
    });
  }

  /**
   * Every bill this cheque's adjustment rows name, with what it owes now.
   *
   * `settledByThisCheque` is the NET of the rows — so a bill this cheque
   * settled and then had reversed by a bounce comes back 0, and one settled by
   * a re-presentation that stuck comes back positive. That is the number an
   * operator is actually asking for when they open a bounced cheque: not "what
   * did it once pay", but "what is it paying now".
   */
  private async loadTouchedBills(
    tx: Prisma.TransactionClient,
    apdId: string,
    apdAccYear: string,
  ): Promise<ChequeBillRef[]> {
    const rows = await tx.accBillAdjustment.findMany({
      where: { abjChequeId: apdId, abjChequeAccYear: apdAccYear, abjIsDeleted: false },
      select: { abjBillId: true, abjBillAccYear: true, abjAmount: true },
    });
    if (rows.length === 0) {
      return [];
    }

    const netByBill = new Map<string, { billId: string; accYear: string; net: Prisma.Decimal }>();
    for (const row of rows) {
      const key = `${row.abjBillId}|${row.abjBillAccYear}`;
      const found = netByBill.get(key);
      netByBill.set(key, {
        billId: row.abjBillId,
        accYear: row.abjBillAccYear,
        net: (found?.net ?? ZERO).plus(row.abjAmount),
      });
    }

    const bills = await tx.accBillBalance.findMany({
      where: {
        OR: [...netByBill.values()].map((entry) => ({
          ablId: entry.billId,
          ablAccYear: entry.accYear,
        })),
      },
    });

    return bills.map((bill) => ({
      billId: bill.ablId,
      billAccYear: bill.ablAccYear,
      billType: bill.ablBillType,
      docRefno: bill.ablDocRefno,
      docDate: toDateString(bill.ablDocDate) ?? '',
      dueDate: toDateString(bill.ablDueDate),
      billAmount: toAmount(bill.ablBillAmount),
      pendingAmount: toAmount(bill.ablPendingAmount ?? ZERO),
      settledByThisCheque: toAmount(netByBill.get(`${bill.ablId}|${bill.ablAccYear}`)?.net ?? ZERO),
    }));
  }

  private async loadChainRow(
    tx: Prisma.TransactionClient,
    key: { replacedById: string; accYear: string },
  ): Promise<ChequeRow | null> {
    const row = await tx.accPdcRegister.findFirst({
      where: {
        apdReplacedById: key.replacedById,
        apdReplacedByAccYear: key.accYear,
        apdIsDeleted: false,
      },
      include: {
        party: { select: { ledName: true } },
        bankLedger: { select: { ledName: true } },
      },
    });
    return row ? this.toRow(row) : null;
  }

  private async loadRowByKey(
    tx: Prisma.TransactionClient,
    apdId: string,
    apdAccYear: string,
  ): Promise<ChequeRow | null> {
    const row = await tx.accPdcRegister.findFirst({
      where: { apdId, apdAccYear, apdIsDeleted: false },
      include: {
        party: { select: { ledName: true } },
        bankLedger: { select: { ledName: true } },
      },
    });
    return row ? this.toRow(row) : null;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.1 — history
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The cheque's own `txn_status_log` rows, newest first.
   *
   * Filed under `srcDocType = 'OTHER'` with the cheque's `apd_id` — see
   * `logChequeStatus` for why that is the right member rather than RECEIPT.
   * The year is the cheque's own, which is the partition every one of its
   * steps was written into however late they happened.
   */
  async history(query: ChequeHistoryQueryDto): Promise<ChequeHistoryPayload> {
    const cheque = await this.prisma.accPdcRegister.findFirst({
      where: {
        apdId: query.apdId,
        apdAccYear: query.apdAccYear,
        apdCompanyId: query.apdCompanyId,
        apdBranchId: query.apdBranchId,
        apdIsDeleted: false,
      },
      select: { apdId: true, apdAccYear: true, apdInstrumentNo: true },
    });

    if (!cheque) {
      throwAccountsNotFound<ChequeErrorDetail>(
        'Cheque not found',
        'apdId',
        `No live cheque ${query.apdId} at this company / branch in ${query.apdAccYear}`,
      );
    }

    const entries = await this.prisma.txnStatusLog.findMany({
      where: {
        tslSrcDocType: TxnStatusDocType.OTHER,
        tslSrcDocId: cheque.apdId,
        tslAccYear: cheque.apdAccYear,
      },
      orderBy: { tslSeqNo: 'desc' },
      select: {
        tslSeqNo: true,
        tslEvent: true,
        tslFromStatus: true,
        tslToStatus: true,
        tslChangedOn: true,
        tslChangedBy: true,
        tslRemarks: true,
      },
    });

    return {
      apdId: cheque.apdId,
      apdAccYear: cheque.apdAccYear,
      apdInstrumentNo: cheque.apdInstrumentNo,
      entries: entries.map((entry) => ({
        seqNo: entry.tslSeqNo,
        event: entry.tslEvent,
        fromStatus: entry.tslFromStatus,
        toStatus: entry.tslToStatus,
        changedOn: toIsoString(entry.tslChangedOn) ?? '',
        changedBy: entry.tslChangedBy,
        remarks: entry.tslRemarks,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §4.8 — the deposit slip
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * §2.4's dataset, keyed by (company, bank ledger, deposit date, slip no):
   * the bank's own account, then one line per cheque on that slip.
   *
   * The bank's account comes from `acc_ledger_bank_accounts` — the account
   * number, IFSC and MICR the slip has to print — preferring the row marked
   * default when a ledger has more than one. A ledger with no bank-account row
   * still prints: the ledger's name is enough to fill in by hand, and refusing
   * to print a slip because a master is incomplete would send the operator to
   * a different screen with a bundle of cheques in their other hand.
   */
  async depositSlip(query: DepositSlipQueryDto): Promise<DepositSlipPayload> {
    const depositDate = toDateOnly(query.depositDate);

    const [ledger, account, cheques] = await Promise.all([
      this.prisma.accLedgerMaster.findFirst({
        where: {
          ledId: query.bankLedgerId,
          ledIsDeleted: false,
          OR: [{ ledCompanyId: null }, { ledCompanyId: query.apdCompanyId }],
        },
        select: { ledId: true, ledName: true },
      }),
      this.prisma.accLedgerBankAccount.findFirst({
        where: {
          lbaLedgerId: query.bankLedgerId,
          lbaIsDeleted: false,
          lbaIsActive: true,
          OR: [{ lbaCompanyId: null }, { lbaCompanyId: query.apdCompanyId }],
        },
        orderBy: [{ lbaIsDefault: 'desc' }, { lbaCreatedOn: 'asc' }],
      }),
      this.prisma.accPdcRegister.findMany({
        where: {
          apdCompanyId: query.apdCompanyId,
          apdBranchId: query.apdBranchId,
          apdBankLedgerId: query.bankLedgerId,
          apdDepositDate: depositDate,
          apdDepositSlipNo: query.slipNo,
          apdTraType: 'R',
          apdIsDeleted: false,
        },
        orderBy: [{ apdInstrumentNo: 'asc' }],
        include: { party: { select: { ledName: true } } },
      }),
    ]);

    if (!ledger) {
      throwAccountsNotFound<ChequeErrorDetail>(
        'Bank ledger not found',
        'bankLedgerId',
        `No ledger ${query.bankLedgerId} is visible to this company`,
      );
    }

    return {
      companyId: query.apdCompanyId,
      branchId: query.apdBranchId,
      depositDate: toDateString(depositDate) ?? query.depositDate,
      slipNo: query.slipNo,
      bankAccount: {
        ledgerId: ledger.ledId,
        ledgerName: ledger.ledName,
        accountHolder: account?.lbaAccountHolder ?? null,
        bankName: account?.lbaBankName ?? null,
        branchName: account?.lbaBranchName ?? null,
        accountNo: account?.lbaAccountNo ?? null,
        ifscCode: account?.lbaIfscCode ?? null,
        micrCode: account?.lbaMicrCode ?? null,
      },
      lines: cheques.map((cheque, index) => ({
        lineNo: index + 1,
        apdId: cheque.apdId,
        apdAccYear: cheque.apdAccYear,
        instrumentType: cheque.apdInstrumentType,
        instrumentNo: cheque.apdInstrumentNo,
        instrumentDate: toDateString(cheque.apdInstrumentDate) ?? '',
        drawnOnBank: cheque.apdBankName,
        drawnOnBranch: cheque.apdBankBranch,
        micr: cheque.apdMicr,
        drawerName: cheque.apdDrawerName,
        partyName: cheque.party?.ledName ?? '',
        amount: toAmount(cheque.apdAmount),
      })),
      chequeCount: cheques.length,
      totalAmount: toAmount(sum(cheques.map((cheque) => new Prisma.Decimal(cheque.apdAmount)))),
    };
  }

  // ─── Shared ────────────────────────────────────────────────────────────────

  private toRow(
    row: Prisma.AccPdcRegisterGetPayload<{
      include: { party: { select: { ledName: true } }; bankLedger: { select: { ledName: true } } };
    }>,
  ): ChequeRow {
    return toChequeRow(
      {
        ...row,
        apdAmount: new Prisma.Decimal(row.apdAmount),
        apdBounceCharges: new Prisma.Decimal(row.apdBounceCharges),
        apdPostingMode: row.apdPostingMode as PdcPostingMode,
        apdStatus: row.apdStatus as PdcStatus,
      },
      {
        partyName: row.party?.ledName ?? '',
        bankLedgerName: row.bankLedger?.ledName ?? null,
        apdStatusOn: row.apdStatusOn,
        apdStatusBy: row.apdStatusBy,
      },
    );
  }
}
