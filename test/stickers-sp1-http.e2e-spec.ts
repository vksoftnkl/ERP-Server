import { INestApplication } from '@nestjs/common';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as request from 'supertest';

import { as, bootIdentityApp, IDENTITIES, PRATHAP, TESTER } from './helpers/identity-app';
import { BRANCH, COMPANY, prisma } from './helpers/payment-e2e';

/**
 * Sticker printing S-P1 (plan §7, §9.1) over HTTP, against the dev database,
 * as the VKPOS login at the VKPOS1 desktop counter (D8).
 *
 * Part A needs no menu-32 right: providers + fields, the label-sheet save
 * (worked-out page) and its refusals, the label path through /print-render/
 * preview, Test print (Print on 248) and its refusal, the item card's Sticker
 * design, the cost-code key rule, and the sticker refusals: prathap (no row on
 * menu 32) for View, tester (View only on 32, ticked by hand 2026-11-25) for
 * Print; both premises are read from user_menus first, so a later change to
 * those rights fails by name. Part B runs only when VKPOS holds View + Print on menu 32
 * (the user ticks them; this suite never writes user_menus): the lines
 * routes, a few jobs (print → PRINTED, print → FAILED → resend → PRINTED,
 * reprint) and every job refusal.
 *
 * ZT data it makes (kept, reused by the next run): designs ZT-STK-P12-ITEM
 * (ITEM_LABEL 50 × 25, 2 across) and ZT-STK-P12-PACK (PACK_LABEL), items
 * ZT-STK-P12-OIL (EAN, price line, Sticker design = ZT-STK-P12-ITEM) and
 * ZT-STK-P12-NOBAR (no barcode). Jobs are append-only and stay; every job id
 * is printed. STK_KEYS_OUT=<dir> writes each answer there for the hand-over.
 */

jest.setTimeout(300_000);

const VKPOS = '019e441b-6e48-7918-b246-b857ffb35db1';
const D8 = '019f27d5-9175-7064-8360-6fc07dedab17';
const PCS = '019d3d70-3fd9-795f-8d52-b5ad179c81e5';
const GROUP = '019c6f6c-be87-7a11-8905-36092c46fd06';
const TAX5 = '01a090cd-4a59-7160-9ed7-0fdb34b747a2';
const OIL_EAN = ean13('200012250001');

const USERS = {
  ...IDENTITIES,
  vkpos: { sub: VKPOS, user_name: 'VKPOS', user_type: 'SUPER ADMIN' },
};
const V = as('vkpos', D8);
const T = as('tester', D8);
const P = as('prathap', D8);

/** user_menus rights of one user on menu 32 (absent row = no right). */
async function menu32Rights(userId: string): Promise<{ view: boolean; print: boolean }> {
  const row = await prisma.$queryRaw<Array<{ view: boolean; print: boolean }>>`
    SELECT um_can_view AS view, um_can_print AS print
      FROM public.user_menus
     WHERE um_user_id = ${userId}::uuid AND um_menu_id = 32 AND NOT um_is_deleted
     LIMIT 1`;
  return row[0] ?? { view: false, print: false };
}

let app: INestApplication;
const made: Record<string, string> = {};
const jobs: string[] = [];

function ean13(twelve: string): string {
  const sum = twelve
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return twelve + ((10 - (sum % 10)) % 10);
}

function keep(name: string, value: unknown): void {
  const dir = process.env.STK_KEYS_OUT;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}

const http = () => request(app.getHttpServer());
const post = (path: string, body: unknown, auth = V) =>
  http()
    .post(`/api/v1${path}`)
    .set('Authorization', auth)
    .send(body as object);
const get = (path: string, query: Record<string, unknown>, auth = V) =>
  http().get(`/api/v1${path}`).query(query).set('Authorization', auth);

const codeOf = (res: request.Response) =>
  `${res.status}:${((res.body as { errors?: Array<{ code?: string }> }).errors ?? []).map((e) => e.code).join(',')}`;
const pdfHeaders = (res: request.Response) =>
  Object.fromEntries(
    Object.entries(res.headers).filter(([key]) =>
      /^(content-type|content-length|content-disposition|x-sticker-|x-print-)/.test(key),
    ),
  );

