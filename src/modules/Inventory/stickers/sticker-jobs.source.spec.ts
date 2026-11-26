import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrintRenderService } from '../../settings/print-render/print-render.service';
import { PrintTemplateAssignmentService } from '../../settings/print-template-assignment/print-template-assignment.service';
import { StickerDocSourceService } from './sticker-doc-source.service';
import { StickerJobsService } from './sticker-jobs.service';
import { DesignRow, StickerLinesService } from './sticker-lines.service';
import { refuseSticker } from './sticker.errors';
import { BuiltStickerLine } from './types/sticker.types';

/**
 * Sticker printing S-P2 (plan §4.4 / §4.5 / §7.3 / §7.4 / §7.5, §7.8) on the
 * job service: a job with a source writes the five source columns and each
 * line's srcLineId, runs the document's "left" guard inside its transaction,
 * fills doc_no / doc_date / supplier_code; a manual job refuses a document
 * line; reprint and resend copy the source; /jobs/get answers it. (S-P1's
 * own cases stay in sticker-jobs.service.spec.ts, unchanged.)
 */

const D = (value: number | string) => new Prisma.Decimal(value);
const COMPANY = 'c0000000-0000-7000-8000-000000000001';
const BRANCH = 'b0000000-0000-7000-8000-000000000001';
const DEVICE = 'dev-0000-0000-7000-8000-000000000008';
const TEMPLATE = 'd0000000-0000-7000-8000-000000000001';
const BILL = 'e0000000-0000-7000-8000-000000000001';
const YEAR = '2026-2027';
const SOURCE = { docType: 'PURCHASE_BILL', docId: BILL, accYear: YEAR };

const DESIGN: DesignRow = {
  ptl_id: TEMPLATE,
  ptl_name: 'SAMPLE item 50 × 25',
  ptl_company_id: null,
  ptl_is_active: true,
  ptl_is_deleted: false,
  ppo_code: 'ITEM_LABEL',
  ptv_id: 'ver-1',
  ptv_rev_no: 1,
  ptv_status: 'PUBLISHED',
  ptv_is_deleted: false,
  ptv_label_width_mm: D(50),
  ptv_label_height_mm: D(25),
  ptv_label_across: 2,
  ptv_label_down: 1,
  ptv_paper_code: 'LABEL',
  ptv_body: '{"bands":[]}',
};

const built = (itemId: string, lotId: string, labels: number): BuiltStickerLine =>
  ({
    line: {
      key: '1',
      itemId,
      itemName: `ZT ${itemId}`,
      itemNameTa: null,
      itemCode: null,
      unitId: `def-${itemId}`,
      unitName: 'PCS',
      isDefaultUnit: true,
      barcode: '8901234567890',
      barcodeSource: 'UNIT',
      lotId,
      batchNo: 'B1',
      mfgDate: null,
      expiryDate: null,
      lotRequired: false,
      lotCount: 1,
      mrp: 165,
      price: 96.2,
      priceLevel: 2,
      costCode: null,
      priceCode: null,
      templateId: TEMPLATE,
      templateName: 'SAMPLE item 50 × 25',
      designSource: 'JOB',
      designHasBarcode: true,
      labelWidthMm: 50,
      labelHeightMm: 25,
      labelsAcross: 2,
      labelsDown: 1,
      paperCode: 'LABEL',
      labels,
      stockQty: 12,
      lastPrintedOn: null,
      lastPrintedLabels: null,
      problem: null,
    },
    facts: {
      mrp: D(165),
      price: D('96.20'),
      cost: null,
      versionId: 'ver-1',
      brand: null,
      groupName: null,
      size: null,
      colour: null,
      model: null,
      priceLevelShort: 'RET',
      unitHasDecimals: false,
      supplierCode: 'ZSS',
    },
  }) as BuiltStickerLine;

