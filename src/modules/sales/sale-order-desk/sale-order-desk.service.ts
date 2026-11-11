import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { SalesContextService } from '../posting/sales-context.service';
import { StockReservationService } from '../posting/stock-reservation.service';
import { throwSalesLocked, throwSalesRight } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { SALES_MENU_ID } from '../posting/sales-doc.utils';
import { SaleOrderService } from '../sale-order/sale-order.service';
import type {
  CloseOpenLinesDto,
  DeliveryHoldDto,
  FiguresDto,
  PriorityDto,
  StockCoverDto,
} from './dto/sale-order-desk.dto';
import {
  appendDeskStep,
  assertDeskOrderOpen,
  clip,
  countOpenLines,
  dec,
  lockDeskOrder,
  money,
  qty,
  requireReason,
} from './sale-order-desk.helpers';
import {
  SALE_ORDER_DESK_AUDIT_SCREEN,
  SALE_ORDER_DESK_RECEIPT_MENU_ID,
  type CloseOpenLinesResult,
  type DeliveryHoldResult,
  type FiguresResult,
  type PriorityResult,
  type StockCoverItem,
  type StockCoverResult,
} from './types/sale-order-desk.types';
import { ORDER_TX_OPTIONS } from '../sale-order/sale-order-tx.options';

const ZERO = new Prisma.Decimal(0);

/**
 * Sales Order Management — the order desk's own actions (menu 299 puts the
 * screen on the menu; every action is judged on the Sales Order menu 11, D6).
 * Plan share/sales/plan-sales-order-management-qt-2026-11-10.md §4 with
 * addendum-1 §5. The lists are grids 201-203; the merge is
 * SaleOrderDeskMergeService.
 *
 * None of these is a SAVE of the order: no route here goes through
 * `SaleOrderService.save`, so none is judged on the save's Amend right
 * (7cefea18) and none moves soRevisionNo. Each is its own verb under its own
 * right, with its own trail step:
 *   delivery-hold     Edit 11    DELIVERY_HOLD / DELIVERY_RELEASED
 *   priority          Edit 11    PRIORITY_CHANGED
 *   close-open-lines  Cancel 11  CANCELLED (cancelOrderOpenLines: → COMPLETED / CANCELLED)
 * and each refuses an order that is not CONFIRMED / PARTIAL with a line open
 * (409 SALES_ORDER_CLOSED) — which covers every terminal status.
 */
