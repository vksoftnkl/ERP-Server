import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import {
  resolveActor,
  throwStockConflict,
  throwStockNotFound,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import { assertMenuRight, loadRights } from '../../../common/posting/rights';
import { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import { PRICE_MENU_ID, PRICE_ORIGIN, type PriceWriteOrigin } from '../../Inventory/item-price-log/types/price-change-log.types';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  PriceBucketGateway,
  priceKeyLockId,
  type BucketPriceCandidate,
  type FoundPriceRow,
  type PriceKeyProbe,
  type RowCost,
} from './price-bucket.gateway';
import { resolveTargetScope, type ScopeResolution } from './selling-price-scope.helper';
import {
  SellingPriceBulkService,
  type AppliedBucketPrice,
  type PreparedBulkSave,
} from './selling-price-bulk.service';
import type { SaveSellingPriceBulkDto, SaveSellingPriceRowDto } from './dto/save-selling-price-bulk.dto';
import {
  PurchasePriceStepGateway,
  type LaterLine,
  type NewerChange,
  type StepBill,
  type StepBillLine,
} from './purchase-price-step.gateway';
import {
  billCost,
  chainCost,
  chainKey,
  displayDate,
  dp6,
  keyPerBase,
  money,
  proposeLevels,
  proposeNewLine,
  purchasePriceModeOf,
  purchaseTargetScope,
  qtyText,
  ratioText,
  sameKey,
  strongestResult,
  weightedLandedWot,
  withTax,
  type CurrentLevel,
  type ProposedLevel,
  type PurchaseTargetScope,
} from './purchase-price-step.rules';
import {
  PURCHASE_PRICE_RESULTS,
  isHqUserType,
  type AfterPurchaseState,
  type FromBill,
  type FromBillChange,
  type FromBillKind,
  type PriceLevel,
  type PurchaseOldPriceEntry,
  type PurchasePriceMode,
  type PurchasePriceResult,
  type PurchaseViewResult,
  type PurchaseViewRow,
  type SellingPriceLineRow,
  type SellingPriceProblem,
  type SellingPriceSaveResult,
  type StockErrorDetail,
} from './types/selling-price-bulk.types';

type Dec = Prisma.Decimal;
type Tx = Prisma.TransactionClient;
const D = (v: Prisma.Decimal.Value | null | undefined): Dec => new Prisma.Decimal(v ?? 0);
const ZERO = D(0);
const n2 = (v: Dec) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
const n6 = (v: Dec) => v.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP).toNumber();
const LEVELS: PriceLevel[] = [1, 2, 3, 4];

/** A note the purchase post / cancel answers in `warnings[]` (the house PurIssue shape, plus words). */
export interface PurchasePriceNote {
  code: string;
  field: string;
  message: string;
  /** The bill line it is about (Qt reads it before `field`). */
  lineNo: number | null;
  /** The wording's placeholders (fixed.error_message). */
  params?: Record<string, string | number>;
  /** The wording variant (rule=ABOVE_MRP). */
  rule?: string;
}

/** What the post's price step did to each bill line. */
export interface AfterPurchaseOutcome {
  lines: Map<string, { result: PurchasePriceResult; oldPrices: PurchaseOldPriceEntry[] }>;
  notes: PurchasePriceNote[];
}

/** One item / unit / key the bill bought (decision 13: its lines and allocation rows made one). */
interface BoughtGroup {
  id: string;
  itemId: string;
  itemName: string;
  uomId: string;
  unitName: string | null;
  factor: Dec;
  mrp: Dec | null;
  salePrice: Dec | null;
  lines: StepBillLine[];
  qty: Dec;
  freeQty: Dec;
  rate: Dec;
  sells: (Dec | null)[];
  minPrice: Dec | null;
  billMrp: Dec | null;
  gstPerc: Dec;
  trackMrp: boolean;
  trackSalePrice: boolean;
  /** Per base unit w/o GST (weighted). 0 = free goods only. */
  landedWot: Dec;
  cost: Dec;
  costWot: Dec;
}

/** One price line the bill moves (or would): the bought key's line, a chain unit's, a missing one. */
interface Target {
  kind: Exclude<FromBillKind, 'LATER_BILL'>;
  group: BoughtGroup;
  row: SellingPriceLineRow;
  /** The headline of the unit, when one prices it (Q9's "start from", NO_LINE's words). */
  startFrom: SellingPriceLineRow | null;
  unitFactor: Dec;
  mrp: Dec | null;
  salePrice: Dec | null;
  cost: Dec;
  costWot: Dec;
  target: 'OWN' | 'ALL' | 'NONE';
  scope: PurchaseTargetScope;
  chainFrom: FromBill['chainFrom'];
  later: (LaterLine & { cost: Dec }) | null;
}

/**
 * Change Selling Price P2 — cost after a purchase (plan 2026-11-24, addendum 1 2026-11-26).
 *
 * ONE place decides what a posted purchase invoice does to the price lines of what it bought:
 *   - `afterPurchase` — the post's step, in THE BILL'S transaction, by the bill's mode (B1);
 *   - `purchaseLines` — the same proposal for menu 30's purchase view (B4, O12);
 *   - `saveFromPurchase` — the view's save: P1's save + B5 re-check + PRICES_REVIEWED;
 *   - `undo` — Cancel's put-back (Q7);
 *   - `afterPurchaseState` — the bill's `afterPurchase` block (get / post answers).
 * The rules are purchase-price-step.rules.ts (pure, Decimal); the reads purchase-price-step
 * .gateway.ts; every price write goes through SellingPriceBulkService.applyBucketPrice →
 * PriceMasterWriter (logged) with an audit row each.
 */