const docJob = (over: Record<string, unknown> = {}) => ({
  lbj_id: 'job-doc',
  lbj_acc_year: YEAR,
  lbj_company_id: COMPANY,
  lbj_branch_id: BRANCH,
  lbj_device_id: DEVICE,
  lbj_refno: 'D8-000010',
  lbj_purpose_id: 'ppo-item',
  lbj_template_id: TEMPLATE,
  lbj_version_id: 'ver-1',
  lbj_printer_name: 'ZT-PRN',
  lbj_printer_dpi: 203,
  lbj_price_level: 2,
  lbj_start_at: 1,
  lbj_kind: 'PRINT',
  lbj_reprint_of_id: null,
  lbj_reprint_of_acc_year: null,
  lbj_resend_of_id: null,
  lbj_resend_of_acc_year: null,
  lbj_reason_code: null,
  lbj_reason_note: null,
  lbj_line_count: 1,
  lbj_label_count: 20,
  lbj_page_count: 10,
  lbj_status: 'PRINTED',
  lbj_status_on: null,
  lbj_printer_message: null,
  lbj_printed_on: new Date('2026-11-26T05:00:00Z'),
  lbj_printed_by: 'user-1',
  lbj_src_kind: 'DOCUMENT',
  lbj_src_doc_type: 'PURCHASE_BILL',
  lbj_src_doc_id: BILL,
  lbj_src_acc_year: YEAR,
  lbj_src_refno: 'PUR/2026-2027/D8/01177',
  ...over,
});

const docJobLine = {
  lbjl_id: 'line-doc-1',
  lbjl_line_no: 1,
  lbjl_item_id: 'OIL',
  lbjl_unit_id: 'def-OIL',
  lbjl_lot_id: 'lotO',
  lbjl_barcode: '8901234567890',
  lbjl_mrp: D('165.00'),
  lbjl_price: D('96.20'),
  lbjl_batch_no: 'B1',
  lbjl_mfg_date: null,
  lbjl_expiry_date: null,
  lbjl_cost_code: null,
  lbjl_price_code: null,
  lbjl_labels: 20,
  lbjl_reprint_of_line_id: null,
  lbjl_src_line_id: 'L2',
  lot_supplier_id: 'sup-lot',
  supplier_code: 'ZSS',
  item_name: 'ZT OIL',
  item_name_ta: null,
  item_code: null,
  brand: null,
  group_name: null,
  unit_name: 'PCS',
  size: null,
  colour: null,
  model: null,
  reprinted: 0,
};

function setup(
  world: {
    built?: BuiltStickerLine[];
    jobs?: Record<string, Record<string, unknown>>;
    lines?: Record<string, Array<Record<string, unknown>>>;
  } = {},
  docs?: Partial<StickerDocSourceService>,
) {
  const created: Array<Record<string, any>> = [];
  const txSqls: string[] = [];
  const order: string[] = [];
  const tx = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      txSqls.push(sql);
      if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve([{ locked: 1 }]);
      if (sql.includes('MAX(lbj_slno)')) {
        order.push('number');
        return Promise.resolve([{ n: 11 }]);
      }
      if (sql.includes('lbj_resend_of_id =')) return Promise.resolve([]);
      throw new Error(`tx: unexpected ${sql.slice(0, 80)}`);
    }),
    deviceMaster: {
      findFirst: jest.fn(() =>
        Promise.resolve({ devId: DEVICE, devCode: 'D8', devIsActive: true, devIsBlocked: false }),
      ),
    },
    labelJob: {
      create: jest.fn(({ data }: { data: Record<string, any> }) => {
        created.push(data);
        return Promise.resolve({
          lbjId: 'job-new',
          lines: data.lines.create.map((line: Record<string, unknown>, index: number) => ({
            lbjlId: `new-line-${index + 1}`,
            ...line,
          })),
        });
      }),
    },
    txnStatusLog: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(({ data }: { data: Record<string, any> }) => Promise.resolve(data)),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => Promise.resolve(work(tx))),
    $queryRaw: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('SELECT * FROM inventory.label_job')) {
        const job = world.jobs?.[values[0] as string];
        return Promise.resolve(job ? [job] : []);
      }
      if (sql.includes('WITH mine AS')) return Promise.resolve([]);
      if (sql.includes('FROM inventory.label_job_line l')) {
        return Promise.resolve(world.lines?.[values[values.length - 2] as string] ?? []);
      }
      if (sql.includes('lbj_resend_of_id =')) return Promise.resolve([]);
      if (sql.includes('pi_doc_date::text AS d')) {
        return Promise.resolve([{ d: '2026-11-26', short: 'ZES' }]);
      }
      if (sql.includes('FROM public.print_purpose p')) {
        return Promise.resolve([
          { purpose_code: 'ITEM_LABEL', template_name: 'SAMPLE', rev_no: 1 },
        ]);
      }
      if (sql.includes('FROM public.companys c')) {
        return Promise.resolve([{ comp_name: 'Acme', br_name: 'CBE' }]);
      }
      if (sql.includes('FROM fixed.price_levels')) return Promise.resolve([{ short: 'RET' }]);
      if (sql.includes('FROM public.fiscal_years')) return Promise.resolve([{ name: YEAR }]);
      throw new Error(`prisma: unexpected ${sql.slice(0, 80)}`);
    }),
  } as unknown as PrismaService;
  const context = {
    getUserId: () => 'user-1',
    getDeviceId: () => DEVICE,
  } as unknown as RequestContextService;
  const lines = new StickerLinesService(prisma, context, {} as PrintTemplateAssignmentService);
  jest.spyOn(lines, 'assertRight').mockResolvedValue();
  jest.spyOn(lines, 'assertBranchInCompany').mockResolvedValue();
  jest
    .spyOn(lines, 'loadPurpose')
    .mockImplementation((_company: string, code: string) =>
      Promise.resolve({ ppoId: `ppo-${code}`, ppoCode: code as 'ITEM_LABEL', ppoName: code }),
    );
  jest.spyOn(lines, 'loadDesigns').mockResolvedValue(new Map([[TEMPLATE, DESIGN]]));
  const buildLines = jest
    .spyOn(lines, 'buildLines')
    .mockResolvedValue(world.built ?? [built('OIL', 'lotO', 20)]);
  const rowsSeen: Array<Record<string, unknown>[]> = [];
  const render = {
    renderLabels: jest.fn((request: { rows: Array<{ row: Record<string, unknown> }> }) => {
      order.push('render');
      rowsSeen.push(request.rows.map((entry) => entry.row));
      return Promise.resolve({
        bytes: Buffer.from('%PDF-1.3'),
        pageCount: 10,
        startAt: 1,
        warnings: [],
      });
    }),
  } as unknown as PrintRenderService;
  const realDocs = new StickerDocSourceService(prisma, context, lines);
  const service = new StickerJobsService(
    prisma,
    context,
    lines,
    render,
    docs ? (Object.assign(realDocs, docs) as StickerDocSourceService) : realDocs,
  );
  return { service, created, rowsSeen, txSqls, order, buildLines };
}

