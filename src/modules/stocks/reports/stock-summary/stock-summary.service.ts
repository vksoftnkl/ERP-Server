import { GoneException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import {
  assertMenuRight,
  RIGHT_COLUMN,
  type MenuRight,
  type MenuRights,
} from '../../../../common/posting/rights';
import {
  buildErrorResponse,
  throwForbidden,
  throwUnprocessable,
} from '../../../../common/utils/module-shared.utils';
import { resolveItemTaxRates } from '../../../Inventory/utils/item-tax-rate.helper';
import { trackedAsOf } from '../../cost-price-bulk/cost-price-bulk.rules';
import { dayBefore, isRealIsoDate } from '../item-ledger/item-ledger.rules';
import { openingSql, summarySql, type LedgerSqlScope } from '../item-ledger/item-ledger.sql';
import {
  byTypeOf,
  summaryOf,
  type AggRow,
  type OpeningRow,
} from '../item-ledger/item-ledger.service';
import {
  itemValuationSql,
  valueInScope,
  type ValuedHoldingRow,
} from '../common/stock-valuation.sql';
import type {
  StockSummaryBranchesDto,
  StockSummaryExportDto,
  StockSummaryGodownsDto,
  StockSummaryGroupsDto,
  StockSummaryItemDto,
  StockSummaryOptionsDto,
  StockSummaryQueryDto,
  StockSummaryRowsDto,
  StockSummaryScopeDto,
  StockSummaryViewDto,
} from './dto/stock-summary-query.dto';
import {
  StockSummaryRunStore,
  type BranchRunData,
  type ItemRunData,
  type StoredRun,
} from './stock-summary-run.store';
import {
  balanceNowSql,
  branchesNowSql,
  branchesReplaySql,
  companyBranchesSql,
  factsSql,
  lastPurchaseSql,
  lastSaleSql,
  lotNamesSql,
  lotsNowSql,
  passSql,
  rowsAfterSql,
  transitNowSql,
  transitReplaySql,
  type PassPartRow,
  type SummarySqlScope,
} from './stock-summary.sql';
import {
  D0,
  DEFAULT_NO_SALE_DAYS,
  EXPORT_ROW_CAP,
  ITEM_CAP,
  SUMMARY_BUCKET_CHOICES,
  branchTotals,
  branchView,
  buildBranchRows,
  buildItemRows,
  dec,
  drillText,
  filterItemRows,
  godownColumns,
  godownRow,
  godownTotals,
  groupRows,
  holdingInScope,
  istInstant,
  itemView,
  mergePass,
  money,
  monthStart,
  pageOf,
  printedAsOf,
  qty,
  sumValues,
  tieOfRun,
  tilesOf,
  unitOf,
  viewEcho,
  viewOf,
  type AfterRow,
  type BalanceRow,
  type BranchCellDb,
  type FactRow,
  type ItemRunRow,
  type QtyIn,
  type TransitDbRow,
  type ViewSpec,
} from './stock-summary.rules';
import {
  STOCK_SUMMARY_CODE_PREFIX,
  STOCK_SUMMARY_ERROR,
  STOCK_SUMMARY_MENU_ID,
  type BranchesHead,
  type BranchesPayload,
  type ExportPayload,
  type GodownsPayload,
  type GroupBy,
  type GroupsPayload,
  type ItemPayload,
  type LotRow,
  type OptionsPayload,
  type RowsPayload,
  type SummaryHead,
  type SummaryPayload,
  type SummaryRights,
  type TransitOut,
} from './types/stock-summary.types';

/**
 * Stock Summary (menu 302, plan 2026-11-13): item-wise opening · inward ·
 * outward · closing with value, for one branch and a period. Read-only.
 *
 * Every route checks VIEW on 302 first (403 STOCK_SUMMARY_RIGHT_VIEW; /export
 * also EXPORT, print PRINT), then refuses RANGE_REVERSED, BRANCH_NOT_IN_COMPANY,
 * GODOWN_NOT_IN_BRANCH, GROUP_NOT_FOUND, BRAND_NOT_FOUND and on /item
 * ITEM_NOT_FOUND — in that order. A Show runs every read in ONE read-only
 * REPEATABLE READ transaction (one moment's numbers) with custom plans and JIT
 * off, builds the run in `Prisma.Decimal` and keeps it in the run store
 * (D20): /rows, /groups, /godowns and /export read it with no SQL beyond the
 * rights row.
 *
 * Never calls the Item Ledger's service methods (they check menu 301): its SQL
 * fragments and pure helpers only.
 */

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 10_000,
  timeout: 120_000,
} as const;

/** Print without a live run builds one; head + rows of one render share it for this long. */
const PRINT_RUN_REUSE_MS = 60_000;

type Db = Prisma.TransactionClient;
type Dec = Prisma.Decimal;
type ItemRun = StoredRun & ItemRunData;
type BranchRun = StoredRun & BranchRunData;

/** One print build: the promise (set before it settles) and when it last settled. */
interface PrintRunEntry {
  readonly run: Promise<ItemRun>;
  at: number;
}

interface LookupRow {
  br_comp_id: string | null;
  br_name: string | null;
  br_is_deleted: boolean | null;
  comp_name: string | null;
  gdl_branch_id: string | null;
  gdl_name: string | null;
  gdl_is_deleted: boolean | null;
  itg_id: string | null;
  itg_name: string | null;
  itg_is_deleted: boolean | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_is_deleted: boolean | null;
  item_id: string | null;
  item_company_id: string | null;
  item_is_deleted: boolean | null;
}

/** Everything a Show needs once the refusals have passed. */
interface Resolved {
  sql: SummarySqlScope;
  companyName: string | null;
  branchName: string | null;
  godownName: string | null;
  groupName: string | null;
  brandName: string | null;
  bucket: string;
  valueAt: 'WITHOUT_TAX' | 'WITH_TAX';
  qtyIn: QtyIn;
  noSaleDays: number;
}

interface Moment {
  today: string;
  at: string;
}

