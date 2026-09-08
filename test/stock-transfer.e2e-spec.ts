import { PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import { StockTransferService } from '../src/modules/stocks/stock-transfer/stock-transfer.service';
import { TRANSFER_OUT_RULES } from '../src/modules/stocks/stock-transfer/stock-transfer.controller';
import { TRANSFER_IN_RULES } from '../src/modules/stocks/stock-transfer/stock-transfer-receive.controller';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';

/**
 * §11 of `plan/plan-nestjs-stock-transfer.md` — the acceptance test, run
 * against a REAL database with the stock engine deployed.
 *
 * WHY THIS SKIPS RATHER THAN FAILS — as in `opening-stock.e2e-spec` and
 * `physical-stock.e2e-spec`. This repo's migrations created the stock TABLES
 * but deliberately not the posting machinery: `fn_svh_post_transfer`,
 * `fn_svh_receive_transfer` and `tr_svh_transfer_cancel_guard` come from
 * `schema/stock/20_stock_transfer.sql`, which must be loaded AFTER
 * `19_stock_posting.sql`. Until they are on the database every assertion here
 * would fail for an environmental reason, and a suite that is red for an
 * environmental reason trains people to ignore it.
 *
 *     SELECT stock.fn_create_stock_partitions('2026-2027');
 *     STOCK_ENGINE_REQUIRED=1 npm run test:e2e -- stock-transfer
 *
 * THE FIGURES ARE `20_stock_transfer_flow.md`'s, and that document is explicit
 * that they were WORKED FROM THE FUNCTION BODIES rather than captured off a
 * cluster — unlike the opening flow's. So the first green run of this file is
 * also the moment those numbers stop being a reconstruction. If one disagrees,
 * the flow doc is as likely to be wrong as this code, and the difference must
 * be resolved with the DB owner rather than by editing an expectation.
 *
 *     A0:  MILK 55 @ 28.00 batch B-2604 in MAIN of branch A
 *     A:   20 MAIN → COLD, same branch    → 2 ledger rows, POSTED, no transit
 *     B:   30 MAIN → STORE at branch B    → 1 ledger row, 1 transit row, IN_TRANSIT
 *     B5:  25 arrived good, 3 broken, 2 never arrived
 *          → 2 ledger rows, transit PARTIAL, short 2, OUT STILL IN_TRANSIT
 *     B7:  the 2 turn up → transit RECEIVED, OUT RECEIVED
 */

const ACC_YEAR = '2026-2027';
const OPENING_DATE = '2026-04-01';
const TRANSFER_DATE = '2026-04-02';
const RECEIPT_DATE = '2026-04-10';

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
  branchA: string;
  branchB: string | null;
  deviceA: string;
  deviceB: string | null;
  gdMain: string;
  gdCold: string | null;
  gdStore: string | null;
  userId: string;
  milkId: string;
  milkPieceIuc: string;
}

const prisma = new PrismaClient();

/**
 * Is the transfer engine here?
 *
 * Checked by FUNCTION, not by table: after this repo's own migrations the
 * tables exist while the posting machinery does not, and that state fails far
 * more confusingly than no tables at all. `stock_transit` is checked separately
 * because it is the one table 20 needs that 19 does not use.
 */
async function detectEngine(): Promise<{ ready: boolean; missing: string[] }> {
  const requiredFunctions = [
    'fn_svh_post',
    'fn_svh_post_transfer',
    'fn_svh_receive_transfer',
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
    const missing = requiredFunctions.filter((name) => !names.has(name));

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
      'stock_transit',
    ]) {
      if (!tableNames.has(table)) {
        missing.push(table);
      }
    }
    return { ready: missing.length === 0, missing };
  } catch (error) {
    return { ready: false, missing: [`could not reach the database (${String(error)})`] };
  }
}