@Injectable()
export class PurchasePriceStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly auditLogService: AuditLogService,
    private readonly bulk: SellingPriceBulkService,
    private readonly priceGateway: PriceBucketGateway,
    private readonly gateway: PurchasePriceStepGateway,
    private readonly writer: PriceMasterWriter,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  The plan: which lines a bill moves, and to what (§4.2 – §4.5)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * The bill's targets in the view's order (decision 24): items in the order of their first bill
   * line; inside an item each bought key in bill order, each followed by its chain units in the
   * card's unit order. B5 is NOT applied here (the automatic modes lock first, decision 20).
   */
  private async resolveTargets(
    client: Tx,
    bill: StepBill,
    lines: readonly StepBillLine[],
    opts: { isHq: boolean; withSpread: boolean },
  ): Promise<{ targets: Target[]; groups: BoughtGroup[]; rows: SellingPriceLineRow[] }> {
    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const rows = await this.bulk.linesOfItems(client, {
      companyId: bill.companyId,
      branchId: bill.branchId,
      itemIds,
      withSpread: opts.withSpread,
    });
    const rowsOf = new Map<string, SellingPriceLineRow[]>();
    for (const row of rows) {
      rowsOf.set(row.itemId, [...(rowsOf.get(row.itemId) ?? []), row]);
    }

    // ── the bought groups (decision 13) ────────────────────────────────────
    const groups: BoughtGroup[] = [];
    const groupAt = new Map<string, BoughtGroup>();
    const portions = new Map<string, Array<{ landedCostWot: Dec; baseQty: Dec }>>();
    for (const line of lines) {
      const itemRows = rowsOf.get(line.itemId) ?? [];
      const trackMrp = itemRows[0]?.trackMrp ?? false;
      const trackSalePrice = itemRows[0]?.trackSalePrice ?? false;
      const gstPerc = D(itemRows[0]?.taxPerc ?? 0);
      for (const portion of line.portions) {
        const mrp = trackMrp && portion.mrp !== null && portion.mrp.greaterThan(0) ? portion.mrp : null;
        const salePrice =
          trackSalePrice && portion.salePrice !== null && portion.salePrice.greaterThan(0) ? portion.salePrice : null;
        const id = [line.itemId, line.uomId, mrp?.toFixed(6) ?? '', salePrice?.toFixed(6) ?? ''].join('|');
        let group = groupAt.get(id);
        if (!group) {
          group = {
            id,
            itemId: line.itemId,
            itemName: line.itemName,
            uomId: line.uomId,
            unitName: line.unitName,
            factor: line.factor,
            mrp,
            salePrice,
            lines: [],
            qty: ZERO,
            freeQty: ZERO,
            rate: line.rate,
            sells: [null, null, null, null],
            minPrice: null,
            billMrp: null,
            gstPerc,
            trackMrp,
            trackSalePrice,
            landedWot: ZERO,
            cost: ZERO,
            costWot: ZERO,
          };
          groupAt.set(id, group);
          groups.push(group);
        }
        if (!group.lines.includes(line)) {
          group.lines.push(line);
          group.qty = group.qty.plus(line.billedQty);
          group.freeQty = group.freeQty.plus(line.freeQty);
          // Decision 13 — the typed prices / MSP / MRP of the LAST line that has any.
          if (line.sells.some((sell) => sell !== null && sell.greaterThan(0))) {
            group.sells = [...line.sells];
          }
          if (line.minPrice !== null) {
            group.minPrice = line.minPrice;
          }
          if (line.mrp !== null && line.mrp.greaterThan(0)) {
            group.billMrp = line.mrp;
          }
        }
        portions.set(id, [...(portions.get(id) ?? []), { landedCostWot: line.landedCostWot, baseQty: portion.baseQty }]);
      }
    }
    for (const group of groups) {
      group.landedWot = weightedLandedWot(portions.get(group.id) ?? []);
      const pair = billCost(group.landedWot, group.factor, group.gstPerc);
      group.cost = pair.cost;
      group.costWot = pair.costWot;
    }

    // ── the targets, item by item (decision 24) ────────────────────────────
    const isLine = (row: SellingPriceLineRow | undefined): row is SellingPriceLineRow =>
      !!row && row.lineKind !== 'NO_PRICE' && row.bucketId !== null;
    const scopeOf = (row: SellingPriceLineRow | null): Target['target'] =>
      row === null ? 'NONE' : row.priceScope === 'BRANCH' ? 'OWN' : 'ALL';
    const targets: Target[] = [];
    const taken = new Set<string>();
    const idOf = (itemId: string, uomId: string, mrp: Dec | null, sp: Dec | null) =>
      [itemId, uomId, mrp?.toFixed(4) ?? '', sp?.toFixed(4) ?? ''].join('|');
    for (const group of groups) {
      taken.add(idOf(group.itemId, group.uomId, group.mrp, group.salePrice));
    }
    const itemOrder = [...new Set(groups.map((group) => group.itemId))];
    for (const itemId of itemOrder) {
      const itemRows = rowsOf.get(itemId) ?? [];
      const headlineOf = (uomId: string) =>
        itemRows.find((row) => row.uomId === uomId && row.mrp === null && row.salePrice === null && isLine(row)) ?? null;
      for (const group of groups.filter((g) => g.itemId === itemId)) {
        const found = itemRows.find(
          (row) =>
            row.uomId === group.uomId &&
            sameKey(row.mrp === null ? null : D(row.mrp), group.mrp) &&
            sameKey(row.salePrice === null ? null : D(row.salePrice), group.salePrice),
        );
        const startFrom = headlineOf(group.uomId);
        let bought: SellingPriceLineRow | null = isLine(found) ? found : null;
        let kind: Target['kind'] = 'BOUGHT';
        if (!bought) {
          kind = 'NO_PRICE';
          // A key with no line: P1's own NO_PRICE row when it lists one (stock at the branch),
          // else the unit's headline as P1 shows a NO_PRICE line (what the stock sells at today).
          const base = found ?? startFrom ?? itemRows.find((row) => row.uomId === group.uomId) ?? null;
          if (!base) {
            continue; // an inactive / deleted unit: nothing on menu 30 to price
          }
          bought = {
            ...base,
            lineKind: 'NO_PRICE',
            mrp: group.mrp === null ? null : group.mrp.toNumber(),
            salePrice: group.salePrice === null ? null : group.salePrice.toNumber(),
            lineCost: null,
            lineCostWot: null,
            branchId: null,
            branchName: null,
            levels: base.levels.map((level) => ({ ...level, storedMarkupPerc: null })),
          };
        }
        const target = kind === 'NO_PRICE' ? 'NONE' : scopeOf(bought);
        targets.push({
          kind,
          group,
          row: bought,
          startFrom,
          unitFactor: group.factor,
          mrp: group.mrp,
          salePrice: group.salePrice,
          cost: group.cost,
          costWot: group.costWot,
          target,
          scope: purchaseTargetScope(opts.isHq, target),
          chainFrom: null,
          later: null,
        });
        // O12 / decision 19 — the item's other units with a line in force for the matching key.
        const otherUnits = [...new Map(itemRows.filter((row) => row.uomId !== group.uomId).map((row) => [row.uomId, row])).values()]
          .sort((a, b) => a.unitSlNo - b.unitSlNo);
        for (const unit of otherUnits) {
          const fu = D(unit.unitFactor > 0 ? unit.unitFactor : 1);
          const mrp = group.mrp === null ? null : chainKey(group.mrp, group.factor, fu);
          const sp = group.salePrice === null ? null : chainKey(group.salePrice, group.factor, fu);
          const id = idOf(itemId, unit.uomId, mrp, sp);
          if (taken.has(id)) {
            continue; // bought on this bill itself, or already following another bought unit
          }
          const line = itemRows.find(
            (row) =>
              row.uomId === unit.uomId &&
              isLine(row) &&
              sameKey(row.mrp === null ? null : D(row.mrp), mrp) &&
              sameKey(row.salePrice === null ? null : D(row.salePrice), sp),
          );
          if (!line) {
            continue;
          }
          taken.add(id);
          const pair = chainCost({ cost: group.cost, costWot: group.costWot }, group.factor, fu);
          const smaller = fu.lessThan(group.factor);
          const chainTarget = scopeOf(line);
          targets.push({
            kind: 'CHAIN',
            group,
            row: line,
            startFrom: headlineOf(unit.uomId),
            unitFactor: fu,
            mrp,
            salePrice: sp,
            cost: pair.cost,
            costWot: pair.costWot,
            target: chainTarget,
            scope: purchaseTargetScope(opts.isHq, chainTarget),
            chainFrom: {
              uomId: group.uomId,
              unitName: group.unitName,
              factor: (smaller ? group.factor.dividedBy(fu) : fu.dividedBy(group.factor)).toDecimalPlaces(6).toNumber(),
              way: smaller ? 'SMALLER' : 'BIGGER',
            },
            later: null,
          });
        }
      }
    }
    return { targets, groups, rows };
  }

  /**
   * B5 (§4.5, C4, Q4, Q5) — each target's latest LATER posted bill of the same item and key
   * (per base unit, any unit), at the company (an All branches line) or the branch (an own line
   * and "→ this branch"). Its cost is that bill's landing cost of one of the target's unit.
   */
  private async applyLater(client: Tx, bill: StepBill, targets: Target[]): Promise<void> {
    const later = await this.gateway.laterLines(client, {
      companyId: bill.companyId,
      piId: bill.piId,
      docDate: bill.docDate,
      docDatetime: bill.docDatetime,
      itemIds: [...new Set(targets.map((t) => t.group.itemId))],
    });
    for (const target of targets) {
      const match = laterMatch(later, {
        itemId: target.group.itemId,
        trackMrp: target.group.trackMrp,
        trackSalePrice: target.group.trackSalePrice,
        mrp: target.mrp,
        salePrice: target.salePrice,
        factor: target.unitFactor,
        branchId: target.scope.laterScope === 'BRANCH' ? bill.branchId : null,
      });
      target.later = match
        ? {
            ...match,
            cost: withTax(match.landedCostWot.times(target.unitFactor), target.group.gstPerc).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          }
        : null;
    }
  }

  /** The current levels of a line as the card reads them (price + its own stored %). */
  private currentLevels(row: SellingPriceLineRow): CurrentLevel[] {
    return LEVELS.map((level) => {
      const found = row.levels.find((entry) => entry.level === level);
      return {
        level,
        price: D(found?.price ?? 0),
        storedMarkup:
          found && found.storedMarkupPerc !== null && found.storedMarkupPerc !== undefined
            ? D(found.storedMarkupPerc)
            : null,
      };
    });
  }

  /**
   * §4.4 — the proposal of one target (the view's pre-fill, UPDATE_PRICES' write): BOUGHT takes
   * the bill's typed levels, MSP and (plain item) MRP; CHAIN re-prices only; NO_PRICE keeps what
   * the stock sells at today except the typed levels (P1's No price yet, until typed).
   */
  private propose(
    target: Target,
    defaultLevel: number,
  ): { levels: ProposedLevel[]; minPrice: Dec | null; maxPrice: Dec | null } {
    const row = target.row;
    const current = this.currentLevels(row);
    if (target.kind === 'NO_PRICE') {
      return {
        levels: current.map((level) => {
          const typed = target.group.sells[level.level - 1];
          return typed !== null && typed.greaterThan(0)
            ? { level: level.level, price: typed, from: 'BILL', keptPercent: null, why: null }
            : { level: level.level, price: level.price, from: 'KEPT', keptPercent: null, why: 'no price line yet' };
        }),
        minPrice: target.group.minPrice,
        maxPrice: null,
      };
    }
    const bought = target.kind === 'BOUGHT';
    const levels = proposeLevels({
      levels: current,
      profitType: row.profitType,
      roundOff: D(row.roundOff ?? 0),
      gstPerc: target.group.gstPerc,
      oldCost: row.lineCost === null ? null : D(row.lineCost),
      newCost: target.cost,
      newCostWot: target.costWot,
      billPrices: bought ? target.group.sells : undefined,
      lockedLevel: row.lineKind === 'SOLD_AT' ? defaultLevel : null,
    });
    // P9 — the bill's MSP rides with the bought unit's prices when it changes the stored one.
    const minPrice =
      bought && target.group.minPrice !== null && !target.group.minPrice.equals(D(row.minPrice ?? 0))
        ? target.group.minPrice
        : null;
    // Q11 — a plain item's bought-unit line takes the bill's printed MRP.
    const maxPrice =
      bought &&
      row.mrp === null &&
      !row.trackMrp &&
      target.group.billMrp !== null &&
      !target.group.billMrp.equals(D(row.maxPrice ?? 0))
        ? target.group.billMrp
        : null;
    return { levels, minPrice, maxPrice };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET /stock/price-bulk/purchase-lines (§7.2)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Menu 30's purchase view: the bill's lines and their chain units (O12), each a P1 line with
   * its `fromBill`. Rights in order: Edit on menu 30, View on menu 24, the branch (store users
   * their own). 404 STOCK_PRICE_BILL_NOT_FOUND, 422 STOCK_PRICE_BILL_NOT_POSTED.
   */
  async purchaseLines(q: { companyId: string; branchId: string; accYear: string; piId: string }): Promise<PurchaseViewResult> {
    await this.bulk.assertCanEditPrices();
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: PRICE_MENU_ID.PURCHASE_ENTRY,
      right: 'view',
      codePrefix: 'PUR',
      action: 'open a purchase invoice',
    });
    await this.bulk.assertBranchAllowed(q.branchId);
    const db = this.prisma as unknown as Tx;
    const bill = await this.postedBill(db, q);
    const lines = await this.gateway.readLines(db, bill.piId, bill.accYear);
    const isHq = isHqUserType(this.requestContext.getUserType());
    const { targets } = await this.resolveTargets(db, bill, lines, { isHq, withSpread: true });
    await this.applyLater(db, bill, targets);
    const settings = await this.gateway.stepSettings(db, bill.companyId, bill.branchId);
    const levelNames = new Map((await this.priceGateway.priceLevels(db)).map((l) => [l.level, l.name]));
    const [posted, reviewed] = await Promise.all([
      this.gateway.lastStep(db, bill.piId, bill.accYear, 'POSTED'),
      this.gateway.lastStep(db, bill.piId, bill.accYear, TxnStatusEvent.PRICES_REVIEWED),
    ]);
    // S3 — the view does not apply D16 (decision 15); it says when a line was changed after the bill.
    const changes = await this.changesSince(db, bill, targets, posted);
    const items: PurchaseViewRow[] = targets.map((target, index) => ({
      ...target.row,
      lineNo: index + 1,
      fromBill: this.fromBillOf(target, settings.defaultLevel, levelNames, changes[index]),
    }));
    const count = (kind: FromBillKind) => items.filter((row) => row.fromBill.kind === kind).length;
    return {
      bill: {
        piId: bill.piId,
        accYear: bill.accYear,
        refno: bill.refno,
        docDate: bill.docDate,
        supplierInvNo: bill.supplierInvNo,
        supplierName: bill.supplierName,
        branchId: bill.branchId,
        branchName: bill.branchName,
        postedOn: posted?.on ?? null,
        postedBy: posted?.by ?? null,
        afterPurchase: purchasePriceModeOf(bill.policy),
        reviewedOn: reviewed?.on ?? null,
        reviewedBy: reviewed?.by ?? null,
      },
      items,
      meta: {
        items: new Set(items.map((row) => row.itemId)).size,
        lines: items.length,
        bought: count('BOUGHT'),
        chain: count('CHAIN'),
        laterBill: count('LATER_BILL'),
        noPrice: count('NO_PRICE'),
        toChange: items.filter((row) => row.fromBill.kind !== 'LATER_BILL' && !row.fromBill.sameAsNow).length,
        latestLines: items.filter((row) => row.fromBill.kind !== 'LATER_BILL').length,
      },
    };
  }

  /**
   * Review S3 — per target, the latest logged change of its line after the bill's business time
   * (D16's own rule: item, unit, key, branch null or the bill's; a company-less change only against
   * a company-less line), leaving out what this bill itself wrote. Null on a NO_PRICE row.
   */
  private async changesSince(
    client: Tx,
    bill: StepBill,
    targets: readonly Target[],
    posted: { on: string; at?: Date } | null,
  ): Promise<Array<FromBillChange | null>> {
    const lined = targets.filter((target) => target.kind !== 'NO_PRICE' && target.row.bucketId);
    if (!lined.length) {
      return targets.map(() => null);
    }
    const [newer, companies] = await Promise.all([
      this.gateway.newerChanges(client, {
        companyId: bill.companyId,
        branchId: bill.branchId,
        itemIds: [...new Set(lined.map((target) => target.group.itemId))],
        after: businessTimeOf(bill.docDate, posted),
        exceptBill: bill.refno,
      }),
      this.gateway.rowCompanies(client, lined.map((target) => target.row.bucketId!)),
    ]);
    return targets.map((target) => {
      if (target.kind === 'NO_PRICE' || !target.row.bucketId) {
        return null;
      }
      const changed = changeOf(newer, target, companies.get(target.row.bucketId) === null);
      return changed ? { at: istIso(changed.at), who: changed.who ?? null, source: changed.source } : null;
    });
  }

  /** The bill, POSTED, at this company and branch — else 404 / 422 (§7.2). `lock` — review N2. */
  private async postedBill(
    client: Tx,
    q: { companyId: string; branchId: string; accYear: string; piId: string },
    opts: { lock?: 'SHARE' } = {},
  ): Promise<StepBill> {
    const bill = await this.gateway.readBill(client, q.piId, q.accYear, opts);
    if (
      !bill ||
      bill.companyId.toLowerCase() !== q.companyId.toLowerCase() ||
      bill.branchId.toLowerCase() !== q.branchId.toLowerCase()
    ) {
      throwStockNotFound<StockErrorDetail>(
        'Bill not found',
        'piId',
        `No purchase bill ${q.piId} (${q.accYear}) at this company and branch.`,
        StockErrorCode.PRICE_BILL_NOT_FOUND,
      );
    }
    if (bill.status !== 'POSTED') {
      throwStockUnprocessable<StockErrorDetail>('Bill not posted', [
        {
          field: 'piId',
          code: StockErrorCode.PRICE_BILL_NOT_POSTED,
          message: `${bill.refno} is ${bill.status}, so its costs do not move any price. Post the bill first.`,
          params: { bill: bill.refno, status: bill.status },
        } as StockErrorDetail,
      ]);
    }
    return bill;
  }

  /** One row's `fromBill` (§7.2): the kind, the bill's figures, the proposal, the words, S3's change. */
  private fromBillOf(
    target: Target,
    defaultLevel: number,
    levelNames: ReadonlyMap<number, string>,
    changedSince: FromBillChange | null = null,
  ): FromBill {
    const group = target.group;
    const kind: FromBillKind = target.later ? 'LATER_BILL' : target.kind;
    const proposal = target.later ? null : this.propose(target, defaultLevel);
    const row = target.row;
    const sameAsNow =
      proposal !== null &&
      target.kind !== 'NO_PRICE' &&
      row.lineCost !== null &&
      dp6(D(row.lineCost)).equals(dp6(target.cost)) &&
      proposal.minPrice === null &&
      proposal.maxPrice === null &&
      proposal.levels.every((level) => level.price.equals(D(row.levels.find((l) => l.level === level.level)?.price ?? 0)));
    const gst = group.gstPerc.toDecimalPlaces(2).toString();
    const billLevels = proposal?.levels.filter((level) => level.from === 'BILL').map((level) => levelNames.get(level.level) ?? `Price ${'ABCD'[level.level - 1]}`) ?? [];
    let words: string;
    if (kind === 'LATER_BILL' && target.later) {
      words = `later purchase ${target.later.refno} ${displayDate(target.later.docDate).slice(0, 5)}, cost ${money(target.later.cost)}`;
    } else if (kind === 'CHAIN' && target.chainFrom) {
      words =
        target.chainFrom.way === 'SMALLER'
          ? `${target.chainFrom.unitName ?? ''} ÷ ${ratioText(D(target.chainFrom.factor))} (the smaller unit)`
          : `${target.chainFrom.unitName ?? ''} × ${ratioText(D(target.chainFrom.factor))} (the bigger unit)`;
    } else {
      const free = group.freeQty.greaterThan(0) ? ` + ${qtyText(group.freeQty)} free` : '';
      const at = group.mrp !== null ? ` at MRP ${money(group.mrp)}` : group.salePrice !== null ? ` sold at ${money(group.salePrice)}` : '';
      const wins = billLevels.length
        ? ` · the bill's ${billLevels.length === 1 ? billLevels[0] : `${billLevels.slice(0, -1).join(', ')} and ${billLevels[billLevels.length - 1]}`} ${billLevels.length === 1 ? 'wins' : 'win'}`
        : '';
      words = `${qtyText(group.qty)} ${group.unitName ?? ''}${free}${at} · rate ${money(group.rate)} · landing ${money(group.costWot)} + GST ${gst} %${wins}`;
    }
    return {
      kind,
      billLines: group.lines.map((line) => line.lineNo),
      qty: group.qty.toNumber(),
      freeQty: group.freeQty.toNumber(),
      unitName: group.unitName,
      rate: n2(group.rate),
      landedCostWot: n6(target.costWot),
      landedCost: n6(target.cost),
      chainFrom: target.chainFrom,
      laterBill: target.later
        ? {
            piId: target.later.piId,
            accYear: target.later.accYear,
            refno: target.later.refno,
            docDate: target.later.docDate,
            branchName: target.later.branchName,
            cost: n2(target.later.cost),
          }
        : null,
      proposed: proposal
        ? {
            cost: n6(target.cost),
            costWot: n6(target.costWot),
            levels: proposal.levels.map((level) => ({ level: level.level, price: n6(level.price), from: level.from })),
            minPrice: proposal.minPrice === null ? null : n6(proposal.minPrice),
            maxPrice: proposal.maxPrice === null ? null : n6(proposal.maxPrice),
          }
        : null,
      sameAsNow,
      words,
      changedSince,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  POST /stock/price-bulk with fromPurchase (§7.3)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * P1's save, from the purchase view: the bill must be POSTED at this company and branch (404 /
   * 422); in the transaction, after the target rows are locked (S1), a row of the bill's item and
   * key that a LATER posted bill bought refuses the whole save (409 STOCK_PRICE_LATER_PURCHASE,
   * field rows.<n>); every row's log reason is "From purchase PI-… (dd-MM-yyyy)"; one
   * PRICES_REVIEWED step on the bill when a row was written. The confirm round trip is P1's.
   */
  async saveFromPurchase(dto: SaveSellingPriceBulkDto): Promise<SellingPriceSaveResult> {
    const fp = dto.fromPurchase!;
    await this.bulk.assertCanEditPrices();
    await this.bulk.assertBranchAllowed(dto.branchId);
    const db = this.prisma as unknown as Tx;
    const bill = await this.postedBill(db, { companyId: dto.companyId, branchId: dto.branchId, accYear: fp.accYear, piId: fp.piId });
    const lines = await this.gateway.readLines(db, bill.piId, bill.accYear);
    const actor = resolveActor(dto.userId, this.requestContext.getUserId());
    const reason = `From purchase ${bill.refno} (${displayDate(bill.docDate)})`;
    return this.bulk.saveBulk(dto, {
      reason,
      fromPurchase: { piId: bill.piId, accYear: bill.accYear, refno: bill.refno },
      // N2 — the bill FOR SHARE, first: cancelled meanwhile → the same 422 as the GET; a cancel
      // still running waits for this save (the cancel locks its bill before its price rows).
      beforePrepare: async (tx) => {
        await this.postedBill(tx, { companyId: dto.companyId, branchId: dto.branchId, accYear: bill.accYear, piId: bill.piId }, { lock: 'SHARE' });
      },
      // N4 — the scheduled rows of each saved key are locked with the rows (sorted, S5).
      lockFuture: true,
      // User 2026-11-27 ("every purchase and its stock is a single line maintenance") — the bill's
      // own rows (its bought keys and their chain units, with a cost on the bill) are judged below
      // cost on the cost they send only, as the post's automatic modes judge them: a price that
      // UPDATE_PRICES writes silently is not asked about here. Any other row keeps A3-C (and C6).
      ownCostOnly: (_index, row, key, cost) =>
        isBillKey(lines, { itemId: row.itemId, mrp: key.mrp, salePrice: key.salePrice }, cost, { costed: true }),
      afterPrepare: async (tx, prepared) => {
        await this.assertLatest(tx, bill, lines, prepared);
      },
      afterWrite: async (tx, result, prepared) => {
        if (result.saved <= 0) {
          return;
        }
        // N4 (user 2026-11-26: cost only) — each saved key's scheduled rows take its new cost.
        await this.moveScheduledOfSave(tx, prepared, reason);
        await appendTxnStatusLog(tx, {
          companyId: bill.companyId,
          branchId: bill.branchId,
          accYear: bill.accYear,
          srcModule: TxnStatusSrcModule.PURCHASE,
          srcDocType: TxnStatusDocType.PURCHASE_BILL,
          srcDocId: bill.piId,
          srcDocRefno: bill.refno,
          event: TxnStatusEvent.PRICES_REVIEWED,
          fromStatus: 'POSTED',
          toStatus: 'POSTED',
          changedBy: actor,
          remarks: `Change Selling Price: ${result.saved} line${result.saved === 1 ? '' : 's'} saved`,
          deviceId: this.requestContext.getDeviceId() ?? bill.deviceId,
        });
      },
    });
  }

  /**
   * §7.3 step 2 — after S1 has locked the rows, a row whose item is on the bill and whose key
   * (per base unit) is one the bill bought may not be saved from this bill when a later posted
   * bill bought it (in the row's scope: All branches → the company, else the branch).
   */
  private async assertLatest(
    tx: Tx,
    bill: StepBill,
    lines: readonly StepBillLine[],
    prepared: PreparedBulkSave,
  ): Promise<void> {
    const mine = prepared.candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate, index }) => isBillKey(lines, candidate, prepared.costs[index]));
    if (!mine.length) {
      return;
    }
    // Decision 20 — the rows are already locked (lockTargets: once, in ipm_id order, review S5);
    // only now are the later bills read.
    const later = await this.gateway.laterLines(tx, {
      companyId: bill.companyId,
      piId: bill.piId,
      docDate: bill.docDate,
      docDatetime: bill.docDatetime,
      itemIds: [...new Set(mine.map(({ candidate }) => candidate.itemId))],
    });
    const taxRates = await this.bulk.resolveItemTaxRates(tx, [...new Set(mine.map(({ candidate }) => candidate.itemId))]);
    const errors: StockErrorDetail[] = [];
    for (const { candidate, index } of mine) {
      const cost = prepared.costs[index];
      const factor = D(cost.unitFactor ?? 1);
      const match = laterMatch(later, {
        itemId: candidate.itemId,
        trackMrp: cost.trackMrp,
        trackSalePrice: cost.trackSalePrice,
        mrp: candidate.mrp === null ? null : D(candidate.mrp),
        salePrice: candidate.salePrice === null ? null : D(candidate.salePrice),
        factor,
        branchId: prepared.resolutions[index].targetScope === 'CHAIN' ? null : bill.branchId,
      });
      if (!match) {
        continue;
      }
      const gst = D(taxRates.get(candidate.itemId)?.taxPerc ?? 0);
      const laterCost = money(withTax(match.landedCostWot.times(factor), gst));
      const unit = candidate.unitName ?? '';
      errors.push({
        field: `rows.${candidate.lineNo}`,
        code: StockErrorCode.PRICE_LATER_PURCHASE,
        message:
          `Line ${candidate.lineNo}: ${match.refno} of ${displayDate(match.docDate)} was posted after ${bill.refno} and set ` +
          `${candidate.itemName} ${unit} at ${laterCost}. Load this bill's prices again.`,
        params: { bill: match.refno, date: displayDate(match.docDate), item: candidate.itemName, unit, cost: laterCost, n: candidate.lineNo },
      } as StockErrorDetail);
    }
    if (errors.length) {
      throwStockConflict<StockErrorDetail>('A later purchase moved these prices', errors);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  The post's step (§4.6 – §4.8; addendum decisions 35, 36)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * In THE BILL'S post transaction, after its stock. Below cost is judged on THIS bill's own cost
   * for each key (the cost the line stores; user 2026-11-27: every purchase line is its own stock
   * lot), never the higher of it and the branch / MRP stock average:
   *   NONE                 every line OFF, nothing read;
   *   OPEN_CHANGE_SELLING  nothing written; LATER_BILL where a later bill bought the key, else
   *                        TO_REVIEW (one PUR_PRICE_TO_REVIEW note for a buyer without Edit on 30);
   *   COST_ONLY            the bought lines and their chain units take the bill's cost; prices kept;
   *   UPDATE_PRICES        cost + prices (bill-typed win, the rest by Profit Type) + MSP + Q11 MRP,
   *                        one write or the cost alone (below cost under restrict / warning, above
   *                        an MRP — U1 not under skip_mrp — below the MSP), only active levels
   *                        judged (S4); a bought MRP with no line is made when the bill typed a
   *                        price (Q9), else NO_LINE.
   * The automatic modes lock the keys they may insert (N1), then every row they write once, in
   * ipm_id order (S5), before the B5 read (decision 20); Open mode locks nothing. D16 in both
   * automatic modes; a kept bought unit keeps its unit chain (N9). A moved key's scheduled rows
   * take its new cost (N4). Returns each line's result + pii_old_prices, and the notes.
   */
  async afterPurchase(
    tx: Tx,
    args: { piId: string; accYear: string; mode: PurchasePriceMode; actor: string; isHq: boolean; businessTime: Date; canReview: boolean },
  ): Promise<AfterPurchaseOutcome> {
    const bill = await this.gateway.readBill(tx, args.piId, args.accYear);
    const lines = bill ? await this.gateway.readLines(tx, args.piId, args.accYear) : [];
    const outcome: AfterPurchaseOutcome = { lines: new Map(), notes: [] };
    if (!bill || args.mode === 'NONE') {
      for (const line of lines) {
        outcome.lines.set(line.piiId, { result: 'OFF', oldPrices: [] });
      }
      return outcome;
    }
    const settings = await this.gateway.stepSettings(tx, bill.companyId, bill.branchId);
    const { targets, groups } = await this.resolveTargets(tx, bill, lines, { isHq: args.isHq, withSpread: false });

    const groupResult = new Map<string, PurchasePriceResult>();
    const groupEntries = new Map<string, PurchaseOldPriceEntry[]>();
    const lineOf = (group: BoughtGroup) => group.lines[0].lineNo;
    const itemLabel = (target: Target) =>
      `${target.group.itemName}${target.mrp !== null ? ` MRP ${money(target.mrp)}` : ''}`;
    const laterNote = (target: Target) => {
      const later = target.later!;
      const n = lineOf(target.group);
      outcome.notes.push({
        code: 'PUR_PRICE_LATER_BILL',
        field: `lines.${n}`,
        lineNo: n,
        message:
          `Line ${n}: ${later.refno} of ${displayDate(later.docDate)} is a later purchase of ${itemLabel(target)}` +
          `${target.kind === 'CHAIN' ? ` ${target.row.unitName ?? ''}` : ''}, so this bill did not change its cost or prices.`,
        params: { n, bill: later.refno, date: displayDate(later.docDate), item: itemLabel(target) },
      });
    };

    // Free goods only (landed 0): nothing moves (§4.2.1).
    const live = targets.filter((t) => t.group.landedWot.greaterThan(0));
    for (const group of groups) {
      if (!group.landedWot.greaterThan(0)) {
        groupResult.set(group.id, 'NONE');
      }
    }

    if (args.mode === 'OPEN_CHANGE_SELLING') {
      // Review S5 — Open mode writes nothing, so it locks nothing: B5 only names LATER_BILL / TO_REVIEW.
      await this.applyLater(tx, bill, targets);
      for (const target of live.filter((t) => t.kind !== 'CHAIN')) {
        if (target.later) {
          groupResult.set(target.group.id, 'LATER_BILL');
          laterNote(target);
        } else {
          groupResult.set(target.group.id, 'TO_REVIEW');
        }
      }
      if (!args.canReview && [...groupResult.values()].includes('TO_REVIEW')) {
        outcome.notes.push({
          code: 'PUR_PRICE_TO_REVIEW',
          field: 'header',
          lineNo: null,
          message:
            "Prices to review: this bill's costs and prices wait for a review on Change Selling Price. Open them with " +
            'Selling prices · Ctrl+Shift+G (needs Edit on Change Selling Price).',
        });
      }
      return this.finishOutcome(outcome, lines, groups, groupResult, groupEntries);
    }

    // ── COST_ONLY / UPDATE_PRICES ──────────────────────────────────────────
    // The scope each target writes at (§4.2.4) and its key there.
    const resolutions = new Map<Target, ScopeResolution>(
      live.map((t) => [t, resolveTargetScope(t.scope.scope, t.scope.rowScope, bill.branchId)]),
    );
    const probeOf = (t: Target): PriceKeyProbe => ({
      companyId: bill.companyId,
      branchId: resolutions.get(t)!.targetBranchId,
      itemId: t.group.itemId,
      uomId: t.row.uomId,
      mrp: t.mrp === null ? null : t.mrp.toNumber(),
      salePrice: t.salePrice === null ? null : t.salePrice.toNumber(),
    });
    // Review N4 — each key's scheduled rows (they take the new cost too), found before the locks.
    const scheduled = await this.priceGateway.findPriceRows(tx, live.map(probeOf), undefined, { inForce: false, future: true });
    const scheduledOf = new Map<Target, FoundPriceRow[]>(live.map((t, index) => [t, scheduled.filter((row) => row.index === index)]));
    // Review N1 / S5 — the keys a write may INSERT (a Q9 new line, "→ this branch") advisory-locked
    // first; then every row the step writes, ONCE, in ipm_id order (the lines in force and the
    // scheduled rows; menu 30's saves lock in the same order); then B5 (decision 20). Their
    // company (null = company-less) is D16's.
    await this.priceGateway.lockPriceKeys(
      tx,
      live.filter((t) => t.kind === 'NO_PRICE' || resolutions.get(t)!.expected === 'INSERT').map((t) => priceKeyLockId(probeOf(t))),
    );
    const lineCompany = await this.gateway.lockRows(tx, [
      ...targets.filter((t) => t.kind !== 'NO_PRICE' && t.row.bucketId).map((t) => t.row.bucketId!),
      ...scheduled.map((row) => row.ipmId),
    ]);
    await this.applyLater(tx, bill, targets);

    const newer = await this.gateway.newerChanges(tx, {
      companyId: bill.companyId,
      branchId: bill.branchId,
      itemIds: [...new Set(live.map((t) => t.group.itemId))],
      after: args.businessTime,
    });
    const levels = await this.priceGateway.priceLevels(tx);
    const levelNames = new Map(levels.map((level) => [level.level, level.name]));
    // S4 (decision 36) — only the levels the company uses are judged.
    const activeLevels = levels.filter((level) => level.active).map((level) => level.level);
    const taxRates = await this.bulk.resolveItemTaxRates(tx, [...new Set(live.map((t) => t.group.itemId))]);
    const origin = (target: Target): PriceWriteOrigin => ({
      source: 'PURCHASE',
      menuId: PRICE_MENU_ID.PURCHASE_ENTRY,
      reason:
        `Purchase ${bill.refno} (${displayDate(bill.docDate)})` +
        (target.scope.label === '→ this branch' ? ' → this branch' : '') +
        (target.kind === 'CHAIN' ? ` · chain from ${target.group.unitName ?? ''}` : ''),
    });
    const applied: AppliedBucketPrice[] = [];
    const appliedScopes: Array<'CHAIN' | 'BRANCH'> = [];
    const appliedLabels: string[] = [];
    const entryOf = new Map<string, PurchaseOldPriceEntry>();
    // N9 (user 2026-11-26: keep the chain) — the bought units D16 kept, with the change that kept them.
    const keptBought = new Map<string, NewerChange>();

    for (const target of live) {
      const bought = target.kind !== 'CHAIN';
      const n = lineOf(target.group);
      const setBought = (result: PurchasePriceResult) => {
        if (bought) {
          groupResult.set(target.group.id, result);
        }
      };
      if (target.later) {
        setBought('LATER_BILL');
        // A chain unit's later bill is said only when its bought unit's is not.
        if (bought || !targets.some((t) => t.group === target.group && t.kind !== 'CHAIN' && t.later)) {
          laterNote(target);
        }
        continue;
      }
      // N9 — the bought unit was kept by D16: its unit chain is kept too, and the note says why.
      const boughtChange = bought ? undefined : keptBought.get(target.group.id);
      if (boughtChange) {
        this.keptChainNote(outcome, target, n, boughtChange);
        continue;
      }
      // D16 — a logged change of THAT line (item, unit, key) after the bill's business time. The log
      // files a company-less row's change with no company: it counts against a company-less line only.
      const companyLess = target.row.bucketId !== null && lineCompany.get(target.row.bucketId) === null;
      const changed = changeOf(newer, target, companyLess);
      if (changed && target.kind !== 'NO_PRICE') {
        setBought('KEPT_NEWER');
        if (bought) {
          keptBought.set(target.group.id, changed);
        }
        this.keptNewerNote(outcome, target, n, changed);
        continue;
      }
      const proposal = this.propose(target, settings.defaultLevel);
      const typedAny = target.group.sells.some((sell) => sell !== null && sell.greaterThan(0));

      if (target.kind === 'NO_PRICE') {
        if (args.mode !== 'UPDATE_PRICES' || !typedAny) {
          setBought('NO_LINE');
          this.noLineNote(outcome, target, n, settings.defaultLevel);
          continue;
        }
      }

      // ── the candidate ────────────────────────────────────────────────────
      const isNew = target.kind === 'NO_PRICE';
      const write = this.levelsToWrite(target, args.mode, proposal, isNew);
      const rowDto = {
        lineNo: n,
        itemId: target.group.itemId,
        uomId: target.row.uomId,
        bucketId: isNew ? null : target.row.bucketId,
        priceScope: target.scope.rowScope,
        mrp: target.mrp === null ? null : target.mrp.toNumber(),
        salePrice: target.salePrice === null ? null : target.salePrice.toNumber(),
        levels: write.levels,
        costPrice: n6(target.cost),
        minPrice: null as number | null,
        roundOff: write.roundOff,
        profitType: write.profitType,
        maxPrice: null as number | null,
      };
      const [cost] = await this.priceGateway.loadRowCosts(
        tx,
        [{ itemId: rowDto.itemId, uomId: rowDto.uomId, mrp: rowDto.mrp, salePrice: rowDto.salePrice }],
        bill.companyId,
        bill.branchId,
        undefined,
        taxRates,
      );
      const resolution = resolutions.get(target)!;
      const keyed = { costRate: n6(target.cost), costWot: n6(target.costWot) };
      const build = (withPrices: boolean) => {
        const dto = {
          ...rowDto,
          levels: withPrices ? write.levels : write.keepLevels,
          minPrice: withPrices && proposal.minPrice !== null ? proposal.minPrice.toNumber() : null,
          maxPrice: withPrices && proposal.maxPrice !== null ? proposal.maxPrice.toNumber() : null,
        } as unknown as SaveSellingPriceRowDto;
        // User 2026-11-27 — every purchase line is its own stock lot, so the bill's cost IS that
        // stock's cost: below cost is judged on it alone (ownCostOnly), not the higher of it and the
        // branch / MRP stock average.
        return this.bulk.toCandidate(dto, 0, bill.companyId, args.actor, taxRates, cost, {
          keepCost: () => keyed,
          ownCostOnly: () => true,
        });
      };
      let candidate = build(args.mode === 'UPDATE_PRICES');
      let result: PurchasePriceResult = args.mode === 'UPDATE_PRICES' ? 'UPDATED' : 'COST_ONLY';
      // Levels already said as refused (PUR_PRICE_NOT_WRITTEN) or written below cost: no second note.
      const said = new Set<number>();

      if (args.mode === 'UPDATE_PRICES') {
        // Only what the bill changes is judged: the BILL / RULE levels whose price moves (a By User
        // price the new cost overtakes is not a refusal — it is noted below).
        const changedLevels = proposal.levels.filter(
          (level) => level.from !== 'KEPT' && !level.price.equals(this.currentLevels(target.row)[level.level - 1].price),
        );
        const judged: BucketPriceCandidate = {
          ...candidate,
          levels: candidate.levels.filter((level) => changedLevels.some((c) => c.level === level.level)),
        };
        const problems = this.priceGateway.validateRows([judged], [cost.minPrice], { activeLevels, levelNames });
        // U1 (decision 35) — above a plain line's TYPED MRP (its headline's ipm_max_price, after Q11),
        // unless inventory.skip_mrp. Above a bucket's own MRP is validateRows' ABOVE_MRP.
        const typedMrp = proposal.maxPrice ?? (target.row.maxPrice > 0 ? D(target.row.maxPrice) : null);
        const plainHeadline =
          candidate.mrp === null && candidate.salePrice === null && !target.group.trackMrp && !target.row.trackMrp;
        const u1 =
          !settings.skipMrp && plainHeadline && typedMrp !== null && typedMrp.greaterThan(0)
            ? judged.levels.filter(
                (level) =>
                  activeLevels.includes(level.level) &&
                  D(level.price).greaterThan(typedMrp) &&
                  !problems.some((p) => p.level === level.level),
              )
            : [];
        const blocking = [
          ...problems.filter((p) => p.verdict !== 'BELOW_COST' || settings.belowCost !== 'allow'),
        ];
        if (blocking.length || u1.length) {
          // S4 — each refusal names its level, its price and the figure it broke (MRP / Min / cost).
          const refused = {
            problems: blocking,
            judged,
            minPrice: judged.minPrice ?? cost.minPrice,
            aboveTyped: u1.map((l) => ({ level: l.level, price: l.price })),
            typedMrp,
          };
          if (isNew) {
            setBought('NO_LINE');
            this.notWrittenNotes(outcome, target, n, refused, levelNames, true);
            continue;
          }
          this.notWrittenNotes(outcome, target, n, refused, levelNames, false);
          [...blocking.map((p) => p.level ?? 0), ...u1.map((l) => l.level)].forEach((level) => said.add(level));
          candidate = build(false);
          result = 'COST_ONLY';
        } else {
          // allow — written below cost, and said.
          for (const p of problems.filter((p) => p.verdict === 'BELOW_COST')) {
            said.add(p.level ?? 0);
            this.belowNewCostNote(outcome, target, n, p.level ?? 1, D(p.cost ?? 0), D(judged.levels.find((l) => l.level === p.level)?.price ?? 0), levelNames);
          }
        }
      }

      // Nothing to change: no write (the cost and every price sent are the line's own).
      if (!isNew && this.sameAsLine(target, candidate)) {
        setBought('NONE');
        continue;
      }

      // ── the write (S1 → S2 / S3), its "before", its audit ──────────────────
      const existing = await this.priceGateway.findBucketRowForUpdate(tx, candidate, resolution);
      if (!existing && !isNew) {
        // "→ this branch" (or a shared row this company copies): the new row starts from the
        // line's own MSP / R.Off / Profit Type, not the headline's.
        candidate = { ...candidate, minPrice: candidate.minPrice ?? (target.row.minPrice > 0 ? target.row.minPrice : null) };
      }
      const before = existing ? (await this.gateway.rowFigures(tx, [existing.ipmId])).get(existing.ipmId) ?? null : null;
      const writeIt = () => this.bulk.applyBucketPrice(tx, candidate, resolution, undefined, origin(target));
      // N1 — an insert runs inside a savepoint: a writer that holds no key lock (the item card) can
      // still make the same line first; its 23P01 is that newer change (KEPT_NEWER), never a 500.
      const done = existing ? await writeIt() : await insertOrYield(tx, writeIt);
      if (!done) {
        setBought('KEPT_NEWER');
        const [winner] = await this.priceGateway.findPriceRows(tx, [probeOf(target)], undefined);
        const last = winner ? await this.gateway.lastChange(tx, winner.ipmId) : null;
        this.keptNewerNote(outcome, target, n, last);
        continue;
      }
      applied.push(done);
      appliedScopes.push(resolution.targetScope);
      const label = `${target.scope.label}${target.kind === 'CHAIN' ? `, chain from ${target.group.unitName ?? ''}` : ''}`;
      appliedLabels.push(label);
      const entry: PurchaseOldPriceEntry = {
        ipmId: done.ipmId,
        kind: target.kind === 'CHAIN' ? 'CHAIN' : 'BOUGHT',
        action: done.before ? 'UPDATE' : 'CREATE',
        before: done.before ? before : null,
        afterToken: '',
        itemName: target.group.itemName,
        unitName: target.row.unitName,
      };
      entryOf.set(done.ipmId, entry);
      groupEntries.set(target.group.id, [...(groupEntries.get(target.group.id) ?? []), entry]);
      setBought(result);
      // A price the new cost overtakes, that the bill did not set (By User, a kept level, cost only).
      const judgeCost = D(candidate.judgeCost ?? candidate.costRate);
      for (const level of candidate.levels) {
        const kept =
          result === 'COST_ONLY' ||
          proposalFrom(proposal, level.level) === 'KEPT';
        if (kept && !said.has(level.level) && activeLevels.includes(level.level) && level.price > 0 && D(level.price).lessThan(judgeCost)) {
          this.belowNewCostNote(outcome, target, n, level.level, judgeCost, D(level.price), levelNames);
        }
      }
      // N4 (user 2026-11-26: cost only) — the key's scheduled rows take the new cost; their prices
      // stay as scheduled (markups recomputed). Each is in pii_old_prices: Cancel puts it back by
      // the same token rule.
      for (const row of scheduledOf.get(target) ?? []) {
        const base = origin(target);
        const moved = await this.moveScheduledRow(tx, {
          ipmId: row.ipmId,
          from: row.effectiveFrom,
          lineNo: n,
          key: { itemId: rowDto.itemId, uomId: rowDto.uomId, mrp: rowDto.mrp, salePrice: rowDto.salePrice },
          cost,
          costPair: keyed,
          companyId: bill.companyId,
          actor: args.actor,
          origin: { ...base, reason: `${base.reason ?? ''} · scheduled from ${displayDate(row.effectiveFrom)}` },
        });
        if (!moved) {
          continue;
        }
        applied.push(moved.applied);
        appliedScopes.push(resolution.targetScope);
        appliedLabels.push(`${label}, scheduled from ${displayDate(row.effectiveFrom)}`);
        const scheduledEntry: PurchaseOldPriceEntry = {
          ipmId: row.ipmId,
          kind: entry.kind,
          action: 'UPDATE',
          before: moved.before,
          afterToken: '',
          itemName: target.group.itemName,
          unitName: target.row.unitName,
          scheduledFrom: row.effectiveFrom,
        };
        entryOf.set(row.ipmId, scheduledEntry);
        groupEntries.set(target.group.id, [...(groupEntries.get(target.group.id) ?? []), scheduledEntry]);
      }
    }

    // The tokens of the rows as written (Cancel puts back only an untouched row).
    const tokens = await this.gateway.rowTokens(tx, [...entryOf.keys()]);
    for (const [ipmId, entry] of entryOf) {
      entry.afterToken = tokens.get(ipmId) ?? '';
    }
    if (applied.length) {
      await this.bulk.auditWrites(tx, applied, {
        actor: args.actor,
        confirmedBelowCost: [],
        scopes: appliedScopes,
        writer: `Purchase ${bill.refno} (${displayDate(bill.docDate)})`,
        scopeLabels: appliedLabels,
      });
    }
    return this.finishOutcome(outcome, lines, groups, groupResult, groupEntries);
  }

  /**
   * The levels a target's write sends: the proposal's (UPDATE_PRICES), and the line's own prices
   * (COST_ONLY, or a refused write) — levels above 0 only, so an unpriced level keeps its stored
   * figures; the markups are recomputed against the new cost (price wins), a By % RULE level
   * sending its kept % (kept as typed when it reproduces the price).
   */
  private levelsToWrite(
    target: Target,
    mode: PurchasePriceMode,
    proposal: { levels: ProposedLevel[] },
    isNew: boolean,
  ): {
    levels: Array<{ level: number; price: number; markupPerc?: number }>;
    keepLevels: Array<{ level: number; price: number }>;
    roundOff: number | null;
    profitType: string | null;
  } {
    const current = this.currentLevels(target.row);
    const keepLevels = current.filter((level) => level.price.greaterThan(0)).map((level) => ({ level: level.level, price: n6(level.price) }));
    if (isNew) {
      // Q9 — typed levels, the rest from the start-from line (its rule on the new cost).
      const start = target.startFrom;
      const made = proposeNewLine({
        startFrom: start
          ? {
              levels: this.currentLevels(start),
              profitType: start.profitType,
              roundOff: D(start.roundOff ?? 0),
              lineCost: start.lineCost === null ? null : D(start.lineCost),
            }
          : null,
        billPrices: target.group.sells,
        gstPerc: target.group.gstPerc,
        newCost: target.cost,
        newCostWot: target.costWot,
      });
      proposal.levels.splice(0, proposal.levels.length, ...made);
      return {
        levels: made.filter((level) => level.price.greaterThan(0)).map((level) => ({
          level: level.level,
          price: n6(level.price),
          ...(level.keptPercent !== null ? { markupPerc: n6(level.keptPercent) } : {}),
        })),
        keepLevels: [],
        roundOff: start ? start.roundOff : null,
        profitType: start ? start.profitType : null,
      };
    }
    const levels =
      mode === 'UPDATE_PRICES'
        ? proposal.levels
            .filter((level) => level.price.greaterThan(0) || current[level.level - 1].price.greaterThan(0))
            .map((level) => ({
              level: level.level,
              price: n6(level.price),
              ...(level.keptPercent !== null ? { markupPerc: n6(level.keptPercent) } : {}),
            }))
        : keepLevels;
    return { levels, keepLevels, roundOff: target.row.roundOff, profitType: target.row.profitType };
  }

  /** The cost and every price the candidate sends equal the line as it stands. */
  private sameAsLine(target: Target, candidate: BucketPriceCandidate & { maxPrice?: number | null }): boolean {
    const row = target.row;
    if (row.lineCost === null || !dp6(D(row.lineCost)).equals(dp6(D(candidate.costRate)))) {
      return false;
    }
    if (candidate.minPrice !== null || (candidate.maxPrice !== undefined && candidate.maxPrice !== null)) {
      return false;
    }
    return candidate.levels.every((level) =>
      D(level.price).equals(D(row.levels.find((l) => l.level === level.level)?.price ?? 0)),
    );
  }

  /**
   * B3 / D4 — the bought key has no line: what the stock sells at today (the other-MRPs line).
   * S4 — an MRP key keeps the plain wording ({item} MRP {mrp} … the other-MRPs price {price}); any
   * other key (a plain item's unit, a sale-price key) is rule=PLAIN: {item} {unit} has no line.
   */
  private noLineNote(outcome: AfterPurchaseOutcome, target: Target, n: number, defaultLevel: number): void {
    const start = target.startFrom;
    const prices = start?.levels ?? [];
    const at = prices.find((level) => level.level === defaultLevel && level.price > 0) ?? prices.find((level) => level.price > 0);
    const mrp = target.mrp !== null ? money(target.mrp) : null;
    const item = target.group.itemName;
    const unit = target.row.unitName ?? '';
    const price = at ? money(at.price) : null;
    if (mrp) {
      outcome.notes.push({
        code: 'PUR_PRICE_NO_LINE',
        field: `lines.${n}`,
        lineNo: n,
        message: `Line ${n}: ${item} MRP ${mrp} has no price yet` + (price ? `: it sells at the other-MRPs price ${price}.` : '.'),
        params: { n, item, unit, mrp, ...(price ? { price } : {}) },
      });
      return;
    }
    const salePrice = target.salePrice !== null ? money(target.salePrice) : null;
    outcome.notes.push({
      code: 'PUR_PRICE_NO_LINE',
      field: `lines.${n}`,
      lineNo: n,
      rule: 'PLAIN',
      message:
        `Line ${n}: ${item} ${unit}${salePrice ? ` sold at ${salePrice}` : ''} has no price line yet` +
        (price ? `: it sells at ${price} today.` : ', so this bill could not price it.'),
      params: { n, item, unit, ...(salePrice ? { salePrice } : {}), ...(price ? { price } : {}) },
    });
  }

  /**
   * §4.8 / S4 — a refused write: one PUR_PRICE_NOT_WRITTEN per level, each naming its level, its
   * price and the figure it broke —
   *   rule=ABOVE_MRP   above a bucket's MRP or a plain line's typed MRP (U1): {mrp}
   *   rule=BELOW_MIN   below the MSP / minimum price: {min}
   *   rule=BELOW_COST  below this bill's own cost for the key (user 2026-11-27: the bill's cost
   *                    only, no stock average beside it): {cost}, and {lineCost} (the same figure)
   *   rule=NEW_LINE_ABOVE_MRP / NEW_LINE_BELOW_MIN / NEW_LINE_BELOW_COST — the same on a Q9 new
   *                    line: nothing was written, "so no price line was made" — one rule per limit,
   *                    so the wording row can name it, with the same figure params.
   * Always {n} {level} {price} {item} {unit}.
   */
  private notWrittenNotes(
    outcome: AfterPurchaseOutcome,
    target: Target,
    n: number,
    refused: {
      problems: readonly SellingPriceProblem[];
      judged: BucketPriceCandidate;
      minPrice: number;
      aboveTyped: ReadonlyArray<{ level: number; price: number }>;
      typedMrp: Dec | null;
    },
    levelNames: ReadonlyMap<number, string>,
    isNew: boolean,
  ): void {
    const item = target.group.itemName;
    const unit = target.row.unitName ?? '';
    const tail = isNew ? 'so no price line was made.' : 'so its prices were kept; its cost moved.';
    const nameOf = (level: number) => levelNames.get(level) ?? `Price ${'ABCD'[level - 1] ?? level}`;
    const push = (level: number, price: string, why: string, rule: string, figures: Record<string, string>) =>
      outcome.notes.push({
        code: 'PUR_PRICE_NOT_WRITTEN',
        field: `lines.${n}`,
        lineNo: n,
        rule: isNew ? `NEW_LINE_${rule}` : rule,
        message: `Line ${n}: ${nameOf(level)} ${price} of ${item} ${unit} ${why}, ${tail}`,
        params: { n, level: nameOf(level), price, item, unit, ...figures },
      });
    for (const p of refused.problems) {
      const level = p.level ?? 1;
      const price = money(D(refused.judged.levels.find((l) => l.level === level)?.price ?? 0));
      if (p.verdict === 'ABOVE_MRP') {
        const mrp = money(D(refused.judged.mrp ?? 0));
        push(level, price, `would be above its MRP ${mrp}`, 'ABOVE_MRP', { mrp });
      } else if (p.verdict === 'BELOW_MIN') {
        const min = money(D(refused.minPrice));
        push(level, price, `would be below its minimum price ${min}`, 'BELOW_MIN', { min });
      } else {
        // User 2026-11-27 — judged on this bill's cost alone: the words name only that cost.
        const cost = money(D(p.cost ?? refused.judged.judgeCost ?? refused.judged.costRate));
        const lineCost = p.lineCost !== undefined && p.lineCost !== null ? money(D(p.lineCost)) : null;
        push(level, price, `would be below the cost ${cost}`, 'BELOW_COST', { cost, ...(lineCost ? { lineCost } : {}) });
      }
    }
    for (const above of refused.aboveTyped) {
      const mrp = refused.typedMrp ? money(refused.typedMrp) : '';
      push(above.level, money(D(above.price)), `would be above its MRP ${mrp}`, 'ABOVE_MRP', { mrp });
    }
  }

  /**
   * D16 — PUR_PRICE_KEPT_NEWER: the line was changed after the bill's business time (or, N1, made by
   * another writer at the same moment), so the bill keeps its own price as history. S4 params:
   * {n} {item} {unit}, and when the log names it {when} (dd-MM-yyyy hh:mm AM) {who} {source}.
   */
  private keptNewerNote(
    outcome: AfterPurchaseOutcome,
    target: Target,
    n: number,
    changed: { at: Date; who: string | null; source: string } | null,
  ): void {
    const item = target.group.itemName;
    const unit = target.row.unitName ?? '';
    const when = changed ? whenText(changed.at, true) : null;
    const source = changed ? sourceWords(changed.source) : null;
    outcome.notes.push({
      code: 'PUR_PRICE_KEPT_NEWER',
      field: `lines.${n}`,
      lineNo: n,
      message:
        `Line ${n}: ${item} ${unit} price not updated — changed later` +
        (changed ? ` on ${when} (${source}${changed.who ? `, ${changed.who}` : ''})` : '') +
        '; the bill keeps its own price as history.',
      params: {
        n,
        item,
        unit,
        ...(when ? { when } : {}),
        ...(changed?.who ? { who: changed.who } : {}),
        ...(source ? { source } : {}),
      },
    });
  }

  /**
   * N9 (user 2026-11-26: keep the chain) — PUR_PRICE_KEPT_NEWER rule=CHAIN: a chain unit kept because
   * D16 kept its bought unit. {n} {item} {unit} (the chain unit) {boughtUnit} {when} {who} {source}.
   */
  private keptChainNote(outcome: AfterPurchaseOutcome, target: Target, n: number, changed: NewerChange): void {
    const item = target.group.itemName;
    const unit = target.row.unitName ?? '';
    const boughtUnit = target.group.unitName ?? '';
    const when = whenText(changed.at, true);
    const source = sourceWords(changed.source);
    outcome.notes.push({
      code: 'PUR_PRICE_KEPT_NEWER',
      field: `lines.${n}`,
      lineNo: n,
      rule: 'CHAIN',
      message:
        `Line ${n}: ${item} ${unit} price not updated — ${item} ${boughtUnit} was changed later on ${when} ` +
        `(${source}${changed.who ? `, ${changed.who}` : ''}), so its unit chain was kept too; the bill keeps its own price as history.`,
      params: { n, item, unit, boughtUnit, when, ...(changed.who ? { who: changed.who } : {}), source },
    });
  }

  /**
   * N4 (user 2026-11-26: cost only) — one SCHEDULED row of a key takes the key's new cost: its
   * prices stay as scheduled, so its markups are recomputed (price wins) with the tax of its own
   * start day; min price, R.Off and Profit Type are kept. Logged with `origin`. Null when its cost
   * is that cost already (nothing written).
   */
  private async moveScheduledRow(
    tx: Tx,
    args: {
      ipmId: string;
      /** `YYYY-MM-DD` — the row's start day. */
      from: string;
      lineNo: number;
      key: { itemId: string; uomId: string; mrp: number | null; salePrice: number | null };
      cost: RowCost;
      costPair: { costRate: number; costWot: number };
      companyId: string;
      actor: string;
      origin: PriceWriteOrigin;
    },
  ): Promise<{ applied: AppliedBucketPrice; before: NonNullable<PurchaseOldPriceEntry['before']> } | null> {
    const before = (await this.gateway.rowFigures(tx, [args.ipmId])).get(args.ipmId);
    if (
      !before ||
      (dp6(D(before.cost)).equals(dp6(D(args.costPair.costRate))) && dp6(D(before.costWot)).equals(dp6(D(args.costPair.costWot))))
    ) {
      return null;
    }
    const taxRates = await this.bulk.resolveItemTaxRates(tx, [args.key.itemId], new Date(`${args.from}T00:00:00.000Z`));
    const dto = {
      lineNo: args.lineNo,
      itemId: args.key.itemId,
      uomId: args.key.uomId,
      bucketId: args.ipmId,
      mrp: args.key.mrp,
      salePrice: args.key.salePrice,
      levels: before.prices
        .map((price, index) => ({ level: index + 1, price: n6(D(price)) }))
        .filter((level) => level.price > 0),
      costPrice: args.costPair.costRate,
    } as unknown as SaveSellingPriceRowDto;
    const candidate = this.bulk.toCandidate(dto, 0, args.companyId, args.actor, taxRates, args.cost, {
      keepCost: () => args.costPair,
    });
    const snapshot = await this.priceGateway.snapshotRows(tx, [args.ipmId]);
    await this.writer.updateBucketPrice(tx, args.ipmId, candidate, args.origin);
    return {
      applied: { ipmId: args.ipmId, before: snapshot.get(args.ipmId) ?? null, lineNo: args.lineNo, itemName: candidate.itemName },
      before,
    };
  }

  /**
   * N4 on the purchase view's save — after P1's write, each saved key's scheduled rows (locked
   * with the rows by lockTargets) take the cost the save gave that key. Logged as menu 30, reason
   * "From purchase PI-… (dd-MM-yyyy) · scheduled from dd-MM-yyyy"; one audit row each. Not in
   * pii_old_prices: saves from the view stay at Cancel.
   */
  private async moveScheduledOfSave(tx: Tx, prepared: PreparedBulkSave, reason: string): Promise<void> {
    const applied: AppliedBucketPrice[] = [];
    const scopes: Array<'CHAIN' | 'BRANCH'> = [];
    const labels: string[] = [];
    for (const row of prepared.futureRows ?? []) {
      const candidate = prepared.candidates[row.index];
      if (!candidate) {
        continue;
      }
      const moved = await this.moveScheduledRow(tx, {
        ipmId: row.ipmId,
        from: row.effectiveFrom,
        lineNo: candidate.lineNo,
        key: { itemId: candidate.itemId, uomId: candidate.uomId, mrp: candidate.mrp, salePrice: candidate.salePrice },
        cost: prepared.costs[row.index],
        costPair: { costRate: candidate.costRate, costWot: candidate.costWot },
        companyId: candidate.companyId,
        actor: prepared.actor,
        origin: { ...PRICE_ORIGIN.CHANGE_SELLING_PRICE, reason: `${reason} · scheduled from ${displayDate(row.effectiveFrom)}` },
      });
      if (moved) {
        applied.push(moved.applied);
        const scope = prepared.resolutions[row.index].targetScope;
        scopes.push(scope);
        labels.push(`${scope === 'CHAIN' ? 'all branches' : 'this branch'}, scheduled from ${displayDate(row.effectiveFrom)}`);
      }
    }
    if (applied.length) {
      await this.bulk.auditWrites(tx, applied, {
        actor: prepared.actor,
        confirmedBelowCost: [],
        scopes,
        writer: reason,
        scopeLabels: labels,
      });
    }
  }

  /** §4.8 — PUR_PRICE_BELOW_NEW_COST: a price now under the cost (kept, or written under allow). */
  private belowNewCostNote(
    outcome: AfterPurchaseOutcome,
    target: Target,
    n: number,
    level: number,
    cost: Dec,
    price: Dec,
    levelNames: ReadonlyMap<number, string>,
  ): void {
    const name = levelNames.get(level) ?? `Price ${'ABCD'[level - 1]}`;
    const item = target.group.itemName;
    const unit = target.row.unitName ?? '';
    outcome.notes.push({
      code: 'PUR_PRICE_BELOW_NEW_COST',
      field: `lines.${n}`,
      lineNo: n,
      message: `Line ${n}: ${name} ${money(price)} of ${item} ${unit} is now below the cost ${money(cost)}. Check it on Change Selling Price.`,
      params: { n, level: name, price: money(price), item, unit, cost: money(cost) },
    });
  }

  /** Each bill line's result (its groups' strongest) and its pii_old_prices (on a group's first line). */
  private finishOutcome(
    outcome: AfterPurchaseOutcome,
    lines: readonly StepBillLine[],
    groups: readonly BoughtGroup[],
    groupResult: ReadonlyMap<string, PurchasePriceResult>,
    groupEntries: ReadonlyMap<string, PurchaseOldPriceEntry[]>,
  ): AfterPurchaseOutcome {
    for (const line of lines) {
      const mine = groups.filter((group) => group.lines.includes(line));
      const result = strongestResult(mine.map((group) => groupResult.get(group.id) ?? 'NONE'));
      const entries = mine
        .filter((group) => group.lines[0] === line)
        .flatMap((group) => groupEntries.get(group.id) ?? []);
      outcome.lines.set(line.piiId, { result, oldPrices: entries });
    }
    return outcome;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Cancel's put-back (§4.9, Q7)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * In the cancel transaction: each price row the post wrote (pii_old_prices) goes back to its
   * figures before the bill when it still matches the token it was written with (an UPDATE is
   * put back, a CREATE soft-deleted); a row changed since is kept and said. Logged source
   * PURCHASE (reason "Purchase PI-… cancelled — back to before"), one audit row each. Saves made
   * on menu 30 from the bill stay (one note when a PRICES_REVIEWED step exists).
   */
  async undo(
    tx: Tx,
    args: { piId: string; accYear: string; refno: string; actor: string },
  ): Promise<PurchasePriceNote[]> {
    const lines = await this.gateway.readLines(tx, args.piId, args.accYear);
    const seen = new Set<string>();
    const entries: Array<{ entry: PurchaseOldPriceEntry; lineNo: number }> = [];
    for (const line of lines) {
      for (const entry of oldPricesOf(line.oldPrices)) {
        if (!seen.has(entry.ipmId)) {
          seen.add(entry.ipmId);
          entries.push({ entry, lineNo: line.lineNo });
        }
      }
    }
    const notes: PurchasePriceNote[] = [];
    if (entries.length) {
      const states = await this.gateway.lockRowStates(tx, entries.map(({ entry }) => entry.ipmId));
      const origin: PriceWriteOrigin = {
        source: 'PURCHASE',
        menuId: PRICE_MENU_ID.PURCHASE_ENTRY,
        reason: `Purchase ${args.refno} cancelled — back to before`,
      };
      let restored = 0;
      let restoredScheduled = 0;
      for (const { entry, lineNo } of entries) {
        const state = states.get(entry.ipmId);
        const untouched = state && !state.isDeleted && state.token === entry.afterToken;
        if (!untouched) {
          if (state?.isDeleted && entry.action === 'CREATE') {
            continue; // the row it made is already gone: nothing to put back
          }
          const last = await this.gateway.lastChange(tx, entry.ipmId);
          const when = last ? whenText(last.at, false) : null;
          const source = last ? sourceWords(last.source) : null;
          const unit = entry.unitName ?? '';
          // S4 — {when} {who} {source} of the change that kept it (E5); N4 — a scheduled row: rule=SCHEDULED, {from}.
          const from = entry.scheduledFrom ? displayDate(entry.scheduledFrom) : null;
          notes.push({
            code: 'PUR_PRICE_KEPT_ON_CANCEL',
            field: `lines.${lineNo}`,
            lineNo,
            ...(from ? { rule: 'SCHEDULED' } : {}),
            message:
              `${entry.itemName} ${unit}${from ? ` (its price from ${from})` : ''} was changed after ${args.refno}` +
              (last ? ` (${when}${last.who ? `, ${last.who}` : ''}, ${source})` : '') +
              ': its prices were not put back.',
            params: {
              item: entry.itemName,
              unit,
              bill: args.refno,
              ...(from ? { from } : {}),
              ...(when ? { when } : {}),
              ...(last?.who ? { who: last.who } : {}),
              ...(source ? { source } : {}),
            },
          });
          continue;
        }
        const snapshotBefore = await this.priceGateway.snapshotRows(tx, [entry.ipmId]);
        if (entry.action === 'CREATE' || !entry.before) {
          await this.writer.softDeletePriceRow(tx, entry.ipmId, args.actor, origin);
        } else {
          const b = entry.before;
          await this.writer.updatePrice(tx, origin, entry.ipmId, {
            ipmCostPrice: D(b.cost),
            ipmCostWot: D(b.costWot),
            ipmSalesPriceA: D(b.prices[0]),
            ipmSalesPriceB: D(b.prices[1]),
            ipmSalesPriceC: D(b.prices[2]),
            ipmSalesPriceD: D(b.prices[3]),
            ipmPriceAWot: D(b.pricesWot[0]),
            ipmPriceBWot: D(b.pricesWot[1]),
            ipmPriceCWot: D(b.pricesWot[2]),
            ipmPriceDWot: D(b.pricesWot[3]),
            ipmPriceAMarkupPerc: D(b.markups[0]),
            ipmPriceBMarkupPerc: D(b.markups[1]),
            ipmPriceCMarkupPerc: D(b.markups[2]),
            ipmPriceDMarkupPerc: D(b.markups[3]),
            ipmMinPrice: D(b.min),
            ipmMaxPrice: D(b.max),
            ipmProfitType: b.profitType,
            ipmRoundOff: D(b.roundOff),
            ipmUpdatedOn: new Date(),
            ipmUpdatedBy: /^[0-9a-f-]{36}$/i.test(args.actor) ? args.actor : null,
          });
        }
        const after = await this.priceGateway.snapshotRows(tx, [entry.ipmId]);
        await this.auditLogService.logEntityChange(
          {
            action: entry.action === 'CREATE' ? 'cancel' : 'update',
            tableName: 'item price master',
            screenName: 'Item Price Master',
            screenType: 'master',
            pk: entry.ipmId,
            displayName: `${entry.itemName} ${entry.unitName ?? ''}`.trim(),
            originalRecord: snapshotBefore.get(entry.ipmId) ?? null,
            modifiedRecord: after.get(entry.ipmId) ?? null,
            userId: args.actor,
            notes: `Purchase ${args.refno} cancelled — back to before`,
          },
          tx,
        );
        restored += 1;
        if (entry.scheduledFrom) {
          restoredScheduled += 1;
        }
      }
      if (restored) {
        // S4 — rule=ONE words the single line ("1 price line went back …"); `scheduled` (N4) counts
        // the scheduled rows among them, only when there is one.
        notes.unshift({
          code: 'PUR_PRICE_RESTORED',
          field: 'header',
          lineNo: null,
          ...(restored === 1 ? { rule: 'ONE' } : {}),
          message: `Prices put back: ${restored} price line${restored === 1 ? '' : 's'} went back to their figures before ${args.refno}.`,
          params: { count: restored, bill: args.refno, ...(restoredScheduled ? { scheduled: restoredScheduled } : {}) },
        });
      }
    }
    const reviewed = await this.gateway.lastStep(tx, args.piId, args.accYear, TxnStatusEvent.PRICES_REVIEWED);
    if (reviewed) {
      notes.push({
        code: 'PUR_PRICE_REVIEW_KEPT',
        field: 'header',
        lineNo: null,
        message: 'Prices saved on Change Selling Price from this bill stay as they are.',
        params: { bill: args.refno },
      });
    }
    return notes;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  The bill's afterPurchase block (§7.4)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * `data.afterPurchase` of the purchase invoice answers: the mode, the line results, the review
   * state, and whether the CALLER can open the bill's prices on menu 30 (POSTED, mode not NONE,
   * Edit on 30 AND View on 24 — review N3, as the GET needs both —, a line still the latest
   * purchase). latestLines is worked out live on the bill's items only (the targets less the
   * LATER_BILL ones).
   */
  async afterPurchaseState(piId: string, accYear: string): Promise<AfterPurchaseState> {
    return (await this.afterPurchaseView(piId, accYear)).state;
  }

  /**
   * afterPurchaseState plus, review N5, each bill line's OWN later bill (B5 live, as laterBill:
   * the newest later POSTED bill among that line's bought keys; its chain units do not count),
   * keyed by pii_id — the purchase invoice GET puts it on `lines[].laterBill`. A line with none,
   * and every line of a bill that is not POSTED or is NONE, has no entry.
   */
  async afterPurchaseView(
    piId: string,
    accYear: string,
  ): Promise<{ state: AfterPurchaseState; lineLaterBills: Map<string, NonNullable<AfterPurchaseState['laterBill']>> }> {
    const db = this.prisma as unknown as Tx;
    const bill = await this.gateway.readBill(db, piId, accYear);
    const lines = bill ? await this.gateway.readLines(db, piId, accYear) : [];
    const mode = purchasePriceModeOf(bill?.policy);
    const results = Object.fromEntries(PURCHASE_PRICE_RESULTS.map((r) => [r, 0])) as Record<PurchasePriceResult, number>;
    for (const line of lines) {
      const r = (line.result ?? '') as PurchasePriceResult;
      if (r in results) {
        results[r] += 1;
      }
    }
    const entries = lines.flatMap((line) => oldPricesOf(line.oldPrices));
    const inForce = entries.filter((entry) => !entry.scheduledFrom);
    const reviewed = bill ? await this.gateway.lastStep(db, piId, accYear, TxnStatusEvent.PRICES_REVIEWED) : null;
    let latestLines = 0;
    let canOpen = false;
    let laterBill: AfterPurchaseState['laterBill'] = null;
    const lineLaterBills = new Map<string, NonNullable<AfterPurchaseState['laterBill']>>();
    if (bill && bill.status === 'POSTED' && mode !== 'NONE') {
      const isHq = isHqUserType(this.requestContext.getUserType());
      const { targets } = await this.resolveTargets(db, bill, lines, { isHq, withSpread: false });
      await this.applyLater(db, bill, targets);
      latestLines = targets.filter((target) => !target.later).length;
      const asAnswer = (line: LaterLine) => ({ piId: line.piId, refno: line.refno, docDate: `${line.docDate}T00:00:00.000Z` });
      // The bill's own lines (not their chain units) that a later bill overtakes: the newest such bill.
      const bought = targets.filter((t) => t.kind !== 'CHAIN');
      const newest = newestLater(bought.map((t) => t.later));
      laterBill = newest ? asAnswer(newest) : null;
      // N5 — and per bill line, the newest later bill of ITS bought keys (the chip names the right one).
      for (const line of lines) {
        const own = newestLater(bought.filter((t) => t.group.lines.includes(line)).map((t) => t.later));
        if (own) {
          lineLaterBills.set(line.piiId, asAnswer(own));
        }
      }
      const userId = this.requestContext.getUserId();
      if (userId) {
        const [edit, view] = await Promise.all([
          loadRights(db, userId, PRICE_MENU_ID.CHANGE_SELLING_PRICE),
          loadRights(db, userId, PRICE_MENU_ID.PURCHASE_ENTRY),
        ]);
        canOpen = edit.edit && view.view && latestLines > 0;
      }
    }
    return {
      state: {
        mode,
        results,
        toReview: results.TO_REVIEW,
        latestLines,
        canOpen,
        reviewedOn: reviewed?.on ?? null,
        reviewedBy: reviewed?.by ?? null,
        pricesPending: mode === 'OPEN_CHANGE_SELLING' && results.TO_REVIEW > 0 && !reviewed,
        moved: {
          rows: inForce.length,
          chain: inForce.filter((entry) => entry.kind === 'CHAIN').length,
          created: inForce.filter((entry) => entry.action === 'CREATE').length,
          scheduled: entries.length - inForce.length,
        },
        laterBill,
      },
      lineLaterBills,
    };
  }
}

