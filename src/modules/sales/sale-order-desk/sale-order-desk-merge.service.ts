import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import { SalesContextService } from '../posting/sales-context.service';
import { StockReservationService } from '../posting/stock-reservation.service';
import { loadDayClosed } from '../posting/sales.guards';
import { throwSalesInvalid, throwSalesLocked, throwSalesRight } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { SALES_MENU_ID, isoDate } from '../posting/sales-doc.utils';
import { SaleOrderService } from '../sale-order/sale-order.service';
import { SaleOrderLifecycleService } from '../sale-order/sale-order-lifecycle.service';
import { readOrderAdvanceBalance } from '../sale-order/order-advance-posting.helper';
import type { SaveSaleOrderDto } from '../sale-order/dto/save-sale-order.dto';
import type { SaveSaleOrderItemDto } from '../sale-order/dto/save-sale-order-item.dto';
import type {
  SaleOrderErrorDetail,
  SaleOrderErrorResponse,
} from '../sale-order/types/sale-order-api.types';
import type { MergeDto, MergePreviewDto } from './dto/sale-order-desk.dto';
import { appendDeskStep, clip, dec, money, qty } from './sale-order-desk.helpers';
import {
  SALE_ORDER_DESK_DEFAULT_MERGE_REASON,
  SALE_ORDER_DESK_OPEN_STATUSES,
  SALE_ORDER_DESK_RECEIPT_MENU_ID,
  type MergePreviewResult,
  type MergeRefusal,
  type MergeResult,
  type MergedSource,
} from './types/sale-order-desk.types';
import { ORDER_TX_OPTIONS } from '../sale-order/sale-order-tx.options';

const ZERO = new Prisma.Decimal(0);
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

type SourceLine = SaleOrderItem & { itemUnitConversion: { iucUomWeight: Prisma.Decimal } | null };

/** One order a merge takes from, as read (under the lock, in /merge). */
interface MergeSource {
  order: SaleOrder;
  /** Every live line, open or not (the fingerprint covers them all). */
  lines: SourceLine[];
  /** What the order still holds of an advance: the live ADVANCE row, else the header. */
  advanceHeld: Prisma.Decimal;
  /** Live order-level charge rows (txn_charge_detail, cd_doc_type 'ORDER'). */
  chargeRows: number;
}

/** The new order, worked out from the sources (identically for preview and merge). */
interface BuiltMerge {
  /** Oldest first (so_order_datetime, then so_id): the header and the line order. */
  ordered: MergeSource[];
  oldest: SaleOrder;
  items: SaveSaleOrderItemDto[];
  priority: string;
  deliveryDate: string | null;
  totQty: Prisma.Decimal;
  totKg: Prisma.Decimal;
  sums: Record<
    | 'gross'
    | 'itemDisc'
    | 'splDisc'
    | 'schDisc'
    | 'billSchDisc'
    | 'addlDisc1'
    | 'addlDisc2'
    | 'cashDisc'
    | 'taxable'
    | 'cgst'
    | 'sgst'
    | 'igst'
    | 'cess'
    | 'acess'
    | 'freight'
    | 'load'
    | 'unload'
    | 'net'
    | 'mrpSavings'
    | 'mrpValue',
    Prisma.Decimal
  >;
  roundOff: Prisma.Decimal;
  orderAmt: Prisma.Decimal;
  /** Per source: open lines, qty, kg and value (pro-rata soi_net_amt), for the preview. */
  perSource: Map<
    string,
    {
      openLines: number;
      openQty: Prisma.Decimal;
      openKg: Prisma.Decimal;
      openValue: Prisma.Decimal;
    }
  >;
}

