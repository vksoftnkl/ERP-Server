import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { SalesContextService } from '../posting/sales-context.service';
import { DELIVERY_ERROR_CODES as C, DELIVERY_MENU_ID } from './core/delivery.constants';
import { DeliveryPendingService, dec } from './core/delivery-pending.service';
import { DeliveryStatusService } from './core/delivery-status.service';
import { eligibleLineWhere, lineEventSumsLateral } from './core/delivery-pending.sql';
import { refuseWith } from './delivery.errors';
import { istClock } from './delivery-note-read.service';
import type { DeliveryExceptionsQueryDto, DeliveryModeDto } from './dto/delivery-note.dto';

const q3 = (d: Prisma.Decimal): string => d.toDecimalPlaces(3).toString();

/**
 * Plan §8.2 — /deliveries/* (Pending Deliveries, menu 304, and the bill):
 * the posted bill's Pickup ↔ Dispatch switch (Q4) and the over-given lines a
 * sync can leave behind (decision 46).
 */
@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesContext: SalesContextService,
    private readonly pending: DeliveryPendingService,
    private readonly status: DeliveryStatusService,
  ) {}

  /**
   * POST /deliveries/mode — EDIT on Sales Bill (decision 44). The bill is
   * POSTED, Pickup / Dispatch, still has something to give; the new mode is
   * the other of the two and a reason is given. Writes the mode and a
   * DELIVERY_MODE step; no revision, no amend (decision 43).
   */
  async mode(dto: DeliveryModeDto) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const rights = await this.salesContext.rights(DELIVERY_MENU_ID.SALE_BILL, tx);
      if (!rights.edit) {
        refuseWith(C.DELIVERY_RIGHT_MODE, "This user may not change a bill's delivery mode (Sales Bill EDIT)", 'userId');
      }
      const [bill] = await tx.$queryRaw<
        {
          sb_id: string;
          sb_acc_year: string;
          sb_company_id: string;
          sb_branch_id: string;
          sb_tenant_id: string | null;
          sb_bill_refno: string | null;
          sb_status: string;
          sb_delivery_mode: string;
          sb_delivery_status: string;
          sb_device_id: string | null;
          sb_session_id: string | null;
        }[]
      >`
        SELECT sb_id, sb_acc_year, sb_company_id, sb_branch_id, sb_tenant_id, sb_bill_refno, sb_status,
               sb_delivery_mode, sb_delivery_status, sb_device_id, sb_session_id
          FROM sales.sale_bill
         WHERE sb_id = ${dto.sbId}::uuid AND sb_acc_year = ${dto.accYear}::bpchar
           AND sb_company_id = ${dto.companyId}::uuid AND sb_branch_id = ${dto.branchId}::uuid
           AND sb_is_deleted = false
         FOR UPDATE`;
      if (!bill) {
        refuseWith(C.DN_BILL_NOT_POSTED, `No bill ${dto.sbId} in this branch and year`, 'sbId', { bill: '' });
      }
      const refno = bill.sb_bill_refno ?? '';
      if (bill.sb_status !== 'POSTED') {
        refuseWith(C.DN_BILL_NOT_POSTED, `${refno} is not posted, or is cancelled`, 'sbId', { bill: refno });
      }
      if (bill.sb_delivery_mode !== 'PICKUP' && bill.sb_delivery_mode !== 'DISPATCH') {
        refuseWith(C.DELIVERY_MODE_INSTANT, `${refno} was given at the counter`, 'sbDeliveryMode', { bill: refno });
      }
      const lines = (
        await this.pending.linesOfBills(tx, [{ billId: bill.sb_id, billAccYear: bill.sb_acc_year }])
      ).filter((l) => l.eligible);
      if (!lines.some((l) => l.pendingQty.greaterThan(0))) {
        refuseWith(C.DELIVERY_MODE_GIVEN, `${refno} is fully given already`, 'sbId', { bill: refno });
      }
      const next = (dto.sbDeliveryMode ?? '').trim().toUpperCase();
      if (next !== 'PICKUP' && next !== 'DISPATCH') {
        refuseWith(
          C.DELIVERY_MODE_INVALID,
          `A posted bill only switches between PICKUP and DISPATCH; ${next || '(blank)'} was sent`,
          'sbDeliveryMode',
        );
      }
      const reason = (dto.reason ?? '').trim();
      if (!reason) {
        refuseWith(C.DELIVERY_MODE_REASON_REQUIRED, 'Say why the mode changes', 'reason');
      }
      if (next !== bill.sb_delivery_mode) {
        const actorName = await this.salesContext.actorName(tx);
        await tx.$executeRaw`
          UPDATE sales.sale_bill
             SET sb_delivery_mode = ${next}, sb_modified_on = ${now}, sb_modified_by = ${actorName}
           WHERE sb_id = ${bill.sb_id}::uuid AND sb_acc_year = ${bill.sb_acc_year}::bpchar`;
        await appendTxnStatusLog(tx, {
          companyId: bill.sb_company_id,
          branchId: bill.sb_branch_id,
          tenantId: bill.sb_tenant_id,
          accYear: bill.sb_acc_year,
          srcModule: TxnStatusSrcModule.SALES,
          srcDocType: TxnStatusDocType.SALE_BILL,
          srcDocId: bill.sb_id,
          srcDocRefno: bill.sb_bill_refno,
          event: TxnStatusEvent.DELIVERY_MODE,
          fromStatus: bill.sb_delivery_mode,
          toStatus: next,
          changedOn: now,
          changedBy: this.salesContext.actor(),
          remarks: reason.slice(0, 500),
          deviceId: bill.sb_device_id,
          sessionId: bill.sb_session_id,
        });
      }
      const [after] = await this.status.recompute(tx, [{ billId: bill.sb_id, billAccYear: bill.sb_acc_year }]);
      return {
        sbId: bill.sb_id,
        sbAccYear: bill.sb_acc_year.trim(),
        sbBillRefno: bill.sb_bill_refno,
        sbDeliveryMode: next,
        sbDeliveryModeBefore: bill.sb_delivery_mode,
        sbDeliveryStatus: after?.statusAfter ?? bill.sb_delivery_status,
        changed: next !== bill.sb_delivery_mode,
      };
    });
  }

  /**
   * GET /deliveries/exceptions — VIEW on 304. Over-given bill lines
   * (settled > billed), which only a sync or a broken home-site rule can
   * leave (decision 46). Scans every eligible line of the branch, not only
   * the open-status prefilter, so a wrong cache cannot hide one.
   */
  async exceptions(q: DeliveryExceptionsQueryDto) {
    const rights = await this.salesContext.rights(DELIVERY_MENU_ID.PENDING_DELIVERIES);
    if (!rights.view) {
      refuseWith(C.DELIVERY_RIGHT_VIEW, 'This user may not open Pending Deliveries (menu 304)', 'userId');
    }
    const rows = await this.prisma.$queryRaw<
      {
        sb_id: string;
        sb_acc_year: string;
        sb_bill_refno: string | null;
        sbi_id: string;
        sbi_line_no: number;
        item_name: string | null;
        godown_name: string | null;
        billed: Prisma.Decimal;
        settled: Prisma.Decimal;
        last_kind: string | null;
        last_refno: string | null;
        last_at: Date | null;
      }[]
    >`
      SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, i.sbi_id, i.sbi_line_no,
             im.item_name_en AS item_name, g.gdl_name AS godown_name,
             i.sbi_bill_qty AS billed, COALESCE(ev.settled_qty, 0) AS settled,
             le.sde_kind AS last_kind, le.sde_src_refno AS last_refno, le.sde_event_datetime AS last_at
        FROM sales.sale_bill b
        JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
        JOIN inventory.item_master im ON im.item_id = i.sbi_item_id
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = i.sbi_godown_id
        LEFT JOIN LATERAL ${lineEventSumsLateral()} ev ON true
        LEFT JOIN LATERAL (
          SELECT e.sde_kind, e.sde_src_refno, e.sde_event_datetime
            FROM sales.sale_delivery_event e
           WHERE e.sde_bill_item_id = i.sbi_id AND e.sde_bill_acc_year = i.sbi_acc_year
           ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC LIMIT 1
        ) le ON true
       WHERE b.sb_company_id = ${q.companyId}::uuid AND b.sb_branch_id = ${q.branchId}::uuid
         AND ${eligibleLineWhere()}
         AND COALESCE(ev.settled_qty, 0) > i.sbi_bill_qty
       ORDER BY b.sb_bill_date, b.sb_bill_refno, i.sbi_line_no`;
    return {
      rows: rows.map((r) => ({
        billId: r.sb_id,
        billAccYear: r.sb_acc_year.trim(),
        billRefno: r.sb_bill_refno,
        billItemId: r.sbi_id,
        lineNo: r.sbi_line_no,
        itemName: r.item_name ?? '',
        godownName: r.godown_name ?? '',
        billedQty: q3(dec(r.billed)),
        settledQty: q3(dec(r.settled)),
        overQty: q3(dec(r.settled).minus(dec(r.billed))),
        lastEvent: r.last_kind
          ? { kind: r.last_kind, refno: r.last_refno, at: r.last_at ? istClock(r.last_at) : null }
          : null,
      })),
      rights: { view: rights.view, print: rights.print, export: rights.export },
    };
  }
}
