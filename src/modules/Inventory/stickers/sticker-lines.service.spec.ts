import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrintTemplateAssignmentService } from '../../settings/print-template-assignment/print-template-assignment.service';
import { StickerLinesService, StickerScope } from './sticker-lines.service';

/**
 * THE line builder (plan S-P1 §4.5 / §4.6, §9.1 L2-L7) against a fake
 * database: every read is answered by the SQL it sends.
 */

const D = (value: number | string) => new Prisma.Decimal(value);
const COMPANY = 'c0000000-0000-7000-8000-000000000001';
const BRANCH = 'b0000000-0000-7000-8000-000000000001';

const ITEM_OIL = 'i0000000-0000-7000-8000-00000000000a';
const ITEM_RICE = 'i0000000-0000-7000-8000-00000000000b';
const ITEM_TEX = 'i0000000-0000-7000-8000-00000000000c';
const ITEM_NOBAR = 'i0000000-0000-7000-8000-00000000000d';
const UNIT = (item: string, name: string) => `${item}-${name}`;

const DESIGN_ITEM = 'd0000000-0000-7000-8000-000000000001'; // ITEM_LABEL, published, label sheet
const DESIGN_PACK = 'd0000000-0000-7000-8000-000000000002'; // PACK_LABEL
const DESIGN_SMALL = 'd0000000-0000-7000-8000-000000000003'; // ITEM_LABEL, NOBAR's own design
const DESIGN_DRAFT = 'd0000000-0000-7000-8000-000000000004'; // no published revision

const design = (id: string, ppo: string, over: Record<string, unknown> = {}) => ({
  ptl_id: id,
  ptl_name: `Design ${id.slice(-1)}`,
  ptl_company_id: null,
  ptl_is_active: true,
  ptl_is_deleted: false,
  ppo_code: ppo,
  ptv_id: `${id}-v`,
  ptv_rev_no: 1,
  ptv_status: 'PUBLISHED',
  ptv_is_deleted: false,
  ptv_label_width_mm: D(50),
  ptv_label_height_mm: D(25),
  ptv_label_across: 2,
  ptv_label_down: 1,
  ptv_paper_code: 'LABEL',
  ptv_body: JSON.stringify({ bands: [{ type: 'REPORT_HEADER', elements: [{ kind: 'BARCODE' }] }] }),
  ...over,
});

const DESIGNS = [
  design(DESIGN_ITEM, 'ITEM_LABEL'),
  design(DESIGN_PACK, 'PACK_LABEL'),
  design(DESIGN_SMALL, 'ITEM_LABEL', { ptv_label_width_mm: D(38) }),
  design(DESIGN_DRAFT, 'ITEM_LABEL', { ptv_id: null, ptv_status: null }),
];

const lot = (id: string, item: string, over: Record<string, unknown> = {}) => ({
  lot_id: id,
  item_id: item,
  company_id: COMPANY,
  batch_no: null,
  mrp: null,
  sale_price: null,
  mfg_date: null,
  expiry_date: null,
  first_inward_date: '2026-11-01',
  cost_rate: null,
  on_hand: D(10),
  ...over,
});

interface FakeDb {
  branchOk?: boolean;
  letters?: string | null;
  codes?: Array<{
    code: string;
    item_id: string;
    unit_id: string | null;
    lot_id: string | null;
    rank: number;
  }>;
  stocked?: ReturnType<typeof lot>[];
  named?: ReturnType<typeof lot>[];
  batchDetails?: Array<{
    item_id: string;
    batch_no: string;
    size: string | null;
    colour: string | null;
    model: string | null;
  }>;
  lastPrinted?: Array<{ item_id: string; unit_id: string; printed_on: Date; labels: number }>;
  /** This counter's newest job's price level (decision 31); absent = no job. */
  counterLevel?: number;
  prices?: Array<Record<string, unknown>>;
}

