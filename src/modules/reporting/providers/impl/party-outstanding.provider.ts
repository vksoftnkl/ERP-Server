import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ReportDataProvider } from '../report-data-provider.decorator';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { round2, toDateOnly, toNumber, toText } from '../provider.utils';

/**
 * One party's open bills — the body of an outstanding statement.
 *
 * ── Why there is no acc-year filter ──────────────────────────────────────────
 * accounts.acc_bill_balance is partitioned by abl_acc_year, but the partition
 * records where a bill STARTED, not where the money is: a bill still open past
 * year end keeps its original year forever. Filtering on ctx.accYear would drop
 * every bill raised before it, and a statement would show a customer as clean
 * while they carried real debt. BillBalanceService takes the same position for
 * the credit check, for the same reason.
 *
 * ── Why DR and CR are signed apart ──────────────────────────────────────────
 * abl_dr_cr is DR = receivable, CR = payable, and BOTH sides sit in this table
 * with a POSITIVE abl_pending_amount. A sale-order advance is a CR row: the
 * customer's own money, held. Summing the column flat would print that advance
 * as debt. So the statement carries a signed `pendingAmount` (CR negated) and a
 * separate `drCr` label, and the closing total is the signed sum.
 *
 * Requires `partyId` in params. ctx.docId is accepted as a fallback so a
 * statement can be printed straight from a ledger screen.
 */
@Injectable()
@ReportDataProvider('accounts.party.outstanding', {
  label: 'Party outstanding — open bills',
  cardinality: 'many',
  docTypes: ['PARTY_STATEMENT', 'OUTSTANDING_STATEMENT'],
})
export class PartyOutstandingProvider implements IReportDataProvider {
  constructor(private readonly prisma: PrismaService) {}

  fields(): readonly FieldMeta[] {
    return [
      { name: '__index', type: 'integer', label: 'Serial number (1-based)' },
      { name: 'accYear', type: 'string', label: 'Accounting year the bill started in' },
      { name: 'docRefNo', type: 'string', label: 'Bill / voucher number' },
      { name: 'docDate', type: 'date', label: 'Document date', format: 'dd-MM-yyyy' },
      { name: 'dueDate', type: 'date', label: 'Due date', format: 'dd-MM-yyyy' },
      { name: 'srcDocType', type: 'string', label: 'Source document type' },
      { name: 'billType', type: 'string', label: 'Bill type' },
      { name: 'drCr', type: 'string', label: 'DR / CR' },
      { name: 'narration', type: 'string', label: 'Narration' },
      { name: 'billAmount', type: 'number', label: 'Bill amount', format: '#,##0.00' },
      { name: 'allocAmount', type: 'number', label: 'Amount received', format: '#,##0.00' },
      { name: 'discAmount', type: 'number', label: 'Discount allowed', format: '#,##0.00' },
      {
        name: 'pendingAmount',
        type: 'number',
        label: 'Pending amount (CR negative)',
        format: '#,##0.00',
      },
      {
        name: 'pendingAbs',
        type: 'number',
        label: 'Pending amount (unsigned)',
        format: '#,##0.00',
      },
      { name: 'creditDays', type: 'integer', label: 'Credit days' },
      { name: 'overdueDays', type: 'integer', label: 'Days overdue' },
      { name: 'ageBucket', type: 'string', label: 'Ageing bucket' },
      { name: 'status', type: 'string', label: 'OPEN / PARTIAL / CLOSED' },
      { name: 'isOverdue', type: 'boolean', label: 'Overdue' },
      { name: 'runningTotal', type: 'number', label: 'Running signed total', format: '#,##0.00' },
    ];
  }

