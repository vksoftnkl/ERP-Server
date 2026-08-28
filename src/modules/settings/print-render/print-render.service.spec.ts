import { Prisma, PrintTemplateDataset, PrintTemplateVersion } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { PrintTemplateAssignmentService } from '../print-template-assignment/print-template-assignment.service';
import { loadCanvasFixture } from './__fixtures__/load-fixture';
import { DatasetRunnerService } from './data/dataset-runner.service';
import { FontRegistry } from './engine/fonts/font.registry';
import { LayoutEngine } from './engine/layout/layout.engine';
import { TextMeasurer } from './engine/layout/text-measure';
import { EscPRenderer } from './engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from './engine/renderers/grid/escpos.renderer';
import { BarcodeFactory } from './engine/renderers/barcode.factory';
import { ImageCache } from './engine/renderers/image.cache';
import { PdfKitRenderer } from './engine/renderers/pdfkit.renderer';
import { PrintLogService } from './print-log.service';
import { PrintRenderService } from './print-render.service';

/**
 * The whole sequence, from a STORED BODY to bytes.
 *
 * The engine has its own fixtures and its own hundred-odd tests; what this file
 * proves is the part that is new — that a row of `print_template_version`,
 * holding a body the CANVAS produced, comes out of this service as a PDF or an
 * ESC/POS stream, with the version's page and the version's datasets and not
 * the body's.
 *
 * The two designs are the client's own, copied from
 * `ERP client/features/print-designer/lib/__fixtures__/`. Nothing here reaches
 * a database: the dataset runner is stubbed with rows of the shape its queries
 * would return, because what is under test is the render, not the SQL.
 */

const decimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

interface FixtureShape {
  bands: unknown[];
  datasets: { name: string; cardinality: 'one' | 'many' }[];
  paper: { code: string; widthMm: number; heightMm: number | null; columns?: number };
}

function versionFor(
  fixture: FixtureShape,
  overrides: Partial<PrintTemplateVersion> = {},
): PrintTemplateVersion {
  const isGrid = fixture.paper.heightMm === null;
  return {
    ptvId: '0196-version',
    ptvTemplateId: '0196-template',
    ptvRevNo: 3,
    ptvStatus: 'PUBLISHED',
    ptvEngine: isGrid ? 'ESCPOS_TEXT' : 'JSON_BANDS',
    ptvBody: JSON.stringify({ bands: fixture.bands }),
    ptvSchemaVer: 1,
    ptvPaperCode: fixture.paper.code,
    ptvOrientation: 'PORTRAIT',
    ptvWidthMm: decimal(fixture.paper.widthMm),
    ptvHeightMm: fixture.paper.heightMm === null ? null : decimal(fixture.paper.heightMm),
    ptvMarginTopMm: decimal(6),
    ptvMarginBottomMm: decimal(6),
    ptvMarginLeftMm: decimal(6),
    ptvMarginRightMm: decimal(6),
    ptvColumns: fixture.paper.columns ?? null,
    ptvLang: 'en-IN',
    ptvFontFamily: null,
    ptvParams: null,
    ptvNote: null,
    ptvApprovedOn: new Date('2026-08-01T00:00:00Z'),
    ptvApprovedBy: null,
    ptvIsDeleted: false,
    ptvSyncDate: null,
    ptvCreatedOn: new Date('2026-08-01T00:00:00Z'),
    ptvCreatedBy: null,
    ptvModifiedOn: null,
    ptvModifiedBy: null,
    ...overrides,
  } as PrintTemplateVersion;
}

function datasetsFor(fixture: FixtureShape): PrintTemplateDataset[] {
  return fixture.datasets.map((entry, index) => ({
    ptdId: `0196-dataset-${index}`,
    ptdVersionId: '0196-version',
    ptdRole: entry.cardinality === 'one' ? 'MASTER' : 'DETAIL',
    // Only one MASTER is allowed per version (ux_ptd_one_master), and the
    // master is dataset 0 and nothing else is (ck_ptd_master_is_zero). The
    // fixture has three cardinality-one bindings, so the first is the master
    // and the rest are DETAIL bindings that happen to hold one row.
    ptdDatasetNo: index,
    ptdSortOrder: index,
    ptdName: entry.name,
    ptdLabel: null,
    ptdSourceKind: 'PROVIDER',
    ptdProviderCode: `test.${entry.name}`,
    ptdSql: null,
    ptdSqlNorm: null,
    ptdRequiresCompany: true,
    ptdParentNo: null,
    ptdLinkFields: null,
    ptdRowLimit: 5000,
    ptdTimeoutMs: 15000,
    ptdRemarks: null,
    ptdIsDeleted: false,
    ptdSyncDate: null,
    ptdCreatedOn: new Date('2026-08-01T00:00:00Z'),
    ptdCreatedBy: null,
    ptdModifiedOn: null,
    ptdModifiedBy: null,
  })) as PrintTemplateDataset[];
}

