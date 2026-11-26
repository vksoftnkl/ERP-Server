import { INestApplication } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as request from 'supertest';

import { as, bootIdentityApp, IDENTITIES } from './helpers/identity-app';
import { BRANCH, COMPANY, prisma } from './helpers/payment-e2e';

/**
 * Sticker printing S-P2 (plan §7, §9.1) over HTTP, against the dev database,
 * as VKPOS: purchase documents from counter D14 (as the purchase suites post
 * them), sticker jobs from the VKPOS1 desktop counter D8.
 *
 * It makes, through the API, its own ZT data (prefix ZTE-STK2-): a supplier
 * (Short "ZES"), three items (CASE12 = Box·12 + PCS, PCS default, ticked; PLAIN, ticked;
 * SURF, not ticked) and these POSTED documents of today:
 *   B1  a direct bill: CASE 4 Box + 1 free (60 labels), PLAIN 26 billed / 24
 *       received (24), SURF 12 (not ticked);
 *   R1  a shortage receipt of B1's 2 short PLAIN;
 *   G1  a GRN of CASE 2 Box; B2 a bill made from it; B2 cancelled after 10
 *       labels, then B3 a bill of G1 again (carry-over, Q20);
 *   B4  a bill of SURF only (nothing ticked).
 * Every document it posts is CANCELLED at the end (R1, B1, B3, B4, then G1);
 * the items and the supplier stay for the next run. Sticker jobs are
 * append-only and stay; each is marked PRINTED or FAILED, none is left SENT.
 * Needs VKPOS with View + Print on menu 32 and post / cancel on 24, 195, 196,
 * and the S-P1 e2e's design ZT-STK-P12-ITEM (published ITEM_LABEL 50 × 25).
 * STK_KEYS_OUT=<dir> writes each answer there for the hand-over.
 */

jest.setTimeout(600_000);

const VKPOS = '019e441b-6e48-7918-b246-b857ffb35db1';
const D8 = '019f27d5-9175-7064-8360-6fc07dedab17';
const D14 = '01a14a14-a211-7f53-a5f4-668222f3dc44';
const HEAD_OFFICE = '019efa00-c227-7672-a55b-161842adf59c';
const PCS = '019d3d70-3fd9-795f-8d52-b5ad179c81e5';
const BOX = '019e8384-060c-7163-8e9f-17e3d4c78a0b';
const GROUP = '019c6f6c-be87-7a11-8905-36092c46fd06';
const TAX5 = '01a090cd-4a59-7160-9ed7-0fdb34b747a2';
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const SUPPLIER_GROUP = '019c99c6-4094-7e80-8fa7-c30d83b02800';
const YEAR = '2026-2027';
const PRINTER = 'ZTE-STK2-PRN';

const USERS = {
  ...IDENTITIES,
  vkpos: { sub: VKPOS, user_name: 'VKPOS', user_type: 'SUPER ADMIN' },
};
const V = as('vkpos', D8);
const VP = as('vkpos', D14);
const P = as('prathap', D8);

let app: INestApplication;
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const stamp = Date.now().toString(36).slice(-5).toUpperCase();
const posted: Array<{ kind: 'BILL' | 'GRN' | 'RECEIPT'; id: string; refno: string }> = [];
const jobs: string[] = [];
const made: Record<string, string> = {};

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
const dataOf = <T = Record<string, any>>(res: request.Response): T =>
  (res.body as { data: T }).data;
const codeOf = (res: request.Response) =>
  `${res.status}:${((res.body as { errors?: Array<{ code?: string; rule?: string }> }).errors ?? [])
    .map((e) => (e.rule ? `${e.code}/${e.rule}` : e.code))
    .join(',')}`;

const refusals: Array<Record<string, unknown>> = [];
function refused(route: string, label: string, res: request.Response): void {
  const first = ((res.body as { errors?: Array<Record<string, unknown>> }).errors ?? [])[0] ?? {};
  refusals.push({ route, case: label, status: res.status, ...first });
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

async function ensureSupplier(): Promise<string> {
  const name = 'ZTE-STK2 Supplier';
  const found = await prisma.$queryRaw<Array<{ sup_id: string }>>`
    SELECT sup_id FROM purchase.suppliers WHERE sup_name = ${name} AND NOT sup_is_deleted LIMIT 1`;
  if (found[0]) return found[0].sup_id;
  const res = await post('/suppliers/create', {
    supGroupId: SUPPLIER_GROUP,
    supPurchaseType: 'LOCAL',
    supName: name,
    supShort: 'ZES',
    supStateName: 'Tamil Nadu',
    supStateCode: '33',
    supGstType: 'UNREGISTERED',
    supCompanyId: COMPANY,
    supCreditDays: 30,
  });
  expect(codeOf(res)).toMatch(/^20[01]:/);
  const again = await prisma.$queryRaw<Array<{ sup_id: string }>>`
    SELECT sup_id FROM purchase.suppliers WHERE sup_name = ${name} AND NOT sup_is_deleted LIMIT 1`;
  return again[0].sup_id;
}

interface Item {
  itemId: string;
  pcs: string;
  box?: string;
}

async function ensureItem(
  name: string,
  ticked: boolean,
  ean: string,
  withBox: boolean,
): Promise<Item> {
  const existing = await prisma.itemMaster.findFirst({
    where: { itemNameEn: name, itemIsDeleted: false },
  });
  if (!existing) {
    const price = (unit: string, factor: number) => ({
      ipm_company_id: COMPANY,
      ipm_branch_id: null,
      ipm_uc_unit_id: unit,
      ipm_cost_price: 40 * factor,
      ipm_cost_wot: 38.1 * factor,
      ipm_sales_price_a: 52 * factor,
      ipm_sales_price_b: 50 * factor,
      ipm_sales_price_c: 0,
      ipm_sales_price_d: 0,
      ipm_price_a_wot: 49.52 * factor,
      ipm_price_b_wot: 47.62 * factor,
      ipm_price_c_wot: 0,
      ipm_price_d_wot: 0,
      ipm_max_price: 55 * factor,
      ipm_min_price: 0,
      ipm_profit_type: 'By User',
    });
    const res = await post('/items/create', {
      item_name_en: name,
      item_company_id: COMPANY,
      item_group_id: GROUP,
      item_base_unit_id: PCS,
      item_default_tax_id: TAX5,
      item_barcode_sticker: ticked,
      item_is_active: true,
      // The item card's rule (notes 147 A): the biggest unit first, and a
      // row's iuc_unit_factor is how many of it make one of the row above —
      // Box (1) / PCS (12) is 1 Box = 12 PCS; PCS stays base and default.
      unit_conversions: withBox
        ? [
            {
              iuc_unit_id: BOX,
              iuc_base_unit_id: PCS,
              iuc_to_base_factor: 12,
              iuc_unit_slno: 1,
              iuc_unit_factor: 1,
              iuc_is_default_unit: false,
              iuc_is_base_unit: false,
            },
            {
              iuc_unit_id: PCS,
              iuc_base_unit_id: PCS,
              iuc_to_base_factor: 1,
              iuc_unit_slno: 2,
              iuc_unit_factor: 12,
              iuc_is_default_unit: true,
              iuc_is_base_unit: true,
            },
          ]
        : [
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
      prices: [price(PCS, 1), ...(withBox ? [price(BOX, 12)] : [])],
      ean_codes: [
        {
          ean_sl_no: 1,
          ean_unit_id: PCS,
          ean_code: ean,
          ean_is_default: true,
          ean_is_active: true,
        },
      ],
    });
    expect(codeOf(res)).toBe('201:');
  }
  const item = await prisma.itemMaster.findFirstOrThrow({
    where: { itemNameEn: name, itemIsDeleted: false },
  });
  const units = await prisma.itemUnitConversion.findMany({
    where: { iucItemId: item.itemId, iucIsDeleted: false },
  });
  return {
    itemId: item.itemId,
    pcs: units.find((unit) => unit.iucUnitId === PCS)!.iucId,
    box: units.find((unit) => unit.iucUnitId === BOX)?.iucId,
  };
}

let supplier = '';
let CASE: Item;
let PLAIN: Item;
let SURF: Item;
let design = '';

const H = (extra: Record<string, unknown> = {}) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  accYear: YEAR,
  deviceId: D14,
  supplierId: supplier,
  docDate: today,
  ...extra,
});