const refusals: Array<{
  route: string;
  case: string;
  status: number;
  code: string;
  field?: string;
  rule?: string;
  line?: number;
  user?: unknown;
}> = [];
function refused(
  route: string,
  label: string,
  res: request.Response,
  status: number,
  code: string,
): void {
  const first = ((res.body as { errors?: Array<Record<string, unknown>> }).errors ?? [])[0] ?? {};
  refusals.push({
    route,
    case: label,
    status: res.status,
    code: String(first.code),
    ...(first.field ? { field: String(first.field) } : {}),
    ...(first.rule ? { rule: String(first.rule) } : {}),
    ...(first.line ? { line: Number(first.line) } : {}),
    ...(first.user ? { user: first.user } : {}),
  });
  expect(codeOf(res)).toBe(`${status}:${code}`);
}

async function purposeId(code: string): Promise<string> {
  const row = await prisma.printPurpose.findFirst({
    where: { ppoCode: code, ppoCompanyId: null, ppoIsDeleted: false },
  });
  if (!row) throw new Error(`no purpose ${code}`);
  return row.ppoId;
}

const itemBody = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../src/modules/settings/print-render/__fixtures__/sticker-sample-item-50x25.json',
    ),
    'utf8',
  ),
) as Record<string, unknown>;
const labelDataset = {
  ptdRole: 'MASTER',
  ptdDatasetNo: 0,
  ptdName: 'label',
  ptdSourceKind: 'PROVIDER',
  ptdProviderCode: 'stickers.label',
  ptdRowLimit: 1,
};
const itemSheet = {
  ptvEngine: 'JSON_BANDS',
  ptvPaperCode: 'LABEL',
  ptvMarginLeftMm: 1,
  ptvLabelWidthMm: 50,
  ptvLabelHeightMm: 25,
  ptvLabelAcross: 2,
  ptvLabelDown: 1,
  ptvLabelGapXMm: 2,
  ptvLabelGapYMm: 0,
  ptvLabelRotate: 0,
  ptvLabelDpi: 203,
};

async function ensureDesign(
  code: string,
  purpose: string,
  sheet: Record<string, unknown>,
): Promise<{ ptlId: string; ptvId: string; answer?: unknown }> {
  const existing = await prisma.printTemplate.findFirst({
    where: { ptlCode: code, ptlCompanyId: COMPANY, ptlIsDeleted: false },
  });
  if (existing?.ptlPublishedRevId)
    return { ptlId: existing.ptlId, ptvId: existing.ptlPublishedRevId };
  const res = await post('/print-templates/create', {
    ptlCompanyId: COMPANY,
    ptlPurposeId: await purposeId(purpose),
    ptlCode: code,
    ptlName: `${code} (sticker S-P1 proof)`,
    versions: [
      {
        ptvStatus: 'PUBLISHED',
        ptvBody: JSON.stringify(itemBody),
        ...sheet,
        datasets: [labelDataset],
      },
    ],
  });
  expect(codeOf(res)).toBe('201:');
  const data = (res.body as { data: { ptlId: string; ptlPublishedRevId: string } }).data;
  return { ptlId: data.ptlId, ptvId: data.ptlPublishedRevId, answer: res.body };
}

async function ensureItem(
  name: string,
  ean: string | null,
  stickerDesign: string | null,
): Promise<{ itemId: string; unitId: string }> {
  const existing = await prisma.itemMaster.findFirst({
    where: { itemNameEn: name, itemIsDeleted: false },
  });
  if (!existing) {
    const res = await post('/items/create', {
      item_name_en: name,
      item_company_id: COMPANY,
      item_group_id: GROUP,
      item_base_unit_id: PCS,
      item_default_tax_id: TAX5,
      item_barcode_sticker: true,
      item_is_active: true,
      unit_conversions: [
        {
          iuc_unit_id: PCS,
          iuc_base_unit_id: PCS,
          iuc_to_base_factor: 1,
          iuc_unit_slno: 1,
          iuc_unit_factor: 1,
          iuc_is_default_unit: true,
          iuc_is_base_unit: true,
        },
      ],
      prices: [
        {
          ipm_company_id: COMPANY,
          ipm_branch_id: null,
          ipm_uc_unit_id: PCS,
          ipm_cost_price: 104,
          ipm_cost_wot: 99.05,
          ipm_sales_price_a: 99,
          ipm_sales_price_b: 96.2,
          ipm_sales_price_c: 0,
          ipm_sales_price_d: 0,
          ipm_price_a_wot: 94.29,
          ipm_price_b_wot: 91.62,
          ipm_price_c_wot: 0,
          ipm_price_d_wot: 0,
          ipm_max_price: 110,
          ipm_min_price: 0,
          ipm_profit_type: 'By User',
        },
      ],
      ...(ean
        ? {
            ean_codes: [
              {
                ean_sl_no: 1,
                ean_unit_id: PCS,
                ean_code: ean,
                ean_is_default: true,
                ean_is_active: true,
              },
            ],
          }
        : {}),
    });
    expect(codeOf(res)).toBe('201:');
  }
  const item = await prisma.itemMaster.findFirstOrThrow({
    where: { itemNameEn: name, itemIsDeleted: false },
  });
  if (stickerDesign !== undefined && item.itemBarcodeStickerId !== stickerDesign && stickerDesign) {
    const res = await post('/items/create', {
      item_id: item.itemId,
      item_name_en: name,
      item_group_id: GROUP,
      item_barcode_sticker_id: stickerDesign,
    });
    expect(codeOf(res)).toBe('201:');
  }
  const unit = await prisma.itemUnitConversion.findFirstOrThrow({
    where: { iucItemId: item.itemId, iucIsDeleted: false, iucIsDefaultUnit: true },
  });
  return { itemId: item.itemId, unitId: unit.iucId };
}

