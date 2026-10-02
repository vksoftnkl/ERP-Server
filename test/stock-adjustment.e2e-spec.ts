import { Prisma, PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { AppSettingValueService } from '../src/modules/settings/appSettings/app-setting-value.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import { StockAdjustmentService } from '../src/modules/stocks/stock-adjustment/stock-adjustment.service';
import { StockReasonsService } from '../src/modules/stocks/stock-adjustment/stock-reasons.service';
import { assertStockBalances } from '../src/modules/stocks/posting/stock-balance-assertion';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { STOCK_ADJUSTMENT_RULES, type StockAdjustmentSaveKind } from '../src/modules/stocks/stock-adjustment/stock-adjustment.rules';
import { buildStockPosting } from './helpers/stock-posting.factory';

/**
 * THE ADJUSTMENT FAMILY, END TO END (plan-nestjs-stock-adjustments §7), in
 * one rolled-back transaction like `stock-engine-ts.e2e-spec.ts`. Cases 10–14
 * are "Move stock" (notes 60): the bucket pair, the refusals, the cancel.
 * Cases 15–18 are the notes 65 fixes: a same-lot re-lot, signed header totals,
 * the every-bucket picker and the sales shadow vouchers.
 *
 *     npm run test:e2e -- stock-adjustment
 */

const ACC_YEAR = '2026-2027';
const OPEN_DATE = '2026-04-01';
const DOC_DATE = '2026-04-02';

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
  statusDocType: TxnStatusDocType.OPENING_STOCK,
  postShape: 'SIMPLE',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

interface Item {
  itemId: string;
  iuc: string;
}
interface Fixture {
  companyId: string;
  branchId: string;
  deviceId: string;
  godownA: string;
  userId: string;
  groupId: string;
  salt: Item;
  sugar: Item;
  tea: Item;
  milk: Item;
  /** Batch + supplier tracked: the lot names the supplier a damaged carton goes back to. */
  soap: Item;
  supplierId: string;
}
type Reasons = Record<
  | 'FOUND'
  | 'PILFERAGE'
  | 'INTERNAL'
  | 'DAMAGE'
  | 'EXPIRY'
  | 'RELOT_OUT'
  | 'RELOT_IN'
  | 'SAMPLE'
  | 'MOVE_DAMAGED'
  | 'MOVE_SALEABLE'
  | 'E2E_BOTH',
  string
>;

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

describe('Stock adjustments (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let voucherService: StockVoucherService;
  let service: StockAdjustmentService;
  let reasonsService: StockReasonsService;
  let fixture: Fixture;
  let reasons: Reasons;
  let spSeq = 0;
  let ready = false;

  beforeAll(async () => {
    await new Promise<void>((resolveReady, fail) => {
      txDone = prisma
        .$transaction(
          async (client) => {
            tx = client;
            resolveReady();
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
    const { stockPosting } = buildStockPosting(transactional(tx));
    voucherService = new StockVoucherService(
      transactional(tx),
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService,
      ctx,
      stockPosting,
    );
    // No grace on expiry write-offs: only lots that HAVE expired.
    const settings = { resolveEffective: async () => [] } as unknown as AppSettingValueService;
    service = new StockAdjustmentService(transactional(tx), voucherService, ctx, settings);
    reasonsService = new StockReasonsService(transactional(tx), ctx);
    fixture = await createFixture();
    await tx.$queryRaw`SELECT accounts.fn_seed_ledger_map()`;
    reasons = await loadReasons();
    ready = true;
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
    const [group] = await tx.$queryRaw<Array<{ itg_id: string }>>`SELECT itg_id FROM inventory.item_group_master LIMIT 1`;
    const [unit] = await tx.$queryRaw<Array<{ unit_id: string }>>`SELECT unit_id FROM inventory.item_unit_master ORDER BY unit_name LIMIT 1`;
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
    const [salt, sugar, tea, milk, soap] = await Promise.all([
      createItem('E2E-ADJ-SALT', 'AdjE2E Salt'),
      createItem('E2E-ADJ-SUGAR', 'AdjE2E Sugar'),
      createItem('E2E-ADJ-TEA', 'AdjE2E Tea'),
      createItem('E2E-ADJ-MILK', 'AdjE2E Milk'),
      createItem('E2E-ADJ-SOAP', 'AdjE2E Soap'),
    ]);
    // TEA is batch-tracked (FIFO); MILK batch + expiry (FEFO); SOAP batch +
    // supplier (FIFO), so its lot says whom a damaged carton goes back to.
    await tx.$executeRaw`
      INSERT INTO stock.stock_track_policy (
        stp_company_id, stp_scope, stp_scope_id, stp_track_batch, stp_track_expiry, stp_track_supplier, stp_issue_strategy, stp_remarks)
      VALUES (${scope.company_id}::uuid, 'ITEM', ${tea.itemId}::uuid, true, false, false, 'FIFO', 'stock-adjustment e2e'),
             (${scope.company_id}::uuid, 'ITEM', ${milk.itemId}::uuid, true, true, false, 'FEFO', 'stock-adjustment e2e'),
             (${scope.company_id}::uuid, 'ITEM', ${soap.itemId}::uuid, true, false, true, 'FIFO', 'stock-adjustment e2e')
    `;
    const [supplier] = await tx.$queryRaw<Array<{ sup_id: string }>>`
      SELECT sup_id FROM purchase.suppliers
       WHERE sup_is_deleted = false AND (sup_company_id IS NULL OR sup_company_id = ${scope.company_id}::uuid)
       ORDER BY sup_name LIMIT 1
    `;
    if (!supplier) throw new Error('No purchase.suppliers row on this database for the move fixture.');
    return {
      companyId: scope.company_id,
      branchId: scope.branch_id,
      deviceId: scope.device_id,
      godownA: godown.gdl_id,
      userId: scope.user_id,
      groupId: group.itg_id,
      salt,
      sugar,
      tea,
      milk,
      soap,
      supplierId: supplier.sup_id,
    };
  }

  async function loadReasons(): Promise<Reasons> {
    // A BOTH reason usable on an ADJUSTMENT: the seed's BOTH rows are counts-only.
    await tx.$executeRaw`
      INSERT INTO stock.stock_reason_master (srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types, srm_require_remarks, srm_sort_order)
      VALUES (${fixture.companyId}::uuid, 'E2E_BOTH', 'Either way (e2e)', 'BOTH', ARRAY[]::text[], false, 900)
    `;
    const rows = await tx.$queryRaw<Array<{ srm_code: string; srm_id: string }>>`
      SELECT srm_code, srm_id FROM stock.stock_reason_master
       WHERE srm_is_deleted = false
         AND ((srm_company_id IS NULL AND srm_code IN ('FOUND','PILFERAGE','INTERNAL','DAMAGE','EXPIRY','RELOT_OUT','RELOT_IN','SAMPLE','MOVE_DAMAGED','MOVE_SALEABLE'))
              OR (srm_company_id = ${fixture.companyId}::uuid AND srm_code = 'E2E_BOTH'))
    `;
    const out = Object.fromEntries(rows.map((r) => [r.srm_code, r.srm_id])) as Reasons;
    for (const code of ['FOUND', 'PILFERAGE', 'INTERNAL', 'DAMAGE', 'EXPIRY', 'RELOT_OUT', 'RELOT_IN', 'SAMPLE', 'MOVE_DAMAGED', 'MOVE_SALEABLE', 'E2E_BOTH']) {
      if (!out[code as keyof Reasons]) throw new Error(`Seed reason ${code} missing — run prisma/seed/Stock_Reason_Master.sql`);
    }
    return out;
  }

  /** Runs `fn` inside a SAVEPOINT and rolls back to it on failure, then rethrows. */
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

  // ── documents ────────────────────────────────────────────────────────────

  interface OpeningLine {
    item: Item;
    qty: number;
    costRate: number;
    batchNo?: string;
    expiryDate?: string;
    supplierId?: string;
  }
  async function open(lines: OpeningLine[]): Promise<string> {
    const saved = await voucherService.save(OPENING_RULES, {
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        deviceId: fixture.deviceId,
        docDate: OPEN_DATE,
        toGodownId: fixture.godownA,
        rateSource: 'MANUAL',
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
        godownId: fixture.godownA,
        costRate: line.costRate,
        ...(line.batchNo ? { batchNo: line.batchNo } : {}),
        ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
        ...(line.supplierId ? { supplierId: line.supplierId } : {}),
      })),
    } as never);
    await attempt(() =>
      voucherService.post(OPENING_RULES, saved.header.svhId, ACC_YEAR, fixture.companyId, fixture.branchId, fixture.userId),
    );
    return saved.header.svhId;
  }

  interface AdjLine {
    item: Item;
    qty: number;
    reasonId?: string;
    lotId?: string | null;
    remarks?: string;
    costRate?: number;
    batchNo?: string;
    expiryDate?: string;
    bucket?: string;
    toBucket?: string;
  }
  /** A refusal's per-line messages ride on the thrown error's text, so a failed case says WHY. */
  const explained = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      const err = e as Error & { status?: number; response?: unknown };
      if (err.response) {
        err.message = `${err.message}: ${JSON.stringify(err.response)}`;
      }
      throw err;
    }
  };
  const adjustment = (kind: StockAdjustmentSaveKind, lines: AdjLine[], extra: Record<string, unknown> = {}) =>
    explained(() => attempt(() =>
      service.save({
        header: {
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchId,
          deviceId: fixture.deviceId,
          docDate: DOC_DATE,
          voucherType: kind,
          fromGodownId: fixture.godownA,
          userId: fixture.userId,
          ...extra,
        },
        lines: lines.map((line, index) => ({
          lineNo: index + 1,
          itemId: line.item.itemId,
          uomId: line.item.iuc,
          baseUomId: line.item.iuc,
          toBaseFactor: 1,
          qty: line.qty,
          baseQty: line.qty,
          godownId: fixture.godownA,
          ...(line.reasonId ? { reasonId: line.reasonId } : {}),
          ...(line.lotId !== undefined ? { lotId: line.lotId } : {}),
          ...(line.remarks ? { remarks: line.remarks } : {}),
          ...(line.costRate !== undefined ? { costRate: line.costRate } : {}),
          ...(line.batchNo ? { batchNo: line.batchNo } : {}),
          ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
          ...(line.bucket ? { bucket: line.bucket } : {}),
          ...(line.toBucket ? { toBucket: line.toBucket } : {}),
        })),
      } as never),
    ));
  const post = (svhId: string) =>
    explained(() => attempt(() =>
      service.post({ svhId, accYear: ACC_YEAR, companyId: fixture.companyId, branchId: fixture.branchId, userId: fixture.userId }),
    ));

  // ── readers ──────────────────────────────────────────────────────────────

  const ledger = (svhId: string) =>
    tx.$queryRaw<
      Array<{ line_no: number; split_no: number; txn_type: string; direction: number; qty: string; cost_rate: string; cost_value: string; is_reversal: boolean; lot_id: string; bucket: string }>
    >`
      SELECT sml_line_no AS line_no, sml_split_no AS split_no, sml_txn_type AS txn_type, sml_direction AS direction,
             sml_base_qty::text AS qty, sml_cost_rate::text AS cost_rate, sml_cost_value::text AS cost_value,
             sml_is_reversal AS is_reversal, sml_lot_id AS lot_id, sml_bucket AS bucket
        FROM stock.stock_ledger
       WHERE sml_src_doc_id = ${svhId}::uuid AND sml_acc_year = ${ACC_YEAR}::bpchar
       ORDER BY sml_is_reversal, sml_line_no, sml_split_no
    `;
  const legs = (kind: string, svhId: string) =>
    tx.$queryRaw<
      Array<{ avh_voucher_id: string; avh_voucher_status: string; vchr_type_code: string; av_dr_cr: string; av_amount: string; av_role: string | null }>
    >`
      SELECT h.avh_voucher_id, h.avh_voucher_status, t.vchr_type_code, l.av_dr_cr, l.av_amount::text, l.av_role
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
        JOIN accounts.acc_vouchers l ON l.av_voucher_id = h.avh_voucher_id AND l.av_is_deleted = false
       WHERE h.avh_src_module = 'STOCK' AND h.avh_src_doc_type = ${kind}
         AND h.avh_src_doc_id = ${svhId}::uuid AND h.avh_is_deleted = false
       ORDER BY l.av_row_no
    `;
  const itemCost = async (item: Item) => {
    const [row] = await tx.$queryRaw<Array<{ qty: string; value: string; avg: string }>>`
      SELECT sic_total_qty::text AS qty, sic_total_value::text AS value, sic_avg_cost_rate::text AS avg
        FROM stock.stock_item_cost WHERE sic_item_id = ${item.itemId}::uuid AND sic_branch_id = ${fixture.branchId}::uuid
    `;
    return row ? { qty: Number(row.qty), value: Number(row.value), avg: Number(row.avg) } : null;
  };
  /** The stamps a purchase leaves — a move must leave them alone. */
  const lastPurchase = async (item: Item) => {
    const [row] = await tx.$queryRaw<Array<{ rate: string; on: Date | null; max: string }>>`
      SELECT sic_last_purchase_rate::text AS rate, sic_last_purchase_date AS on, sic_max_cost_rate::text AS max
        FROM stock.stock_item_cost WHERE sic_item_id = ${item.itemId}::uuid AND sic_branch_id = ${fixture.branchId}::uuid
    `;
    return row ? { rate: Number(row.rate), on: row.on?.toISOString().slice(0, 10) ?? null, max: Number(row.max) } : null;
  };
  const holdings = (item: Item, bucket: 'SALEABLE' | 'DAMAGED') =>
    service.pickStock({ companyId: fixture.companyId, branchId: fixture.branchId, godownId: fixture.godownA, itemId: item.itemId, bucket });
  const lots = (item: Item) =>
    tx.$queryRaw<Array<{ slt_id: string; batch_no: string | null; total: string; status: string }>>`
      SELECT slt_id, slt_batch_no AS batch_no, slt_total_on_hand::text AS total, slt_status AS status
        FROM stock.stock_lot WHERE slt_item_id = ${item.itemId}::uuid ORDER BY slt_created_on
    `;
  const header = async (svhId: string) => {
    const [row] = await tx.$queryRaw<Array<{ status: string; qty: string; value: string; lines: number }>>`
      SELECT svh_status AS status, svh_total_qty::text AS qty, svh_total_value::text AS value, svh_line_count AS lines
        FROM stock.stock_voucher WHERE svh_id = ${svhId}::uuid
    `;
    return { status: row.status, qty: Number(row.qty), value: Number(row.value), lines: row.lines };
  };
  const balancesAgree = async (item: Item) =>
    (await assertStockBalances(tx, { companyId: fixture.companyId, branchId: fixture.branchId, itemId: item.itemId })).length;
  const refusal = (e: unknown): string => JSON.stringify((e as { response?: unknown }).response ?? String(e));

  // ── the cases ────────────────────────────────────────────────────────────

  let adjOneId: string;

  it('1. an ADJUSTMENT with one + and one − line: two rows, the average moves only on the inward, one Stock Journal with both pairs', async () => {
    expect(ready).toBe(true);
    await open([{ item: fixture.salt, qty: 10, costRate: 20 }]);
    const before = await itemCost(fixture.salt);
    expect(before).toEqual({ qty: 10, value: 200, avg: 20 });

    const saved = await adjustment(
      'ADJUSTMENT',
      [
        { item: fixture.salt, qty: 5, reasonId: reasons.FOUND, remarks: 'found behind the rack', costRate: 30 },
        { item: fixture.salt, qty: 2, reasonId: reasons.INTERNAL },
      ],
      { rateSource: 'MANUAL' },
    );
    adjOneId = saved.header.svhId;
    expect(saved.header.status).toBe('DRAFT');
    expect(saved.lines.map((l) => l.direction)).toEqual([1, -1]);

    const problems = await service.validate(adjOneId, ACC_YEAR, fixture.companyId, fixture.branchId);
    expect(problems.map((p) => p.problem)).toEqual([null, null]);

    const posted = await post(adjOneId);
    expect(posted.rowsPosted).toBe(2);
    const rows = await ledger(adjOneId);
    expect(rows.map((r) => [r.txn_type, Number(r.direction), Number(r.qty), Number(r.cost_rate), Number(r.cost_value)])).toEqual([
      ['ADJUST_PLUS', 1, 5, 30, 150],
      // Relieved at the average the branch carried BEFORE the document (20),
      // whatever the header's rate source and whatever was keyed.
      ['ADJUST_MINUS', -1, 2, 20, 40],
    ]);
    // 10 − 2 at 20 = 160, + 5 at 30 = 310 over 13.
    const after = await itemCost(fixture.salt);
    expect(after?.qty).toBeCloseTo(13, 6);
    expect(after?.value).toBeCloseTo(310, 2);
    expect(after?.avg).toBeCloseTo(23.846154, 5);
    // The header carries the NET: +3 units, +110.00.
    const hdr = await header(adjOneId);
    expect(hdr.status).toBe('POSTED');
    expect(hdr.qty).toBeCloseTo(3, 6);
    expect(hdr.value).toBeCloseTo(110, 2);
    expect(hdr.lines).toBe(2);

    // One Stock Journal: DR STOCK_SHORTAGE 40 / CR STOCK_EXCESS 150 / INVENTORY nets DR 110.
    const voucher = await legs('ADJUSTMENT', adjOneId);
    expect(new Set(voucher.map((l) => l.avh_voucher_id)).size).toBe(1);
    expect(voucher[0].vchr_type_code).toBe('StkAdj');
    const byRole = new Map(voucher.map((l) => [l.av_role, l]));
    expect(byRole.get('STOCK_SHORTAGE')?.av_dr_cr.trim()).toBe('DR');
    expect(Number(byRole.get('STOCK_SHORTAGE')?.av_amount)).toBeCloseTo(40, 2);
    expect(byRole.get('STOCK_EXCESS')?.av_dr_cr.trim()).toBe('CR');
    expect(Number(byRole.get('STOCK_EXCESS')?.av_amount)).toBeCloseTo(150, 2);
    expect(byRole.get('INVENTORY')?.av_dr_cr.trim()).toBe('DR');
    expect(Number(byRole.get('INVENTORY')?.av_amount)).toBeCloseTo(110, 2);
    expect(await balancesAgree(fixture.salt)).toBe(0);
  });

  it('2. a BOTH reason takes its sign from the quantity; an IN reason with a negative quantity is refused', async () => {
    const saved = await adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: -3, reasonId: reasons.E2E_BOTH }]);
    expect(saved.lines[0].direction).toBe(-1);
    expect(saved.lines[0].qty).toBe(3);
    const posted = await post(saved.header.svhId);
    expect(posted.rowsPosted).toBe(1);
    const [row] = await ledger(saved.header.svhId);
    expect([row.txn_type, Number(row.direction), Number(row.qty)]).toEqual(['ADJUST_MINUS', -1, 3]);

    await expect(
      adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: -2, reasonId: reasons.FOUND, remarks: 'x' }]),
    ).rejects.toMatchObject({ status: 422 });
    // A BOTH reason with an unsigned intent is a mistake too: the sign IS the direction.
    await expect(adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: 0, reasonId: reasons.E2E_BOTH }])).rejects.toMatchObject({ status: 422 });
    expect(await balancesAgree(fixture.salt)).toBe(0);
  });

  it('3. a reason that requires remarks refuses a line without one, and a line without any reason is refused', async () => {
    let caught: unknown;
    await adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: 1, reasonId: reasons.PILFERAGE }]).catch((e) => (caught = e));
    expect(caught).toMatchObject({ status: 422 });
    expect(refusal(caught)).toMatch(/requires a remark/);

    caught = undefined;
    await adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: 1 }]).catch((e) => (caught = e));
    expect(caught).toMatchObject({ status: 422 });
    expect(refusal(caught)).toMatch(/names no reason/);
  });

  it('4. a DAMAGE beyond what the godown holds is refused — BLOCK whatever the item says', async () => {
    await open([{ item: fixture.sugar, qty: 10, costRate: 5 }]);
    const [holding] = await service.pickStock({
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      godownId: fixture.godownA,
      itemId: fixture.sugar.itemId,
    });
    expect(holding.availableQty).toBeCloseTo(10, 6);

    // Named lot: refused at save, naming what the godown holds.
    let caught: unknown;
    await adjustment('DAMAGE', [{ item: fixture.sugar, qty: 12, reasonId: reasons.DAMAGE, lotId: holding.lotId, remarks: 'dropped' }]).catch(
      (e) => (caught = e),
    );
    expect(caught).toMatchObject({ status: 422 });
    expect(refusal(caught)).toMatch(/holds 10/);

    // No lot: the engine picks, runs out, and BLOCKs at post — SUGAR has no
    // policy at all, i.e. ALLOW by default, and it is still refused.
    const lotless = await adjustment('DAMAGE', [{ item: fixture.sugar, qty: 12, reasonId: reasons.DAMAGE, remarks: 'dropped' }]);
    await expect(post(lotless.header.svhId)).rejects.toMatchObject({ status: 409 });
    expect((await ledger(lotless.header.svhId)).length).toBe(0);

    // What the godown holds writes off, as DAMAGE rows valued at the average.
    const ok = await adjustment('DAMAGE', [{ item: fixture.sugar, qty: 4, reasonId: reasons.DAMAGE, lotId: holding.lotId, remarks: 'dropped' }]);
    const posted = await post(ok.header.svhId);
    expect(posted.rowsPosted).toBe(1);
    const [row] = await ledger(ok.header.svhId);
    expect([row.txn_type, Number(row.direction), Number(row.qty), Number(row.cost_value)]).toEqual(['DAMAGE', -1, 4, 20]);
    const voucher = await legs('DAMAGE', ok.header.svhId);
    expect(voucher.find((l) => l.av_role === 'STOCK_SHORTAGE')?.av_dr_cr.trim()).toBe('DR');
    expect(Number(voucher.find((l) => l.av_role === 'INVENTORY')?.av_amount)).toBeCloseTo(20, 2);
    expect(await balancesAgree(fixture.sugar)).toBe(0);
  });

  it('5. an EXPIRY_WRITEOFF on an unexpired lot is refused; on an expired one it posts', async () => {
    await open([
      { item: fixture.milk, qty: 3, costRate: 12, batchNo: 'M-OLD', expiryDate: '2026-03-01' },
      { item: fixture.milk, qty: 3, costRate: 12, batchNo: 'M-MAY', expiryDate: '2026-05-01' },
      { item: fixture.milk, qty: 4, costRate: 12, batchNo: 'M-JUN', expiryDate: '2026-06-01' },
    ]);
    const milkLots = await lots(fixture.milk);
    const old = milkLots.find((l) => l.batch_no === 'M-OLD') as { slt_id: string };
    const may = milkLots.find((l) => l.batch_no === 'M-MAY') as { slt_id: string };

    let caught: unknown;
    await adjustment('EXPIRY_WRITEOFF', [{ item: fixture.milk, qty: 3, reasonId: reasons.EXPIRY, lotId: may.slt_id }]).catch((e) => (caught = e));
    expect(caught).toMatchObject({ status: 422 });
    expect(refusal(caught)).toMatch(/Not expired yet/);
    // …and one that names no lot at all.
    await expect(adjustment('EXPIRY_WRITEOFF', [{ item: fixture.milk, qty: 1, reasonId: reasons.EXPIRY }])).rejects.toMatchObject({ status: 422 });

    const ok = await adjustment('EXPIRY_WRITEOFF', [{ item: fixture.milk, qty: 3, reasonId: reasons.EXPIRY, lotId: old.slt_id }]);
    const posted = await post(ok.header.svhId);
    expect(posted.rowsPosted).toBe(1);
    const [row] = await ledger(ok.header.svhId);
    expect([row.txn_type, Number(row.direction), Number(row.qty), row.lot_id]).toEqual(['EXPIRY_WRITEOFF', -1, 3, old.slt_id]);
    expect((await lots(fixture.milk)).find((l) => l.batch_no === 'M-OLD')?.status).toBe('CLOSED');
    expect(await balancesAgree(fixture.milk)).toBe(0);
  });

  it('6. a re-lot pair moves the quantity, carries the value, posts no accounts voucher and closes the old lot', async () => {
    await open([{ item: fixture.tea, qty: 5, costRate: 10, batchNo: 'WRONG' }]);
    const [wrong] = await lots(fixture.tea);
    const before = await itemCost(fixture.tea);

    // A half on its own is shrinkage: refused.
    await expect(
      adjustment('ADJUSTMENT', [{ item: fixture.tea, qty: 5, reasonId: reasons.RELOT_OUT, lotId: wrong.slt_id, remarks: 'wrong batch keyed' }]),
    ).rejects.toMatchObject({ status: 422 });

    const saved = await adjustment('ADJUSTMENT', [
      { item: fixture.tea, qty: 5, reasonId: reasons.RELOT_OUT, lotId: wrong.slt_id, remarks: 'wrong batch keyed' },
      { item: fixture.tea, qty: 5, reasonId: reasons.RELOT_IN, batchNo: 'RIGHT', remarks: 'wrong batch keyed' },
    ]);
    expect(saved.header.rateSource).toBe('AVG_COST');
    const posted = await post(saved.header.svhId);
    expect(posted.rowsPosted).toBe(2);
    const rows = await ledger(saved.header.svhId);
    expect(rows.map((r) => [r.txn_type, Number(r.direction), Number(r.qty), Number(r.cost_rate)])).toEqual([
      ['ADJUST_MINUS', -1, 5, 10],
      ['ADJUST_PLUS', 1, 5, 10],
    ]);
    const teaLots = await lots(fixture.tea);
    expect(teaLots.find((l) => l.batch_no === 'WRONG')).toMatchObject({ status: 'CLOSED' });
    expect(Number(teaLots.find((l) => l.batch_no === 'WRONG')?.total)).toBeCloseTo(0, 6);
    expect(Number(teaLots.find((l) => l.batch_no === 'RIGHT')?.total)).toBeCloseTo(5, 6);
    // Nothing gained or lost: the branch figures and the books are untouched.
    expect(await itemCost(fixture.tea)).toEqual(before);
    expect(await legs('ADJUSTMENT', saved.header.svhId)).toHaveLength(0);
    expect(await balancesAgree(fixture.tea)).toBe(0);
  });

  it('7. a lotless ISSUE on a FEFO item is split across the earliest-expiry lots, and the reason names its txn type', async () => {
    // MILK after case 5: M-MAY 3, M-JUN 4.
    const saved = await adjustment('ISSUE', [{ item: fixture.milk, qty: 5, reasonId: reasons.INTERNAL }]);
    const problems = await service.validate(saved.header.svhId, ACC_YEAR, fixture.companyId, fixture.branchId);
    expect(problems.map((p) => p.problem)).toEqual([null]);
    const posted = await post(saved.header.svhId);
    expect(posted.rowsPosted).toBe(2);
    const milkLots = await lots(fixture.milk);
    const lotOf = (batch: string) => milkLots.find((l) => l.batch_no === batch)?.slt_id;
    const rows = await ledger(saved.header.svhId);
    expect(rows.map((r) => [r.line_no, r.split_no, r.txn_type, Number(r.qty), r.lot_id])).toEqual([
      [1, 1, 'ADJUST_MINUS', 3, lotOf('M-MAY')],
      [1, 2, 'ADJUST_MINUS', 2, lotOf('M-JUN')],
    ]);
    expect(Number(milkLots.find((l) => l.batch_no === 'M-JUN')?.total)).toBeCloseTo(2, 6);

    // SAMPLE lists exactly one issue type, so the ISSUE posts SAMPLE_ISSUE.
    const sample = await adjustment('ISSUE', [{ item: fixture.milk, qty: 1, reasonId: reasons.SAMPLE }]);
    await post(sample.header.svhId);
    expect((await ledger(sample.header.svhId))[0].txn_type).toBe('SAMPLE_ISSUE');
    expect(await balancesAgree(fixture.milk)).toBe(0);
  });

  it('8. a cancel mirrors every row, reverses the Stock Journal and re-totals the header to 0', async () => {
    const before = await itemCost(fixture.salt);
    const cancelled = await attempt(() =>
      service.cancel({ svhId: adjOneId, accYear: ACC_YEAR, companyId: fixture.companyId, branchId: fixture.branchId, reason: 'e2e reversal', userId: fixture.userId }),
    );
    expect(cancelled.rowsReversed).toBe(2);
    const rows = await ledger(adjOneId);
    expect(rows.filter((r) => r.is_reversal)).toHaveLength(2);
    const hdr = await header(adjOneId);
    expect(hdr.status).toBe('CANCELLED');
    expect(hdr.qty).toBeCloseTo(0, 6);
    expect(hdr.value).toBeCloseTo(0, 2);
    expect(hdr.lines).toBe(2);
    // The original voucher is CANCELLED and a Rev mirror stands beside it.
    const voucher = await legs('ADJUSTMENT', adjOneId);
    expect(voucher.every((l) => l.avh_voucher_status === 'CANCELLED')).toBe(true);
    const [mirror] = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM accounts.acc_voucher_header
       WHERE avh_against_voucher_id = ${voucher[0].avh_voucher_id}::uuid AND avh_voucher_status = 'POSTED'
    `;
    expect(Number(mirror.n)).toBe(1);
    // The reversal of +5 at 30 and −2 at 20 puts the branch back where case 2 left it.
    const after = await itemCost(fixture.salt);
    expect(after?.qty).toBeCloseTo((before?.qty ?? 0) - 3, 6);
    expect(await balancesAgree(fixture.salt)).toBe(0);
  });

  it('9. the reason picker hides a shared row the company overrides, and the maintenance rules hold', async () => {
    const picked = await reasonsService.pick({ companyId: fixture.companyId, voucherType: 'DAMAGE' });
    expect(picked.map((r) => r.code)).toContain('DAMAGE');
    expect(picked.map((r) => r.code)).not.toContain('FOUND');
    const forIssue = await reasonsService.pick({ companyId: fixture.companyId, voucherType: 'ISSUE', direction: 'OUT' });
    expect(forIssue.map((r) => r.code)).toEqual(expect.arrayContaining(['INTERNAL', 'SAMPLE', 'PILFERAGE']));

    // The company's own DAMAGE hides the shared one in the picker and is
    // flagged on the list.
    const own = await reasonsService.save({
      companyId: fixture.companyId,
      code: 'DAMAGE',
      name: 'Damaged (ours)',
      direction: 'OUT',
      allowedTxnTypes: ['DAMAGE'],
      requireRemarks: false,
    });
    expect(own.isShared).toBe(false);
    const again = await reasonsService.pick({ companyId: fixture.companyId, voucherType: 'DAMAGE' });
    expect(again.filter((r) => r.code === 'DAMAGE')).toHaveLength(1);
    expect(again.find((r) => r.code === 'DAMAGE')?.srmId).toBe(own.srmId);
    const listed = await reasonsService.list(fixture.companyId);
    expect(listed.find((r) => r.code === 'DAMAGE' && r.isShared)?.isOverridden).toBe(true);

    // A shared row is read-only; a cited code is immutable; an unused own row deletes outright.
    await expect(
      reasonsService.save({ srmId: reasons.PILFERAGE, companyId: fixture.companyId, code: 'PILFERAGE', name: 'x', direction: 'OUT' }),
    ).rejects.toMatchObject({ status: 409 });
    const usage = await reasonsService.usage(fixture.companyId, reasons.INTERNAL);
    expect(usage.ledgerRows).toBeGreaterThan(0);
    const gone = await reasonsService.deactivate({ companyId: fixture.companyId, srmId: own.srmId });
    expect(gone).toEqual({ srmId: own.srmId, deleted: true });
  });

  // ── Move stock (notes 60, D-A3): the same lot, a different bucket ────────

  let moveId: string;
  let soapLot: string;
  let soapCost: { qty: number; value: number; avg: number } | null;
  let soapStamps: Awaited<ReturnType<typeof lastPurchase>>;

  it('10. a move of 5 SALEABLE → DAMAGED writes a BUCKET_OUT / BUCKET_IN pair on one lot at one cost, leaves the average alone and posts no accounts voucher', async () => {
    await open([{ item: fixture.soap, qty: 10, costRate: 8, batchNo: 'S-1', supplierId: fixture.supplierId }]);
    soapCost = await itemCost(fixture.soap);
    soapStamps = await lastPurchase(fixture.soap);
    expect(soapCost).toEqual({ qty: 10, value: 80, avg: 8 });

    // The lot names its supplier on the picker.
    const [saleable] = await holdings(fixture.soap, 'SALEABLE');
    expect(saleable.supplierId).toBe(fixture.supplierId);
    expect(saleable.supplierName).toBeTruthy();
    soapLot = saleable.lotId;

    const saved = await adjustment('BUCKET_MOVE', [
      { item: fixture.soap, qty: 5, reasonId: reasons.MOVE_DAMAGED, lotId: soapLot, toBucket: 'DAMAGED' },
    ]);
    moveId = saved.header.svhId;
    // Stored as an ADJUSTMENT: no new document type.
    expect(saved.header.voucherType).toBe('ADJUSTMENT');
    expect(saved.lines.map((l) => [l.bucket, l.toBucket, l.qty, l.direction])).toEqual([['SALEABLE', 'DAMAGED', 5, -1]]);
    const problems = await service.validate(moveId, ACC_YEAR, fixture.companyId, fixture.branchId);
    expect(problems.map((p) => p.problem)).toEqual([null]);

    const posted = await post(moveId);
    expect(posted.rowsPosted).toBe(2);
    const rows = (await ledger(moveId)).sort((a, b) => Number(a.direction) - Number(b.direction));
    expect(rows.map((r) => [r.txn_type, Number(r.direction), Number(r.qty), Number(r.cost_rate), Number(r.cost_value), r.bucket, r.lot_id])).toEqual([
      ['BUCKET_OUT', -1, 5, 8, 40, 'SALEABLE', soapLot],
      ['BUCKET_IN', 1, 5, 8, 40, 'DAMAGED', soapLot],
    ]);

    // The value is carried: the branch figures and the purchase stamps are untouched.
    expect(await itemCost(fixture.soap)).toEqual(soapCost);
    expect(await lastPurchase(fixture.soap)).toEqual(soapStamps);
    // Still the company's stock, so no Stock Journal.
    expect(await legs('ADJUSTMENT', moveId)).toHaveLength(0);

    // The DAMAGED bucket now holds 5 of the same lot, valued, with its supplier:
    // the "what goes back to which supplier" list.
    const [damaged] = await holdings(fixture.soap, 'DAMAGED');
    expect(damaged).toMatchObject({ lotId: soapLot, bucket: 'DAMAGED', supplierId: fixture.supplierId, batchNo: 'S-1' });
    expect(damaged.availableQty).toBeCloseTo(5, 6);
    expect(damaged.stockValue).toBeCloseTo(40, 2);
    expect((await holdings(fixture.soap, 'SALEABLE'))[0].availableQty).toBeCloseTo(5, 6);

    // The header carries what moved, as a magnitude; the load names the kind.
    const hdr = await header(moveId);
    expect(hdr).toMatchObject({ status: 'POSTED', lines: 1 });
    expect(hdr.qty).toBeCloseTo(5, 6);
    expect(hdr.value).toBeCloseTo(40, 2);
    const loaded = await service.getOne(moveId, ACC_YEAR, fixture.companyId, fixture.branchId);
    expect(loaded.kind).toBe('BUCKET_MOVE');
    expect(loaded.lines[0].toBucket).toBe('DAMAGED');
    expect(await balancesAgree(fixture.soap)).toBe(0);
  });

  it('11. a move of more than the holding carries is refused, naming what it holds', async () => {
    let caught: unknown;
    await adjustment('BUCKET_MOVE', [
      { item: fixture.soap, qty: 6, reasonId: reasons.MOVE_DAMAGED, lotId: soapLot, toBucket: 'DAMAGED' },
    ]).catch((e) => (caught = e));
    expect(caught).toMatchObject({ status: 422 });
    expect(refusal(caught)).toMatch(/moves 6 but this godown holds 5/);
    expect(await balancesAgree(fixture.soap)).toBe(0);
  });

  it('12. a lotless move is refused, and so are a same-bucket move, a mixed document and a non-move reason', async () => {
    const tryMove = async (kind: StockAdjustmentSaveKind, line: AdjLine): Promise<string> => {
      let caught: unknown;
      await adjustment(kind, [line]).catch((e) => (caught = e));
      expect(caught).toMatchObject({ status: 422 });
      return refusal(caught);
    };
    expect(await tryMove('BUCKET_MOVE', { item: fixture.soap, qty: 1, reasonId: reasons.MOVE_DAMAGED, toBucket: 'DAMAGED' })).toMatch(/names no lot/);
    expect(await tryMove('BUCKET_MOVE', { item: fixture.soap, qty: 1, reasonId: reasons.MOVE_DAMAGED, lotId: soapLot, toBucket: 'SALEABLE' })).toMatch(
      /from SALEABLE into SALEABLE/,
    );
    // All moves or none, both ways round.
    expect(await tryMove('BUCKET_MOVE', { item: fixture.soap, qty: 1, reasonId: reasons.MOVE_DAMAGED, lotId: soapLot })).toMatch(/names no bucket to move to/);
    expect(await tryMove('ADJUSTMENT', { item: fixture.soap, qty: 1, reasonId: reasons.INTERNAL, lotId: soapLot, toBucket: 'DAMAGED' })).toMatch(
      /all moves or none/,
    );
    // A move cites a move reason; a move reason belongs on a move.
    expect(
      await tryMove('BUCKET_MOVE', { item: fixture.soap, qty: 1, reasonId: reasons.PILFERAGE, remarks: 'x', lotId: soapLot, toBucket: 'DAMAGED' }),
    ).toMatch(/not a stock-move reason/);
    expect(await tryMove('ADJUSTMENT', { item: fixture.soap, qty: -1, reasonId: reasons.MOVE_DAMAGED, lotId: soapLot })).toMatch(/a stock-move reason/);
    // No free goods on a move either.
    let caught: unknown;
    await explained(() =>
      attempt(() =>
        service.save({
          header: {
            accYear: ACC_YEAR, companyId: fixture.companyId, branchId: fixture.branchId, deviceId: fixture.deviceId,
            docDate: DOC_DATE, voucherType: 'BUCKET_MOVE', fromGodownId: fixture.godownA, userId: fixture.userId,
          },
          lines: [{
            lineNo: 1, itemId: fixture.soap.itemId, uomId: fixture.soap.iuc, baseUomId: fixture.soap.iuc, toBaseFactor: 1,
            qty: 1, baseQty: 1, freeQty: 1, freeBaseQty: 1, godownId: fixture.godownA, lotId: soapLot,
            bucket: 'SALEABLE', toBucket: 'DAMAGED', reasonId: reasons.MOVE_DAMAGED,
          }],
        } as never),
      ),
    ).catch((e) => (caught = e));
    expect(caught).toMatchObject({ status: 422 });
    expect(refusal(caught)).toMatch(/free quantity/);
  });

  it('13. cancelling the move mirrors both rows and puts the stock back in SALEABLE', async () => {
    const cancelled = await attempt(() =>
      service.cancel({ svhId: moveId, accYear: ACC_YEAR, companyId: fixture.companyId, branchId: fixture.branchId, reason: 'e2e move reversal', userId: fixture.userId }),
    );
    expect(cancelled.rowsReversed).toBe(2);
    const mirrors = (await ledger(moveId)).filter((r) => r.is_reversal).sort((a, b) => Number(a.direction) - Number(b.direction));
    expect(mirrors.map((r) => [r.txn_type, Number(r.direction), Number(r.qty), r.bucket])).toEqual([
      ['BUCKET_IN', -1, 5, 'DAMAGED'],
      ['BUCKET_OUT', 1, 5, 'SALEABLE'],
    ]);
    expect(await holdings(fixture.soap, 'DAMAGED')).toHaveLength(0);
    expect((await holdings(fixture.soap, 'SALEABLE'))[0].availableQty).toBeCloseTo(10, 6);
    expect(await itemCost(fixture.soap)).toEqual(soapCost);
    expect(await lastPurchase(fixture.soap)).toEqual(soapStamps);
    const hdr = await header(moveId);
    expect(hdr.status).toBe('CANCELLED');
    expect(hdr.qty).toBeCloseTo(0, 6);
    expect(hdr.value).toBeCloseTo(0, 2);
    expect(await legs('ADJUSTMENT', moveId)).toHaveLength(0);
    expect(await balancesAgree(fixture.soap)).toBe(0);
  });

  it('14. the move picker offers the move reasons only, and MOVE_SALEABLE brings damaged stock back', async () => {
    const forMove = (await reasonsService.pick({ companyId: fixture.companyId, voucherType: 'BUCKET_MOVE' })).map((r) => r.code);
    expect(forMove).toEqual(expect.arrayContaining(['MOVE_DAMAGED', 'MOVE_SALEABLE']));
    expect(forMove).not.toContain('PILFERAGE');
    const forAdjustment = (await reasonsService.pick({ companyId: fixture.companyId, voucherType: 'ADJUSTMENT' })).map((r) => r.code);
    expect(forAdjustment).not.toContain('MOVE_DAMAGED');

    const out = await adjustment('BUCKET_MOVE', [
      { item: fixture.soap, qty: 3, reasonId: reasons.MOVE_DAMAGED, lotId: soapLot, toBucket: 'DAMAGED' },
    ]);
    await post(out.header.svhId);
    const back = await adjustment('BUCKET_MOVE', [
      { item: fixture.soap, qty: 3, reasonId: reasons.MOVE_SALEABLE, lotId: soapLot, bucket: 'DAMAGED', toBucket: 'SALEABLE' },
    ]);
    await post(back.header.svhId);
    const rows = (await ledger(back.header.svhId)).sort((a, b) => Number(a.direction) - Number(b.direction));
    expect(rows.map((r) => [r.txn_type, r.bucket, Number(r.qty)])).toEqual([
      ['BUCKET_OUT', 'DAMAGED', 3],
      ['BUCKET_IN', 'SALEABLE', 3],
    ]);
    expect(await holdings(fixture.soap, 'DAMAGED')).toHaveLength(0);
    expect((await holdings(fixture.soap, 'SALEABLE'))[0].availableQty).toBeCloseTo(10, 6);
    expect(await itemCost(fixture.soap)).toEqual(soapCost);
    expect(await lastPurchase(fixture.soap)).toEqual(soapStamps);
    expect(await balancesAgree(fixture.soap)).toBe(0);
  });

  // ── notes 65 ─────────────────────────────────────────────────────────────

  it('15. a re-lot that lands back on the lot it leaves is refused — at save, at validate and inside the post', async () => {
    const right = (await lots(fixture.tea)).find((l) => l.batch_no === 'RIGHT');
    expect(right).toBeDefined();
    const outHalf: AdjLine = { item: fixture.tea, qty: 5, reasonId: reasons.RELOT_OUT, lotId: right!.slt_id, remarks: 'relabel' };
    const inHalf = (extra: Partial<AdjLine>): AdjLine => ({ item: fixture.tea, qty: 5, reasonId: reasons.RELOT_IN, remarks: 'relabel', ...extra });

    // TEA tracks the batch, and the key folds case and blanks as the lot's
    // does: ' right ' IS lot RIGHT. The IN line names no lot, so the old
    // inLots test never saw it (notes 65 §1).
    const same = await adjustment('ADJUSTMENT', [outHalf, inHalf({ batchNo: ' right ' })]).then(() => 'saved', refusal);
    expect(same).toMatch(/Line 2: re-lot lands back on the lot the OUT half leaves: this item tracks batch/);

    // SUGAR tracks nothing (case 4 left 6 in its one lot): whatever the IN half
    // states, the policy blanks it and it resolves to that lot.
    const [sugarLot] = await lots(fixture.sugar);
    const untracked = await adjustment('ADJUSTMENT', [
      { item: fixture.sugar, qty: 1, reasonId: reasons.RELOT_OUT, lotId: sugarLot.slt_id, remarks: 'relabel' },
      { item: fixture.sugar, qty: 1, reasonId: reasons.RELOT_IN, batchNo: 'NEW', remarks: 'relabel' },
    ]).then(() => 'saved', refusal);
    expect(untracked).toMatch(/tracks no lot identity/);

    // Validate and post read the STORED rows: a pair that saved clean and was
    // then changed underneath is refused there too.
    const saved = await adjustment('ADJUSTMENT', [outHalf, inHalf({ batchNo: 'FIXED' })]);
    const svhId = saved.header.svhId;
    await tx.$executeRaw`
      UPDATE stock.stock_voucher_item SET svi_batch_no = 'RIGHT'
       WHERE svi_voucher_id = ${svhId}::uuid AND svi_acc_year = ${ACC_YEAR}::bpchar AND svi_line_no = 2
    `;
    const problems = await service.validate(svhId, ACC_YEAR, fixture.companyId, fixture.branchId);
    expect(problems.find((p) => p.lineNo === 2)?.problem).toMatch(/lands back on the lot the OUT half leaves/);
    expect(await post(svhId).then(() => 'posted', refusal)).toMatch(/lands back on the lot the OUT half leaves/);
    expect((await header(svhId)).status).toBe('DRAFT');
    expect(await ledger(svhId)).toHaveLength(0);

    // The in-transaction guard reads the lot the engine STAMPED on each line,
    // not the stated identity: an IN line carrying the OUT's lot is refused.
    await tx.$executeRaw`
      UPDATE stock.stock_voucher_item SET svi_lot_id = ${right!.slt_id}::uuid
       WHERE svi_voucher_id = ${svhId}::uuid AND svi_acc_year = ${ACC_YEAR}::bpchar AND svi_line_no = 2
    `;
    const guard = (service as unknown as {
      assertRelotLandsElsewhere: (client: Prisma.TransactionClient, rules: StockVoucherTypeRules, id: string, year: string) => Promise<void>;
    }).assertRelotLandsElsewhere(tx, STOCK_ADJUSTMENT_RULES.ADJUSTMENT, svhId, ACC_YEAR);
    await expect(guard).rejects.toMatchObject({ status: 422 });
    await expect(guard.catch(refusal)).resolves.toMatch(/Line 2 .*resolved to the lot line 1 takes the stock out of/);
    expect(await balancesAgree(fixture.tea)).toBe(0);
  });

  it('16. a net-out adjustment keeps NEGATIVE header totals as a DRAFT; the post re-sums the net', async () => {
    const saved = await adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: 2, reasonId: reasons.INTERNAL }], {
      lineCount: 1,
      totalQty: -2,
      totalValue: -40,
      totalValueWot: -40,
    });
    expect(await header(saved.header.svhId)).toEqual({ status: 'DRAFT', qty: -2, value: -40, lines: 1 });
    await post(saved.header.svhId);
    const posted = await header(saved.header.svhId);
    expect(posted.status).toBe('POSTED');
    expect(posted.qty).toBeCloseTo(-2, 6);
    expect(posted.value).toBeLessThan(0);
    expect(await balancesAgree(fixture.salt)).toBe(0);
  });

  it('17. pick-stock without a bucket lists the lot in every bucket it sits in', async () => {
    const moved = await adjustment('BUCKET_MOVE', [
      { item: fixture.soap, qty: 2, reasonId: reasons.MOVE_DAMAGED, lotId: soapLot, toBucket: 'DAMAGED' },
    ]);
    await post(moved.header.svhId);
    const everywhere = await service.pickStock({
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      godownId: fixture.godownA,
      itemId: fixture.soap.itemId,
    });
    expect(everywhere.map((r) => [r.lotId, r.bucket, r.availableQty]).sort()).toEqual(
      [
        [soapLot, 'DAMAGED', 2],
        [soapLot, 'SALEABLE', 8],
      ].sort(),
    );
    expect(await balancesAgree(fixture.soap)).toBe(0);
  });

  it("18. a sales shadow voucher is not an adjustment: it cannot be opened or cancelled here, nor an adjustment saved with another module's link", async () => {
    const draft = await adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: 1, reasonId: reasons.INTERNAL }]);
    const svhId = draft.header.svhId;
    // Dress the draft as a sale bill's shadow (ck_svh_link: all three or none).
    await tx.$executeRaw`
      UPDATE stock.stock_voucher
         SET svh_link_src_module = 'SALES', svh_link_src_doc_type = 'SALE_BILL', svh_link_src_doc_id = ${svhId}::uuid
       WHERE svh_id = ${svhId}::uuid AND svh_acc_year = ${ACC_YEAR}::bpchar
    `;
    const opened = await service.getOne(svhId, ACC_YEAR, fixture.companyId, fixture.branchId).then(() => 'opened', refusal);
    expect(opened).toMatch(/is the stock movement of a SALES SALE_BILL, not an adjustment/);
    const cancelled = await attempt(() =>
      service.cancel({ svhId, accYear: ACC_YEAR, companyId: fixture.companyId, branchId: fixture.branchId, reason: 'not mine' }),
    ).then(() => 'cancelled', refusal);
    expect(cancelled).toMatch(/not an adjustment/);

    const linked = await adjustment('ADJUSTMENT', [{ item: fixture.salt, qty: 1, reasonId: reasons.INTERNAL }], {
      linkSrcModule: 'SALES',
      linkSrcDocType: 'SALE_BILL',
      linkSrcDocId: svhId,
    }).then(() => 'saved', refusal);
    expect(linked).toMatch(/linkSrcModule may be STOCK or empty, not SALES/);
  });
});
