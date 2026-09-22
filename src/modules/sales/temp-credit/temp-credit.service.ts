import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { daysBetween, isoDate, isoToday } from '../posting/sales-doc.utils';
import type { OpenTempCreditsQueryDto, TempCreditFollowUpDto } from './dto/temp-credit.dto';

/**
 * HANDOVER §7 — `/api/v1/temp-credits` (31).
 *
 * The rows are WRITTEN by `/bills/post` (one per TEMP_CR tender) and moved by
 * receipts through `BillBalanceRecomputeService`; this module only READS them
 * as a grid and records the follow-up. `atc_balance_amount` is a maintained
 * copy of the bill row's `abl_pending_amount`, never recomputed here.
 */
@Injectable()
export class TempCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly audit: AuditLogService,
  ) {}

  async open(q: OpenTempCreditsQueryDto): Promise<Record<string, unknown>[]> {
    const statuses = (q.status ?? 'OPEN,PARTIAL')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const search = q.search?.trim() ? `%${q.search.trim()}%` : null;
    const today = isoToday();
    const rows = await this.prisma.$queryRaw<
      {
        atc_id: string;
        atc_acc_year: string;
        atc_party_id: string;
        led_name: string | null;
        atc_src_doc_id: string;
        atc_bill_refno: string | null;
        atc_bill_date: Date;
        atc_bill_amount: Prisma.Decimal;
        atc_name: string;
        atc_mobile: string;
        atc_place: string | null;
        atc_days: number;
        atc_due_date: Date;
        atc_credit_amount: Prisma.Decimal;
        atc_balance_amount: Prisma.Decimal;
        atc_status: string;
        atc_promise_date: Date | null;
        atc_followup_on: Date | null;
        atc_remarks: string | null;
        atc_branch_id: string;
      }[]
    >`
      SELECT t.atc_id, t.atc_acc_year, t.atc_party_id, l.led_name, t.atc_src_doc_id, t.atc_bill_refno, t.atc_bill_date, t.atc_bill_amount,
             t.atc_name, t.atc_mobile, t.atc_place, t.atc_days, t.atc_due_date, t.atc_credit_amount, t.atc_balance_amount, t.atc_status,
             t.atc_promise_date, t.atc_followup_on, t.atc_remarks, t.atc_branch_id
        FROM accounts.acc_temp_credit t
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = t.atc_party_id
       WHERE t.atc_company_id = ${q.companyId}::uuid AND t.atc_is_deleted = false
         AND (${q.branchId ?? null}::uuid IS NULL OR t.atc_branch_id = ${q.branchId ?? null}::uuid)
         AND t.atc_status = ANY(${statuses}::text[])
         AND (${search}::text IS NULL OR t.atc_name ILIKE ${search} OR t.atc_mobile ILIKE ${search} OR t.atc_bill_refno ILIKE ${search})
         AND (${q.overdueOnly ?? false}::boolean = false OR (t.atc_due_date < ${today}::date AND t.atc_balance_amount > 0))
       ORDER BY t.atc_due_date, t.atc_created_on`;
    return rows.map((r) => ({
      atcId: r.atc_id,
      atcAccYear: r.atc_acc_year.trim(),
      partyId: r.atc_party_id,
      partyName: r.led_name,
      billId: r.atc_src_doc_id,
      billRefno: r.atc_bill_refno,
      billDate: isoDate(r.atc_bill_date),
      // The wire is the one place a plain number is right — JSON has no decimal
      // type, and at the column's own scale the conversion is exact. It happens
      // HERE, on the way out, and never before an arithmetic step: §3a rule 1.
      billAmount: r.atc_bill_amount.toNumber(),
      name: r.atc_name,
      mobile: r.atc_mobile,
      place: r.atc_place,
      days: r.atc_days,
      dueDate: isoDate(r.atc_due_date),
      creditAmount: r.atc_credit_amount.toNumber(),
      balance: r.atc_balance_amount.toNumber(),
      status: r.atc_status,
      daysOverdue: r.atc_balance_amount.greaterThan(0)
        ? Math.max(0, daysBetween(isoDate(r.atc_due_date)!, today))
        : 0,
      promiseDate: isoDate(r.atc_promise_date),
      followupOn: r.atc_followup_on?.toISOString() ?? null,
      remarks: r.atc_remarks,
      branchId: r.atc_branch_id,
    }));
  }

  async followUp(dto: TempCreditFollowUpDto): Promise<Record<string, unknown>> {
    const userId = this.requestContext.getUserId();
    const now = new Date();
    const row = await this.prisma.accTempCredit.findFirst({
      where: { atcId: dto.atcId, atcAccYear: dto.atcAccYear, atcIsDeleted: false },
    });
    if (!row) {
      throwSalesNotFound(
        'Temporary credit not found',
        'atcId',
        `No temporary credit found with id ${dto.atcId}`,
      );
    }
    const updated = await this.prisma.accTempCredit.update({
      where: { atcId_atcAccYear: { atcId: dto.atcId, atcAccYear: dto.atcAccYear } },
      data: {
        atcPromiseDate: dto.promiseDate
          ? new Date(`${dto.promiseDate}T00:00:00Z`)
          : row.atcPromiseDate,
        atcFollowupOn: now,
        atcFollowupBy: isUuid(userId) ? userId : null,
        atcRemarks: dto.remarks,
        atcModifiedOn: now,
        atcModifiedBy: userId ?? 'SYSTEM',
      },
    });
    await this.audit.logEntityChange({
      action: 'update',
      tableName: 'acc_temp_credit',
      screenName: 'Temporary Credit',
      screenType: 'transaction',
      pk: dto.atcId,
      displayName: row.atcBillRefno ?? dto.atcId,
      originalRecord: { atcPromiseDate: isoDate(row.atcPromiseDate), atcRemarks: row.atcRemarks },
      modifiedRecord: {
        atcPromiseDate: isoDate(updated.atcPromiseDate),
        atcRemarks: updated.atcRemarks,
      },
      userId: userId ?? 'SYSTEM',
      notes: `Follow-up recorded: ${dto.remarks}`,
    });
    return {
      atcId: updated.atcId,
      promiseDate: isoDate(updated.atcPromiseDate),
      followupOn: updated.atcFollowupOn?.toISOString() ?? null,
      remarks: updated.atcRemarks,
    };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
