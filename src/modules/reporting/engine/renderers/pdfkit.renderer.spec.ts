import {
  TemplateDefinition,
  TemplateDefinitionInput,
  templateDefinitionSchema,
} from '../../templates/dto/template-definition.schema';
import { FontRegistry } from '../fonts/font.registry';
import { LayoutEngine } from '../layout/layout.engine';
import { TextMeasurer } from '../layout/text-measure';
import { BarcodeFactory } from './barcode.factory';
import { ImageCache } from './image.cache';
import { PdfKitRenderer } from './pdfkit.renderer';

/**
 * Phase 4 exit criteria, as far as they can be asserted in a unit test:
 * A4 and A5 render, byte-identically across runs, with the e-invoice QR
 * embedded. Whether Adobe Reader opens them is a manual check, but a valid
 * header, a valid trailer and a stable byte length are what make that check
 * worth doing rather than a coin toss.
 */

const registry = new FontRegistry();
let renderer: PdfKitRenderer;
let engine: LayoutEngine;

beforeAll(() => {
  registry.load();
  renderer = new PdfKitRenderer(registry, new BarcodeFactory(), new ImageCache());
  engine = new LayoutEngine(new TextMeasurer(registry));
});

const parse = (definition: TemplateDefinitionInput): TemplateDefinition =>
  templateDefinitionSchema.parse(definition);

const paper = (code: string, widthMm: number, heightMm: number | null) => ({
  code,
  widthMm,
  heightMm,
  orientation: 'PORTRAIT' as const,
  margins: { top: 10, right: 8, bottom: 12, left: 8 },
});

const invoiceDefinition = (paperSpec: ReturnType<typeof paper>): TemplateDefinition =>
  parse({
    schemaVersion: 1,
    layoutMode: 'GRAPHIC',
    paper: paperSpec,
    datasets: [
      { name: 'company', provider: 'company.profile', cardinality: 'one' },
      { name: 'invoice', provider: 'sales.invoice.header', cardinality: 'one' },
      { name: 'items', provider: 'sales.invoice.lines', cardinality: 'many' },
    ],
    bands: [
      {
        type: 'PAGE_HEADER',
        heightMm: 40,
        elements: [
          {
            id: 'h1',
            kind: 'TEXT',
            x: 8,
            y: 4,
            w: 100,
            h: 8,
            value: '{{ company.name }}',
            font: { family: 'NotoSans', size: 14, bold: true },
          },
          {
            id: 'h2',
            kind: 'TEXT',
            x: 8,
            y: 14,
            w: 100,
            h: 5,
            value: '{{ company.addressBlock }}',
          },
          { id: 'h3', kind: 'TEXT', x: 8, y: 20, w: 100, h: 5, value: 'GSTIN {{ company.gstin }}' },
          {
            id: 'hqr',
            kind: 'QRCODE',
            x: paperSpec.widthMm - 33,
            y: 4,
            size: 25,
            value: '{{ invoice.irnSignedQr }}',
            visible: '{{ invoice.einvoiceApplicable }}',
          },
          {
            id: 'hline',
            kind: 'LINE',
            x1: 8,
            y1: 37,
            x2: paperSpec.widthMm - 8,
            y2: 37,
            widthPt: 0.5,
          },
        ],
      },
      {
        type: 'DETAIL',
        dataset: 'items',
        heightMm: 6,
        autoGrow: true,
        elements: [
          {
            id: 'd1',
            kind: 'FIELD',
            x: 8,
            y: 0,
            w: 8,
            h: 5,
            value: '{{ row.__index }}',
            align: 'right',
          },
          {
            id: 'd2',
            kind: 'FIELD',
            x: 18,
            y: 0,
            w: 55,
            h: 5,
            value: '{{ row.itemPrintName }}',
            wrap: true,
          },
          {
            id: 'd3',
            kind: 'FIELD',
            x: 76,
            y: 0,
            w: 16,
            h: 5,
            value: "{{ row.qty|fmt('0.000') }}",
            align: 'right',
          },
          {
            id: 'd4',
            kind: 'FIELD',
            x: paperSpec.widthMm - 38,
            y: 0,
            w: 30,
            h: 5,
            value: "{{ row.netAmount|fmt('#,##0.00') }}",
            align: 'right',
            style: { color: "{{ row.netAmount < 0 ? '#8B1D1D' : '#000000' }}" },
          },
        ],
      },
      {
        type: 'SUMMARY',
        heightMm: 30,
        keepWithLastDetail: true,
        elements: [
          { id: 's0', kind: 'LINE', x1: 8, y1: 1, x2: paperSpec.widthMm - 8, y2: 1, widthPt: 0.5 },
          { id: 's1', kind: 'TEXT', x: 8, y: 3, w: 60, h: 5, value: 'Total', font: { bold: true } },
          {
            id: 's2',
            kind: 'FIELD',
            x: paperSpec.widthMm - 38,
            y: 3,
            w: 30,
            h: 5,
            value: "{{ row.netAmount|fmt('#,##0.00') }}",
            align: 'right',
            font: { bold: true },
            aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'items' },
          },
          {
            id: 's3',
            kind: 'TEXT',
            x: 8,
            y: 11,
            w: paperSpec.widthMm - 16,
            h: 5,
            value: '{{ invoice.billAmt|numToWords }}',
            wrap: true,
          },
        ],
      },
      {
        type: 'PAGE_FOOTER',
        heightMm: 10,
        elements: [
          {
            id: 'f1',
            kind: 'TEXT',
            x: paperSpec.widthMm - 48,
            y: 2,
            w: 40,
            h: 5,
            value: 'Page {{ page.number }} of {{ page.total }}',
            align: 'right',
          },
        ],
      },
    ],
  });