// Line fields carried over as they are: identity, flags, rates and percentages,
// per-unit prices, the tax id and split %s, the scheme, salesman and remarks.
const COPY_LINE_FIELDS = [
  'soiToBaseFactor',
  'soiHsnCode',
  'soiPriceLevel',
  'soiEanCode',
  'soiSize',
  'soiSizeUom',
  'soiGodownId',
  'soiIsTaxIncl',
  'soiIsPromo',
  'soiIsFree',
  'soiFreeType',
  'soiIsService',
  'soiHasFreight',
  'soiRate',
  'soiRatePreTax',
  'soiRateDiff',
  'soiActPrice',
  'soiMaxPrice',
  'soiMinPrice',
  'soiCostPrice',
  'soiCostPreTax',
  'soiIsRateLocked',
  'soiItemDiscPerc',
  'soiSplDiscPerc',
  'soiSchDiscPerc',
  'soiBillSchPerc',
  'soiAddlDisc1Perc',
  'soiAddlDisc2Perc',
  'soiCashDiscPerc',
  'soiTaxId',
  'soiTaxPerc',
  'soiCgstPerc',
  'soiSgstPerc',
  'soiIgstPerc',
  'soiCessPerc',
  'soiCessPerUnit',
  'soiAcessPerc',
  'soiAcessPerUnit',
  'soiSoldPrice',
  'soiSoldPreTax',
  'soiItemProfit',
  'soiProfitPreTax',
  'soiMrpSavingsPerc',
  'soiDeliveryDate',
  'soiSalesmanId',
  'soiSchemeId',
  'soiSchemeName',
  'soiRemarks',
  'soiQtyPriceId',
] as const;
// Quantities other than the order qty, × r (pending / net), 3 dp.
const SCALE_QTY_FIELDS = [
  'soiLengthQty',
  'soiWeightQty',
  'soiItemDiscQty',
  'soiSplDiscQty',
  'soiSchDiscQty',
  'soiBillSchQty',
  'soiFreightQty',
  'soiLoadQty',
  'soiUnloadQty',
] as const;
// Every line amount, × r, 2 dp.
const SCALE_AMT_FIELDS = [
  'soiGrossAmt',
  'soiItemDiscAmt',
  'soiSplDiscAmt',
  'soiSchDiscAmt',
  'soiBillSchAmt',
  'soiAddlDisc1Amt',
  'soiAddlDisc2Amt',
  'soiCashDiscAmt',
  'soiNetGross',
  'soiChrgBeforeTax',
  'soiChrgAfterTax',
  'soiTaxableAmt',
  'soiTaxAmt',
  'soiCgstAmt',
  'soiSgstAmt',
  'soiIgstAmt',
  'soiCessAmt',
  'soiAcessAmt',
  'soiFreightAmt',
  'soiLoadAmt',
  'soiUnloadAmt',
  'soiNetAmt',
  'soiMrpSavings',
] as const;
// Header fields the new order takes from the OLDEST source (D33).
const COPY_HEADER_FIELDS = [
  'soTenantId',
  'soDocType',
  'soOrderType',
  'soPriceLevel',
  'soDeliveryMode',
  'soCustId',
  'soCustName',
  'soCustAddr',
  'soCustPlace',
  'soCustPin',
  'soCustPhone',
  'soCustEmail',
  'soCustGstin',
  'soCustGstType',
  'soCustStcd',
  'soPosStcd',
  'soStateName',
  'soContactPerson',
  'soContactPhone',
  'soShipName',
  'soShipAddr',
  'soShipPlace',
  'soShipPin',
  'soShipPhone',
  'soShipStcd',
  'soShipLandmark',
  'soShipLat',
  'soShipLng',
  'soHasLoad',
  'soHasUnload',
  'soHasFreight',
  'soHasPromo',
  'soHasComm',
  'soHasLoyalty',
  'soAgentId',
  'soAgentCommPerc',
  'soPaymentTerms',
  'soDeliveryTerms',
  'soTermsConditions',
  'soFreightCalcType',
  'soLoadingCalcType',
  'soDiscAlterBase',
  'soRoundOffStep',
  'soCashDiscPerc',
] as const;