beforeAll(async () => {
  app = await bootIdentityApp(() => ({ who: 'vkpos', device: D8 }), USERS);
});

afterAll(async () => {
  keep('refusals', refusals);
  // eslint-disable-next-line no-console
  console.log(`ZT data: ${JSON.stringify(made)}\nJobs made this run: ${JSON.stringify(jobs)}`);
  await app?.close();
  await prisma.$disconnect();
});

describe('A — no menu-32 right needed', () => {
  it('Swagger lists the twelve /stickers routes (S-P2 added docs/state and lines/from-doc)', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const paths = Object.keys(document.paths).filter((path) => path.includes('/stickers/'));
    expect(paths.sort()).toEqual(
      [
        'docs/state',
        'jobs/get',
        'jobs/print',
        'jobs/reprint',
        'jobs/resend',
        'jobs/status',
        'lines/from-doc',
        'lines/from-items',
        'lines/resolve',
        'lots',
        'preview',
        'test-print',
      ].map((route) => `/api/v1/stickers/${route}`),
    );
    keep('swagger-stickers-paths', paths.sort());
  });

  it('GET /print-render/providers publishes the stickers.label fields', async () => {
    const res = await get('/print-render/providers', {});
    expect(res.status).toBe(200);
    const provider = (res.body as { data: Array<{ code: string; fields?: unknown[] }> }).data.find(
      (p) => p.code === 'stickers.label',
    );
    // 36 in S-P1; S-P2 added doc_date (plan S-P2 §7.5)
    expect(provider?.fields?.length).toBe(37);
    keep('providers-stickers-label', provider);
  });

  it('the label-sheet save stores the worked-out page; GET returns the 8 keys (T1)', async () => {
    const item = await ensureDesign('ZT-STK-P12-ITEM', 'ITEM_LABEL', itemSheet);
    const pack = await ensureDesign('ZT-STK-P12-PACK', 'PACK_LABEL', {
      ...itemSheet,
      ptvLabelWidthMm: 75,
      ptvLabelHeightMm: 50,
      ptvLabelAcross: 1,
      ptvLabelGapXMm: 0,
    });
    made.designItem = item.ptlId;
    made.designItemVersion = item.ptvId;
    made.designPack = pack.ptlId;
    if (item.answer) keep('print-templates-create-label', item.answer);
    const res = await get('/print-templates/get', { ptlId: item.ptlId });
    expect(res.status).toBe(200);
    const version = (res.body as { data: { versions: Array<Record<string, unknown>> } }).data
      .versions[0];
    expect(version).toMatchObject({
      ptvWidthMm: 104,
      ptvHeightMm: 25,
      ptvMarginRightMm: 1,
      ptvLabelWidthMm: 50,
      ptvLabelAcross: 2,
      ptvLabelDpi: 203,
    });
    keep('print-templates-get-label-version', version);
  });

  it('label-sheet refusals (T2) — nothing is saved', async () => {
    const itemPurpose = await purposeId('ITEM_LABEL');
    const base = {
      ptlCompanyId: COMPANY,
      ptlPurposeId: itemPurpose,
      ptlCode: 'ZT-STK-P12-REFUSED',
      ptlName: 'ZT refused',
    };
    const noSheet = await post('/print-templates/create', {
      ...base,
      versions: [
        { ptvBody: JSON.stringify(itemBody), ptvPaperCode: 'LABEL', datasets: [labelDataset] },
      ],
    });
    refused(
      '/print-templates/create',
      'label purpose with no sheet',
      noSheet,
      422,
      'PRINT_TEMPLATE_LABEL_SHEET_REQUIRED',
    );
    const across0 = await post('/print-templates/create', {
      ...base,
      versions: [
        {
          ptvBody: JSON.stringify(itemBody),
          ...itemSheet,
          ptvLabelAcross: 0,
          datasets: [labelDataset],
        },
      ],
    });
    refused(
      '/print-templates/create',
      'across 0',
      across0,
      422,
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID',
    );
    const twoBands = await post('/print-templates/create', {
      ...base,
      versions: [
        {
          ptvStatus: 'PUBLISHED',
          ptvBody: JSON.stringify({
            bands: [...(itemBody.bands as unknown[]), { type: 'PAGE_FOOTER', heightMm: 2 }],
          }),
          ...itemSheet,
          datasets: [labelDataset],
        },
      ],
    });
    refused(
      '/print-templates/create',
      'publish with two bands',
      twoBands,
      422,
      'PRINT_TEMPLATE_LABEL_BODY_INVALID',
    );
    const onInvoice = await post('/print-templates/create', {
      ...base,
      ptlPurposeId: await purposeId('SALE_INVOICE'),
      versions: [{ ptvBody: JSON.stringify(itemBody), ...itemSheet }],
    });
    refused(
      '/print-templates/create',
      'sheet on a Tax Invoice',
      onInvoice,
      422,
      'PRINT_TEMPLATE_LABEL_SHEET_NOT_LABEL',
    );
  });

  it('/print-render/preview of a label design renders through the label path (T3)', async () => {
    const res = await post('/print-render/preview', { versionId: made.designItemVersion });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['x-print-pages']).toBe('3');
    keep('print-render-preview-label-headers', pdfHeaders(res));
  });

  it('Test print: VKPOS (Print on 248) gets one label; tester → 403 PRINT_ASSIGN_RIGHT_PRINT (J11)', async () => {
    const body = {
      companyId: COMPANY,
      branchId: BRANCH,
      templateId: made.designItem,
      printerName: 'ZT-STK-PRN',
      printerDpi: 203,
      counterName: 'D8',
    };
    const res = await post('/stickers/test-print', body);
    expect(res.status).toBe(200);
    expect(res.headers['x-print-pages']).toBe('1');
    keep('test-print-headers', pdfHeaders(res));
    refused(
      '/stickers/test-print',
      'no Print on 248 (tester)',
      await post('/stickers/test-print', body, T),
      403,
      'PRINT_ASSIGN_RIGHT_PRINT',
    );
  });

  it('the item card: an invoice design is refused; the label design saves and GET names it (I1 / I2)', async () => {
    const oil = await ensureItem('ZT-STK-P12-OIL', OIL_EAN, null);
    made.itemOil = oil.itemId;
    made.itemOilUnit = oil.unitId;
    const invoice = await prisma.printTemplate.findFirstOrThrow({
      where: { ptlIsDeleted: false, purpose: { ppoCode: 'SALE_INVOICE' } },
    });
    const bad = await post('/items/create', {
      item_id: oil.itemId,
      item_name_en: 'ZT-STK-P12-OIL',
      item_group_id: GROUP,
      item_barcode_sticker_id: invoice.ptlId,
    });
    refused(
      '/items/create',
      'Sticker design = a Tax Invoice design',
      bad,
      422,
      'ITEM_STICKER_DESIGN_INVALID',
    );
    await ensureItem('ZT-STK-P12-OIL', OIL_EAN, made.designItem);
    const res = await get('/items/get', { item_id: oil.itemId });
    expect(res.status).toBe(200);
    const item = (res.body as { data: { item: Record<string, unknown> } }).data.item;
    expect(item).toMatchObject({
      item_barcode_sticker_id: made.designItem,
      item_barcode_sticker_name: 'ZT-STK-P12-ITEM (sticker S-P1 proof)',
    });
    keep('items-get-sticker-keys', {
      item_barcode_sticker: item.item_barcode_sticker,
      item_barcode_sticker_id: item.item_barcode_sticker_id,
      item_barcode_sticker_name: item.item_barcode_sticker_name,
    });
    const nobar = await ensureItem('ZT-STK-P12-NOBAR', null, null);
    made.itemNobar = nobar.itemId;
    made.itemNobarUnit = nobar.unitId;
  });

  it('the cost-code letters: a repeated letter is 422 APP_SETTING_COST_CODE_INVALID (S1, nothing saved)', async () => {
    const res = await post('/app-setting-values/create', {
      data: [
        {
          asvSettingKey: 'inventory.label_cost_code',
          asvScope: 'COMPANY',
          asvCompanyId: COMPANY,
          asvValue: 'BLACKHORSB',
        },
      ],
    });
    refused('/app-setting-values/create', 'BLACKHORSB', res, 422, 'APP_SETTING_COST_CODE_INVALID');
  });

  it('no View on menu 32 (prathap): reads → STICKER_RIGHT_VIEW; View only (tester): job writes → STICKER_RIGHT_PRINT (L9 / J4)', async () => {
    // Premises first: these are real logins whose rights the user may tick.
    expect({ who: 'prathap', menu32View: (await menu32Rights(PRATHAP)).view }).toEqual({
      who: 'prathap',
      menu32View: false,
    });
    expect({ who: 'tester', menu32Print: (await menu32Rights(TESTER)).print }).toEqual({
      who: 'tester',
      menu32Print: false,
    });
    refused(
      '/stickers/lines/from-items',
      'no View (prathap)',
      await get(
        '/stickers/lines/from-items',
        { companyId: COMPANY, branchId: BRANCH, purposeCode: 'ITEM_LABEL', priceLevel: 2 },
        P,
      ),
      403,
      'STICKER_RIGHT_VIEW',
    );
    refused(
      '/stickers/jobs/print',
      'no Print (tester)',
      await post(
        '/stickers/jobs/print',
        {
          companyId: COMPANY,
          branchId: BRANCH,
          purposeCode: 'ITEM_LABEL',
          priceLevel: 2,
          lines: [],
        },
        T,
      ),
      403,
      'STICKER_RIGHT_PRINT',
    );
  });
});

