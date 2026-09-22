import { Prisma, PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import { StockPostingService } from '../src/modules/stocks/posting/stock-posting.service';
import { StockVoucherSource } from '../src/modules/stocks/posting/stock-voucher.source';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';

/**
 * THE TYPESCRIPT POSTING ENGINE, END TO END, against a real database.
 *
 * `stock-voucher-posting.helper.ts` replaces the share's `fn_svh_post` /
 * `fn_sml_apply` on this deployment, and the two engine e2e files beside this
 * one skip because they look for those functions. This file is the acceptance
 * test for what IS here: the seven posting phases, the moving average, the
 * negative-stock policy, the folded lot keys migration 20260908110000 put in
 * the database, and the two guards that moved OUT of it on 2026-09-21: the
 * freeze (now `StockPostingService.assertNotFrozen`, tested against the
 * movement's own timestamp — offline-sync-invariants.md §7b) and the
 * append-only ledger (now structural: one INSERT site, no UPDATE or DELETE,
 * asserted by test/stock-ledger-single-writer.e2e-spec.ts).
 *
 * ONE TRANSACTION, ROLLED BACK. Every statement — fixtures, documents, posts,
 * assertions — runs inside a single interactive transaction that is thrown
 * away at the end, so the suite leaves nothing behind and can run against any
 * database that carries the migration. The service is handed a client whose
 * `$transaction` simply reuses that outer transaction; expected failures are
 * fenced with SAVEPOINTs so a refused post does not abort the rest.
 *
 * THE FIGURES ARE DERIVED BY HAND from the rules the helper states, which are
 * the share's fn_sml_apply rules: an inward re-averages at its own cost, an
 * outward is relieved at the average the branch carried before the document,
 * and the average is stamped onto every holding of the item. If a number here
 * disagrees with the engine, the number is the thing to trust until someone
 * re-derives it.
 *
 *     npm run test:e2e -- stock-engine-ts
 */

const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-04-01';
const COUNT_DATE = '2026-04-02';

/** Byte for byte the record opening-stock-voucher.controller.ts pins. */
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
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  postFunction: 'stock.fn_svh_post',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

/** Byte for byte the record physical-stock-voucher.controller.ts pins. */
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
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  postFunction: 'stock.fn_svh_post',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

/**
 * An OUTWARD quantity document, so the negative-stock policy can be reached: a
 * count cannot drive a holding below zero (a count is never negative), and no
 * outward screen exists yet. The generic engine posts any rules record whose
 * postFunction is fn_svh_post, which is exactly what this is.
 */
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
  postFunction: 'stock.fn_svh_post',
};

/** The inward twin, to receive into a lot a count has just emptied. */
const ADJUSTMENT_IN_RULES: StockVoucherTypeRules = {
  ...ADJUSTMENT_OUT_RULES,
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  ledgerTxnTypes: ['ADJUST_PLUS'],
};

interface Fixture {
  companyId: string;
  branchId: string;
  deviceId: string;
  godownA: string;
  godownB: string;
  userId: string;
  groupId: string;
  saltId: string;
  saltPieceIuc: string;
  milkId: string;
  milkPieceIuc: string;
  teaId: string;
  teaPieceIuc: string;
}

const prisma = new PrismaClient();

/** Thrown at the end of the outer transaction so Prisma rolls it back. */
class Rollback extends Error {}

/**
 * Is the database at the state this file describes? Two things, checked
 * rather than assumed, because each has been wrong on a real box:
 *
 *  * the folded lot key of 20260908110000 is IN — without it case 9 fails for
 *    the wrong reason;
 *  * the ledger triggers of 20260907090000 / 20260908110000 are OUT
 *    (20260922060000 / 20260922120000) — with them still there, case 6 would
 *    be refused by the trigger's wall-clock rule before the service's
 *    doc-datetime rule ever ran, and case 8 would be testing plpgsql.
 */