/** A row value as the save DTO takes it: Decimal → plain string (never exponent form), Date → YYYY-MM-DD. */
function dtoValue(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return value.toFixed();
  }
  if (value instanceof Date) {
    return isoDate(value);
  }
  return value;
}
/** Sets the key only when the source has a value: a NULL stays the column's default. */
function put(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === null || value === undefined) {
    return;
  }
  target[key] = dtoValue(value);
}
function trimmed(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/**
 * Sales Order Management — Merge, one click on the server (addendum-1 §5.1,
 * D16, D32, D33). merge-preview reads and answers a fingerprint; merge takes
 * it back and, in ONE transaction, makes the new order and closes the old.
 *
 * How it sits with the order's guards (9911f072 / 7cefea18): nothing here
 * saves OVER an order. The new order is born through `createOrderInTx`
 * (always DRAFT, the save never writes a status) and confirmed through the
 * lifecycle's own `postInTx` (Post right, year / day / salesman guards,
 * FEFO reservations, the POSTED step). The sources are never re-saved: their
 * reservations are released and their open lines closed through
 * `cancelOrderOpenLines`, the server path that settles an order's status
 * (→ CANCELLED, or COMPLETED for a part-billed one). So the save's Amend right
 * does not apply; merge is judged on Create, Post and Cancel of menu 11. A
 * source must be CONFIRMED / PARTIAL with a line open (409 SALES_ORDER_CLOSED
 * otherwise), which keeps every terminal order out.
 */
@Injectable()
export class SaleOrderDeskMergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: SaleOrderService,
    private readonly lifecycle: SaleOrderLifecycleService,
    private readonly salesContext: SalesContextService,
    private readonly reservations: StockReservationService,
  ) {}

  // ── merge-preview (reads only) ────────────────────────────────────────────

  async preview(dto: MergePreviewDto): Promise<MergePreviewResult> {
    const rights = await this.salesContext.rights(SALES_MENU_ID.SALES_ORDER);
    if (!rights.view) {
      throwSalesRight(
        'This user may not view orders on the Sales Order menu',
        SALES_ERROR_CODES.RIGHT_VIEW,
      );
    }
    const seesMoney = (await this.salesContext.rights(SALE_ORDER_DESK_RECEIPT_MENU_ID)).view;
    return this.prisma.$transaction(async (tx) => {
      const today = await dbToday(tx);
      const refusals: MergeRefusal[] = rightsRefusals(rights);
      const evaluation = await this.evaluate(tx, dto, today, false);
      refusals.push(...evaluation.refusals);
      const sources = evaluation.sources;
      const built = sources.length > 0 ? buildMerge(sources) : null;
      return {
        ok: refusals.length === 0,
        refusals: refusals.map((r) => ({
          code: r.code,
          message: r.message,
          ...(r.soId ? { soId: r.soId } : {}),
        })),
        fingerprint: fingerprintOf(sources),
        customer: built
          ? { custId: built.oldest.soCustId, custName: built.oldest.soCustName }
          : null,
        orders: built
          ? built.ordered.map((s) => {
              const f = built.perSource.get(s.order.soId)!;
              return {
                soId: s.order.soId,
                soAccYear: s.order.soAccYear,
                soOrderRefno: s.order.soOrderRefno,
                soOrderDate: isoDate(s.order.soOrderDate),
                openLines: f.openLines,
                openQty: qty(f.openQty),
                openKg: qty(f.openKg),
                ...(seesMoney ? { openValue: money(f.openValue) } : {}),
              };
            })
          : [],
        newOrder: built
          ? {
              lines: built.items.length,
              totQty: qty(built.totQty),
              totKg: qty(built.totKg),
              ...(seesMoney
                ? { orderAmt: money(built.orderAmt), roundOff: money(built.roundOff) }
                : {}),
              priority: built.priority,
              deliveryDate: built.deliveryDate,
            }
          : null,
      };
    }, ORDER_TX_OPTIONS);
  }

  // ── merge ─────────────────────────────────────────────────────────────────

  async merge(dto: MergeDto): Promise<{ message: string; data: MergeResult }> {
    const reason = trimmed(dto.reason) || SALE_ORDER_DESK_DEFAULT_MERGE_REASON;
    const now = new Date();
    let out: { message: string; data: MergeResult } | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1 · rights: Create, Post and Cancel on the Sales Order menu.
        const ctx = await this.salesContext.resolve(
          { companyId: dto.soCompanyId, branchId: dto.soBranchId, deviceId: dto.soDeviceId },
          SALES_MENU_ID.SALES_ORDER,
          tx,
        );
        const missing = rightsRefusals(ctx.rights);
        if (missing.length > 0) {
          throwMergeRefusal(missing[0]);
        }
        // 2-3 · the sources under a row lock (by so_id), then the checks.
        const today = await dbToday(tx);
        const { refusals, sources } = await this.evaluate(tx, dto, today, true);
        if (refusals.length > 0) {
          throwMergeRefusal(refusals[0]);
        }
        // 4 · nothing moved since the preview.
        if (fingerprintOf(sources) !== dto.fingerprint) {
          throwSalesLocked(
            'An order changed after the merge was previewed (a bill or an edit took some of it)',
            SALES_ERROR_CODES.ORDER_MERGE_SOURCE_CHANGED,
            'fingerprint',
          );
        }
        // 5 · the new order, a DRAFT with its per-device number, the CREATED
        // step and the audit, through the ONE definition of an order create.
        const built = buildMerge(sources);
        const refnos = built.ordered.map((s) => s.order.soOrderRefno);
        const saveDto = toSaveDto(built, dto, ctx.userId, today, reason);
        this.orders.prepareSave(saveDto);
        const created = await this.orders.createOrderInTx(tx, saveDto);
        const intoReason = clip(`Merged into ${created.soOrderRefno}: ${reason}`, 250);
        // 6 · each source: its reservations go back, a MERGED step, and its
        // open lines close (→ CANCELLED, or COMPLETED when part-billed).
        const mergedSources: MergedSource[] = [];
        for (const s of built.ordered) {
          await this.reservations.release(
            tx,
            { docType: 'SALES_ORDER', docId: s.order.soId },
            intoReason,
            ctx.actor,
            now,
          );
          await appendDeskStep(
            tx,
            s.order,
            {
              event: TxnStatusEvent.MERGED,
              fromStatus: s.order.soStatus,
              toStatus: s.order.soStatus,
              remarks: intoReason,
            },
            ctx.actor,
            now,
          );
          const closed = await this.orders.cancelOrderOpenLines(tx, {
            order: s.order,
            srcAccYear: s.order.soAccYear,
            targetLineId: null,
            cancelReason: intoReason,
            actor: ctx.actor,
            now,
          });
          mergedSources.push({
            soId: s.order.soId,
            soAccYear: s.order.soAccYear,
            soOrderRefno: s.order.soOrderRefno,
            soStatus: closed.soStatus,
            soFulfilStatus: closed.soFulfilStatus,
            cancelledLines: closed.cancelledLines,
          });
        }
        // 7 · confirm the new order: the released stock is free again, so its
        // FEFO reservations can take it. Shortfalls are warnings.
        const keys = {
          soId: created.soId,
          soCompanyId: created.soCompanyId,
          soBranchId: created.soBranchId,
          soAccYear: created.soAccYear,
        };
        const posted = await this.lifecycle.postInTx(tx, keys, now);
        // 8 · the new order's own MERGED step.
        const fresh = await tx.saleOrder.findFirst({
          where: { soId: created.soId, soAccYear: created.soAccYear },
        });
        await appendDeskStep(
          tx,
          fresh!,
          {
            event: TxnStatusEvent.MERGED,
            fromStatus: fresh!.soStatus,
            toStatus: fresh!.soStatus,
            remarks: `Made from ${refnos.join(' + ')}: ${reason}`,
          },
          ctx.actor,
          now,
        );
        const seesMoney = (await this.salesContext.rights(SALE_ORDER_DESK_RECEIPT_MENU_ID, tx))
          .view;
        out = {
          message: `${created.soOrderRefno} made from ${refnos.join(' + ')}`,
          data: {
            soId: created.soId,
            soCompanyId: created.soCompanyId,
            soBranchId: created.soBranchId,
            soAccYear: created.soAccYear,
            soOrderRefno: created.soOrderRefno,
            soStatus: posted.soStatus,
            soTotItems: built.items.length,
            soTotBags: qty(built.totQty),
            soTotWeight: qty(built.totKg),
            ...(seesMoney ? { soOrderAmt: money(built.orderAmt) } : {}),
            warnings: posted.warnings,
            mergedSources,
          },
        };
      }, ORDER_TX_OPTIONS);
    } catch (error: unknown) {
      this.orders.throwIfDuplicate(error);
      throw error;
    }
    return out!;
  }

  // ── the checks ────────────────────────────────────────────────────────────

  /**
   * Every business refusal, in the order merge checks them (addendum-1 §5.1
   * step 3): at least 2 distinct, found in this company and branch, open, not
   * held, one party, same terms, no advance, no order charges, the new order's
   * day open. /merge throws the first; /merge-preview lists them all.
   */
  private async evaluate(
    tx: Prisma.TransactionClient,
    dto: MergePreviewDto,
    today: string,
    lock: boolean,
  ): Promise<{ refusals: MergeRefusal[]; sources: MergeSource[] }> {
    const refusals: MergeRefusal[] = [];
    const refs = distinctRefs(dto.orders);
    if (refs.length < 2) {
      refusals.push({
        code: SALES_ERROR_CODES.ORDER_MERGE_TOO_FEW,
        message: 'Merge needs 2 or more different orders',
        httpStatus: 400,
        field: 'orders',
      });
    }
    const sources = await this.loadSources(tx, dto, refs, lock);
    const byKey = new Map(sources.map((s) => [keyOf(s.order.soId, s.order.soAccYear), s]));
    for (const r of refs) {
      if (!byKey.has(keyOf(r.soId, r.soAccYear))) {
        refusals.push({
          code: SALES_ERROR_CODES.NOT_FOUND,
          message: `Order ${r.soId} (${r.soAccYear}) is not a live order of this company and branch`,
          soId: r.soId,
          httpStatus: 404,
          field: 'orders',
        });
      }
    }
    for (const s of sources) {
      const open = s.lines.some((l) => dec(l.soiPendingQty).greaterThan(0));
      if (!SALE_ORDER_DESK_OPEN_STATUSES.includes(s.order.soStatus) || !open) {
        refusals.push({
          code: SALES_ERROR_CODES.ORDER_CLOSED,
          message: `Order ${s.order.soOrderRefno} is ${s.order.soStatus}${open ? '' : ' with nothing left open'}`,
          soId: s.order.soId,
          httpStatus: 409,
          field: 'orders',
        });
      }
    }
    for (const s of sources) {
      if (s.order.soDeliveryHold) {
        refusals.push({
          code: SALES_ERROR_CODES.ORDER_DELIVERY_HOLD,
          message: `Order ${s.order.soOrderRefno} is on delivery hold${s.order.soDeliveryHoldReason ? `: ${s.order.soDeliveryHoldReason}` : ''}`,
          soId: s.order.soId,
          httpStatus: 409,
          field: 'orders',
        });
      }
    }
    const first = oldestOf(sources);
    if (first) {
      const otherParty = sources.find((s) => s.order.soCustId !== first.order.soCustId);
      if (otherParty) {
        refusals.push({
          code: SALES_ERROR_CODES.ORDER_MERGE_ONE_PARTY,
          message: `Order ${otherParty.order.soOrderRefno} is for ${otherParty.order.soCustName}, not ${first.order.soCustName}`,
          soId: otherParty.order.soId,
          httpStatus: 400,
          field: 'orders',
        });
      }
      const otherTerms = sources.find(
        (s) =>
          s.order.soOrderType !== first.order.soOrderType ||
          s.order.soDocType !== first.order.soDocType ||
          trimmed(s.order.soPosStcd) !== trimmed(first.order.soPosStcd),
      );
      if (otherTerms) {
        refusals.push({
          code: SALES_ERROR_CODES.ORDER_MERGE_TERMS_DIFFER,
          message: `Order ${otherTerms.order.soOrderRefno} (${otherTerms.order.soOrderType}, ${otherTerms.order.soDocType}, place of supply ${trimmed(otherTerms.order.soPosStcd) || '-'}) differs from ${first.order.soOrderRefno} (${first.order.soOrderType}, ${first.order.soDocType}, place of supply ${trimmed(first.order.soPosStcd) || '-'})`,
          soId: otherTerms.order.soId,
          httpStatus: 400,
          field: 'orders',
        });
      }
    }
    for (const s of sources) {
      if (s.advanceHeld.greaterThan(0)) {
        refusals.push({
          code: SALES_ERROR_CODES.ORDER_MERGE_ADVANCE,
          message: `Order ${s.order.soOrderRefno} holds an advance payment`,
          soId: s.order.soId,
          httpStatus: 409,
          field: 'orders',
        });
      }
    }
    for (const s of sources) {
      if (
        s.chargeRows > 0 ||
        !dec(s.order.soOtherAmt1).isZero() ||
        !dec(s.order.soOtherAmt2).isZero()
      ) {
        refusals.push({
          code: SALES_ERROR_CODES.ORDER_MERGE_CHARGES,
          message: `Order ${s.order.soOrderRefno} has charges on the whole order`,
          soId: s.order.soId,
          httpStatus: 409,
          field: 'orders',
        });
      }
    }
    if (await loadDayClosed(tx, dto.soCompanyId, dto.soBranchId, today)) {
      refusals.push({
        code: SALES_ERROR_CODES.DAY_CLOSED,
        message: `The books for ${today} are closed at this branch`,
        httpStatus: 409,
        field: 'soOrderDate',
      });
    }
    return { refusals, sources };
  }

  /** The sources live in this company and branch; locked FOR UPDATE by so_id when `lock`. */
  private async loadSources(
    tx: Prisma.TransactionClient,
    scope: { soCompanyId: string; soBranchId: string },
    refs: { soId: string; soAccYear: string }[],
    lock: boolean,
  ): Promise<MergeSource[]> {
    if (refs.length === 0) {
      return [];
    }
    const ids = refs.map((r) => r.soId);
    const years = refs.map((r) => r.soAccYear);
    if (lock) {
      // Ordered by so_id, so two merges over the same orders cannot deadlock.
      await tx.$queryRaw`
        SELECT so.so_id
          FROM sales.sale_order so
          JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
            ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
         WHERE so.so_company_id = ${scope.soCompanyId}::uuid
           AND so.so_branch_id = ${scope.soBranchId}::uuid
           AND so.so_is_deleted = false
         ORDER BY so.so_id
           FOR UPDATE OF so`;
    }
    const orders = await tx.saleOrder.findMany({
      where: {
        OR: refs.map((r) => ({ soId: r.soId, soAccYear: r.soAccYear })),
        soCompanyId: scope.soCompanyId,
        soBranchId: scope.soBranchId,
        soIsDeleted: false,
      },
    });
    if (orders.length === 0) {
      return [];
    }
    const lines = (await tx.saleOrderItem.findMany({
      where: {
        OR: orders.map((o) => ({ soiOrderId: o.soId, soiAccYear: o.soAccYear })),
        soiIsDeleted: false,
      },
      orderBy: [{ soiLineNo: 'asc' }],
      include: { itemUnitConversion: { select: { iucUomWeight: true } } },
    })) as SourceLine[];
    const charges = await tx.$queryRaw<{ cd_doc_id: string; n: bigint }[]>`
      SELECT cd_doc_id, COUNT(*) AS n
        FROM public.txn_charge_detail
       WHERE cd_doc_type = 'ORDER'
         AND cd_doc_id = ANY(${orders.map((o) => o.soId)}::uuid[])
         AND cd_is_deleted = false
         AND cd_is_active = true
       GROUP BY cd_doc_id`;
    const chargeCount = new Map(charges.map((c) => [c.cd_doc_id, Number(c.n)]));
    const sources: MergeSource[] = [];
    for (const order of orders) {
      const live = await readOrderAdvanceBalance(tx, order);
      const header = dec(order.soAdvanceBalanceAmt);
      const held = live ? Prisma.Decimal.max(live.pendingAmount, header) : header;
      sources.push({
        order,
        lines: lines.filter((l) => l.soiOrderId === order.soId && l.soiAccYear === order.soAccYear),
        advanceHeld: held,
        chargeRows: chargeCount.get(order.soId) ?? 0,
      });
    }
    return sources;
  }
}