/** Rows of the shape the shipped providers return, so expressions find fields. */
const SAMPLE_DATA: Record<string, unknown> = {
  company: {
    company_name: 'Vknex Traders',
    address_block: '14 Bazaar Street, Namakkal, Tamil Nadu, 637001',
    gstin: '33AABCU9603R1ZM',
    phone: '04286 234567',
    state: 'Tamil Nadu',
    state_code: '33',
  },
  branch: { branch_name: 'Main Counter', address_block: '14 Bazaar Street, Namakkal' },
  invoice: {
    bill_refno: 'INV/2026/00417',
    bill_date: '2026-08-27',
    cust_name: 'Sri Lakshmi Stores',
    cust_addr: '5 Big Street, Salem',
    cust_gstin: '33AAGCS1234M1Z5',
    cust_state_code: '33',
    pos_state_code: '33',
    is_interstate: false,
    taxable_amt: 12_500,
    cgst_amt: 1_125,
    sgst_amt: 1_125,
    igst_amt: 0,
    tax_amt: 2_250,
    round_off: 0.25,
    bill_amt: 14_750.25,
    tot_items: 3,
  },
  items: [
    {
      line_no: 1,
      item_name: 'Sona Masoori Rice 25kg',
      hsn_code: '10063020',
      unit_name: 'BAG',
      net_qty: 4,
      rate: 1_450,
      taxable_amt: 5_800,
      tax_perc: 18,
      cgst_perc: 9,
      sgst_perc: 9,
      net_amt: 6_844,
    },
    {
      line_no: 2,
      item_name: 'Groundnut Oil 5L',
      hsn_code: '15081000',
      unit_name: 'TIN',
      net_qty: 6,
      rate: 850,
      taxable_amt: 5_100,
      tax_perc: 18,
      cgst_perc: 9,
      sgst_perc: 9,
      net_amt: 6_018,
    },
    {
      line_no: 3,
      item_name: 'Toor Dal 1kg',
      hsn_code: '07136000',
      unit_name: 'PKT',
      net_qty: 20,
      rate: 80,
      taxable_amt: 1_600,
      tax_perc: 5,
      cgst_perc: 2.5,
      sgst_perc: 2.5,
      net_amt: 1_680,
    },
  ],
  taxes: [
    { hsn_code: '10063020', tax_perc: 18, taxable_amt: 5_800, cgst_amt: 522, sgst_amt: 522 },
    { hsn_code: '15081000', tax_perc: 18, taxable_amt: 5_100, cgst_amt: 459, sgst_amt: 459 },
    { hsn_code: '07136000', tax_perc: 5, taxable_amt: 1_600, cgst_amt: 40, sgst_amt: 40 },
  ],
};

function buildService(options: {
  version: PrintTemplateVersion;
  datasets: PrintTemplateDataset[];
}): { service: PrintRenderService; logged: unknown[] } {
  const fonts = new FontRegistry();
  fonts.load();
  const measurer = new TextMeasurer(fonts);
  const layout = new LayoutEngine(measurer);
  const images = new ImageCache();
  const barcodes = new BarcodeFactory();

  const prisma = {
    printTemplateVersion: {
      findFirst: () =>
        Promise.resolve({
          ...options.version,
          template: {
            ptlId: '0196-template',
            ptlCompanyId: 'company-1',
            ptlCode: 'SALE_INVOICE_TEST',
            ptlName: 'Tax Invoice — test',
          },
          datasets: options.datasets,
        }),
    },
  } as unknown as PrismaService;

  const datasetRunner = {
    run: () =>
      Promise.resolve({
        data: SAMPLE_DATA,
        resolved: Object.keys(SAMPLE_DATA).map((name, index) => ({
          name,
          datasetNo: index,
          role: Array.isArray(SAMPLE_DATA[name]) ? ('DETAIL' as const) : ('MASTER' as const),
          sourceKind: 'PROVIDER' as const,
          value: SAMPLE_DATA[name],
          rowCount: Array.isArray(SAMPLE_DATA[name]) ? (SAMPLE_DATA[name] as unknown[]).length : 1,
          durationMs: 1,
          truncated: false,
        })),
        warnings: [],
      }),
  } as unknown as DatasetRunnerService;

  const logged: unknown[] = [];
  const printLog = {
    currentAccYear: () => Promise.resolve('2026-2027'),
    record: (entries: unknown[]) => {
      logged.push(...entries);
      return Promise.resolve(entries.map((_entry, index) => `log-${index}`));
    },
  } as unknown as PrintLogService;

  const service = new PrintRenderService(
    prisma,
    datasetRunner,
    {} as unknown as PrintTemplateAssignmentService,
    printLog,
    layout,
    new PdfKitRenderer(fonts, barcodes, images),
    new EscPosRenderer(),
    new EscPRenderer(),
  );

  return { service, logged };
}

const context = {
  companyId: 'company-1',
  branchId: null,
  accYear: '2026-2027',
  docId: '0196-bill',
  userId: 'user-1',
  deviceId: null,
};

