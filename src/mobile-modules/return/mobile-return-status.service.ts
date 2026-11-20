import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { assertMobileCompany, resolveMobileDevice } from '../common/mobile-scope';
import {
  MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE,
  MobileReturnStatusQueryDto,
} from './dto/mobile-return.dto';
import { phoneApprovalStatus } from './mobile-return-plan';
import type {
  MobileReturnAdjusted,
  MobileReturnRowStatus,
  MobileReturnStatus,
  MobileReturnStatusPayload,
} from './types/mobile-return-api.types';

/**
 * How far behind the read `asOf` is set. A posting transaction stamps its
 * times when it starts and may run up to two minutes, so a change can become
 * visible after a read that began later than its stamp. Reading again from
 * five minutes back (and `since` inclusive) never misses one; the phone sees a
 * few rows twice and keeps the newer. As the receipts' status read.
 */
export const MOBILE_RETURN_STATUS_OVERLAP_MINUTES = 5;

interface StatusRow {
  srClientUuid: string;
  srId: string;
  srAccYear: string;
  srReturnRefno: string | null;
  srStatus: string;
  srIsDeleted: boolean;
  revisionNo: number | null;
  srReturnAmt: string;
  settleStatus: string | null;
  cancelledOn: Date | null;
  cancelReason: string | null;
  tapStatus: string | null;
  tapNote: string | null;
  updatedOn: Date;
  total: number;
  adjusted: MobileReturnAdjusted[];
}

/**
 * GET /mobile/returns/status: what became of this phone's returns in VK Nex
 * (posted by the office after a HELD upload, approved or rejected, cancelled,
 * deleted). This phone's returns are the ones uploaded through POST
 * /mobile/returns/create from it: a client uuid, and sr_device_id = its dev_id.
 * Read-only.
 */