function fakePrisma(db: FakeDb): PrismaService {
  const items = [
    {
      item_id: ITEM_OIL,
      item_name_en: 'ZT Oil',
      item_name_ta: null,
      item_code: 'OIL1',
      default_barcode: null,
      sticker_id: null,
      brand_name: 'B',
      group_name: 'G',
    },
    {
      item_id: ITEM_RICE,
      item_name_en: 'ZT Rice',
      item_name_ta: 'அரிசி',
      item_code: 'RICE1',
      default_barcode: '200001',
      sticker_id: DESIGN_PACK,
      brand_name: null,
      group_name: 'G',
    },
    {
      item_id: ITEM_TEX,
      item_name_en: 'ZT Shirt',
      item_name_ta: null,
      item_code: 'TEX1',
      default_barcode: null,
      sticker_id: null,
      brand_name: null,
      group_name: null,
    },
    {
      item_id: ITEM_NOBAR,
      item_name_en: 'ZT No bar',
      item_name_ta: null,
      item_code: 'NB1',
      default_barcode: null,
      sticker_id: DESIGN_SMALL,
      brand_name: null,
      group_name: null,
    },
  ];
  const units = [
    {
      iuc_id: UNIT(ITEM_OIL, 'PCS'),
      iuc_item_id: ITEM_OIL,
      is_default: true,
      is_base: true,
      factor: D(1),
      unit_name: 'PCS',
      decimals: 0,
    },
    {
      iuc_id: UNIT(ITEM_RICE, 'PCS'),
      iuc_item_id: ITEM_RICE,
      is_default: true,
      is_base: true,
      factor: D(1),
      unit_name: 'PCS',
      decimals: 0,
    },
    {
      iuc_id: UNIT(ITEM_RICE, 'BOX'),
      iuc_item_id: ITEM_RICE,
      is_default: false,
      is_base: false,
      factor: D(10),
      unit_name: 'BOX',
      decimals: 0,
    },
    {
      iuc_id: UNIT(ITEM_TEX, 'PCS'),
      iuc_item_id: ITEM_TEX,
      is_default: true,
      is_base: true,
      factor: D(1),
      unit_name: 'PCS',
      decimals: 0,
    },
    {
      iuc_id: UNIT(ITEM_NOBAR, 'KG'),
      iuc_item_id: ITEM_NOBAR,
      is_default: true,
      is_base: true,
      factor: D(1),
      unit_name: 'KG',
      decimals: 3,
    },
  ];
  const eans = [
    { unit_id: UNIT(ITEM_RICE, 'PCS'), code: '8901234567890' },
    { unit_id: UNIT(ITEM_RICE, 'PCS'), code: '8900000000000' },
    { unit_id: UNIT(ITEM_RICE, 'BOX'), code: '4006381333931' },
    { unit_id: UNIT(ITEM_OIL, 'PCS'), code: 'X'.repeat(60) },
  ];
  const answer = (sql: string): unknown => {
    if (sql.includes('FROM public.branch_master')) return db.branchOk === false ? [] : [{ ok: 1 }];
    if (sql.includes('fn_app_settings_effective'))
      return db.letters === undefined ? [{ value: 'BLACKHORSE' }] : [{ value: db.letters }];
    if (sql.includes('::date::text AS d')) return [{ d: '2026-11-25' }];
    if (sql.includes('WITH q AS')) return db.codes ?? [];
    if (sql.includes('LEFT JOIN inventory.item_brand_master')) return items;
    if (sql.includes('FROM inventory.item_unit_conversion c')) return units;
    if (sql.includes('FROM inventory.item_ean_codes e')) return eans;
    if (sql.includes('FROM (SELECT b.sbl_lot_id')) return db.stocked ?? [];
    if (sql.includes('l.slt_id = ANY')) return db.named ?? [];
    if (sql.includes('SELECT b.sbl_item_id AS item_id'))
      return [{ item_id: ITEM_OIL, on_hand: D(12) }];
    if (sql.includes('stock.stock_batch_detail d')) return db.batchDetails ?? [];
    if (sql.includes('FROM fixed.price_levels'))
      return [
        { id: 1, short: 'WS' },
        { id: 2, short: 'RET' },
      ];
    if (sql.includes('lbj_price_level')) return db.counterLevel ? [{ level: db.counterLevel }] : [];
    if (sql.includes('FROM inventory.label_job_line l')) return db.lastPrinted ?? [];
    if (sql.includes('FROM public.print_template t')) return DESIGNS;
    if (sql.includes('trackMrp')) return [];
    throw new Error(`unexpected query: ${sql.slice(0, 120)}`);
  };
  return {
    $queryRaw: jest.fn((strings: TemplateStringsArray) =>
      Promise.resolve(answer(strings.join('?'))),
    ),
    $executeRaw: jest.fn(() => Promise.resolve(0)),
    itemPriceMaster: { findMany: jest.fn(() => Promise.resolve(db.prices ?? [])) },
    printPurpose: {
      findFirst: jest.fn(() => Promise.resolve({ ppoId: 'ppo-item', ppoName: 'Item label' })),
    },
  } as unknown as PrismaService;
}