async function postBill(
  label: string,
  lines: Array<Record<string, unknown>>,
): Promise<{ piId: string; refno: string; lines: Array<Record<string, any>> }> {
  const body = (printed: number, postIt: boolean) => ({
    header: H({
      supplierInvNo: `ZTE-STK2-${label}-${stamp}`,
      supplierInvDate: today,
      godownId: GODOWN,
      invoiceAmountPrinted: printed,
      post: postIt,
    }),
    lines,
    charges: [],
  });
  const check = await post('/purchase/invoices/validate', body(0, false), VP);
  expect(codeOf(check)).toMatch(/^20[01]:/);
  const net = Number(dataOf(check).totals?.netPayable ?? 0);
  const res = await post('/purchase/invoices/save', body(net, true), VP);
  expect(codeOf(res)).toMatch(/^20[01]:/);
  const data = dataOf(res);
  expect(data.header.piStatus).toBe('POSTED');
  posted.push({ kind: 'BILL', id: data.header.piId, refno: data.header.piRefno });
  return { piId: data.header.piId, refno: data.header.piRefno, lines: data.lines };
}

async function cancelBill(piId: string): Promise<void> {
  const res = await post(
    '/purchase/invoices/cancel',
    { piId, accYear: YEAR, reason: 'sticker S-P2 e2e' },
    VP,
  );
  expect(codeOf(res)).toMatch(/^20[01]:/);
  const at = posted.findIndex((doc) => doc.kind === 'BILL' && doc.id === piId);
  if (at >= 0) posted.splice(at, 1);
}

// ─── Sticker calls ──────────────────────────────────────────────────────────

const docRef = (docType: string, docId: string) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  docType,
  docId,
  accYear: YEAR,
});
const fromDoc = (docType: string, docId: string, extra: Record<string, unknown> = {}, auth = V) =>
  get(
    '/stickers/lines/from-doc',
    { ...docRef(docType, docId), purposeCode: 'ITEM_LABEL', priceLevel: 2, ...extra },
    auth,
  );
const state = (docType: string, docId: string, auth = V) =>
  get('/stickers/docs/state', docRef(docType, docId), auth);

interface DocLine {
  itemId: string;
  unitId: string;
  lotId: string;
  srcLineId: string;
  labels: number;
  needed: number;
  printed: number;
  carried: number;
  left: number;
}

const printDoc = (
  source: { docType: string; docId: string } | null,
  lines: Array<Partial<DocLine> & { labels: number }>,
  extra: Record<string, unknown> = {},
  auth = V,
) =>
  post(
    '/stickers/jobs/print',
    {
      companyId: COMPANY,
      branchId: BRANCH,
      purposeCode: 'ITEM_LABEL',
      templateId: design,
      printerName: PRINTER,
      priceLevel: 2,
      inspect: true,
      ...(source ? { source: { ...source, accYear: YEAR } } : {}),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        ...(line.lotId ? { lotId: line.lotId } : {}),
        ...(line.srcLineId ? { srcLineId: line.srcLineId } : {}),
        labels: line.labels,
      })),
      ...extra,
    },
    auth,
  );

/** The counter that printed a job marks it (STICKER_JOB_OTHER_COUNTER otherwise). */
async function mark(jobId: string, status: 'PRINTED' | 'FAILED', auth = V): Promise<void> {
  const res = await post(
    '/stickers/jobs/status',
    {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId,
      status,
      ...(status === 'FAILED' ? { printerMessage: 'ZTE-STK2 test' } : {}),
    },
    auth,
  );
  expect(codeOf(res)).toBe('200:');
}

const resend = (jobId: string) =>
  post('/stickers/jobs/resend', {
    companyId: COMPANY,
    branchId: BRANCH,
    accYear: YEAR,
    jobId,
    printerName: PRINTER,
    inspect: true,
  });

/** Print with a source and mark the job; answers the inspect data. */
async function printAndMark(
  source: { docType: string; docId: string },
  lines: Array<Partial<DocLine> & { labels: number }>,
  status: 'PRINTED' | 'FAILED' = 'PRINTED',
): Promise<Record<string, any>> {
  const res = await printDoc(source, lines);
  expect(codeOf(res)).toBe('200:');
  const data = dataOf(res);
  jobs.push(data.jobNo);
  await mark(data.jobId, status);
  return data;
}

/** Grid 224's row of one document (all states, ticked only). */
async function pickerRow(refno: string): Promise<Record<string, any> | undefined> {
  const res = await get('/configured-grid-sql/run', {
    grid_id: 224,
    limit: 50,
    page: 1,
    grid_param: JSON.stringify({
      icompany_id: COMPANY,
      ibranch_id: BRANCH,
      ifrom_date: today,
      ito_date: today,
      idoc_type: '',
      isupplier_id: '',
      idoc_text: refno,
      ishow: 'ALL',
      isticker_only: '1',
    }),
  });
  expect(codeOf(res)).toBe('200:');
  return (dataOf(res).items as Array<Record<string, any>>).find((row) => row.refno === refno);
}

/** The API's figures equal the picker's (needed, printed + carried, state). */
async function sameAsPicker(docType: string, docId: string, refno: string): Promise<void> {
  const answer = dataOf(await state(docType, docId));
  const row = await pickerRow(refno);
  expect(row).toBeDefined();
  expect({
    needed: Number(row!.needed),
    printed: Number(row!.printed),
    state: row!.state_code,
  }).toEqual({
    needed: answer.needed,
    printed: answer.printed + answer.carried,
    state: answer.state,
  });
}

// ─── The run ────────────────────────────────────────────────────────────────

let B1: { piId: string; refno: string };
let B1Lines: { CASE: DocLine; PLAIN: DocLine };
let R1 = { psrId: '', refno: '' };
let G1 = { grnId: '', refno: '', griId: '' };
let B2 = { piId: '', refno: '' };
let B3 = { piId: '', refno: '' };
let B4 = { piId: '', refno: '' };
let B5 = { piId: '', refno: '' };
let fieldsDesign = '';

