import { Prisma, PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { AppSettingValueService } from '../src/modules/settings/appSettings/app-setting-value.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import { StockAdjustmentService } from '../src/modules/stocks/stock-adjustment/stock-adjustment.service';
import { assertStockBalances } from '../src/modules/stocks/posting/stock-balance-assertion';
import {
  rebuildStockDerivedFigures,
  STOCK_LOT_ID_NAMESPACE,
} from '../src/modules/stocks/stock-voucher/stock-voucher-posting.helper';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { buildStockPosting } from './helpers/stock-posting.factory';

/**
 * NOTES 92 — plain stock on the item average, EVERY tracked item at its own
 * lot cost (2026-10-06). The acceptance list of §5, run against the engine.
 *
 * MRP STOCK ITEM, as on the box: four batches opened at 25 / 250 / 400 / 500.
 * Before notes 92 every screen showed 340.909 on all four and a shortage of
 * the cheap batch was posted at 13.6× its cost. Now:
 *   * each holding carries ITS lot's cost, the item row the summary;
 *   * a count shortage, a write-off, a re-lot OUT are relieved at the lot's
 *     cost; a count overage and a re-lot IN come in at it;
 *   * a receipt re-averages ITS lot and no other;
 *   * a cancel puts the lot back exactly;
 *   * a plain item is costed exactly as before — item average, every row;
 *   * the derived figures are a REBUILD: zero them and they come back
 *     byte-identical, and a second run writes nothing (§7).
 *
 * ONE TRANSACTION, ROLLED BACK — the engine spec's harness. Figures are
 * derived by hand from §5; if a number here disagrees with the engine, the
 * number is the thing to trust until someone re-derives it.
 *
 *     npm run test:e2e -- stock-lot-cost-notes-92
 */

const ACC_YEAR = '2026-2027';
const OPEN_DATE = '2026-04-01';
const DOC_DATE = '2026-04-02';

const OPENING_RULES: StockVoucherTypeRules = {
  voucherType: 'OPENING',
  typeCode: 'OPN',
  displayName: 'Opening stock',
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  ledgerTxnTypes: ['OPENING'],
  quantityMode: 'QTY',
  allowsCount: false,
  allowsToBranch: false,
  auditScreenName: 'Opening Stock',
  statusDocType: TxnStatusDocType.OPENING_STOCK,
  postShape: 'SIMPLE',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};
const PHYSICAL_RULES: StockVoucherTypeRules = {
  voucherType: 'PHYSICAL',
  typeCode: 'PHY',
  displayName: 'Physical stock count',
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: false,
  ledgerTxnTypes: ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'],
  quantityMode: 'COUNT',
  defaultRateSource: 'AVG_COST',
  allowsRepeatHolding: true,
  allowsCount: true,
  allowsToBranch: false,
  auditScreenName: 'Physical Stock Count',
  statusDocType: TxnStatusDocType.PHYSICAL_STOCK,
  postShape: 'COUNT',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};
/** An outward quantity document with no reasons: the engine spec's record. */
const ADJUSTMENT_OUT_RULES: StockVoucherTypeRules = {
  voucherType: 'ADJUSTMENT',
  typeCode: 'ADJ',
  displayName: 'Stock adjustment',
  requiresToGodown: false,
  requiresFromGodown: true,
  isInward: false,
  ledgerTxnTypes: ['ADJUST_MINUS'],
  quantityMode: 'QTY',
  defaultRateSource: 'AVG_COST',
  allowsRepeatHolding: true,
  allowsCount: false,
  allowsToBranch: false,
  auditScreenName: 'Stock Adjustment',
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  postShape: 'SIMPLE',
};
const ADJUSTMENT_IN_RULES: StockVoucherTypeRules = {
  ...ADJUSTMENT_OUT_RULES,
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  ledgerTxnTypes: ['ADJUST_PLUS'],
};

interface Item {
  itemId: string;
  iuc: string;
}
interface Fixture {
  companyId: string;
  branchId: string;
  deviceId: string;
  godownId: string;
  userId: string;
  /** No policy row: tracks nothing, WAVG. */
  plain: Item;
  /** ITEM policy: tracks MRP, LOT_ACTUAL, FIFO. */
  mrp: Item;
  reasons: { RELOT_OUT: string; RELOT_IN: string; MOVE_DAMAGED: string };
}
/** The four batches of §1, keyed by MRP. */
const BATCHES = [
  { mrp: 40, qty: 10, cost: 25 },
  { mrp: 500, qty: 10, cost: 250 },
  { mrp: 650, qty: 15, cost: 400 },
  { mrp: 550, qty: 20, cost: 500 },
] as const;

const prisma = new PrismaClient();
class Rollback extends Error {}

function transactional(tx: Prisma.TransactionClient): PrismaService {
  const proxy: object = new Proxy(tx, {
    get(target, prop) {
      if (prop === '$transaction') {
        return (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (client: unknown) => unknown)(proxy)
            : Promise.all(arg as Array<Promise<unknown>>);
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return proxy as PrismaService;
}

describe('Notes 92 — lot-actual costing for tracked items (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let service: StockVoucherService;
  let adjustments: StockAdjustmentService;
  let fixture: Fixture;
  let spSeq = 0;
  /** svh_id of the write-off posted in case 3, cancelled in case 7. */
  let writeOffId: string;

  beforeAll(async () => {
    await new Promise<void>((ready, fail) => {
      txDone = prisma
        .$transaction(
          async (client) => {
            tx = client;
            ready();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            throw new Rollback();
          },
          { maxWait: 30_000, timeout: 15 * 60_000 },
        )
        .then(
          () => undefined,
          (error: unknown) => {
            if (error instanceof Rollback) return;
            fail(error instanceof Error ? error : new Error(String(error)));
            throw error;
          },
        );
    });
    const ctx = { getUserId: () => fixture?.userId ?? null } as unknown as RequestContextService;
    service = new StockVoucherService(
      transactional(tx),
      {
        logEntityChange: jest.fn().mockResolvedValue(undefined),
        logDocumentRevision: jest.fn().mockResolvedValue({ revNo: 1 }),
      } as unknown as AuditLogService,
      ctx,
      buildStockPosting(transactional(tx)).stockPosting,
    );
    adjustments = new StockAdjustmentService(transactional(tx), service, ctx, {
      resolveEffective: async () => [],
    } as unknown as AppSettingValueService);
    fixture = await createFixture();
    await tx.$queryRaw`SELECT accounts.fn_seed_ledger_map()`;
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  // ── fixtures ──────────────────────────────────────────────────────────────

  async function createFixture(): Promise<Fixture> {
    const [scope] = await tx.$queryRaw<
      Array<{ company_id: string; branch_id: string; device_id: string; user_id: string }>
    >`
      SELECT br.br_comp_id AS company_id, br.br_id AS branch_id, dev.dev_id AS device_id, usr.usr_id AS user_id
        FROM public.branch_master br
        JOIN fixed.device_master dev ON dev.dev_branch_id = br.br_id AND dev.dev_is_deleted = false AND dev.dev_is_active = true
        JOIN public.user_master usr  ON usr.usr_is_deleted = false
       WHERE br.br_is_deleted = false
         AND EXISTS (SELECT 1 FROM inventory.godown_locations g WHERE g.gdl_branch_id = br.br_id AND g.gdl_is_deleted = false)
       LIMIT 1
    `;
    if (!scope) throw new Error('No branch with a device, a user and a godown on this database.');
    const [godown] = await tx.$queryRaw<Array<{ gdl_id: string }>>`
      SELECT gdl_id FROM inventory.godown_locations
       WHERE gdl_branch_id = ${scope.branch_id}::uuid AND gdl_is_deleted = false ORDER BY gdl_name LIMIT 1
    `;
    const [group] = await tx.$queryRaw<
      Array<{ itg_id: string }>
    >`SELECT itg_id FROM inventory.item_group_master LIMIT 1`;
    const [unit] = await tx.$queryRaw<
      Array<{ unit_id: string }>
    >`SELECT unit_id FROM inventory.item_unit_master ORDER BY unit_name LIMIT 1`;
    if (!unit) throw new Error('No item_unit_master row on this database.');
    const stamp = Date.now().toString(36);
    const createItem = async (code: string, name: string): Promise<Item> => {
      const item = await tx.itemMaster.create({
        data: {
          itemCode: `${code}-${stamp}`,
          itemNameEn: `${name} ${stamp}`,
          itemGroupId: group.itg_id,
          itemCompanyId: scope.company_id,
          itemBranchId: scope.branch_id,
        },
        select: { itemId: true },
      });
      const iuc = await tx.itemUnitConversion.create({
        data: {
          iucItemId: item.itemId,
          iucUnitId: unit.unit_id,
          iucBaseUnitId: unit.unit_id,
          iucToBaseFactor: 1,
          iucUnitSlno: 1,
          iucIsBaseUnit: true,
        },
        select: { iucId: true },
      });
      return { itemId: item.itemId, iuc: iuc.iucId };
    };
    const plain = await createItem('E2E-N92-PLAIN', 'N92 plain salt');
    const mrp = await createItem('E2E-N92-MRP', 'N92 MRP stock item');
    // The fixture's group may carry a policy of its own; an ITEM row outranks
    // it either way. PLAIN gets an explicit "tracks nothing" row so the case
    // is about the policy, not about what the group happens to say.
    await tx.$executeRaw`
      INSERT INTO stock.stock_track_policy (
        stp_company_id, stp_scope, stp_scope_id, stp_track_mrp, stp_valuation_method, stp_issue_strategy, stp_remarks)
      VALUES (${scope.company_id}::uuid, 'ITEM', ${plain.itemId}::uuid, false, 'WAVG',       'FEFO', 'notes-92 e2e'),
             (${scope.company_id}::uuid, 'ITEM', ${mrp.itemId}::uuid,   true,  'LOT_ACTUAL', 'FIFO', 'notes-92 e2e')
    `;
    const rows = await tx.$queryRaw<Array<{ srm_code: string; srm_id: string }>>`
      SELECT srm_code, srm_id FROM stock.stock_reason_master
       WHERE srm_is_deleted = false AND srm_company_id IS NULL
         AND srm_code IN ('RELOT_OUT', 'RELOT_IN', 'MOVE_DAMAGED')
    `;
    const reasons = Object.fromEntries(
      rows.map((r) => [r.srm_code, r.srm_id]),
    ) as Fixture['reasons'];
    for (const code of ['RELOT_OUT', 'RELOT_IN', 'MOVE_DAMAGED'] as const) {
      if (!reasons[code])
        throw new Error(`Seed reason ${code} missing — run prisma/seed/Stock_Reason_Master.sql`);
    }
    return {
      companyId: scope.company_id,
      branchId: scope.branch_id,
      deviceId: scope.device_id,
      godownId: godown.gdl_id,
      userId: scope.user_id,
      plain,
      mrp,
      reasons,
    };
  }

  // ── the transaction fence ────────────────────────────────────────────────

  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    const name = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
    try {
      const out = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
      return out;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
      const err = error as Error & { response?: unknown };
      if (err.response) err.message = `${err.message}: ${JSON.stringify(err.response)}`;
      throw err;
    }
  }

  // ── documents ────────────────────────────────────────────────────────────

  interface QtyLine {
    item: Item;
    qty: number;
    costRate?: number;
    mrp?: number;
    lotId?: string;
  }
  const header = (
    rules: StockVoucherTypeRules,
    docDate: string,
    extra: Record<string, unknown> = {},
  ) => ({
    accYear: ACC_YEAR,
    companyId: fixture.companyId,
    branchId: fixture.branchId,
    deviceId: fixture.deviceId,
    docDate,
    ...(rules.isInward ? { toGodownId: fixture.godownId } : { fromGodownId: fixture.godownId }),
    userId: fixture.userId,
    ...extra,
  });
  const qtyLines = (lines: QtyLine[]) =>
    lines.map((line, index) => ({
      lineNo: index + 1,
      itemId: line.item.itemId,
      uomId: line.item.iuc,
      baseUomId: line.item.iuc,
      toBaseFactor: 1,
      qty: line.qty,
      baseQty: line.qty,
      godownId: fixture.godownId,
      costRate: line.costRate ?? 0,
      ...(line.mrp !== undefined ? { mrp: line.mrp } : {}),
      ...(line.lotId !== undefined ? { lotId: line.lotId } : {}),
    }));
  const post = (rules: StockVoucherTypeRules, svhId: string) =>
    attempt(() =>
      service.post(rules, svhId, ACC_YEAR, fixture.companyId, fixture.branchId, fixture.userId),
    );

  /** An OPENING at the lines' own costs. */
  async function open(lines: QtyLine[]): Promise<string> {
    const saved = await attempt(() =>
      service.save(OPENING_RULES, {
        header: header(OPENING_RULES, OPEN_DATE, { rateSource: 'MANUAL' }),
        lines: qtyLines(lines),
      }),
    );
    await post(OPENING_RULES, saved.header.svhId);
    return saved.header.svhId;
  }
  /** A quantity adjustment: OUT at whatever the stock cost (no keyed cost), IN at the line's cost. */
  async function adjust(rules: StockVoucherTypeRules, lines: QtyLine[]): Promise<string> {
    const keyed = lines.some((l) => l.costRate);
    const saved = await attempt(() =>
      service.save(rules, {
        header: header(rules, DOC_DATE, { rateSource: keyed ? 'MANUAL' : 'AVG_COST' }),
        lines: qtyLines(lines),
      }),
    );
    await post(rules, saved.header.svhId);
    return saved.header.svhId;
  }
  /** A count of the godown's holdings of one item: every lot at book, except the ones named. */
  async function count(item: Item, counted: Record<string, number>): Promise<string> {
    const sheet = await service.countSheet(PHYSICAL_RULES, {
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      accYear: ACC_YEAR,
      godownId: fixture.godownId,
    });
    const rows = sheet.items.filter((row) => row.itemId === item.itemId);
    expect(rows.length).toBeGreaterThan(0);
    const saved = await attempt(() =>
      service.save(PHYSICAL_RULES, {
        header: header(PHYSICAL_RULES, DOC_DATE, {
          toGodownId: fixture.godownId,
          fromGodownId: undefined,
        }),
        lines: rows.map((row, index) => ({
          lineNo: index + 1,
          itemId: row.itemId,
          godownId: row.godownId,
          bucket: row.bucket,
          lotId: row.lotId,
          countedQty: counted[row.lotId] ?? row.bookQty,
        })),
      } as never),
    );
    await post(PHYSICAL_RULES, saved.header.svhId);
    return saved.header.svhId;
  }
  /** Through the adjustment screen's service: re-lot pairs and bucket moves. */
  async function adjustmentDoc(
    kind: 'ADJUSTMENT' | 'BUCKET_MOVE',
    lines: Array<{
      item: Item;
      qty: number;
      reasonId: string;
      lotId?: string;
      mrp?: number;
      toBucket?: string;
    }>,
  ): Promise<string> {
    const saved = await attempt(() =>
      adjustments.save({
        header: {
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchId,
          deviceId: fixture.deviceId,
          docDate: DOC_DATE,
          voucherType: kind,
          fromGodownId: fixture.godownId,
          userId: fixture.userId,
        },
        lines: lines.map((line, index) => ({
          lineNo: index + 1,
          itemId: line.item.itemId,
          uomId: line.item.iuc,
          baseUomId: line.item.iuc,
          toBaseFactor: 1,
          qty: line.qty,
          baseQty: line.qty,
          godownId: fixture.godownId,
          reasonId: line.reasonId,
          remarks: 'notes-92 e2e',
          ...(line.lotId !== undefined ? { lotId: line.lotId } : {}),
          ...(line.mrp !== undefined ? { mrp: line.mrp } : {}),
          ...(line.toBucket !== undefined ? { toBucket: line.toBucket } : {}),
        })),
      } as never),
    );
    await attempt(() =>
      adjustments.post({
        svhId: saved.header.svhId,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        userId: fixture.userId,
      }),
    );
    return saved.header.svhId;
  }

  // ── readers ──────────────────────────────────────────────────────────────

  const ledger = (svhId: string) =>
    tx.$queryRaw<
      Array<{
        txn_type: string;
        direction: number;
        qty: string;
        cost_rate: string;
        cost_value: string;
        lot_id: string;
        bucket: string;
      }>
    >`
      SELECT sml_txn_type AS txn_type, sml_direction AS direction, (sml_base_qty + sml_free_base_qty)::text AS qty,
             sml_cost_rate::text AS cost_rate, sml_cost_value::text AS cost_value, sml_lot_id AS lot_id, sml_bucket AS bucket
        FROM stock.stock_ledger
       WHERE sml_src_doc_id = ${svhId}::uuid AND sml_is_deleted = false AND sml_is_reversal = false
       ORDER BY sml_line_no, sml_split_no, sml_direction ASC
    `;
  /** The item's lots in the branch, with their holding figures Σ over godowns and buckets. */
  const lots = async (item: Item) => {
    const rows = await tx.$queryRaw<
      Array<{
        lot_id: string;
        mrp: string | null;
        signature: string;
        status: string;
        on_hand: string;
        rate: string;
        value: string;
        rates: number;
      }>
    >`
      SELECT slt.slt_id AS lot_id, slt.slt_mrp::text AS mrp, slt.slt_track_signature AS signature, slt.slt_status AS status,
             COALESCE(SUM(b.sbl_on_hand_qty), 0)::text AS on_hand,
             COALESCE(MAX(b.sbl_avg_cost_rate), 0)::text AS rate,
             COALESCE(SUM(b.sbl_stock_value), 0)::text AS value,
             count(DISTINCT b.sbl_avg_cost_rate)::int AS rates
        FROM stock.stock_lot slt
        LEFT JOIN stock.stock_balance b
               ON b.sbl_lot_id = slt.slt_id AND b.sbl_branch_id = ${fixture.branchId}::uuid AND b.sbl_is_deleted = false
       WHERE slt.slt_item_id = ${item.itemId}::uuid AND slt.slt_is_deleted = false
       GROUP BY slt.slt_id, slt.slt_mrp, slt.slt_track_signature, slt.slt_status
       ORDER BY slt.slt_mrp
    `;
    return rows.map((r) => ({
      lotId: r.lot_id,
      mrp: r.mrp === null ? null : Number(r.mrp),
      signature: r.signature,
      status: r.status,
      onHand: Number(r.on_hand),
      rate: Number(r.rate),
      value: Number(r.value),
      /** DISTINCT rates across the lot's rows — must be 1: every godown and bucket carries the same figure. */
      rates: r.rates,
    }));
  };
  const lotByMrp = async (item: Item, mrp: number) => {
    const lot = (await lots(item)).find((l) => l.mrp === mrp);
    if (!lot) throw new Error(`no lot with MRP ${mrp}`);
    return lot;
  };
  const itemCost = async (item: Item) => {
    const [row] = await tx.$queryRaw<Array<{ qty: string; value: string; avg: string }>>`
      SELECT sic_total_qty::text AS qty, sic_total_value::text AS value, sic_avg_cost_rate::text AS avg
        FROM stock.stock_item_cost
       WHERE sic_item_id = ${item.itemId}::uuid AND sic_branch_id = ${fixture.branchId}::uuid AND sic_is_deleted = false
    `;
    return row ? { qty: Number(row.qty), value: Number(row.value), avg: Number(row.avg) } : null;
  };
  const clean = async (item: Item) =>
    assertStockBalances(tx, {
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      itemId: item.itemId,
    });

  // ── 1. each batch at its own cost ────────────────────────────────────────

  it('1. four MRP batches open at their own cost: every holding shows it, the item row carries the summary (§5.1)', async () => {
    await open(
      BATCHES.map((b) => ({ item: fixture.mrp, qty: b.qty, costRate: b.cost, mrp: b.mrp })),
    );
    const held = await lots(fixture.mrp);
    expect(held).toHaveLength(4);
    for (const b of BATCHES) {
      expect(held.find((l) => l.mrp === b.mrp)).toMatchObject({
        signature: 'M',
        onHand: b.qty,
        rate: b.cost,
        value: b.qty * b.cost,
        rates: 1,
      });
    }
    // 18,750 over 55 units: the item's SUMMARY, not what any batch is relieved at.
    expect(await itemCost(fixture.mrp)).toEqual({ qty: 55, value: 18750, avg: 340.909091 });
    expect(await clean(fixture.mrp)).toEqual([]);
  });

  // ── 2. a count shortage is relieved at the batch's cost ──────────────────

  it('2. counting the MRP 40 batch as 9 posts the shortage at 25.00, and the batch stays at 25 (§5.2)', async () => {
    const a1251 = await lotByMrp(fixture.mrp, 40);
    const svhId = await count(fixture.mrp, { [a1251.lotId]: 9 });
    expect(
      (await ledger(svhId)).map((r) => [
        r.txn_type,
        Number(r.direction),
        Number(r.qty),
        Number(r.cost_rate),
        Number(r.cost_value),
      ]),
    ).toEqual([['PHYSICAL_MINUS', -1, 1, 25, 25]]);
    expect(await lotByMrp(fixture.mrp, 40)).toMatchObject({ onHand: 9, rate: 25, value: 225 });
    expect(await itemCost(fixture.mrp)).toMatchObject({ qty: 54, value: 18725 });
  });

  // ── 3. a write-off of the dear batch is valued at 500 ────────────────────

  it('3. writing off 1 × MRP 550 is valued at 500.00, whatever the item average says (§5.3)', async () => {
    // The line states the IDENTITY (MRP 550); the engine resolves the lot.
    writeOffId = await adjust(ADJUSTMENT_OUT_RULES, [{ item: fixture.mrp, qty: 1, mrp: 550 }]);
    expect(
      (await ledger(writeOffId)).map((r) => [
        r.txn_type,
        Number(r.qty),
        Number(r.cost_rate),
        Number(r.cost_value),
      ]),
    ).toEqual([['ADJUST_MINUS', 1, 500, 500]]);
    expect(await lotByMrp(fixture.mrp, 550)).toMatchObject({ onHand: 19, rate: 500, value: 9500 });
    // 18,750 − 25 − 500 on 53 units (§5.6 without the sale): each batch still at its own cost.
    expect(await itemCost(fixture.mrp)).toMatchObject({ qty: 53, value: 18225 });
    expect(Number((await itemCost(fixture.mrp))!.avg)).toBeCloseTo(18225 / 53, 5);
    expect(await lotByMrp(fixture.mrp, 650)).toMatchObject({ rate: 400 });
  });

  // ── 4. a count overage comes in at the batch's cost ──────────────────────

  it('4. counting the MRP 500 batch as 11 posts the gain at 250.00 — the lot it lands on, not the item average', async () => {
    const hj785 = await lotByMrp(fixture.mrp, 500);
    const svhId = await count(fixture.mrp, { [hj785.lotId]: 11 });
    expect(
      (await ledger(svhId)).map((r) => [
        r.txn_type,
        Number(r.direction),
        Number(r.qty),
        Number(r.cost_rate),
        Number(r.cost_value),
      ]),
    ).toEqual([['PHYSICAL_PLUS', 1, 1, 250, 250]]);
    expect(await lotByMrp(fixture.mrp, 500)).toMatchObject({ onHand: 11, rate: 250, value: 2750 });
    expect(await itemCost(fixture.mrp)).toMatchObject({ qty: 54, value: 18475 });
  });

  // ── 5. a receipt re-averages its own lot only ────────────────────────────

  it('5. receiving 10 more of the MRP 40 batch at 35 moves THAT batch to 30.263158 and no other', async () => {
    await adjust(ADJUSTMENT_IN_RULES, [{ item: fixture.mrp, qty: 10, costRate: 35, mrp: 40 }]);
    // 9 @ 25 + 10 @ 35 = 575 over 19.
    expect(await lotByMrp(fixture.mrp, 40)).toMatchObject({
      onHand: 19,
      rate: 30.263158,
      value: 575,
      rates: 1,
    });
    expect(await lotByMrp(fixture.mrp, 500)).toMatchObject({ rate: 250 });
    expect(await lotByMrp(fixture.mrp, 650)).toMatchObject({ rate: 400 });
    expect(await lotByMrp(fixture.mrp, 550)).toMatchObject({ rate: 500 });
    expect(await itemCost(fixture.mrp)).toMatchObject({ qty: 64, value: 18825 });
    expect(await clean(fixture.mrp)).toEqual([]);
  });

  // ── 6. a re-lot carries the OUT lot's cost; a move carries the same cost ─

  it('6. a re-lot of 2 × MRP 650 into MRP 700 takes the goods out at 400 and brings them in at 400 (§3.2)', async () => {
    const l815 = await lotByMrp(fixture.mrp, 650);
    const svhId = await adjustmentDoc('ADJUSTMENT', [
      { item: fixture.mrp, qty: 2, reasonId: fixture.reasons.RELOT_OUT, lotId: l815.lotId },
      { item: fixture.mrp, qty: 2, reasonId: fixture.reasons.RELOT_IN, mrp: 700 },
    ]);
    expect(
      (await ledger(svhId)).map((r) => [
        r.txn_type,
        Number(r.direction),
        Number(r.qty),
        Number(r.cost_rate),
        Number(r.cost_value),
      ]),
    ).toEqual([
      ['ADJUST_MINUS', -1, 2, 400, 800],
      ['ADJUST_PLUS', 1, 2, 400, 800],
    ]);
    expect(await lotByMrp(fixture.mrp, 650)).toMatchObject({ onHand: 13, rate: 400, value: 5200 });
    expect(await lotByMrp(fixture.mrp, 700)).toMatchObject({
      onHand: 2,
      rate: 400,
      value: 800,
      status: 'ACTIVE',
    });
    // Nothing gained or lost at item level.
    expect(await itemCost(fixture.mrp)).toMatchObject({ qty: 64, value: 18825 });

    // A move to DAMAGED: same lot, same cost on both rows; the lot's rate does
    // not move and every row of the lot still carries ONE figure.
    const kl8525 = await lotByMrp(fixture.mrp, 550);
    const move = await adjustmentDoc('BUCKET_MOVE', [
      {
        item: fixture.mrp,
        qty: 3,
        reasonId: fixture.reasons.MOVE_DAMAGED,
        lotId: kl8525.lotId,
        toBucket: 'DAMAGED',
      },
    ]);
    expect(
      (await ledger(move)).map((r) => [r.txn_type, Number(r.qty), Number(r.cost_rate), r.bucket]),
    ).toEqual([
      ['BUCKET_OUT', 3, 500, 'SALEABLE'],
      ['BUCKET_IN', 3, 500, 'DAMAGED'],
    ]);
    expect(await lotByMrp(fixture.mrp, 550)).toMatchObject({
      onHand: 19,
      rate: 500,
      value: 9500,
      rates: 1,
    });
    expect(await itemCost(fixture.mrp)).toMatchObject({ qty: 64, value: 18825 });
    expect(await clean(fixture.mrp)).toEqual([]);
  });

  // ── 7. a cancel puts the lot back exactly ────────────────────────────────

  it('7. cancelling the write-off puts the MRP 550 batch back to 20 @ 500 and the item total back by 500', async () => {
    const before = await itemCost(fixture.mrp);
    await attempt(() =>
      service.cancel(
        ADJUSTMENT_OUT_RULES,
        writeOffId,
        ACC_YEAR,
        'notes-92 e2e',
        fixture.companyId,
        fixture.branchId,
        fixture.userId,
      ),
    );
    expect(await lotByMrp(fixture.mrp, 550)).toMatchObject({
      onHand: 20,
      rate: 500,
      value: 10000,
      rates: 1,
    });
    expect(await itemCost(fixture.mrp)).toMatchObject({
      qty: before!.qty + 1,
      value: before!.value + 500,
    });
    expect(await clean(fixture.mrp)).toEqual([]);
  });

  // ── 8. plain stock: exactly as before ────────────────────────────────────

  it('8. a plain item is the item average on every row: 10 @ 15 + 5 @ 21 → 17, a shortage of 3 relieves 51 and leaves 17', async () => {
    await open([{ item: fixture.plain, qty: 10, costRate: 15 }]);
    expect(await itemCost(fixture.plain)).toEqual({ qty: 10, value: 150, avg: 15 });
    await adjust(ADJUSTMENT_IN_RULES, [{ item: fixture.plain, qty: 5, costRate: 21 }]);
    expect(await itemCost(fixture.plain)).toEqual({ qty: 15, value: 255, avg: 17 });
    const [lot] = await lots(fixture.plain);
    expect(lot).toMatchObject({ signature: 'N', onHand: 15, rate: 17, value: 255 });
    const svhId = await count(fixture.plain, { [lot.lotId]: 12 });
    expect(
      (await ledger(svhId)).map((r) => [
        r.txn_type,
        Number(r.qty),
        Number(r.cost_rate),
        Number(r.cost_value),
      ]),
    ).toEqual([['PHYSICAL_MINUS', 3, 17, 51]]);
    expect(await itemCost(fixture.plain)).toEqual({ qty: 12, value: 204, avg: 17 });
    expect((await lots(fixture.plain))[0]).toMatchObject({ onHand: 12, rate: 17, value: 204 });
    expect(await clean(fixture.plain)).toEqual([]);
  });

  // ── 9. the rebuild is idempotent ─────────────────────────────────────────

  it('9. zero every tracked rate and rebuild: the same figures come back, and a second run writes nothing (§5, §7)', async () => {
    const snapshot = async () => ({
      lots: await lots(fixture.mrp),
      item: await itemCost(fixture.mrp),
      rows: await tx.$queryRaw<
        Array<{ id: string; rate: string; wot: string; value: string; vwot: string }>
      >`
        SELECT sbl_id AS id, sbl_avg_cost_rate::text AS rate, sbl_avg_cost_rate_wot::text AS wot,
               sbl_stock_value::text AS value, sbl_stock_value_wot::text AS vwot
          FROM stock.stock_balance WHERE sbl_item_id = ${fixture.mrp.itemId}::uuid AND sbl_is_deleted = false
         ORDER BY sbl_id`,
    });
    const before = await snapshot();
    await tx.$executeRaw`
      UPDATE stock.stock_balance SET sbl_avg_cost_rate = 0, sbl_avg_cost_rate_wot = 0, sbl_stock_value = 0, sbl_stock_value_wot = 0
       WHERE sbl_item_id = ${fixture.mrp.itemId}::uuid`;
    await tx.$executeRaw`
      UPDATE stock.stock_item_cost SET sic_total_qty = 0, sic_total_value = 0, sic_avg_cost_rate = 0
       WHERE sic_item_id = ${fixture.mrp.itemId}::uuid`;
    expect((await lots(fixture.mrp)).every((l) => l.rate === 0)).toBe(true);

    const scope = {
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      itemId: fixture.mrp.itemId,
    };
    const first = await rebuildStockDerivedFigures(tx, scope, fixture.userId, new Date());
    expect(first.lotRates).toBe(before.rows.length);
    expect(first.itemCosts).toBe(1);
    expect(first.stamps).toBe(0); // LOT_ACTUAL: the item average is never stamped
    expect(await snapshot()).toEqual(before);

    const second = await rebuildStockDerivedFigures(tx, scope, fixture.userId, new Date());
    expect(second).toEqual({ balances: 0, lotRates: 0, itemCosts: 0, stamps: 0, lotTotals: 0 });
    expect(await clean(fixture.mrp)).toEqual([]);
  });

  // ── 10. deterministic lot ids ────────────────────────────────────────────

  it('10. a lot’s id is a function of its identity: uuid v5 over the eight key columns (§7.3)', async () => {
    const a1251 = await lotByMrp(fixture.mrp, 40);
    const [row] = await tx.$queryRaw<Array<{ expected: string; version: string }>>`
      SELECT overlay(
               overlay(substr(encode(h.b, 'hex'), 1, 32) placing '5' from 13 for 1)
               placing substr('89ab', ((get_byte(h.b, 8) >> 4) & 3) + 1, 1) from 17 for 1
             )::uuid::text AS expected,
             substr(${a1251.lotId}::text, 15, 1) AS version
        FROM (SELECT digest(
                       decode(replace(${STOCK_LOT_ID_NAMESPACE}::text, '-', ''), 'hex')
                       || convert_to(
                            ${fixture.companyId}::text || '|' || ${fixture.mrp.itemId}::text
                            || '|' || '~' || '|' || (40)::numeric(18, 6)::text || '|' || (-1)::numeric(18, 6)::text
                            || '|' || '0001-01-01' || '|' || '~' || '|' || '00000000-0000-0000-0000-000000000000',
                            'UTF8'),
                       'sha1') AS b) h
    `;
    expect(row.version).toBe('5');
    expect(a1251.lotId).toBe(row.expected);
  });
});