const priceRow = (item: string, unit: string, over: Record<string, unknown> = {}) => ({
  ipmItemId: item,
  ipmUcUnitId: unit,
  ipmCompanyId: null,
  ipmBranchId: null,
  ipmKeyMrp: D(-1),
  ipmKeySp: D(-1),
  ipmEffectiveFrom: new Date('2026-01-01T00:00:00Z'),
  ipmEffectiveTo: new Date('9999-12-31T00:00:00Z'),
  ipmIsDeleted: false,
  ipmSalesPriceA: D(90),
  ipmSalesPriceB: D('96.20'),
  ipmSalesPriceC: null,
  ipmSalesPriceD: null,
  ipmMaxPrice: D(110),
  ipmCostPrice: D(80),
  ...over,
});

function service(db: FakeDb = {}): StickerLinesService {
  const context = {
    getUserId: () => 'u1',
    getDeviceId: () => 'dev-1',
  } as unknown as RequestContextService;
  const assignments = {
    resolve: jest.fn(() => Promise.reject(new NotFoundException())),
  } as unknown as PrintTemplateAssignmentService;
  return new StickerLinesService(fakePrisma(db), context, assignments);
}

const scope = (over: Partial<StickerScope> = {}): StickerScope => ({
  companyId: COMPANY,
  branchId: BRANCH,
  deviceId: 'dev-1',
  purpose: { ppoId: 'ppo-item', ppoCode: 'ITEM_LABEL', ppoName: 'Item label' },
  priceLevel: 2,
  assignment: {
    purposeId: 'ppo-item',
    purposeCode: 'ITEM_LABEL',
    purposeName: 'Item label',
    ptaId: 'pta-1',
    scope: 'BRANCH',
    templateId: DESIGN_ITEM,
    templateName: 'Design 1',
    printerName: 'ZT-PRN',
    printerSource: 'NAME',
    lastPriceLevel: 2,
  },
  ...over,
});

describe('StickerLinesService.buildLines — the design per line (§4.5, L2)', () => {
  it('ITEM: the item’s own published label design of the list’s purpose', async () => {
    const [line] = await service().buildLines(scope(), [{ key: 'a', itemId: ITEM_NOBAR }]);
    expect(line.line).toMatchObject({
      designSource: 'ITEM',
      templateId: DESIGN_SMALL,
      labelWidthMm: 38,
    });
  });
  it('PURPOSE: an item design of another purpose is passed over for the assignment', async () => {
    const [line] = await service().buildLines(scope(), [{ key: 'a', itemId: ITEM_RICE }]);
    expect(line.line).toMatchObject({
      designSource: 'PURPOSE',
      templateId: DESIGN_ITEM,
      problem: null,
    });
  });
  it('NONE when nothing is assigned', async () => {
    const none = scope();
    none.assignment = { ...none.assignment, templateId: null, ptaId: null };
    const [line] = await service().buildLines(none, [{ key: 'a', itemId: ITEM_OIL }]);
    expect(line.line).toMatchObject({ designSource: 'NONE', templateId: null });
  });
  it('JOB: F7’s design wins; a draft-only one is a problem STICKER_DESIGN_NOT_PUBLISHED', async () => {
    const [ok, draft, pack] = await service().buildLines(scope(), [
      { key: 'a', itemId: ITEM_NOBAR, templateId: DESIGN_ITEM },
      { key: 'b', itemId: ITEM_OIL, templateId: DESIGN_DRAFT },
      { key: 'c', itemId: ITEM_OIL, templateId: DESIGN_PACK },
    ]);
    expect(ok.line).toMatchObject({ designSource: 'JOB', templateId: DESIGN_ITEM });
    expect(draft.line.problem?.code).toBe('STICKER_DESIGN_NOT_PUBLISHED');
    expect(pack.line.problem?.code).toBe('STICKER_DESIGN_NOT_LABEL');
    expect(pack.refusal?.extra.rule).toBe('PURPOSE');
  });
});

