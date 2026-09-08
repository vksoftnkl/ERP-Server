import { PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';

/**
 * §15 of `plan/plan-nestjs-physical-stock.md`, second half — the acceptance
 * test for the physical count module, run against a REAL database with the
 * stock engine deployed.
 *
 * WHY THIS SKIPS RATHER THAN FAILS — same argument as `opening-stock.e2e-spec`.
 * `20260907090000_add_stock_engine_tables` created the stock TABLES in this
 * repo, but deliberately not the posting machinery: `fn_svh_post`,
 * `fn_svh_cancel`, `fn_svh_txn_map`, `fn_sml_apply`, `fn_sbl_rebuild` and the
 * rest remain the DB owner's to supply from `schema/stock/`. Until they are on
 * the database every assertion here would fail for a reason that has nothing to
 * do with the code under test, and a suite that is red for an environmental
 * reason trains people to ignore it.
 *
 *     SELECT stock.fn_create_stock_partitions('2026-2027');
 *     npm run test:e2e -- physical-stock
 *
 * TWO FIXES DATED 2026-09-04 CHANGE WHAT THIS ASSERTS, so the file detects them
 * rather than picking one:
 *
 *   tr_sml_freeze_guard        §11 — without it, svhFreezeStock is decoration
 *                              and the freeze test is a lie the API tells the
 *                              operator.
 *   fn_svh_recompute PHYSICAL  the header carries the NET VARIANCE read off the
 *                              ledger (qty +1, value 86.00 = −2×20 + 3×42), and
 *                              the same fix reordered the line write-back in
 *                              fn_svh_post so a SHORTAGE line shows the COGS the
 *                              trigger stamped — SALT's line reads 20.00, not 0.
 *
 * THE FIGURES BELOW ARE COPIED FROM `19_physical_stock_flow.md`, which captured
 * a real run. They are the specification, not a recording of what this code
 * happens to do.
 *
 *     Opening leaves: MILK 55 @ 28.00 batch B-2604 · SALT 120 @ 20.00 · SUGAR 60 @ 42.00
 *     Counted:        MILK 55 · SALT 118 · SUGAR 63   →  diff 0, −2, +3
 *     Posted:         2 ledger rows. Line 1 wrote nothing, and that is a success.
 */

const ACC_YEAR = '2026-2027';
const OPENING_DATE = '2026-04-01';
const COUNT_DATE = '2026-06-30';

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

interface Fixture {
  companyId: string;
  branchId: string;
  deviceId: string;
  godownId: string;
  otherGodownId: string | null;
  userId: string;
  saltId: string;
  saltBoxIuc: string;
  // The base the BOX converts to — the save path no longer resolves it.
  saltPieceIuc: string;
  milkId: string;
  milkPieceIuc: string;
  sugarId: string;
  sugarPieceIuc: string;
}

const prisma = new PrismaClient();

/**
 * Is the engine here, and WHICH BUILD?
 *
 * Checked by function rather than by table: after this repo's own migration the
 * tables exist while the posting functions do not, and that state fails far
 * more confusingly than no tables at all.
 */
async function detectEngine(): Promise<{
  ready: boolean;
  missing: string[];
  freezeGuard: boolean;
  recomputePhysical: boolean;
}> {
  const required = [
    'fn_svh_post',
    'fn_svh_cancel',
    'fn_svh_txn_map',
    'fn_slt_resolve',
    'fn_sbl_rebuild',
    'fn_create_stock_partitions',
  ];
  try {
    const found = await prisma.$queryRaw<Array<{ proname: string }>>`
      SELECT p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'stock'
    `;
    const names = new Set(found.map((row) => row.proname));
    const missing = required.filter((name) => !names.has(name));

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'stock'
    `;
    const tableNames = new Set(tables.map((row) => row.tablename));
    for (const table of [
      'stock_voucher',
      'stock_voucher_item',
      'stock_lot',
      'stock_ledger',
      'stock_balance',
      'stock_reason_master',
    ]) {
      if (!tableNames.has(table)) {
        missing.push(table);
      }
    }

    const [guard] = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger WHERE tgname = 'tr_sml_freeze_guard'
    `;
    let recomputePhysical = false;
    if (names.has('fn_svh_recompute')) {
      const [recompute] = await prisma.$queryRaw<Array<{ has_physical: boolean }>>`
        SELECT pg_get_functiondef('stock.fn_svh_recompute'::regproc) LIKE '%PHYSICAL%' AS has_physical
      `;
      recomputePhysical = recompute?.has_physical === true;
    }

    return {
      ready: missing.length === 0,
      missing,
      freezeGuard: Boolean(guard),
      recomputePhysical,
    };
  } catch (error) {
    return {
      ready: false,
      missing: [`could not reach the database (${String(error)})`],
      freezeGuard: false,
      recomputePhysical: false,
    };
  }
}

describe('Physical stock count (e2e — needs the stock engine)', () => {
  let engine: Awaited<ReturnType<typeof detectEngine>>;
  let service: StockVoucherService;
  let fixture: Fixture;
  const createdItemIds: string[] = [];
  const createdVoucherIds: string[] = [];

  beforeAll(async () => {
    engine = await detectEngine();
    if (!engine.ready) {
      const message =
        `the stock engine's posting machinery is not on this database.\n` +
        `  Missing: ${engine.missing.join(', ')}\n` +
        `  Deploy schema/stock/ (19_stock_posting.sql), then:\n` +
        `    SELECT stock.fn_create_stock_partitions('${ACC_YEAR}');`;

      // STOCK_ENGINE_REQUIRED=1 turns the skip into a failure, so CI can demand
      // this actually executes the moment the share is deployed: a green suite
      // that never ran is worse than no suite.
      if (process.env.STOCK_ENGINE_REQUIRED === '1') {
        throw new Error(`[physical-stock e2e] STOCK_ENGINE_REQUIRED=1 but ${message}`);
      }
      // eslint-disable-next-line no-console
      console.warn(`\n[physical-stock e2e] SKIPPED — ${message}\n`);
      return;
    }

    // §0.1 — say which build was verified, in the run output as well as in the
    // commit message. It decides whether the header totals below are the net
    // variance or zero.
    // eslint-disable-next-line no-console
    console.info(
      `\n[physical-stock e2e] engine build: tr_sml_freeze_guard=${engine.freezeGuard}, ` +
        `fn_svh_recompute PHYSICAL branch=${engine.recomputePhysical}\n`,
    );

    service = new StockVoucherService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService,
      { getUserId: () => fixture?.userId ?? null } as unknown as RequestContextService,
    );
    fixture = await createFixture();
  });

  afterAll(async () => {
    if (engine?.ready && fixture) {
      await cleanUp();
    }
    await prisma.$disconnect();
  });

  const requireEngine = (): boolean => {
    if (!engine.ready) {
      // eslint-disable-next-line no-console
      console.warn(`  skipped: ${engine.missing.join(', ')}`);
      return false;
    }
    return true;
  };

  // ── Fixture ───────────────────────────────────────────────────────────────

  async function createFixture(): Promise<Fixture> {
    const [scope] = await prisma.$queryRaw<
      Array<{
        company_id: string;
        branch_id: string;
        device_id: string;
        godown_id: string;
        user_id: string;
      }>
    >`
      SELECT br.br_comp_id  AS company_id,
             br.br_id       AS branch_id,
             dev.dev_id     AS device_id,
             gdl.gdl_id     AS godown_id,
             usr.usr_id     AS user_id
        FROM public.branch_master br
        JOIN fixed.device_master dev        ON dev.dev_branch_id = br.br_id
                                           AND dev.dev_is_deleted = false
        JOIN inventory.godown_locations gdl ON gdl.gdl_branch_id = br.br_id
                                           AND gdl.gdl_is_deleted = false
        JOIN public.user_master usr         ON usr.usr_is_deleted = false
       WHERE br.br_is_deleted = false
       LIMIT 1
    `;
    if (!scope) {
      throw new Error(
        'No branch with a device, a godown and a user on this database — seed the masters first.',
      );
    }

    // A SECOND godown, for the half of the freeze test that proves the guard is
    // per-godown rather than per-branch. Optional: not every seed has one.
    const [other] = await prisma.$queryRaw<Array<{ gdl_id: string }>>`
      SELECT gdl_id
        FROM inventory.godown_locations
       WHERE gdl_branch_id  = ${scope.branch_id}::uuid
         AND gdl_is_deleted = false
         AND gdl_id        <> ${scope.godown_id}::uuid
       LIMIT 1
    `;

    const salt = await createItem('E2E-PHY-SALT', 'PhyE2E Salt 1kg', scope, [
      { name: 'PIECE', factor: 1, isBase: true },
      { name: 'BOX', factor: 12, isBase: false },
    ]);
    const milk = await createItem('E2E-PHY-MILK', 'PhyE2E Milk 500ml', scope, [
      { name: 'PIECE', factor: 1, isBase: true },
    ]);
    const sugar = await createItem('E2E-PHY-SUGAR', 'PhyE2E Sugar 1kg', scope, [
      { name: 'PIECE', factor: 1, isBase: true },
    ]);

    return {
      companyId: scope.company_id,
      branchId: scope.branch_id,
      deviceId: scope.device_id,
      godownId: scope.godown_id,
      otherGodownId: other?.gdl_id ?? null,
      userId: scope.user_id,
      saltId: salt.itemId,
      saltBoxIuc: salt.units.BOX,
      saltPieceIuc: salt.units.PIECE,
      milkId: milk.itemId,
      milkPieceIuc: milk.units.PIECE,
      sugarId: sugar.itemId,
      sugarPieceIuc: sugar.units.PIECE,
    };
  }

  async function createItem(
    code: string,
    name: string,
    scope: { company_id: string; branch_id: string },
    units: Array<{ name: string; factor: number; isBase: boolean }>,
  ): Promise<{ itemId: string; units: Record<string, string> }> {
    const [group] = await prisma.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master LIMIT 1
    `;
    const item = await prisma.itemMaster.create({
      data: {
        itemCode: code,
        itemNameEn: name,
        itemGroupId: group.itg_id,
        itemCompanyId: scope.company_id,
        itemBranchId: scope.branch_id,
      },
      select: { itemId: true },
    });
    createdItemIds.push(item.itemId);

    const unitIds: Record<string, string> = {};
    for (const unit of units) {
      const [unitRow] = await prisma.$queryRaw<Array<{ unit_id: string }>>`
        SELECT unit_id FROM inventory.item_unit_master WHERE unit_name = ${unit.name} LIMIT 1
      `;
      if (!unitRow) {
        throw new Error(`No item_unit_master row named ${unit.name} — seed the units first.`);
      }
      unitIds[unit.name] = unitRow.unit_id;
    }
    const baseUnit = units.find((unit) => unit.isBase);
    if (!baseUnit) {
      throw new Error(`Fixture item ${code} declares no base unit.`);
    }

    const resolved: Record<string, string> = {};
    for (const [index, unit] of units.entries()) {
      const conversion = await prisma.itemUnitConversion.create({
        data: {
          iucItemId: item.itemId,
          iucUnitId: unitIds[unit.name],
          iucBaseUnitId: unitIds[baseUnit.name],
          iucToBaseFactor: unit.factor,
          iucUnitSlno: index + 1,
          iucIsBaseUnit: unit.isBase,
        },
        select: { iucId: true },
      });
      resolved[unit.name] = conversion.iucId;
    }
    return { itemId: item.itemId, units: resolved };
  }

  async function cleanUp(): Promise<void> {
    for (const svhId of createdVoucherIds) {
      await prisma.$executeRaw`DELETE FROM stock.stock_ledger WHERE sml_src_doc_id = ${svhId}::uuid`;
      await prisma.$executeRaw`DELETE FROM stock.stock_voucher_item WHERE svi_voucher_id = ${svhId}::uuid`;
      await prisma.$executeRaw`DELETE FROM stock.stock_voucher WHERE svh_id = ${svhId}::uuid`;
    }
    for (const itemId of createdItemIds) {
      await prisma.$executeRaw`DELETE FROM stock.stock_balance WHERE sbl_item_id = ${itemId}::uuid`;
      await prisma.$executeRaw`DELETE FROM stock.stock_item_cost WHERE sic_item_id = ${itemId}::uuid`;
      await prisma.$executeRaw`DELETE FROM stock.stock_lot WHERE slt_item_id = ${itemId}::uuid`;
      await prisma.$executeRaw`DELETE FROM inventory.item_unit_conversion WHERE iuc_item_id = ${itemId}::uuid`;
      await prisma.$executeRaw`DELETE FROM inventory.item_master WHERE item_id = ${itemId}::uuid`;
    }
  }

  // ── The state the opening flow leaves ─────────────────────────────────────

  /**
   * MILK 55 @ 28.00 batch B-2604 · SALT 120 @ 20.00 · SUGAR 60 @ 42.00.
   *
   * Posted through the OPENING rules, because a count corrects stock and
   * therefore cannot start from nothing: an item with no stock_balance row has
   * no book quantity, so it cannot have a variance.
   */
  async function seedHoldings(): Promise<void> {
    const opening = await service.save(OPENING_RULES, {
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        deviceId: fixture.deviceId,
        docDate: OPENING_DATE,
        toGodownId: fixture.godownId,
        rateSource: 'MANUAL',
        userId: fixture.userId,
      },
      lines: [
        {
          lineNo: 1,
          itemId: fixture.milkId,
          uomId: fixture.milkPieceIuc,
          baseUomId: fixture.milkPieceIuc,
          toBaseFactor: 1,
          baseQty: 50,
          freeBaseQty: 5,
          godownId: fixture.godownId,
          qty: 50,
          freeQty: 5,
          costRate: 28,
          batchNo: 'B-2604',
        },
        {
          lineNo: 2,
          itemId: fixture.saltId,
          uomId: fixture.saltBoxIuc,
          baseUomId: fixture.saltPieceIuc,
          toBaseFactor: 12,
          baseQty: 120,
          godownId: fixture.godownId,
          qty: 10,
          costRate: 20,
        },
        {
          lineNo: 3,
          itemId: fixture.sugarId,
          uomId: fixture.sugarPieceIuc,
          baseUomId: fixture.sugarPieceIuc,
          toBaseFactor: 1,
          baseQty: 60,
          godownId: fixture.godownId,
          qty: 60,
          costRate: 42,
        },
      ],
    } as never);
    createdVoucherIds.push(opening.header.svhId);
    await service.post(
      OPENING_RULES,
      opening.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );
  }

  /**
   * The count sheet, ordered by item name — PhyE2E Milk, Salt, Sugar — so the
   * captured line numbers hold: 1 MILK (agrees), 2 SALT (short), 3 SUGAR
   * (over).
   */
  const sheet = () =>
    service.countSheet(PHYSICAL_RULES, {
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      accYear: ACC_YEAR,
      godownId: fixture.godownId,
    });

  const COUNTS: Record<string, number> = {
    'PhyE2E Milk 500ml': 55,
    'PhyE2E Salt 1kg': 118,
    'PhyE2E Sugar 1kg': 63,
  };

  /** Every sheet row sent back verbatim, with the one column the screen fills. */
  async function saveCount(
    counts: Record<string, number> = COUNTS,
    header: Record<string, unknown> = {},
  ) {
    const rows = (await sheet()).items.filter((row) => row.itemName in counts);
    const saved = await service.save(PHYSICAL_RULES, {
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        deviceId: fixture.deviceId,
        docDate: COUNT_DATE,
        toGodownId: fixture.godownId,
        userId: fixture.userId,
        ...header,
      },
      lines: rows.map((row, index) => ({
        lineNo: index + 1,
        itemId: row.itemId,
        godownId: row.godownId,
        bucket: row.bucket,
        lotId: row.lotId,
        countedQty: counts[row.itemName],
      })),
    } as never);
    createdVoucherIds.push(saved.header.svhId);
    return saved;
  }

  const postCount = (svhId: string) =>
    service.post(
      PHYSICAL_RULES,
      svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

  const ledgerRows = (svhId: string) =>
    prisma.$queryRaw<
      Array<{
        line_no: number;
        item_id: string;
        txn_type: string;
        direction: number;
        qty: string;
        cost_rate: string;
        cost_value: string;
        reason_id: string | null;
      }>
    >`
      SELECT sml_line_no AS line_no, sml_item_id AS item_id, sml_txn_type AS txn_type,
             sml_direction AS direction, sml_qty::text AS qty,
             sml_cost_rate::text AS cost_rate, sml_cost_value::text AS cost_value,
             sml_reason_id AS reason_id
        FROM stock.stock_ledger
       WHERE sml_src_doc_id = ${svhId}::uuid
         AND sml_is_deleted = false
       ORDER BY sml_line_no
    `;

  const balanceOf = async (itemId: string) => {
    const [row] = await prisma.$queryRaw<
      Array<{ on_hand: string; value: string; last_out: Date | null }>
    >`
      SELECT SUM(sbl_on_hand_qty)::text  AS on_hand,
             SUM(sbl_stock_value)::text  AS value,
             MAX(sbl_last_out_date)      AS last_out
        FROM stock.stock_balance
       WHERE sbl_item_id = ${itemId}::uuid
         AND sbl_godown_id = ${fixture.godownId}::uuid
         AND sbl_is_deleted = false
    `;
    return row;
  };

  const avgCostOf = async (itemId: string): Promise<number> => {
    const [row] = await prisma.$queryRaw<Array<{ avg: string }>>`
      SELECT sic_avg_cost_rate::text AS avg
        FROM stock.stock_item_cost
       WHERE sic_item_id = ${itemId}::uuid
         AND sic_branch_id = ${fixture.branchId}::uuid
    `;
    return Number(row?.avg ?? 0);
  };

  const rebuild = async (): Promise<number> => {
    const [row] = await prisma.$queryRaw<Array<{ differed: number }>>`
      SELECT stock.fn_sbl_rebuild(${fixture.companyId}::uuid, ${fixture.branchId}::uuid) AS differed
    `;
    return Number(row.differed);
  };

  // ── §4 — the sheet ───────────────────────────────────────────────────────

  it('generates a sheet of three holdings, book figures filled and counts empty', async () => {
    if (!requireEngine()) return;
    await seedHoldings();

    const mine = (await sheet()).items.filter((row) => row.itemName in COUNTS);

    expect(mine).toHaveLength(3);
    expect(mine.map((row) => row.itemName)).toEqual([
      'PhyE2E Milk 500ml',
      'PhyE2E Salt 1kg',
      'PhyE2E Sugar 1kg',
    ]);
    expect(mine.map((row) => row.bookQty)).toEqual([55, 120, 60]);
    // The one column the screen fills, and the only one it may.
    expect(mine.every((row) => row.countedQty === null)).toBe(true);
    // The lot is what makes a count line a count line — it is where the book
    // figure came from.
    expect(mine.every((row) => typeof row.lotId === 'string')).toBe(true);
    expect(mine[0].batchNo).toBe('B-2604');
  });

  // ── §5 — save ────────────────────────────────────────────────────────────

  it('after save: 3 lines, every quantity and cost 0, and nothing moved', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();

    expect(saved.header.status).toBe('DRAFT');
    expect(saved.header.lineCount).toBe(3);
    // svi_qty, svi_base_qty and svi_cost_rate stay 0 FOR THE WHOLE DOCUMENT:
    // only the difference posts.
    expect(saved.lines.every((line) => line.qty === 0)).toBe(true);
    expect(saved.lines.every((line) => line.baseQty === 0)).toBe(true);
    expect(saved.lines.every((line) => line.costRate === 0)).toBe(true);
    // The book figures came from stock_balance, not from the payload.
    expect(saved.lines.map((line) => line.bookQty)).toEqual([55, 120, 60]);
    expect(saved.lines.map((line) => line.countedQty)).toEqual([55, 118, 63]);
    // GENERATED as counted − book, signed, by the database.
    expect(saved.lines.map((line) => line.diffQty)).toEqual([0, -2, 3]);
    // Written at save, unlike every other type.
    expect(saved.lines.every((line) => line.lotId !== null)).toBe(true);
    // AVG_COST applied by the rules record, and stored so the document says out
    // loud what it was valued at.
    expect(saved.header.rateSource).toBe('AVG_COST');

    const rows = await ledgerRows(saved.header.svhId);
    expect(rows).toHaveLength(0);
    expect(Number((await balanceOf(fixture.saltId)).on_hand)).toBeCloseTo(120, 6);
  });

  // ── §8 — post ────────────────────────────────────────────────────────────

  it('refuses to post an overage under MANUAL, naming the line', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount(COUNTS, { rateSource: 'MANUAL' });

    // MANUAL means the storekeeper types the rate, and a count line has nowhere
    // to type it. Guessing zero would drag SUGAR's moving average toward zero
    // for every future sale.
    await expect(postCount(saved.header.svhId)).rejects.toMatchObject({ status: 422 });
  });

  it("posts 2 of 3 lines: the ledger keeps the sheet's own line numbers", async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    const posted = await postCount(saved.header.svhId);

    expect(posted.rowsPosted).toBe(2);
    expect(posted.status).toBe('POSTED');
    expect(posted.header.lineCount).toBe(3);

    const rows = await ledgerRows(saved.header.svhId);
    expect(rows).toHaveLength(2);
    // LINE 1 IS MISSING, DELIBERATELY. MILK agreed, so it wrote nothing
    // anywhere — and the evidence that it was counted lives on the document.
    expect(rows.map((row) => row.line_no)).toEqual([2, 3]);

    const [salt, sugar] = rows;
    expect(salt.txn_type).toBe('PHYSICAL_MINUS');
    expect(Number(salt.direction)).toBe(-1);
    // A MAGNITUDE — the sign lives in sml_direction alone.
    expect(Number(salt.qty)).toBeCloseTo(2, 6);
    // Not typed by the counter: fn_sml_cost_default stamped it from the item's
    // valuation policy.
    expect(Number(salt.cost_rate)).toBeCloseTo(20, 6);
    expect(Number(salt.cost_value)).toBeCloseTo(40, 2);

    expect(sugar.txn_type).toBe('PHYSICAL_PLUS');
    expect(Number(sugar.direction)).toBe(1);
    expect(Number(sugar.qty)).toBeCloseTo(3, 6);
    // Derived from svh_rate_source = AVG_COST.
    expect(Number(sugar.cost_rate)).toBeCloseTo(42, 6);
    expect(Number(sugar.cost_value)).toBeCloseTo(126, 2);
  });

  it('after post: SALT 118 / 2360.00, SUGAR 63 / 2646.00, MILK untouched', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    await postCount(saved.header.svhId);

    const salt = await balanceOf(fixture.saltId);
    expect(Number(salt.on_hand)).toBeCloseTo(118, 6);
    expect(Number(salt.value)).toBeCloseTo(2360, 2);
    expect(salt.last_out?.toISOString().slice(0, 10)).toBe(COUNT_DATE);

    const sugar = await balanceOf(fixture.sugarId);
    expect(Number(sugar.on_hand)).toBeCloseTo(63, 6);
    expect(Number(sugar.value)).toBeCloseTo(2646, 2);

    // A LINE THAT AGREES LEAVES NO TRACE ANYWHERE — no ledger row, no balance
    // write, no sbl_last_out_date.
    const milk = await balanceOf(fixture.milkId);
    expect(Number(milk.on_hand)).toBeCloseTo(55, 6);
    expect(milk.last_out).toBeNull();

    const lots = await prisma.$queryRaw<Array<{ item_id: string; on_hand: string }>>`
      SELECT slt_item_id AS item_id, slt_total_on_hand::text AS on_hand
        FROM stock.stock_lot
       WHERE slt_item_id IN (${fixture.saltId}::uuid, ${fixture.sugarId}::uuid, ${fixture.milkId}::uuid)
    `;
    const byItem = new Map(lots.map((row) => [row.item_id, Number(row.on_hand)]));
    expect(byItem.get(fixture.saltId)).toBeCloseTo(118, 6);
    expect(byItem.get(fixture.sugarId)).toBeCloseTo(63, 6);
    expect(byItem.get(fixture.milkId)).toBeCloseTo(55, 6);
  });

  it('leaves the moving average exactly where it was — a count is not a revaluation', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    await postCount(saved.header.svhId);

    // Shortage relieved AT the average: (2400 − 40) ÷ 118 = 20.000000.
    expect(await avgCostOf(fixture.saltId)).toBeCloseTo(20, 6);
    // Overage added AT the average: (2520 + 126) ÷ 63 = 42.000000.
    expect(await avgCostOf(fixture.sugarId)).toBeCloseTo(42, 6);
    // A count finds a QUANTITY error, not a price error. An item carried at the
    // wrong cost cannot be fixed by counting it, and this engine has no REVALUE.
  });

  it('reconciles: fn_sbl_rebuild finds 0 holdings differing', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    await postCount(saved.header.svhId);

    expect(await rebuild()).toBe(0);
    // fn_sbl_rebuild re-derives QUANTITIES ONLY — it never recomputes
    // sbl_stock_value, sbl_avg_cost_rate or stock_item_cost, so it can return 0
    // while a valuation is quietly wrong. The average assertion above is the
    // value-side check, and there is no engine-side equivalent.
  });

  it('carries the net variance on the header, and writes the shortage cost back', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    const posted = await postCount(saved.header.svhId);

    if (engine.recomputePhysical) {
      // The header totals on a count are the NET VARIANCE read off the ledger:
      // −2 + 3 = +1, and −2×20 + 3×42 = 86.00. Not the sum of anything on the
      // screen, which is why the field is labelled "Net variance" or not shown.
      expect(posted.header.totalQty).toBeCloseTo(1, 6);
      expect(posted.header.totalValue).toBeCloseTo(86, 2);
      // The same fix reordered the line write-back (INSERT … RETURNING first),
      // so a shortage line shows the COGS the trigger stamped.
      expect(posted.lines[1].costRate).toBeCloseTo(20, 6);
    } else {
      // Pre-fix: the header cannot describe a count at all, and the screen must
      // not display its totals.
      expect(posted.header.totalQty).toBeCloseTo(0, 6);
      expect(posted.header.totalValue).toBeCloseTo(0, 2);
      expect(posted.lines[1].costRate).toBeCloseTo(0, 6);
    }
  });

  // ── §12 — the variance report ────────────────────────────────────────────

  it('reports the count as the ledger recorded it, both costs side by side', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    await postCount(saved.header.svhId);

    const report = await service.variance(
      PHYSICAL_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
    );

    expect(report.items).toHaveLength(2);
    expect(report.items.map((row) => row.lineNo)).toEqual([2, 3]);
    expect(report.items[0].txnType).toBe('PHYSICAL_MINUS');
    expect(report.items[0].qty).toBeCloseTo(2, 6);
    expect(report.items[1].costRate).toBeCloseTo(42, 6);
  });

  // ── Negative assertions, each refusing cleanly ───────────────────────────

  it('1. refuses a second post — the document is already POSTED', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    await postCount(saved.header.svhId);

    await expect(postCount(saved.header.svhId)).rejects.toMatchObject({ status: 409 });
  });

  it('2. ACCEPTS a second count of the same holdings — this is the §3.5 gate', async () => {
    if (!requireEngine()) return;

    const first = await saveCount();
    await postCount(first.header.svhId);

    // A holding may be counted any number of times, each posting its own
    // variance from the THEN-CURRENT book figure: SALT now books at 118, so
    // counting 117 is a further shortage of 1 rather than a repeat of the last.
    const second = await saveCount({
      'PhyE2E Milk 500ml': 55,
      'PhyE2E Salt 1kg': 117,
      'PhyE2E Sugar 1kg': 63,
    });
    expect(second.lines[1].bookQty).toBeCloseTo(118, 6);
    expect(second.lines[1].diffQty).toBeCloseTo(-1, 6);

    const posted = await postCount(second.header.svhId);
    expect(posted.rowsPosted).toBe(1);
    expect(posted.status).toBe('POSTED');
    // If the opening's already-opened branch ever regresses into the count's
    // preflight, THIS is the test that catches it.
  });

  it('3. refuses an edit after post — tr_svi_post_lock, as a 409 naming the status', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount();
    await postCount(saved.header.svhId);

    await expect(saveCount(COUNTS, { svhId: saved.header.svhId })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('4. refuses an overage with no rate source at all', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount(COUNTS, { rateSource: null });
    // Explicit null beats the type default, so the document genuinely names
    // none — and the preflight names the line that found stock.
    const problems = await service.validate(
      PHYSICAL_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
    );
    expect(problems.find((row) => row.lineNo === 3)?.problem).toContain('rate source');
    await expect(postCount(saved.header.svhId)).rejects.toMatchObject({ status: 422 });
  });

  it('5. freezes the counted godown and only that godown', async () => {
    if (!requireEngine()) return;
    if (!engine.freezeGuard) {
      // eslint-disable-next-line no-console
      console.warn('  skipped: tr_sml_freeze_guard is not deployed — §11 is decoration');
      return;
    }

    const now = Date.now();
    const saved = await saveCount(COUNTS, {
      freezeStock: true,
      // WALL CLOCK, NOT DOCUMENT DATE: the guard compares the window to now(),
      // because a back-dated entry still changes today's shelf.
      freezeFrom: new Date(now - 60_000).toISOString(),
      freezeTo: new Date(now + 3 * 3600_000).toISOString(),
    });

    const moveInto = async (godownId: string) => {
      const doc = await service.save(OPENING_RULES, {
        header: {
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchId,
          deviceId: fixture.deviceId,
          docDate: COUNT_DATE,
          toGodownId: godownId,
          rateSource: 'MANUAL',
          userId: fixture.userId,
        },
        lines: [
          {
            lineNo: 1,
            itemId: fixture.sugarId,
            uomId: fixture.sugarPieceIuc,
            baseUomId: fixture.sugarPieceIuc,
            toBaseFactor: 1,
            baseQty: 1,
            godownId,
            qty: 1,
            costRate: 42,
          },
        ],
      } as never);
      createdVoucherIds.push(doc.header.svhId);
      return service.post(
        OPENING_RULES,
        doc.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchId,
        fixture.userId,
      );
    };

    await expect(moveInto(fixture.godownId)).rejects.toBeDefined();
    if (fixture.otherGodownId) {
      // Other godowns keep trading — the guard is per-godown, not per-branch.
      await expect(moveInto(fixture.otherGodownId)).resolves.toBeDefined();
    }

    // The count's OWN posting goes through, and lifts the freeze by itself
    // without waiting for freezeTo.
    await expect(postCount(saved.header.svhId)).resolves.toMatchObject({ status: 'POSTED' });
    await expect(moveInto(fixture.godownId)).resolves.toBeDefined();
  });

  it('6. posts a count where every line agrees: 0 rows, POSTED, and still reconciled', async () => {
    if (!requireEngine()) return;

    const saved = await saveCount({
      'PhyE2E Milk 500ml': 55,
      'PhyE2E Salt 1kg': 120,
      'PhyE2E Sugar 1kg': 60,
    });
    const posted = await postCount(saved.header.svhId);

    // THIS IS A SUCCESS, and the only voucher type for which zero ledger rows
    // is one. It is also what a well-run stockroom should produce.
    expect(posted.rowsPosted).toBe(0);
    expect(posted.status).toBe('POSTED');
    expect(await ledgerRows(saved.header.svhId)).toHaveLength(0);
    expect(await rebuild()).toBe(0);
    // The document keeps all three lines: the evidence that they were counted.
    expect(posted.lines).toHaveLength(3);
    expect(posted.lines.every((line) => line.diffQty === 0)).toBe(true);
  });
});
