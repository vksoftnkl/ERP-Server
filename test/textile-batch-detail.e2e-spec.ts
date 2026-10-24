import '../src/env.preload';

import { HttpException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import type { PgService } from '../src/database/pg/pg.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import type { SaveStockVoucherDto } from '../src/modules/stocks/stock-voucher/dto/save-stock-voucher.dto';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { LotByBatchService } from '../src/modules/stocks/lot-by-batch/lot-by-batch.service';
import { BatchDetailService } from '../src/modules/stocks/batch-detail/batch-detail.service';
import {
  batchDetailId,
  batchDetailKey,
  batchDetailsFor,
} from '../src/modules/stocks/batch-detail/batch-detail.helper';
import { ItemSizeMasterService } from '../src/modules/Inventory/item-size-colour-master/item-size-master.service';
import { ItemColourMasterService } from '../src/modules/Inventory/item-size-colour-master/item-colour-master.service';
import { SaleBillItemsProvider } from '../src/modules/settings/print-render/data/providers/sale-bill-items.provider';
import { buildStockPosting } from './helpers/stock-posting.factory';

/**
 * Textile auto batch, addendum 2 (2026-10-23), in ONE rolled-back transaction
 * against the live database: the size and colour masters (quick-add, the 409
 * that names the existing row, delete refused while used), an opening save
 * writing each auto batch's size / colour / model to stock_batch_detail, an
 * edit and a removed line, the model suggestions, the post-time correction
 * (refused on a draft), the scan and the sale-side read carrying the names.
 * Nothing it writes survives the run.
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
const RUN = Date.now().toString(36).toUpperCase();

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

describe('Textile batch detail, addendum 2 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let fixture: Fixture;
  let vouchers: StockVoucherService;
  let sizes: ItemSizeMasterService;
  let colours: ItemColourMasterService;
  let details: BatchDetailService;
  let scan: LotByBatchService;
  let sizeXl: string;
  let sizeL: string;
  let colourMaroon: string;
  let svhId: string;
  let autoBatch: string;

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
    const ctx = {
      getUserId: () => fixture.userId,
      getCompanyId: () => fixture.companyId,
      getDeviceId: () => null,
      getIpAddress: () => '127.0.0.1',
    } as unknown as RequestContextService;
    const audit = new AuditLogService(db, ctx);
    vouchers = new StockVoucherService(
      db,
      {
        logEntityChange: jest.fn().mockResolvedValue(undefined),
        logDocumentRevision: jest.fn().mockResolvedValue({ revNo: 1 }),
      } as unknown as AuditLogService,
      ctx,
      buildStockPosting(db, 'PERIODIC').stockPosting,
    );
    sizes = new ItemSizeMasterService(db, audit, ctx);
    colours = new ItemColourMasterService(db, audit, ctx);
    details = new BatchDetailService(db, audit, ctx);
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
    await tx.$executeRaw`
      UPDATE public.branch_master SET br_bill_prefix = 'ZTX' WHERE br_id = ${scope.branch_id}::uuid`;
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
        itemCode: `E2E-SBD-${RUN}`,
        itemNameEn: `Shirt (batch detail e2e ${RUN})`,
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
    qty: 4,
    baseQty: 4,
    godownId: fixture.godownId,
    costRate: 300,
    taxPerc: 5,
    mrp: 999,
    salePrice: 899,
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

  const liveDetails = () => tx.$queryRaw<
    { sbd_id: string; sbd_batch_no: string; sbd_model: string | null; sbd_is_deleted: boolean }[]
  >`
    SELECT sbd_id, sbd_batch_no, sbd_model, sbd_is_deleted FROM stock.stock_batch_detail
     WHERE sbd_src_doc_id = ${svhId}::uuid ORDER BY sbd_batch_no`;

  const refusal = async (promise: Promise<unknown>) => {
    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    return {
      status: (error as HttpException).getStatus(),
      body: (error as HttpException).getResponse() as { errors: Record<string, unknown>[] },
    };
  };

  it('masters: a quick-add, and the 409 that hands back the row already holding the name', async () => {
    const xl = await sizes.save({
      isz_name: `ZXL-${RUN}`,
      isz_company_id: fixture.companyId,
      isz_sort: 50,
    });
    sizeXl = xl.isz_id as string;
    sizeL = (await sizes.save({ isz_name: `ZL-${RUN}`, isz_company_id: fixture.companyId }))
      .isz_id as string;
    // A shared colour: every company's quick-add of the name lands on it.
    colourMaroon = (await colours.save({ icl_name: `ZMaroon-${RUN}` })).icl_id as string;

    const again = await refusal(
      sizes.save({ isz_name: ` zxl-${RUN.toLowerCase()} `, isz_company_id: fixture.companyId }),
    );
    expect(again.status).toBe(409);
    expect(again.body.errors[0]).toMatchObject({
      code: 'ITEM_SIZE_NAME_TAKEN',
      existingId: sizeXl,
    });

    const shared = await refusal(
      colours.save({ icl_name: `zmaroon-${RUN}`, icl_company_id: fixture.companyId }),
    );
    expect(shared.body.errors[0]).toMatchObject({
      code: 'ITEM_COLOUR_NAME_TAKEN',
      existingId: colourMaroon,
    });
  });

  it('an opening save keeps each auto batch its size / colour / model; a typed batch keeps none', async () => {
    const saved = await vouchers.save(
      OPENING_RULES,
      payload([
        line(1, null, { sizeId: sizeXl, colourId: colourMaroon, model: ' Slim fit ' }),
        line(2, 'typed-7'),
        line(3, null, { sizeId: sizeL }),
      ]),
    );
    svhId = saved.header.svhId;
    autoBatch = saved.lines[0].batchNo!;

    expect(saved.lines.map((l) => [l.sizeName, l.colourName, l.model])).toEqual([
      [`ZXL-${RUN}`, `ZMaroon-${RUN}`, 'Slim fit'],
      [null, null, null],
      [`ZL-${RUN}`, null, null],
    ]);
    const rows = await liveDetails();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sbd_id: batchDetailId(fixture.companyId, autoBatch),
      sbd_batch_no: autoBatch,
      sbd_model: 'Slim fit',
      sbd_is_deleted: false,
    });
  });

  it('an edit updates a row, and a removed line takes its row with it', async () => {
    const before = await vouchers.getById(
      OPENING_RULES,
      svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
    );

    const saved = await vouchers.save(
      OPENING_RULES,
      payload(
        [
          line(1, before.lines[0].batchNo, {
            sviId: before.lines[0].sviId,
            sizeId: sizeXl,
            colourId: colourMaroon,
            model: 'Regular',
          }),
          line(2, 'typed-7', { sviId: before.lines[1].sviId }),
        ],
        { svhId },
      ),
    );

    expect(saved.lines[0].model).toBe('Regular');
    const rows = await liveDetails();
    expect(rows.map((r) => [r.sbd_batch_no === autoBatch, r.sbd_is_deleted, r.sbd_model])).toEqual(
      expect.arrayContaining([
        [true, false, 'Regular'],
        [false, true, null],
      ]),
    );
  });

  // Notes 149 #2 — the Qt grid re-saves a draft with the server's number on
  // the line and without line ids, so every stored line gets a fresh svi_id.
  it('a re-save without line ids that hands the number back is not a typed batch', async () => {
    // First pass leaves colour out: a key left out is none.
    const cleared = await vouchers.save(
      OPENING_RULES,
      payload([line(1, autoBatch, { sizeId: sizeXl, model: 'Regular' }), line(2, 'typed-7')], {
        svhId,
      }),
    );
    expect(cleared.lines[0]).toMatchObject({
      batchNo: autoBatch,
      sizeName: `ZXL-${RUN}`,
      colourId: null,
      model: 'Regular',
    });

    // Second pass puts the colour back, again under new line ids.
    const restored = await vouchers.save(
      OPENING_RULES,
      payload(
        [
          line(1, autoBatch, { sizeId: sizeXl, colourId: colourMaroon, model: 'Regular' }),
          line(2, 'typed-7'),
        ],
        { svhId },
      ),
    );
    expect(restored.lines[0]).toMatchObject({
      batchNo: autoBatch,
      sizeName: `ZXL-${RUN}`,
      colourName: `ZMaroon-${RUN}`,
      model: 'Regular',
    });
    expect(restored.lines[0].sviId).not.toBe(cleared.lines[0].sviId);
    const rows = await liveDetails();
    expect(rows.filter((r) => !r.sbd_is_deleted)).toEqual([
      expect.objectContaining({ sbd_batch_no: autoBatch, sbd_model: 'Regular' }),
    ]);
  });

  it('suggests the models used for the item', async () => {
    await expect(
      details.models({ companyId: fixture.companyId, itemId: fixture.itemId }),
    ).resolves.toEqual(['Regular']);
    await expect(
      details.models({ companyId: fixture.companyId, itemId: fixture.itemId, q: 'zz' }),
    ).resolves.toEqual([]);
  });

  it('the post-time fix is refused while the opening is a draft', async () => {
    const draft = await refusal(
      details.update({
        companyId: fixture.companyId,
        batchNo: autoBatch,
        sizeId: sizeL,
        reason: 'test',
      }),
    );
    expect(draft).toMatchObject({
      status: 409,
      body: { errors: [{ code: 'STOCK_BATCH_DETAIL_ON_DRAFT' }] },
    });
  });

  it('after post: the scan carries the names, and the fix changes them with an audit row', async () => {
    await vouchers.post(
      OPENING_RULES,
      svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    const [lot] = await scan.find({
      companyId: fixture.companyId,
      branchId: fixture.branchId,
      batchNo: autoBatch.toLowerCase(),
    });
    expect(lot).toMatchObject({
      sizeId: sizeXl,
      sizeName: `ZXL-${RUN}`,
      colourId: colourMaroon,
      colourName: `ZMaroon-${RUN}`,
      model: 'Regular',
    });

    const fixed = await details.update({
      companyId: fixture.companyId,
      batchNo: ` ${autoBatch.toLowerCase()}`,
      sizeId: sizeL,
      reason: 'Label said L',
    });
    expect(fixed).toMatchObject({
      sizeName: `ZL-${RUN}`,
      colourName: `ZMaroon-${RUN}`,
      model: 'Regular',
    });
    const [audit] = await tx.$queryRaw<{ notes: string; before: string; after: string }[]>`
      SELECT log_notes AS notes,
             log_original_record ->> 'sizeName' AS before,
             log_modified_record ->> 'sizeName' AS after
        FROM audit.audit_log
       WHERE log_table_name = 'stock_batch_detail' AND log_pk = ${fixed.sbdId}
       ORDER BY log_date DESC LIMIT 1`;
    expect(audit).toEqual({ notes: 'Label said L', before: `ZXL-${RUN}`, after: `ZL-${RUN}` });
  });

  it('a sale line carrying the batch reads the names; another item with the same text does not', async () => {
    const found = await batchDetailsFor(tx, fixture.companyId, [
      { itemId: fixture.itemId, batchNo: autoBatch.toLowerCase() },
      { itemId: fixture.pieceIuc, batchNo: autoBatch },
    ]);

    expect(found.get(batchDetailKey(fixture.itemId, autoBatch))).toMatchObject({
      sizeName: `ZL-${RUN}`,
      colourName: `ZMaroon-${RUN}`,
      model: 'Regular',
    });
    expect(found.size).toBe(1);
  });

  it('a size a batch uses cannot be deleted', async () => {
    const inUse = await refusal(sizes.softDelete(sizeL));
    expect(inUse).toMatchObject({ status: 409, body: { errors: [{ code: 'ITEM_SIZE_IN_USE' }] } });
  });

  it('size / colour / model on a typed batch is refused (422)', async () => {
    const typed = await refusal(
      vouchers.save(OPENING_RULES, payload([line(1, 'typed-9', { sizeId: sizeXl })])),
    );
    expect(typed).toMatchObject({
      status: 422,
      body: { errors: [{ field: 'lines.0', code: 'STOCK_BATCH_DETAIL_NEEDS_AUTO_BATCH' }] },
    });
  });

  // Notes 149 #3 — for a draft, cancel is the delete.
  it('cancelling a draft retires its rows; its /get still shows what was keyed', async () => {
    const draft = await vouchers.save(
      OPENING_RULES,
      payload([line(1, null, { sizeId: sizeL, model: 'Abandoned run' })]),
    );
    const batch = draft.lines[0].batchNo!;
    expect(batch).toMatch(/^ZTX26-\d{5}$/);

    await vouchers.cancel(
      OPENING_RULES,
      draft.header.svhId,
      ACC_YEAR,
      'abandoned before post',
      fixture.companyId,
      fixture.branchId,
      fixture.userId,
    );

    const rows = await tx.$queryRaw<{ sbd_is_deleted: boolean }[]>`
      SELECT sbd_is_deleted FROM stock.stock_batch_detail
       WHERE sbd_src_doc_id = ${draft.header.svhId}::uuid`;
    expect(rows).toEqual([{ sbd_is_deleted: true }]);
    // The scans read nothing off it any more...
    const found = await batchDetailsFor(tx, fixture.companyId, [
      { itemId: fixture.itemId, batchNo: batch },
    ]);
    expect(found.size).toBe(0);
    // ...while the cancelled document still reads its own line.
    const got = await vouchers.getById(
      OPENING_RULES,
      draft.header.svhId,
      ACC_YEAR,
      fixture.companyId,
      fixture.branchId,
    );
    expect(got.header.status).toBe('CANCELLED');
    expect(got.lines[0]).toMatchObject({
      batchNo: batch,
      sizeName: `ZL-${RUN}`,
      model: 'Abandoned run',
    });
  });

  it('the bill print query compiles against the schema with the new joins', async () => {
    let captured: { sql: string; params: readonly unknown[] } | undefined;
    const pg = {
      queryReadOnly: (sql: string, params: readonly unknown[]) => {
        captured = { sql, params };
        return Promise.resolve({ rows: [], fields: [] });
      },
    } as unknown as PgService;
    await new SaleBillItemsProvider(pg).resolve({
      context: {
        docId: '01000000-0000-7000-8000-000000000000',
        accYear: ACC_YEAR,
        companyId: fixture.companyId,
      },
      params: {},
      lang: 'en',
      rowLimit: 10,
    } as never);

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query(captured!.sql, captured!.params as unknown[]);
      expect(result.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['size_name', 'colour_name', 'model', 'batch_no']),
      );
    } finally {
      await client.end();
    }
  });
});