describe('StickerLinesService.buildLines — barcode, unit and code (decision 36, L3 / L4)', () => {
  it('UNIT: the Def unit’s EAN, default first', async () => {
    const [line] = await service().buildLines(scope(), [{ key: 'a', itemId: ITEM_RICE }]);
    expect(line.line).toMatchObject({
      barcode: '8901234567890',
      barcodeSource: 'UNIT',
      unitName: 'PCS',
      isDefaultUnit: true,
    });
  });
  it('ITEM: item_default_barcode only on the Def unit; none on another unit with no EAN', async () => {
    const [none] = await service().buildLines(scope(), [{ key: 'a', itemId: ITEM_NOBAR }]);
    expect(none.line).toMatchObject({ barcode: null, barcodeSource: null, designHasBarcode: true });
  });
  it('LOT: a textile lot’s batch is the barcode', async () => {
    const [line] = await service({
      stocked: [lot('lot-t', ITEM_TEX, { batch_no: 'CBE26-00041', mrp: D(799) })],
      batchDetails: [
        { item_id: ITEM_TEX, batch_no: 'CBE26-00041', size: 'M', colour: 'Blue', model: null },
      ],
    }).buildLines(scope(), [{ key: 'a', itemId: ITEM_TEX }]);
    expect(line.line).toMatchObject({
      barcode: 'CBE26-00041',
      barcodeSource: 'LOT',
      lotId: 'lot-t',
      batchNo: 'CBE26-00041',
    });
    expect(line.facts).toMatchObject({ size: 'M', colour: 'Blue' });
  });
  it('a scanned BOX EAN gives the BOX unit; an unknown code is STICKER_CODE_NOT_FOUND', async () => {
    const lines = await service({
      codes: [
        {
          code: '4006381333931',
          item_id: ITEM_RICE,
          unit_id: UNIT(ITEM_RICE, 'BOX'),
          lot_id: null,
          rank: 1,
        },
      ],
    }).buildLines(scope(), [
      { key: 'a', code: '4006381333931' },
      { key: 'b', code: 'NOPE' },
    ]);
    expect(lines[0].line).toMatchObject({
      key: 'a',
      itemId: ITEM_RICE,
      unitName: 'BOX',
      barcode: '4006381333931',
      problem: null,
    });
    expect(lines[1].line).toMatchObject({
      key: 'b',
      itemId: null,
      problem: { code: 'STICKER_CODE_NOT_FOUND' },
    });
  });
  it('a unit of another item is STICKER_UNIT_NOT_OF_ITEM; a lot of another item STICKER_LOT_NOT_OF_ITEM', async () => {
    const [unit, foreignLot] = await service({ named: [lot('lot-x', ITEM_RICE)] }).buildLines(
      scope(),
      [
        { key: 'a', itemId: ITEM_OIL, unitId: UNIT(ITEM_RICE, 'BOX') },
        { key: 'b', itemId: ITEM_OIL, lotId: 'lot-x' },
      ],
    );
    expect(unit.line.problem?.code).toBe('STICKER_UNIT_NOT_OF_ITEM');
    expect(foreignLot.line.problem?.code).toBe('STICKER_LOT_NOT_OF_ITEM');
  });
  it('a barcode longer than the job line keeps is a problem, never a truncation', async () => {
    const [line] = await service().buildLines(scope(), [{ key: 'a', itemId: ITEM_OIL }]);
    expect(line.line.problem?.code).toBe('STICKER_BARCODE_TOO_LONG');
  });
  it('labels outside 1-9,999 is STICKER_LABELS_INVALID', async () => {
    const [line] = await service().buildLines(scope(), [
      { key: 'a', itemId: ITEM_RICE, labels: 0 },
    ]);
    expect(line.line.problem?.code).toBe('STICKER_LABELS_INVALID');
  });
});