beforeAll(async () => {
  app = await bootIdentityApp(() => ({ who: 'vkpos', device: D8 }), USERS);
  const rights = await prisma.$queryRaw<Array<{ view: boolean; print: boolean }>>`
    SELECT um_can_view AS view, um_can_print AS print FROM public.user_menus
     WHERE um_user_id = ${VKPOS}::uuid AND um_menu_id = 32 AND NOT um_is_deleted LIMIT 1`;
  if (!rights[0]?.view || !rights[0]?.print) {
    throw new Error('VKPOS needs View + Print on menu 32 (the user ticks them)');
  }
  const designRow = await prisma.printTemplate.findFirst({
    where: { ptlCode: 'ZT-STK-P12-ITEM', ptlCompanyId: COMPANY, ptlIsDeleted: false },
  });
  if (!designRow?.ptlPublishedRevId) {
    throw new Error('Run test/stickers-sp1-http.e2e-spec.ts once first: it makes ZT-STK-P12-ITEM');
  }
  design = designRow.ptlId;
  supplier = await ensureSupplier();
  CASE = await ensureItem('ZTE-STK2-CASE12', true, ean13('200012260004'), true);
  const box = await prisma.itemUnitConversion.findFirstOrThrow({ where: { iucId: CASE.box } });
  expect(Number(box.iucToBaseFactor)).toBe(12);
  PLAIN = await ensureItem('ZTE-STK2-PLAIN', true, ean13('200012260002'), false);
  SURF = await ensureItem('ZTE-STK2-SURF', false, ean13('200012260003'), false);
  made.supplier = supplier;
  made.CASE = CASE.itemId;
  made.PLAIN = PLAIN.itemId;
  made.SURF = SURF.itemId;

  const b1 = await postBill('B1', [
    {
      lineNo: 1,
      itemId: CASE.itemId,
      uomId: CASE.box,
      billedQty: 4,
      freeQty: 1,
      rate: 400,
      taxId: TAX5,
    },
    {
      lineNo: 2,
      itemId: PLAIN.itemId,
      uomId: PLAIN.pcs,
      billedQty: 26,
      receivedQty: 24,
      rate: 30,
      taxId: TAX5,
    },
    { lineNo: 3, itemId: SURF.itemId, uomId: SURF.pcs, billedQty: 12, rate: 20, taxId: TAX5 },
  ]);
  B1 = { piId: b1.piId, refno: b1.refno };
  made.B1 = `${b1.refno} ${b1.piId}`;

  const open = await get(
    '/purchase/shortages/open',
    { companyId: COMPANY, branchId: BRANCH, supplierId: supplier },
    VP,
  );
  const short = (dataOf<Array<Record<string, any>>>(open) ?? []).find(
    (row) => row.itemId === PLAIN.itemId && row.srcRefno === b1.refno,
  );
  expect(short).toBeDefined();
  const saved = await post(
    '/purchase/shortages/receipt/save',
    {
      header: H({ godownId: GODOWN, challanNo: `ZTE-STK2-DC-${stamp}` }),
      lines: [
        { lineNo: 1, shortageId: short!.shortageId, shortageAccYear: short!.accYear, qty: 2 },
      ],
    },
    VP,
  );
  expect(codeOf(saved)).toMatch(/^20[01]:/);
  const psrId = dataOf(saved).header.psrId as string;
  const postedReceipt = await post(
    '/purchase/shortages/receipt/post',
    { psrId, accYear: YEAR },
    VP,
  );
  expect(codeOf(postedReceipt)).toMatch(/^20[01]:/);
  R1 = { psrId, refno: dataOf(postedReceipt).header.psrRefno };
  posted.push({ kind: 'RECEIPT', id: psrId, refno: R1.refno });
  made.R1 = `${R1.refno} ${psrId}`;

  const grn = await post(
    '/purchase/grns/save',
    {
      header: H({
        godownId: GODOWN,
        challanNo: `ZTE-STK2-G-${stamp}`,
        payCoolie: false,
        post: true,
      }),
      lines: [{ lineNo: 1, itemId: CASE.itemId, uomId: CASE.box, receivedQty: 2, rate: 380 }],
    },
    VP,
  );
  expect(codeOf(grn)).toMatch(/^20[01]:/);
  G1 = {
    grnId: dataOf(grn).header.grnId,
    refno: dataOf(grn).header.grnRefno,
    griId: dataOf(grn).lines[0].griId,
  };
  posted.push({ kind: 'GRN', id: G1.grnId, refno: G1.refno });
  made.G1 = `${G1.refno} ${G1.grnId}`;

  const grnLine = [
    {
      lineNo: 1,
      itemId: CASE.itemId,
      uomId: CASE.box,
      grnItemId: G1.griId,
      grnItemAccYear: YEAR,
      billedQty: 2,
      rate: 400,
      taxId: TAX5,
    },
  ];
  const b2 = await postBill('B2', grnLine);
  B2 = { piId: b2.piId, refno: b2.refno };
  made.B2 = `${b2.refno} ${b2.piId}`;
  const b4 = await postBill('B4', [
    { lineNo: 1, itemId: SURF.itemId, uomId: SURF.pcs, billedQty: 3, rate: 20, taxId: TAX5 },
  ]);
  B4 = { piId: b4.piId, refno: b4.refno };
  made.B4 = `${b4.refno} ${b4.piId}`;
  // F9: 1,000 Box × 12 = 12,000 labels on one line.
  const b5 = await postBill('B5', [
    { lineNo: 1, itemId: CASE.itemId, uomId: CASE.box, billedQty: 1000, rate: 1, taxId: TAX5 },
  ]);
  B5 = { piId: b5.piId, refno: b5.refno };
  made.B5 = `${b5.refno} ${b5.piId}`;
  fieldsDesign = await ensureFieldsDesign();
});

/**
 * ZTE-STK2-DOCFIELDS: an ITEM_LABEL 50 × 25 design (no barcode) printing the
 * three S-P2 label fields as text, so a PDF read with pdftotext shows them.
 */
