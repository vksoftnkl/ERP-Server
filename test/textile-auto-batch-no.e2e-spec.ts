import '../src/env.preload';

import { HttpException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import type { SaveStockVoucherDto } from '../src/modules/stocks/stock-voucher/dto/save-stock-voucher.dto';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { LotByBatchService } from '../src/modules/stocks/lot-by-batch/lot-by-batch.service';
import { buildStockPosting } from './helpers/stock-posting.factory';

/**
 * Textile plan (2026-10-23) S1 + S2, in ONE rolled-back transaction against
 * the live database: an opening save numbers each blank batch of a
 * TEXTILE_BATCH item `<bill prefix><YY>-<NNNNN>`, keeps a typed batch and an
 * edited line's number, posts one lot per line, and the batch scan finds each
 * lot by its label. The branch's bill prefix, the setting, the item and its
 * policy are all made inside the transaction; nothing survives the run.
 */
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

const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-10-23';
const PREFIX = 'ZTX';

/** As opening-stock-voucher.controller.ts pins it. */
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
  autoBatchNo: true,
  auditScreenName: 'Opening Stock',
  statusDocType: TxnStatusDocType.OPENING_STOCK,
  postShape: 'SIMPLE',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

interface Fixture {
  companyId: string;
  branchId: string;
  deviceId: string;
  godownId: string;
  userId: string;
  itemId: string;
  pieceIuc: string;
}

interface StoredLine {
  svi_id: string;
  svi_line_no: number;
  svi_batch_no: string | null;
}

describe('Textile auto batch no + batch scan (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let fixture: Fixture;
  let service: StockVoucherService;
  let scan: LotByBatchService;
  let svhId: string;
  let first: number;

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
          { maxWait: 30_000, timeout: 10 * 60_000 },
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
    fixture = await createFixture();
    const db = transactional(tx);
    service = new StockVoucherService(
      db,
      {
        logEntityChange: jest.fn().mockResolvedValue(undefined),
        logDocumentRevision: jest.fn().mockResolvedValue({ revNo: 1 }),
      } as unknown as AuditLogService,
      { getUserId: () => fixture.userId } as unknown as RequestContextService,
      // PERIODIC: the opening writes no accounts voucher, so the run needs no
      // ledger map — what is under test is the lot, not the books.
      buildStockPosting(db, 'PERIODIC').stockPosting,
    );
    scan = new LotByBatchService(db);
  });

  afterAll(async () => {
    release?.();
    await txDone;
    await prisma.$disconnect();
  });

  async function createFixture(): Promise<Fixture> {
    const [scope] = await tx.$queryRaw<
      {
        company_id: string;
        branch_id: string;
        device_id: string;
        godown_id: string;
        user_id: string;
      }[]
    >`
      SELECT br.br_comp_id AS company_id, br.br_id AS branch_id, dev.dev_id AS device_id,
             gdl.gdl_id AS godown_id, usr.usr_id AS user_id
        FROM public.branch_master br
        JOIN fixed.device_master dev        ON dev.dev_branch_id = br.br_id AND dev.dev_is_deleted = false
        JOIN inventory.godown_locations gdl ON gdl.gdl_branch_id = br.br_id AND gdl.gdl_is_deleted = false
        JOIN public.user_master usr         ON usr.usr_is_deleted = false
       WHERE br.br_is_deleted = false
       LIMIT 1`;
    if (!scope) throw new Error('No branch with a device, a godown and a user on this database.');

    await tx.$executeRaw`
      UPDATE public.branch_master SET br_bill_prefix = ${PREFIX} WHERE br_id = ${scope.branch_id}::uuid`;
    await tx.$executeRaw`
      UPDATE public.app_setting_value SET asv_is_deleted = true
       WHERE asv_setting_key = 'stock.auto_batch_no' AND asv_is_deleted = false`;
    await tx.$executeRaw`
      INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_company_id, asv_value, asv_created_by)
      VALUES ('stock.auto_batch_no', 'COMPANY', ${scope.company_id}::uuid, 'true', 'e2e')`;

    const [group] = await tx.$queryRaw<{ itg_id: string }[]>`
      SELECT itg_id FROM inventory.item_group_master LIMIT 1`;
    const [unit] = await tx.$queryRaw<{ unit_id: string }[]>`
      SELECT unit_id FROM inventory.item_unit_master ORDER BY unit_name LIMIT 1`;
    const item = await tx.itemMaster.create({
      data: {
        itemCode: `E2E-TXT-${Date.now()}`,
        itemNameEn: `Shirt (textile e2e ${Date.now()})`,
        itemGroupId: group.itg_id,
        itemCompanyId: scope.company_id,
        itemBranchId: scope.branch_id,
      },
      select: { itemId: true },
    });
    const piece = await tx.itemUnitConversion.create({
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
    // The item tracked as the TEXTILE_BATCH preset says (D4): batch + MRP + price.
    await tx.$executeRaw`
      INSERT INTO stock.stock_track_policy
        (stp_company_id, stp_scope, stp_scope_id, stp_track_batch, stp_track_mrp, stp_track_sale_price,
         stp_valuation_method, stp_issue_strategy, stp_allow_negative, stp_remarks)
      SELECT ${scope.company_id}::uuid, 'ITEM', ${item.itemId}::uuid,
             spt_track_batch, spt_track_mrp, spt_track_sale_price,
             spt_valuation_method, spt_issue_strategy, spt_allow_negative, 'e2e textile'
        FROM stock.stock_track_preset
       WHERE spt_code = 'TEXTILE_BATCH' AND spt_company_id IS NULL AND spt_is_deleted = false`;

    return {
      companyId: scope.company_id,
      branchId: scope.branch_id,
      deviceId: scope.device_id,
      godownId: scope.godown_id,
      userId: scope.user_id,
      itemId: item.itemId,
      pieceIuc: piece.iucId,
    };
  }

  const line = (lineNo: number, batchNo: string | null, extra: Record<string, unknown> = {}) => ({
    lineNo,
    itemId: fixture.itemId,
    uomId: fixture.pieceIuc,
    baseUomId: fixture.pieceIuc,
    toBaseFactor: 1,
    qty: 5,
    baseQty: 5,
    godownId: fixture.godownId,
    costRate: 300,
    taxPerc: 5,
    mrp: 799,
    salePrice: 699,
    batchNo,
    ...extra,
  });

  const payload = (lines: unknown[], header: Record<string, unknown> = {}) =>
    ({
      header: {
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        deviceId: fixture.deviceId,
        docDate: DOC_DATE,
        toGodownId: fixture.godownId,
        rateSource: 'MANUAL',
        userId: fixture.userId,
        ...header,
      },
      lines,
    }) as unknown as SaveStockVoucherDto;

  const storedLines = (id: string) => tx.$queryRaw<StoredLine[]>`
    SELECT svi_id, svi_line_no, svi_batch_no FROM stock.stock_voucher_item
     WHERE svi_voucher_id = ${id}::uuid AND svi_is_deleted = false ORDER BY svi_line_no`;

  const numberOf = (batch: string | null) => {
    const match = /^ZTX26-(\d{5,})$/.exec(batch ?? '');
    if (!match) throw new Error(`not an auto batch: ${batch}`);
    return Number(match[1]);
  };

  it('numbers each blank line <bill prefix><YY>-<NNNNN>, one per line, and keeps a typed batch', async () => {
    const saved = await service.save(
      OPENING_RULES,
      payload([line(1, null), line(2, 'my-typed-7'), line(3, '  ')]),
    );
    svhId = saved.header.svhId;

    const rows = await storedLines(svhId);
    first = numberOf(rows[0].svi_batch_no);
    // Line 3 is line 1's item, MRP and price: still its own label run.
    expect(rows.map((r) => r.svi_batch_no)).toEqual([
      rows[0].svi_batch_no,
      'my-typed-7',
      `ZTX26-${String(first + 1).padStart(5, '0')}`,
    ]);
    // The save's own reply carries them (Qt Q1 shows them after save).
    expect(saved.lines.map((l) => l.batchNo)).toEqual(rows.map((r) => r.svi_batch_no));
  });

  it('an edit keeps every number and gives a new line the next one', async () => {
    const before = await storedLines(svhId);

    await service.save(
      OPENING_RULES,
      payload(
        [
          line(1, null, { sviId: before[0].svi_id }),
          line(2, 'my-typed-7', { sviId: before[1].svi_id }),
          line(3, before[2].svi_batch_no, { sviId: before[2].svi_id }),
          line(4, null),
        ],
        { svhId },
      ),
    );

    const after = await storedLines(svhId);
    expect(after.slice(0, 3).map((r) => r.svi_batch_no)).toEqual(before.map((r) => r.svi_batch_no));
    expect(numberOf(after[3].svi_batch_no)).toBe(first + 2);
  });

  it('posts one lot per line, and the scan finds each by its label, folded', async () => {
    await service.post(
      OPENING_RULES,
      svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );
    const rows = await storedLines(svhId);

    const lots = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM stock.stock_lot WHERE slt_item_id = ${fixture.itemId}::uuid`;
    expect(lots[0].n).toBe(4);

    const found = await scan.find({
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      batchNo: ` ${rows[0].svi_batch_no!.toLowerCase()} `,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      itemId: fixture.itemId,
      baseUomId: fixture.pieceIuc,
      batchNo: rows[0].svi_batch_no,
      mrp: 799,
      salePrice: 699,
      status: 'ACTIVE',
      onHandQty: 5,
      godowns: [{ godownId: fixture.godownId, onHandQty: 5, availableQty: 5 }],
    });

    const typed = await scan.find({
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      batchNo: 'MY-TYPED-7',
    });
    expect(typed.map((l) => l.batchNo)).toEqual(['my-typed-7']);
  });

  it('404s STOCK_BATCH_NOT_FOUND on a label nobody holds', async () => {
    await expect(
      scan.find({
        companyId: fixture.companyId,
        branchId: fixture.branchId,
        batchNo: 'zz-nothing-1',
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        message: 'No stock with batch ZZ-NOTHING-1',
        errors: [{ code: 'STOCK_BATCH_NOT_FOUND' }],
      },
    });
  });

  it('gives nothing while stock.auto_batch_no is off', async () => {
    await tx.$executeRaw`
      UPDATE public.app_setting_value SET asv_value = 'false'
       WHERE asv_setting_key = 'stock.auto_batch_no' AND asv_company_id = ${fixture.companyId}::uuid
         AND asv_is_deleted = false`;

    const saved = await service.save(OPENING_RULES, payload([line(1, null)]));

    expect((await storedLines(saved.header.svhId))[0].svi_batch_no).toBeNull();
  });

  it('refuses STOCK_BATCH_PREFIX_MISSING when the branch has no bill prefix and no code', async () => {
    await tx.$executeRaw`
      UPDATE public.app_setting_value SET asv_value = 'true'
       WHERE asv_setting_key = 'stock.auto_batch_no' AND asv_company_id = ${fixture.companyId}::uuid
         AND asv_is_deleted = false`;
    await tx.$executeRaw`
      UPDATE public.branch_master SET br_bill_prefix = NULL, br_code = '  '
       WHERE br_id = ${fixture.branchId}::uuid`;

    const refused = await service
      .save(OPENING_RULES, payload([line(1, null)]))
      .catch((e: unknown) => e);

    expect(refused).toBeInstanceOf(HttpException);
    expect((refused as HttpException).getStatus()).toBe(422);
    expect((refused as HttpException).getResponse()).toMatchObject({
      message: 'Set a bill prefix on this branch to number batches.',
      errors: [{ field: 'branchId', code: 'STOCK_BATCH_PREFIX_MISSING' }],
    });
  });
});
