import { PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import { assertStockBalances } from '../src/modules/stocks/posting/stock-balance-assertion';
import { StockTransferService } from '../src/modules/stocks/stock-transfer/stock-transfer.service';
import { buildStockPosting } from './helpers/stock-posting.factory';
import { TRANSFER_OUT_RULES } from '../src/modules/stocks/stock-transfer/stock-transfer.controller';
import { TRANSFER_IN_RULES } from '../src/modules/stocks/stock-transfer/stock-transfer-receive.controller';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';

/**
 * §11 of `plan/plan-nestjs-stock-transfer.md` — the acceptance test, run
 * against a REAL database.
 *
 * THE ENGINE IS TYPESCRIPT (plan-nestjs-stock-engine §1.1, 2026-09-28): the
 * despatch and the receipt post through `StockPostingService` with the
 * TRANSFER_OUT / TRANSFER_IN shapes, and no SQL function is needed. The suite
 * skips only when the stock TABLES are missing.
 *
 *     SELECT stock.fn_create_stock_partitions('2026-2027');
 *     npm run test:e2e -- stock-transfer
 *
 * THE FIGURES ARE `20_stock_transfer_flow.md`'s, worked from the former
 * function bodies. If one disagrees, the flow doc is as likely to be wrong as
 * this code, and the difference must be resolved rather than an expectation
 * edited.
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
  statusDocType: TxnStatusDocType.OPENING_STOCK,
  postShape: 'SIMPLE',
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

/** Are the stock tables here (and the transit column 20260928100000 added)? */
async function detectEngine(): Promise<{ ready: boolean; missing: string[] }> {
  try {
    const missing: string[] = [];
    const [wot] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM information_schema.columns
       WHERE table_schema = 'stock' AND table_name = 'stock_transit' AND column_name = 'stt_cost_rate_wot'
    `;
    if (Number(wot?.n ?? 0) === 0) {
      missing.push('stock_transit.stt_cost_rate_wot (migration 20260928100000)');
    }

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
  /** A second branch (with a godown and a device) raised by this run, when the seed has none. */
  let createdBranch: { branchId: string; godownId: string; deviceId: string } | null = null;

  beforeAll(async () => {
    engine = await detectEngine();
    if (!engine.ready) {
      const message =
        `the stock tables are not on this database.\n` +
        `  Missing: ${engine.missing.join(', ')}\n` +
        `  Run the migrations, then:\n` +
        `    SELECT stock.fn_create_stock_partitions('${ACC_YEAR}');`;
      // eslint-disable-next-line no-console
      console.warn(`\n[stock-transfer e2e] SKIPPED — ${message}\n`);
      return;
    }

    const engineParts = buildStockPosting(prisma as unknown as PrismaService);
    voucherService = new StockVoucherService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService,
      { getUserId: () => fixture?.userId ?? null } as unknown as RequestContextService,
      // §3.1 — the one stock engine, injected.
      engineParts.stockPosting,
    );
    service = new StockTransferService(
      prisma as unknown as PrismaService,
      voucherService,
      { getUserId: () => fixture?.userId ?? null } as unknown as RequestContextService,
      engineParts.stockAccounts,
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
                                           AND dev.dev_is_deleted = false AND dev.dev_is_active = true
        JOIN inventory.godown_locations gdl ON gdl.gdl_branch_id = br.br_id
                                           AND gdl.gdl_is_deleted = false
        JOIN public.user_master usr         ON usr.usr_is_deleted = false
       WHERE br.br_is_deleted = false
       -- Shape A needs TWO godowns in one branch: prefer the branch that has them.
       ORDER BY (SELECT count(*) FROM inventory.godown_locations g2
                  WHERE g2.gdl_branch_id = br.br_id AND g2.gdl_is_deleted = false) DESC,
                gdl.gdl_name, dev.dev_device_uid
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
    let [other] = await prisma.$queryRaw<
      Array<{ branch_id: string; godown_id: string; device_id: string }>
    >`
      SELECT br.br_id AS branch_id, gdl.gdl_id AS godown_id, dev.dev_id AS device_id
        FROM public.branch_master br
        JOIN inventory.godown_locations gdl ON gdl.gdl_branch_id = br.br_id
                                           AND gdl.gdl_is_deleted = false
        JOIN fixed.device_master dev        ON dev.dev_branch_id = br.br_id
                                           AND dev.dev_is_deleted = false AND dev.dev_is_active = true
       WHERE br.br_is_deleted = false
         AND br.br_comp_id = ${scope.company_id}::uuid
         AND br.br_id <> ${scope.branch_id}::uuid
       LIMIT 1
    `;
    if (!other) {
      // No second branch with a godown and a device in this company: raise a
      // temporary one, so shape B is exercised rather than skipped. Removed in
      // cleanUp, after every row that points at it.
      const stampB = Date.now().toString(36);
      const [home] = await prisma.$queryRaw<Array<{ br_state_code: string }>>`
        SELECT br_state_code FROM public.branch_master WHERE br_id = ${scope.branch_id}::uuid
      `;
      const [branch] = await prisma.$queryRaw<Array<{ br_id: string }>>`
        INSERT INTO public.branch_master (br_comp_id, br_name, br_code, br_state_code)
        VALUES (${scope.company_id}::uuid, ${`TrfE2E Branch ${stampB}`}, ${`E2ETRF${stampB}`.slice(0, 20)}, ${home.br_state_code})
        RETURNING br_id
      `;
      const [godown] = await prisma.$queryRaw<Array<{ gdl_id: string }>>`
        INSERT INTO inventory.godown_locations (gdl_branch_id, gdl_name)
        VALUES (${branch.br_id}::uuid, ${`TrfE2E Store ${stampB}`})
        RETURNING gdl_id
      `;
      const [device] = await prisma.$queryRaw<Array<{ dev_id: string }>>`
        INSERT INTO fixed.device_master (dev_company_id, dev_branch_id, dev_device_uid, dev_device_name, dev_is_active)
        VALUES (${scope.company_id}::uuid, ${branch.br_id}::uuid, ${`E2E-TRF-${stampB}`}, ${`TrfE2E till ${stampB}`}, true)
        RETURNING dev_id
      `;
      createdBranch = { branchId: branch.br_id, godownId: godown.gdl_id, deviceId: device.dev_id };
      other = { branch_id: branch.br_id, godown_id: godown.gdl_id, device_id: device.dev_id };
    }

    // A unique name per run: item_name_en is unique, and a run that aborted
    // before cleanUp must not block the next one.
    const stamp = Date.now().toString(36);
    const milk = await createItem(`E2E-TRF-MILK-${stamp}`, `TrfE2E Milk 500ml ${stamp}`, scope, [
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
      // The named unit when the seed has it; otherwise any unit will do —
      // every quantity here is keyed in the base unit at factor 1.
      const [unitRow] = await prisma.$queryRaw<Array<{ unit_id: string }>>`
        SELECT unit_id FROM inventory.item_unit_master
         ORDER BY (unit_name = ${unit.name}) DESC, unit_name LIMIT 1
      `;
      if (!unitRow) {
        throw new Error(`No item_unit_master row at all — seed the units first.`);
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
      await prisma.$executeRaw`DELETE FROM accounts.acc_vouchers WHERE av_voucher_id IN (
        SELECT avh_voucher_id FROM accounts.acc_voucher_header WHERE avh_src_module = 'STOCK' AND avh_src_doc_id = ${svhId}::uuid
        UNION SELECT avh_voucher_id FROM accounts.acc_voucher_header WHERE avh_against_voucher_id IN (
          SELECT avh_voucher_id FROM accounts.acc_voucher_header WHERE avh_src_module = 'STOCK' AND avh_src_doc_id = ${svhId}::uuid))`;
      await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_against_voucher_id IN (
        SELECT avh_voucher_id FROM accounts.acc_voucher_header WHERE avh_src_module = 'STOCK' AND avh_src_doc_id = ${svhId}::uuid)`;
      await prisma.$executeRaw`DELETE FROM accounts.acc_voucher_header WHERE avh_src_module = 'STOCK' AND avh_src_doc_id = ${svhId}::uuid`;
      await prisma.$executeRaw`DELETE FROM public.txn_status_log WHERE tsl_src_doc_id = ${svhId}::uuid`;
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
    if (createdBranch) {
      await prisma.$executeRaw`DELETE FROM public.txn_status_log WHERE tsl_branch_id = ${createdBranch.branchId}::uuid`;
      await prisma.$executeRaw`DELETE FROM fixed.device_master WHERE dev_id = ${createdBranch.deviceId}::uuid`;
      await prisma.$executeRaw`DELETE FROM inventory.godown_locations WHERE gdl_id = ${createdBranch.godownId}::uuid`;
      await prisma.$executeRaw`DELETE FROM public.branch_master WHERE br_id = ${createdBranch.branchId}::uuid`;
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

  /** §11.9 / §5.1 — every derived figure must agree with its source, every time. */
  const rebuildDiffers = async (): Promise<number> =>
    (await assertStockBalances(prisma, { companyId: fixture.companyId, itemId: fixture.milkId }))
      .length;

  /** The live accounts voucher a stock document (or its short settlement) wrote. */
  const accountsVoucherFor = async (docType: string, docId: string) =>
    prisma.$queryRaw<
      Array<{ avh_voucher_id: string; av_dr_cr: string; av_amount: string; av_role: string | null }>
    >`
      SELECT h.avh_voucher_id, l.av_dr_cr, l.av_amount::text, l.av_role
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_vouchers l ON l.av_voucher_id = h.avh_voucher_id AND l.av_is_deleted = false
       WHERE h.avh_src_module = 'STOCK' AND h.avh_src_doc_type = ${docType}
         AND h.avh_src_doc_id = ${docId}::uuid AND h.avh_is_deleted = false
         AND h.avh_voucher_status = 'POSTED'
       ORDER BY l.av_row_no
    `;

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

  /** MILK 100 @ 28.00, batch B-2604, in MAIN of branch A (the flow's 55, plus enough for every case below). */
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
          baseQty: 100,
          godownId: fixture.gdMain,
          batchNo: 'B-2604',
          expiryDate: '2026-06-30',
          qty: 100,
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

      // A4a/A4b — the cost is STAMPED by the engine from the branch's moving
      // average (28.00), and the IN row carries the OUT row's figure. Nobody
      // typed it: the API stripped the line to 0 on purpose.
      expect(Number(out?.sml_cost_rate)).toBeCloseTo(28, 6);
      expect(Number(into?.sml_cost_rate)).toBeCloseTo(28, 6);
      expect(Number(out?.sml_cost_value)).toBeCloseTo(560, 2);
      expect(Number(into?.sml_cost_value)).toBeCloseTo(560, 2);

      // A4c — the balance moved. COLD is created by the engine if it never
      // held the item.
      expect(await onHand(fixture.branchA, fixture.gdMain)).toBeCloseTo(80, 6);
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
      // A same-company transfer posts NO accounts leg (one Stock-in-Hand
      // ledger), so there is nothing to reverse there either.
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
      // ensureBalanceRows when B has never held the item. Without it the
      // inbound quantity would be invisible until the goods arrived, which is
      // the commonest first-transfer case.
      expect(await transitIn(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(
        30,
        6,
      );
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
      expect(await transitIn(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(
        2,
        6,
      );

      expect(await rebuildDiffers()).toBe(0);
    });

    it('carries BOTH costs across the transit: cost_rate_wot on the IN row is the OUT row\'s', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      // B6a, and the former open item 3: stt_cost_rate_wot is stamped at
      // despatch (migration 20260928100000), so the two rates on one IN row
      // describe the same moment — the moment the goods left.
      const receiptId = createdVoucherIds.at(-1) as string;
      const [out] = await ledgerFor(outId);
      const rows = await ledgerFor(receiptId);
      for (const row of rows) {
        expect(Number(row.sml_cost_rate)).toBeCloseTo(28, 6);
        expect(Number(row.sml_cost_rate_wot)).toBeCloseTo(Number(out.sml_cost_rate_wot), 6);
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
      expect(await transitIn(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(
        0,
        6,
      );
      expect(await rebuildDiffers()).toBe(0);
    });
  });

  // ── §1.1 — short-settle ────────────────────────────────────────────────────

  describe('short-settle', () => {
    it('closes a despatch whose remainder never arrives, keeps the short on the report and posts the loss', async () => {
      if (!requireTwoBranches()) {
        return;
      }
      const lotId = await milkLot();
      const shortOut = await draftTransfer(fixture.gdStore as string, 6, fixture.branchB as string);
      await service.despatch(TRANSFER_OUT_RULES, {
        svhId: shortOut,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        userId: fixture.userId,
      });
      const [reason] = await prisma.$queryRaw<Array<{ srm_id: string }>>`
        SELECT srm_id FROM stock.stock_reason_master
         WHERE srm_code = 'TRANSIT_LOSS' AND srm_company_id IS NULL AND srm_is_deleted = false LIMIT 1
      `;
      expect(reason).toBeDefined();

      // Nothing received yet: a short is settled AFTER the receipt, not instead of it.
      await expect(
        service.settleShort({
          outVoucherId: shortOut,
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchA,
          reasonId: reason.srm_id,
          userId: fixture.userId,
        }),
      ).rejects.toMatchObject({ status: 409 });

      // 4 of 6 arrive.
      const receipt = await service.saveReceive(TRANSFER_IN_RULES, {
        header: {
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchB as string,
          deviceId: fixture.deviceB as string,
          docDate: RECEIPT_DATE,
          linkSrcDocId: shortOut,
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
            baseQty: 4,
            godownId: fixture.gdStore as string,
            lotId,
            qty: 4,
          },
        ],
      } as never);
      createdVoucherIds.push(receipt.header.svhId);
      await service.receive(
        TRANSFER_IN_RULES,
        receipt.header.svhId,
        ACC_YEAR,
        fixture.companyId,
        fixture.branchB as string,
        fixture.userId,
      );
      const transitBefore = await transitIn(fixture.branchB as string, fixture.gdStore as string);
      expect(transitBefore).toBeCloseTo(2, 6);

      const settled = await service.settleShort({
        outVoucherId: shortOut,
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchA,
        reasonId: reason.srm_id,
        remarks: 'e2e: two cartons never arrived',
        userId: fixture.userId,
      });
      expect(settled.outVoucher.status).toBe('RECEIVED');
      expect(settled.rowsSettled).toBe(1);
      expect(settled.shortQty).toBeCloseTo(2, 6);
      expect(settled.shortValue).toBeCloseTo(56, 2);
      expect(await voucherStatus(shortOut)).toBe('RECEIVED');

      // The transit row is RECEIVED and STILL says 2 short — the loss report.
      const [row] = settled.transit;
      expect(row.status).toBe('RECEIVED');
      expect(row.remainingQty).toBeCloseTo(2, 6);
      // The destination stops expecting the goods.
      expect(await transitIn(fixture.branchB as string, fixture.gdStore as string)).toBeCloseTo(0, 6);

      // Under PERPETUAL: DR reason ledger (STOCK_SHORTAGE) / CR INVENTORY, 56.00.
      expect(settled.accountsVoucherId).not.toBeNull();
      const legs = await accountsVoucherFor('TRANSFER_OUT', shortOut);
      expect(legs).toHaveLength(2);
      const dr = legs.find((l) => l.av_dr_cr.trim() === 'DR');
      const cr = legs.find((l) => l.av_dr_cr.trim() === 'CR');
      expect(Number(dr?.av_amount)).toBeCloseTo(56, 2);
      expect(Number(cr?.av_amount)).toBeCloseTo(56, 2);
      expect(cr?.av_role).toBe('INVENTORY');

      // A second settle is a no-op refusal: nothing is short any more.
      await expect(
        service.settleShort({
          outVoucherId: shortOut,
          accYear: ACC_YEAR,
          companyId: fixture.companyId,
          branchId: fixture.branchA,
          reasonId: reason.srm_id,
          userId: fixture.userId,
        }),
      ).rejects.toMatchObject({ status: 409 });

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
        // The engine's cancel guard: a 409 carrying a sentence that reads as an
        // instruction to the clerk.
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