// ── pure parts (exported for the spec) ──────────────────────────────────────

function keyOf(soId: string, soAccYear: string): string {
  return `${soId.toLowerCase()}|${soAccYear.trim()}`;
}

export function distinctRefs(
  orders: readonly { soId: string; soAccYear: string }[],
): { soId: string; soAccYear: string }[] {
  const seen = new Map<string, { soId: string; soAccYear: string }>();
  for (const o of orders ?? []) {
    const k = keyOf(o.soId, o.soAccYear);
    if (!seen.has(k)) {
      seen.set(k, { soId: o.soId.toLowerCase(), soAccYear: o.soAccYear.trim() });
    }
  }
  return [...seen.values()];
}

/** The refusals a missing Create / Post / Cancel right on menu 11 gives. */
function rightsRefusals(rights: {
  create: boolean;
  post: boolean;
  cancel: boolean;
}): MergeRefusal[] {
  const out: MergeRefusal[] = [];
  if (!rights.create) {
    out.push({
      code: SALES_ERROR_CODES.RIGHT_CREATE,
      message: 'This user may not create orders on the Sales Order menu',
      httpStatus: 403,
      field: 'userId',
    });
  }
  if (!rights.post) {
    out.push({
      code: SALES_ERROR_CODES.RIGHT_POST,
      message: 'This user may not post orders on the Sales Order menu',
      httpStatus: 403,
      field: 'userId',
    });
  }
  if (!rights.cancel) {
    out.push({
      code: SALES_ERROR_CODES.RIGHT_CANCEL,
      message: 'This user may not cancel orders on the Sales Order menu',
      httpStatus: 403,
      field: 'userId',
    });
  }
  return out;
}