async function ensureFieldsDesign(): Promise<string> {
  const code = 'ZTE-STK2-DOCFIELDS';
  const existing = await prisma.printTemplate.findFirst({
    where: { ptlCode: code, ptlCompanyId: COMPANY, ptlIsDeleted: false },
  });
  if (existing?.ptlPublishedRevId) return existing.ptlId;
  const purpose = await prisma.printPurpose.findFirstOrThrow({
    where: { ppoCode: 'ITEM_LABEL', ppoCompanyId: null, ppoIsDeleted: false },
  });
  const field = (id: string, y: number, value: string) => ({
    kind: 'FIELD',
    id,
    x: 1,
    y,
    w: 48,
    h: 4,
    value,
    font: { family: 'NotoSans', size: 7, bold: false },
    align: 'left',
  });
  const res = await post('/print-templates/create', {
    ptlCompanyId: COMPANY,
    ptlPurposeId: purpose.ppoId,
    ptlCode: code,
    ptlName: `${code} (sticker S-P2 label fields proof)`,
    versions: [
      {
        ptvStatus: 'PUBLISHED',
        ptvBody: JSON.stringify({
          schemaVersion: 1,
          layoutMode: 'GRAPHIC',
          meta: { name: code },
          bands: [
            {
              type: 'REPORT_HEADER',
              heightMm: 25,
              elements: [
                field('doc', 1, 'DOC {{ label.doc_no }}'),
                field('date', 6, 'DATE {{ label.doc_date }}'),
                field('sup', 11, 'SUP {{ label.supplier_code }}'),
              ],
            },
          ],
        }),
        ptvEngine: 'JSON_BANDS',
        ptvPaperCode: 'LABEL',
        ptvMarginLeftMm: 1,
        ptvLabelWidthMm: 50,
        ptvLabelHeightMm: 25,
        ptvLabelAcross: 1,
        ptvLabelDown: 1,
        ptvLabelGapXMm: 0,
        ptvLabelGapYMm: 0,
        ptvLabelRotate: 0,
        ptvLabelDpi: 203,
        datasets: [
          {
            ptdRole: 'MASTER',
            ptdDatasetNo: 0,
            ptdName: 'label',
            ptdSourceKind: 'PROVIDER',
            ptdProviderCode: 'stickers.label',
            ptdRowLimit: 1,
          },
        ],
      },
    ],
  });
  expect(codeOf(res)).toBe('201:');
  return (res.body as { data: { ptlId: string } }).data.ptlId;
}

/** The text of a PDF answer (pdftotext). */
function pdfText(res: request.Response): string {
  const dir = mkdtempSync(join(tmpdir(), 'zte-stk2-'));
  try {
    const file = join(dir, 'job.pdf');
    writeFileSync(file, res.body as Buffer);
    return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const binary = (res: request.Response, done: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

/** True once 20261127100100 is applied: grid 224 leaves a reprint's copies out (F2). */
async function gridHasF2(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT position('lbjl_reprint_of_line_id IS NULL' in grid_sql) > 0 AS ok
      FROM fixed.grid_details WHERE grid_id = 224`;
  return rows[0]?.ok === true;
}

afterAll(async () => {
  keep('refusals', refusals);
  // Cancel what this run posted: the receipt before its bill, the bills before the GRN.
  const order = ['RECEIPT', 'BILL', 'GRN'];
  for (const kind of order) {
    for (const doc of posted.filter((entry) => entry.kind === kind)) {
      const res =
        kind === 'RECEIPT'
          ? await post(
              '/purchase/shortages/receipt/cancel',
              { psrId: doc.id, accYear: YEAR, reason: 'sticker S-P2 e2e' },
              VP,
            )
          : kind === 'BILL'
            ? await post(
                '/purchase/invoices/cancel',
                { piId: doc.id, accYear: YEAR, reason: 'sticker S-P2 e2e' },
                VP,
              )
            : await post(
                '/purchase/grns/cancel',
                { grnId: doc.id, accYear: YEAR, reason: 'sticker S-P2 e2e' },
                VP,
              );
      // eslint-disable-next-line no-console
      console.log(`cancel ${kind} ${doc.refno}: ${codeOf(res)}`);
    }
  }
  const sent = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM inventory.label_job
     WHERE lbj_refno = ANY(${jobs}::text[]) AND lbj_device_id IN (${D8}::uuid, ${D14}::uuid)
       AND lbj_status = 'SENT'`;
  // eslint-disable-next-line no-console
  console.log(
    `ZT data: ${JSON.stringify(made)}\nJobs made this run: ${JSON.stringify(jobs)}; left SENT: ${sent[0]?.n}`,
  );
  await app?.close();
  await prisma.$disconnect();
});

describe('Swagger and removals', () => {
  it('lists the two new /stickers routes; /purchase/labels/from-doc is gone', async () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const paths = Object.keys(document.paths);
    expect(paths).toEqual(
      expect.arrayContaining(['/api/v1/stickers/lines/from-doc', '/api/v1/stickers/docs/state']),
    );
    expect(paths.some((path) => path.includes('/purchase/labels'))).toBe(false);
    const gone = await get('/purchase/labels/from-doc', {
      docType: 'PURCHASE_BILL',
      docId: B1.piId,
      accYear: YEAR,
    });
    expect(gone.status).toBe(404);
  });

  it('the GRN check carries no labels count any more', async () => {
    const res = await get('/purchase/grns/get', { grnId: G1.grnId, accYear: YEAR }, VP);
    expect(codeOf(res)).toBe('200:');
    const lines = dataOf(res).lines as Array<{ check?: Record<string, unknown> }>;
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      if (line.check) expect(line.check).not.toHaveProperty('labels');
    }
  });

  it('the stickers.label fields add doc_date after doc_no', async () => {
    const res = await get('/print-render/providers', {});
    const provider = dataOf<Array<{ code: string; fields: Array<{ name: string }> }>>(res).find(
      (entry) => entry.code === 'stickers.label',
    );
    const names = provider!.fields.map((field) => field.name);
    expect(names.length).toBe(37);
    expect(names.slice(names.indexOf('doc_no'), names.indexOf('doc_no') + 3)).toEqual([
      'doc_no',
      'doc_date',
      'supplier_code',
    ]);
  });
});