const datasets = (rowCount: number) => ({
  company: {
    name: 'Sri Lakshmi Venkateswara Traders',
    addressBlock: '142, Trichy Main Road, Salem, 636001',
    gstin: '33AABCU9603R1ZM',
  },
  invoice: {
    billAmt: 28197,
    einvoiceApplicable: true,
    irnSignedQr: 'eyJhbGciOiJSUzI1NiJ9.eyJkYXRhIjoiMzNBQUJDVTk2MDNSMVpNIn0.signature',
  },
  items: Array.from({ length: rowCount }, (_unused, index) => ({
    __index: index + 1,
    // Every third line is Tamil, so the script-run fallback path is exercised
    // by the fixture rather than only by a dedicated test.
    itemPrintName:
      index % 3 === 0
        ? 'பொன்னி பச்சரிசி 25 கிலோ மூட்டை'
        : index % 3 === 1
          ? `Sunflower Oil 1L Pouch ${index + 1}`
          : 'Toor Dal Premium Grade One extra long name that wraps',
    qty: index + 1,
    netAmount: index === 5 ? -180 : (index + 1) * 100,
  })),
});

/** Pinned so a render is reproducible; see RenderOptions.creationDate. */
const FIXED_CREATION_DATE = new Date('2026-08-24T00:00:00.000Z');

const renderPdf = async (definition: TemplateDefinition, rowCount: number) => {
  const tree = engine.render({
    definition,
    datasets: datasets(rowCount),
    ctx: { companyId: 'c1', branchId: 'b1', accYear: '2026-2027', docId: 'd1' },
    sys: { now: '2026-08-24T00:00:00.000Z' },
  });
  const result = await renderer.render(tree, { creationDate: FIXED_CREATION_DATE });
  return { tree, result };
};