  async resolve(context: ReportContext): Promise<ReportRow[]> {
    const partyId = toText(context.params?.partyId) || context.docId;
    if (!partyId) {
      return [];
    }

    // `asOn` lets a statement be struck as at a date rather than today. Ageing
    // on a statement dated the 31st must not shift when it is reprinted in
    // September.
    const asOnParam = toText(context.params?.asOn);
    const asOn = asOnParam ? new Date(asOnParam) : new Date();
    const asOnValid = Number.isNaN(asOn.getTime()) ? new Date() : asOn;

    const rows = await this.prisma.accBillBalance.findMany({
      where: {
        ablPartyId: partyId,
        ablCompanyId: context.companyId,
        ablIsDeleted: false,
        ablIsActive: true,
        // CLOSED bills are excluded: a statement lists what is owed. The
        // status column is DB-generated from the amount columns, so this is
        // the same test the partial indexes use.
        ablStatus: { in: ['OPEN', 'PARTIAL'] },
        ...(context.branchId ? { ablBranchId: context.branchId } : {}),
      },
      orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
      select: {
        ablAccYear: true,
        ablDocRefno: true,
        ablDocDate: true,
        ablDueDate: true,
        ablSrcDocType: true,
        ablBillType: true,
        ablDrCr: true,
        ablNarration: true,
        ablBillAmount: true,
        ablAllocAmount: true,
        ablDiscAmount: true,
        ablPendingAmount: true,
        ablCreditDays: true,
        ablGraceDays: true,
        ablStatus: true,
      },
    });

    let runningTotal = 0;

    return rows.map((row, index) => {
      const isCredit = toText(row.ablDrCr).trim().toUpperCase() === 'CR';
      const pendingAbs = round2(toNumber(row.ablPendingAmount));
      const pendingSigned = isCredit ? -pendingAbs : pendingAbs;
      runningTotal = round2(runningTotal + pendingSigned);

      // Ageing runs from the due date plus grace, not from the document date:
      // a bill inside its credit period is not overdue, and printing it as
      // overdue is what makes customers dispute a statement.
      const dueDate = row.ablDueDate;
      const graceMs = row.ablGraceDays * 24 * 60 * 60 * 1000;
      const overdueDays = dueDate
        ? Math.max(
            0,
            Math.floor(
              (asOnValid.getTime() - (dueDate.getTime() + graceMs)) / (24 * 60 * 60 * 1000),
            ),
          )
        : 0;

      return {
        __index: index + 1,
        accYear: row.ablAccYear,
        docRefNo: toText(row.ablDocRefno),
        docDate: toDateOnly(row.ablDocDate),
        dueDate: toDateOnly(row.ablDueDate),
        srcDocType: toText(row.ablSrcDocType),
        billType: toText(row.ablBillType),
        drCr: isCredit ? 'CR' : 'DR',
        narration: toText(row.ablNarration),
        billAmount: round2(toNumber(row.ablBillAmount)),
        allocAmount: round2(toNumber(row.ablAllocAmount)),
        discAmount: round2(toNumber(row.ablDiscAmount)),
        pendingAmount: pendingSigned,
        pendingAbs,
        creditDays: row.ablCreditDays,
        overdueDays,
        ageBucket: bucketFor(overdueDays),
        status: toText(row.ablStatus),
        isOverdue: overdueDays > 0,
        runningTotal,
      };
    });
  }

  sampleData(): ReportRow[] {
    const rows = [
      {
        docRefNo: 'SLM/26-27/000091',
        docDate: '2026-05-14',
        dueDate: '2026-06-13',
        billAmount: 18400,
        allocAmount: 0,
        drCr: 'DR',
        overdueDays: 72,
      },
      {
        docRefNo: 'SLM/26-27/000112',
        docDate: '2026-06-28',
        dueDate: '2026-07-28',
        billAmount: 24600,
        allocAmount: 10000,
        drCr: 'DR',
        overdueDays: 27,
      },
      {
        docRefNo: 'SLM/26-27/000133',
        docDate: '2026-08-02',
        dueDate: '2026-09-01',
        billAmount: 31250,
        allocAmount: 0,
        drCr: 'DR',
        overdueDays: 0,
      },
      {
        docRefNo: 'RCP/26-27/000418',
        docDate: '2026-08-18',
        dueDate: null,
        billAmount: 5000,
        allocAmount: 0,
        drCr: 'CR',
        overdueDays: 0,
      },
    ];

    let runningTotal = 0;
    return rows.map((row, index) => {
      const pendingAbs = round2(row.billAmount - row.allocAmount);
      const pendingSigned = row.drCr === 'CR' ? -pendingAbs : pendingAbs;
      runningTotal = round2(runningTotal + pendingSigned);
      return {
        __index: index + 1,
        accYear: '2026-2027',
        docRefNo: row.docRefNo,
        docDate: row.docDate,
        dueDate: row.dueDate,
        srcDocType: row.drCr === 'CR' ? 'RECEIPT' : 'SALE_BILL',
        billType: 'CREDIT',
        drCr: row.drCr,
        narration: row.drCr === 'CR' ? 'Advance received' : '',
        billAmount: row.billAmount,
        allocAmount: row.allocAmount,
        discAmount: 0,
        pendingAmount: pendingSigned,
        pendingAbs,
        creditDays: 30,
        overdueDays: row.overdueDays,
        ageBucket: bucketFor(row.overdueDays),
        status: row.allocAmount > 0 ? 'PARTIAL' : 'OPEN',
        isOverdue: row.overdueDays > 0,
        runningTotal,
      };
    });
  }
}

/** The ageing buckets every Indian outstanding statement is printed in. */
const bucketFor = (overdueDays: number): string => {
  if (overdueDays <= 0) {
    return 'Current';
  }
  if (overdueDays <= 30) {
    return '1-30';
  }
  if (overdueDays <= 60) {
    return '31-60';
  }
  if (overdueDays <= 90) {
    return '61-90';
  }
  if (overdueDays <= 180) {
    return '91-180';
  }
  return '180+';
};