describe('PrintRenderService.preview — a page design', () => {
  const fixture = loadCanvasFixture('gst-invoice-a4') as FixtureShape;

  it('renders a stored GST A4 invoice body as a PDF', async () => {
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    const outcome = await service.preview({ versionId: '0196-version', context, params: {} });

    // A PDF, by its own header bytes rather than by what we asked for.
    expect(outcome.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(outcome.contentType).toBe('application/pdf');
    expect(outcome.outputMode).toBe('PDF');
    expect(outcome.pageCount).toBeGreaterThanOrEqual(1);
    expect(outcome.detailRows).toBeGreaterThan(0);
    expect(outcome.bytes.length).toBeGreaterThan(1_000);
  });

  it('lays out each copy separately, so every copy carries its own label', async () => {
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    const outcome = await service.preview({
      versionId: '0196-version',
      context,
      params: {},
      copies: 3,
      copyLabels: ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
    });

    expect(outcome.copies).toBe(3);
    expect(outcome.copyLabels).toEqual(['ORIGINAL', 'DUPLICATE', 'TRIPLICATE']);
    expect(outcome.pagesPerCopy).toHaveLength(3);
    // The copies are one stream: three copies of a one-page invoice is a
    // three-page document, which is what the paper tray sees.
    expect(outcome.pageCount).toBe(outcome.pagesPerCopy.reduce((sum, count) => sum + count, 0));
  });

  it('runs out of labels rather than inventing one', async () => {
    // A fourth copy of a three-label invoice is still a copy. It prints with no
    // label instead of a wrong one.
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    const outcome = await service.preview({
      versionId: '0196-version',
      context,
      params: {},
      copies: 4,
      copyLabels: ['ORIGINAL', 'DUPLICATE'],
    });

    expect(outcome.copyLabels).toEqual(['ORIGINAL', 'DUPLICATE', '', '']);
  });

  it("treats the seed's 'NA' label as saying nothing, not as a label", async () => {
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    const outcome = await service.preview({
      versionId: '0196-version',
      context,
      params: {},
      copies: 1,
      copyLabels: ['NA'],
    });

    expect(outcome.copyLabels).toEqual(['']);
  });

  it('refuses to draw a page design on a character grid', async () => {
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    await expect(
      service.preview({
        versionId: '0196-version',
        context,
        params: {},
        outputMode: 'ESCPOS',
      }),
    ).rejects.toThrow(/cannot be rendered as ESCPOS/);
  });

  it('refuses an unsaved body against a published revision', async () => {
    // A live revision is frozen so print_log's reference to it stays true.
    // Previewing something else against it would put a picture in front of the
    // operator that no document will ever match.
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    await expect(
      service.preview({
        versionId: '0196-version',
        context,
        params: {},
        body: { bands: fixture.bands },
      }),
    ).rejects.toThrow(/can only be previewed as it stands/);
  });

  it('previews an unsaved body against a DRAFT, with the paper still from the version', async () => {
    const { service } = buildService({
      version: versionFor(fixture, { ptvStatus: 'DRAFT' }),
      datasets: datasetsFor(fixture),
    });

    const outcome = await service.preview({
      versionId: '0196-version',
      context,
      params: {},
      // The canvas round-trips its own copy of the page for readability. Here
      // it disagrees with the revision, and loses: a preview that changed the
      // stationery would stop describing the design it is labelled as.
      body: { bands: fixture.bands, paper: { code: 'T80', widthMm: 80, heightMm: null } },
    });

    expect(outcome.paperCode).toBe('A4');
    expect(outcome.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('refuses a design whose elements do not fit the page the revision names', async () => {
    // The A4 fixture positioned on A5: the schema measures every element
    // against the page, so a design that would print off the edge is refused
    // rather than silently clipped at the margin.
    const { service } = buildService({
      version: versionFor(fixture, {
        ptvPaperCode: 'A5',
        ptvWidthMm: decimal(148),
        ptvHeightMm: decimal(210),
      }),
      datasets: datasetsFor(fixture),
    });

    await expect(
      service.preview({ versionId: '0196-version', context, params: {} }),
    ).rejects.toThrow(/cannot be rendered as it stands/);
  });
});

describe('PrintRenderService.preview — a character-grid design', () => {
  const fixture = loadCanvasFixture('thermal-receipt-t80') as FixtureShape;

  it('renders a stored T80 receipt body as an ESC/POS stream', async () => {
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    const outcome = await service.preview({ versionId: '0196-version', context, params: {} });

    expect(outcome.outputMode).toBe('ESCPOS');
    expect(outcome.contentType).toBe('application/octet-stream');
    // ESC @ — the initialise sequence every ESC/POS job opens with.
    expect(outcome.bytes.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    expect(outcome.bytes.length).toBeGreaterThan(100);
  });

  it('refuses to drive a thermal design onto a sheet of A4', async () => {
    const { service } = buildService({
      version: versionFor(fixture),
      datasets: datasetsFor(fixture),
    });

    await expect(
      service.preview({ versionId: '0196-version', context, params: {}, outputMode: 'PDF' }),
    ).rejects.toThrow(/cannot be rendered as PDF/);
  });
});