@Injectable()
export class MobileReturnStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async status(query: MobileReturnStatusQueryDto): Promise<MobileReturnStatusPayload> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE;
    await assertMobileCompany(this.prisma, query.companyId);
    const device = await resolveMobileDevice(this.prisma, query.deviceUid);
    const [clock] = await this.prisma.$queryRaw<{ asOf: Date }[]>`
      SELECT clock_timestamp() - make_interval(mins => ${MOBILE_RETURN_STATUS_OVERLAP_MINUTES}::int) AS "asOf"`;
    const rows = await this.rowsOf(query, device.devId, pageSize, (page - 1) * pageSize);
    // A page past the end has no row to read the count from: ask for the first one.
    const total =
      rows[0]?.total ??
      (page > 1 ? ((await this.rowsOf(query, device.devId, 1, 0))[0]?.total ?? 0) : 0);
    return {
      asOf: clock.asOf.toISOString(),
      page,
      pageSize,
      total,
      hasMore: (page - 1) * pageSize + rows.length < total,
      companyId: query.companyId,
      returns: rows.map((row): MobileReturnStatus => {
        const approval = row.tapStatus ? phoneApprovalStatus(row.tapStatus) : null;
        const status: MobileReturnRowStatus = row.srIsDeleted
          ? 'DELETED'
          : (row.srStatus as MobileReturnRowStatus);
        return {
          srClientUuid: row.srClientUuid,
          srId: row.srId,
          srAccYear: row.srAccYear,
          srReturnRefno: row.srReturnRefno,
          status,
          approval: approval ? { status: approval, note: row.tapNote } : null,
          revisionNo: row.revisionNo ?? 1,
          srReturnAmt: row.srReturnAmt,
          settleStatus: row.settleStatus,
          adjusted: row.adjusted,
          cancelledOn:
            row.srStatus === 'CANCELLED' && row.cancelledOn ? row.cancelledOn.toISOString() : null,
          cancelReason: row.srStatus === 'CANCELLED' ? row.cancelReason : null,
          updatedOn: row.updatedOn.toISOString(),
        };
      }),
    };
  }

  /**
   * One page of this phone's returns changed since `since`, oldest change
   * first. A change is the row's own (saved, posted, cancelled, deleted) or
   * one of its approval requests' (filed, decided, withdrawn).
   */
  private rowsOf(
    query: MobileReturnStatusQueryDto,
    devId: string,
    limit: number,
    offset: number,
  ): Promise<StatusRow[]> {
    const since = query.since
      ? Prisma.sql`WHERE x.updated_on >= ${query.since}::timestamptz`
      : Prisma.empty;
    return this.prisma.$queryRaw<StatusRow[]>`
      WITH mine AS (
        SELECT r.sr_id, r.sr_acc_year, r.sr_client_uuid, r.sr_return_refno, r.sr_status,
               r.sr_is_deleted, r.sr_revision_no, r.sr_return_amt, r.sr_settle_status,
               r.sr_created_on, r.sr_modified_on
          FROM sales.sale_return r
         WHERE r.sr_company_id = ${query.companyId}::uuid
           AND r.sr_client_uuid IS NOT NULL
           AND r.sr_device_id = ${devId}
      ),
      x AS (
        SELECT m.*, cx.changed_on AS cancelled_on, cx.remarks AS cancel_reason,
               ap.tap_status, ap.tap_decision_note,
               GREATEST(m.sr_created_on, m.sr_modified_on, cx.changed_on,
                        (SELECT max(GREATEST(a.tap_requested_on, a.tap_decided_on, a.tap_modified_on))
                           FROM accounts.till_approval a
                          WHERE a.tap_src_doc_type = 'SALE_RETURN'
                            AND a.tap_src_doc_id = m.sr_id
                            AND a.tap_is_deleted = false)) AS updated_on
          FROM mine m
          LEFT JOIN LATERAL (
            SELECT t.tsl_changed_on AS changed_on, t.tsl_remarks AS remarks
              FROM public.txn_status_log t
             WHERE t.tsl_src_doc_type = 'SALE_RETURN'
               AND t.tsl_src_doc_id = m.sr_id
               AND t.tsl_event = 'CANCELLED'
               AND t.tsl_is_deleted = false
             ORDER BY t.tsl_changed_on DESC
             LIMIT 1
          ) cx ON m.sr_status = 'CANCELLED'
          LEFT JOIN LATERAL (
            SELECT a.tap_status, a.tap_decision_note
              FROM accounts.till_approval a
             WHERE a.tap_src_doc_type = 'SALE_RETURN'
               AND a.tap_src_doc_id = m.sr_id
               AND a.tap_is_deleted = false
               AND a.tap_status <> 'CANCELLED'
             ORDER BY a.tap_requested_on DESC
             LIMIT 1
          ) ap ON true
      )
      SELECT x.sr_client_uuid::text AS "srClientUuid",
             x.sr_id::text AS "srId",
             btrim(x.sr_acc_year::text) AS "srAccYear",
             x.sr_return_refno AS "srReturnRefno",
             x.sr_status AS "srStatus",
             x.sr_is_deleted AS "srIsDeleted",
             x.sr_revision_no AS "revisionNo",
             to_char(COALESCE(x.sr_return_amt, 0), 'FM9999999999990.00') AS "srReturnAmt",
             x.sr_settle_status AS "settleStatus",
             x.cancelled_on AS "cancelledOn",
             x.cancel_reason AS "cancelReason",
             x.tap_status AS "tapStatus",
             x.tap_decision_note AS "tapNote",
             x.updated_on AS "updatedOn",
             count(*) OVER ()::int AS total,
             COALESCE((
               SELECT json_agg(json_build_object(
                        'billId', k.abl_id::text,
                        'billAccYear', btrim(k.abl_acc_year::text),
                        'refno', k.abl_doc_refno,
                        'amount', to_char(j.abj_amount, 'FM9999999999990.00'))
                      ORDER BY j.abj_created_on, k.abl_id)
                 FROM accounts.acc_bill_adjustment j
                 JOIN accounts.acc_bill_balance b
                   ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
                 JOIN accounts.acc_bill_balance k
                   ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
                WHERE b.abl_src_doc_id = x.sr_id AND b.abl_acc_year = x.sr_acc_year
                  AND b.abl_src_doc_type = 'SALE_RETURN' AND b.abl_is_deleted = false
                  AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'DR'
                  AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment z
                                   WHERE z.abj_reversal_of_id = j.abj_id AND z.abj_is_deleted = false)
                  AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL
                  AND k.abl_dr_cr = 'DR' AND k.abl_created_on < b.abl_created_on), '[]'::json) AS adjusted
        FROM x
        ${since}
       ORDER BY x.updated_on, x.sr_id
       LIMIT ${limit}::int OFFSET ${offset}::int`;
  }
}