describe('StickerLinesService.buildLines — lots, prices, codes, last printed (SM7, S9, L5-L8)', () => {
  it('two stocked MRPs → lotRequired, no lot; one MRP → the newest picked', async () => {
    const two = await service({
      stocked: [lot('new', ITEM_RICE, { mrp: D(165) }), lot('old', ITEM_RICE, { mrp: D(160) })],
    }).buildLines(scope(), [{ key: 'a', itemId: ITEM_RICE }]);
    expect(two[0].line).toMatchObject({ lotRequired: true, lotId: null, lotCount: 2 });
    const one = await service({
      stocked: [
        lot('new', ITEM_RICE, { mrp: D(165) }),
        lot('old', ITEM_RICE, { mrp: D('165.00') }),
      ],
    }).buildLines(scope(), [{ key: 'a', itemId: ITEM_RICE }]);
    expect(one[0].line).toMatchObject({ lotRequired: false, lotId: 'new' });
  });

  it('Our price = column B at level 2; MRP from the lot; cost code from the lot cost × the unit factor', async () => {
    const [line] = await service({
      stocked: [
        lot('l1', ITEM_RICE, { mrp: D(120), cost_rate: D('10.4'), expiry_date: '2027-04-30' }),
      ],
      prices: [priceRow(ITEM_RICE, UNIT(ITEM_RICE, 'BOX'))],
    }).buildLines(scope(), [{ key: 'a', itemId: ITEM_RICE, unitId: UNIT(ITEM_RICE, 'BOX') }]);
    expect(line.line).toMatchObject({
      price: 96.2,
      mrp: 120,
      priceLevel: 2,
      costCode: 'LBK', // 10.4 × 10 = 104
      priceCode: 'EO', // 96.20 → 96
      expiryDate: '2027-04-30',
    });
    expect(line.facts.priceLevelShort).toBe('RET');
  });

  it('no lot: MRP is the price line’s ipm_max_price and the cost its ipm_cost_price; no letters → no codes', async () => {
    const [line] = await service({
      letters: null,
      prices: [priceRow(ITEM_RICE, UNIT(ITEM_RICE, 'PCS'))],
    }).buildLines(scope({ priceLevel: 1 }), [{ key: 'a', itemId: ITEM_RICE }]);
    expect(line.line).toMatchObject({ price: 90, mrp: 110, costCode: null, priceCode: null });
  });

  it('no price line → MRP and price blank', async () => {
    const [line] = await service().buildLines(scope(), [{ key: 'a', itemId: ITEM_RICE }]);
    expect(line.line).toMatchObject({ mrp: null, price: null });
  });

  it('Last printed: date + labels of the newest job line of this item + unit here', async () => {
    const [line] = await service({
      lastPrinted: [
        {
          item_id: ITEM_RICE,
          unit_id: UNIT(ITEM_RICE, 'PCS'),
          printed_on: new Date('2026-11-25T05:00:00Z'),
          labels: 50,
        },
      ],
    }).buildLines(scope(), [{ key: 'a', itemId: ITEM_RICE }]);
    expect(line.line).toMatchObject({
      lastPrintedOn: '25/11/2026 10:30 AM',
      lastPrintedLabels: 50,
    });
  });

  it('stock here in the unit, and a decimal unit is flagged for "stock on hand"', async () => {
    const [oil, nobar] = await service().buildLines(scope(), [
      { key: 'a', itemId: ITEM_OIL },
      { key: 'b', itemId: ITEM_NOBAR },
    ]);
    expect(oil.line.stockQty).toBe(12);
    expect(nobar.facts.unitHasDecimals).toBe(true);
  });
});

describe('StickerLinesService — gates', () => {
  it('a branch of another company is STICKER_BRANCH_NOT_IN_COMPANY (422)', async () => {
    await expect(
      service({ branchOk: false }).assertBranchInCompany(COMPANY, BRANCH),
    ).rejects.toMatchObject({
      status: 422,
      response: { errors: [expect.objectContaining({ code: 'STICKER_BRANCH_NOT_IN_COMPANY' })] },
    });
  });
  it('a purpose that is not a label purpose is STICKER_PURPOSE_INVALID', async () => {
    await expect(service().loadPurpose(COMPANY, 'SALE_INVOICE')).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'STICKER_PURPOSE_INVALID' })] },
    });
  });
  it('lastPriceLevel: this counter’s newest job’s level, else 2 = RET (SM6, decision 31)', async () => {
    const purpose = { ppoId: 'ppo-item', ppoCode: 'ITEM_LABEL' as const, ppoName: 'Item label' };
    expect(
      (await service({ counterLevel: 1 }).assignmentFor(purpose, COMPANY, BRANCH, 'dev-1'))
        .lastPriceLevel,
    ).toBe(1);
    expect((await service().assignmentFor(purpose, COMPANY, BRANCH, 'dev-1')).lastPriceLevel).toBe(
      2,
    );
    expect(
      (await service({ counterLevel: 1 }).assignmentFor(purpose, COMPANY, BRANCH, null))
        .lastPriceLevel,
    ).toBe(2);
  });
  it('nothing assigned → an assignment of nulls, not an error', async () => {
    const answer = await service().assignmentFor(
      { ppoId: 'ppo-item', ppoCode: 'ITEM_LABEL', ppoName: 'Item label' },
      COMPANY,
      BRANCH,
      null,
    );
    expect(answer).toMatchObject({
      purposeCode: 'ITEM_LABEL',
      ptaId: null,
      printerName: null,
      printerSource: null,
    });
  });
});
