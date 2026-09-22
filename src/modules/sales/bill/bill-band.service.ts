import { Injectable } from '@nestjs/common';
import { SaleBill } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { SalesContextService } from '../posting/sales-context.service';
import { TransportBandService, type TransportBandRow } from '../posting/transport-band.service';
import { loadDayClosed } from '../posting/sales.guards';
import { throwSalesLocked } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { isoDate, isoToday } from '../posting/sales-doc.utils';
import { BillService } from './bill.service';
import type {
  BillTransportDto,
  DeliveryEvent,
  DeliveryStatusDto,
  UpdateRemarksDto,
} from './dto/bill-lifecycle.dto';
import {
  BILL_STATUS_POSTED,
  BILL_STATUS_SRC_DOC_TYPE,
  BILL_STATUS_SRC_MODULE,
} from './types/bill-api.types';

/**
 * The three verbs that edit a POSTED bill WITHOUT amending it — HANDOVER §2.10
 * `delivery-status`, §2.11 `update-remarks`, §2.12 `transport`.
 *
 * None of them bumps `sb_revision_no`: the document did not change. Each
 * writes its own `txn_status_log` row so the trail says what moved.
 */
const DELIVERY_ORDER: readonly string[] = [
  'NA',
  'PENDING',
  'VERIFIED',
  'PACKED',
  'DISPATCHED',
  'DELIVERED',
];

