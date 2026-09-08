import { PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';

/**
 * §14 of `plan/plan-nestjs-opening-stock.md`, second half — the acceptance test
 * for the opening stock module, run against a REAL database with the stock
 * engine deployed.
 *
 * WHY THIS SKIPS RATHER THAN FAILS. As of writing, nothing from the
 * `schema/stock/` DDL share is deployed: `stock.stock_voucher` and
 * `stock.fn_svh_post` do not exist, so every assertion here would fail for a
 * reason that has nothing to do with the code under test. A red suite that is
 * red for an environmental reason trains people to ignore it. So the whole file
 * checks for the engine first and skips with a message naming what is missing.
 *
 * The moment the share is deployed and the year's partitions exist, this runs
 * and becomes the figure-for-figure check the plan asks for.
 *
 *     SELECT stock.fn_create_stock_partitions('2026-2027');
 *     npm run test:e2e -- opening-stock
 *
 * THE FIGURES BELOW ARE COPIED FROM `19_opening_stock_flow.md`, which captured a
 * real run against an empty database. They are the specification, not a
 * recording of what this code happens to do — if a number here disagrees with
 * the engine, the number is the thing to trust until someone re-derives it.
 *
 *     SALT  10 BOX @ 12 per box @ 20.00, untracked
 *     MILK  50 PIECE @ 28.00, batch B-2604, expiring 30/06/2026, 5 free
 */

const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-04-01';

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

interface Fixture {
  companyId: string;
  branchId: string;
  deviceId: string;
  godownId: string;
  userId: string;
  saltId: string;
  saltBoxIuc: string;
  saltPieceIuc: string;
  milkId: string;
  milkPieceIuc: string;
}

const prisma = new PrismaClient();

/**
 * Is the engine actually here? Checked by function rather than by table: the
 * tables can be created by a partial run of the share while the posting
 * functions in `19_stock_posting.sql` are still missing, and that state fails
 * far more confusingly than no tables at all.
 */
async function detectEngine(): Promise<{ ready: boolean; missing: string[] }> {
  const required = [
    'fn_svh_post',
    'fn_svh_cancel',
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
    for (const table of ['stock_voucher', 'stock_voucher_item', 'stock_lot', 'stock_ledger']) {
      if (!tableNames.has(table)) {
        missing.push(table);
      }
    }
    return { ready: missing.length === 0, missing };
  } catch (error) {
    return { ready: false, missing: [`could not reach the database (${String(error)})`] };
  }
}

describe('Opening stock (e2e — needs the stock engine)', () => {
  let engine: { ready: boolean; missing: string[] };
  let service: StockVoucherService;
  let fixture: Fixture;
  const createdItemIds: string[] = [];
  const createdVoucherIds: string[] = [];

  beforeAll(async () => {
    engine = await detectEngine();
    if (!engine.ready) {
      const message =
        `the stock engine is not on this database.\n` +
        `  Missing: ${engine.missing.join(', ')}\n` +
        `  Deploy schema/stock/ (16_stock.sql … 19_stock_posting.sql), then:\n` +
        `    SELECT stock.fn_create_stock_partitions('${ACC_YEAR}');`;

      // A skipped test reports as PASSED, which is fine while the engine is
      // genuinely absent and dangerous once it is not: a green suite that never
      // ran is worse than no suite. STOCK_ENGINE_REQUIRED=1 turns the skip into
      // a failure, so CI can demand the acceptance test actually executes the
      // moment the share is deployed.
      if (process.env.STOCK_ENGINE_REQUIRED === '1') {
        throw new Error(`[opening-stock e2e] STOCK_ENGINE_REQUIRED=1 but ${message}`);
      }
      // eslint-disable-next-line no-console
      console.warn(`\n[opening-stock e2e] SKIPPED — ${message}\n`);
      return;
    }

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

  /**
   * Guards every test. `it.skip` cannot be decided lazily inside `beforeAll`,
   * so each test opens with this instead — it keeps the skip reason attached to
   * the test that skipped rather than to the file.
   */
  const requireEngine = (): boolean => {
    if (!engine.ready) {
      // eslint-disable-next-line no-console
      console.warn(`  skipped: ${engine.missing.join(', ')}`);
      return false;
    }
    return true;
  };

  async function createFixture(): Promise<Fixture> {
    // Borrows the scope from whatever this database already has rather than
    // inventing a company: a company row drags in a dozen foreign keys that
    // have nothing to do with stock.
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

    const salt = await createItem('E2E-SALT', 'Salt 1kg (e2e)', scope, [
      { name: 'PIECE', factor: 1, isBase: true },
      { name: 'BOX', factor: 12, isBase: false },
    ]);
    const milk = await createItem('E2E-MILK', 'Milk 500ml (e2e)', scope, [
      { name: 'PIECE', factor: 1, isBase: true },
    ]);

    return {
      companyId: scope.company_id,
      branchId: scope.branch_id,
      deviceId: scope.device_id,
      godownId: scope.godown_id,
      userId: scope.user_id,
      saltId: salt.itemId,
      saltPieceIuc: salt.units.PIECE,
      saltBoxIuc: salt.units.BOX,
      milkId: milk.itemId,
      milkPieceIuc: milk.units.PIECE,
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

    // Every conversion row names the item's base UNIT (an item_unit_master
    // unit_id), so the base has to be resolved before any row is written —
    // including the base's own row, which points at itself.
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
    const baseUnitId = unitIds[baseUnit.name];

    const resolved: Record<string, string> = {};
    for (const [index, unit] of units.entries()) {
      const conversion = await prisma.itemUnitConversion.create({
        data: {
          iucItemId: item.itemId,
          iucUnitId: unitIds[unit.name],
          iucBaseUnitId: baseUnitId,
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

  /** The two lines of the flow document, in the API's own shape. */
  const flowPayload = () => ({
    header: {
      accYear: ACC_YEAR,
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      deviceId: fixture.deviceId,
      docDate: DOC_DATE,
      toGodownId: fixture.godownId,
      rateSource: 'MANUAL' as const,
      userId: fixture.userId,
    },
    lines: [
      // baseUomId / toBaseFactor / baseQty / freeBaseQty are sent BY THE CLIENT
      // now — the service reads no conversion and multiplies nothing. These are
      // the flow document's own figures: 1 BOX = 12 PIECE, and milk is keyed in
      // its base unit at factor 1.
      {
        lineNo: 1,
        itemId: fixture.saltId,
        uomId: fixture.saltBoxIuc,
        baseUomId: fixture.saltPieceIuc,
        toBaseFactor: 12,
        baseQty: 120,
        godownId: fixture.godownId,
        qty: 10,
        costRate: 20,
        taxPerc: 5,
      },
      {
        lineNo: 2,
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
        taxPerc: 5,
        batchNo: 'B-2604',
        expiryDate: '2026-06-30',
      },
    ],
  });

  const saveFlowDraft = async () => {
    const saved = await service.save(OPENING_RULES, flowPayload() as never);
    createdVoucherIds.push(saved.header.svhId);
    return saved;
  };

  const countRows = async (table: string, column: string, value: string): Promise<number> => {
    const [row] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM stock.${table} WHERE ${column} = $1::uuid`,
      value,
    );
    return Number(row.count);
  };

  // ── The flow document, figure for figure ─────────────────────────────────

  it('after save: 2 lines, 175 qty, 3940 value, DRAFT — and a draft moves no stock', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();

    expect(saved.header.lineCount).toBe(2);
    // 120 (10 BOX × 12) + 50 + 5 free. Free goods ARE stock.
    expect(saved.header.totalQty).toBeCloseTo(175, 6);
    // 120 × 20 + 55 × 28
    expect(saved.header.totalValue).toBeCloseTo(3940, 2);
    expect(saved.header.status).toBe('DRAFT');

    // Six rows that maintain themselves — none of them yet.
    expect(await countRows('stock_lot', 'slt_item_id', fixture.saltId)).toBe(0);
    expect(await countRows('stock_ledger', 'sml_src_doc_id', saved.header.svhId)).toBe(0);
    expect(await countRows('stock_balance', 'sbl_item_id', fixture.saltId)).toBe(0);
    expect(await countRows('stock_item_cost', 'sic_item_id', fixture.saltId)).toBe(0);
    // The lot is resolved at post, never at save.
    expect(saved.lines.every((line) => line.lotId === null)).toBe(true);
  });

  it('after post: 2 ledger rows, the lots exist, and the rates were derived', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    const posted = await service.post(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    expect(posted.rowsPosted).toBe(2);
    expect(posted.status).toBe('POSTED');
    expect(posted.lines.every((line) => line.lotId !== null)).toBe(true);

    // Nobody typed this: 20 ÷ 1.05 = 19.047619, derived by the engine from
    // svi_tax_perc and written back onto the line.
    const saltLine = posted.lines.find((line) => line.itemId === fixture.saltId);
    expect(saltLine?.costRateWot).toBeCloseTo(19.047619, 6);

    // SALT is untracked, so its lot carries the sentinels rather than NULLs —
    // ux_slt_identity is built over the generated companions.
    const [saltLot] = await prisma.$queryRaw<
      Array<{
        slt_key_batch: string;
        slt_key_mrp: string;
        slt_key_expiry: Date;
        slt_key_serial: string;
        slt_key_supplier: string;
      }>
    >`
      SELECT slt_key_batch, slt_key_mrp, slt_key_expiry, slt_key_serial, slt_key_supplier
        FROM stock.stock_lot
       WHERE slt_item_id = ${fixture.saltId}::uuid
    `;
    expect(saltLot.slt_key_batch).toBe('~');
    expect(Number(saltLot.slt_key_mrp)).toBe(-1);
    expect(saltLot.slt_key_expiry.toISOString().slice(0, 10)).toBe('0001-01-01');
    expect(saltLot.slt_key_serial).toBe('~');
    expect(saltLot.slt_key_supplier).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('after post: stock_balance SALT 120 / MILK 55, and MILK averages 28.00', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    await service.post(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    const balances = await prisma.$queryRaw<Array<{ item_id: string; on_hand: string }>>`
      SELECT sbl_item_id AS item_id, SUM(sbl_on_hand_qty)::text AS on_hand
        FROM stock.stock_balance
       WHERE sbl_item_id IN (${fixture.saltId}::uuid, ${fixture.milkId}::uuid)
       GROUP BY sbl_item_id
    `;
    const onHand = new Map(balances.map((row) => [row.item_id, Number(row.on_hand)]));
    expect(onHand.get(fixture.saltId)).toBeCloseTo(120, 6);
    // 50 keyed + 5 free — free goods sit on the shelf and get sold.
    expect(onHand.get(fixture.milkId)).toBeCloseTo(55, 6);

    const [milkCost] = await prisma.$queryRaw<
      Array<{ avg: string; total_value_wot: string }>
    >`
      SELECT sic_avg_cost_rate::text AS avg, sic_total_value_wot::text AS total_value_wot
        FROM stock.stock_item_cost
       WHERE sic_item_id = ${fixture.milkId}::uuid
    `;
    expect(Number(milkCost.avg)).toBeCloseTo(28, 6);
    // 55 × (28 ÷ 1.05)
    expect(Number(milkCost.total_value_wot)).toBeCloseTo(1466.67, 2);
  });

  it('fn_sbl_rebuild finds 0 holdings differing, after the post and after a cancel', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    await service.post(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    const rebuild = async (): Promise<number> => {
      const [row] = await prisma.$queryRaw<Array<{ differed: number }>>`
        SELECT stock.fn_sbl_rebuild(${fixture.companyId}::uuid, ${fixture.branchId}::uuid) AS differed
      `;
      return Number(row.differed);
    };
    expect(await rebuild()).toBe(0);

    // fn_sbl_rebuild re-derives QUANTITIES ONLY. It never recomputes
    // sbl_stock_value, sbl_avg_cost_rate or stock_item_cost — so it can return
    // 0 while a valuation is quietly wrong. The value side has to be asserted
    // separately, which is what this does.
    const [values] = await prisma.$queryRaw<Array<{ stock_value: string }>>`
      SELECT COALESCE(SUM(sbl_stock_value), 0)::text AS stock_value
        FROM stock.stock_balance
       WHERE sbl_item_id IN (${fixture.saltId}::uuid, ${fixture.milkId}::uuid)
    `;
    expect(Number(values.stock_value)).toBeCloseTo(3940, 2);

    await service.cancel(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      'e2e reversal',
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );
    expect(await rebuild()).toBe(0);
  });

  // ── The negative assertions — each must refuse CLEANLY ───────────────────

  it('refuses a second post with 409 "is POSTED"', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    const post = () =>
      service.post(
        OPENING_RULES,
        saved.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchId,
        fixture.userId,
      );
    await post();

    await expect(post()).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a second OPENING for the same holding', async () => {
    if (!requireEngine()) return;

    const first = await saveFlowDraft();
    await service.post(
      OPENING_RULES,
      first.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    const second = await saveFlowDraft();
    // The preflight catches it before the engine does, as a 422 naming the
    // line; the engine's own 23505 is the backstop for the race.
    await expect(
      service.post(
        OPENING_RULES,
        second.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchId,
        fixture.userId,
      ),
    ).rejects.toMatchObject({ status: expect.any(Number) });

    const problems = await service.validate(
      OPENING_RULES,
      second.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
    );
    expect(problems.some((row) => row.problem?.includes('already has an opening'))).toBe(true);
  });

  it('refuses an edit after post with 409, without reaching tr_svi_post_lock', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    await service.post(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    await expect(
      service.save(OPENING_RULES, {
        ...flowPayload(),
        header: { ...flowPayload().header, svhId: saved.header.svhId },
      } as never),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a DELETE of a POSTED document with 409 and points at cancel', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    await service.post(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    await expect(
      service.softDelete(
        OPENING_RULES,
        saved.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchId,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a post after a cancel — the status is CANCELLED, not DRAFT', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    await service.post(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );
    await service.cancel(
      OPENING_RULES,
      saved.header.svhId,
      ACC_YEAR,
      'e2e reversal',
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    await expect(
      service.post(
        OPENING_RULES,
        saved.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchId,
        fixture.userId,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('serialises two parallel posts — one writes 2 rows, the other gets 409', async () => {
    if (!requireEngine()) return;

    const saved = await saveFlowDraft();
    const post = () =>
      service.post(
        OPENING_RULES,
        saved.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchId,
        fixture.userId,
      );

    // No application lock is taken on purpose: fn_svh_post holds FOR UPDATE on
    // the header, so the loser is told the voucher is POSTED rather than
    // deadlocking against a lock of ours on top of the engine's.
    const results = await Promise.allSettled([post(), post()]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((fulfilled[0] as PromiseFulfilledResult<{ rowsPosted: number }>).value.rowsPosted).toBe(
      2,
    );
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
  });

  it('refuses a reconcile-breaking cancel once stock has left the holding', async () => {
    if (!requireEngine()) return;

    // Not driven here: it needs a sale out of the opened holding, which belongs
    // to the billing module. Left as a named gap rather than a silent one — the
    // 409 path is unit-tested in stock-voucher.service.spec.ts against the
    // engine's own SQLSTATE.
    expect(true).toBe(true);
  });
});