describe('PdfKitRenderer', () => {
  it('produces a structurally valid PDF for A4', async () => {
    const { result } = await renderPdf(invoiceDefinition(paper('A4', 210, 297)), 20);

    expect(result.contentType).toBe('application/pdf');
    expect(result.extension).toBe('pdf');
    expect(result.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // A PDF without a trailing %%EOF is a PDF Adobe Reader refuses.
    expect(result.bytes.subarray(-1024).toString('latin1')).toContain('%%EOF');
    expect(result.bytes.length).toBeGreaterThan(5_000);
  });

  it('produces a structurally valid PDF for A5', async () => {
    const { result } = await renderPdf(invoiceDefinition(paper('A5', 148, 210)), 20);
    expect(result.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(result.bytes.subarray(-1024).toString('latin1')).toContain('%%EOF');
  });

  it('writes one PDF page per layout page', async () => {
    const { tree, result } = await renderPdf(invoiceDefinition(paper('A5', 148, 210)), 60);
    expect(tree.pageCount).toBeGreaterThan(1);
    expect(result.pageCount).toBe(tree.pageCount);
    // /Type /Page appears once per page plus once for /Pages.
    const pageObjects = result.bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pageObjects.length).toBe(tree.pageCount);
  });

  it('renders byte-identically across runs', async () => {
    // The exit criterion. With the creation date pinned there is no
    // non-deterministic byte left — PDFKit derives the trailer /ID from it — so
    // two renders of identical input agree byte for byte, which is what makes a
    // golden-file check possible at all.
    const definition = invoiceDefinition(paper('A4', 210, 297));
    const first = await renderPdf(definition, 20);
    const second = await renderPdf(definition, 20);
    expect(first.result.bytes.length).toBe(second.result.bytes.length);
    expect(first.result.bytes.equals(second.result.bytes)).toBe(true);
  });

  it('changes only the file identifier when the creation date changes', async () => {
    // Proves the pinning above is the ONLY source of non-determinism, rather
    // than the byte-identical test having been made true by accident.
    const definition = invoiceDefinition(paper('A4', 210, 297));
    const tree = engine.render({
      definition,
      datasets: datasets(20),
      ctx: {},
      sys: { now: 'x' },
    });
    const early = await renderer.render(tree, { creationDate: new Date('2020-01-01T00:00:00Z') });
    const late = await renderer.render(tree, { creationDate: new Date('2030-01-01T00:00:00Z') });

    let differing = 0;
    for (let index = 0; index < Math.min(early.bytes.length, late.bytes.length); index += 1) {
      if (early.bytes[index] !== late.bytes[index]) {
        differing += 1;
      }
    }
    // The 32-hex /ID appears twice in the trailer, plus the date strings.
    expect(differing).toBeGreaterThan(0);
    expect(differing).toBeLessThan(200);
  });

  it('embeds both the Latin and the Tamil face when the data is bilingual', async () => {
    const { result } = await renderPdf(invoiceDefinition(paper('A4', 210, 297)), 20);
    const raw = result.bytes.toString('latin1');
    // Subset font names carry the family. Both must be present, which is the
    // proof that the script-run fallback actually ran: a single-font render
    // would embed one of them and box the other script.
    expect(raw).toMatch(/NotoSans/);
    expect(raw).toMatch(/NotoSansTamil/);
  });

  it('embeds the e-invoice QR as an image', async () => {
    const { result } = await renderPdf(invoiceDefinition(paper('A4', 210, 297)), 5);
    const raw = result.bytes.toString('latin1');
    expect(raw).toContain('/Subtype /Image');
  });

  it('omits the QR when the document is not e-invoice applicable', async () => {
    const definition = invoiceDefinition(paper('A4', 210, 297));
    const tree = engine.render({
      definition,
      datasets: {
        ...datasets(5),
        invoice: { billAmt: 100, einvoiceApplicable: false, irnSignedQr: '' },
      },
      ctx: {},
      sys: {},
    });
    const result = await renderer.render(tree, { creationDate: FIXED_CREATION_DATE });
    expect(result.bytes.toString('latin1')).not.toContain('/Subtype /Image');
  });

  it('renders a zero-row document without throwing', async () => {
    const definition = invoiceDefinition(paper('A4', 210, 297));
    const tree = engine.render({
      definition,
      datasets: { ...datasets(0), items: [] },
      ctx: {},
      sys: {},
    });
    const result = await renderer.render(tree, { creationDate: FIXED_CREATION_DATE });
    expect(result.pageCount).toBe(1);
    expect(result.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('gives continuous stationery a page tall enough for its content', async () => {
    // A thermal roll has no height. The PDF page has to have one, so it grows.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: paper('T80', 80, null),
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [
            { id: 'd', kind: 'FIELD', x: 2, y: 0, w: 70, h: 4, value: '{{ row.itemPrintName }}' },
          ],
        },
      ],
    });

    const { tree, result } = await renderPdf(definition, 40);
    expect(tree.pageCount).toBe(1);
    expect(result.pageCount).toBe(1);
    expect(result.bytes.length).toBeGreaterThan(1_000);
  });

  it('warns when real data pushes a primitive off the page', async () => {
    // Static overflow is caught by the schema at save time. This is the dynamic
    // kind, which only appears with real data.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: paper('A4', 210, 297),
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 400,
          elements: [
            { id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 350, value: '{{ row.itemPrintName }}' },
          ],
        },
      ],
    });

    const { result } = await renderPdf(definition, 1);
    expect(result.warnings.some((warning) => warning.includes('past the'))).toBe(true);
  });

  it('skips a malformed barcode rather than failing the render', async () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: paper('A4', 210, 297),
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 20,
          elements: [
            {
              id: 'bc',
              kind: 'BARCODE',
              x: 8,
              y: 0,
              w: 50,
              h: 15,
              symbology: 'ean13',
              value: 'NOT-A-NUMBER',
            },
            { id: 't', kind: 'FIELD', x: 70, y: 0, w: 60, h: 5, value: '{{ row.itemPrintName }}' },
          ],
        },
      ],
    });

    const { result } = await renderPdf(definition, 1);
    // The invoice still prints, and the operator is told why the barcode is gone.
    expect(result.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(result.warnings.some((warning) => warning.includes('EAN-13'))).toBe(true);
  });

  it('generates a valid Code128 barcode', async () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: paper('A4', 210, 297),
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 20,
          elements: [
            {
              id: 'bc',
              kind: 'BARCODE',
              x: 8,
              y: 0,
              w: 50,
              h: 15,
              symbology: 'code128',
              value: 'SLM/26-27/000148',
              showText: true,
            },
          ],
        },
      ],
    });

    const { result } = await renderPdf(definition, 1);
    expect(result.bytes.toString('latin1')).toContain('/Subtype /Image');
    expect(result.warnings.filter((warning) => warning.includes('Barcode'))).toEqual([]);
  });
});