describe('Stock transfer (e2e — needs the stock engine)', () => {
  let engine: Awaited<ReturnType<typeof detectEngine>>;
  let voucherService: StockVoucherService;
  let service: StockTransferService;
  let fixture: Fixture;
  const createdItemIds: string[] = [];
  const createdVoucherIds: string[] = [];

  beforeAll(async () => {
    engine = await detectEngine();
    if (!engine.ready) {
      const message =
        `the stock transfer engine is not on this database.\n` +
        `  Missing: ${engine.missing.join(', ')}\n` +
        `  Deploy schema/stock/ — 20_stock_transfer.sql AFTER 19_stock_posting.sql — then:\n` +
        `    SELECT stock.fn_create_stock_partitions('${ACC_YEAR}');`;
      if (process.env.STOCK_ENGINE_REQUIRED === '1') {
        throw new Error(`[stock-transfer e2e] STOCK_ENGINE_REQUIRED=1 but ${message}`);
      }
      // eslint-disable-next-line no-console
      console.warn(`\n[stock-transfer e2e] SKIPPED — ${message}\n`);
      return;
    }

    voucherService = new StockVoucherService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService,
      { getUserId: () => fixture?.userId ?? null } as unknown as RequestContextService,
    );
    service = new StockTransferService(
      prisma as unknown as PrismaService,
      voucherService,
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

  /** Shape B needs a second BRANCH, which not every seed has. */
  const requireTwoBranches = (): boolean => {
    if (!requireEngine()) {
      return false;
    }
    if (!fixture.branchB || !fixture.gdStore || !fixture.deviceB) {
      // eslint-disable-next-line no-console
      console.warn('  skipped: this database has only one branch with a device and a godown.');
      return false;
    }
    return true;
  };

  const requireTwoGodowns = (): boolean => requireEngine() && Boolean(fixture.gdCold);

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
      SELECT br.br_comp_id AS company_id, br.br_id AS branch_id, dev.dev_id AS device_id,
             gdl.gdl_id AS godown_id, usr.usr_id AS user_id
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

    // A second godown in the SAME branch — shape A.
    const [cold] = await prisma.$queryRaw<Array<{ gdl_id: string }>>`
      SELECT gdl_id FROM inventory.godown_locations
       WHERE gdl_branch_id = ${scope.branch_id}::uuid
         AND gdl_is_deleted = false AND gdl_id <> ${scope.godown_id}::uuid
       LIMIT 1
    `;

    // A second BRANCH with its own godown and device — shape B. The device
    // matters: the receiving branch's tablet numbers its own receipts, and
    // svh_slno is unique per (company, branch, year, type, device).
    const [other] = await prisma.$queryRaw<
      Array<{ branch_id: string; godown_id: string; device_id: string }>
    >`
      SELECT br.br_id AS branch_id, gdl.gdl_id AS godown_id, dev.dev_id AS device_id
        FROM public.branch_master br
        JOIN inventory.godown_locations gdl ON gdl.gdl_branch_id = br.br_id
                                           AND gdl.gdl_is_deleted = false
        JOIN fixed.device_master dev        ON dev.dev_branch_id = br.br_id
                                           AND dev.dev_is_deleted = false
       WHERE br.br_is_deleted = false
         AND br.br_comp_id = ${scope.company_id}::uuid
         AND br.br_id <> ${scope.branch_id}::uuid
       LIMIT 1
    `;

    const milk = await createItem('E2E-TRF-MILK', 'TrfE2E Milk 500ml', scope, [
      { name: 'PIECE', factor: 1, isBase: true },
    ]);

    return {
      companyId: scope.company_id,
      branchA: scope.branch_id,
      branchB: other?.branch_id ?? null,
      deviceA: scope.device_id,
      deviceB: other?.device_id ?? null,
      gdMain: scope.godown_id,
      gdCold: cold?.gdl_id ?? null,
      gdStore: other?.godown_id ?? null,
      userId: scope.user_id,
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

    const baseUnit = units.find((unit) => unit.isBase);
    if (!baseUnit) {
      throw new Error(`Fixture item ${code} declares no base unit.`);
    }
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
      await prisma.$executeRaw`DELETE FROM stock.stock_transit WHERE stt_out_voucher_id = ${svhId}::uuid`;
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

  // ── Reads ─────────────────────────────────────────────────────────────────

  const onHand = async (branchId: string, godownId: string): Promise<number> => {
    const [row] = await prisma.$queryRaw<Array<{ qty: string }>>`
      SELECT COALESCE(SUM(sbl_on_hand_qty), 0) AS qty
        FROM stock.stock_balance
       WHERE sbl_branch_id = ${branchId}::uuid
         AND sbl_godown_id = ${godownId}::uuid
         AND sbl_item_id   = ${fixture.milkId}::uuid
         AND sbl_is_deleted = false
    `;
    return Number(row?.qty ?? 0);
  };

  const transitIn = async (branchId: string, godownId: string): Promise<number> => {
    const [row] = await prisma.$queryRaw<Array<{ qty: string }>>`
      SELECT COALESCE(SUM(sbl_transit_in_qty), 0) AS qty
        FROM stock.stock_balance
       WHERE sbl_branch_id = ${branchId}::uuid
         AND sbl_godown_id = ${godownId}::uuid
         AND sbl_item_id   = ${fixture.milkId}::uuid
    `;
    return Number(row?.qty ?? 0);
  };

  const itemCost = async (branchId: string) => {
    const [row] = await prisma.$queryRaw<
      Array<{ sic_total_qty: string; sic_total_value: string; sic_avg_cost_rate: string }>
    >`
      SELECT sic_total_qty, sic_total_value, sic_avg_cost_rate
        FROM stock.stock_item_cost
       WHERE sic_branch_id = ${branchId}::uuid
         AND sic_item_id   = ${fixture.milkId}::uuid
         AND sic_is_deleted = false
    `;
    return row
      ? {
          qty: Number(row.sic_total_qty),
          value: Number(row.sic_total_value),
          rate: Number(row.sic_avg_cost_rate),
        }
      : null;
  };

  const ledgerFor = async (svhId: string) =>
    prisma.$queryRaw<
      Array<{
        sml_txn_type: string;
        sml_direction: number;
        sml_godown_id: string;
        sml_base_qty: string;
        sml_cost_rate: string;
        sml_cost_value: string;
        sml_cost_rate_wot: string;
        sml_bucket: string;
      }>
    >`
      SELECT sml_txn_type, sml_direction, sml_godown_id, sml_base_qty,
             sml_cost_rate, sml_cost_value, sml_cost_rate_wot, sml_bucket
        FROM stock.stock_ledger
       WHERE sml_src_doc_id = ${svhId}::uuid
       ORDER BY sml_line_no, sml_direction DESC
    `;

  const voucherStatus = async (svhId: string): Promise<string> => {
    const [row] = await prisma.$queryRaw<Array<{ svh_status: string }>>`
      SELECT svh_status FROM stock.stock_voucher WHERE svh_id = ${svhId}::uuid
    `;
    return row?.svh_status ?? 'MISSING';
  };

  /** §11.9 — the balance must be rebuildable from the ledger, every time. */
  const rebuildDiffers = async (): Promise<number> => {
    const [row] = await prisma.$queryRaw<Array<{ differing: string }>>`
      SELECT COALESCE(stock.fn_sbl_rebuild(), 0) AS differing
    `;
    return Number(row?.differing ?? 0);
  };

  /** The lot MILK's opening created, which every transfer line must name. */
  const milkLot = async (): Promise<string> => {
    const [row] = await prisma.$queryRaw<Array<{ slt_id: string }>>`
      SELECT slt_id FROM stock.stock_lot
       WHERE slt_item_id = ${fixture.milkId}::uuid
       ORDER BY slt_created_on
       LIMIT 1
    `;
    if (!row) {
      throw new Error('The opening created no lot for MILK — the opening did not post.');
    }
    return row.slt_id;
  };

  // ── A0 — the starting point ───────────────────────────────────────────────

  /** MILK 55 @ 28.00, batch B-2604, in MAIN of branch A. */
  async function openMilk(): Promise<void> {
    const draft = await voucherService.save(OPENING_RULES, {
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        deviceId: fixture.deviceA,
        docDate: OPENING_DATE,
        toGodownId: fixture.gdMain,
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
          baseQty: 55,
          godownId: fixture.gdMain,
          batchNo: 'B-2604',
          expiryDate: '2026-06-30',
          qty: 55,
          costRate: 28,
        },
      ],
    } as never);
    createdVoucherIds.push(draft.header.svhId);
    await voucherService.post(
      OPENING_RULES,
      draft.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchA,
      fixture.userId,
    );
  }

  /** A DRAFT TRANSFER_OUT of `qty` MILK from MAIN to `toGodown`. */
  async function draftTransfer(
    toGodownId: string,
    qty: number,
    toBranchId?: string,
  ): Promise<string> {
    const lotId = await milkLot();
    const draft = await service.save(TRANSFER_OUT_RULES, {
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        deviceId: fixture.deviceA,
        docDate: TRANSFER_DATE,
        fromGodownId: fixture.gdMain,
        toGodownId,
        ...(toBranchId ? { toBranchId } : {}),
        userId: fixture.userId,
      },
      lines: [
        {
          lineNo: 1,
          itemId: fixture.milkId,
          uomId: fixture.milkPieceIuc,
          // Milk is keyed in its base unit, so the factor is 1 and the base
          // quantity is the quantity — but both are sent, because the service
          // no longer derives either.
          baseUomId: fixture.milkPieceIuc,
          toBaseFactor: 1,
          baseQty: qty,
          godownId: fixture.gdMain,
          lotId,
          qty,
        },
      ],
    } as never);
    createdVoucherIds.push(draft.header.svhId);
    return draft.header.svhId;
  }

  // ── Shape A — godown → godown, same branch ────────────────────────────────

  describe('Shape A — godown to godown', () => {
    it('posts BOTH ledger rows in one transaction and ends POSTED, with no transit row', async () => {
      if (!requireTwoGodowns()) {
        return;
      }
      await openMilk();
      const costBefore = await itemCost(fixture.branchA);

      const svhId = await draftTransfer(fixture.gdCold as string, 20);
      const result = await service.despatch(TRANSFER_OUT_RULES, {
        svhId,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        userId: fixture.userId,
      });

      // A4 — 2 rows, POSTED, NOT In_TRANSIT. Shape A never touches transit.
      expect(result.sameBranch).toBe(true);
      expect(result.ledgerRows).toBe(2);
      expect(result.transitRows).toBe(0);
      expect(result.status).toBe('POSTED');

      const rows = await ledgerFor(svhId);
      expect(rows).toHaveLength(2);
      const out = rows.find((row) => row.sml_txn_type === 'TRANSFER_OUT');
      const into = rows.find((row) => row.sml_txn_type === 'TRANSFER_IN');
      expect(Number(out?.sml_direction)).toBe(-1);
      expect(Number(into?.sml_direction)).toBe(1);
      expect(out?.sml_godown_id).toBe(fixture.gdMain);
      expect(into?.sml_godown_id).toBe(fixture.gdCold);

      // A4a/A4b — the cost is STAMPED by fn_sml_cost_default from the item's
      // policy (28.00), and the IN row carries the OUT row's figure. Nobody
      // typed it: the API stripped the line to 0 on purpose.
      expect(Number(out?.sml_cost_rate)).toBeCloseTo(28, 6);
      expect(Number(into?.sml_cost_rate)).toBeCloseTo(28, 6);
      expect(Number(out?.sml_cost_value)).toBeCloseTo(560, 2);
      expect(Number(into?.sml_cost_value)).toBeCloseTo(560, 2);

      // A4c — the balance moved. COLD is created by the trigger if it never
      // held the item.
      expect(await onHand(fixture.branchA, fixture.gdMain)).toBeCloseTo(35, 6);
      expect(await onHand(fixture.branchA, fixture.gdCold as string)).toBeCloseTo(20, 6);

      // A4d — DELIBERATELY UNCHANGED. The moving average is a property of the
      // item in the BRANCH, and the stock never left it: −560 out, +560 in. An
      // internal move is not a revaluation.
      const costAfter = await itemCost(fixture.branchA);
      expect(costAfter?.qty).toBeCloseTo(costBefore?.qty ?? 0, 6);
      expect(costAfter?.value).toBeCloseTo(costBefore?.value ?? 0, 2);
      expect(costAfter?.rate).toBeCloseTo(28, 6);

      expect(await rebuildDiffers()).toBe(0);
    });

    it('cancels symmetrically — both halves reversed, balances back', async () => {
      if (!requireTwoGodowns()) {
        return;
      }
      const before = await onHand(fixture.branchA, fixture.gdMain);
      const svhId = await draftTransfer(fixture.gdCold as string, 5);
      await service.despatch(TRANSFER_OUT_RULES, {
        svhId,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        userId: fixture.userId,
      });
      expect(await onHand(fixture.branchA, fixture.gdMain)).toBeCloseTo(before - 5, 6);

      // A5 — an ordinary POSTED document. The transfer cancel guard does not
      // fire: it only refuses IN_TRANSIT / RECEIVED and a POSTED TRANSFER_IN.
      await voucherService.cancel(
        TRANSFER_OUT_RULES,
        svhId,
        ACC_YEAR,
        'e2e symmetric cancel',
        fixture.companyId,
        fixture.branchA,
        fixture.userId,
      );
      expect(await onHand(fixture.branchA, fixture.gdMain)).toBeCloseTo(before, 6);
      expect(await rebuildDiffers()).toBe(0);
    });
  });

  // ── Shape B — branch → branch ─────────────────────────────────────────────

  describe('Shape B — branch to branch', () => {
    let outId: string;

    it('despatches ONE ledger row and one transit row, and ends IN_TRANSIT', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const mainBefore = await onHand(fixture.branchA, fixture.gdMain);

      outId = await draftTransfer(fixture.gdStore as string, 30, fixture.branchB as string);
      const result = await service.despatch(TRANSFER_OUT_RULES, {
        svhId: outId,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        userId: fixture.userId,
        lrNo: 'LR-9911',
        vehicleNo: 'TN-01-AB-1234',
        expectedOn: '2026-04-05',
      });

      // B2 — one row PER LINE, not two. There is no IN row yet: nobody has it.
      expect(result.sameBranch).toBe(false);
      expect(result.ledgerRows).toBe(1);
      expect(result.transitRows).toBe(1);
      // B2d — an inter-branch OUT NEVER reaches POSTED.
      expect(result.status).toBe('IN_TRANSIT');

      // B2a — at the source the stock is simply GONE. It is not held anywhere
      // as "in transit"; only the destination carries transit.
      expect(await onHand(fixture.branchA, fixture.gdMain)).toBeCloseTo(mainBefore - 30, 6);

      // B2b — the transit row, at the cost the stock left with.
      const [transit] = result.transit;
      expect(transit.sentQty).toBeCloseTo(30, 6);
      expect(transit.receivedQty).toBeCloseTo(0, 6);
      expect(transit.remainingQty).toBeCloseTo(30, 6);
      expect(transit.costRate).toBeCloseTo(28, 6);
      expect(transit.transitValue).toBeCloseTo(840, 2);
      expect(transit.status).toBe('IN_TRANSIT');

      // §0.3 — the three columns the engine never sets, written by the API in
      // the post's own transaction.
      expect(transit.lrNo).toBe('LR-9911');
      expect(transit.vehicleNo).toBe('TN-01-AB-1234');
      expect(transit.expectedOn).toBe('2026-04-05');

      // B2c — branch B is told it is coming, and the row is CREATED by
      // fn_sbl_ensure_row when B has never held the item. Without it the
      // inbound quantity would be invisible until the goods arrived, which is
      // the commonest first-transfer case.
      expect(await transitIn(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(30, 6);
      expect(await onHand(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(0, 6);

      expect(await rebuildDiffers()).toBe(0);
    });

    it('shows the consignment on the receiving branch worklist', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const list = await service.inbound(fixture.companyId, fixture.branchB as string);
      const mine = list.items.find((row) => row.itemId === fixture.milkId);
      expect(mine).toBeDefined();
      expect(mine?.remainingQty).toBeCloseTo(30, 6);
    });

    it('prefills the receipt from the transit row, not from the despatch lines', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const prefill = await service.prefill(
        fixture.companyId,
        fixture.branchB as string,
        outId,
        ACC_YEAR,
      );
      expect(prefill.rows).toHaveLength(1);
      expect(prefill.rows[0].remainingQty).toBeCloseTo(30, 6);
      // The destination godown comes from the TRANSIT row — the receipt screen
      // must never offer a picker for it.
      expect(prefill.rows[0].toGodownId).toBe(fixture.gdStore);
    });

    it('receives 25 good and 3 broken, leaving 2 short and the transfer OPEN', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const lotId = await milkLot();
      const draft = await service.saveReceive(TRANSFER_IN_RULES, {
        header: {
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchB as string,
          deviceId: fixture.deviceB as string,
          docDate: RECEIPT_DATE,
          linkSrcDocId: outId,
          linkSrcAccYear: ACC_YEAR,
          userId: fixture.userId,
        },
        lines: [
          {
            lineNo: 1,
            itemId: fixture.milkId,
            uomId: fixture.milkPieceIuc,
            baseUomId: fixture.milkPieceIuc,
            toBaseFactor: 1,
            baseQty: 25,
            // THE DESTINATION — the opposite of the OUT line's meaning.
            godownId: fixture.gdStore as string,
            lotId,
            bucket: 'SALEABLE',
            qty: 25,
          },
          {
            lineNo: 2,
            itemId: fixture.milkId,
            uomId: fixture.milkPieceIuc,
            baseUomId: fixture.milkPieceIuc,
            toBaseFactor: 1,
            baseQty: 3,
            godownId: fixture.gdStore as string,
            lotId,
            bucket: 'DAMAGED',
            qty: 3,
          },
        ],
        // B5 — there is NO line for the missing 2. A short is not keyed.
      } as never);
      createdVoucherIds.push(draft.header.svhId);

      const result = await service.receive(
        TRANSFER_IN_RULES,
        draft.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchB as string,
        fixture.userId,
      );

      // B6a — 2 IN rows, both at the cost the stock LEFT with. Branch B never
      // enters a cost and cannot revalue by receiving.
      expect(result.inVoucher.ledgerRows).toBe(2);
      expect(result.inVoucher.status).toBe('POSTED');
      const rows = await ledgerFor(draft.header.svhId);
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.sml_txn_type).toBe('TRANSFER_IN');
        expect(Number(row.sml_direction)).toBe(1);
        // COST TRAVELS. Assert the number, not the code path.
        expect(Number(row.sml_cost_rate)).toBeCloseTo(28, 6);
      }
      const saleable = rows.find((row) => row.sml_bucket === 'SALEABLE');
      const damaged = rows.find((row) => row.sml_bucket === 'DAMAGED');
      expect(Number(saleable?.sml_base_qty)).toBeCloseTo(25, 6);
      expect(Number(saleable?.sml_cost_value)).toBeCloseTo(700, 2);
      // Damaged units POST IN — they exist, broken.
      expect(Number(damaged?.sml_base_qty)).toBeCloseTo(3, 6);
      expect(Number(damaged?.sml_cost_value)).toBeCloseTo(84, 2);

      // B6b — the transit row is settled, and the short is GENERATED.
      const [transit] = result.transit;
      expect(transit.receivedQty).toBeCloseTo(25, 6);
      expect(transit.damageQty).toBeCloseTo(3, 6);
      expect(transit.remainingQty).toBeCloseTo(2, 6);
      expect(transit.status).toBe('PARTIAL');

      // B6d — THE RECEIPT IS FINISHED AND THE TRANSFER IS NOT. The short keeps
      // it open on purpose: that is the loss report, at 2 × 28.00 = 56.00.
      expect(result.outVoucher.closed).toBe(false);
      expect(result.outVoucher.status).toBe('IN_TRANSIT');
      expect(await voucherStatus(outId)).toBe('IN_TRANSIT');

      // B6c — transit_in fell to the remaining 2.
      expect(await onHand(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(28, 6);
      expect(await transitIn(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(2, 6);

      expect(await rebuildDiffers()).toBe(0);
    });

    it('pins the cost_rate_wot asymmetry rather than asserting it is right', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      // ⚠️ B6a, and open item 3. sml_cost_rate comes from the transit row while
      // sml_cost_rate_wot is read from stock_lot AS IT STANDS NOW, so the two
      // rates on one ledger row describe different moments. The review's fix is
      // a stt_cost_rate_wot column. This assertion exists so that landing that
      // fix is a DELIBERATE change to a test, not a surprise in production.
      const receiptId = createdVoucherIds.at(-1) as string;
      const rows = await ledgerFor(receiptId);
      for (const row of rows) {
        expect(Number(row.sml_cost_rate)).toBeCloseTo(28, 6);
        expect(row.sml_cost_rate_wot).not.toBeNull();
      }
    });

    it('closes the transfer when the last 2 turn up', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const lotId = await milkLot();
      const draft = await service.saveReceive(TRANSFER_IN_RULES, {
        header: {
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchB as string,
          deviceId: fixture.deviceB as string,
          docDate: RECEIPT_DATE,
          linkSrcDocId: outId,
          linkSrcAccYear: ACC_YEAR,
          userId: fixture.userId,
        },
        lines: [
          {
            lineNo: 1,
            itemId: fixture.milkId,
            uomId: fixture.milkPieceIuc,
            baseUomId: fixture.milkPieceIuc,
            toBaseFactor: 1,
            baseQty: 2,
            godownId: fixture.gdStore as string,
            lotId,
            bucket: 'SALEABLE',
            qty: 2,
          },
        ],
      } as never);
      createdVoucherIds.push(draft.header.svhId);

      const result = await service.receive(
        TRANSFER_IN_RULES,
        draft.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchB as string,
        fixture.userId,
      );

      // B7 — received 27, damage 3, nothing left.
      const [transit] = result.transit;
      expect(transit.receivedQty).toBeCloseTo(27, 6);
      expect(transit.remainingQty).toBeCloseTo(0, 6);
      expect(transit.status).toBe('RECEIVED');
      expect(result.outVoucher.closed).toBe(true);
      expect(await voucherStatus(outId)).toBe('RECEIVED');
      expect(await transitIn(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(0, 6);
      expect(await rebuildDiffers()).toBe(0);
    });
  });

  // ── §11.6 — the refusals ──────────────────────────────────────────────────

  describe('refusals', () => {
    it('refuses receiving more than remains', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const lotId = await milkLot();
      const outId2 = await draftTransfer(fixture.gdStore as string, 4, fixture.branchB as string);
      await service.despatch(TRANSFER_OUT_RULES, {
        svhId: outId2,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        userId: fixture.userId,
      });

      await expect(
        service.saveReceive(TRANSFER_IN_RULES, {
          header: {
            accYear: ACC_YEAR,
            companyId: fixture.companyId,
            branchId: fixture.branchB as string,
            deviceId: fixture.deviceB as string,
            docDate: RECEIPT_DATE,
            linkSrcDocId: outId2,
            linkSrcAccYear: ACC_YEAR,
            userId: fixture.userId,
          },
          lines: [
            {
              lineNo: 1,
              itemId: fixture.milkId,
              uomId: fixture.milkPieceIuc,
              baseUomId: fixture.milkPieceIuc,
              toBaseFactor: 1,
              baseQty: 99,
              godownId: fixture.gdStore as string,
              lotId,
              qty: 99,
            },
          ],
        } as never),
      ).rejects.toMatchObject({ status: 422 });
    });

    it('refuses receiving at the wrong branch', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const outId3 = await draftTransfer(fixture.gdStore as string, 2, fixture.branchB as string);
      await service.despatch(TRANSFER_OUT_RULES, {
        svhId: outId3,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        userId: fixture.userId,
      });
      // The SENDING branch trying to receive its own despatch.
      await expect(
        service.prefill(fixture.companyId, fixture.branchA, outId3, ACC_YEAR),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('refuses cancelling a transfer that is in flight — goods that left cannot be cancelled on paper', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const outId4 = await draftTransfer(fixture.gdStore as string, 1, fixture.branchB as string);
      await service.despatch(TRANSFER_OUT_RULES, {
        svhId: outId4,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        userId: fixture.userId,
      });
      await expect(
        voucherService.cancel(
          TRANSFER_OUT_RULES,
          outId4,
          ACC_YEAR,
          'e2e in-flight cancel',
          fixture.companyId,
          fixture.branchA,
          fixture.userId,
        ),
        // tr_svh_transfer_cancel_guard, 23001 → 409 carrying the engine's own
        // sentence, which reads as an instruction to the clerk.
      ).rejects.toMatchObject({ status: 409 });
    });

    it('refuses a transfer line with no lot', async () => {
      if (!requireEngine()) {
        return;
      }
      await expect(
        service.save(TRANSFER_OUT_RULES, {
          header: {
            accYear: ACC_YEAR,
            companyId: fixture.companyId,
            branchId: fixture.branchA,
            deviceId: fixture.deviceA,
            docDate: TRANSFER_DATE,
            fromGodownId: fixture.gdMain,
            toGodownId: fixture.gdCold ?? fixture.gdMain,
            userId: fixture.userId,
          },
          lines: [
            {
              lineNo: 1,
              itemId: fixture.milkId,
              uomId: fixture.milkPieceIuc,
              baseUomId: fixture.milkPieceIuc,
              toBaseFactor: 1,
              baseQty: 1,
              godownId: fixture.gdMain,
              qty: 1,
            },
          ],
        } as never),
      ).rejects.toMatchObject({ status: 422 });
    });

    it('refuses a godown transferring to itself', async () => {
      if (!requireEngine()) {
        return;
      }
      const lotId = await milkLot();
      await expect(
        service.save(TRANSFER_OUT_RULES, {
          header: {
            accYear: ACC_YEAR,
            companyId: fixture.companyId,
            branchId: fixture.branchA,
            deviceId: fixture.deviceA,
            docDate: TRANSFER_DATE,
            fromGodownId: fixture.gdMain,
            toGodownId: fixture.gdMain,
            userId: fixture.userId,
          },
          lines: [
            {
              lineNo: 1,
              itemId: fixture.milkId,
              uomId: fixture.milkPieceIuc,
              baseUomId: fixture.milkPieceIuc,
              toBaseFactor: 1,
              baseQty: 1,
              godownId: fixture.gdMain,
              lotId,
              qty: 1,
            },
          ],
        } as never),
      ).rejects.toMatchObject({ status: 422 });
    });
  });
});
