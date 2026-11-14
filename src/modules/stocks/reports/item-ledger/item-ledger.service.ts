import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import { assertMenuRight, type MenuRights } from '../../../../common/posting/rights';
import { throwUnprocessable } from '../../../../common/utils/module-shared.utils';
import { AppSettingValueService } from '../../../settings/appSettings/app-setting-value.service';
import { readSalesSettings } from '../../../sales/posting/sales.settings';
import { resolveItemTaxRates } from '../../../Inventory/utils/item-tax-rate.helper';
import { trackedAsOf } from '../../cost-price-bulk/cost-price-bulk.rules';
import {
  itemValuationSql,
  valueInScope,
  type ValuedHoldingRow,
} from '../common/stock-valuation.sql';
import {
  ITEM_LEDGER_DEFAULT_LIMIT,
  type ItemLedgerExportDto,
  type ItemLedgerMonthsDto,
  type ItemLedgerOptionsDto,
  type ItemLedgerQueryDto,
  type ItemLedgerScopeDto,
} from './dto/item-ledger-query.dto';
import {
  REPORT_TYPES,
  bucketLabel,
  byTypeLabel,
  dayBefore,
  dec,
  docKindOf,
  isRealIsoDate,
  money,
  monthEnd,
  monthLabel,
  monthsBetween,
  partyOf,
  printedAsOf,
  qtyIn,
  rateOf,
  reportTypeOf,
  reportTypeOrder,
  revisionOf,
  rowTypeLabel,
  tileLabel,
  transitText,
  type ReportType,
  type ValueAt,
} from './item-ledger.rules';
import {
  openingSql,
  optionTypesSql,
  pageSql,
  periodSql,
  revaluationsLeftOutSql,
  stockNowSql,
  summarySql,
  type LedgerSqlScope,
} from './item-ledger.sql';
import {
  ITEM_LEDGER_CODE_PREFIX,
  ITEM_LEDGER_ERROR,
  ITEM_LEDGER_MENU_ID,
  type ByTypeRow,
  type ClosingBlock,
  type DaysPayload,
  type ExportPayload,
  type FyRef,
  type LedgerPayload,
  type LedgerRow,
  type LedgerTiles,
  type LedgerTotals,
  type MonthsPayload,
  type OpeningBlock,
  type OptionsPayload,
  type PairClass,
  type PeriodTie,
  type ReportHead,
  type ReportRights,
  type RowKind,
  type RowState,
  type StockNowBlock,
  type TieCheck,
  type TileDocs,
} from './types/item-ledger.types';

/**
 * Item Ledger (menu 301, plan 2026-11-11): every movement of one item at one
 * branch, in posting order, with the running balance from a true opening.
 * Read-only — it writes nothing.
 *
 * Every route checks VIEW on 301 first (403 ITEM_LEDGER_RIGHT_VIEW), then
 * refuses RANGE_REVERSED, BRANCH_NOT_IN_COMPANY, ITEM_NOT_FOUND,
 * GODOWN_NOT_IN_BRANCH, LOT_NOT_OF_ITEM, UNIT_NOT_OF_ITEM — in that order.
 * The reads of one response run in ONE read-only REPEATABLE READ transaction
 * (one moment's numbers), with custom plans only and JIT off: the chain's
 * cost estimate crosses the JIT threshold on the dev box and compiling it
 * took ~330 ms of a ~30 ms query.
 */

export const EXPORT_ROW_CAP = 20_000;
const DOC_NO_CAP = 50;
const LOT_CAP = 500;

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 10_000,
  timeout: 60_000,
} as const;

type Db = Prisma.TransactionClient;
type Dec = Prisma.Decimal;
type Num = Dec | string | number;

/** Everything a route needs once the refusals have passed. */
export interface ResolvedScope {
  sql: LedgerSqlScope;
  companyName: string | null;
  branchName: string | null;
  itemCode: string | null;
  itemName: string;
  godownName: string | null;
  batchNo: string | null;
  bucket: string;
  valueAt: ValueAt;
  unit: { unitId: string | null; name: string; factor: Dec; isBase: boolean };
}

interface ScopeLookupRow {
  br_comp_id: string | null;
  br_name: string | null;
  comp_name: string | null;
  item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  item_company_id: string | null;
  item_is_deleted: boolean | null;
  gdl_branch_id: string | null;
  gdl_name: string | null;
  slt_item_id: string | null;
  slt_batch_no: string | null;
  iuc_item_id: string | null;
  iuc_is_deleted: boolean | null;
  iuc_to_base_factor: Dec | null;
  iuc_is_base_unit: boolean | null;
  unit_name: string | null;
  base_iuc_id: string | null;
  base_unit_name: string | null;
}

export interface OpeningRow {
  q: Dec;
  v: Dec;
  lots: number;
  rv: Dec;
  after_q: Dec;
}

export interface AggRow {
  part: 'S' | 'B' | 'T' | 'C';
  rtype: string | null;
  cls: string | null;
  kind: string | null;
  ob: string | null;
  doc_no: string | null;
  kinds: string[] | null;
  n_all: number;
  n_shown: number;
  docs: number;
  n_internal: number;
  n_pairs: number;
  n_reval: number;
  q_all: Dec;
  v_all: Dec;
  q_in: Dec | null;
  q_out: Dec | null;
  v_in: Dec | null;
  v_out: Dec | null;
  moved: Dec | null;
  pair_q: Dec | null;
}

export interface PageRow {
  seq: number;
  row_id: string;
  src_kind: 'L' | 'R';
  src_module: string | null;
  src_type: string | null;
  doc_id: string;
  src_year: string | null;
  is_rev: boolean;
  internal: boolean;
  gtxn: string;
  rtype: string;
  kind: RowKind;
  state: RowState;
  amended: boolean;
  nets_zero: boolean;
  d: string;
  t_doc: string | null;
  t_post: string | null;
  posted_at: string | null;
  o_posted_at: string | null;
  r_posted_at: string | null;
  refno: string | null;
  o_refno: string | null;
  sq: Dec;
  sv: Dec;
  gq: Dec;
  gv: Dec;
  fq: Dec;
  moved: Dec;
  doc_amt: Dec | null;
  bq: Dec;
  run_q: Dec;
  run_v: Dec;
  gdown: string | null;
  gdown_name: string | null;
  from_godown: string | null;
  from_godown_name: string | null;
  to_godown: string | null;
  to_godown_name: string | null;
  other_godown: string | null;
  other_godown_name: string | null;
  gbucket: string | null;
  from_bucket: string | null;
  to_bucket: string | null;
  other_bucket: string | null;
  lot: string | null;
  batch_no: string | null;
  expiry: string | null;
  by_login: string | null;
  r_by_login: string | null;
  narration: string | null;
  r_narr: string | null;
  voucher_type: string | null;
  voucher_refno: string | null;
  link_type: string | null;
  link_id: string | null;
  link_year: string | null;
  voucher_branch: string | null;
  to_branch: string | null;
  remarks: string | null;
  reason_name: string | null;
  to_branch_name: string | null;
  from_branch_name: string | null;
  sb_cust_id: string | null;
  sb_cust_name: string | null;
  party_id: string | null;
  party_name: string | null;
  pi_supplier_inv_no: string | null;
  grn_supplier_inv_no: string | null;
  transit_status: string | null;
  transit_received_on: string | null;
}