@Injectable()
export class BillBandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillService,
    private readonly salesContext: SalesContextService,
    private readonly transportBand: TransportBandService,
    private readonly audit: AuditLogService,
  ) {}

  /** §2.10 — VERIFIED (when required) → PACKED → DISPATCHED → DELIVERED, in order. */
  async deliveryStatus(dto: DeliveryStatusDto): Promise<{ sbDeliveryStatus: string }> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const bill = await this.bills.lockHeader(tx, dto);
      this.assertPosted(bill);
      await this.assertDayOpen(tx, bill);
      const settings = await this.salesContext.settings(bill.sbCompanyId, bill.sbBranchId);
      const requireVerify = await this.requireVerification(bill.sbCompanyId, bill.sbBranchId);
      void settings;
      const current = bill.sbDeliveryStatus === 'NA' ? 'PENDING' : bill.sbDeliveryStatus;
      const next: DeliveryEvent = dto.event;
      const from = DELIVERY_ORDER.indexOf(current);
      const to = DELIVERY_ORDER.indexOf(next);
      // VERIFIED is a step only when the branch asks for it.
      const expectedPrev = next === 'PACKED' && requireVerify ? 'VERIFIED' : DELIVERY_ORDER[to - 1];
      const allowed =
        to > from &&
        (next === 'VERIFIED' || (next === 'PACKED' && !requireVerify)
          ? true
          : current === expectedPrev);
      if (!allowed) {
        throwSalesLocked(
          `Delivery is ${current}; ${next} is not the next step${requireVerify ? ' (this branch verifies before dispatch)' : ''}`,
          SALES_ERROR_CODES.DELIVERY_ORDER,
          'event',
        );
      }
      const actor = this.salesContext.actor();
      await tx.saleBill.update({
        where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
        data: {
          sbDeliveryStatus: next,
          sbDeliveredOn: next === 'DELIVERED' ? now : bill.sbDeliveredOn,
          sbVehicleNo: dto.vehicleNo ?? bill.sbVehicleNo,
          sbModifiedOn: now,
          sbModifiedBy: actor,
        },
      });
      if (dto.lrNo) {
        const band = await this.transportBand.read(
          { docType: 'SALE_BILL', docId: bill.sbId, accYear: bill.sbAccYear },
          tx,
        );
        if (!band || band.lrNo !== dto.lrNo) {
          await this.transportBand.write(
            tx,
            this.ref(bill),
            { ...(band ?? { direction: 'OUTWARD' }), lrNo: dto.lrNo },
            actor,
            { gdrId: bill.sbDocRegisterId, now },
          );
        }
      }
      await appendTxnStatusLog(tx, {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        srcModule: BILL_STATUS_SRC_MODULE,
        srcDocType: BILL_STATUS_SRC_DOC_TYPE,
        srcDocId: bill.sbId,
        srcDocRefno: bill.sbBillRefno,
        event: next as unknown as TxnStatusEvent,
        fromStatus: current,
        toStatus: next,
        changedOn: now,
        changedBy: actor,
        remarks: dto.remarks ?? null,
        deviceId: bill.sbDeviceId,
        sessionId: bill.sbSessionId,
      });
      return { sbDeliveryStatus: next };
    });
  }

  /** §2.11 — text only, on a POSTED bill. */
  async updateRemarks(dto: UpdateRemarksDto): Promise<{ sbRemarks: string | null }> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const bill = await this.bills.lockHeader(tx, dto);
      this.assertPosted(bill);
      const actor = this.salesContext.actor();
      await tx.saleBill.update({
        where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
        data: { sbRemarks: dto.sbRemarks ?? null, sbModifiedOn: now, sbModifiedBy: actor },
      });
      await appendTxnStatusLog(tx, {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        srcModule: BILL_STATUS_SRC_MODULE,
        srcDocType: BILL_STATUS_SRC_DOC_TYPE,
        srcDocId: bill.sbId,
        srcDocRefno: bill.sbBillRefno,
        event: 'REMARKS_EDITED' as TxnStatusEvent,
        fromStatus: bill.sbStatus,
        toStatus: bill.sbStatus,
        changedOn: now,
        changedBy: actor,
        remarks: dto.editRemark,
        deviceId: bill.sbDeviceId,
        sessionId: bill.sbSessionId,
      });
      await this.audit.logEntityChange(
        {
          action: 'update',
          tableName: 'sale_bill',
          screenName: 'Sale Bill',
          screenType: 'transaction',
          pk: bill.sbId,
          displayName: bill.sbBillRefno || bill.sbId,
          originalRecord: { sbRemarks: bill.sbRemarks },
          modifiedRecord: { sbRemarks: dto.sbRemarks ?? null },
          userId: actor,
          notes: `Remarks edited: ${dto.editRemark}`,
        },
        tx,
      );
      return { sbRemarks: dto.sbRemarks ?? null };
    });
  }

  /**
   * §2.12 — the band on its own verb. Refused entirely once an IRN or an
   * e-way bill exists (GST_DECLARED_LOCKED, inside `TransportBandService.write`).
   */
  async transport(dto: BillTransportDto): Promise<TransportBandRow> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const bill = await this.bills.lockHeader(tx, dto);
      if (bill.sbStatus === 'CANCELLED') {
        throwSalesLocked('This bill is CANCELLED', SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
      }
      await this.assertDayOpen(tx, bill);
      const actor = this.salesContext.actor();
      const row = await this.transportBand.write(tx, this.ref(bill), dto.transport, actor, {
        gdrId: bill.sbDocRegisterId,
        now,
      });
      await appendTxnStatusLog(tx, {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        srcModule: BILL_STATUS_SRC_MODULE,
        srcDocType: BILL_STATUS_SRC_DOC_TYPE,
        srcDocId: bill.sbId,
        srcDocRefno: bill.sbBillRefno,
        event: 'TRANSPORT_EDITED' as TxnStatusEvent,
        fromStatus: bill.sbStatus,
        toStatus: bill.sbStatus,
        changedOn: now,
        changedBy: actor,
        deviceId: bill.sbDeviceId,
        sessionId: bill.sbSessionId,
      });
      return row;
    });
  }

  private ref(bill: SaleBill) {
    return {
      docType: 'SALE_BILL' as const,
      docId: bill.sbId,
      accYear: bill.sbAccYear,
      companyId: bill.sbCompanyId,
      branchId: bill.sbBranchId,
      tenantId: bill.sbTenantId,
      docRefno: bill.sbBillRefno,
    };
  }

  private assertPosted(bill: SaleBill): void {
    if (bill.sbStatus !== BILL_STATUS_POSTED) {
      throwSalesLocked(
        `This verb needs a POSTED bill (it is ${bill.sbStatus})`,
        bill.sbStatus === 'CANCELLED'
          ? SALES_ERROR_CODES.BILL_CANCELLED
          : SALES_ERROR_CODES.DOC_NOT_DRAFT,
        'sbId',
      );
    }
  }

  private async assertDayOpen(
    tx: Parameters<typeof loadDayClosed>[0],
    bill: SaleBill,
  ): Promise<void> {
    const d = isoDate(bill.sbBillDate) ?? isoToday();
    if (await loadDayClosed(tx, bill.sbCompanyId, bill.sbBranchId, d)) {
      throwSalesLocked(
        `The books for ${d} are closed at this branch`,
        SALES_ERROR_CODES.DAY_CLOSED,
        'sbBillDate',
      );
    }
  }

  private async requireVerification(companyId: string, branchId: string): Promise<boolean> {
    const v = (
      (await this.salesContext.setting(
        companyId,
        branchId,
        'sales.require_verification_before_dispatch',
      )) ?? ''
    )
      .trim()
      .toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
}
