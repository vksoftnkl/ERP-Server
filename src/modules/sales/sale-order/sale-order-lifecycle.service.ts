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
import {
  SALE_ORDER_AUDIT_SCREEN_NAME,
  SaleOrderService,
  assertSaleOrderNotTerminal,
  finishedOrderHoldRelease,
} from './sale-order.service';
import type {
  AmendSaleOrderDto,
  CancelSaleOrderDto,
  PostSaleOrderDto,
  SaleOrderKeysDto,
} from './dto/sale-order-lifecycle.dto';
import type { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { ORDER_TX_OPTIONS } from './sale-order-tx.options';
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
 *            (`SALES_ORDER_LINE_DELIVERED`); `soRevisionNo + 1`; ONE History
 *            revision and the AMENDED step "Rev n: <edit remark>" (P6).
 *   /delete  DRAFT only (`SALES_ORDER_CONFIRMED`).
 *
 * A finished order (COMPLETED / CANCELLED / CLOSED / EXPIRED) is refused by
 * /post, /amend and /cancel as by the save: `assertSaleOrderNotTerminal`
 * (CANCELLED → SALES_DOC_CANCELLED, the rest → SALES_DOC_NOT_DRAFT).
 */
const ORDER_STATUS = { DRAFT: 'DRAFT', CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED' } as const;
/** The statuses whose lines hold stock reservations (a DRAFT holds none). */
const RESERVING_STATUSES: readonly string[] = [ORDER_STATUS.CONFIRMED, 'PARTIAL'];

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
    return this.prisma.$transaction((tx) => this.postInTx(tx, dto, now), ORDER_TX_OPTIONS);
  }

  /**
   * Notes 94 B / 106 — `/sale-orders/create` with `post: true` (or
   * `soStatus: 'CONFIRMED'`): the draft save and the whole of `/post` — the
   * reservations, CONFIRMED, the trail — in ONE transaction. A refusal rolls
   * the save back with the post: no header, no lines, no number consumed.
   * 'CONFIRMED' in the body is the INSTRUCTION, not a column value: the save
   * writes a DRAFT and the post moves it, so the trail reads CREATED → POSTED
   * and the reservations are real. Judged on the Post right alone (94 A).
   */
  async saveAndPost(
    dto: SaveSaleOrderDto,
  ): Promise<SaleOrderPayload & { warnings: ReservationShort[] }> {
    const { post: _post, ...rest } = dto;
    void _post;
    const saveDto = rest as SaveSaleOrderDto;
    delete (saveDto as unknown as Record<string, unknown>).soStatus;
    this.orders.prepareSave(saveDto);
    const now = new Date();
    let keys: SaleOrderKeysDto | null = null;
    let warnings: ReservationShort[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        // An edit of a CONFIRMED order (the Qt entry sends its status back,
        // so its saves arrive here) moves the reservations as /amend does,
        // and its shortfalls are the answer's warnings; postInTx then answers
        // the confirmed order as it is.
        let saved: SaleOrderPayload;
        let reserveWarnings: ReservationShort[] = [];
        if (saveDto.soId) {
          const over = await this.saveOverInTx(tx, saveDto, now);
          saved = over;
          reserveWarnings = over.warnings;
        } else {
          saved = await this.orders.createOrderInTx(tx, saveDto);
        }
        keys = {
          soId: saved.soId,
          soCompanyId: saved.soCompanyId,
          soBranchId: saved.soBranchId,
          soAccYear: saved.soAccYear,
        };
        warnings = [...reserveWarnings, ...(await this.postInTx(tx, keys, now)).warnings];
      }, ORDER_TX_OPTIONS);
    } catch (error: unknown) {
      this.orders.throwIfDuplicate(error);
      throw error;
    }
    const k = keys as unknown as SaleOrderKeysDto;
    const payload = await this.orders.getById(k.soId, k.soCompanyId, k.soBranchId, k.soAccYear);
    return { ...payload, warnings };
  }

  /**
   * `/create` WITHOUT the confirm instruction. A new order is the order
   * service's plain save; an edit goes through saveOverInTx, so an edit of a
   * CONFIRMED order moves its reservations (2026-11-11).
   */
  async save(dto: SaveSaleOrderDto): Promise<SaleOrderPayload & { warnings: ReservationShort[] }> {
    if (!dto.soId) {
      return { ...(await this.orders.save(dto)), warnings: [] };
    }
    this.orders.prepareSave(dto);
    try {
      return await this.prisma.$transaction(
        (tx) => this.saveOverInTx(tx, dto, new Date()),
        ORDER_TX_OPTIONS,
      );
    } catch (error: unknown) {
      this.orders.throwIfDuplicate(error);
      throw error;
    }
  }

  /**
   * A save over an existing order (`/create` with its soId, plain or with the
   * confirm instruction), in the caller's transaction. Run `prepareSave` first.
   *
   * An order that holds no stock (DRAFT, or one the save refuses: not found,
   * finished) is the order service's update exactly as before. A CONFIRMED /
   * PARTIAL order takes the same reservation steps as /amend: the reserved
   * figures capped before the save, the update WITHOUT its own revision, the
   * order's holds released and its pending lines re-reserved, then the save's
   * ONE revision ('Order updated'), so its `after` shows what the lines hold.
   * Unlike /amend: no baseRevision, no revision-number bump, no AMENDED step.
   * The Amend right is still judged inside the update (403 SALES_RIGHT_AMEND).
   * `warnings` are the re-reserve's shortfalls (SALES_RESERVE_SHORT), as a
   * fresh confirm reports them.
   */
  async saveOverInTx(
    tx: Prisma.TransactionClient,
    dto: SaveSaleOrderDto,
    now: Date,
  ): Promise<SaleOrderPayload & { warnings: ReservationShort[] }> {
    await tx.$queryRaw`
      SELECT so_id FROM sales.sale_order
       WHERE so_id = ${dto.soId}::uuid AND so_is_deleted = false
       FOR UPDATE`;
    const stored = await tx.saleOrder.findFirst({ where: { soId: dto.soId, soIsDeleted: false } });
    if (!stored || !RESERVING_STATUSES.includes(stored.soStatus)) {
      return { ...(await this.orders.updateOrderInTx(tx, dto)), warnings: [] };
    }
    const lines = await tx.saleOrderItem.findMany({
      where: { soiOrderId: stored.soId, soiAccYear: stored.soAccYear, soiIsDeleted: false },
    });
    capReservedQty(dto, lines);
    const before = await this.orders.getById(
      stored.soId,
      stored.soCompanyId,
      stored.soBranchId,
      stored.soAccYear,
      tx,
    );
    const payload = await this.orders.updateOrderInTx(tx, dto, { revision: false });
    const keys = {
      soId: stored.soId,
      soCompanyId: stored.soCompanyId,
      soBranchId: stored.soBranchId,
      soAccYear: stored.soAccYear,
    };
    const fresh = await this.lock(tx, keys);
    const ctx = await this.salesContext.resolve(
      { companyId: fresh.soCompanyId, branchId: fresh.soBranchId },
      SALES_MENU_ID.SALES_ORDER,
      tx,
    );
    const { held, warnings } = await this.rereserveInTx(tx, fresh, ctx.actor, now);
    await this.orders.writeRevision(tx, fresh, before, ctx.actor, 'Order updated');
    return { ...withHeld(payload, held), warnings };
  }

  /**
   * The reservations of a CONFIRMED / PARTIAL order whose lines may have
   * changed (/amend, or a save over the order). Every live hold of the order
   * is released ('Re-reserved'), not only those of the lines re-reserved: a
   * line dropped or renumbered, or one with nothing pending, kept its OPEN
   * rows under a line number reserve() never visits (2026-11-11). The pending
   * lines are then reserved afresh, FEFO, and each line's soi_is_reserved /
   * soi_reserved_qty is written from what it now holds (capped at pending),
   * in Decimal. Any other status holds nothing and is left alone. `warnings`
   * are reserve()'s shortfalls (SALES_RESERVE_SHORT): never a refusal.
   */
  private async rereserveInTx(
    tx: Prisma.TransactionClient,
    order: SaleOrder,
    actor: string,
    now: Date,
  ): Promise<{ held: Map<string, HeldFigures>; warnings: ReservationShort[] }> {
    const held = new Map<string, HeldFigures>();
    if (!RESERVING_STATUSES.includes(order.soStatus)) {
      return { held, warnings: [] };
    }
    const current = await tx.saleOrderItem.findMany({
      where: { soiOrderId: order.soId, soiAccYear: order.soAccYear, soiIsDeleted: false },
      orderBy: { soiLineNo: 'asc' },
    });
    await this.reservations.release(
      tx,
      { docType: 'SALES_ORDER', docId: order.soId },
      'Re-reserved',
      actor,
      now,
    );
    const pendingOf = (l: SaleOrderItem) => new Prisma.Decimal(l.soiPendingQty ?? 0);
    const { reserved, warnings } = await this.reserve(
      tx,
      order,
      current.filter((l) => pendingOf(l).greaterThan(0)),
      actor,
      now,
    );
    for (const l of current) {
      const got = new Prisma.Decimal(reserved.get(l.soiId) ?? 0);
      const figures: HeldFigures = {
        soiIsReserved: got.greaterThan(0),
        soiReservedQty: Prisma.Decimal.min(got, pendingOf(l)).toDecimalPlaces(3),
      };
      await tx.saleOrderItem.update({
        where: { soiId_soiAccYear: { soiId: l.soiId, soiAccYear: l.soiAccYear } },
        data: figures,
      });
      held.set(l.soiId, figures);
    }
    return { held, warnings };
  }

  /**
   * The confirmation itself, inside a transaction the caller owns: the lock,
   * the status gates, the right, the day, the reservations, CONFIRMED and the
   * trail. Shared by `/post` and the one-call save-and-confirm. Public for
   * the order desk's merge (`/sale-order-desk/merge`), which confirms the new
   * order inside the same transaction that closes the old ones.
   */
  async postInTx(
    tx: Prisma.TransactionClient,
    dto: SaleOrderKeysDto,
    now: Date,
  ): Promise<{ soStatus: string; warnings: ReservationShort[] }> {
    const order = await this.lock(tx, dto);
    // Already confirmed (CONFIRMED, or the older PARTIAL): answered as it is,
    // a harmless repeat. A save-and-confirm over such an order has moved its
    // reservations in saveOverInTx already; refusing PARTIAL here (409
    // SALES_DOC_NOT_DRAFT) rolled that whole save back (review 2026-11-11).
    if (RESERVING_STATUSES.includes(order.soStatus)) {
      return { soStatus: order.soStatus, warnings: [] };
    }
    // CANCELLED → SALES_DOC_CANCELLED, as the save and /amend answer it.
    assertSaleOrderNotTerminal(order);
    if (order.soStatus !== ORDER_STATUS.DRAFT) {
      throwSalesLocked(`This order is ${order.soStatus}`, SALES_ERROR_CODES.DOC_NOT_DRAFT, 'soId');
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
      const got = new Prisma.Decimal(reserved.get(l.soiId) ?? 0);
      await tx.saleOrderItem.update({
        where: { soiId_soiAccYear: { soiId: l.soiId, soiAccYear: l.soiAccYear } },
        data: {
          soiIsReserved: got.greaterThan(0),
          soiReservedQty: Prisma.Decimal.min(got, l.soiOrderQty).toDecimalPlaces(3),
          soiModifiedOn: now,
          soiModifiedBy: ctx.actor,
        },
      });
    }
    await tx.saleOrder.update({
      where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
      data: {
        soStatus: ORDER_STATUS.CONFIRMED,
        soModifiedOn: now,
        // Plan SO-5: the signed-in user's id, as the save paths stamp it; /get
        // names it (createdByName / modifiedByName).
        soModifiedBy: ctx.actor,
        // so_pending_amt & co. off the lines being confirmed, so an order saved
        // before the save paths restated them comes out right too.
        ...this.orders.orderAmountsOf(lines),
      },
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
        // Screen 87, as every sales-order audit row (user, 2026-11-11).
        screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
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
      // Any other finished order (CLOSED / EXPIRED …) is not moved to CANCELLED.
      assertSaleOrderNotTerminal(order);
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
        select: { soStatus: true, soDeliveryHold: true },
      });
      if (after?.soStatus !== ORDER_STATUS.CANCELLED) {
        // The line cancel left it open, so this write finishes it — and a held
        // order is released with it (cancelOrderOpenLines does the same when
        // IT is what ends the order).
        const holdRelease = finishedOrderHoldRelease(
          { soDeliveryHold: after?.soDeliveryHold ?? order.soDeliveryHold },
          ORDER_STATUS.CANCELLED,
          'cancelled',
          ctx.actor,
          now,
        );
        await tx.saleOrder.update({
          where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
          data: {
            soStatus: ORDER_STATUS.CANCELLED,
            soModifiedOn: now,
            soModifiedBy: ctx.actor, // plan SO-5: the user id
            ...(holdRelease?.data ?? {}),
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
        if (holdRelease) {
          await this.trail(
            tx,
            order,
            TxnStatusEvent.DELIVERY_RELEASED,
            ORDER_STATUS.CANCELLED,
            ORDER_STATUS.CANCELLED,
            ctx.actor,
            now,
            holdRelease.remarks,
          );
        }
      }
      return { soStatus: ORDER_STATUS.CANCELLED, cancelledLines: result.cancelledLines };
    }, ORDER_TX_OPTIONS);
  }

  /**
   * One transaction, so the edit, the revision number, the reservations, the
   * History revision and the AMENDED step commit or roll back together (P6).
   * The save inside writes no revision of its own: the amend writes ONE, after
   * its own writes, and its number heads the step's remarks ("Rev 3: …").
   */
  async amend(
    dto: AmendSaleOrderDto,
  ): Promise<SaleOrderPayload & { warnings: ReservationShort[] }> {
    const now = new Date();
    const { baseRevision: _b, editRemark: _e, ...saveDto } = dto;
    void _b;
    void _e;
    const s = saveDto as SaveSaleOrderDto;
    delete (s as unknown as Record<string, unknown>).soStatus;
    return this.prisma.$transaction(async (tx) => {
      // 1 · the gates, under the row lock.
      const order = await this.lock(tx, {
        soId: dto.soId,
        soCompanyId: dto.soCompanyId,
        soBranchId: dto.soBranchId,
        soAccYear: dto.soAccYear,
      });
      // COMPLETED / CANCELLED / CLOSED / EXPIRED: a finished order is not amended.
      assertSaleOrderNotTerminal(order);
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
      // soi_reserved_qty is the reservations' figure, not the payload's
      // (capReservedQty): step 3 writes what the re-reserve really holds.
      capReservedQty(s, lines);
      // The order as /get answered it before the amend: the revision's `before`.
      const before = await this.orders.getById(
        order.soId,
        order.soCompanyId,
        order.soBranchId,
        order.soAccYear,
        tx,
      );

      // 2 · the edit, through the ONE definition of an order save — in this
      // transaction, and without a revision of its own.
      this.orders.prepareSave(s);
      let payload: SaleOrderPayload;
      try {
        payload = await this.orders.updateOrderInTx(
          tx,
          { ...s, soId: order.soId },
          { revision: false },
        );
      } catch (error: unknown) {
        // The save's own unique clash answers as the save route does; one
        // further on (a reservation) is not relabelled as an order number.
        this.orders.throwIfDuplicate(error);
        throw error;
      }

      // 3 · the reservations, the revision number, the History revision and
      // the trail.
      const fresh = await this.lock(tx, {
        soId: order.soId,
        soCompanyId: order.soCompanyId,
        soBranchId: order.soBranchId,
        soAccYear: order.soAccYear,
      });
      const { held, warnings } = await this.rereserveInTx(tx, fresh, ctx.actor, now);
      await tx.saleOrder.update({
        where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
        data: {
          soRevisionNo: order.soRevisionNo + 1,
          soModifiedOn: now,
          soModifiedBy: ctx.actor, // plan SO-5: the user id
        },
      });
      const { revNo } = await this.orders.writeRevision(
        tx,
        order,
        before,
        ctx.actor,
        `Order amended: ${dto.editRemark}`,
      );
      await this.trail(
        tx,
        fresh,
        TxnStatusEvent.AMENDED,
        fresh.soStatus,
        fresh.soStatus,
        ctx.actor,
        now,
        `Rev ${revNo}: ${dto.editRemark}`,
      );
      return { ...withHeld(payload, held), soRevisionNo: order.soRevisionNo + 1, warnings };
    }, ORDER_TX_OPTIONS);
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
        SALES_ERROR_CODES.NOT_FOUND,
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
        SALES_ERROR_CODES.NOT_FOUND,
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

/** What one order line holds after a re-reserve, as written to its row. */
interface HeldFigures {
  soiIsReserved: boolean;
  soiReservedQty: Prisma.Decimal;
}

/**
 * soi_reserved_qty is the reservations' figure, not the payload's: the
 * re-reserve after the save writes what each line really holds. Until then
 * the save carries the stored figure capped at the line's new quantity, so an
 * edit that takes a reserved line DOWN passes ck_soi_reserved (it answered 400
 * SALE_ORDER_RESERVED_OUT_OF_RANGE, 2026-11-11). A new line holds 0; whatever
 * a client sends is overridden.
 */
function capReservedQty(dto: SaveSaleOrderDto, lines: SaleOrderItem[]): void {
  if (!dto.items) {
    return;
  }
  const stored = new Map(lines.map((l) => [l.soiId, l]));
  for (const it of dto.items) {
    const prev = it.soiId ? stored.get(it.soiId) : undefined;
    const qty = new Prisma.Decimal(it.soiOrderQty ?? prev?.soiOrderQty ?? 0);
    const heldQty = new Prisma.Decimal(prev?.soiReservedQty ?? 0);
    it.soiReservedQty = Prisma.Decimal.max(0, Prisma.Decimal.min(heldQty, qty)).toFixed(3);
  }
}

/** The save's answer with each line's reserved figures as the re-reserve wrote them. */
function withHeld<T extends SaleOrderPayload>(payload: T, held: Map<string, HeldFigures>): T {
  if (held.size === 0 || !payload.items) {
    return payload;
  }
  return {
    ...payload,
    items: payload.items.map((i) => {
      const h = held.get(i.soiId);
      return h ? { ...i, ...h } : i;
    }),
  };
}