/** B5's "later" order — (doc date, doc datetime, id) — the newest of these later bills, or null. */
export function newestLater(later: ReadonlyArray<LaterLine | null>): LaterLine | null {
  let best: LaterLine | null = null;
  for (const line of later) {
    if (!line) {
      continue;
    }
    const newer =
      !best ||
      line.docDate > best.docDate ||
      (line.docDate === best.docDate &&
        (line.docDatetime.getTime() > best.docDatetime.getTime() ||
          (line.docDatetime.getTime() === best.docDatetime.getTime() && line.piId > best.piId)));
    if (newer) {
      best = line;
    }
  }
  return best;
}

/** The proposal's source of a level ('KEPT' when the proposal has none). */
function proposalFrom(proposal: { levels: ProposedLevel[] }, level: number): ProposedLevel['from'] {
  return proposal.levels.find((entry) => entry.level === level)?.from ?? 'KEPT';
}

/** pii_old_prices as entries (anything else is none). */
function oldPricesOf(value: unknown): PurchaseOldPriceEntry[] {
  return Array.isArray(value)
    ? (value.filter((entry) => entry && typeof entry === 'object' && typeof (entry as { ipmId?: unknown }).ipmId === 'string') as PurchaseOldPriceEntry[])
    : [];
}

/** The price log's source in the words a note uses. */
function sourceWords(source: string): string {
  const words: Record<string, string> = {
    CHANGE_SELLING_PRICE: 'Change Selling Price',
    ITEM_CARD: 'item card',
    QTY_PRICE: 'Qty-wise Prices',
    PURCHASE: 'a purchase',
    BULK_COST_CHANGE: 'Cost Price – Bulk Change',
    IMPORT: 'import',
    BUCKET_REKEY: 'item card',
  };
  return words[source] ?? source;
}