describe('GET /stickers/lines/from-doc', () => {
  it('B1 (direct): per item + lot, Def unit, the row’s lot, labels = left, unticked skipped', async () => {
    const res = await fromDoc('PURCHASE_BILL', B1.piId);
    expect(codeOf(res)).toBe('200:');
    const data = dataOf(res);
    keep('from-doc-direct', data);
    expect(data.doc).toMatchObject({
      docType: 'PURCHASE_BILL',
      docId: B1.piId,
      accYear: YEAR,
      refno: B1.refno,
      status: 'POSTED',
      supplierId: supplier,
      supplierName: 'ZTE-STK2 Supplier',
      sourceKind: 'DIRECT',
      fromGrns: [],
      linesAll: 3,
      linesTicked: 2,
    });
    expect(data.doc.docDate).toBe(
      `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`,
    );
    const lines = data.lines as Array<DocLine & Record<string, any>>;
    const caseLine = lines.find((line) => line.itemId === CASE.itemId)!;
    const plainLine = lines.find((line) => line.itemId === PLAIN.itemId)!;
    expect(caseLine).toMatchObject({
      unitId: CASE.pcs,
      isDefaultUnit: true,
      needed: 60,
      printed: 0,
      carried: 0,
      left: 60,
      labels: 60,
      reprinted: 0,
      srcDocType: 'PURCHASE_BILL',
      srcDocId: B1.piId,
      srcAccYear: YEAR,
      srcRefno: B1.refno,
      srcLineNo: 1,
      srcLineNos: [1],
      srcGrnRefno: null,
      barcode: ean13('200012260004'),
      problem: null,
    });
    expect(caseLine.key).toBe(`D:${caseLine.srcLineId}:${caseLine.lotId}`);
    expect(plainLine).toMatchObject({ needed: 24, left: 24, srcLineNo: 2 });
    expect(lines.some((line) => line.itemId === SURF.itemId)).toBe(false);
    expect(data.skipped.notTicked).toEqual([{ lineNo: 3, itemName: 'ZTE-STK2-SURF' }]);
    B1Lines = { CASE: caseLine, PLAIN: plainLine };
  });

  it('stickerOnly=false loads the unticked line too', async () => {
    const data = dataOf(await fromDoc('PURCHASE_BILL', B1.piId, { stickerOnly: false }));
    const surf = (data.lines as DocLine[]).find((line) => line.itemId === SURF.itemId);
    expect(surf).toMatchObject({ needed: 12, left: 12 });
    expect(data.skipped.notTicked).toEqual([]);
  });

  it('B2 (from a GRN): the GRN’s rows, sourceKind GRN, fromGrns, srcGrnRefno', async () => {
    const data = dataOf(await fromDoc('PURCHASE_BILL', B2.piId));
    keep('from-doc-grn', data);
    expect(data.doc).toMatchObject({
      sourceKind: 'GRN',
      fromGrns: [{ grnId: G1.grnId, accYear: YEAR, refno: G1.refno }],
    });
    expect(data.lines[0]).toMatchObject({
      itemId: CASE.itemId,
      unitId: CASE.pcs,
      needed: 24,
      left: 24,
      srcGrnRefno: G1.refno,
    });
  });

  it('R1 (shortage receipt): its own rows', async () => {
    const data = dataOf(await fromDoc('SHORTAGE_RECEIPT', R1.psrId));
    keep('from-doc-receipt', data);
    expect(data.doc).toMatchObject({
      docType: 'SHORTAGE_RECEIPT',
      refno: R1.refno,
      sourceKind: null,
    });
    expect(data.lines).toHaveLength(1);
    expect(data.lines[0]).toMatchObject({
      itemId: PLAIN.itemId,
      needed: 2,
      left: 2,
      srcDocType: 'SHORTAGE_RECEIPT',
    });
  });

  it('refusals', async () => {
    const draft = await prisma.$queryRaw<Array<{ pi_id: string; pi_acc_year: string }>>`
      SELECT pi_id, pi_acc_year::text AS pi_acc_year FROM purchase.pur_invoice
       WHERE pi_branch_id = ${BRANCH}::uuid AND pi_status = 'DRAFT' AND NOT pi_is_deleted
       ORDER BY pi_created_on DESC LIMIT 1`;
    const cases: Array<[string, request.Response, string]> = [
      [
        'no View on 32 (prathap)',
        await fromDoc('PURCHASE_BILL', B1.piId, {}, P),
        '403:STICKER_RIGHT_VIEW',
      ],
      ['docType GRN', await fromDoc('GRN', G1.grnId), '422:STICKER_DOC_TYPE_INVALID'],
      [
        'an unknown id',
        await fromDoc('PURCHASE_BILL', '01a00000-0000-7000-8000-000000000000'),
        '404:STICKER_DOC_NOT_FOUND',
      ],
      [
        'another branch asks for B1',
        await get('/stickers/lines/from-doc', {
          ...docRef('PURCHASE_BILL', B1.piId),
          branchId: HEAD_OFFICE,
          purposeCode: 'ITEM_LABEL',
          priceLevel: 2,
        }),
        '422:STICKER_DOC_OTHER_BRANCH',
      ],
      [
        'B4: nothing ticked',
        await fromDoc('PURCHASE_BILL', B4.piId),
        '422:STICKER_DOC_NOTHING_TICKED',
      ],
      [
        'bad purpose',
        await fromDoc('PURCHASE_BILL', B1.piId, { purposeCode: 'NOPE' }),
        '422:STICKER_PURPOSE_INVALID',
      ],
    ];
    if (draft[0]) {
      cases.push([
        'a draft bill',
        await get('/stickers/lines/from-doc', {
          ...docRef('PURCHASE_BILL', draft[0].pi_id),
          accYear: draft[0].pi_acc_year,
          purposeCode: 'ITEM_LABEL',
          priceLevel: 2,
        }),
        '422:STICKER_DOC_NOT_POSTED',
      ]);
    }
    for (const [label, res, expected] of cases) {
      refused('/stickers/lines/from-doc', label, res);
      expect(`${label} → ${codeOf(res)}`).toBe(`${label} → ${expected}`);
    }
  });
});

describe('GET /stickers/docs/state', () => {
  it('B1 before printing: NOT, ticked totals, afterPost, no jobs; equal to grid 224', async () => {
    const res = await state('PURCHASE_BILL', B1.piId);
    expect(codeOf(res)).toBe('200:');
    const data = dataOf(res);
    keep('docs-state-before', data);
    expect(data).toMatchObject({
      docType: 'PURCHASE_BILL',
      refno: B1.refno,
      status: 'POSTED',
      sourceKind: 'DIRECT',
      linesAll: 3,
      linesTicked: 2,
      needed: 84,
      printed: 0,
      carried: 0,
      left: 84,
      state: 'NOT',
      jobs: [],
      carriedFrom: [],
    });
    expect(['ASK', 'ALWAYS', 'NEVER']).toContain(data.afterPost);
    await sameAsPicker('PURCHASE_BILL', B1.piId, B1.refno);
  });

  it('B4 (nothing ticked) is NONE', async () => {
    expect(dataOf(await state('PURCHASE_BILL', B4.piId))).toMatchObject({
      state: 'NONE',
      needed: 0,
    });
  });

  it('refusals', async () => {
    for (const [label, res, expected] of [
      ['docType GRN', await state('GRN', G1.grnId), '422:STICKER_DOC_TYPE_INVALID'],
      ['unknown id', await state('SHORTAGE_RECEIPT', B1.piId), '404:STICKER_DOC_NOT_FOUND'],
      ['no View', await state('PURCHASE_BILL', B1.piId, P), '403:STICKER_RIGHT_VIEW'],
    ] as Array<[string, request.Response, string]>) {
      refused('/stickers/docs/state', label, res);
      expect(`${label} → ${codeOf(res)}`).toBe(`${label} → ${expected}`);
    }
  });
});