@Injectable()
export class SaleOrderDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: SaleOrderService,
    private readonly salesContext: SalesContextService,
    private readonly reservations: StockReservationService,
    private readonly audit: AuditLogService,
  ) {}

  // ── delivery hold ─────────────────────────────────────────────────────────

  async deliveryHold(dto: DeliveryHoldDto): Promise<DeliveryHoldResult> {
    const reason = requireReason(dto.reason);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await lockDeskOrder(tx, dto);
      const ctx = await this.salesContext.resolve(
        { companyId: order.soCompanyId, branchId: order.soBranchId },
        SALES_MENU_ID.SALES_ORDER,
        tx,
      );
      if (!ctx.rights.edit) {
        throwSalesRight(
          'This user may not change orders on the Sales Order menu',
          SALES_ERROR_CODES.RIGHT_EDIT,
        );
      }
      assertDeskOrderOpen(order, await countOpenLines(tx, order));
      if (order.soDeliveryHold === dto.soDeliveryHold) {
        // Who got there first, and when (IST, 12-hour), for the message.
        const [last] = await tx.$queryRaw<{ by_name: string | null; on_text: string | null }[]>`
          SELECT COALESCE(u.usr_login_name, so.so_delivery_hold_by) AS by_name,
                 to_char(so.so_delivery_hold_on AT TIME ZONE 'Asia/Kolkata',
                         'DD-MM-YYYY HH12:MI AM') AS on_text
            FROM sales.sale_order so
            LEFT JOIN public.user_master u ON u.usr_id::text = lower(so.so_delivery_hold_by)
           WHERE so.so_id = ${order.soId}::uuid AND so.so_acc_year = ${order.soAccYear}::char(9)`;
        const parts = [
          last?.by_name ? `by ${last.by_name}` : null,
          last?.on_text ? `on ${last.on_text}` : null,
        ].filter(Boolean);
        const why = order.soDeliveryHoldReason ? `: ${order.soDeliveryHoldReason}` : '';
        const who = parts.length > 0 ? ` (${parts.join(' ')}${why})` : '';
        throwSalesLocked(
          order.soDeliveryHold
            ? `Order ${order.soOrderRefno} is already on delivery hold${who}`
            : `Order ${order.soOrderRefno} is not on delivery hold${who}`,
          SALES_ERROR_CODES.ORDER_HOLD_UNCHANGED,
          'soDeliveryHold',
        );
      }
      const updated = await tx.saleOrder.update({
        where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
        data: {
          soDeliveryHold: dto.soDeliveryHold,
          soDeliveryHoldReason: reason,
          // Plan SO-5: the user id, as so_modified_by (the grid names it).
          soDeliveryHoldBy: ctx.actor,
          soDeliveryHoldOn: now,
          soModifiedOn: now,
          soModifiedBy: ctx.actor,
        },
      });
      await appendDeskStep(
        tx,
        order,
        {
          event: dto.soDeliveryHold
            ? TxnStatusEvent.DELIVERY_HOLD
            : TxnStatusEvent.DELIVERY_RELEASED,
          fromStatus: order.soStatus,
          toStatus: order.soStatus,
          remarks: reason,
        },
        ctx.actor,
        now,
      );
      const holdFields = (o: typeof order) => ({
        soDeliveryHold: o.soDeliveryHold,
        soDeliveryHoldReason: o.soDeliveryHoldReason,
        soDeliveryHoldBy: o.soDeliveryHoldBy,
        soDeliveryHoldOn: o.soDeliveryHoldOn?.toISOString() ?? null,
      });
      await this.audit.logEntityChange(
        {
          action: 'update',
          tableName: 'sale_order',
          screenName: SALE_ORDER_DESK_AUDIT_SCREEN,
          screenType: 'transaction',
          pk: order.soId,
          displayName: order.soOrderRefno,
          originalRecord: holdFields(order),
          modifiedRecord: holdFields(updated),
          userId: ctx.actor,
          notes: dto.soDeliveryHold
            ? `Order put on delivery hold: ${reason}`
            : `Order released from delivery hold: ${reason}`,
        },
        tx,
      );
      return {
        soId: updated.soId,
        soAccYear: updated.soAccYear,
        soOrderRefno: updated.soOrderRefno,
        soStatus: updated.soStatus,
        soDeliveryHold: updated.soDeliveryHold,
        soDeliveryHoldReason: updated.soDeliveryHoldReason,
        soDeliveryHoldBy: updated.soDeliveryHoldBy,
        soDeliveryHoldByName: ctx.actorName,
        soDeliveryHoldOn: updated.soDeliveryHoldOn?.toISOString() ?? null,
      };
    }, ORDER_TX_OPTIONS);
  }

  // ── priority (quick delivery) ─────────────────────────────────────────────

  async priority(dto: PriorityDto): Promise<PriorityResult> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await lockDeskOrder(tx, dto);
      const ctx = await this.salesContext.resolve(
        { companyId: order.soCompanyId, branchId: order.soBranchId },
        SALES_MENU_ID.SALES_ORDER,
        tx,
      );
      if (!ctx.rights.edit) {
        throwSalesRight(
          'This user may not change orders on the Sales Order menu',
          SALES_ERROR_CODES.RIGHT_EDIT,
        );
      }
      assertDeskOrderOpen(order, await countOpenLines(tx, order));
      if (order.soPriority === dto.soPriority) {
        throwSalesLocked(
          `Order ${order.soOrderRefno} is already ${dto.soPriority}`,
          SALES_ERROR_CODES.ORDER_PRIORITY_UNCHANGED,
          'soPriority',
        );
      }
      await tx.saleOrder.update({
        where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
        data: { soPriority: dto.soPriority, soModifiedOn: now, soModifiedBy: ctx.actor },
      });
      const remarks =
        dto.soPriority === 'URGENT'
          ? `Quick delivery on: ${order.soPriority} → URGENT`
          : order.soPriority === 'URGENT'
            ? `Quick delivery off: URGENT → ${dto.soPriority}`
            : `Priority: ${order.soPriority} → ${dto.soPriority}`;
      await appendDeskStep(
        tx,
        order,
        {
          event: TxnStatusEvent.PRIORITY_CHANGED,
          fromStatus: order.soStatus,
          toStatus: order.soStatus,
          remarks,
        },
        ctx.actor,
        now,
      );
      await this.audit.logEntityChange(
        {
          action: 'update',
          tableName: 'sale_order',
          screenName: SALE_ORDER_DESK_AUDIT_SCREEN,
          screenType: 'transaction',
          pk: order.soId,
          displayName: order.soOrderRefno,
          originalRecord: { soPriority: order.soPriority },
          modifiedRecord: { soPriority: dto.soPriority },
          userId: ctx.actor,
          notes: remarks,
        },
        tx,
      );
      return {
        soId: order.soId,
        soAccYear: order.soAccYear,
        soOrderRefno: order.soOrderRefno,
        soPriority: dto.soPriority,
      };
    }, ORDER_TX_OPTIONS);
  }

  // ── close the open lines (cancel the rest of an order) ────────────────────

  /**
   * D7: the rest of an order is cancelled here, never through PUT
   * /sale-orders/cancel-lines (no right, no reservation release, no reason).
   * The billed part stays; the order ends COMPLETED (something billed) or
   * CANCELLED (nothing billed), as cancelOrderOpenLines settles it, with its
   * CANCELLED step "Open lines closed: <reason>". A whole-order CANCELLED
   * over a held advance is that method's 400 SALE_ORDER_ADVANCE_HELD, and the
   * reservation release before it rolls back with it.
   */
  async closeOpenLines(dto: CloseOpenLinesDto): Promise<CloseOpenLinesResult> {
    const reason = requireReason(dto.reason);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await lockDeskOrder(tx, dto);
      const ctx = await this.salesContext.resolve(
        { companyId: order.soCompanyId, branchId: order.soBranchId },
        SALES_MENU_ID.SALES_ORDER,
        tx,
      );
      if (!ctx.rights.cancel) {
        throwSalesRight(
          'This user may not cancel on the Sales Order menu',
          SALES_ERROR_CODES.RIGHT_CANCEL,
        );
      }
      assertDeskOrderOpen(order, await countOpenLines(tx, order));
      const closeReason = clip(`Open lines closed: ${reason}`, 250);
      const releasedReservations = await this.reservations.release(
        tx,
        { docType: 'SALES_ORDER', docId: order.soId },
        closeReason,
        ctx.actor,
        now,
      );
      const result = await this.orders.cancelOrderOpenLines(tx, {
        order,
        srcAccYear: order.soAccYear,
        targetLineId: null,
        cancelReason: closeReason,
        actor: ctx.actor,
        now,
      });
      const { soCancelledAmt, soPendingAmt, ...rest } = result;
      const seesMoney = await this.canSeeMoney(tx);
      return {
        ...rest,
        ...(seesMoney ? { soCancelledAmt, soPendingAmt } : {}),
        releasedReservations,
      };
    }, ORDER_TX_OPTIONS);
  }

  // ── in-stock weight of the ticked orders (reads only) ─────────────────────

  /**
   * D9 / §4.4. Per item: what the orders still want in BASE units, against
   * what is free (SALEABLE, this company and branch) plus what these orders
   * already hold reserved — their own reservations count as theirs. Service
   * lines are left out. Decimal throughout; kg = open qty × iuc_uom_weight.
   */
  async stockCover(dto: StockCoverDto): Promise<StockCoverResult> {
    await this.assertRight(SALES_MENU_ID.SALES_ORDER, 'view');
    const ids = dto.orders.map((o) => o.soId);
    const years = dto.orders.map((o) => o.soAccYear);
    const itemId = dto.itemId ?? null;
    const { found, rows } = await this.prisma.$transaction(async (tx) => {
      // A one-shot report over bound arrays and an optional item: a generic
      // plan would scan (memory prisma-generic-plan-slow-reports).
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      const found = await tx.$queryRaw<{ so_id: string }[]>`
        SELECT so.so_id
          FROM sales.sale_order so
          JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
            ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
         WHERE so.so_company_id = ${dto.soCompanyId}::uuid
           AND so.so_branch_id = ${dto.soBranchId}::uuid
           AND so.so_is_deleted = false`;
      const rows = await tx.$queryRaw<
        {
          item_id: string;
          item_name: string | null;
          pending_base: Prisma.Decimal;
          order_kg: Prisma.Decimal;
          free_base: Prisma.Decimal;
          own_base: Prisma.Decimal;
        }[]
      >`
        WITH h AS (
          SELECT so.so_id, so.so_acc_year
            FROM sales.sale_order so
            JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
              ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
           WHERE so.so_company_id = ${dto.soCompanyId}::uuid
             AND so.so_branch_id = ${dto.soBranchId}::uuid
             AND so.so_is_deleted = false
        ),
        l AS (
          SELECT d.soi_item_id,
                 SUM(d.soi_pending_qty
                     * CASE WHEN d.soi_to_base_factor > 0 THEN d.soi_to_base_factor
                            ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END) AS pending_base,
                 SUM(d.soi_pending_qty * COALESCE(u.iuc_uom_weight, 0)) AS order_kg
            FROM sales.sale_order_item d
            JOIN h ON h.so_id = d.soi_order_id AND h.so_acc_year = d.soi_acc_year
            JOIN inventory.item_master im ON im.item_id = d.soi_item_id
            LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = d.soi_item_unit_id
           WHERE d.soi_is_deleted = false
             AND d.soi_pending_qty > 0
             AND d.soi_is_service = false
             AND im.item_is_service = false
             AND (${itemId}::uuid IS NULL OR d.soi_item_id = ${itemId}::uuid)
           GROUP BY d.soi_item_id
        ),
        f AS (
          SELECT b.sbl_item_id, SUM(b.sbl_available_qty) AS free_base
            FROM stock.stock_balance b
           WHERE b.sbl_company_id = ${dto.soCompanyId}::uuid
             AND b.sbl_branch_id = ${dto.soBranchId}::uuid
             AND b.sbl_bucket = 'SALEABLE'
             AND b.sbl_is_deleted = false
             AND b.sbl_item_id IN (SELECT soi_item_id FROM l)
           GROUP BY b.sbl_item_id
        ),
        o AS (
          SELECT r.srv_item_id, SUM(r.srv_open_qty) AS own_base
            FROM stock.stock_reservation r
            JOIN h ON h.so_id = r.srv_src_doc_id
           WHERE r.srv_src_doc_type = 'SALES_ORDER'
             AND r.srv_status IN ('OPEN', 'PARTIAL')
             AND r.srv_is_deleted = false
             AND r.srv_item_id IN (SELECT soi_item_id FROM l)
           GROUP BY r.srv_item_id
        )
        SELECT l.soi_item_id AS item_id, im.item_name_en AS item_name,
               l.pending_base, l.order_kg,
               COALESCE(f.free_base, 0) AS free_base, COALESCE(o.own_base, 0) AS own_base
          FROM l
          JOIN inventory.item_master im ON im.item_id = l.soi_item_id
          LEFT JOIN f ON f.sbl_item_id = l.soi_item_id
          LEFT JOIN o ON o.srv_item_id = l.soi_item_id
         ORDER BY im.item_name_en, l.soi_item_id`;
      return { found, rows };
    }, ORDER_TX_OPTIONS);
    const foundIds = new Set(found.map((f) => f.so_id));
    let orderKg = ZERO;
    let coverKg = ZERO;
    const items: StockCoverItem[] = rows.map((r) => {
      const pending = dec(r.pending_base);
      const free = dec(r.free_base).plus(dec(r.own_base));
      const freeNonNeg = free.isNegative() ? ZERO : free;
      const cover = Prisma.Decimal.min(pending, freeNonNeg);
      const kg = dec(r.order_kg);
      const itemCoverKg = pending.greaterThan(0) ? kg.times(cover).div(pending) : ZERO;
      orderKg = orderKg.plus(kg);
      coverKg = coverKg.plus(itemCoverKg);
      return {
        itemId: r.item_id,
        itemName: r.item_name,
        pendingBaseQty: qty(pending),
        freeBaseQty: qty(free),
        coverBaseQty: qty(cover),
        orderKg: qty(kg),
        coverKg: qty(itemCoverKg),
      };
    });
    const orderKgR = orderKg.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
    const coverKgR = coverKg.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
    return {
      orderKg: orderKgR.toNumber(),
      coverKg: coverKgR.toNumber(),
      shortKg: orderKgR.minus(coverKgR).toNumber(),
      coverPerc: orderKgR.greaterThan(0)
        ? coverKgR
            .times(100)
            .div(orderKgR)
            .toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP)
            .toNumber()
        : 0,
      items,
      missing: [...new Set(ids.filter((id) => !foundIds.has(id)))],
    };
  }

  // ── the amounts (menu 99 View) ────────────────────────────────────────────

  /**
   * D24 / addendum-1 §5.2. Grids 201-203 carry no money (the grid runner
   * checks no right); this route is the only place the desk's amounts come
   * from, behind Sales Order View AND Receipt View.
   */
  async figures(dto: FiguresDto): Promise<FiguresResult> {
    await this.assertRight(SALES_MENU_ID.SALES_ORDER, 'view');
    if (!(await this.canSeeMoney(this.prisma))) {
      throwSalesRight(
        'Amounts and dues on the order desk need the Receipt (menu 99) View right',
        SALES_ERROR_CODES.ORDER_MONEY_RIGHT,
      );
    }
    const ids = dto.orders.map((o) => o.soId);
    const years = dto.orders.map((o) => o.soAccYear);
    const itemId = dto.itemId ?? null;
    const custIds = dto.custIds ?? [];
    const { orders, customers } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      const orders = await tx.$queryRaw<
        {
          so_id: string;
          so_acc_year: string;
          so_cust_id: string;
          so_order_amt: Prisma.Decimal;
          open_value: Prisma.Decimal;
          order_open_value: Prisma.Decimal;
        }[]
      >`
        SELECT so.so_id, so.so_acc_year, so.so_cust_id, so.so_order_amt,
               round(COALESCE(SUM(CASE WHEN d.soi_net_qty > 0 THEN d.soi_net_amt * d.soi_pending_qty / d.soi_net_qty ELSE 0 END)
                     FILTER (WHERE d.soi_pending_qty > 0
                               AND (${itemId}::uuid IS NULL OR d.soi_item_id = ${itemId}::uuid)), 0), 2) AS open_value,
               round(COALESCE(SUM(CASE WHEN d.soi_net_qty > 0 THEN d.soi_net_amt * d.soi_pending_qty / d.soi_net_qty ELSE 0 END)
                     FILTER (WHERE d.soi_pending_qty > 0), 0), 2) AS order_open_value
          FROM sales.sale_order so
          JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
            ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
          LEFT JOIN sales.sale_order_item d
                 ON d.soi_order_id = so.so_id AND d.soi_acc_year = so.so_acc_year AND d.soi_is_deleted = false
         WHERE so.so_company_id = ${dto.soCompanyId}::uuid
           AND so.so_branch_id = ${dto.soBranchId}::uuid
           AND so.so_is_deleted = false
         GROUP BY so.so_id, so.so_acc_year, so.so_cust_id, so.so_order_amt`;
      const partyIds = [...new Set([...orders.map((o) => o.so_cust_id), ...custIds])];
      // Grid 201's dues: DR, live, money left on it (part-paid bills count,
      // Q7), this company.
      const customers = await tx.$queryRaw<
        {
          cus_id: string;
          cus_credit_amt_limit: Prisma.Decimal | null;
          pending: Prisma.Decimal | null;
          open_bills: bigint | null;
          overdue: Prisma.Decimal | null;
          overdue_bills: bigint | null;
        }[]
      >`
        SELECT c.cus_id, c.cus_credit_amt_limit,
               du.pending, du.open_bills, du.overdue, du.overdue_bills
          FROM sales.customers c
          LEFT JOIN LATERAL (
            SELECT SUM(b.abl_pending_amount) AS pending,
                   COUNT(*) AS open_bills,
                   COALESCE(SUM(b.abl_pending_amount) FILTER (WHERE b.abl_due_date <= CURRENT_DATE), 0) AS overdue,
                   COUNT(*) FILTER (WHERE b.abl_due_date <= CURRENT_DATE) AS overdue_bills
              FROM accounts.acc_bill_balance b
             WHERE b.abl_company_id = ${dto.soCompanyId}::uuid
               AND b.abl_party_id = c.cus_id
               AND b.abl_dr_cr = 'DR'
               AND b.abl_is_deleted = false
               AND b.abl_is_active = true
               AND b.abl_pending_amount > 0
          ) du ON true
         WHERE c.cus_id = ANY(${partyIds}::uuid[])
         ORDER BY c.cus_name, c.cus_id`;
      return { orders, customers };
    }, ORDER_TX_OPTIONS);
    let listValue = ZERO;
    for (const o of orders) {
      listValue = listValue.plus(dec(o.open_value));
    }
    return {
      orders: orders.map((o) => ({
        soId: o.so_id,
        soAccYear: o.so_acc_year,
        openValue: money(o.open_value),
        orderOpenValue: money(o.order_open_value),
        orderAmt: money(o.so_order_amt),
      })),
      customers: customers.map((c) => {
        const pending = dec(c.pending);
        const limit = dec(c.cus_credit_amt_limit);
        return {
          custId: c.cus_id,
          pending: money(pending),
          openBills: Number(c.open_bills ?? 0),
          overdue: money(c.overdue),
          overdueBills: Number(c.overdue_bills ?? 0),
          creditAmtLimit: money(limit),
          availCredit: limit.greaterThan(0) ? money(limit.minus(pending)) : null,
        };
      }),
      listValue: money(listValue),
    };
  }

  // ── rights ────────────────────────────────────────────────────────────────

  /** Receipt (menu 99) View: the desk's amounts and dues follow it (D23). */
  async canSeeMoney(client: Prisma.TransactionClient): Promise<boolean> {
    return (await this.salesContext.rights(SALE_ORDER_DESK_RECEIPT_MENU_ID, client)).view;
  }

  private async assertRight(menuId: number, right: 'view'): Promise<void> {
    const rights = await this.salesContext.rights(menuId);
    if (!rights[right]) {
      throwSalesRight(
        'This user may not view orders on the Sales Order menu',
        SALES_ERROR_CODES.RIGHT_VIEW,
      );
    }
  }
}