/**
 * B5 — the latest later line of the same item whose key matches per base unit (MRP / sale price
 * when the item tracks it; any for a plain item), at the branch when one is named (C4).
 * `later` is ordered latest first.
 */
export function laterMatch(
  later: readonly LaterLine[],
  probe: {
    itemId: string;
    trackMrp: boolean;
    trackSalePrice: boolean;
    mrp: Dec | null;
    salePrice: Dec | null;
    factor: Dec;
    branchId: string | null;
  },
): LaterLine | null {
  const mrp = probe.trackMrp ? keyPerBase(probe.mrp, probe.factor) : null;
  const sp = probe.trackSalePrice ? keyPerBase(probe.salePrice, probe.factor) : null;
  return (
    later.find(
      (line) =>
        line.itemId === probe.itemId &&
        (probe.branchId === null || line.branchId.toLowerCase() === probe.branchId.toLowerCase()) &&
        (!probe.trackMrp || sameKey(keyPerBase(line.mrp, line.factor), mrp)) &&
        (!probe.trackSalePrice || sameKey(keyPerBase(line.salePrice, line.factor), sp)),
    ) ?? null
  );
}

/**
 * D16's match (plan §4.5), shared by the post and the view's changedSince (S3): the latest logged
 * change of THE line — same item, unit and key — and a company-less change (ipcl_company_id NULL)
 * only against a company-less line.
 */