describe('B — VKPOS with View + Print on menu 32', () => {
  let rightsOk = false;
  beforeAll(async () => {
    const row = await prisma.userMenus.findFirst({
      where: { umUserId: VKPOS, umMenuId: 32, umIsDeleted: false },
    });
    rightsOk = !!(row?.umCanView && row?.umCanPrint);
    if (!rightsOk) {
      // eslint-disable-next-line no-console
      console.log('PART B SKIPPED: VKPOS has no View + Print on menu 32 yet.');
    }
  });
  const scope = { companyId: COMPANY, branchId: BRANCH };
  const jobBody = (over: Record<string, unknown> = {}) => ({
    ...scope,
    purposeCode: 'ITEM_LABEL',
    templateId: made.designItem,
    printerName: 'ZT-STK-PRN',
    printerDpi: 203,
    priceLevel: 2,
    lines: [{ itemId: made.itemOil, unitId: made.itemOilUnit, labels: 3 }],
    ...over,
  });

  it('lines: from-items, resolve (with problems), lots, preview', async () => {
    if (!rightsOk) return;
    const items = await get('/stickers/lines/from-items', {
      ...scope,
      purposeCode: 'ITEM_LABEL',
      priceLevel: 2,
      name: 'ZT-STK-P12',
      stickerOnly: true,
      labelsMode: 'ONE',
    });
    expect(items.status).toBe(200);
    expect(
      (items.body as { data: { assignment: { lastPriceLevel: number } } }).data.assignment
        .lastPriceLevel,
    ).toBeGreaterThanOrEqual(1);
    keep('lines-from-items', items.body);
    const mrpItem = await prisma.itemMaster.findFirst({
      where: { itemNameEn: 'ZT-OS-MRP', itemIsDeleted: false },
    });
    const resolve = await post('/stickers/lines/resolve', {
      ...scope,
      purposeCode: 'ITEM_LABEL',
      priceLevel: 2,
      lines: [
        { key: 'r1', code: OIL_EAN, labels: 2 },
        { key: 'r2', code: 'ZT-NO-SUCH-CODE' },
        { key: 'r3', itemId: made.itemOil, templateId: made.designPack },
        { key: 'r4', itemId: made.itemNobar },
        ...(mrpItem ? [{ key: 'r5', itemId: mrpItem.itemId }] : []),
      ],
    });
    expect(resolve.status).toBe(200);
    keep('lines-resolve', resolve.body);
    if (mrpItem) {
      const unit = await prisma.itemUnitConversion.findFirstOrThrow({
        where: { iucItemId: mrpItem.itemId, iucIsDeleted: false, iucIsDefaultUnit: true },
      });
      const lots = await get('/stickers/lots', {
        ...scope,
        itemId: mrpItem.itemId,
        unitId: unit.iucId,
      });
      expect(lots.status).toBe(200);
      keep('lots', lots.body);
      made.itemMrp = mrpItem.itemId;
      made.itemMrpUnit = unit.iucId;
    }
    const preview = await post('/stickers/preview', {
      ...scope,
      templateId: made.designItem,
      priceLevel: 2,
      line: { itemId: made.itemOil, unitId: made.itemOilUnit },
      printerDpi: 203,
    });
    expect(preview.status).toBe(200);
    keep('preview-headers', pdfHeaders(preview));
    // SF3: no warning → X-Print-Warnings 0 and no X-Print-Warning-Texts.
    expect(preview.headers['x-print-warnings']).toBe('0');
    expect(preview.headers['x-print-warning-texts']).toBeUndefined();
    // At 150 dpi the EAN at 3 dots (285 dots ≈ 48 mm) is wider than its 36 mm box: one warning,
    // its text in X-Print-Warning-Texts (standard base64 of the UTF-8 JSON array).
    const coarse = await post('/stickers/preview', {
      ...scope,
      templateId: made.designItem,
      priceLevel: 2,
      line: { itemId: made.itemOil, unitId: made.itemOilUnit },
      printerDpi: 150,
    });
    expect(coarse.status).toBe(200);
    const texts = JSON.parse(
      Buffer.from(String(coarse.headers['x-print-warning-texts']), 'base64').toString('utf8'),
    ) as string[];
    expect(texts).toEqual(['Barcode wider than its box at 3 dots: use 2 dots or a wider box']);
    expect(coarse.headers['x-print-warnings']).toBe(String(texts.length));
    keep('preview-150dpi-headers', { headers: pdfHeaders(coarse), decoded: texts });
  });

  it('jobs: print (inspect) → PRINTED; print (PDF) → FAILED → resend → PRINTED; reprint; get', async () => {
    if (!rightsOk) return;
    const first = await post('/stickers/jobs/print', jobBody({ inspect: true }));
    expect(first.status).toBe(200);
    keep('jobs-print-inspect', { headers: pdfHeaders(first), body: first.body });
    const j1 = (
      first.body as { data: { jobId: string; accYear: string; lines: Array<{ lineId: string }> } }
    ).data;
    jobs.push(`${j1.jobId} (print, inspect)`);
    const printed = await post('/stickers/jobs/status', {
      ...scope,
      accYear: j1.accYear,
      jobId: j1.jobId,
      status: 'PRINTED',
    });
    expect(printed.status).toBe(200);
    keep('jobs-status-printed', printed.body);
    refused(
      '/stickers/jobs/status',
      'marked again',
      await post('/stickers/jobs/status', {
        ...scope,
        accYear: j1.accYear,
        jobId: j1.jobId,
        status: 'PRINTED',
      }),
      409,
      'STICKER_JOB_STATUS_SET',
    );

    const second = await post(
      '/stickers/jobs/print',
      jobBody({ lines: [{ itemId: made.itemOil, unitId: made.itemOilUnit, labels: 7 }] }),
    );
    expect(second.status).toBe(200);
    expect(second.headers['content-type']).toContain('application/pdf');
    keep('jobs-print-pdf-headers', pdfHeaders(second));
    const j2 = {
      jobId: String(second.headers['x-sticker-job-id']),
      accYear: String(second.headers['x-sticker-acc-year']),
    };
    jobs.push(`${j2.jobId} (print, PDF)`);
    const failed = await post('/stickers/jobs/status', {
      ...scope,
      ...j2,
      status: 'FAILED',
      printerMessage: 'ZT: printer not found',
    });
    keep('jobs-status-failed', failed.body);
    refused(
      '/stickers/jobs/reprint',
      'reprint a FAILED job',
      await post('/stickers/jobs/reprint', {
        ...scope,
        ...j2,
        reasonCode: 'TORN',
        printerName: 'ZT-STK-PRN',
        lines: [],
      }),
      422,
      'STICKER_REPRINT_NOT_PRINTED',
    );
    const resend = await post('/stickers/jobs/resend', {
      ...scope,
      ...j2,
      printerName: 'ZT-STK-PRN',
      printerDpi: 203,
      inspect: true,
    });
    expect(resend.status).toBe(200);
    keep('jobs-resend-inspect', resend.body);
    const j3 = (resend.body as { data: { jobId: string; accYear: string } }).data;
    jobs.push(`${j3.jobId} (resend of ${j2.jobId})`);
    // SF1: while that resend is still SENT, another Send again is refused (variant rule=SENT).
    const whileSent = await post('/stickers/jobs/resend', { ...scope, ...j2, printerName: 'ZT-STK-PRN' });
    refused('/stickers/jobs/resend', 'a resend still SENT', whileSent, 409, 'STICKER_ALREADY_RESENT');
    expect((whileSent.body as { errors: Array<{ rule?: string }> }).errors[0].rule).toBe('SENT');
    keep('jobs-resend-while-sent', whileSent.body);
    await post('/stickers/jobs/status', {
      ...scope,
      accYear: j3.accYear,
      jobId: j3.jobId,
      status: 'PRINTED',
    });
    const afterPrinted = await post('/stickers/jobs/resend', {
      ...scope,
      ...j2,
      printerName: 'ZT-STK-PRN',
    });
    refused('/stickers/jobs/resend', 'already resent and printed', afterPrinted, 409, 'STICKER_ALREADY_RESENT');
    expect((afterPrinted.body as { errors: Array<{ rule?: string }> }).errors[0].rule).toBeUndefined();
    refused(
      '/stickers/jobs/resend',
      'resend a PRINTED job',
      await post('/stickers/jobs/resend', {
        ...scope,
        accYear: j1.accYear,
        jobId: j1.jobId,
        printerName: 'ZT-STK-PRN',
      }),
      422,
      'STICKER_RESEND_NOT_FAILED',
    );

    const reprintBody = {
      ...scope,
      accYear: j1.accYear,
      jobId: j1.jobId,
      reasonCode: 'TORN',
      printerName: 'ZT-STK-PRN',
      printerDpi: 203,
      lines: [{ lineId: j1.lines[0].lineId, labels: 2 }],
    };
    refused(
      '/stickers/jobs/reprint',
      'no reason',
      await post('/stickers/jobs/reprint', { ...reprintBody, reasonCode: undefined }),
      422,
      'STICKER_REASON_REQUIRED',
    );
    refused(
      '/stickers/jobs/reprint',
      'OTHER, no note',
      await post('/stickers/jobs/reprint', { ...reprintBody, reasonCode: 'OTHER' }),
      422,
      'STICKER_NOTE_REQUIRED',
    );
    refused(
      '/stickers/jobs/reprint',
      'reason FOO',
      await post('/stickers/jobs/reprint', { ...reprintBody, reasonCode: 'FOO' }),
      422,
      'STICKER_REASON_INVALID',
    );
    refused(
      '/stickers/jobs/reprint',
      'all 0',
      await post('/stickers/jobs/reprint', {
        ...reprintBody,
        lines: [{ lineId: j1.lines[0].lineId, labels: 0 }],
      }),
      422,
      'STICKER_NOTHING_TO_PRINT',
    );
    refused(
      '/stickers/jobs/reprint',
      'a line of another job',
      await post('/stickers/jobs/reprint', {
        ...reprintBody,
        lines: [{ lineId: j3.jobId, labels: 1 }],
      }),
      422,
      'STICKER_LINE_NOT_ON_JOB',
    );
    const reprint = await post('/stickers/jobs/reprint', { ...reprintBody, inspect: true });
    expect(reprint.status).toBe(200);
    keep('jobs-reprint-inspect', reprint.body);
    const j4 = (reprint.body as { data: { jobId: string; accYear: string } }).data;
    jobs.push(`${j4.jobId} (reprint of ${j1.jobId})`);
    await post('/stickers/jobs/status', {
      ...scope,
      accYear: j4.accYear,
      jobId: j4.jobId,
      status: 'PRINTED',
    });

    const got = await get('/stickers/jobs/get', { ...scope, accYear: j1.accYear, id: j1.jobId });
    expect(got.status).toBe(200);
    keep('jobs-get', got.body);
    const gotReprint = await get('/stickers/jobs/get', {
      ...scope,
      accYear: j4.accYear,
      id: j4.jobId,
    });
    keep('jobs-get-reprint', gotReprint.body);
    // SF5: the reprint names its original's year; the resend names the failed job and its year.
    expect((gotReprint.body as { data: { job: Record<string, unknown> } }).data.job).toMatchObject({
      reprintOfJobId: j1.jobId,
      reprintOfAccYear: j1.accYear,
      resendOfJobId: null,
      resendOfAccYear: null,
    });
    const gotResend = await get('/stickers/jobs/get', { ...scope, accYear: j3.accYear, id: j3.jobId });
    expect((gotResend.body as { data: { job: Record<string, unknown> } }).data.job).toMatchObject({
      reprintOfJobId: null,
      reprintOfAccYear: null,
      resendOfJobId: j2.jobId,
      resendOfAccYear: j2.accYear,
    });
    keep('jobs-get-resend', gotResend.body);
    refused(
      '/stickers/jobs/get',
      'unknown job',
      await get('/stickers/jobs/get', { ...scope, accYear: j1.accYear, id: D8 }),
      404,
      'STICKER_JOB_NOT_FOUND',
    );
  });

  it('print / lines refusals (J4, L9)', async () => {
    if (!rightsOk) return;
    refused(
      '/stickers/jobs/print',
      'no templateId',
      await post('/stickers/jobs/print', jobBody({ templateId: undefined })),
      422,
      'STICKER_NO_DESIGN',
    );
    refused(
      '/stickers/jobs/print',
      'blank printer',
      await post('/stickers/jobs/print', jobBody({ printerName: ' ' })),
      422,
      'STICKER_NO_PRINTER',
    );
    refused(
      '/stickers/jobs/print',
      'pack design on ITEM_LABEL',
      await post('/stickers/jobs/print', jobBody({ templateId: made.designPack })),
      422,
      'STICKER_DESIGN_NOT_LABEL',
    );
    refused(
      '/stickers/jobs/print',
      'unknown design',
      await post('/stickers/jobs/print', jobBody({ templateId: D8 })),
      404,
      'STICKER_DESIGN_NOT_FOUND',
    );
    refused(
      '/stickers/jobs/print',
      'labels 0',
      await post(
        '/stickers/jobs/print',
        jobBody({ lines: [{ itemId: made.itemOil, unitId: made.itemOilUnit, labels: 0 }] }),
      ),
      422,
      'STICKER_LABELS_INVALID',
    );
    refused(
      '/stickers/jobs/print',
      '5,001 labels',
      await post(
        '/stickers/jobs/print',
        jobBody({ lines: [{ itemId: made.itemOil, unitId: made.itemOilUnit, labels: 5001 }] }),
      ),
      422,
      'STICKER_TOO_MANY_LABELS',
    );
    refused(
      '/stickers/jobs/print',
      'no barcode on a barcode design',
      await post(
        '/stickers/jobs/print',
        jobBody({ lines: [{ itemId: made.itemNobar, unitId: made.itemNobarUnit, labels: 1 }] }),
      ),
      422,
      'STICKER_LINE_NO_BARCODE',
    );
    refused(
      '/stickers/jobs/print',
      'unit of another item',
      await post(
        '/stickers/jobs/print',
        jobBody({ lines: [{ itemId: made.itemOil, unitId: made.itemNobarUnit, labels: 1 }] }),
      ),
      422,
      'STICKER_UNIT_NOT_OF_ITEM',
    );
    refused(
      '/stickers/jobs/print',
      'unknown item',
      await post(
        '/stickers/jobs/print',
        jobBody({ lines: [{ itemId: D8, unitId: made.itemOilUnit, labels: 1 }] }),
      ),
      404,
      'STICKER_ITEM_NOT_FOUND',
    );
    if (made.itemMrp) {
      refused(
        '/stickers/jobs/print',
        'two MRPs, no lot',
        await post(
          '/stickers/jobs/print',
          jobBody({ lines: [{ itemId: made.itemMrp, unitId: made.itemMrpUnit, labels: 1 }] }),
        ),
        422,
        'STICKER_LOT_REQUIRED',
      );
    }
    refused(
      '/stickers/lines/from-items',
      'bad purpose',
      await get('/stickers/lines/from-items', {
        ...scope,
        purposeCode: 'SALE_INVOICE',
        priceLevel: 2,
      }),
      422,
      'STICKER_PURPOSE_INVALID',
    );
    refused(
      '/stickers/lines/from-items',
      'TYPED 0',
      await get('/stickers/lines/from-items', {
        ...scope,
        purposeCode: 'ITEM_LABEL',
        priceLevel: 2,
        labelsMode: 'TYPED',
        labelsEach: 0,
      }),
      422,
      'STICKER_LABELS_INVALID',
    );
    const many = Array.from({ length: 501 }, (_unused, index) => ({
      key: String(index),
      itemId: made.itemOil,
    }));
    refused(
      '/stickers/lines/resolve',
      '501 lines',
      await post('/stickers/lines/resolve', {
        ...scope,
        purposeCode: 'ITEM_LABEL',
        priceLevel: 2,
        lines: many,
      }),
      422,
      'STICKER_TOO_MANY_ITEMS',
    );
    const otherBranch = await prisma.branchMaster.findFirst({
      where: { brIsDeleted: false, NOT: { brCompId: COMPANY } },
    });
    if (otherBranch) {
      refused(
        '/stickers/lines/from-items',
        'branch of another company',
        await get('/stickers/lines/from-items', {
          companyId: COMPANY,
          branchId: otherBranch.brId,
          purposeCode: 'ITEM_LABEL',
          priceLevel: 2,
        }),
        422,
        'STICKER_BRANCH_NOT_IN_COMPANY',
      );
    }
  });
});