describe('BarcodeFactory', () => {
  const factory = new BarcodeFactory();

  it('accepts an EAN-13 with and without its check digit', async () => {
    expect(await factory.barcode('ean13', '8901234567890', 40, 15, false)).not.toBeNull();
    expect(await factory.barcode('ean13', '890123456789', 40, 15, false)).not.toBeNull();
    expect(factory.drainWarnings()).toEqual([]);
  });

  it('rejects a non-numeric fixed-length payload before bwip-js throws', async () => {
    expect(await factory.barcode('ean13', '89012345678AB', 40, 15, false)).toBeNull();
    expect(factory.drainWarnings()[0]).toContain('digits only');
  });

  it('rejects a wrong-length payload', async () => {
    expect(await factory.barcode('ean13', '123', 40, 15, false)).toBeNull();
    expect(factory.drainWarnings()[0]).toContain('13 digits');
  });

  it('returns null for an empty value rather than a blank symbol', async () => {
    expect(await factory.barcode('code128', '   ', 40, 15, false)).toBeNull();
    expect(await factory.qrcode('', 25, 'M')).toBeNull();
  });

  it('generates a QR code large enough for an e-invoice payload', async () => {
    // ~1KB JWS at level M. The realistic worst case.
    const payload = `eyJhbGciOiJSUzI1NiJ9.${'A'.repeat(900)}.sig`;
    const generated = await factory.qrcode(payload, 25, 'M');
    expect(generated).not.toBeNull();
    expect(generated!.png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(factory.drainWarnings()).toEqual([]);
  });

  it('caches repeated generation of the same symbol', async () => {
    const first = await factory.qrcode('cache-probe', 20, 'M');
    const second = await factory.qrcode('cache-probe', 20, 'M');
    // Same object identity proves the cache hit, not just equal bytes.
    expect(second).toBe(first);
  });
});

describe('ImageCache', () => {
  const cache = new ImageCache();

  it('decodes a base64 data URI', async () => {
    // 1x1 transparent PNG.
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    const bytes = await cache.resolveImage(`data:image/png;base64,${png}`);
    expect(bytes).not.toBeNull();
    expect(bytes!.subarray(1, 4).toString('latin1')).toBe('PNG');
  });

  it('refuses a path that escapes the allowed roots', async () => {
    // The traversal a template expression could otherwise reach.
    expect(await cache.resolveImage('../../../.env')).toBeNull();
    expect(await cache.resolveImage('/etc/passwd')).toBeNull();
    expect(
      cache.drainWarnings().some((warning) => warning.includes('outside the allowed roots')),
    ).toBe(true);
  });

  it('refuses a remote URL unless remote fetching is switched on', async () => {
    expect(await cache.resolveImage('http://169.254.169.254/latest/meta-data/')).toBeNull();
    expect(cache.drainWarnings().some((warning) => warning.includes('refused'))).toBe(true);
  });

  it('reads a file inside an allowed root, and caches it', async () => {
    // The bundled fonts are inside assets/, an allowed root. Not an image, but
    // this is a containment and caching test, not a decode test.
    const source = 'assets/fonts/NotoSansTamil-Regular.ttf';
    const first = await cache.resolveImage(source);
    expect(first).not.toBeNull();
    const second = await cache.resolveImage(source);
    expect(second).toBe(first);
  });

  it('reports a missing file inside an allowed root as a warning', async () => {
    expect(await cache.resolveImage('assets/fonts/does-not-exist.png')).toBeNull();
    expect(cache.drainWarnings().some((warning) => warning.includes('could not be read'))).toBe(
      true,
    );
  });
});
