import { Injectable } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import { SalesContextService } from '../posting/sales-context.service';
import {
  StockReservationService,
  type ReservationShort,
} from '../posting/stock-reservation.service';
import { assertAccYearWritable, assertSalesmen, loadDayClosed } from '../posting/sales.guards';
import { throwSalesLocked, throwSalesRight } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { SALES_MENU_ID, isoDate, isoToday, num } from '../posting/sales-doc.utils';
import { SaleOrderService } from './sale-order.service';
import type {
  AmendSaleOrderDto,
  CancelSaleOrderDto,
  PostSaleOrderDto,
  SaleOrderKeysDto,
} from './dto/sale-order-lifecycle.dto';
import type { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import {
  SALE_ORDER_STATUS_SRC_DOC_TYPE,
  SALE_ORDER_STATUS_SRC_MODULE,
  type SaleOrderErrorDetail,
  type SaleOrderErrorResponse,
  type SaleOrderPayload,
} from './types/sale-order-api.types';

/**
 * HANDOVER §3 — the order's lifecycle verbs.
 *
 *   /post    DRAFT → CONFIRMED and the stock reservations; a shortfall is a
 *            WARNING (`SALES_RESERVE_SHORT`), never a refusal.
 *   /cancel  refused once anything is delivered (`SALES_ORDER_DELIVERED`);
 *            releases reservations, writes off every open line.
 *   /amend   after a partial delivery only undelivered lines may change
 *            (`SALES_ORDER_LINE_DELIVERED`); `soRevisionNo + 1`.
 *   /delete  DRAFT only (`SALES_ORDER_CONFIRMED`).
 */
const ORDER_STATUS = { DRAFT: 'DRAFT', CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED' } as const;

@Injectable()
export class SaleOrderLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: SaleOrderService,
    private readonly salesContext: SalesContextService,
    private readonly reservations: StockReservationService,
    private readonly audit: AuditLogService,
  ) {}

  async post(dto: PostSaleOrderDto): Promise<{ soStatus: string; warnings: ReservationShort[] }> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, dto);
      if (order.soStatus === ORDER_STATUS.CONFIRMED) {
        return { soStatus: order.soStatus, warnings: [] };
      }
      if (order.soStatus !== ORDER_STATUS.DRAFT) {
        throwSalesLocked(
          `This order is ${order.soStatus}`,
          SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'soId',
        );
      }
      const ctx = await this.salesContext.resolve(
        { companyId: order.soCompanyId, branchId: order.soBranchId },
        SALES_MENU_ID.SALES_ORDER,
        tx,
      );
      if (!ctx.rights.post) {
        throwSalesRight('This user may not post on this menu', SALES_ERROR_CODES.RIGHT_POST);
      }
      await assertAccYearWritable(tx, order.soCompanyId, order.soAccYear, 'soAccYear');
      const docDate = isoDate(order.soOrderDate) ?? isoToday();
      if (await loadDayClosed(tx, order.soCompanyId, order.soBranchId, docDate)) {
        throwSalesLocked(
          `The books for ${docDate} are closed at this branch`,
          SALES_ERROR_CODES.DAY_CLOSED,
          'soOrderDate',
        );
      }
      await assertSalesmen(
        tx,
        order.soCompanyId,
        order.soSalesmanId?.length ? order.soSalesmanId : null,
        { field: 'soSalesmanId' },
      );

      const lines = await tx.saleOrderItem.findMany({
        where: { soiOrderId: order.soId, soiAccYear: order.soAccYear, soiIsDeleted: false },
        orderBy: { soiLineNo: 'asc' },
      });
      const { reserved, warnings } = await this.reserve(tx, order, lines, ctx.actor, now);
      for (const l of lines) {
        const got = reserved.get(l.soiId) ?? 0;
        await tx.saleOrderItem.update({
          where: { soiId_soiAccYear: { soiId: l.soiId, soiAccYear: l.soiAccYear } },
          data: {
            soiIsReserved: got > 0,
            soiReservedQty: new Prisma.Decimal(Math.min(got, num(l.soiOrderQty)).toFixed(3)),
            soiModifiedOn: now,
            soiModifiedBy: ctx.actor,
          },
        });
      }
      await tx.saleOrder.update({
        where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
        data: { soStatus: ORDER_STATUS.CONFIRMED, soModifiedOn: now, soModifiedBy: ctx.actorName },
      });
      await this.trail(
        tx,
        order,
        TxnStatusEvent.POSTED,
        order.soStatus,
        ORDER_STATUS.CONFIRMED,
        ctx.actor,
        now,
        warnings.length ? `${warnings.length} line(s) short on reservation` : null,
      );
      await this.audit.logEntityChange(
        {
          action: 'approve',
          tableName: 'sale_order',
          screenName: 'Sales Order',
          screenType: 'transaction',
          pk: order.soId,
          displayName: order.soOrderRefno,
          originalRecord: { soStatus: order.soStatus },
          modifiedRecord: {
            soStatus: ORDER_STATUS.CONFIRMED,
            reservations: [...reserved.values()],
          },
          userId: ctx.actor,
          notes: 'Order confirmed',
        },
        tx,
      );
      return { soStatus: ORDER_STATUS.CONFIRMED, warnings };
    });
  }

  async cancel(dto: CancelSaleOrderDto): Promise<{ soStatus: string; cancelledLines: number }> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, dto);
      if (order.soStatus === ORDER_STATUS.CANCELLED) {
        return { soStatus: order.soStatus, cancelledLines: 0 };
      }
      const ctx = await this.salesContext.resolve(
        { companyId: order.soCompanyId, branchId: order.soBranchId },
        SALES_MENU_ID.SALES_ORDER,
        tx,
      );
      if (!ctx.rights.cancel) {
        throwSalesRight('This user may not cancel on this menu', SALES_ERROR_CODES.RIGHT_CANCEL);
      }
      const delivered = await tx.saleOrderItem.count({
        where: {
          soiOrderId: order.soId,
          soiAccYear: order.soAccYear,
          soiIsDeleted: false,
          soiDeliveredQty: { gt: 0 },
        },
      });
      if (delivered > 0) {
        throwSalesLocked(
          `${delivered} line(s) have been delivered — an order with deliveries is closed by cancelling its open lines, not cancelled whole`,
          SALES_ERROR_CODES.ORDER_DELIVERED,
          'soId',
        );
      }
      await this.reservations.release(
        tx,
        { docType: 'SALES_ORDER', docId: order.soId },
        dto.reason,
        ctx.actor,
        now,
      );
      const result = await this.orders.cancelOrderOpenLines(tx, {
        order,
        srcAccYear: order.soAccYear,
        targetLineId: null,
        cancelReason: dto.reason,
        actor: ctx.actor,
        now,
      });
      const after = await tx.saleOrder.findFirst({
        where: { soId: order.soId, soAccYear: order.soAccYear },
        select: { soStatus: true },
      });
      if (after?.soStatus !== ORDER_STATUS.CANCELLED) {
        await tx.saleOrder.update({
          where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
          data: {
            soStatus: ORDER_STATUS.CANCELLED,
            soModifiedOn: now,
            soModifiedBy: ctx.actorName,
          },
        });
        await this.trail(
          tx,
          order,
          TxnStatusEvent.CANCELLED,
          order.soStatus,
          ORDER_STATUS.CANCELLED,
          ctx.actor,
          now,
          dto.reason,
        );
      }
      return { soStatus: ORDER_STATUS.CANCELLED, cancelledLines: result.cancelledLines };
    });
  }

  async amend(dto: AmendSaleOrderDto): Promise<SaleOrderPayload> {
    const now = new Date();
    // 1 · the gates, under the row lock.
    const { order, ctx } = await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, {
        soId: dto.soId,
        soCompanyId: dto.soCompanyId,
        soBranchId: dto.soBranchId,
        soAccYear: dto.soAccYear,
      });
      if (order.soStatus === ORDER_STATUS.CANCELLED) {
        throwSalesLocked('This order is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'soId');
      }
      const ctx = await this.salesContext.resolve(
        { companyId: order.soCompanyId, branchId: order.soBranchId },
        SALES_MENU_ID.SALES_ORDER,
        tx,
      );
      if (!ctx.rights.amend) {
        throwSalesRight('This user may not amend on this menu', SALES_ERROR_CODES.RIGHT_AMEND);
      }
      if (order.soRevisionNo !== dto.baseRevision) {
        throwSalesLocked(
          `This order has been amended since you opened it (now revision ${order.soRevisionNo}, you sent ${dto.baseRevision}). Reload it and make the change again.`,
          SALES_ERROR_CODES.REVISION_STALE,
          'baseRevision',
        );
      }
      // After a partial delivery only undelivered lines may change.
      const lines = await tx.saleOrderItem.findMany({
        where: { soiOrderId: order.soId, soiAccYear: order.soAccYear, soiIsDeleted: false },
      });
      if (dto.items !== undefined) {
        const byId = new Map((dto.items ?? []).filter((i) => i.soiId).map((i) => [i.soiId!, i]));
        for (const l of lines) {
          const delivered = num(l.soiDeliveredQty);
          if (delivered <= 0) {
            continue;
          }
          const incoming = byId.get(l.soiId);
          const changed =
            !incoming ||
            (incoming.soiItemId !== undefined && incoming.soiItemId !== l.soiItemId) ||
            (incoming.soiItemUnitId !== undefined && incoming.soiItemUnitId !== l.soiItemUnitId) ||
            (incoming.soiOrderQty !== undefined && num(incoming.soiOrderQty) < delivered - 0.0005);
          if (changed) {
            throwSalesLocked(
              `Line ${l.soiLineNo} has ${delivered} delivered and cannot be removed, re-itemed or reduced below that`,
              SALES_ERROR_CODES.ORDER_LINE_DELIVERED,
              `items.${l.soiLineNo}`,
            );
          }
        }
      }
      return { order, ctx };
    });

    // 2 · the edit, through the ONE definition of an order save.
    const { baseRevision: _b, editRemark: _e, ...saveDto } = dto;
    void _b;
    void _e;
    const s = saveDto as SaveSaleOrderDto;
    delete (s as unknown as Record<string, unknown>).soStatus;
    const payload = await this.orders.save({ ...s, soId: order.soId });

    // 3 · the revision, the reservations and the trail.
    await this.prisma.$transaction(async (tx) => {
      const fresh = await this.lock(tx, {
        soId: order.soId,
        soCompanyId: order.soCompanyId,
        soBranchId: order.soBranchId,
        soAccYear: order.soAccYear,
      });
      if (fresh.soStatus === ORDER_STATUS.CONFIRMED || fresh.soStatus === 'PARTIAL') {
        const lines = await tx.saleOrderItem.findMany({
          where: { soiOrderId: fresh.soId, soiAccYear: fresh.soAccYear, soiIsDeleted: false },
          orderBy: { soiLineNo: 'asc' },
        });
        const { reserved } = await this.reserve(
          tx,
          fresh,
          lines.filter((l) => num(l.soiPendingQty) > 0),
          ctx.actor,
          now,
        );
        for (const l of lines) {
          const got = reserved.get(l.soiId) ?? 0;
          await tx.saleOrderItem.update({
            where: { soiId_soiAccYear: { soiId: l.soiId, soiAccYear: l.soiAccYear } },
            data: {
              soiIsReserved: got > 0,
              soiReservedQty: new Prisma.Decimal(Math.min(got, num(l.soiPendingQty)).toFixed(3)),
            },
          });
        }
      }
      await tx.saleOrder.update({
        where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
        data: {
          soRevisionNo: order.soRevisionNo + 1,
          soModifiedOn: now,
          soModifiedBy: ctx.actorName,
        },
      });
      await this.trail(
        tx,
        fresh,
        TxnStatusEvent.AMENDED,
        fresh.soStatus,
        fresh.soStatus,
        ctx.actor,
        now,
        dto.editRemark,
      );
    });
    return { ...payload, soRevisionNo: order.soRevisionNo + 1 } as SaleOrderPayload;
  }

  async deleteDraft(keys: SaleOrderKeysDto): Promise<{ soId: string; deleted: true }> {
    const order = await this.prisma.saleOrder.findFirst({
      where: {
        soId: keys.soId,
        soCompanyId: keys.soCompanyId,
        soBranchId: keys.soBranchId,
        soAccYear: keys.soAccYear,
        soIsDeleted: false,
      },
      select: { soStatus: true },
    });
    if (!order) {
      throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Order not found',
        'soId',
        `No active order found with id ${keys.soId}`,
      );
    }
    if (order.soStatus !== ORDER_STATUS.DRAFT) {
      throwSalesLocked(
        `This order is ${order.soStatus} — cancel it instead of deleting it`,
        SALES_ERROR_CODES.ORDER_CONFIRMED,
        'soId',
      );
    }
    return this.orders.softDelete(keys.soId, keys.soCompanyId, keys.soBranchId, keys.soAccYear);
  }

  private async reserve(
    tx: Prisma.TransactionClient,
    order: SaleOrder,
    lines: SaleOrderItem[],
    actor: string,
    now: Date,
  ) {
    return this.reservations.reserve(
      tx,
      {
        docType: 'SALES_ORDER',
        docId: order.soId,
        accYear: order.soAccYear,
        companyId: order.soCompanyId,
        branchId: order.soBranchId,
        tenantId: order.soTenantId,
        refno: order.soOrderRefno,
      },
      lines.map((l) => ({
        lineId: l.soiId,
        lineNo: l.soiLineNo,
        itemId: l.soiItemId,
        itemUnitId: l.soiItemUnitId,
        godownId: l.soiGodownId,
        qty: num(l.soiPendingQty) > 0 ? num(l.soiPendingQty) : num(l.soiOrderQty),
        expiresOn: l.soiReserveExpiresOn,
      })),
      actor,
      now,
    );
  }

  private async lock(tx: Prisma.TransactionClient, keys: SaleOrderKeysDto): Promise<SaleOrder> {
    const rows = await tx.$queryRaw<{ so_id: string }[]>`
      SELECT so_id FROM sales.sale_order
       WHERE so_id = ${keys.soId}::uuid AND so_acc_year = ${keys.soAccYear}::char(9)
         AND so_company_id = ${keys.soCompanyId}::uuid AND so_branch_id = ${keys.soBranchId}::uuid AND so_is_deleted = false
       FOR UPDATE`;
    if (rows.length === 0) {
      throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Order not found',
        'soId',
        `No active order found with id ${keys.soId}`,
      );
    }
    const order = await tx.saleOrder.findFirst({
      where: { soId: keys.soId, soAccYear: keys.soAccYear },
    });
    return order!;
  }

  private async trail(
    tx: Prisma.TransactionClient,
    order: SaleOrder,
    event: TxnStatusEvent,
    from: string | null,
    to: string,
    actor: string,
    now: Date,
    remarks: string | null,
  ): Promise<void> {
    await appendTxnStatusLog(tx, {
      companyId: order.soCompanyId,
      branchId: order.soBranchId,
      tenantId: order.soTenantId,
      accYear: order.soAccYear,
      srcModule: SALE_ORDER_STATUS_SRC_MODULE,
      srcDocType: SALE_ORDER_STATUS_SRC_DOC_TYPE,
      srcDocId: order.soId,
      srcDocRefno: order.soOrderRefno,
      event,
      fromStatus: from,
      toStatus: to,
      changedOn: now,
      changedBy: actor,
      remarks,
      deviceId: order.soDeviceId,
      sessionId: order.soSessionId,
    });
  }
}