export function changeOf(
  newer: readonly NewerChange[],
  target: { group: { itemId: string }; row: { uomId: string }; mrp: Dec | null; salePrice: Dec | null },
  companyLess: boolean,
): NewerChange | null {
  return (
    newer.find(
      (c) =>
        c.itemId === target.group.itemId &&
        c.unitId === target.row.uomId &&
        (c.companyNull !== true || companyLess) &&
        sameKey(D(c.keyMrp).equals(-1) ? null : D(c.keyMrp), target.mrp) &&
        sameKey(D(c.keySp).equals(-1) ? null : D(c.keySp), target.salePrice),
    ) ?? null
  );
}

/** A moment as ISO text with +05:30 (as the trail's postedOn / reviewedOn). */
export function istIso(at: Date): string {
  return `${new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 19)}+05:30`;
}

/**
 * D16's business time of a bill (the post's own rule, purchase-invoice.service): its POSTED moment
 * when posted on its own day, else the end of its day (a late entry). `posted.on` is the trail's
 * ISO +05:30 text (its day), `posted.at` the exact moment (else `on`, to the second); none → the
 * end of the day.
 */
export function businessTimeOf(docDate: string, posted: { on: string; at?: Date } | null): Date {
  return posted && posted.on.slice(0, 10) === docDate
    ? (posted.at ?? new Date(posted.on))
    : new Date(`${docDate}T23:59:59.999+05:30`);
}