@Injectable()
export class StockSummaryService {
  /**
   * Print renders without a run id: one build per (user, prompts) for a minute.
   * The promise is stored before it settles, so the head and rows datasets of
   * one render share a build still running (review S1).
   */
  private readonly printRuns = new Map<string, PrintRunEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly runs: StockSummaryRunStore,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  /options
  // ═════════════════════════════════════════════════════════════════════════

  async options(q: StockSummaryOptionsDto): Promise<OptionsPayload> {
    const rights = await this.assertView();
    return this.snapshot(async (db) => {
      const row = await this.lookup(db, q);
      const m = await this.moment(db);
      const godowns = await db.$queryRaw<
        { gdl_id: string; gdl_name: string; gdl_short: string | null }[]
      >`
        SELECT gdl_id, gdl_name, NULLIF(btrim(gdl_short), '') AS gdl_short
          FROM inventory.godown_locations
         WHERE gdl_branch_id = ${q.branchId}::uuid AND gdl_is_deleted = false
         ORDER BY gdl_sort NULLS LAST, lower(gdl_name), gdl_id`;
      const fy = await this.fiscalYear(db, q.companyId, m.today);
      return {
        company: { companyId: q.companyId, name: row.comp_name },
        branch: { branchId: q.branchId, name: row.br_name },
        godowns: godowns.map((g) => ({ godownId: g.gdl_id, name: g.gdl_name, short: g.gdl_short })),
        buckets: [...SUMMARY_BUCKET_CHOICES],
        today: m.today,
        fy,
        defaults: {
          from: monthStart(m.today),
          to: m.today,
          bucket: 'SALEABLE',
          valueAt: 'WITHOUT_TAX',
          qtyIn: 'BASE',
          hideZero: true,
          onlyNegative: false,
          noSaleDays: DEFAULT_NO_SALE_DAYS,
        },
        rights: rightsOf(rights),
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  GET /stock/reports/summary — Show: compute the run, answer page 1
  // ═════════════════════════════════════════════════════════════════════════

  async show(q: StockSummaryQueryDto): Promise<SummaryPayload> {
    const rights = await this.assertView();
    assertRange(q.from, q.to);
    const view = viewOf(q);
    const run = await this.buildItemsRun(q, rights, view.hideZero);
    return this.itemsAnswer(run, view);
  }

  /** The Show's answer for a run (also the /rows of page 1). */
  private itemsAnswer(run: ItemRun, view: ViewSpec): SummaryPayload {
    const shown = itemView(run.rows, view);
    const { slice, page } = pageOf(shown, view);
    return {
      head: this.headNow(run),
      tiles: run.tiles,
      totals: { rows: run.rows.length, rowsShown: shown.length, ...sumValues(run.rows) },
      totalsShown: { rows: shown.length, ...sumValues(shown) },
      tie: run.tie,
      transitOut: run.transitOut,
      rows: slice.map((r) => r.wire),
      page,
      view: viewEcho(view),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  /rows, /groups, /godowns — views of a run, no SQL
  // ═════════════════════════════════════════════════════════════════════════

  async rows(q: StockSummaryRowsDto): Promise<RowsPayload> {
    await this.assertView();
    const run = this.runOf(q.runId, q.companyId);
    const view = viewOf(q);
    if (run.kind === 'ITEMS') {
      const shown = itemView(run.rows, view);
      const { slice, page } = pageOf(shown, view);
      return {
        runId: run.runId,
        kind: 'ITEMS',
        expiresAt: istInstant(this.runs.expiresAt(run)),
        rows: slice.map((r) => r.wire),
        page,
        view: viewEcho(view),
        totalsShown: { rows: shown.length, ...sumValues(shown) },
      };
    }
    const shown = branchView(run.rows, view);
    const { slice, page } = pageOf(shown, view);
    const chain = shown.reduce((s, r) => s.plus(r.chainValue), D0);
    return {
      runId: run.runId,
      kind: 'BRANCHES',
      expiresAt: istInstant(this.runs.expiresAt(run)),
      rows: slice.map((r) => r.wire),
      page,
      view: viewEcho(view),
      totalsShown: {
        rows: shown.length,
        openingValue: '0.00',
        inwardValue: '0.00',
        outwardValue: '0.00',
        costAdj: '0.00',
        closingValue: money(chain),
      },
    };
  }

  async groups(q: StockSummaryGroupsDto): Promise<GroupsPayload> {
    await this.assertView();
    const run = this.itemRunOf(q.runId, q.companyId);
    const by: GroupBy = q.groupBy ?? 'GROUP';
    const kept = filterItemRows(run.rows, {
      hideZero: q.hideZero ?? true,
      onlyNegative: q.onlyNegative ?? false,
      show: q.show ?? 'ALL',
      find: '',
      groupBy: null,
      groupKey: null,
    });
    const g = groupRows(kept, by);
    return { runId: run.runId, groupBy: by, rows: g.rows, total: g.total };
  }

  async godowns(q: StockSummaryGodownsDto): Promise<GodownsPayload> {
    await this.assertView();
    const run = this.itemRunOf(q.runId, q.companyId);
    const view = viewOf(q);
    const data = godownTab(run, view);
    const { slice, page } = pageOf(data.rows, view);
    return {
      runId: run.runId,
      godowns: data.columns,
      rows: slice.map((r) => godownRow(r, data.columns)),
      totals: godownTotals(data.rows, data.columns),
      page,
      view: viewEcho(view),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  /branches — a Branch-wise run (D21–D23)
  // ═════════════════════════════════════════════════════════════════════════

  async branches(q: StockSummaryBranchesDto): Promise<BranchesPayload> {
    const rights = await this.assertView();
    assertRange(q.from, q.to);
    const view = viewOf(q);
    const userId = this.userId();
    const built = await this.snapshot(async (db) => {
      const r = await this.resolve(db, q);
      const m = await this.moment(db);
      const todayOnly = r.sql.to >= m.today;
      const cells = await db.$queryRaw<BranchCellDb[]>(
        todayOnly ? branchesNowSql(r.sql) : branchesReplaySql(r.sql),
      );
      const transit = await db.$queryRaw<TransitDbRow[]>(
        todayOnly ? transitNowSql(r.sql, 'all') : transitReplaySql(r.sql, null),
      );
      const items = [...new Set([...cells.map((c) => c.item), ...transit.map((t) => t.item)])];
      assertItemCap(items.length);
      const facts = items.length ? await db.$queryRaw<FactRow[]>(factsSql(items)) : [];
      const all = await db.$queryRaw<{ branch_id: string; name: string }[]>(
        companyBranchesSql(r.sql.companyId),
      );
      return { r, m, todayOnly, cells, transit, facts, all };
    });
    const { r, m, todayOnly, cells, transit, facts, all } = built;
    const used = new Set(
      cells.filter((c) => !dec(c.q).isZero() || !dec(c.v).isZero()).map((c) => c.branch),
    );
    const branches = all
      .filter((b) => used.has(b.branch_id))
      .map((b) => ({ branchId: b.branch_id, name: b.name }));
    // A branch of another company never shows (the SQL reads this company's rows only).
    const leftOut = all.filter((b) => !used.has(b.branch_id)).map((b) => b.name);
    const rows = buildBranchRows({
      cells,
      transit,
      facts,
      columns: branches,
      qtyIn: r.qtyIn,
      companyId: r.sql.companyId,
    });
    const head: BranchesHead = {
      ...this.headOf(r, m, todayOnly, rights, 'BRANCHES'),
      source: todayOnly ? 'STOCK_BALANCE' : 'LEDGER',
    };
    const run = this.runs.put(userId, r.sql.companyId, {
      kind: 'BRANCHES',
      head,
      rows,
      branches,
      leftOut,
      transfers: new Set(transit.map((t) => t.out_id)).size,
    }) as BranchRun;
    head.runId = run.runId;
    return this.branchesAnswer(run, view);
  }

  private branchesAnswer(run: BranchRun, view: ViewSpec): BranchesPayload {
    const shown = branchView(run.rows, view);
    const { slice, page } = pageOf(shown, view);
    return {
      head: { ...run.head, expiresAt: istInstant(this.runs.expiresAt(run)) },
      branches: [...run.branches],
      leftOut: [...run.leftOut],
      rows: slice.map((x) => x.wire),
      totals: branchTotals(shown, run.branches, run.transfers),
      page,
      view: viewEcho(view),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  /item — the Lots & godowns and Movement panes (stateless)
  // ═════════════════════════════════════════════════════════════════════════

  async item(q: StockSummaryItemDto): Promise<ItemPayload> {
    await this.assertView();
    assertRange(q.from, q.to);
    const userId = this.userId();
    return this.snapshot(async (db) => {
      const r = await this.resolve(db, q, q.itemId);
      const m = await this.moment(db);
      const s = r.sql;
      const todayOnly = s.to >= m.today;
      const [facts] = await db.$queryRaw<FactRow[]>(factsSql([q.itemId]));
      const [extra] = await db.$queryRaw<
        { hsn: string | null; preset_name: string | null; reorder: Dec | null }[]
      >`
        SELECT NULLIF(btrim(i.item_hsn_code), '') AS hsn, spt.spt_name AS preset_name,
               (SELECT rp.srp_reorder_level * COALESCE(u.iuc_to_base_factor, 1)
                  FROM stock.stock_reorder_policy rp
                  LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = rp.srp_uom_id
                 WHERE rp.srp_company_id = ${s.companyId}::uuid AND rp.srp_branch_id = ${s.branchId}::uuid
                   AND rp.srp_item_id = i.item_id AND rp.srp_godown_id IS NULL
                   AND rp.srp_is_deleted = false AND rp.srp_is_active = true
                 ORDER BY rp.srp_modified_on DESC NULLS LAST, rp.srp_created_on DESC
                 LIMIT 1) AS reorder
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
          LEFT JOIN stock.stock_track_preset spt
                 ON spt.spt_id = COALESCE(i.item_track_preset_id, g.itg_track_preset_id)
         WHERE i.item_id = ${q.itemId}::uuid`;
      const taxes = await resolveItemTaxRates(db, [q.itemId], new Date(`${m.today}T00:00:00Z`));
      const tax = taxes.get(q.itemId);
      const [lastSale] = await db.$queryRaw<{ item: string; last_sale: string | null }[]>(
        lastSaleSql(s, [q.itemId]),
      );
      const [lastPurchase] = await db.$queryRaw<{ d: string; doc_no: string | null; rate: Dec }[]>(
        lastPurchaseSql(s, q.itemId),
      );
      const closingHold = await db.$queryRaw<ValuedHoldingRow[]>(
        itemValuationSql({
          companyId: s.companyId,
          branchId: s.branchId,
          itemId: q.itemId,
          asOf: s.to,
          wot: s.wot,
        }),
      );
      const openingHold = await db.$queryRaw<ValuedHoldingRow[]>(
        itemValuationSql({
          companyId: s.companyId,
          branchId: s.branchId,
          itemId: q.itemId,
          asOf: s.openingAsOf,
          wot: s.wot,
        }),
      );
      const scopeOf = { godownId: s.godownId, bucket: s.bucket, lotId: null };
      const closing = valueInScope(closingHold, scopeOf);
      const opening = valueInScope(openingHold, scopeOf);

      // The Movement pane = the Item Ledger's By voucher type for the same scope (D34).
      const ls: LedgerSqlScope = {
        companyId: s.companyId,
        branchId: s.branchId,
        itemId: q.itemId,
        from: s.from,
        to: s.to,
        godownId: s.godownId,
        bucket: s.bucket,
        lotId: null,
        wot: s.wot,
        withRevaluations: s.godownId === null && (s.bucket === null || s.bucket === 'SALEABLE'),
        types: [],
        showReversed: true,
      };
      const [open] = await db.$queryRaw<OpeningRow[]>(openingSql(ls, false));
      const agg = await db.$queryRaw<AggRow[]>(summarySql(ls));
      const sum = summaryOf(agg);
      const { unit, factor } = unitOf(facts, r.qtyIn);

      // Lots & godowns: stock now, or the holdings at the pool rate for a past `to`.
      let lots: ItemPayload['lots'];
      if (todayOnly) {
        const now = await db.$queryRaw<
          {
            godown_id: string;
            godown_name: string | null;
            bucket: string;
            lot_id: string;
            batch_no: string | null;
            mrp: Dec | null;
            expiry: string | null;
            supplier: string | null;
            on_hand: Dec;
            reserved: Dec;
            available: Dec;
            cost_rate: Dec;
            value: Dec;
          }[]
        >(lotsNowSql(s, q.itemId));
        lots = lotsBlock(
          'STOCK_BALANCE',
          m.today,
          now.map((x) => ({
            godownId: x.godown_id,
            godownName: x.godown_name,
            bucket: x.bucket,
            lotId: x.lot_id,
            batchNo: x.batch_no,
            mrp: x.mrp === null ? null : money(x.mrp),
            expiry: x.expiry,
            supplier: x.supplier,
            onHand: dec(x.on_hand),
            reserved: dec(x.reserved),
            available: dec(x.available),
            rate: dec(x.cost_rate),
            value: dec(x.value),
            inScope: holdingInScope({ godown: x.godown_id, bucket: x.bucket }, s),
          })),
          factor,
        );
      } else {
        const held = closingHold.filter((h) => !dec(h.q).isZero());
        const names = held.length
          ? await db.$queryRaw<
              {
                k: string;
                id: string;
                batch_no: string | null;
                mrp: Dec | null;
                expiry: string | null;
                supplier: string | null;
                name: string | null;
                sort: number | null;
              }[]
            >(
              lotNamesSql(
                [...new Set(held.map((h) => h.lot))],
                [...new Set(held.map((h) => h.godown))],
              ),
            )
          : [];
        const lot = new Map(names.filter((n) => n.k === 'L').map((n) => [n.id, n]));
        const gd = new Map(names.filter((n) => n.k === 'G').map((n) => [n.id, n]));
        const ordered = [...held].sort((a, b) => {
          const ga = gd.get(a.godown);
          const gb = gd.get(b.godown);
          return (
            (ga?.sort ?? 1e9) - (gb?.sort ?? 1e9) ||
            (ga?.name ?? '').localeCompare(gb?.name ?? '') ||
            a.bucket.localeCompare(b.bucket) ||
            (lot.get(a.lot)?.expiry ?? '9999').localeCompare(lot.get(b.lot)?.expiry ?? '9999') ||
            a.lot.localeCompare(b.lot)
          );
        });
        lots = lotsBlock(
          'LEDGER',
          s.to,
          ordered.map((h) => {
            const l = lot.get(h.lot);
            return {
              godownId: h.godown,
              godownName: gd.get(h.godown)?.name ?? null,
              bucket: h.bucket,
              lotId: h.lot,
              batchNo: l?.batch_no ?? null,
              mrp: l?.mrp === null || l?.mrp === undefined ? null : money(l.mrp),
              expiry: l?.expiry ?? null,
              supplier: l?.supplier ?? null,
              onHand: dec(h.q),
              reserved: null,
              available: null,
              rate: dec(h.rate),
              value: dec(h.value),
              inScope: holdingInScope(h, s),
            };
          }),
          factor,
        );
      }

      const ilClosingQty = dec(open.q).plus(sum.q_all);
      const valueIn = dec(sum.v_in ?? 0);
      const valueOut = dec(sum.v_out ?? 0);
      const costAdj = closing.value.minus(opening.value.plus(valueIn).minus(valueOut));
      const qtyEqual = ilClosingQty.equals(closing.qty);
      const valueEqual = dec(lots.totalInScope.value).equals(closing.value.toDecimalPlaces(2));
      let row: boolean | null = null;
      if (q.runId) {
        const run = this.runs.get(q.runId, userId, {
          companyId: s.companyId,
          kind: 'ITEMS',
        }) as ItemRun | null;
        const rr = run?.rows.find((x) => x.itemId === q.itemId);
        if (rr) {
          row = rr.num.closing.equals(ilClosingQty) && rr.vals.value.equals(closing.value);
        }
      }
      const reorder =
        extra?.reorder === null || extra?.reorder === undefined ? null : dec(extra.reorder);
      const vm = closingHold[0]?.vm ?? openingHold[0]?.vm ?? 'WAVG';
      return {
        item: {
          itemId: q.itemId,
          code: facts?.code ?? null,
          name: facts?.name ?? '',
          group: facts?.group_name ?? null,
          brand: facts?.brand_name ?? null,
          hsn: extra?.hsn ?? null,
          gstRate: tax?.taxId ? new Prisma.Decimal(tax.taxPerc).toFixed(2) : null,
          trackedAs: trackedAsOf(extra?.preset_name),
          valuation: vm,
          baseUnit: facts?.base_unit ?? '',
          unit,
          reorderLevel: reorder ? qty(reorder, factor) : null,
          belowReorder: reorder ? closing.qty.lessThan(reorder) : null,
          lastPurchase: lastPurchase
            ? {
                date: lastPurchase.d,
                docNo: lastPurchase.doc_no,
                rate: dec(lastPurchase.rate).times(factor).toFixed(2),
              }
            : null,
          lastSale: lastSale?.last_sale ?? null,
        },
        lots,
        movement: {
          opening: { date: s.from, qty: qty(open.q, factor), value: money(opening.value) },
          byType: byTypeOf(agg, factor).map((b) => ({ ...b, detail: '' })),
          totals: {
            qtyIn: qty(sum.q_in ?? 0, factor),
            qtyOut: qty(sum.q_out ?? 0, factor),
            valueIn: money(valueIn),
            valueOut: money(valueOut),
          },
          costAdj: money(costAdj),
          closing: { date: s.to, qty: qty(ilClosingQty, factor), value: money(closing.value) },
          ties: { qtyEqual, valueEqual, row },
        },
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  /export — every row of the tab on screen, no SQL
  // ═════════════════════════════════════════════════════════════════════════

  async export(q: StockSummaryExportDto): Promise<ExportPayload> {
    const rights = await this.assertView();
    this.assertAlso(rights, 'export', 'export the Stock Summary');
    if (q.tab === 'BRANCHES') {
      const run = this.runOf(q.runId, q.companyId, 'BRANCHES') as BranchRun;
      return this.exportBranches(run, viewOf(q));
    }
    const run = this.itemRunOf(q.runId, q.companyId);
    return this.exportItems(run, q.tab, viewOf(q), q.groupBy ?? null);
  }

  private exportItems(
    run: ItemRun,
    tab: 'ITEMS' | 'GROUPS' | 'GODOWNS',
    view: ViewSpec,
    groupBy: GroupBy | null,
  ): ExportPayload {
    const head = this.headNow(run);
    const printedAs = printedAsOf({
      branchName: head.branchName,
      from: head.from,
      to: head.to,
      godownName: tab === 'GODOWNS' ? null : head.godownName,
      groupName: head.groupName,
      brandName: head.brandName,
      bucket: head.bucket,
      valueAt: head.valueAt,
      qtyIn: head.qtyIn,
      hideZero: view.hideZero,
      onlyNegative: view.onlyNegative,
      show: view.show,
      find: tab === 'GROUPS' ? '' : view.find,
      drill: tab === 'GROUPS' ? null : drillText(run.rows, view.groupBy, view.groupKey),
    });
    if (tab === 'GROUPS') {
      const kept = filterItemRows(run.rows, { ...view, find: '', groupBy: null, groupKey: null });
      const g = groupRows(kept, groupBy ?? 'GROUP');
      capRows(g.rows.length);
      return {
        head,
        printedAs,
        tab,
        rows: g.rows,
        totals: g.total,
        transitOut: null,
        tie: null,
        totalRows: g.rows.length,
      };
    }
    if (tab === 'GODOWNS') {
      const data = godownTab(run, view);
      capRows(data.rows.length);
      return {
        head,
        printedAs,
        tab,
        rows: data.rows.map((r) => godownRow(r, data.columns)),
        totals: godownTotals(data.rows, data.columns),
        transitOut: null,
        tie: null,
        godowns: data.columns,
        totalRows: data.rows.length,
      };
    }
    const shown = itemView(run.rows, view);
    capRows(shown.length);
    return {
      head,
      printedAs,
      tab,
      rows: shown.map((r) => r.wire),
      totals: { rows: run.rows.length, rowsShown: shown.length, ...sumValues(shown) },
      transitOut: run.transitOut,
      tie: run.tie,
      totalRows: shown.length,
    };
  }

  private exportBranches(run: BranchRun, view: ViewSpec): ExportPayload {
    const shown = branchView(run.rows, view);
    capRows(shown.length);
    const head = { ...run.head, expiresAt: istInstant(this.runs.expiresAt(run)) };
    return {
      head,
      printedAs: printedAsOf({
        branchName: 'All branches',
        from: head.from,
        to: head.to,
        godownName: null,
        groupName: head.groupName,
        brandName: head.brandName,
        bucket: head.bucket,
        valueAt: head.valueAt,
        qtyIn: head.qtyIn,
        hideZero: view.hideZero,
        onlyNegative: view.onlyNegative,
        show: view.show,
        find: view.find,
      }),
      tab: 'BRANCHES',
      rows: shown.map((r) => r.wire),
      totals: branchTotals(shown, run.branches, run.transfers),
      transitOut: null,
      tie: null,
      branches: [...run.branches],
      totalRows: shown.length,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Print (purpose STOCK_SUMMARY) — the run by id, else a run built once
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * The Item-wise export a print render reads (§7): VIEW and PRINT on 302,
   * then the live run by `runId` (no second computation), else a run built
   * from the scope — shared by the head and the rows dataset of one render
   * for a minute, so a print computes at most once.
   */
  async printData(input: {
    runId: string | null;
    query: StockSummaryQueryDto | null;
    /** The view prompts (sort, filters, the group drill) — also when only run_id is sent. */
    view?: StockSummaryViewDto | null;
  }): Promise<ExportPayload> {
    const rights = await this.assertView();
    this.assertAlso(rights, 'print', 'print the Stock Summary');
    const userId = this.userId();
    const view = viewOf(input.view ?? input.query ?? {});
    let run: ItemRun | null = null;
    if (input.runId) {
      run = this.runs.get(input.runId, userId, { kind: 'ITEMS' }) as ItemRun | null;
    }
    if (!run && input.query) {
      run = await this.printRun(input.query, rights, view.hideZero, userId);
    }
    if (!run) return this.gone(input.runId ?? '');
    return this.exportItems(run, 'ITEMS', view, null);
  }

  /**
   * The run a print without a live run reads (review S1). The print engine
   * resolves the head and rows datasets at once (`Promise.all`), so the BUILD
   * is kept, not its result: the entry is set before the first await, and a
   * second caller with the same prompts awaits that same build — one Show
   * computation and one run in the user's 4-run cap. A refused / failed build
   * leaves no entry (both callers get its refusal; a later print tries again).
   * A run the cap evicted since is built again.
   */
  private async printRun(
    query: StockSummaryQueryDto,
    rights: MenuRights,
    hideZero: boolean,
    userId: string,
  ): Promise<ItemRun> {
    const key = `${userId}|${JSON.stringify(query)}`;
    const t = Date.now();
    for (const [k, v] of this.printRuns) {
      if (t - v.at > PRINT_RUN_REUSE_MS) this.printRuns.delete(k);
    }
    let known = this.printRuns.get(key);
    while (known) {
      const built = await known.run;
      const live = this.runs.get(built.runId, userId, { kind: 'ITEMS' }) as ItemRun | null;
      if (live) return live;
      if (this.printRuns.get(key) === known) this.printRuns.delete(key);
      known = this.printRuns.get(key);
    }
    assertRange(query.from, query.to);
    const entry: PrintRunEntry = {
      run: this.buildItemsRun(query, rights, hideZero),
      at: t,
    };
    this.printRuns.set(key, entry);
    entry.run.then(
      () => {
        entry.at = Date.now();
      },
      () => {
        if (this.printRuns.get(key) === entry) this.printRuns.delete(key);
      },
    );
    return entry.run;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Building an Item-wise run (one snapshot)
  // ═════════════════════════════════════════════════════════════════════════

  private async buildItemsRun(
    q: StockSummaryScopeDto,
    rights: MenuRights,
    hideZero: boolean,
  ): Promise<ItemRun> {
    const userId = this.userId();
    const built = await this.snapshot(async (db) => {
      const r = await this.resolve(db, q);
      const m = await this.moment(db);
      const s = r.sql;
      const todayOnly = s.to >= m.today;
      const pass = mergePass(await db.$queryRaw<PassPartRow[]>(passSql(s)));
      let balance: BalanceRow[] = [];
      let after: AfterRow[] = [];
      let transitIn: TransitDbRow[] = [];
      if (todayOnly) {
        balance = await db.$queryRaw<BalanceRow[]>(balanceNowSql(s));
        after = await db.$queryRaw<AfterRow[]>(rowsAfterSql(s));
        transitIn = await db.$queryRaw<TransitDbRow[]>(transitNowSql(s, 'in'));
      }
      // An item on the road to this branch is a row even with no ledger row here
      // ("List the item", 2026-11-14): its facts and last sale are read too.
      const items = [...new Set([...pass.map((p) => p.item), ...transitIn.map((t) => t.item)])];
      assertItemCap(items.length);
      const facts = items.length ? await db.$queryRaw<FactRow[]>(factsSql(items)) : [];
      const sales = items.length
        ? await db.$queryRaw<{ item: string; last_sale: string | null }[]>(lastSaleSql(s, items))
        : [];
      const transitOut = await db.$queryRaw<TransitDbRow[]>(
        todayOnly ? transitNowSql(s, 'out') : transitReplaySql(s, s.branchId),
      );
      // The branch's godowns, + any other a ledger row of this branch names (test data
      // holds rows on another branch's godown): every Godown-wise column has a name.
      const godownIds = [...new Set(pass.map((p) => p.godown))];
      const godowns = await db.$queryRaw<{ gdl_id: string; gdl_name: string }[]>`
        SELECT gdl_id, gdl_name
          FROM inventory.godown_locations
         WHERE gdl_branch_id = ${s.branchId}::uuid OR gdl_id = ANY(${godownIds}::uuid[])
         ORDER BY (gdl_branch_id = ${s.branchId}::uuid) DESC, gdl_is_deleted, gdl_sort NULLS LAST,
                  lower(gdl_name), gdl_id`;
      return {
        r,
        m,
        todayOnly,
        pass,
        facts,
        sales,
        balance,
        after,
        transitIn,
        transitOut,
        godowns,
      };
    });
    const { r, m, todayOnly } = built;
    const rows = buildItemRows({
      scope: {
        companyId: r.sql.companyId,
        godownId: r.sql.godownId,
        bucket: r.sql.bucket,
        qtyIn: r.qtyIn,
        to: r.sql.to,
        today: m.today,
        todayOnly,
        noSaleDays: r.noSaleDays,
      },
      pass: built.pass,
      facts: built.facts,
      lastSale: new Map(built.sales.map((x) => [x.item, x.last_sale])),
      balance: built.balance,
      after: built.after,
      transitIn: built.transitIn,
    });
    const head = this.headOf(r, m, todayOnly, rights, 'ITEMS');
    const run = this.runs.put(userId, r.sql.companyId, {
      kind: 'ITEMS',
      head,
      tiles: tilesOf(rows, todayOnly, hideZero),
      tie: tieOfRun(rows, todayOnly),
      transitOut: transitOutOf(built.transitOut, todayOnly),
      rows,
      branchGodowns: built.godowns.map((g) => ({ godownId: g.gdl_id, name: g.gdl_name })),
    }) as ItemRun;
    head.runId = run.runId;
    return run;
  }

  private headOf(
    r: Resolved,
    m: Moment,
    todayOnly: boolean,
    rights: MenuRights,
    kind: 'ITEMS' | 'BRANCHES',
  ): SummaryHead {
    return {
      runId: '',
      kind,
      asOf: m.at,
      expiresAt: '',
      companyId: r.sql.companyId,
      companyName: r.companyName,
      branchId: r.sql.branchId,
      branchName: r.branchName,
      from: r.sql.from,
      to: r.sql.to,
      todayOnly,
      godownId: r.sql.godownId,
      godownName: r.godownName,
      groupId: r.sql.groupId,
      groupName: r.groupName,
      brandId: r.sql.brandId,
      brandName: r.brandName,
      bucket: r.bucket,
      valueAt: r.valueAt,
      qtyIn: r.qtyIn,
      noSaleDays: r.noSaleDays,
      rights: rightsOf(rights),
    };
  }

  private headNow(run: ItemRun): SummaryHead {
    return { ...run.head, expiresAt: istInstant(this.runs.expiresAt(run)) };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The guards, the snapshot and the lookups
  // ═════════════════════════════════════════════════════════════════════════

  private userId(): string {
    return this.requestContext.getUserId() ?? '';
  }

  /** 403 STOCK_SUMMARY_RIGHT_VIEW unless the caller may view menu 302 — on every route. */
  private assertView(): Promise<MenuRights> {
    return assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: STOCK_SUMMARY_MENU_ID,
      right: 'view',
      codePrefix: STOCK_SUMMARY_CODE_PREFIX,
      action: 'open the Stock Summary',
    });
  }

  /** A second right on the rights VIEW already loaded (EXPORT / PRINT) — same refusal shape. */
  private assertAlso(rights: MenuRights, right: MenuRight, action: string): void {
    if (rights[right]) return;
    const message =
      `This user may not ${action} (menu ${STOCK_SUMMARY_MENU_ID}: ` +
      `${RIGHT_COLUMN[right]} is not granted)`;
    throwForbidden(message, [
      {
        field: 'userId',
        message,
        code: `${STOCK_SUMMARY_CODE_PREFIX}_RIGHT_${right.toUpperCase()}`,
      },
    ]);
  }

  private gone(runId: string): never {
    const message =
      'This report run is gone (expired, restarted, another user’s, or another tab’s). Show again.';
    throw new GoneException(
      buildErrorResponse('Stock Summary run expired', [
        { field: 'runId', message: `${message} (${runId})`, code: STOCK_SUMMARY_ERROR.RUN_EXPIRED },
      ]),
    );
  }

  /** The caller's run, or 410. */
  private runOf(
    runId: string,
    companyId?: string,
    kind?: 'ITEMS' | 'BRANCHES',
  ): ItemRun | BranchRun {
    const run = this.runs.get(runId, this.userId(), { companyId: companyId ?? null, kind });
    if (!run) this.gone(runId);
    return run;
  }

  /** An Item-wise run (Group summary, Godown-wise, Item-wise export), or 410. */
  private itemRunOf(runId: string, companyId?: string): ItemRun {
    return this.runOf(runId, companyId, 'ITEMS') as ItemRun;
  }

  private snapshot<T>(work: (db: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      // `= ANY($ids)` and the optional scopes: a generic plan after five runs is seconds, not ms.
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      await tx.$executeRaw`SET LOCAL jit = off`;
      return work(tx);
    }, TX_OPTIONS);
  }

  /** Today in IST and the snapshot's moment as an IST instant. */
  private async moment(db: Db): Promise<Moment> {
    const [row] = await db.$queryRaw<{ d: string; at: string }[]>`
      SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d,
             to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS at`;
    return { today: row.d, at: row.at };
  }

  private async fiscalYear(
    db: Db,
    companyId: string,
    on: string,
  ): Promise<{ name: string; begin: string; end: string } | null> {
    const [fy] = await db.$queryRaw<{ name: string; begin: string; end: string }[]>`
      SELECT btrim(fy_year_name) AS name, fy_begin_date::text AS begin, fy_end_date::text AS "end"
        FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND ${on}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC
       LIMIT 1`;
    return fy ?? null;
  }

  /**
   * One round trip for every id the query names, then the refusals in §5's
   * order: BRANCH_NOT_IN_COMPANY, GODOWN_NOT_IN_BRANCH, GROUP_NOT_FOUND,
   * BRAND_NOT_FOUND, ITEM_NOT_FOUND. A deleted branch / godown is refused as
   * not in the company / branch (review N7), as a deleted group / brand is.
   * Any company (Q2): no check of the user against it, as the Item Ledger.
   */
  private async lookup(
    db: Db,
    q: StockSummaryOptionsDto & { godownId?: string; groupId?: string; brandId?: string },
    itemId: string | null = null,
  ): Promise<LookupRow> {
    const [row] = await db.$queryRaw<LookupRow[]>`
      SELECT b.br_comp_id, b.br_name, b.br_is_deleted, c.comp_name,
             g.gdl_branch_id, g.gdl_name, g.gdl_is_deleted,
             gr.itg_id, gr.itg_name, gr.itg_is_deleted,
             bd.brand_id, bd.brand_name, bd.brand_is_deleted,
             i.item_id, i.item_company_id, i.item_is_deleted
        FROM (SELECT 1) x
        LEFT JOIN public.branch_master b ON b.br_id = ${q.branchId}::uuid
        LEFT JOIN public.companys c ON c.comp_id = ${q.companyId}::uuid
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = ${q.godownId ?? null}::uuid
        LEFT JOIN inventory.item_group_master gr ON gr.itg_id = ${q.groupId ?? null}::uuid
        LEFT JOIN inventory.item_brand_master bd ON bd.brand_id = ${q.brandId ?? null}::uuid
        LEFT JOIN inventory.item_master i ON i.item_id = ${itemId}::uuid`;
    if (!row.br_comp_id || row.br_comp_id !== q.companyId || row.br_is_deleted === true) {
      refuse(
        STOCK_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY,
        'branchId',
        'That branch is not part of this company.',
      );
    }
    if (q.godownId && (row.gdl_branch_id !== q.branchId || row.gdl_is_deleted === true)) {
      refuse(
        STOCK_SUMMARY_ERROR.GODOWN_NOT_IN_BRANCH,
        'godownId',
        'That godown is not in this branch.',
      );
    }
    if (q.groupId && (!row.itg_id || row.itg_is_deleted === true)) {
      refuse(STOCK_SUMMARY_ERROR.GROUP_NOT_FOUND, 'groupId', 'That item group is not there now.');
    }
    if (q.brandId && (!row.brand_id || row.brand_is_deleted === true)) {
      refuse(STOCK_SUMMARY_ERROR.BRAND_NOT_FOUND, 'brandId', 'That brand is not there now.');
    }
    if (
      itemId &&
      (!row.item_id ||
        row.item_is_deleted === true ||
        (row.item_company_id !== null && row.item_company_id !== q.companyId))
    ) {
      refuse(
        STOCK_SUMMARY_ERROR.ITEM_NOT_FOUND,
        'itemId',
        'This item is not there now, or it belongs to another company.',
      );
    }
    return row;
  }

  private async resolve(
    db: Db,
    q: Omit<StockSummaryScopeDto, 'godownId'> & { godownId?: string },
    itemId: string | null = null,
  ): Promise<Resolved> {
    const row = await this.lookup(db, q, itemId);
    const bucket = q.bucket ?? 'SALEABLE';
    const valueAt = q.valueAt ?? 'WITHOUT_TAX';
    return {
      sql: {
        companyId: q.companyId,
        branchId: q.branchId,
        from: q.from,
        to: q.to,
        openingAsOf: dayBefore(q.from),
        godownId: q.godownId ?? null,
        bucket: bucket === 'ALL' ? null : bucket,
        groupId: q.groupId ?? null,
        brandId: q.brandId ?? null,
        wot: valueAt === 'WITHOUT_TAX',
      },
      companyName: row.comp_name,
      branchName: row.br_name,
      godownName: q.godownId ? row.gdl_name : null,
      groupName: q.groupId ? row.itg_name : null,
      brandName: q.brandId ? row.brand_name : null,
      bucket,
      valueAt,
      qtyIn: q.qtyIn ?? 'BASE',
      noSaleDays: q.noSaleDays ?? DEFAULT_NO_SALE_DAYS,
    };
  }
}

// ── helpers (pure; exported for the specs) ─────────────────────────────────

function refuse(code: string, field: string, message: string): never {
  throwUnprocessable('Stock Summary request refused', [{ field, message, code }]);
}

/** RANGE_REVERSED — the DTO already holds both to calendar dates. */
export function assertRange(from: string, to: string): void {
  if (!isRealIsoDate(from) || !isRealIsoDate(to) || from > to) {
    refuse(STOCK_SUMMARY_ERROR.RANGE_REVERSED, 'from', `${from} is after ${to}.`);
  }
}

export function assertItemCap(items: number): void {
  if (items > ITEM_CAP) {
    throwUnprocessable('Stock Summary request refused', [
      {
        field: 'groupId',
        code: STOCK_SUMMARY_ERROR.TOO_MANY_ITEMS,
        message: `${items} items — one Show takes up to ${ITEM_CAP}. Pick a group or a brand.`,
      },
    ]);
  }
}

export function capRows(n: number): void {
  if (n > EXPORT_ROW_CAP) {
    throwUnprocessable('Stock Summary request refused', [
      {
        field: 'runId',
        code: STOCK_SUMMARY_ERROR.TOO_MANY_ROWS,
        message: `${n} rows — Print and Excel take up to ${EXPORT_ROW_CAP}. Pick a group or a brand.`,
      },
    ]);
  }
}

function rightsOf(rights: MenuRights): SummaryRights {
  return { print: rights.print, export: rights.export };
}

/** D21 — the goods this branch sent that are still on the road. */
export function transitOutOf(rows: readonly TransitDbRow[], todayOnly: boolean): TransitOut {
  let value = D0;
  const transfers = new Map<string, { docNo: string | null; toBranch: string | null }>();
  const items = new Set<string>();
  for (const t of rows) {
    value = value.plus(t.v);
    items.add(t.item);
    if (!transfers.has(t.out_id)) {
      transfers.set(t.out_id, { docNo: t.doc_no, toBranch: t.to_branch_name });
    }
  }
  return {
    checked: true,
    source: todayOnly ? 'STOCK_TRANSIT' : 'LEDGER',
    transfers: transfers.size,
    items: items.size,
    value: money(value),
    docs: [...transfers.values()].sort((a, b) => (a.docNo ?? '').localeCompare(b.docNo ?? '')),
  };
}

/**
 * The Godown-wise tab (SS-19): the view's filters and sort, the Godown filter
 * ignored (this tab IS the split); Hide zero looks at the godown cells.
 */
export function godownTab(
  run: {
    rows: readonly ItemRunRow[];
    branchGodowns: readonly { godownId: string; name: string }[];
  },
  view: ViewSpec,
): { columns: { godownId: string; name: string }[]; rows: ItemRunRow[] } {
  const columns = godownColumns(run.rows, run.branchGodowns);
  const shown = itemView(run.rows, { ...view, hideZero: false }).filter(
    (r) => !view.hideZero || r.godowns.some((g) => !g.qty.isZero() || !g.value.isZero()),
  );
  return { columns, rows: shown };
}

interface LotIn {
  godownId: string;
  godownName: string | null;
  bucket: string;
  lotId: string;
  batchNo: string | null;
  mrp: string | null;
  expiry: string | null;
  supplier: string | null;
  onHand: Dec;
  reserved: Dec | null;
  available: Dec | null;
  rate: Dec;
  value: Dec;
  inScope: boolean;
}

export function lotsBlock(
  source: 'STOCK_BALANCE' | 'LEDGER',
  asOf: string,
  rows: readonly LotIn[],
  factor: Dec,
): ItemPayload['lots'] {
  let onHand = D0;
  let reserved = D0;
  let available = D0;
  let value = D0;
  for (const r of rows) {
    if (!r.inScope) continue;
    onHand = onHand.plus(r.onHand);
    reserved = reserved.plus(r.reserved ?? D0);
    available = available.plus(r.available ?? D0);
    value = value.plus(r.value);
  }
  const live = source === 'STOCK_BALANCE';
  // In-scope holdings first (as the Item Ledger's Stock now), the given order kept within.
  const ordered = [...rows.filter((r) => r.inScope), ...rows.filter((r) => !r.inScope)];
  const out: LotRow[] = ordered.map((r) => ({
    godownId: r.godownId,
    godownName: r.godownName,
    bucket: r.bucket,
    lotId: r.lotId,
    batchNo: r.batchNo,
    mrp: r.mrp,
    expiry: r.expiry,
    supplier: r.supplier,
    onHand: qty(r.onHand, factor),
    reserved: r.reserved === null ? null : qty(r.reserved, factor),
    available: r.available === null ? null : qty(r.available, factor),
    costRate: dec(r.rate).times(factor).toFixed(2),
    value: money(r.value),
    inScope: r.inScope,
  }));
  return {
    source,
    asOf,
    rows: out,
    totalInScope: {
      onHand: qty(onHand, factor),
      reserved: live ? qty(reserved, factor) : null,
      available: live ? qty(available, factor) : null,
      value: money(value),
    },
  };
}