const printBody = (over: Record<string, unknown> = {}) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  purposeCode: 'ITEM_LABEL',
  templateId: TEMPLATE,
  printerName: 'TSC TE244',
  priceLevel: 2,
  lines: [{ itemId: 'OIL', unitId: 'def-OIL', lotId: 'lotO', labels: 20, srcLineId: 'L2' }],
  source: SOURCE,
  ...over,
});

describe('StickerJobsService.print with a source (S-P2 §7.3)', () => {
  it('writes the source and srcLineId, runs the guard before the number, fills the label fields', async () => {
    let order: string[] = [];
    const guard = jest.fn((txClient: Prisma.TransactionClient) => {
      void txClient;
      order.push('guard');
      return Promise.resolve();
    });
    const prepareDocJob = jest.fn(() =>
      Promise.resolve({
        source: { ...SOURCE, refno: 'PUR/2026-2027/D8/01177' },
        head: { docDate: '2026-11-26', supplierShort: 'ZES' },
        guard,
      }),
    );
    const world = setup({}, { prepareDocJob } as unknown as Partial<StickerDocSourceService>);
    order = world.order;
    const answer = await world.service.print(printBody());
    expect(prepareDocJob).toHaveBeenCalledWith(
      expect.objectContaining({
        source: SOURCE,
        lines: [expect.objectContaining({ srcLineId: 'L2', lotId: 'lotO', labels: 20 })],
      }),
    );
    expect(guard).toHaveBeenCalledTimes(1);
    expect(world.order).toEqual(['guard', 'number', 'render']);
    // F4: the builder gets the document's supplier code for a lot with none
    expect(world.buildLines.mock.calls[0][0].docSupplierCode).toBe('ZES');
    expect(world.created[0]).toMatchObject({
      lbjSrcKind: 'DOCUMENT',
      lbjSrcDocType: 'PURCHASE_BILL',
      lbjSrcDocId: BILL,
      lbjSrcAccYear: YEAR,
      lbjSrcRefno: 'PUR/2026-2027/D8/01177',
    });
    expect(world.created[0].lines.create[0]).toMatchObject({
      lbjlSrcLineId: 'L2',
      lbjlLotId: 'lotO',
    });
    expect(answer.inspect.source).toEqual({ ...SOURCE, refno: 'PUR/2026-2027/D8/01177' });
    expect(answer.inspect.lines[0].srcLineId).toBe('L2');
    expect(world.rowsSeen[0][0]).toMatchObject({
      doc_no: 'PUR/2026-2027/D8/01177',
      doc_date: '26/11/2026',
      supplier_code: 'ZSS',
    });
  });

  it('a refusal from the document checks comes before the lines are re-resolved; no job', async () => {
    const prepareDocJob = jest.fn(() =>
      refuseSticker('STICKER_DOC_NOT_POSTED', 'x', 'docId'),
    ) as unknown as StickerDocSourceService['prepareDocJob'];
    const world = setup({}, { prepareDocJob });
    await expect(world.service.print(printBody())).rejects.toMatchObject({ status: 422 });
    expect(world.created).toHaveLength(0);
    expect(world.buildLines).not.toHaveBeenCalled();
  });

  it('a manual job: no source columns, supplier_code still from the lot, a srcLineId refused (C6)', async () => {
    const world = setup();
    const answer = await world.service.print(
      printBody({
        source: undefined,
        lines: [{ itemId: 'OIL', unitId: 'def-OIL', lotId: 'lotO', labels: 2 }],
      }),
    );
    expect(world.created[0]).not.toHaveProperty('lbjSrcKind');
    expect(world.created[0].lines.create[0]).not.toHaveProperty('lbjlSrcLineId');
    expect(answer.inspect.source).toBeNull();
    expect(answer.inspect.lines[0].srcLineId).toBeNull();
    expect(world.rowsSeen[0][0]).toMatchObject({
      doc_no: null,
      doc_date: null,
      supplier_code: 'ZSS',
    });

    const refused = setup();
    await expect(refused.service.print(printBody({ source: undefined }))).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [expect.objectContaining({ code: 'STICKER_DOC_LINE_NOT_ON_DOC', line: 1 })],
      },
    });
    expect(refused.created).toHaveLength(0);
  });
});