/** A log time in a note's words: `26-11-2026 07:13 PM` (withYear) or `26-11 07:13 PM`. */
function whenText(at: Date, withYear: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    ...(withYear ? { year: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(at)
    .replace(/\//g, '-')
    .replace(',', '')
    .toUpperCase();
}

/**
 * §7.3 — whether a save row is one of the bill's: its item is on the bill and its key (per base
 * unit, Q5 / Q12) is one the bill bought — the bought key itself, or a chain unit of it (a plain
 * item's key is the item: every unit). `cost` is the row's RowCost (the policy and the unit factor
 * at the bill's branch); `row.mrp` / `row.salePrice` its key after the policy blanked it.
 * `costed` — only a key the bill paid for (a landed cost above 0; free goods alone have none).
 */
function isBillKey(
  lines: readonly StepBillLine[],
  row: { itemId: string; mrp: number | null; salePrice: number | null },
  cost: Pick<RowCost, 'trackMrp' | 'trackSalePrice' | 'unitFactor'>,
  opts: { costed?: boolean } = {},
): boolean {
  const factor = D(cost.unitFactor ?? 1);
  const mrp = cost.trackMrp ? keyPerBase(row.mrp === null ? null : D(row.mrp), factor) : null;
  const sp = cost.trackSalePrice ? keyPerBase(row.salePrice === null ? null : D(row.salePrice), factor) : null;
  return lines.some(
    (line) =>
      line.itemId === row.itemId &&
      (!opts.costed || line.landedCostWot.greaterThan(0)) &&
      line.portions.some(
        (p) =>
          sameKey(cost.trackMrp ? keyPerBase(p.mrp, line.factor) : null, mrp) &&
          sameKey(cost.trackSalePrice ? keyPerBase(p.salePrice, line.factor) : null, sp),
      ),
  );
}

/** exclusion_violation — as a typed error (P2002-style) or a raw query's P2010 with meta.code. */
function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const e = error as { code?: unknown; meta?: { code?: unknown; message?: unknown }; message?: unknown };
  return (
    e.code === '23P01' ||
    e.meta?.code === '23P01' ||
    (typeof e.meta?.message === 'string' && e.meta.message.includes('ex_ipm_overlap')) ||
    (typeof e.message === 'string' && e.message.includes('ex_ipm_overlap'))
  );
}

/**
 * Review N1 — an INSERT of a price line inside a savepoint: when another writer made the same line
 * first (ex_ipm_overlap, 23P01), the savepoint is rolled back and null comes back (the caller says
 * KEPT_NEWER), so the post goes on instead of failing with a 500. Anything else is rethrown.
 */
async function insertOrYield<T>(tx: Tx, write: () => Promise<T>): Promise<T | null> {
  await tx.$executeRaw`SAVEPOINT csp_price_insert`;
  try {
    const done = await write();
    await tx.$executeRaw`RELEASE SAVEPOINT csp_price_insert`;
    return done;
  } catch (error) {
    if (!isExclusionViolation(error)) {
      throw error;
    }
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT csp_price_insert`;
    return null;
  }
}