describe('POST /stickers/jobs/print with a source', () => {
  const B1src = () => ({ docType: 'PURCHASE_BILL', docId: B1.piId });

  it('the line and source checks', async () => {
    const caseLine = B1Lines.CASE;
    const b2Line = (dataOf(await fromDoc('PURCHASE_BILL', B2.piId)).lines as DocLine[])[0];
    const draft = await prisma.$queryRaw<Array<{ pi_id: string }>>`
      SELECT pi_id FROM purchase.pur_invoice
       WHERE pi_branch_id = ${BRANCH}::uuid AND pi_status = 'DRAFT' AND NOT pi_is_deleted
         AND pi_acc_year = ${YEAR}::char(9)
       ORDER BY pi_created_on DESC LIMIT 1`;
    const cases: Array<[string, request.Response, string]> = [
      [
        'a line of another bill',
        await printDoc(B1src(), [{ ...b2Line, labels: 1 }]),
        '422:STICKER_DOC_LINE_NOT_ON_DOC',
      ],
      [
        'the Box unit',
        await printDoc(B1src(), [{ ...caseLine, unitId: CASE.box, labels: 1 }]),
        '422:STICKER_DOC_LINE_NOT_ON_DOC/UNIT',
      ],
      [
        'one line with no srcLineId',
        await printDoc(B1src(), [
          { ...caseLine, labels: 1 },
          { ...B1Lines.PLAIN, srcLineId: undefined, labels: 1 },
        ]),
        '422:STICKER_DOC_LINE_NOT_ON_DOC',
      ],
      [
        'a manual job naming a document line',
        await printDoc(null, [{ ...caseLine, labels: 1 }]),
        '422:STICKER_DOC_LINE_NOT_ON_DOC',
      ],
      [
        'source GRN',
        await printDoc({ docType: 'GRN', docId: G1.grnId }, [{ ...caseLine, labels: 1 }]),
        '422:STICKER_DOC_TYPE_INVALID',
      ],
      [
        'source of another branch’s view',
        await printDoc(B1src(), [{ ...caseLine, labels: 1 }], { branchId: HEAD_OFFICE }),
        '422:STICKER_DOC_OTHER_BRANCH',
      ],
      [
        'more than needed at once',
        await printDoc(B1src(), [{ ...caseLine, labels: 61 }]),
        '422:STICKER_DOC_OVER_LEFT/LEFT',
      ],
    ];
    if (draft[0]) {
      cases.push([
        'a draft bill',
        await printDoc({ docType: 'PURCHASE_BILL', docId: draft[0].pi_id }, [
          { ...caseLine, labels: 1 },
        ]),
        '422:STICKER_DOC_NOT_POSTED',
      ]);
    }
    for (const [label, res, expected] of cases) {
      refused('/stickers/jobs/print', label, res);
      expect(`${label} → ${codeOf(res)}`).toBe(`${label} → ${expected}`);
    }
    const over = cases.find(([label]) => label === 'more than needed at once')![1];
    expect((over.body as { errors: Array<Record<string, unknown>> }).errors[0]).toMatchObject({
      line: 1,
      params: { doc: B1.refno, item: 'ZTE-STK2-CASE12', printed: 0, needed: 60, left: 60 },
      meta: {
        itemId: CASE.itemId,
        lotId: caseLine.lotId,
        needed: 60,
        printed: 0,
        carried: 0,
        left: 60,
      },
    });
    // no job was made by any of them
    expect(dataOf(await state('PURCHASE_BILL', B1.piId)).jobs).toEqual([]);
  });

  it('a part print (CASE 40 of 60): the job keeps the source; state PART; the picker agrees', async () => {
    const data = await printAndMark(B1src(), [{ ...B1Lines.CASE, labels: 40 }]);
    keep('print-inspect-source', data);
    expect(data.source).toEqual({
      docType: 'PURCHASE_BILL',
      docId: B1.piId,
      accYear: YEAR,
      refno: B1.refno,
    });
    expect(data.lines[0]).toMatchObject({ srcLineId: B1Lines.CASE.srcLineId, labels: 40 });
    const row = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT lbj_src_kind, lbj_src_doc_type, lbj_src_doc_id::text, lbj_src_acc_year::text, lbj_src_refno,
             (SELECT lbjl_src_line_id::text FROM inventory.label_job_line l
               WHERE l.lbjl_job_id = j.lbj_id AND l.lbjl_acc_year = j.lbj_acc_year LIMIT 1) AS src_line
        FROM inventory.label_job j WHERE j.lbj_id = ${data.jobId}::uuid`;
    expect(row[0]).toEqual({
      lbj_src_kind: 'DOCUMENT',
      lbj_src_doc_type: 'PURCHASE_BILL',
      lbj_src_doc_id: B1.piId,
      lbj_src_acc_year: YEAR,
      lbj_src_refno: B1.refno,
      src_line: B1Lines.CASE.srcLineId,
    });
    const after = dataOf(await state('PURCHASE_BILL', B1.piId));
    expect(after).toMatchObject({ needed: 84, printed: 40, left: 44, state: 'PART' });
    expect(after.jobs).toEqual([
      expect.objectContaining({ jobId: data.jobId, labels: 40, kind: 'PRINT', status: 'PRINTED' }),
    ]);
    keep('docs-state-part', after);
    const line = (dataOf(await fromDoc('PURCHASE_BILL', B1.piId)).lines as DocLine[]).find(
      (entry) => entry.itemId === CASE.itemId,
    );
    expect(line).toMatchObject({ printed: 40, left: 20, labels: 20 });
    await sameAsPicker('PURCHASE_BILL', B1.piId, B1.refno);
  });

  it('over left: 21 of the 20 left → rule=LEFT; after the 20, 1 more → plain', async () => {
    const left = await printDoc(B1src(), [{ ...B1Lines.CASE, labels: 21 }]);
    refused('/stickers/jobs/print', 'CASE 21 of 20 left', left);
    expect(codeOf(left)).toBe('422:STICKER_DOC_OVER_LEFT/LEFT');
    await printAndMark(B1src(), [{ ...B1Lines.CASE, labels: 20 }]);
    const none = await printDoc(B1src(), [{ ...B1Lines.CASE, labels: 1 }]);
    refused('/stickers/jobs/print', 'CASE 1 when nothing is left', none);
    expect(codeOf(none)).toBe('422:STICKER_DOC_OVER_LEFT');
    expect((none.body as { errors: Array<Record<string, any>> }).errors[0].user).toBeDefined();
  });

  it('two counters print the last 4 at once: one 200, one 422 (the document lock, C5)', async () => {
    await printAndMark(B1src(), [{ ...B1Lines.PLAIN, labels: 20 }]);
    // D8 and D14 number apart (each its own counter lock), so only the
    // per-document lock stands between them.
    const [a, b] = await Promise.all([
      printDoc(B1src(), [{ ...B1Lines.PLAIN, labels: 4 }], {}, V),
      printDoc(B1src(), [{ ...B1Lines.PLAIN, labels: 4 }], {}, VP),
    ]);
    const outcomes = [codeOf(a), codeOf(b)].sort();
    expect(outcomes).toEqual(['200:', '422:STICKER_DOC_OVER_LEFT']);
    const won = a.status === 200 ? a : b;
    jobs.push(dataOf(won).jobNo);
    await mark(dataOf(won).jobId, 'PRINTED', a.status === 200 ? V : VP);
    expect(dataOf(await state('PURCHASE_BILL', B1.piId))).toMatchObject({ left: 0, state: 'DONE' });
    await sameAsPicker('PURCHASE_BILL', B1.piId, B1.refno);
  });

  it('a manual job still prints (no source, no srcLineId)', async () => {
    const res = await printDoc(null, [{ itemId: PLAIN.itemId, unitId: PLAIN.pcs, labels: 1 }]);
    expect(codeOf(res)).toBe('200:');
    expect(dataOf(res).source).toBeNull();
    expect(dataOf(res).lines[0].srcLineId).toBeNull();
    jobs.push(dataOf(res).jobNo);
    await mark(dataOf(res).jobId, 'PRINTED');
  });
});

describe('Reprint, resend, get, grid 223', () => {
  it('a reprint (TORN) copies the source; Reprinted counts, printed does not move', async () => {
    const first = dataOf(await state('PURCHASE_BILL', B1.piId)).jobs[0] as { jobId: string };
    const original = dataOf(
      await get('/stickers/jobs/get', {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: YEAR,
        id: first.jobId,
      }),
    );
    keep('jobs-get-document', original);
    expect(original.job).toMatchObject({
      srcKind: 'DOCUMENT',
      srcDocType: 'PURCHASE_BILL',
      srcDocId: B1.piId,
      srcAccYear: YEAR,
      srcRefno: B1.refno,
    });
    expect(original.lines[0]).toMatchObject({ srcLineId: B1Lines.CASE.srcLineId });
    const res = await post('/stickers/jobs/reprint', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId: first.jobId,
      reasonCode: 'TORN',
      printerName: PRINTER,
      inspect: true,
      lines: [{ lineId: original.lines[0].lineId, labels: 2 }],
    });
    expect(codeOf(res)).toBe('200:');
    const reprint = dataOf(res);
    jobs.push(reprint.jobNo);
    expect(reprint.source).toEqual({
      docType: 'PURCHASE_BILL',
      docId: B1.piId,
      accYear: YEAR,
      refno: B1.refno,
    });
    expect(reprint.lines[0].srcLineId).toBe(B1Lines.CASE.srcLineId);
    await mark(reprint.jobId, 'PRINTED');
    const after = dataOf(await state('PURCHASE_BILL', B1.piId));
    expect(after).toMatchObject({ printed: 84, left: 0, state: 'DONE' });
    const line = (
      dataOf(await fromDoc('PURCHASE_BILL', B1.piId)).lines as Array<
        DocLine & { reprinted: number }
      >
    ).find((entry) => entry.itemId === CASE.itemId);
    expect(line).toMatchObject({ printed: 60, left: 0, labels: 0, reprinted: 2 });
  });

  it('a resend of a FAILED document job is checked against left (F1), copies the source, counts once PRINTED', async () => {
    const src = { docType: 'SHORTAGE_RECEIPT', docId: R1.psrId };
    const line = (dataOf(await fromDoc('SHORTAGE_RECEIPT', R1.psrId)).lines as DocLine[])[0];
    const failed = await printAndMark(src, [{ ...line, labels: 2 }], 'FAILED');
    expect(dataOf(await state('SHORTAGE_RECEIPT', R1.psrId))).toMatchObject({
      printed: 0,
      left: 2,
      state: 'NOT',
    });
    // F1: the list printed 1 meanwhile, so resending the failed 2 would pass needed
    await printAndMark(src, [{ ...line, labels: 1 }]);
    const over = await resend(failed.jobId);
    refused('/stickers/jobs/resend', 'F1: a failed job of 2 when 1 is left', over);
    expect(codeOf(over)).toBe('422:STICKER_DOC_OVER_LEFT/LEFT');
    expect((over.body as { errors: Array<Record<string, unknown>> }).errors[0]).toMatchObject({
      params: { doc: R1.refno, item: 'ZTE-STK2-PLAIN', printed: 1, needed: 2, left: 1 },
      meta: { itemId: PLAIN.itemId, lotId: line.lotId, needed: 2, printed: 1, carried: 0, left: 1 },
    });
    const failedOne = await printAndMark(src, [{ ...line, labels: 1 }], 'FAILED');
    const res = await resend(failedOne.jobId);
    expect(codeOf(res)).toBe('200:');
    const resent = dataOf(res);
    jobs.push(resent.jobNo);
    expect(resent.source).toEqual({
      docType: 'SHORTAGE_RECEIPT',
      docId: R1.psrId,
      accYear: YEAR,
      refno: R1.refno,
    });
    await mark(resent.jobId, 'PRINTED');
    const after = dataOf(await state('SHORTAGE_RECEIPT', R1.psrId));
    keep('docs-state-receipt', after);
    expect(after.jobs.map((job: Record<string, unknown>) => [job.status, job.reprint])).toEqual([
      ['FAILED', false],
      ['PRINTED', false],
      ['FAILED', false],
      ['PRINTED', false],
    ]);
    expect(after).toMatchObject({ printed: 2, left: 0, state: 'DONE' });
    await sameAsPicker('SHORTAGE_RECEIPT', R1.psrId, R1.refno);
  });

  it('grid 223: Source column and the isrc_text filter', async () => {
    const res = await get('/configured-grid-sql/run', {
      grid_id: 223,
      limit: 100,
      page: 1,
      grid_param: JSON.stringify({
        icompany_id: COMPANY,
        ibranch_id: BRANCH,
        ifrom_date: '',
        ito_date: '',
        idevice_id: '',
        iuser_id: '',
        iitem_text: '',
        isrc_text: B1.refno,
      }),
    });
    expect(codeOf(res)).toBe('200:');
    const items = dataOf(res).items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every((row) => row.source_text === B1.refno)).toBe(true);
  });
});

describe('Carry-over (Q20, C4)', () => {
  it('B2 printed 10, cancelled; B3 of the same GRN line carries the 10', async () => {
    const line = (dataOf(await fromDoc('PURCHASE_BILL', B2.piId)).lines as DocLine[])[0];
    await printAndMark({ docType: 'PURCHASE_BILL', docId: B2.piId }, [{ ...line, labels: 10 }]);
    const failedOnB2 = await printAndMark(
      { docType: 'PURCHASE_BILL', docId: B2.piId },
      [{ ...line, labels: 1 }],
      'FAILED',
    );
    await cancelBill(B2.piId);
    // F1: its document is no longer POSTED → refused, as print is
    const gone = await resend(failedOnB2.jobId);
    refused('/stickers/jobs/resend', 'F1: a failed job of a cancelled bill', gone);
    expect(codeOf(gone)).toBe('422:STICKER_DOC_NOT_POSTED');
    const b3 = await postBill('B3', [
      {
        lineNo: 1,
        itemId: CASE.itemId,
        uomId: CASE.box,
        grnItemId: G1.griId,
        grnItemAccYear: YEAR,
        billedQty: 2,
        rate: 400,
        taxId: TAX5,
      },
    ]);
    B3 = { piId: b3.piId, refno: b3.refno };
    made.B3 = `${b3.refno} ${b3.piId}`;
    const after = dataOf(await state('PURCHASE_BILL', B3.piId));
    keep('docs-state-carried', after);
    expect(after).toMatchObject({
      sourceKind: 'GRN',
      needed: 24,
      printed: 0,
      carried: 10,
      left: 14,
      state: 'PART',
      carriedFrom: [{ docId: B2.piId, accYear: YEAR, refno: B2.refno, labels: 10 }],
      fromGrns: [{ grnId: G1.grnId, accYear: YEAR, refno: G1.refno }],
    });
    const lines = dataOf(await fromDoc('PURCHASE_BILL', B3.piId)).lines as DocLine[];
    expect(lines[0]).toMatchObject({ needed: 24, printed: 0, carried: 10, left: 14, labels: 14 });
    await sameAsPicker('PURCHASE_BILL', B3.piId, B3.refno);
    // the cancelled bill still answers docs/state (C14) and refuses from-doc
    expect(dataOf(await state('PURCHASE_BILL', B2.piId))).toMatchObject({
      status: 'CANCELLED',
      printed: 10,
    });
    const cancelled = await fromDoc('PURCHASE_BILL', B2.piId);
    refused('/stickers/lines/from-doc', 'a cancelled bill', cancelled);
    expect(codeOf(cancelled)).toBe('422:STICKER_DOC_NOT_POSTED');
    const over = await printDoc({ docType: 'PURCHASE_BILL', docId: B3.piId }, [
      { ...lines[0], labels: 15 },
    ]);
    expect(codeOf(over)).toBe('422:STICKER_DOC_OVER_LEFT/LEFT');
  });
});

describe('Review fixes (F2, F4, F5, F9)', () => {
  it('F2: a resend of a failed REPRINT counts as reprinted, never printed; jobs[] marks it reprint', async () => {
    const src = { docType: 'PURCHASE_BILL', docId: B3.piId };
    const line = (dataOf(await fromDoc('PURCHASE_BILL', B3.piId)).lines as DocLine[])[0];
    const printed = await printAndMark(src, [{ ...line, labels: 4 }]);
    const original = dataOf(
      await get('/stickers/jobs/get', {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: YEAR,
        id: printed.jobId,
      }),
    );
    const reprint = await post('/stickers/jobs/reprint', {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId: printed.jobId,
      reasonCode: 'TORN',
      printerName: PRINTER,
      inspect: true,
      lines: [{ lineId: original.lines[0].lineId, labels: 2 }],
    });
    expect(codeOf(reprint)).toBe('200:');
    jobs.push(dataOf(reprint).jobNo);
    await mark(dataOf(reprint).jobId, 'FAILED');
    const again = await resend(dataOf(reprint).jobId);
    expect(codeOf(again)).toBe('200:');
    jobs.push(dataOf(again).jobNo);
    await mark(dataOf(again).jobId, 'PRINTED');
    const after = dataOf(await state('PURCHASE_BILL', B3.piId));
    keep('docs-state-reprint-resend', after);
    expect(after).toMatchObject({ needed: 24, printed: 4, carried: 10, left: 10, state: 'PART' });
    expect(
      after.jobs.map((job: Record<string, unknown>) => [
        job.jobNo,
        job.kind,
        job.reprint,
        job.status,
      ]),
    ).toEqual([
      [printed.jobNo, 'PRINT', false, 'PRINTED'],
      [dataOf(reprint).jobNo, 'REPRINT', true, 'FAILED'],
      [dataOf(again).jobNo, 'PRINT', true, 'PRINTED'],
    ]);
    const now = (
      dataOf(await fromDoc('PURCHASE_BILL', B3.piId)).lines as Array<
        DocLine & { reprinted: number }
      >
    )[0];
    expect(now).toMatchObject({ printed: 4, carried: 10, left: 10, labels: 10, reprinted: 2 });
    if (await gridHasF2()) {
      await sameAsPicker('PURCHASE_BILL', B3.piId, B3.refno);
    } else {
      // 20261127100100 not applied yet: the old grid still counts the resend (2 more)
      const row = await pickerRow(B3.refno);
      expect(Number(row!.printed)).toBe(16);
      // eslint-disable-next-line no-console
      console.log('grid 224 has not got F2 yet (20261127100100 not applied): API 14, grid 16');
    }
  });

  it('F4: a document job prints doc_no, doc_date and the document supplier’s code for a lot with none; so does its reprint', async () => {
    const line = (dataOf(await fromDoc('PURCHASE_BILL', B5.piId)).lines as DocLine[])[0];
    const res = await http()
      .post('/api/v1/stickers/jobs/print')
      .set('Authorization', V)
      .buffer(true)
      .parse(binary)
      .send({
        companyId: COMPANY,
        branchId: BRANCH,
        purposeCode: 'ITEM_LABEL',
        templateId: fieldsDesign,
        printerName: PRINTER,
        priceLevel: 2,
        source: { docType: 'PURCHASE_BILL', docId: B5.piId, accYear: YEAR },
        lines: [
          {
            itemId: line.itemId,
            unitId: line.unitId,
            lotId: line.lotId,
            srcLineId: line.srcLineId,
            labels: 1,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const jobId = res.headers['x-sticker-job-id'] as string;
    jobs.push(res.headers['x-sticker-job-no'] as string);
    await mark(jobId, 'PRINTED');
    const day = `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`;
    const text = pdfText(res);
    keep('label-fields-pdf-text', { text });
    expect(text).toContain(`DOC ${B5.refno}`);
    expect(text).toContain(`DATE ${day}`);
    expect(text).toContain('SUP ZES');
    const original = dataOf(
      await get('/stickers/jobs/get', {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: YEAR,
        id: jobId,
      }),
    );
    const again = await http()
      .post('/api/v1/stickers/jobs/reprint')
      .set('Authorization', V)
      .buffer(true)
      .parse(binary)
      .send({
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: YEAR,
        jobId,
        reasonCode: 'TORN',
        printerName: PRINTER,
        lines: [{ lineId: original.lines[0].lineId, labels: 1 }],
      });
    expect(again.status).toBe(200);
    jobs.push(again.headers['x-sticker-job-no'] as string);
    await mark(again.headers['x-sticker-job-id'] as string, 'PRINTED');
    const reprinted = pdfText(again);
    expect(reprinted).toContain(`DOC ${B5.refno}`);
    expect(reprinted).toContain(`DATE ${day}`);
    expect(reprinted).toContain('SUP ZES');
  });

  it('F9: a 12,000-label line starts at 9,999; left keeps 12,000', async () => {
    const data = dataOf(await fromDoc('PURCHASE_BILL', B5.piId));
    keep('from-doc-over-9999', data.lines[0]);
    expect(data.lines[0]).toMatchObject({ needed: 12000, labels: 9999 });
    expect(data.lines[0].left).toBe(12000 - data.lines[0].printed);
  });

  it('F5: resolve takes a key of up to 80 characters (a document key is 75)', async () => {
    const key = `D:${B1Lines.CASE.srcLineId}:${B1Lines.CASE.lotId}`;
    expect(key.length).toBe(75);
    const body = (k: string) => ({
      companyId: COMPANY,
      branchId: BRANCH,
      purposeCode: 'ITEM_LABEL',
      priceLevel: 2,
      lines: [
        { key: k, itemId: CASE.itemId, unitId: CASE.pcs, lotId: B1Lines.CASE.lotId, labels: 1 },
      ],
    });
    const ok = await post('/stickers/lines/resolve', body(key));
    expect(codeOf(ok)).toBe('200:');
    expect(dataOf(ok).lines[0].key).toBe(key);
    expect(codeOf(await post('/stickers/lines/resolve', body('k'.repeat(80))))).toBe('200:');
    const long = await post('/stickers/lines/resolve', body('k'.repeat(81)));
    refused('/stickers/lines/resolve', 'F5: an 81-character key', long);
    expect(long.status).toBe(400);
  });
});