describe('Reprint / resend copy the source (S-P2 §4.5, §7.4)', () => {
  const lines = { 'job-doc': [docJobLine] };

  it('a reprint keeps the original’s five source columns and each line’s srcLineId', async () => {
    const world = setup({ jobs: { 'job-doc': docJob() }, lines });
    await world.service.reprint({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId: 'job-doc',
      reasonCode: 'TORN',
      printerName: 'TSC TE244',
      lines: [{ lineId: 'line-doc-1', labels: 2 }],
    });
    expect(world.created[0]).toMatchObject({
      lbjKind: 'REPRINT',
      lbjSrcKind: 'DOCUMENT',
      lbjSrcDocType: 'PURCHASE_BILL',
      lbjSrcDocId: BILL,
      lbjSrcAccYear: YEAR,
      lbjSrcRefno: 'PUR/2026-2027/D8/01177',
    });
    expect(world.created[0].lines.create[0]).toMatchObject({
      lbjlSrcLineId: 'L2',
      lbjlReprintOfLineId: 'line-doc-1',
      lbjlLabels: 2,
    });
    // no "left" check on a reprint: no document lock in its transaction
    expect(world.txSqls.some((sql) => sql.includes('hashtextextended'))).toBe(false);
    expect(world.rowsSeen[0][0]).toMatchObject({
      doc_no: 'PUR/2026-2027/D8/01177',
      doc_date: '26/11/2026',
      supplier_code: 'ZSS',
    });
  });

  it('a reprint of a line whose lot has no supplier prints the document’s supplier code (F4)', async () => {
    const world = setup({
      jobs: { 'job-doc': docJob() },
      lines: { 'job-doc': [{ ...docJobLine, lot_supplier_id: null, supplier_code: null }] },
    });
    await world.service.reprint({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId: 'job-doc',
      reasonCode: 'TORN',
      printerName: 'TSC TE244',
      lines: [{ lineId: 'line-doc-1', labels: 1 }],
    });
    expect(world.rowsSeen[0][0]).toMatchObject({ supplier_code: 'ZES' });
    // a lot WITH a supplier keeps its own, even blank (user 2026-11-26)
    const own = setup({
      jobs: { 'job-doc': docJob() },
      lines: { 'job-doc': [{ ...docJobLine, supplier_code: null }] },
    });
    await own.service.reprint({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId: 'job-doc',
      reasonCode: 'TORN',
      printerName: 'TSC TE244',
      lines: [{ lineId: 'line-doc-1', labels: 1 }],
    });
    expect(own.rowsSeen[0][0]).toMatchObject({ supplier_code: null });
  });

  it('a resend of a FAILED document job keeps its source and checks the document (F1)', async () => {
    const checkDocResend = jest.fn(() => Promise.resolve());
    const world = setup(
      {
        jobs: { 'job-doc': docJob({ lbj_status: 'FAILED' }) },
        lines: {
          'job-doc': [
            docJobLine,
            { ...docJobLine, lbjl_id: 'line-doc-2', lbjl_line_no: 2, lbjl_reprint_of_line_id: 'x' },
          ],
        },
      },
      { checkDocResend } as unknown as Partial<StickerDocSourceService>,
    );
    await world.service.resend({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId: 'job-doc',
      printerName: 'TSC TE244',
    });
    expect(world.created[0]).toMatchObject({
      lbjKind: 'PRINT',
      lbjResendOfId: 'job-doc',
      lbjSrcKind: 'DOCUMENT',
      lbjSrcDocId: BILL,
      lbjSrcRefno: 'PUR/2026-2027/D8/01177',
    });
    expect(world.created[0].lines.create[0]).toMatchObject({ lbjlSrcLineId: 'L2', lbjlLabels: 20 });
    // inside the job's transaction, after the resend lock; a reprint's copy is not checked
    expect(checkDocResend).toHaveBeenCalledTimes(1);
    expect(checkDocResend).toHaveBeenCalledWith(expect.anything(), {
      companyId: COMPANY,
      branchId: BRANCH,
      source: { ...SOURCE, refno: 'PUR/2026-2027/D8/01177' },
      lines: [
        {
          itemId: 'OIL',
          unitId: 'def-OIL',
          lotId: 'lotO',
          labels: 20,
          srcLineId: 'L2',
          itemName: 'ZT OIL',
        },
      ],
    });
    const lockAt = world.txSqls.findIndex((sql) => sql.includes("hashtext('label_job_resend')"));
    expect(lockAt).toBeGreaterThan(world.txSqls.findIndex((sql) => sql.includes('label_job_no')));
  });

  it('a resend of a MANUAL failed job has no document check', async () => {
    const checkDocResend = jest.fn(() => Promise.resolve());
    const world = setup(
      {
        jobs: {
          'job-doc': docJob({
            lbj_status: 'FAILED',
            lbj_src_kind: 'MANUAL',
            lbj_src_doc_type: null,
            lbj_src_doc_id: null,
            lbj_src_acc_year: null,
            lbj_src_refno: null,
          }),
        },
        lines: { 'job-doc': [{ ...docJobLine, lbjl_src_line_id: null }] },
      },
      { checkDocResend } as unknown as Partial<StickerDocSourceService>,
    );
    await world.service.resend({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      jobId: 'job-doc',
      printerName: 'TSC TE244',
    });
    expect(checkDocResend).not.toHaveBeenCalled();
    expect(world.created[0]).not.toHaveProperty('lbjSrcKind');
  });

  it('/jobs/get answers the source keys and lines[].srcLineId', async () => {
    const world = setup({ jobs: { 'job-doc': docJob() }, lines });
    const answer = await world.service.get({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      id: 'job-doc',
    });
    expect(answer.job).toMatchObject({
      srcKind: 'DOCUMENT',
      srcDocType: 'PURCHASE_BILL',
      srcDocId: BILL,
      srcAccYear: YEAR,
      srcRefno: 'PUR/2026-2027/D8/01177',
    });
    expect(answer.lines[0]).toMatchObject({ srcLineId: 'L2' });
    const manual = setup({
      jobs: {
        'job-doc': docJob({
          lbj_src_kind: 'MANUAL',
          lbj_src_doc_type: null,
          lbj_src_doc_id: null,
          lbj_src_acc_year: null,
          lbj_src_refno: null,
        }),
      },
      lines: { 'job-doc': [{ ...docJobLine, lbjl_src_line_id: null }] },
    });
    const plain = await manual.service.get({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: YEAR,
      id: 'job-doc',
    });
    expect(plain.job).toMatchObject({ srcKind: 'MANUAL', srcDocId: null, srcRefno: null });
    expect(plain.lines[0]).toMatchObject({ srcLineId: null });
  });
});