export interface StockNowDbRow {
  godown_id: string;
  godown_name: string | null;
  bucket: string;
  lot_id: string;
  batch_no: string | null;
  expiry: string | null;
  on_hand: Dec;
  reserved: Dec;
  transit_in: Dec;
  cost_rate: Dec;
  value: Dec;
  in_scope: boolean;
}

interface PeriodDbRow {
  k: string;
  docs: number;
  n: number;
  q_all: Dec;
  v_all: Dec;
  q_in: Dec;
  q_out: Dec;
  v_in: Dec;
  v_out: Dec;
}

/** P2-IL — the closing value by the engine's rule, and the in-scope rows dated after `to`. */
export interface EngineClosing {
  value: Dec;
  rowsAfter: number;
}

/** The walk-in customer (sales.default_customer_id) and its ledger name. */
export interface WalkIn {
  id: string | null;
  name: string | null;
}

@Injectable()
export class ItemLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly appSettings: AppSettingValueService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  /options — the item facts and the More-filters choices
  // ═════════════════════════════════════════════════════════════════════════

  async options(q: ItemLedgerOptionsDto): Promise<OptionsPayload> {
    const rights = await this.assertView();
    return this.snapshot(async (db) => {
      await this.lookupScope(db, q);
      const today = await this.today(db);
      const [facts] = await db.$queryRaw<
        {
          item_id: string;
          item_code: string | null;
          item_name: string;
          group_name: string | null;
          brand_name: string | null;
          hsn: string | null;
          is_service: boolean | null;
          preset_name: string | null;
          base_unit_name: string | null;
        }[]
      >`
        SELECT i.item_id, NULLIF(btrim(i.item_code), '') AS item_code, i.item_name_en AS item_name,
               g.itg_name AS group_name, br.brand_name, NULLIF(btrim(i.item_hsn_code), '') AS hsn,
               i.item_is_service AS is_service, spt.spt_name AS preset_name,
               um.unit_name AS base_unit_name
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
          LEFT JOIN inventory.item_brand_master br ON br.brand_id = i.item_brand_id
          LEFT JOIN stock.stock_track_preset spt
                 ON spt.spt_id = COALESCE(i.item_track_preset_id, g.itg_track_preset_id)
          LEFT JOIN inventory.item_unit_master um ON um.unit_id = i.item_base_unit_id
         WHERE i.item_id = ${q.itemId}::uuid`;
      const units = await db.$queryRaw<
        { iuc_id: string; unit_name: string | null; factor: Dec; is_base: boolean }[]
      >`
        SELECT u.iuc_id, m.unit_name, u.iuc_to_base_factor AS factor,
               COALESCE(u.iuc_is_base_unit, false) AS is_base
          FROM inventory.item_unit_conversion u
          LEFT JOIN inventory.item_unit_master m ON m.unit_id = u.iuc_unit_id
         WHERE u.iuc_item_id = ${q.itemId}::uuid AND u.iuc_is_deleted = false
         ORDER BY u.iuc_unit_slno NULLS LAST, u.iuc_to_base_factor DESC, u.iuc_id`;
      const [reorder] = await db.$queryRaw<{ lvl: Dec }[]>`
        SELECT r.srp_reorder_level * COALESCE(u.iuc_to_base_factor, 1) AS lvl
          FROM stock.stock_reorder_policy r
          LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = r.srp_uom_id
         WHERE r.srp_company_id = ${q.companyId}::uuid AND r.srp_branch_id = ${q.branchId}::uuid
           AND r.srp_item_id = ${q.itemId}::uuid AND r.srp_godown_id IS NULL
           AND r.srp_is_deleted = false AND r.srp_is_active = true
         ORDER BY r.srp_modified_on DESC NULLS LAST, r.srp_created_on DESC
         LIMIT 1`;
      const godowns = await db.$queryRaw<
        { gdl_id: string; gdl_name: string; gdl_short: string | null }[]
      >`
        SELECT gdl_id, gdl_name, NULLIF(btrim(gdl_short), '') AS gdl_short
          FROM inventory.godown_locations
         WHERE gdl_branch_id = ${q.branchId}::uuid AND gdl_is_deleted = false
         ORDER BY gdl_sort NULLS LAST, lower(gdl_name), gdl_id`;
      const lots = await db.$queryRaw<
        {
          lot_id: string;
          batch_no: string | null;
          expiry: string | null;
          mrp: Dec | null;
          on_hand: Dec;
        }[]
      >`
        WITH ll AS (
          SELECT DISTINCT l.sml_lot_id AS lot
            FROM stock.stock_ledger l
           WHERE l.sml_company_id = ${q.companyId}::uuid AND l.sml_branch_id = ${q.branchId}::uuid
             AND l.sml_item_id = ${q.itemId}::uuid AND l.sml_is_deleted = false)
        SELECT lt.slt_id AS lot_id, NULLIF(btrim(lt.slt_batch_no), '') AS batch_no,
               lt.slt_expiry_date::text AS expiry, lt.slt_mrp AS mrp,
               COALESCE((SELECT SUM(b.sbl_on_hand_qty) FROM stock.stock_balance b
                          WHERE b.sbl_company_id = ${q.companyId}::uuid
                            AND b.sbl_branch_id = ${q.branchId}::uuid
                            AND b.sbl_item_id = ${q.itemId}::uuid
                            AND b.sbl_lot_id = lt.slt_id AND b.sbl_is_deleted = false), 0) AS on_hand
          FROM ll JOIN stock.stock_lot lt ON lt.slt_id = ll.lot
         ORDER BY lt.slt_expiry_date DESC NULLS LAST, lt.slt_batch_no NULLS LAST, lt.slt_id
         LIMIT ${LOT_CAP}`;
      const typeRows = await db.$queryRaw<
        {
          txn: string;
          src_type: string | null;
          has_branch_out: boolean;
          has_godown_out: boolean;
          is_reval: boolean;
        }[]
      >(optionTypesSql(q.companyId, q.branchId, q.itemId));
      const [count] = await db.$queryRaw<{ d: string | null }[]>`
        SELECT MAX(v.svh_doc_date)::text AS d
          FROM stock.stock_voucher_item i
          JOIN stock.stock_voucher v ON v.svh_id = i.svi_voucher_id AND v.svh_acc_year = i.svi_acc_year
         WHERE i.svi_company_id = ${q.companyId}::uuid AND i.svi_branch_id = ${q.branchId}::uuid
           AND i.svi_item_id = ${q.itemId}::uuid AND i.svi_is_deleted = false
           AND v.svh_voucher_type = 'PHYSICAL' AND v.svh_status = 'POSTED' AND v.svh_is_deleted = false`;
      const fy = await this.fiscalYear(db, q.companyId, today);
      const taxes = await resolveItemTaxRates(db, [q.itemId], new Date(`${today}T00:00:00Z`));
      const tax = taxes.get(q.itemId);

      const types = new Map<string, { type: string; label: string; kind: RowKind | 'MIXED' }>();
      for (const t of typeRows) {
        const codes: string[] = t.is_reval
          ? ['REVALUED']
          : t.txn === 'TRANSFER_OUT' && t.src_type === 'TRANSFER_OUT'
            ? [
                ...(t.has_branch_out ? ['BRANCH_OUT'] : []),
                ...(t.has_godown_out ? ['GODOWN_TRANSFER'] : []),
              ]
            : [reportTypeOf(t.txn, t.src_type)];
        for (const code of codes) {
          const def = REPORT_TYPES[code as ReportType];
          types.set(code, { type: code, label: def?.label ?? code, kind: def?.kind ?? 'MIXED' });
        }
      }
      const base = units.find((u) => u.is_base);
      return {
        item: {
          itemId: facts.item_id,
          code: facts.item_code,
          name: facts.item_name,
          group: facts.group_name,
          brand: facts.brand_name,
          hsn: facts.hsn,
          gstRate: tax?.taxId ? new Prisma.Decimal(tax.taxPerc).toFixed(2) : null,
          trackedAs: trackedAsOf(facts.preset_name),
          isService: facts.is_service ?? false,
          baseUnit: {
            unitId: base?.iuc_id ?? null,
            name: base?.unit_name ?? facts.base_unit_name ?? '',
          },
          units: units.map((u) => ({
            unitId: u.iuc_id,
            name: u.unit_name ?? '',
            factor: dec(u.factor).toFixed(6),
            isBase: u.is_base,
          })),
          reorderLevel: reorder ? dec(reorder.lvl).toFixed(3) : null,
        },
        godowns: godowns.map((g) => ({ godownId: g.gdl_id, name: g.gdl_name, short: g.gdl_short })),
        lots: lots.map((l) => ({
          lotId: l.lot_id,
          batchNo: l.batch_no,
          expiry: l.expiry,
          mrp: l.mrp === null ? null : money(l.mrp),
          onHand: dec(l.on_hand).toFixed(3),
        })),
        types: [...types.values()].sort(
          (a, b) => reportTypeOrder(a.type) - reportTypeOrder(b.type),
        ),
        lastCountDate: count?.d ?? null,
        fy,
        rights: rightsOf(rights),
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  GET /stock/reports/item-ledger — the Vouchers tab, both panes, the tiles
  // ═════════════════════════════════════════════════════════════════════════

  async ledger(q: ItemLedgerQueryDto): Promise<LedgerPayload> {
    const rights = await this.assertView();
    assertRange(q.from, q.to);
    const walkIn = await this.walkIn(q.companyId, q.branchId);
    const order = q.order ?? 'asc';
    const page = q.page ?? 1;
    const limit = q.limit ?? ITEM_LEDGER_DEFAULT_LIMIT;
    return this.snapshot(async (db) => {
      const scope = await this.resolveScope(db, q);
      const today = await this.today(db);
      const tieChecked = scope.sql.to >= today;
      const [open] = await db.$queryRaw<OpeningRow[]>(openingSql(scope.sql, tieChecked));
      const agg = await db.$queryRaw<AggRow[]>(summarySql(scope.sql));
      const rows = await db.$queryRaw<PageRow[]>(
        pageSql(scope.sql, { order, limit, offset: (page - 1) * limit }),
      );
      const stock = await db.$queryRaw<StockNowDbRow[]>(stockNowSql(scope.sql));
      const leftOut = await this.revaluationsLeftOut(db, scope);
      const walk = await this.walkInName(db, walkIn);
      const engine = await this.engineClosing(db, scope, tieChecked);
      const s = summaryOf(agg);
      const f = scope.unit.factor;
      const opening = openingBlock(scope, open);
      const closing = closingBlock(scope, open, s, engine.value);
      const stockNow = stockNowBlock(today, stock, f);
      return {
        head: headOf(scope, { order, rights, leftOut, showReversed: scope.sql.showReversed }),
        opening,
        closing,
        totals: totalsOf(s, f),
        tiles: tilesOf(agg),
        tie: tieOf(tieChecked, open, s, stock, f, engine),
        periodTie: periodTieOf(open, s),
        rows: rows.map((r) => toRow(r, scope, walk, openingBase(open))),
        page: {
          page,
          limit,
          totalRows: s.n_shown,
          hasMore: (page - 1) * limit + rows.length < s.n_shown,
        },
        byType: byTypeOf(agg, f),
        stockNow,
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  /days — one row per day with movement
  // ═════════════════════════════════════════════════════════════════════════

  async days(q: ItemLedgerScopeDto): Promise<DaysPayload> {
    const rights = await this.assertView();
    assertRange(q.from, q.to);
    return this.snapshot(async (db) => {
      const scope = await this.resolveScope(db, q);
      const [open] = await db.$queryRaw<OpeningRow[]>(openingSql(scope.sql, false));
      const agg = await db.$queryRaw<AggRow[]>(summarySql(scope.sql));
      const rows = await db.$queryRaw<PeriodDbRow[]>(periodSql(scope.sql, 'day'));
      const leftOut = await this.revaluationsLeftOut(db, scope);
      const engine = await this.engineClosing(db, scope, false);
      const s = summaryOf(agg);
      const f = scope.unit.factor;
      let runQ = dec(open.q);
      let runV = dec(open.v).plus(open.rv);
      return {
        head: headOf(scope, {
          order: 'asc',
          rights,
          leftOut,
          showReversed: scope.sql.showReversed,
        }),
        opening: openingBlock(scope, open),
        closing: closingBlock(scope, open, s, engine.value),
        days: rows.map((r) => {
          const openingQty = runQ;
          runQ = runQ.plus(r.q_all);
          runV = runV.plus(r.v_all);
          return {
            date: r.k,
            docs: r.docs,
            openingQty: qtyIn(openingQty, f),
            receivedQty: qtyIn(r.q_in, f),
            issuedQty: qtyIn(r.q_out, f),
            closingQty: qtyIn(runQ, f),
            valueIn: money(r.v_in),
            valueOut: money(r.v_out),
            closingValue: money(runV),
          };
        }),
        totals: totalsOf(s, f),
        periodTie: periodTieOf(open, s),
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  /months — the financial year of `to`, month by month
  // ═════════════════════════════════════════════════════════════════════════

  async months(q: ItemLedgerMonthsDto): Promise<MonthsPayload> {
    const rights = await this.assertView();
    return this.snapshot(async (db) => {
      // The scope refusals first, as on every other route; then the year.
      const row = await this.lookupScope(db, q);
      const fy = await this.fiscalYear(db, q.companyId, q.to);
      if (!fy) {
        refuse(
          ITEM_LEDGER_ERROR.NO_FISCAL_YEAR,
          'to',
          `${q.to} is outside every financial year of this company.`,
        );
      }
      const scope = scopeOf(row, { ...q, from: fy.begin });
      const [open] = await db.$queryRaw<OpeningRow[]>(openingSql(scope.sql, false));
      const rows = await db.$queryRaw<PeriodDbRow[]>(periodSql(scope.sql, 'month'));
      const leftOut = await this.revaluationsLeftOut(db, scope);
      const f = scope.unit.factor;
      const byMonth = new Map(rows.map((r) => [r.k, r]));
      const all = monthsBetween(fy.begin, q.to);
      let runQ = dec(open.q);
      let runV = dec(open.v).plus(open.rv);
      let docs = 0;
      let inward = dec(0);
      let outward = dec(0);
      const months = all.map((m, i) => {
        const r = byMonth.get(m);
        const openingQty = runQ;
        runQ = runQ.plus(r?.q_all ?? 0);
        runV = runV.plus(r?.v_all ?? 0);
        docs += r?.docs ?? 0;
        inward = inward.plus(r?.q_in ?? 0);
        outward = outward.plus(r?.q_out ?? 0);
        return {
          month: m,
          label: monthLabel(m),
          docs: r?.docs ?? 0,
          openingQty: qtyIn(openingQty, f),
          inwardQty: qtyIn(r?.q_in ?? 0, f),
          outwardQty: qtyIn(r?.q_out ?? 0, f),
          closingQty: qtyIn(runQ, f),
          valueIn: money(r?.v_in ?? 0),
          valueOut: money(r?.v_out ?? 0),
          closingValue: money(runV),
          partial: i === all.length - 1 && q.to < monthEnd(m),
        };
      });
      return {
        head: headOf(scope, {
          order: 'asc',
          rights,
          leftOut,
          showReversed: scope.sql.showReversed,
        }),
        fy,
        opening: openingBlock(scope, open),
        months,
        yearToDate: {
          docs,
          inwardQty: qtyIn(inward, f),
          outwardQty: qtyIn(outward, f),
          closingQty: qtyIn(runQ, f),
          closingValue: money(runV),
        },
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  /export — every row, for Excel (CSV) and the A4 print
  // ═════════════════════════════════════════════════════════════════════════

  async export(q: ItemLedgerExportDto): Promise<ExportPayload> {
    const rights = await this.assertView();
    assertRange(q.from, q.to);
    const walkIn = await this.walkIn(q.companyId, q.branchId);
    const order = q.order ?? 'asc';
    return this.snapshot(async (db) => {
      const scope = await this.resolveScope(db, q);
      const [open] = await db.$queryRaw<OpeningRow[]>(openingSql(scope.sql, false));
      const agg = await db.$queryRaw<AggRow[]>(summarySql(scope.sql));
      const s = summaryOf(agg);
      if (s.n_shown > EXPORT_ROW_CAP) {
        throwUnprocessable('Item Ledger request refused', [
          {
            field: 'to',
            code: ITEM_LEDGER_ERROR.TOO_MANY_ROWS,
            count: s.n_shown,
            message: `${s.n_shown} rows — Print and Excel take up to ${EXPORT_ROW_CAP}. Pick a shorter period.`,
          },
        ]);
      }
      const rows = await db.$queryRaw<PageRow[]>(
        pageSql(scope.sql, { order, limit: EXPORT_ROW_CAP, offset: 0 }),
      );
      const leftOut = await this.revaluationsLeftOut(db, scope);
      const walk = await this.walkInName(db, walkIn);
      const engine = await this.engineClosing(db, scope, false);
      const head = headOf(scope, { order, rights, leftOut, showReversed: scope.sql.showReversed });
      return {
        head,
        printedAs: printedAsOf({
          itemName: [scope.itemCode, scope.itemName].filter(Boolean).join(' '),
          branchName: scope.branchName,
          from: scope.sql.from,
          to: scope.sql.to,
          godownName: scope.godownName,
          bucket: scope.bucket,
          batchNo: scope.batchNo,
          unitName: scope.unit.name,
          valueAt: scope.valueAt,
          types: scope.sql.types,
          showReversed: scope.sql.showReversed,
        }),
        opening: openingBlock(scope, open),
        closing: closingBlock(scope, open, s, engine.value),
        totals: totalsOf(s, scope.unit.factor),
        rows: rows.map((r) => toRow(r, scope, walk, openingBase(open))),
        totalRows: rows.length,
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  The guards, the snapshot and the lookups
  // ═════════════════════════════════════════════════════════════════════════

  /** 403 ITEM_LEDGER_RIGHT_VIEW unless the caller may view menu 301 — on every route. */
  private assertView(): Promise<MenuRights> {
    return assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: ITEM_LEDGER_MENU_ID,
      right: 'view',
      codePrefix: ITEM_LEDGER_CODE_PREFIX,
      action: 'open the Item Ledger',
    });
  }

  private snapshot<T>(work: (db: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      // `$x IS NULL OR …` / `= ANY($ids)`: a generic plan after five runs is seconds, not ms.
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      await tx.$executeRaw`SET LOCAL jit = off`;
      return work(tx);
    }, TX_OPTIONS);
  }

  /** Today in IST, whatever the database server's or the session's time zone. */
  private async today(db: Db): Promise<string> {
    const [row] = await db.$queryRaw<{ d: string }[]>`
      SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d`;
    return row.d;
  }

  private async fiscalYear(db: Db, companyId: string, on: string): Promise<FyRef | null> {
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
   * order: BRANCH_NOT_IN_COMPANY, ITEM_NOT_FOUND, GODOWN_NOT_IN_BRANCH,
   * LOT_NOT_OF_ITEM, UNIT_NOT_OF_ITEM.
   */
  private async lookupScope(
    db: Db,
    q: ItemLedgerOptionsDto & { godownId?: string; lotId?: string; unitId?: string },
  ): Promise<ScopeLookupRow> {
    const [row] = await db.$queryRaw<ScopeLookupRow[]>`
      SELECT b.br_comp_id, b.br_name, c.comp_name,
             i.item_id, NULLIF(btrim(i.item_code), '') AS item_code, i.item_name_en AS item_name,
             i.item_company_id, i.item_is_deleted,
             g.gdl_branch_id, g.gdl_name,
             lt.slt_item_id, NULLIF(btrim(lt.slt_batch_no), '') AS slt_batch_no,
             u.iuc_item_id, u.iuc_is_deleted, u.iuc_to_base_factor, u.iuc_is_base_unit,
             um.unit_name,
             bu.iuc_id AS base_iuc_id, bum.unit_name AS base_unit_name
        FROM (SELECT 1) x
        LEFT JOIN public.branch_master b ON b.br_id = ${q.branchId}::uuid
        LEFT JOIN public.companys c ON c.comp_id = ${q.companyId}::uuid
        LEFT JOIN inventory.item_master i ON i.item_id = ${q.itemId}::uuid
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = ${q.godownId ?? null}::uuid
        LEFT JOIN stock.stock_lot lt ON lt.slt_id = ${q.lotId ?? null}::uuid
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = ${q.unitId ?? null}::uuid
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
        LEFT JOIN LATERAL (
          SELECT x.iuc_id, x.iuc_unit_id
            FROM inventory.item_unit_conversion x
           WHERE x.iuc_item_id = ${q.itemId}::uuid AND x.iuc_is_base_unit = true
             AND x.iuc_is_deleted = false
           ORDER BY x.iuc_unit_slno NULLS LAST, x.iuc_id
           LIMIT 1) bu ON true
        LEFT JOIN inventory.item_unit_master bum ON bum.unit_id = COALESCE(bu.iuc_unit_id, i.item_base_unit_id)`;
    if (!row.br_comp_id || row.br_comp_id !== q.companyId) {
      refuse(
        ITEM_LEDGER_ERROR.BRANCH_NOT_IN_COMPANY,
        'branchId',
        'That branch is not part of this company.',
      );
    }
    if (
      !row.item_id ||
      row.item_is_deleted === true ||
      (row.item_company_id !== null && row.item_company_id !== q.companyId)
    ) {
      refuse(
        ITEM_LEDGER_ERROR.ITEM_NOT_FOUND,
        'itemId',
        'This item is not there now, or it belongs to another company.',
      );
    }
    if (q.godownId && row.gdl_branch_id !== q.branchId) {
      refuse(
        ITEM_LEDGER_ERROR.GODOWN_NOT_IN_BRANCH,
        'godownId',
        'That godown is not in this branch.',
      );
    }
    if (q.lotId && row.slt_item_id !== q.itemId) {
      refuse(ITEM_LEDGER_ERROR.LOT_NOT_OF_ITEM, 'lotId', 'That batch is not one of this item’s.');
    }
    if (q.unitId && (row.iuc_item_id !== q.itemId || row.iuc_is_deleted !== false)) {
      refuse(
        ITEM_LEDGER_ERROR.UNIT_NOT_OF_ITEM,
        'unitId',
        'That unit is not one of this item’s units.',
      );
    }
    return row;
  }

  private async resolveScope(
    db: Db,
    q: ItemLedgerMonthsDto & { from: string },
  ): Promise<ResolvedScope> {
    return scopeOf(await this.lookupScope(db, q), q);
  }

  /**
   * P2-IL (Stock Summary Q3) — the closing value by the stock engine's rule:
   * every holding of the item at the branch up to `to` (all godowns, buckets,
   * lots: the pool needs them), valued at its pool rate, summed over the
   * scope (godown, bucket, lot). `rowsAfter` (only for the tie) counts the
   * in-scope rows dated after `to`: with any, stock_balance's value includes
   * them and the value tie is not checked.
   */
  private async engineClosing(
    db: Db,
    scope: ResolvedScope,
    withAfter: boolean,
  ): Promise<EngineClosing> {
    const s = scope.sql;
    const rows = await db.$queryRaw<ValuedHoldingRow[]>(
      itemValuationSql({
        companyId: s.companyId,
        branchId: s.branchId,
        itemId: s.itemId,
        asOf: s.to,
        wot: s.wot,
      }),
    );
    const { value } = valueInScope(rows, {
      godownId: s.godownId,
      bucket: s.bucket,
      lotId: s.lotId,
    });
    if (!withAfter) return { value, rowsAfter: 0 };
    const [after] = await db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
        FROM stock.stock_ledger a
       WHERE a.sml_company_id = ${s.companyId}::uuid AND a.sml_branch_id = ${s.branchId}::uuid
         AND a.sml_item_id = ${s.itemId}::uuid AND a.sml_is_deleted = false
         AND a.sml_doc_date > ${s.to}::date
         ${s.godownId ? Prisma.sql`AND a.sml_godown_id = ${s.godownId}::uuid` : Prisma.empty}
         ${s.bucket ? Prisma.sql`AND a.sml_bucket = ${s.bucket}` : Prisma.empty}
         ${s.lotId ? Prisma.sql`AND a.sml_lot_id = ${s.lotId}::uuid` : Prisma.empty}`;
    return { value, rowsAfter: after?.n ?? 0 };
  }

  private async revaluationsLeftOut(db: Db, scope: ResolvedScope): Promise<number> {
    if (scope.sql.withRevaluations) return 0;
    const [row] = await db.$queryRaw<{ n: number }[]>(revaluationsLeftOutSql(scope.sql));
    return row?.n ?? 0;
  }

  /**
   * The walk-in customer, by the settings resolver (company + branch; the
   * setting may also be set per device, which a report over every device's
   * bills cannot pick one of — a bill with no customer is a walk-in anyway).
   */
  private async walkIn(companyId: string, branchId: string): Promise<WalkIn> {
    const effective = await this.appSettings.resolveEffective({
      companyId,
      branchId,
      deviceId: null,
      userId: null,
    });
    const id = readSalesSettings(effective).defaultCustomerId;
    return { id: id && UUID.test(id) ? id.toLowerCase() : null, name: null };
  }

  private async walkInName(db: Db, walkIn: WalkIn): Promise<WalkIn> {
    if (!walkIn.id) return walkIn;
    const [row] = await db.$queryRaw<{ led_name: string | null }[]>`
      SELECT led_name FROM accounts.acc_ledger_master WHERE led_id = ${walkIn.id}::uuid`;
    return { id: walkIn.id, name: row?.led_name ?? null };
  }
}

// ── helpers (pure; exported for the specs) ─────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The lookup row (refusals passed) + the query → the scope every statement reads. */
function scopeOf(row: ScopeLookupRow, q: ItemLedgerMonthsDto & { from: string }): ResolvedScope {
  const bucket = q.bucket ?? 'SALEABLE';
  const valueAt = q.valueAt ?? 'WITHOUT_TAX';
  const godownId = q.godownId ?? null;
  const unit = q.unitId
    ? {
        unitId: q.unitId,
        name: row.unit_name ?? '',
        factor: dec(row.iuc_to_base_factor ?? 1),
        isBase: row.iuc_is_base_unit === true,
      }
    : {
        unitId: row.base_iuc_id,
        name: row.base_unit_name ?? '',
        factor: dec(1),
        isBase: true,
      };
  if (unit.factor.lessThanOrEqualTo(0)) unit.factor = dec(1);
  return {
    sql: {
      companyId: q.companyId,
      branchId: q.branchId,
      itemId: q.itemId,
      from: q.from,
      to: q.to,
      godownId,
      bucket: bucket === 'ALL' ? null : bucket,
      lotId: q.lotId ?? null,
      wot: valueAt === 'WITHOUT_TAX',
      withRevaluations: godownId === null && (bucket === 'ALL' || bucket === 'SALEABLE'),
      types: q.types ?? [],
      showReversed: q.showReversed ?? true,
    },
    companyName: row.comp_name,
    branchName: row.br_name,
    itemCode: row.item_code,
    itemName: row.item_name ?? '',
    godownName: godownId ? row.gdl_name : null,
    batchNo: q.lotId ? row.slt_batch_no : null,
    bucket,
    valueAt,
    unit,
  };
}

function refuse(code: string, field: string, message: string): never {
  throwUnprocessable('Item Ledger request refused', [{ field, message, code }]);
}

/** RANGE_REVERSED — the DTO already holds both to calendar dates. */
export function assertRange(from: string, to: string): void {
  if (!isRealIsoDate(from) || !isRealIsoDate(to) || from > to) {
    refuse(ITEM_LEDGER_ERROR.RANGE_REVERSED, 'from', `${from} is after ${to}.`);
  }
}

function rightsOf(rights: MenuRights): ReportRights {
  return { print: rights.print, export: rights.export };
}

export function headOf(
  scope: ResolvedScope,
  opts: { order: 'asc' | 'desc'; rights: MenuRights; leftOut: number; showReversed: boolean },
): ReportHead {
  return {
    companyId: scope.sql.companyId,
    companyName: scope.companyName,
    branchId: scope.sql.branchId,
    branchName: scope.branchName,
    itemId: scope.sql.itemId,
    itemCode: scope.itemCode,
    itemName: scope.itemName,
    from: scope.sql.from,
    to: scope.sql.to,
    godownId: scope.sql.godownId,
    godownName: scope.godownName,
    bucket: scope.bucket,
    lotId: scope.sql.lotId,
    batchNo: scope.batchNo,
    unit: {
      unitId: scope.unit.unitId,
      name: scope.unit.name,
      factor: scope.unit.factor.toFixed(6),
      isBase: scope.unit.isBase,
    },
    valueAt: scope.valueAt,
    order: opts.order,
    showReversed: opts.showReversed,
    types: scope.sql.types,
    revaluationsLeftOut: opts.leftOut,
    rights: rightsOf(opts.rights),
  };
}

export function openingBlock(scope: ResolvedScope, open: OpeningRow): OpeningBlock {
  const q = dec(open.q);
  const v = dec(open.v).plus(open.rv);
  return {
    date: scope.sql.from,
    closingOf: dayBefore(scope.sql.from),
    qty: qtyIn(q, scope.unit.factor),
    value: money(v),
    rate: rateOf(v, q, scope.unit.factor),
    lots: Number(open.lots),
  };
}

export function summaryOf(agg: readonly AggRow[]): AggRow {
  const s = agg.find((r) => r.part === 'S');
  if (!s) throw new Error('Item Ledger summary row missing');
  return s;
}

/**
 * The closing at `to`. P2-IL: `value` is the stock engine's valuation of the
 * holding (`engineValue`, reports/common/stock-valuation.sql.ts); the ledger
 * rows' own sum stays as `ledgerValue` and the difference is `costAdj`.
 * Without `engineValue` (a caller that has none) the value is the row sum.
 */
export function closingBlock(
  scope: ResolvedScope,
  open: OpeningRow,
  s: AggRow,
  engineValue?: Num | null,
): ClosingBlock {
  const q = dec(open.q).plus(s.q_all);
  const ledgerValue = dec(open.v).plus(open.rv).plus(s.v_all);
  const v = engineValue === undefined || engineValue === null ? ledgerValue : dec(engineValue);
  return {
    date: scope.sql.to,
    qty: qtyIn(q, scope.unit.factor),
    value: money(v),
    rate: rateOf(v, q, scope.unit.factor),
    ledgerValue: money(ledgerValue),
    costAdj: money(v.minus(ledgerValue)),
  };
}

export function totalsOf(s: AggRow, factor: Num): LedgerTotals {
  return {
    receivedQty: qtyIn(s.q_in ?? 0, factor),
    issuedQty: qtyIn(s.q_out ?? 0, factor),
    valueIn: money(s.v_in ?? 0),
    valueOut: money(s.v_out ?? 0),
    rows: Number(s.n_all),
    rowsShown: Number(s.n_shown),
    docs: Number(s.docs),
    internalMoves: Number(s.n_internal),
    reversedPairs: Number(s.n_pairs),
    revaluations: Number(s.n_reval),
  };
}

export function tilesOf(agg: readonly AggRow[]): LedgerTiles {
  const tile = (kind: 'IN' | 'OUT'): TileDocs[] =>
    agg
      .filter((r) => r.part === 'T' && r.kind === kind && r.rtype)
      .map((r) => ({
        type: r.rtype as string,
        label: tileLabel(r.rtype as string, kind, r.ob),
        count: Number(r.docs),
      }))
      .sort((a, b) => b.count - a.count || reportTypeOrder(a.type) - reportTypeOrder(b.type));
  const docNos = (state: string): string[] =>
    agg
      .filter((r) => r.part === 'C' && r.cls === state && r.doc_no)
      .map((r) => r.doc_no as string)
      .sort();
  const cancelled = docNos('CANCELLED');
  const amended = docNos('AMENDED');
  return {
    receivedDocs: tile('IN'),
    issuedDocs: tile('OUT'),
    cancelled: { count: cancelled.length, docNos: cancelled.slice(0, DOC_NO_CAP) },
    amended: { count: amended.length, docNos: amended.slice(0, DOC_NO_CAP) },
  };
}

const PAIR_ORDER: Record<PairClass, number> = { LIVE: 0, CANCELLED: 1, AMENDED: 2 };

export function byTypeOf(agg: readonly AggRow[], factor: Num): ByTypeRow[] {
  const opt = (v: Dec | null, f: (x: Dec) => string): string | null => (v === null ? null : f(v));
  return agg
    .filter((r) => r.part === 'B' && r.rtype)
    .map((r) => {
      const cls = (r.cls ?? 'LIVE') as PairClass;
      const kinds = r.kinds ?? [];
      const moved = r.moved !== null && !dec(r.moved).isZero() ? r.moved : null;
      return {
        type: r.rtype as string,
        label: byTypeLabel(r.rtype as string, cls),
        kind: (kinds.length === 1 ? kinds[0] : 'MIXED') as RowKind | 'MIXED',
        pairClass: cls,
        docs: Number(r.docs),
        qtyIn: opt(r.q_in, (x) => qtyIn(x, factor)),
        qtyOut: opt(r.q_out, (x) => qtyIn(x, factor)),
        valueIn: opt(r.v_in, money),
        valueOut: opt(r.v_out, money),
        movedQty: opt(moved, (x) => qtyIn(x, factor)),
        pairQty: cls === 'LIVE' ? null : opt(r.pair_q, (x) => qtyIn(x, factor)),
        netsToZero: cls !== 'LIVE' && dec(r.q_all).isZero() && dec(r.v_all).isZero(),
      };
    })
    .sort(
      (a, b) =>
        reportTypeOrder(a.type) - reportTypeOrder(b.type) ||
        PAIR_ORDER[a.pairClass] - PAIR_ORDER[b.pairClass],
    );
}

export function stockNowBlock(
  today: string,
  rows: readonly StockNowDbRow[],
  factor: Num,
): StockNowBlock {
  let onHand = dec(0);
  let reserved = dec(0);
  let transit = dec(0);
  let value = dec(0);
  for (const r of rows) {
    if (!r.in_scope) continue;
    onHand = onHand.plus(r.on_hand);
    reserved = reserved.plus(r.reserved);
    transit = transit.plus(r.transit_in);
    value = value.plus(r.value);
  }
  return {
    asOf: today,
    rows: rows.map((r) => ({
      godownId: r.godown_id,
      godownName: r.godown_name,
      bucket: r.bucket,
      lotId: r.lot_id,
      batchNo: r.batch_no,
      expiry: r.expiry,
      onHand: qtyIn(r.on_hand, factor),
      reserved: qtyIn(r.reserved, factor),
      inTransitIn: qtyIn(r.transit_in, factor),
      costRate: dec(r.cost_rate).times(factor).toFixed(2),
      value: money(r.value),
      inScope: r.in_scope,
    })),
    totalInScope: {
      onHand: qtyIn(onHand, factor),
      reserved: qtyIn(reserved, factor),
      inTransitIn: qtyIn(transit, factor),
      value: money(value),
    },
  };
}

/**
 * D25 — only when `to` ≥ today: the ledger's holding (closing + the in-scope
 * rows dated after `to`) against Σ stock_balance on hand in scope.
 */
export function tieOf(
  checked: boolean,
  open: OpeningRow,
  s: AggRow,
  stock: readonly StockNowDbRow[],
  factor: Num,
  engine?: EngineClosing | null,
): TieCheck {
  if (!checked) {
    return {
      checked: false,
      ledgerQty: null,
      stockNowQty: null,
      equal: null,
      difference: null,
      stockNowValue: null,
      valueEqual: null,
    };
  }
  const ledgerQty = dec(open.q).plus(s.q_all).plus(open.after_q);
  const inScope = stock.filter((r) => r.in_scope);
  const stockNowQty = inScope.reduce((sum, r) => sum.plus(r.on_hand), dec(0));
  const diff = ledgerQty.minus(stockNowQty);
  // P2-IL: the value tie, only when nothing in scope is dated after `to`.
  const valueChecked = !!engine && engine.rowsAfter === 0;
  const stockNowValue = inScope.reduce((sum, r) => sum.plus(r.value), dec(0));
  return {
    checked: true,
    ledgerQty: qtyIn(ledgerQty, factor),
    stockNowQty: qtyIn(stockNowQty, factor),
    equal: diff.isZero(),
    difference: qtyIn(diff, factor),
    stockNowValue: valueChecked ? money(stockNowValue) : null,
    valueEqual: valueChecked ? dec(engine.value).equals(stockNowValue) : null,
  };
}

/**
 * The Period-total tie line: opening + received − issued = closing, quantity
 * and value, on the exact base numbers (before `qtyIn` / `money` round them),
 * over the very sums `openingBlock`, `totalsOf` and `closingBlock` print. Both
 * null when a row filter hides any row — the totals then cover only the rows
 * shown and are not meant to meet the closing.
 */
export function periodTieOf(open: OpeningRow, s: AggRow): PeriodTie {
  if (Number(s.n_shown) !== Number(s.n_all)) return { qtyEqual: null, valueEqual: null };
  const openQ = dec(open.q);
  const openV = dec(open.v).plus(open.rv);
  const closeQ = openQ.plus(s.q_all);
  const closeV = openV.plus(s.v_all);
  return {
    qtyEqual: openQ.plus(dec(s.q_in)).minus(dec(s.q_out)).equals(closeQ),
    valueEqual: openV.plus(dec(s.v_in)).minus(dec(s.v_out)).equals(closeV),
  };
}

/** One page row → the wire row (§5.2's field rules). */
export function toRow(
  r: PageRow,
  scope: ResolvedScope,
  walkIn: WalkIn,
  base: OpeningBase,
): LedgerRow {
  const f = scope.unit.factor;
  const neg = r.is_rev ? -1 : 1;
  const docKind =
    r.src_kind === 'R'
      ? docKindOf({
          linkDocType: r.src_type,
          voucherType: null,
          toBranchId: null,
          srcDocType: r.src_type,
        })
      : docKindOf({
          linkDocType: r.link_type,
          voucherType: r.voucher_type,
          toBranchId: r.to_branch,
          srcDocType: r.src_type,
        });
  const viaLink = r.src_kind === 'L' && !!r.link_id && docKind === r.link_type;
  const party = partyOf({
    docKind,
    srcModule: r.src_module,
    partyId: r.party_id,
    ledgerName: r.party_name,
    billCustomerId: r.sb_cust_id,
    billCustomerName: r.sb_cust_name,
    walkInId: walkIn.id,
    walkInName: walkIn.name,
  });
  const internal = r.kind === 'INTERNAL';
  const otherBucket = r.rtype === 'BUCKET_MOVE' && !internal ? r.other_bucket : null;
  const revKind: 'CANCELLED' | 'AMENDED' = r.amended ? 'AMENDED' : 'CANCELLED';
  const priced = r.src_module === 'SALES' || r.src_module === 'PURCHASE';
  return {
    rowId: r.row_id,
    seq: Number(r.seq),
    date: r.d,
    time: r.state === 'REVERSAL' ? r.t_post : r.t_doc,
    postedAt: r.posted_at,
    type: r.rtype,
    typeLabel: rowTypeLabel(r.rtype, r.kind, otherBucket),
    kind: r.kind,
    state: r.state,
    docNo: r.refno,
    revision: r.src_kind === 'L' && viaLink ? revisionOf(r.voucher_refno) : null,
    doc: {
      kind: docKind,
      id: viaLink ? (r.link_id as string) : r.doc_id,
      accYear: viaLink ? r.link_year : r.src_year,
      branchId: r.voucher_branch ?? scope.sql.branchId,
    },
    party,
    detail: detailOf(r),
    godownId: internal ? r.from_godown : r.gdown,
    godownName: internal ? r.from_godown_name : r.gdown_name,
    toGodownName:
      internal && r.rtype === 'GODOWN_TRANSFER'
        ? r.to_godown_name
        : r.rtype === 'GODOWN_TRANSFER' && r.kind === 'OUT'
          ? r.other_godown_name
          : null,
    bucket: internal ? r.from_bucket : r.gbucket,
    toBucket:
      internal && r.rtype === 'BUCKET_MOVE'
        ? r.to_bucket
        : r.rtype === 'BUCKET_MOVE' && r.kind === 'OUT'
          ? r.other_bucket
          : null,
    lotId: r.lot,
    batchNo: r.batch_no,
    expiry: r.expiry,
    receivedQty: r.kind === 'IN' ? qtyIn(r.sq, f) : null,
    issuedQty: r.kind === 'OUT' ? qtyIn(dec(r.sq).negated(), f) : null,
    movedQty: internal ? qtyIn(dec(r.moved).times(neg), f) : null,
    freeQty: r.kind === 'VALUE' ? null : qtyIn(dec(r.fq).times(neg), f),
    balanceQty: qtyIn(base.q.plus(r.run_q), f),
    balanceValue: money(base.v.plus(r.run_v)),
    costRate: r.kind === 'VALUE' ? null : rateOf(r.gv, r.gq, f),
    costValue: money(r.sv),
    docRate:
      priced && r.doc_amt !== null && !dec(r.doc_amt).isZero() && !dec(r.bq).isZero()
        ? dec(r.doc_amt).dividedBy(r.bq).times(f).abs().toFixed(2)
        : null,
    user: r.by_login,
    reversal:
      r.state === 'CANCELLED' || r.state === 'AMENDED'
        ? { kind: revKind, at: r.r_posted_at, user: r.r_by_login, reason: clean(r.r_narr) }
        : null,
    reverses:
      r.state === 'REVERSAL'
        ? { kind: revKind, docNo: r.o_refno, postedAt: r.o_posted_at, reason: clean(r.narration) }
        : null,
  };
}

/** The opening in base units and value, which the page's running sums start from. */
export interface OpeningBase {
  q: Dec;
  v: Dec;
}

export function openingBase(open: OpeningRow): OpeningBase {
  return { q: dec(open.q), v: dec(open.v).plus(open.rv) };
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** §5.3 "Party and detail per row" — the detail half. */
export function detailOf(r: PageRow): string {
  const parts: (string | null)[] = [];
  if (r.src_kind === 'R') {
    return clean(r.narration) ?? '';
  }
  switch (r.rtype) {
    case 'GRN':
    case 'PURCHASE':
    case 'SHORTAGE_RECEIPT':
    case 'PURCHASE_RETURN': {
      const inv = clean(r.pi_supplier_inv_no) ?? clean(r.grn_supplier_inv_no);
      parts.push(inv ? `inv ${inv}` : null);
      break;
    }
    case 'GODOWN_TRANSFER':
      if (r.kind === 'INTERNAL') {
        parts.push(`${r.from_godown_name ?? '?'} → ${r.to_godown_name ?? '?'}`);
      } else if (r.kind === 'OUT') {
        parts.push(`${r.gdown_name ?? '?'} → ${r.other_godown_name ?? '?'}`);
      } else {
        parts.push(`${r.other_godown_name ?? '?'} → ${r.gdown_name ?? '?'}`);
      }
      break;
    case 'BUCKET_MOVE':
      if (r.kind === 'INTERNAL') {
        parts.push(`${bucketLabel(r.from_bucket)} → ${bucketLabel(r.to_bucket)}`);
      } else if (r.kind === 'OUT') {
        parts.push(`${bucketLabel(r.gbucket)} → ${bucketLabel(r.other_bucket)}`);
      } else {
        parts.push(`${bucketLabel(r.other_bucket)} → ${bucketLabel(r.gbucket)}`);
      }
      break;
    case 'BRANCH_OUT':
      parts.push(`→ ${r.to_branch_name ?? 'another branch'}`);
      parts.push(transitText(r.transit_status, r.transit_received_on));
      break;
    case 'BRANCH_IN':
      parts.push(`← ${r.from_branch_name ?? 'another branch'}`);
      break;
    default:
      break;
  }
  if (r.src_module === 'STOCK') {
    parts.push(clean(r.reason_name));
    parts.push(clean(r.remarks));
  }
  return parts.filter(Boolean).join(' · ');
}