async function detectBuild(): Promise<{ ready: boolean; missing: string[] }> {
  try {
    const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT DISTINCT tgname FROM pg_trigger
       WHERE tgname IN ('tr_sml_freeze_guard', 'tr_sml_immutable',
                        'tr_sml_forbid_delete', 'tr_sml_forbid_truncate')
    `;
    const [key] = await prisma.$queryRaw<Array<{ expr: string }>>`
      SELECT pg_get_expr(d.adbin, d.adrelid) AS expr
        FROM pg_attribute a
        JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = 'stock.stock_lot'::regclass AND a.attname = 'slt_key_batch'
    `;
    const missing: string[] = triggers.map(
      (row) => `${row.tgname} is still on stock.stock_ledger (run migration 20260922120000)`,
    );
    if (!key?.expr.includes('upper(btrim(')) missing.push('folded slt_key_batch');
    return { ready: missing.length === 0, missing };
  } catch (error) {
    return { ready: false, missing: [`could not reach the database (${String(error)})`] };
  }
}

/**
 * The service's PrismaService, but every call lands on ONE open transaction:
 * `$transaction(fn)` runs `fn` against the same client instead of opening a
 * nested one, and everything else is the transaction client itself.
 */
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

describe('Stock engine in TypeScript (e2e — one rolled-back transaction)', () => {
  let build: { ready: boolean; missing: string[] };
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let service: StockVoucherService;
  let fixture: Fixture;
  let spSeq = 0;

  beforeAll(async () => {
    build = await detectBuild();
    if (!build.ready) {
      console.warn(
        `\n[stock-engine-ts e2e] SKIPPED — this database is not at the 2026-09-21 state.\n` +
          `  Missing: ${build.missing.join(', ')}\n`,
      );
      return;
    }

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

    service = new StockVoucherService(
      transactional(tx),
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService,
      { getUserId: () => fixture?.userId ?? null } as unknown as RequestContextService,
      // §3.1 — the one stock engine, injected. Handed the same client, so a
      // posting call still runs inside whatever transaction the test opened.
      new StockPostingService(transactional(tx)),
    );
    fixture = await createFixture();
  });

  afterAll(async () => {
    if (build?.ready) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  const requireBuild = (): boolean => {
    if (!build.ready) {
      console.warn(`  skipped: ${build.missing.join(', ')}`);
      return false;
    }
    return true;
  };

  // ── fixtures ──────────────────────────────────────────────────────────────

  async function createFixture(): Promise<Fixture> {
    const [scope] = await tx.$queryRaw<
      Array<{ company_id: string; branch_id: string; device_id: string; user_id: string }>
    >`
      SELECT br.br_comp_id AS company_id, br.br_id AS branch_id, dev.dev_id AS device_id, usr.usr_id AS user_id
        FROM public.branch_master br
        JOIN fixed.device_master dev ON dev.dev_branch_id = br.br_id AND dev.dev_is_deleted = false
        JOIN public.user_master usr  ON usr.usr_is_deleted = false
       WHERE br.br_is_deleted = false
         AND (SELECT count(*) FROM inventory.godown_locations g
               WHERE g.gdl_branch_id = br.br_id AND g.gdl_is_deleted = false) >= 2
       LIMIT 1
    `;
    if (!scope) {
      throw new Error('No branch with a device, a user and two godowns on this database.');
    }
    const godowns = await tx.$queryRaw<Array<{ gdl_id: string }>>`
      SELECT gdl_id FROM inventory.godown_locations
       WHERE gdl_branch_id = ${scope.branch_id}::uuid AND gdl_is_deleted = false
       ORDER BY gdl_name LIMIT 2
    `;
    const [group] = await tx.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master LIMIT 1
    `;
    // Any unit will do as a base unit: every quantity here is keyed in it.
    const [piece] = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master ORDER BY unit_name LIMIT 1
    `;
    if (!piece) throw new Error('No item_unit_master row on this database — seed the units first.');

    const createItem = async (code: string, name: string) => {
      const item = await tx.itemMaster.create({
        data: {
          itemCode: code,
          itemNameEn: name,
          itemGroupId: group.itg_id,
          itemCompanyId: scope.company_id,
          itemBranchId: scope.branch_id,
        },
        select: { itemId: true },
      });
      const iuc = await tx.itemUnitConversion.create({
        data: {
          iucItemId: item.itemId,
          iucUnitId: piece.unit_id,
          iucBaseUnitId: piece.unit_id,
          iucToBaseFactor: 1,
          iucUnitSlno: 1,
          iucIsBaseUnit: true,
        },
        select: { iucId: true },
      });
      return { itemId: item.itemId, iuc: iuc.iucId };
    };

    const salt = await createItem('E2E-ENG-SALT', 'EngE2E Salt 1kg');
    const milk = await createItem('E2E-ENG-MILK', 'EngE2E Milk 500ml');
    const tea = await createItem('E2E-ENG-TEA', 'EngE2E Tea 250g');

    return {
      companyId: scope.company_id,
      branchId: scope.branch_id,
      deviceId: scope.device_id,
      godownA: godowns[0].gdl_id,
      godownB: godowns[1].gdl_id,
      userId: scope.user_id,
      groupId: group.itg_id,
      saltId: salt.itemId,
      saltPieceIuc: salt.iuc,
      milkId: milk.itemId,
      milkPieceIuc: milk.iuc,
      teaId: tea.itemId,
      teaPieceIuc: tea.iuc,
    };
  }

  /**
   * A StockTrackPolicy row. FIFO whenever a batch is tracked, because the
   * default FEFO needs an expiry (ck_stp_fefo_needs_expiry).
   */
  async function policy(p: {
    scope: 'ITEM' | 'GROUP';
    scopeId: string;
    branchId?: string | null;
    trackBatch?: boolean;
    trackMrp?: boolean;
    allowNegative?: 'ALLOW' | 'WARN' | 'BLOCK';
  }): Promise<void> {
    // stp_item_id, stp_group_id and stp_track_signature are GENERATED.
    await attempt(
      () => tx.$executeRaw`
        INSERT INTO stock.stock_track_policy (
          stp_company_id, stp_branch_id, stp_scope, stp_scope_id,
          stp_track_batch, stp_track_mrp, stp_issue_strategy,
          stp_allow_negative, stp_remarks)
        VALUES (
          ${fixture.companyId}::uuid, ${p.branchId ?? null}::uuid, ${p.scope}, ${p.scopeId}::uuid,
          ${p.trackBatch ?? false}, ${p.trackMrp ?? false},
          ${p.trackBatch ? 'FIFO' : 'FEFO'}, ${p.allowNegative ?? 'ALLOW'}, 'stock-engine-ts e2e')
      `,
    );
  }

  // ── the transaction fence ────────────────────────────────────────────────

  /**
   * Runs `fn` inside a SAVEPOINT and rolls back to it on failure, then
   * rethrows. The service's own `$transaction` would have rolled a refused
   * post back; here it is the same open transaction, so this does that job —
   * and a SQL error inside `fn` would otherwise abort everything after it.
   */
  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    const name = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
    try {
      const out = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
      return out;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
      throw error;
    }
  }

  /** Runs `fn` and then rolls its effects back whether it succeeded or not. */
  async function undone<T>(fn: () => Promise<T>): Promise<T> {
    const name = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
    try {
      return await fn();
    } finally {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
    }
  }

  // ── documents ────────────────────────────────────────────────────────────

  const header = (godownId: string, extra: Record<string, unknown> = {}) => ({
    accYear: ACC_YEAR,
    companyId: fixture.companyId,
    branchId: fixture.branchId,
    deviceId: fixture.deviceId,
    docDate: DOC_DATE,
    toGodownId: godownId,
    rateSource: 'MANUAL' as const,
    userId: fixture.userId,
    ...extra,
  });

  interface OpeningLine {
    itemId: string;
    iuc: string;
    qty: number;
    costRate: number;
    batchNo?: string;
    mrp?: number;
  }

  async function opening(
    godownId: string,
    lines: OpeningLine[],
    extra: Record<string, unknown> = {},
  ) {
    return service.save(OPENING_RULES, {
      header: header(godownId, extra),
      lines: lines.map((line, index) => ({
        lineNo: index + 1,
        itemId: line.itemId,
        uomId: line.iuc,
        baseUomId: line.iuc,
        toBaseFactor: 1,
        qty: line.qty,
        baseQty: line.qty,
        godownId,
        costRate: line.costRate,
        ...(line.batchNo !== undefined ? { batchNo: line.batchNo } : {}),
        ...(line.mrp !== undefined ? { mrp: line.mrp } : {}),
      })),
    } as never);
  }

  const post = (rules: StockVoucherTypeRules, svhId: string) =>
    attempt(() =>
      service.post(rules, svhId, ACC_YEAR, fixture.companyId, fixture.branchId, fixture.userId),
    );

  const validate = (rules: StockVoucherTypeRules, svhId: string) =>
    service.validate(rules, svhId, ACC_YEAR, fixture.companyId, fixture.branchId);

  /** The count sheet for one godown, reduced to the fixture's own items. */
  async function sheet(godownId: string, itemId: string) {
    const rows = await service.countSheet(PHYSICAL_RULES, {
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      accYear: ACC_YEAR,
      godownId,
    } as never);
    return rows.items.filter((row) => row.itemId === itemId);
  }

  async function count(
    godownId: string,
    itemId: string,
    countedQty: number,
    extra: Record<string, unknown> = {},
  ) {
    const rows = await sheet(godownId, itemId);
    expect(rows).toHaveLength(1);
    return service.save(PHYSICAL_RULES, {
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        deviceId: fixture.deviceId,
        docDate: COUNT_DATE,
        toGodownId: godownId,
        userId: fixture.userId,
        ...extra,
      },
      lines: rows.map((row) => ({
        lineNo: 1,
        itemId: row.itemId,
        godownId: row.godownId,
        bucket: row.bucket,
        lotId: row.lotId,
        countedQty,
      })),
    } as never);
  }

  async function adjustment(
    rules: StockVoucherTypeRules,
    godownId: string,
    itemId: string,
    iuc: string,
    qty: number,
    costRate = 0,
  ) {
    return service.save(rules, {
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        deviceId: fixture.deviceId,
        docDate: COUNT_DATE,
        ...(rules.isInward ? { toGodownId: godownId } : { fromGodownId: godownId }),
        rateSource: costRate ? 'MANUAL' : 'AVG_COST',
        userId: fixture.userId,
      },
      lines: [
        {
          lineNo: 1,
          itemId,
          uomId: iuc,
          baseUomId: iuc,
          toBaseFactor: 1,
          qty,
          baseQty: qty,
          godownId,
          costRate,
        },
      ],
    } as never);
  }

  const adjustmentOut = (godownId: string, itemId: string, iuc: string, qty: number) =>
    adjustment(ADJUSTMENT_OUT_RULES, godownId, itemId, iuc, qty);

  // ── readers ──────────────────────────────────────────────────────────────

  const itemCost = async (itemId: string) => {
    const [row] = await tx.$queryRaw<
      Array<{
        qty: string;
        value: string;
        avg: string;
        max: string;
        last_rate: string;
        last_date: Date | null;
      }>
    >`
      SELECT sic_total_qty::text AS qty, sic_total_value::text AS value,
             sic_avg_cost_rate::text AS avg, sic_max_cost_rate::text AS max,
             sic_last_purchase_rate::text AS last_rate, sic_last_purchase_date AS last_date
        FROM stock.stock_item_cost
       WHERE sic_item_id = ${itemId}::uuid AND sic_branch_id = ${fixture.branchId}::uuid
         AND sic_is_deleted = false
    `;
    return row
      ? {
          qty: Number(row.qty),
          value: Number(row.value),
          avg: Number(row.avg),
          max: Number(row.max),
          lastRate: Number(row.last_rate),
          lastDate: row.last_date?.toISOString().slice(0, 10) ?? null,
        }
      : null;
  };

  const holding = async (itemId: string, godownId: string) => {
    const [row] = await tx.$queryRaw<
      Array<{ on_hand: string; value: string; avg: string; batch_no: string | null }>
    >`
      SELECT sbl_on_hand_qty::text AS on_hand, sbl_stock_value::text AS value,
             sbl_avg_cost_rate::text AS avg, sbl_batch_no AS batch_no
        FROM stock.stock_balance
       WHERE sbl_item_id = ${itemId}::uuid AND sbl_godown_id = ${godownId}::uuid
         AND sbl_is_deleted = false
    `;
    return row
      ? {
          onHand: Number(row.on_hand),
          value: Number(row.value),
          avg: Number(row.avg),
          batchNo: row.batch_no,
        }
      : null;
  };

  const lots = (itemId: string) =>
    tx.$queryRaw<
      Array<{
        slt_id: string;
        batch_no: string | null;
        key_batch: string;
        signature: string;
        mrp: string | null;
        total: string;
        status: string;
        closed_on: Date | null;
      }>
    >`
      SELECT slt_id, slt_batch_no AS batch_no, slt_key_batch AS key_batch,
             slt_track_signature AS signature, slt_mrp::text AS mrp, slt_total_on_hand::text AS total,
             slt_status AS status, slt_closed_on AS closed_on
        FROM stock.stock_lot
       WHERE slt_item_id = ${itemId}::uuid AND slt_is_deleted = false
       ORDER BY slt_created_on
    `;

  const ledger = (svhId: string) =>
    tx.$queryRaw<
      Array<{
        txn_type: string;
        direction: number;
        qty: string;
        cost_rate: string;
        cost_value: string;
      }>
    >`
      SELECT sml_txn_type AS txn_type, sml_direction AS direction, sml_base_qty::text AS qty,
             sml_cost_rate::text AS cost_rate, sml_cost_value::text AS cost_value
        FROM stock.stock_ledger
       WHERE sml_src_doc_id = ${svhId}::uuid AND sml_is_deleted = false
       ORDER BY sml_line_no
    `;

  let firstOpeningId: string;

  // ── 1. the average is seeded by the first receipt ────────────────────────

  it('1. an opening seeds stock_item_cost and stamps the holding: 10 @ 15', async () => {
    if (!requireBuild()) return;

    const saved = await opening(fixture.godownA, [
      { itemId: fixture.saltId, iuc: fixture.saltPieceIuc, qty: 10, costRate: 15 },
    ]);
    firstOpeningId = saved.header.svhId;
    const posted = await post(OPENING_RULES, saved.header.svhId);

    expect(posted.rowsPosted).toBe(1);
    expect(posted.status).toBe('POSTED');

    expect(await itemCost(fixture.saltId)).toEqual({
      qty: 10,
      value: 150,
      avg: 15,
      max: 15,
      lastRate: 15,
      lastDate: DOC_DATE,
    });
    expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({
      onHand: 10,
      value: 150,
      avg: 15,
    });
    const [lot] = await lots(fixture.saltId);
    expect(Number(lot.total)).toBe(10);
    expect(lot.signature).toBe('N');
  });

  // ── 2. a dearer receipt moves the average, and every holding with it ─────

  it('2. a second receipt at 21 re-averages to 17 and restamps BOTH godowns', async () => {
    if (!requireBuild()) return;

    const saved = await opening(fixture.godownB, [
      { itemId: fixture.saltId, iuc: fixture.saltPieceIuc, qty: 5, costRate: 21 },
    ]);
    await post(OPENING_RULES, saved.header.svhId);

    // (150 + 105) / 15
    expect(await itemCost(fixture.saltId)).toMatchObject({
      qty: 15,
      value: 255,
      avg: 17,
      max: 21,
      lastRate: 21,
    });
    // The godown that did NOT move is revalued too: 10 × 17.
    expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({
      onHand: 10,
      value: 170,
      avg: 17,
    });
    expect(await holding(fixture.saltId, fixture.godownB)).toMatchObject({
      onHand: 5,
      value: 85,
      avg: 17,
    });
    const [lot] = await lots(fixture.saltId);
    expect(Number(lot.total)).toBe(15);
  });

  // ── 3. a shortage is relieved at the average; the average stays ──────────

  it('3. a count short by 3 relieves 51.00 at the average and leaves 17 where it was', async () => {
    if (!requireBuild()) return;

    const saved = await count(fixture.godownA, fixture.saltId, 7);
    expect(saved.header.rateSource).toBe('AVG_COST');
    const posted = await post(PHYSICAL_RULES, saved.header.svhId);
    expect(posted.rowsPosted).toBe(1);

    const [row] = await ledger(saved.header.svhId);
    expect(row.txn_type).toBe('PHYSICAL_MINUS');
    expect(Number(row.qty)).toBe(3);
    expect(Number(row.cost_rate)).toBe(17);
    expect(Number(row.cost_value)).toBe(51);

    // 255 − 51 over 12: the average does not move on an outward.
    expect(await itemCost(fixture.saltId)).toMatchObject({ qty: 12, value: 204, avg: 17 });
    expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({
      onHand: 7,
      value: 119,
      avg: 17,
    });
    expect(await holding(fixture.saltId, fixture.godownB)).toMatchObject({ onHand: 5, value: 85 });
    const [lot] = await lots(fixture.saltId);
    expect(Number(lot.total)).toBe(12);
  });

  // ── 4. an overage comes in AT the average — a count is not a revaluation ──

  it('4. a count over by 3 under AVG_COST is valued at 17 and the average is still 17', async () => {
    if (!requireBuild()) return;

    const saved = await count(fixture.godownB, fixture.saltId, 8);
    const posted = await post(PHYSICAL_RULES, saved.header.svhId);
    expect(posted.rowsPosted).toBe(1);

    const [row] = await ledger(saved.header.svhId);
    expect(row.txn_type).toBe('PHYSICAL_PLUS');
    expect(Number(row.cost_rate)).toBe(17);
    expect(Number(row.cost_value)).toBe(51);

    expect(await itemCost(fixture.saltId)).toMatchObject({ qty: 15, value: 255, avg: 17, max: 21 });
    expect(await holding(fixture.saltId, fixture.godownB)).toMatchObject({
      onHand: 8,
      value: 136,
      avg: 17,
    });
    expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({ onHand: 7, value: 119 });
  });

  // ── 5. the negative-stock policy ─────────────────────────────────────────

  it('5. driving a holding below zero is a 409 under BLOCK and goes through under WARN', async () => {
    if (!requireBuild()) return;

    await undone(async () => {
      await policy({ scope: 'ITEM', scopeId: fixture.saltId, allowNegative: 'BLOCK' });

      const blocked = await adjustmentOut(
        fixture.godownA,
        fixture.saltId,
        fixture.saltPieceIuc,
        20,
      );
      await expect(post(ADJUSTMENT_OUT_RULES, blocked.header.svhId)).rejects.toMatchObject({
        status: 409,
      });
      // The refused post left nothing behind: 7 on hand, exactly as before.
      expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({ onHand: 7 });
      expect(await ledger(blocked.header.svhId)).toHaveLength(0);

      await tx.$executeRaw`
        UPDATE stock.stock_track_policy SET stp_allow_negative = 'WARN'
         WHERE stp_scope = 'ITEM' AND stp_scope_id = ${fixture.saltId}::uuid
      `;
      const warned = await adjustmentOut(fixture.godownA, fixture.saltId, fixture.saltPieceIuc, 20);
      const posted = await post(ADJUSTMENT_OUT_RULES, warned.header.svhId);
      expect(posted.rowsPosted).toBe(1);

      expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({ onHand: -13 });
      // 15 − 20 units; value floored at 0; the RATE survives an empty branch.
      expect(await itemCost(fixture.saltId)).toMatchObject({ qty: -5, value: 0, avg: 17 });

      // A FRESH row never starts below zero: TEA has never been received, so
      // its first-ever movement — an outward at a typed cost of 9 — leaves the
      // branch quantity at 0, the value at 0, and the rate at that cost (the
      // trigger's seed from an outward). The balance carries the negative.
      const teaOpening = await adjustment(
        ADJUSTMENT_OUT_RULES,
        fixture.godownA,
        fixture.teaId,
        fixture.teaPieceIuc,
        2,
        9,
      );
      expect((await post(ADJUSTMENT_OUT_RULES, teaOpening.header.svhId)).rowsPosted).toBe(1);
      expect(await itemCost(fixture.teaId)).toMatchObject({
        qty: 0,
        value: 0,
        avg: 9,
        max: 0,
        lastRate: 0,
      });
      expect(await holding(fixture.teaId, fixture.godownA)).toMatchObject({ onHand: -2 });
    });

    // Rolled back to the state after scenario 4.
    expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({ onHand: 7, value: 119 });
    expect(await itemCost(fixture.saltId)).toMatchObject({ qty: 15, value: 255 });
  });

  // ── 6. the freeze ────────────────────────────────────────────────────────

  it('6. a DRAFT count freezing a godown refuses every other movement into it, and only there', async () => {
    if (!requireBuild()) return;

    const now = Date.now();
    const frozenCount = await count(fixture.godownA, fixture.saltId, 6, {
      freezeStock: true,
      freezeFrom: new Date(now - 3_600_000).toISOString(),
      freezeTo: new Date(now + 3_600_000).toISOString(),
    });
    expect(frozenCount.header.status).toBe('DRAFT');

    // (a) The preflight names the count on every line into the frozen godown…
    const intoA = await opening(fixture.godownA, [
      { itemId: fixture.teaId, iuc: fixture.teaPieceIuc, qty: 1, costRate: 10 },
    ]);
    const problems = await validate(OPENING_RULES, intoA.header.svhId);
    expect(problems).toHaveLength(1);
    expect(problems[0].problem).toContain('frozen for physical count');
    expect(problems[0].problem).toContain(frozenCount.header.refno);
    await expect(post(OPENING_RULES, intoA.header.svhId)).rejects.toMatchObject({ status: 422 });

    // …and not on a line into the other godown.
    const intoB = await opening(fixture.godownB, [
      { itemId: fixture.teaId, iuc: fixture.teaPieceIuc, qty: 1, costRate: 10 },
    ]);
    expect(
      (await validate(OPENING_RULES, intoB.header.svhId)).every((row) => row.problem === null),
    ).toBe(true);

    // (b) The guard that used to be tr_sml_freeze_guard is now
    // StockPostingService.assertNotFrozen. Calling the engine DIRECTLY — no
    // preflight, exactly what a sync push does — is refused with a 409 and not
    // one ledger row is written. intoA carries no docDatetime, so it took the
    // database default, now(), which is inside the window.
    const stockPosting = new StockPostingService(transactional(tx));
    const sourceOf = (svhId: string) =>
      new StockVoucherSource({
        svhId,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        rules: OPENING_RULES,
      });
    await expect(
      attempt(() =>
        stockPosting.post(tx, sourceOf(intoA.header.svhId), {
          actor: fixture.userId,
          postedOn: new Date(),
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await ledger(intoA.header.svhId)).toHaveLength(0);

    // (b′) …and this is the part the trigger got WRONG. The window is tested
    // against the MOVEMENT's timestamp, not the wall clock: a movement that
    // happened before the count began is let through for the count to
    // reconcile, even though it arrives while the freeze is on
    // (offline-sync-invariants.md §7b). Undone afterwards so the tea holding
    // does not leak into case 10.
    await undone(async () => {
      const earlier = await opening(
        fixture.godownA,
        [{ itemId: fixture.teaId, iuc: fixture.teaPieceIuc, qty: 1, costRate: 10 }],
        { docDatetime: `${DOC_DATE}T10:00:00.000Z` },
      );
      expect(
        (await validate(OPENING_RULES, earlier.header.svhId)).every((row) => row.problem === null),
      ).toBe(true);
      expect((await post(OPENING_RULES, earlier.header.svhId)).rowsPosted).toBe(1);
      expect(await holding(fixture.teaId, fixture.godownA)).toMatchObject({ onHand: 1 });
    });

    // (c) The count's own posting passes the guard, and posting lifts the freeze.
    const posted = await post(PHYSICAL_RULES, frozenCount.header.svhId);
    expect(posted.rowsPosted).toBe(1);
    expect(posted.status).toBe('POSTED');
    expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({ onHand: 6, value: 102 });
    expect(
      (await validate(OPENING_RULES, intoA.header.svhId)).every((row) => row.problem === null),
    ).toBe(true);
  });

  // ── 7. the lot closes when emptied and reopens on the next receipt ───────

  it('7. counting a lot down to nothing CLOSES it; the next receipt reopens it', async () => {
    if (!requireBuild()) return;

    // After 6: A holds 6, B holds 8; the lot's chain-wide total is 14.
    const [before] = await lots(fixture.saltId);
    expect(before.status).toBe('ACTIVE');
    expect(before.closed_on).toBeNull();

    const emptyA = await count(fixture.godownA, fixture.saltId, 0);
    await post(PHYSICAL_RULES, emptyA.header.svhId);
    const [half] = await lots(fixture.saltId);
    expect(Number(half.total)).toBe(8);
    expect(half.status).toBe('ACTIVE');

    const emptyB = await count(fixture.godownB, fixture.saltId, 0);
    await post(PHYSICAL_RULES, emptyB.header.svhId);
    const [closed] = await lots(fixture.saltId);
    expect(Number(closed.total)).toBe(0);
    expect(closed.status).toBe('CLOSED');
    expect(closed.closed_on).not.toBeNull();
    // Quantity reached zero and the rate survived it: the next inward of an
    // item that went to nil is not a fresh start.
    expect(await itemCost(fixture.saltId)).toMatchObject({ qty: 0, value: 0, avg: 17 });

    // Untracked identity, so the receipt lands on the SAME lot and reopens it.
    const receipt = await adjustment(
      ADJUSTMENT_IN_RULES,
      fixture.godownA,
      fixture.saltId,
      fixture.saltPieceIuc,
      4,
      20,
    );
    expect((await post(ADJUSTMENT_IN_RULES, receipt.header.svhId)).rowsPosted).toBe(1);
    const saltLots = await lots(fixture.saltId);
    expect(saltLots).toHaveLength(1);
    expect(saltLots[0].slt_id).toBe(before.slt_id);
    expect(Number(saltLots[0].total)).toBe(4);
    expect(saltLots[0].status).toBe('ACTIVE');
    expect(saltLots[0].closed_on).toBeNull();
    // 0 + 4 × 20, over 4: the average restarts at the receipt.
    expect(await itemCost(fixture.saltId)).toMatchObject({
      qty: 4,
      value: 80,
      avg: 20,
      max: 21,
      lastRate: 20,
    });
    expect(await holding(fixture.saltId, fixture.godownA)).toMatchObject({
      onHand: 4,
      value: 80,
      avg: 20,
    });
  });

  // ── 8. the ledger is append-only ─────────────────────────────────────────

  it('8. a cancel MIRRORS every row and edits none — the ledger is append-only by construction', async () => {
    if (!requireBuild()) return;

    // tr_sml_immutable and tr_sml_forbid_delete used to refuse an UPDATE or a
    // DELETE here. They are gone (20260922060000 / 20260922120000): the till
    // posts offline and a server-side trigger fires on rows written hours
    // earlier. The rule is now structural — one INSERT site, no UPDATE or
    // DELETE anywhere, which test/stock-ledger-single-writer.e2e-spec.ts
    // asserts against the source — and THIS is what the service does when
    // asked to undo a posting: it writes mirrors and touches the originals
    // not at all. Undone afterwards: milk must still be untouched for case 9.
    await undone(async () => {
      const rowsOf = (svhId: string) =>
        tx.$queryRaw<
          Array<{
            sml_id: string;
            line_no: number;
            direction: number;
            qty: string;
            cost_value: string;
            is_reversal: boolean;
            reverses_id: string | null;
          }>
        >`
          SELECT sml_id, sml_line_no AS line_no, sml_direction AS direction,
                 sml_base_qty::text AS qty, sml_cost_value::text AS cost_value,
                 sml_is_reversal AS is_reversal, sml_reverses_id AS reverses_id
            FROM stock.stock_ledger
           WHERE sml_src_doc_id = ${svhId}::uuid
           ORDER BY sml_is_reversal, sml_line_no
        `;

      const milk = await opening(fixture.godownB, [
        { itemId: fixture.milkId, iuc: fixture.milkPieceIuc, qty: 5, costRate: 28 },
        { itemId: fixture.milkId, iuc: fixture.milkPieceIuc, qty: 2, costRate: 30 },
      ]);
      expect((await post(OPENING_RULES, milk.header.svhId)).rowsPosted).toBe(2);
      const originals = await rowsOf(milk.header.svhId);
      expect(originals).toHaveLength(2);
      expect(originals.every((row) => !row.is_reversal && row.direction === 1)).toBe(true);

      await attempt(() =>
        service.cancel(
          OPENING_RULES,
          milk.header.svhId,
          ACC_YEAR,
          'keyed twice — stock-engine-ts e2e',
          fixture.companyId,
          fixture.branchId,
          fixture.userId,
        ),
      );

      const after = await rowsOf(milk.header.svhId);
      expect(after).toHaveLength(4);
      // The originals: same ids, same quantities, same values, same direction.
      expect(after.filter((row) => !row.is_reversal)).toEqual(originals);
      // The mirrors: one per original, pointing back at it, opposite direction,
      // identical magnitude — so the sum of the document is exactly zero.
      const mirrors = after.filter((row) => row.is_reversal);
      expect(mirrors.map((row) => row.reverses_id).sort()).toEqual(
        originals.map((row) => row.sml_id).sort(),
      );
      for (const mirror of mirrors) {
        const of = originals.find((row) => row.sml_id === mirror.reverses_id);
        expect(mirror.direction).toBe(-(of?.direction ?? 0));
        expect(mirror.qty).toBe(of?.qty);
        expect(mirror.cost_value).toBe(of?.cost_value);
      }
      expect(await holding(fixture.milkId, fixture.godownB)).toMatchObject({ onHand: 0 });
    });
  });

  // ── 9. batch identity folds case and whitespace ───────────────────────────

  it("9. 'b-2604' and 'B-2604 ' are one lot, and the second opening of it is refused", async () => {
    if (!requireBuild()) return;

    await policy({ scope: 'ITEM', scopeId: fixture.milkId, trackBatch: true });

    const first = await opening(fixture.godownA, [
      {
        itemId: fixture.milkId,
        iuc: fixture.milkPieceIuc,
        qty: 5,
        costRate: 28,
        batchNo: 'b-2604',
      },
    ]);
    await post(OPENING_RULES, first.header.svhId);

    const milkLots = await lots(fixture.milkId);
    expect(milkLots).toHaveLength(1);
    expect(milkLots[0].batch_no).toBe('b-2604');
    expect(milkLots[0].key_batch).toBe('B-2604');
    expect(milkLots[0].signature).toBe('B');
    expect(await holding(fixture.milkId, fixture.godownA)).toMatchObject({
      onHand: 5,
      batchNo: 'b-2604',
    });

    const second = await opening(fixture.godownA, [
      {
        itemId: fixture.milkId,
        iuc: fixture.milkPieceIuc,
        qty: 5,
        costRate: 28,
        batchNo: 'B-2604 ',
      },
    ]);
    const problems = await validate(OPENING_RULES, second.header.svhId);
    expect(problems[0].problem).toBe('this holding already has an opening in this year');
  });

  // ── 10. precedence: an ITEM rule beats a branch-level GROUP rule ─────────

  it('10. a company-wide ITEM policy outranks a branch-level GROUP policy', async () => {
    if (!requireBuild()) return;

    await policy({
      scope: 'GROUP',
      scopeId: fixture.groupId,
      branchId: fixture.branchId,
      trackMrp: true,
    });
    await policy({ scope: 'ITEM', scopeId: fixture.teaId, trackBatch: true });

    const saved = await opening(fixture.godownA, [
      {
        itemId: fixture.teaId,
        iuc: fixture.teaPieceIuc,
        qty: 3,
        costRate: 10,
        batchNo: 'T1',
        mrp: 12,
      },
    ]);
    await post(OPENING_RULES, saved.header.svhId);

    const [lot] = await lots(fixture.teaId);
    // Scope first: the ITEM rule tracks the batch and ignores the MRP the
    // branch GROUP rule asked for. Branch-first ordering would say 'M'.
    expect(lot.signature).toBe('B');
    expect(lot.batch_no).toBe('T1');
    expect(lot.mrp).toBeNull();
  });
});