function throwMergeRefusal(r: MergeRefusal): never {
  switch (r.httpStatus) {
    case 400:
      return throwSalesInvalid(r.message, r.code, r.field);
    case 403:
      return throwSalesRight(r.message, r.code, r.field);
    case 404:
      return throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Order not found',
        r.field,
        r.message,
        r.code,
      );
    default:
      return throwSalesLocked(r.message, r.code, r.field);
  }
}

/** Today in the database's time zone (Asia/Kolkata), as 'YYYY-MM-DD'. */
async function dbToday(tx: Prisma.TransactionClient): Promise<string> {
  const [row] = await tx.$queryRaw<
    { d: string }[]
  >`SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS d`;
  return row.d;
}

function oldestOf(sources: readonly MergeSource[]): MergeSource | null {
  return orderedOldestFirst(sources)[0] ?? null;
}

function orderedOldestFirst(sources: readonly MergeSource[]): MergeSource[] {
  return [...sources].sort((a, b) => {
    const t = a.order.soOrderDatetime.getTime() - b.order.soOrderDatetime.getTime();
    if (t !== 0) {
      return t;
    }
    return a.order.soId < b.order.soId ? -1 : a.order.soId > b.order.soId ? 1 : 0;
  });
}

/**
 * SHA-256 over the sources sorted by so_id: [so_id, so_revision_no,
 * so_status, so_delivery_hold, [[soi_id, soi_pending_qty (3 dp), soi_net_amt
 * (2 dp)] sorted by soi_id]] (addendum-1 §5.1).
 */
export function fingerprintOf(sources: readonly MergeSource[]): string {
  const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const parts = [...sources]
    .sort((a, b) => byId(a.order.soId, b.order.soId))
    .map((s) => [
      s.order.soId,
      s.order.soRevisionNo,
      s.order.soStatus,
      s.order.soDeliveryHold,
      [...s.lines]
        .sort((a, b) => byId(a.soiId, b.soiId))
        .map((l) => [
          l.soiId,
          dec(l.soiPendingQty).toDecimalPlaces(3, HALF_UP).toFixed(3),
          dec(l.soiNetAmt).toDecimalPlaces(2, HALF_UP).toFixed(2),
        ]),
    ]);
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/**
 * The new order's lines and totals (addendum-1 §5.1 "How the new order is
 * made"): every open line, oldest source first then line no, at its pending
 * quantity, every line amount × r = pending / soi_net_qty (2 dp), the other
 * quantities × r (3 dp), per-unit fields as they are. Decimal throughout.
 */
export function buildMerge(sources: readonly MergeSource[]): BuiltMerge {
  const ordered = orderedOldestFirst(sources);
  const oldest = ordered[0].order;
  const items: SaveSaleOrderItemDto[] = [];
  const sums = {
    gross: ZERO,
    itemDisc: ZERO,
    splDisc: ZERO,
    schDisc: ZERO,
    billSchDisc: ZERO,
    addlDisc1: ZERO,
    addlDisc2: ZERO,
    cashDisc: ZERO,
    taxable: ZERO,
    cgst: ZERO,
    sgst: ZERO,
    igst: ZERO,
    cess: ZERO,
    acess: ZERO,
    freight: ZERO,
    load: ZERO,
    unload: ZERO,
    net: ZERO,
    // Σ (MRP − net price) × qty, and the MRP value it is a share of (Qt's
    // so_mrp_savings / so_mrp_savings_perc).
    mrpSavings: ZERO,
    mrpValue: ZERO,
  };
  let totQty = ZERO;
  let totKg = ZERO;
  const perSource: BuiltMerge['perSource'] = new Map();
  for (const s of ordered) {
    const f = { openLines: 0, openQty: ZERO, openKg: ZERO, openValue: ZERO };
    for (const l of s.lines) {
      const pending = dec(l.soiPendingQty).toDecimalPlaces(3, HALF_UP);
      const net = dec(l.soiNetQty);
      if (!pending.greaterThan(0) || !net.greaterThan(0)) {
        continue;
      }
      const r = pending.div(net);
      const weight = dec(l.itemUnitConversion?.iucUomWeight);
      const line: Record<string, unknown> = {
        soiLineNo: items.length + 1,
        soiItemId: l.soiItemId,
        soiItemUnitId: l.soiItemUnitId,
      };
      for (const field of COPY_LINE_FIELDS) {
        put(line, field, (l as Record<string, unknown>)[field]);
      }
      for (const field of SCALE_QTY_FIELDS) {
        const v = (l as Record<string, unknown>)[field] as Prisma.Decimal | null;
        if (v !== null && v !== undefined) {
          line[field] = dec(v).times(r).toDecimalPlaces(3, HALF_UP).toFixed(3);
        }
      }
      const scaled: Record<string, Prisma.Decimal> = {};
      for (const field of SCALE_AMT_FIELDS) {
        const v = (l as Record<string, unknown>)[field] as Prisma.Decimal | null;
        if (v !== null && v !== undefined) {
          scaled[field] = dec(v).times(r).toDecimalPlaces(2, HALF_UP);
          line[field] = scaled[field].toFixed(2);
        }
      }
      line.soiOrderQty = pending.toFixed(3);
      line.soiNetQty = pending.toFixed(3);
      line.soiCaseQty = '0';
      line.soiDeliveredQty = '0';
      line.soiCancelledQty = '0';
      line.soiBilledAmt = '0';
      line.soiReservedQty = '0';
      line.soiIsReserved = false;
      line.soiRoundOff = '0';
      // The trace back to the line it came from.
      line.soiSrcDocType = 'SALES_ORDER';
      line.soiSrcDocId = s.order.soId;
      line.soiSrcDocAccYear = s.order.soAccYear;
      line.soiSrcDocRefno = s.order.soOrderRefno;
      line.soiSrcLineNo = l.soiLineNo;
      items.push(line as unknown as SaveSaleOrderItemDto);

      const z = (k: string) => scaled[k] ?? ZERO;
      sums.gross = sums.gross.plus(z('soiGrossAmt'));
      sums.itemDisc = sums.itemDisc.plus(z('soiItemDiscAmt'));
      sums.splDisc = sums.splDisc.plus(z('soiSplDiscAmt'));
      sums.schDisc = sums.schDisc.plus(z('soiSchDiscAmt'));
      sums.billSchDisc = sums.billSchDisc.plus(z('soiBillSchAmt'));
      sums.addlDisc1 = sums.addlDisc1.plus(z('soiAddlDisc1Amt'));
      sums.addlDisc2 = sums.addlDisc2.plus(z('soiAddlDisc2Amt'));
      sums.cashDisc = sums.cashDisc.plus(z('soiCashDiscAmt'));
      sums.taxable = sums.taxable.plus(z('soiTaxableAmt'));
      sums.cgst = sums.cgst.plus(z('soiCgstAmt'));
      sums.sgst = sums.sgst.plus(z('soiSgstAmt'));
      sums.igst = sums.igst.plus(z('soiIgstAmt'));
      sums.cess = sums.cess.plus(z('soiCessAmt'));
      sums.acess = sums.acess.plus(z('soiAcessAmt'));
      sums.freight = sums.freight.plus(z('soiFreightAmt'));
      sums.load = sums.load.plus(z('soiLoadAmt'));
      sums.unload = sums.unload.plus(z('soiUnloadAmt'));
      sums.net = sums.net.plus(z('soiNetAmt'));
      // An order line keeps no MRP, only its savings and its net (sold)
      // price: MRP × qty = savings + sold price × qty. A line sold AT its MRP
      // (savings 0) cannot be told from one with no MRP, and is left out of
      // the MRP value, so the merged % can read a little above the Qt figure.
      const savings = z('soiMrpSavings');
      sums.mrpSavings = sums.mrpSavings.plus(savings);
      if (savings.greaterThan(0)) {
        sums.mrpValue = sums.mrpValue.plus(savings).plus(dec(l.soiSoldPrice).times(pending));
      }
      const kg = pending.times(weight);
      totQty = totQty.plus(pending);
      totKg = totKg.plus(kg);
      f.openLines += 1;
      f.openQty = f.openQty.plus(pending);
      f.openKg = f.openKg.plus(kg);
      // The desk's open value: soi_net_amt pro-rata to the open quantity,
      // rounded once (grid 201 / figures); the line amount above is the same
      // figure rounded per line.
      f.openValue = f.openValue.plus(dec(l.soiNetAmt).times(r));
    }
    f.openValue = f.openValue.toDecimalPlaces(2, HALF_UP);
    perSource.set(s.order.soId, f);
  }
  // so_round_off_step (the oldest's), half up — the Qt entry's rounding.
  const step = dec(oldest.soRoundOffStep);
  const rounded = step.greaterThan(0)
    ? sums.net.div(step).plus(0.5).floor().times(step).toDecimalPlaces(2, HALF_UP)
    : sums.net;
  const priority = ordered.some((s) => s.order.soPriority === 'URGENT')
    ? 'URGENT'
    : oldest.soPriority;
  const deliveryDates = ordered
    .map((s) => isoDate(s.order.soDeliveryDate))
    .filter((d): d is string => !!d)
    .sort();
  return {
    ordered,
    oldest,
    items,
    priority,
    deliveryDate: deliveryDates[0] ?? null,
    totQty: totQty.toDecimalPlaces(3, HALF_UP),
    totKg: totKg.toDecimalPlaces(3, HALF_UP),
    sums,
    roundOff: rounded.minus(sums.net).toDecimalPlaces(2, HALF_UP),
    orderAmt: rounded,
    perSource,
  };
}

/** The create body for the new order: the oldest's header (D33) + fresh fields + Σ the lines. */
export function toSaveDto(
  built: BuiltMerge,
  req: Pick<MergeDto, 'soCompanyId' | 'soBranchId' | 'soAccYear' | 'soDeviceId' | 'soSessionId'>,
  userId: string,
  today: string,
  reason: string,
): SaveSaleOrderDto {
  const h = built.oldest as unknown as Record<string, unknown>;
  const body: Record<string, unknown> = {};
  for (const field of COPY_HEADER_FIELDS) {
    put(body, field, h[field]);
  }
  const s = built.sums;
  // The Qt entry's header tax: GST + cess, and the additional cess too.
  const tax = s.cgst.plus(s.sgst).plus(s.igst).plus(s.cess).plus(s.acess);
  const savingsPerc = s.mrpValue.greaterThan(0)
    ? s.mrpSavings.div(s.mrpValue).times(100).toDecimalPlaces(2, HALF_UP)
    : ZERO;
  Object.assign(body, {
    soCompanyId: req.soCompanyId,
    soBranchId: req.soBranchId,
    soAccYear: req.soAccYear,
    soDeviceId: req.soDeviceId,
    soSessionId: req.soSessionId ?? null,
    soUserId: userId,
    // Prisma rejects null in a String[] column (memory prisma-scalar-list-null).
    soSalesmanId: built.oldest.soSalesmanId ?? [],
    soOrderDate: today,
    soPriority: built.priority,
    soRemarks: clip(
      `Made from ${built.ordered.map((o) => o.order.soOrderRefno).join(' + ')}: ${reason}`,
      500,
    ),
    // No advance and no order-level charges carry over (Q-A / D32).
    soAdvancePolicy: 'NONE',
    soOtherAmt1: '0',
    soOtherAmt2: '0',
    soTotItems: built.items.length,
    soTotBags: built.totQty.toFixed(3),
    soTotWeight: built.totKg.toFixed(3),
    soGrossAmt: s.gross.toFixed(2),
    soItemDisc: s.itemDisc.toFixed(2),
    soSplDisc: s.splDisc.toFixed(2),
    soSchDisc: s.schDisc.toFixed(2),
    soBillSchDisc: s.billSchDisc.toFixed(2),
    soAddlDisc1: s.addlDisc1.toFixed(2),
    soAddlDisc2: s.addlDisc2.toFixed(2),
    soCashDisc: s.cashDisc.toFixed(2),
    soTaxableAmt: s.taxable.toFixed(2),
    soCgstAmt: s.cgst.toFixed(2),
    soSgstAmt: s.sgst.toFixed(2),
    soIgstAmt: s.igst.toFixed(2),
    soCessAmt: s.cess.toFixed(2),
    soTaxAmt: tax.toFixed(2),
    soMrpSavings: s.mrpSavings.toDecimalPlaces(2, HALF_UP).toFixed(2),
    soMrpSavingsPerc: savingsPerc.toFixed(2),
    soFreightAmt: s.freight.toFixed(2),
    soLoadAmt: s.load.toFixed(2),
    soUnloadAmt: s.unload.toFixed(2),
    soRoundOff: built.roundOff.toFixed(2),
    soOrderAmt: built.orderAmt.toFixed(2),
    items: built.items,
  });
  if (built.deliveryDate) {
    body.soDeliveryDate = built.deliveryDate;
  }
  return body as unknown as SaveSaleOrderDto;
}
