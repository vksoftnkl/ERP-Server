import { TemplateDefinitionInput } from '../dto/template-definition.schema';

/**
 * A4 GST tax invoice — the default sale-invoice design.
 *
 * Authored in TypeScript rather than checked in as raw JSON, for two reasons:
 * the arithmetic that keeps the column grid consistent (see COLUMNS below) is
 * worth expressing once instead of transcribing into forty x-coordinates, and
 * the zod schema then typechecks the whole thing at build time rather than at
 * seed time.
 *
 * ── What the layout has to satisfy ──────────────────────────────────────────
 * Rule 46 of the CGST Rules fixes most of this design. A tax invoice must
 * carry the supplier's name/address/GSTIN, an invoice number from a consecutive
 * series, the date, the recipient's name/address/GSTIN, the place of supply,
 * the HSN code, the taxable value per line, the rate and amount of tax broken
 * into CGST/SGST or IGST, and a signature. The HSN/rate summary block near the
 * bottom is the part most templates get wrong by omitting.
 *
 * ── Why two DETAIL bands ────────────────────────────────────────────────────
 * One over `items` for the line grid, one over `taxes` for the HSN/rate
 * summary. The layout engine emits bands in declaration order, so these are two
 * sequential sections rather than a subreport.
 */

/**
 * The column grid, in millimetres from the page's left edge.
 *
 * Derived rather than hand-typed: `x` is the running sum of the widths before
 * it, so changing one column's width shifts everything after it correctly. A
 * hand-typed grid is how an amount column ends up 0.5mm inside the one before
 * it and every invoice prints with the rate touching the quantity.
 */
const LEFT_MARGIN = 8;
const RIGHT_MARGIN = 8;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN; // 194mm

interface Column {
  readonly key: string;
  readonly label: string;
  readonly widthMm: number;
  readonly align: 'left' | 'center' | 'right';
}

const COLUMN_SPEC: readonly Column[] = [
  { key: 'sl', label: 'S.No', widthMm: 8, align: 'right' },
  { key: 'item', label: 'Description of Goods', widthMm: 62, align: 'left' },
  { key: 'hsn', label: 'HSN', widthMm: 16, align: 'left' },
  { key: 'qty', label: 'Qty', widthMm: 16, align: 'right' },
  { key: 'uom', label: 'UOM', widthMm: 12, align: 'left' },
  { key: 'rate', label: 'Rate', widthMm: 18, align: 'right' },
  { key: 'disc', label: 'Disc', widthMm: 15, align: 'right' },
  { key: 'taxable', label: 'Taxable', widthMm: 19, align: 'right' },
  { key: 'gst', label: 'GST%', widthMm: 11, align: 'right' },
  { key: 'amount', label: 'Amount', widthMm: 17, align: 'right' },
];

/** Column geometry with the running x resolved. */
const COLUMNS = (() => {
  let cursor = LEFT_MARGIN;
  const resolved = COLUMN_SPEC.map((column) => {
    const entry = { ...column, x: cursor };
    cursor += column.widthMm;
    return entry;
  });

  const total = cursor - LEFT_MARGIN;
  if (Math.abs(total - CONTENT_WIDTH) > 0.001) {
    // A build-time failure beats a clipped invoice at a customer's counter.
    throw new Error(
      `A4 GST invoice column widths total ${total}mm, expected ${CONTENT_WIDTH}mm. ` +
        'Adjust COLUMN_SPEC so the grid fills the content width exactly.',
    );
  }

  return resolved;
})();

const column = (key: string) => {
  const found = COLUMNS.find((candidate) => candidate.key === key);
  if (!found) {
    throw new Error(`Unknown A4 invoice column '${key}'`);
  }
  return found;
};

// ── Vertical bands, millimetres ────────────────────────────────────────────
const HEADER_HEIGHT = 68;
const DETAIL_HEIGHT = 5.5;
const TAX_ROW_HEIGHT = 5;
const SUMMARY_HEIGHT = 62;
const FOOTER_HEIGHT = 8;

const FONT_BASE = { family: 'NotoSans', size: 8 } as const;
const FONT_SMALL = { family: 'NotoSans', size: 6.5 } as const;
const FONT_LABEL = { family: 'NotoSans', size: 7 } as const;

export const GST_INVOICE_A4_NAME = 'GST Tax Invoice — A4';

export const buildGstInvoiceA4 = (): TemplateDefinitionInput => ({
  schemaVersion: 1,
  layoutMode: 'GRAPHIC',
  meta: {
    gallery: 'gst-invoice-a4',
    description:
      'Rule 46 compliant A4 tax invoice with HSN/rate summary, amount in words, ' +
      'e-invoice QR and a signature block.',
  },
  paper: {
    code: 'A4',
    widthMm: PAGE_WIDTH,
    heightMm: 297,
    orientation: 'PORTRAIT',
    margins: { top: 8, right: RIGHT_MARGIN, bottom: 10, left: LEFT_MARGIN },
  },
  datasets: [
    { name: 'company', provider: 'company.profile', cardinality: 'one' },
    { name: 'branch', provider: 'branch.profile', cardinality: 'one' },
    { name: 'invoice', provider: 'sales.invoice.header', cardinality: 'one' },
    { name: 'items', provider: 'sales.invoice.lines', cardinality: 'many' },
    { name: 'taxes', provider: 'sales.invoice.taxSummary', cardinality: 'many' },
  ],
  bands: [
    // ─── Page header: letterhead, document identity, parties, grid head ───
    {
      type: 'PAGE_HEADER',
      heightMm: HEADER_HEIGHT,
      printOn: 'ALL_PAGES',
      elements: [
        // Outer frame. Drawn first, with z 0, so everything paints over it.
        {
          id: 'frame',
          kind: 'RECT',
          z: 0,
          x: LEFT_MARGIN,
          y: 0,
          w: CONTENT_WIDTH,
          h: HEADER_HEIGHT - 4,
          style: { stroke: '#000000', strokeWidthPt: 0.7 },
        },

        // Title, top-centre, and the copy marking every GST invoice carries.
        {
          id: 'title',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN,
          y: 1.5,
          w: CONTENT_WIDTH,
          h: 5,
          value: 'TAX INVOICE',
          align: 'center',
          font: { family: 'NotoSans', size: 11, bold: true },
        },
        {
          id: 'copy-mark',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + CONTENT_WIDTH - 44,
          y: 2,
          w: 42,
          h: 4,
          value: '{{ invoice.isReprint ? "DUPLICATE" : "ORIGINAL FOR RECIPIENT" }}',
          align: 'right',
          font: FONT_SMALL,
        },

        // Letterhead. Uses the BRANCH GSTIN and address when there is one:
        // that is the registered place of business the supply was made from,
        // and printing the head-office one is a defect on the document's face.
        {
          id: 'co-name',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 8,
          w: 108,
          h: 6,
          value: '{{ company.name }}',
          font: { family: 'NotoSans', size: 12, bold: true },
        },
        {
          id: 'co-addr',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 14.5,
          w: 108,
          h: 8,
          value: '{{ branch.addressBlock|default(company.addressBlock) }}',
          wrap: true,
          font: FONT_SMALL,
        },
        {
          id: 'co-contact',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 23,
          w: 108,
          h: 4,
          value: 'Ph {{ branch.phone|default(company.phone) }}  {{ company.email }}',
          font: FONT_SMALL,
        },
        {
          id: 'co-gstin',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 27,
          w: 108,
          h: 4,
          value: 'GSTIN {{ branch.gstin|default(company.gstin) }}   PAN {{ company.pan }}',
          font: { family: 'NotoSans', size: 7, bold: true },
        },
        {
          id: 'co-fssai',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 31,
          w: 108,
          h: 4,
          value: 'FSSAI {{ company.fssai }}',
          font: FONT_SMALL,
          visible: '{{ company.fssai }}',
        },

        // Document identity, right of the letterhead.
        {
          id: 'inv-no-l',
          kind: 'TEXT',
          z: 1,
          x: 122,
          y: 8,
          w: 26,
          h: 4,
          value: 'Invoice No',
          font: FONT_SMALL,
        },
        {
          id: 'inv-no',
          kind: 'TEXT',
          z: 1,
          x: 148,
          y: 8,
          w: 52,
          h: 4,
          value: '{{ invoice.billNo }}',
          font: { family: 'NotoSans', size: 8, bold: true },
        },
        {
          id: 'inv-dt-l',
          kind: 'TEXT',
          z: 1,
          x: 122,
          y: 13,
          w: 26,
          h: 4,
          value: 'Dated',
          font: FONT_SMALL,
        },
        {
          id: 'inv-dt',
          kind: 'TEXT',
          z: 1,
          x: 148,
          y: 13,
          w: 52,
          h: 4,
          value: "{{ invoice.billDate|date('dd-MM-yyyy') }}",
          font: FONT_LABEL,
        },
        {
          id: 'inv-mode-l',
          kind: 'TEXT',
          z: 1,
          x: 122,
          y: 18,
          w: 26,
          h: 4,
          value: 'Terms',
          font: FONT_SMALL,
        },
        {
          id: 'inv-mode',
          kind: 'TEXT',
          z: 1,
          x: 148,
          y: 18,
          w: 52,
          h: 4,
          value:
            '{{ invoice.billType }} {{ invoice.dueDays > 0 ? invoice.dueDays + " days" : "" }}',
          font: FONT_LABEL,
        },
        {
          id: 'inv-due-l',
          kind: 'TEXT',
          z: 1,
          x: 122,
          y: 23,
          w: 26,
          h: 4,
          value: 'Due Date',
          font: FONT_SMALL,
          visible: '{{ invoice.dueDate }}',
        },
        {
          id: 'inv-due',
          kind: 'TEXT',
          z: 1,
          x: 148,
          y: 23,
          w: 52,
          h: 4,
          value: "{{ invoice.dueDate|date('dd-MM-yyyy') }}",
          font: FONT_LABEL,
          visible: '{{ invoice.dueDate }}',
        },
        {
          id: 'inv-src-l',
          kind: 'TEXT',
          z: 1,
          x: 122,
          y: 28,
          w: 26,
          h: 4,
          value: 'Order Ref',
          font: FONT_SMALL,
          visible: '{{ invoice.srcDocRefNo }}',
        },
        {
          id: 'inv-src',
          kind: 'TEXT',
          z: 1,
          x: 148,
          y: 28,
          w: 52,
          h: 4,
          value: '{{ invoice.srcDocRefNo }}',
          font: FONT_LABEL,
          visible: '{{ invoice.srcDocRefNo }}',
        },

        // E-invoice QR. Only when the company is e-invoice applicable AND the
        // document actually carries a signed payload — a blank QR is worse
        // than none, because a scanner reports it as a tampered invoice.
        {
          id: 'einv-qr',
          kind: 'QRCODE',
          z: 2,
          x: PAGE_WIDTH - RIGHT_MARGIN - 24,
          y: 34,
          size: 22,
          value: '{{ invoice.irnSignedQr }}',
          errorCorrection: 'M',
          visible: '{{ company.einvoiceApplicable && invoice.irnSignedQr }}',
        },

        // Bill-to block. From the invoice's SNAPSHOT columns, not a customer
        // join: a reprint must show the party as they were when it was raised.
        {
          id: 'sep1',
          kind: 'LINE',
          z: 1,
          x1: LEFT_MARGIN,
          y1: 36,
          x2: LEFT_MARGIN + CONTENT_WIDTH,
          y2: 36,
          widthPt: 0.5,
        },
        {
          id: 'bill-to-l',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 37.5,
          w: 40,
          h: 4,
          value: 'Billed to',
          font: FONT_SMALL,
        },
        {
          id: 'cust-name',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 41.5,
          w: 100,
          h: 5,
          value: '{{ invoice.custName }}',
          font: { family: 'NotoSans', size: 9.5, bold: true },
        },
        {
          id: 'cust-addr',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 2,
          y: 46.5,
          w: 100,
          h: 7,
          value: '{{ invoice.custAddress }}',
          wrap: true,
          font: FONT_SMALL,
        },
        {
          id: 'cust-gstin',
          kind: 'TEXT',
          z: 1,
          x: 112,
          y: 41.5,
          w: 50,
          h: 4,
          value: 'GSTIN {{ invoice.custGstin|default("URP") }}',
          font: { family: 'NotoSans', size: 7, bold: true },
        },
        {
          id: 'cust-phone',
          kind: 'TEXT',
          z: 1,
          x: 112,
          y: 45.5,
          w: 50,
          h: 4,
          value: 'Ph {{ invoice.custPhone }}',
          font: FONT_SMALL,
          visible: '{{ invoice.custPhone }}',
        },
        {
          id: 'pos',
          kind: 'TEXT',
          z: 1,
          x: 112,
          y: 49.5,
          w: 88,
          h: 4,
          value: 'Place of Supply {{ invoice.stateName }} ({{ invoice.posStateCode }})',
          font: FONT_SMALL,
        },

        // Column head. Boxed and shaded so the grid reads as a table even
        // when the detail rows carry no rules of their own.
        {
          id: 'head-bg',
          kind: 'RECT',
          z: 1,
          x: LEFT_MARGIN,
          y: 58,
          w: CONTENT_WIDTH,
          h: 6,
          style: { fill: '#E8E8E8', stroke: '#000000', strokeWidthPt: 0.5 },
        },
        ...COLUMNS.map((col) => ({
          id: `head-${col.key}`,
          kind: 'TEXT' as const,
          z: 2,
          x: col.x + 0.5,
          y: 59.6,
          w: col.widthMm - 1,
          h: 4,
          value: col.label,
          align: col.align,
          font: { family: 'NotoSans', size: 7, bold: true },
        })),
      ],
    },

    // ─── Item lines ───────────────────────────────────────────────────────
    {
      type: 'DETAIL',
      dataset: 'items',
      heightMm: DETAIL_HEIGHT,
      autoGrow: true,
      elements: [
        {
          id: 'row-sl',
          kind: 'FIELD',
          x: column('sl').x,
          y: 0.6,
          w: column('sl').widthMm - 1,
          h: 4,
          value: '{{ row.__index }}',
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'row-item',
          kind: 'FIELD',
          x: column('item').x + 1,
          y: 0.6,
          w: column('item').widthMm - 2,
          h: 4,
          // itemPrintName is the Tamil name when the item has one, else the
          // English. The renderer splits it into script runs and picks a face
          // per run, so a bilingual name is not a problem here.
          //
          // The scheme name is APPENDED rather than placed on its own line
          // below. A second element at a fixed y offset does not participate in
          // autoGrow — the band only grows for wrapped text — so it overprinted
          // the next row. Appending makes it part of the text that is measured.
          value: '{{ row.itemPrintName }}{{ row.schemeName ? " (" + row.schemeName + ")" : "" }}',
          wrap: true,
          font: FONT_BASE,
        },
        {
          id: 'row-hsn',
          kind: 'FIELD',
          x: column('hsn').x,
          y: 0.6,
          w: column('hsn').widthMm - 1,
          h: 4,
          value: '{{ row.hsnCode }}',
          font: FONT_BASE,
        },
        {
          id: 'row-qty',
          kind: 'FIELD',
          x: column('qty').x,
          y: 0.6,
          w: column('qty').widthMm - 1,
          h: 4,
          value: "{{ row.qty|fmt('0.000') }}",
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'row-uom',
          kind: 'FIELD',
          x: column('uom').x + 1,
          y: 0.6,
          w: column('uom').widthMm - 1,
          h: 4,
          value: '{{ row.unitName }}',
          font: FONT_BASE,
        },
        {
          id: 'row-rate',
          kind: 'FIELD',
          x: column('rate').x,
          y: 0.6,
          w: column('rate').widthMm - 1,
          h: 4,
          value: "{{ row.rate|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'row-disc',
          kind: 'FIELD',
          x: column('disc').x,
          y: 0.6,
          w: column('disc').widthMm - 1,
          h: 4,
          value: "{{ row.discAmt|fmt('#,##0.00') }}",
          align: 'right',
          blankWhenZero: true,
          font: FONT_BASE,
        },
        {
          id: 'row-taxable',
          kind: 'FIELD',
          x: column('taxable').x,
          y: 0.6,
          w: column('taxable').widthMm - 1,
          h: 4,
          value: "{{ row.taxableAmt|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'row-gst',
          kind: 'FIELD',
          x: column('gst').x,
          y: 0.6,
          w: column('gst').widthMm - 1,
          h: 4,
          value: "{{ row.taxPerc|fmt('0.0') }}",
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'row-amount',
          kind: 'FIELD',
          x: column('amount').x,
          y: 0.6,
          w: column('amount').widthMm - 1,
          h: 4,
          value: "{{ row.netAmount|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_BASE,
          // Conditional formatting: a credit line prints in red, so a rate
          // adjustment is not mistaken for a charge.
          style: { color: "{{ row.netAmount < 0 ? '#8B1D1D' : '#000000' }}" },
        },
      ],
    },

    // ─── HSN / rate tax summary ───────────────────────────────────────────
    // Rule 46 requires the taxable value and tax amount PER RATE. This is the
    // second repeating section; the layout engine emits it after the items
    // because it is declared after them.
    //
    // Its caption and column head sit in a GROUP_HEADER over a CONSTANT key, so
    // they are emitted exactly once, in their own band, ahead of the rows. The
    // alternative — an element on the first row at a negative y — draws over
    // the last item line, which is what an earlier version of this template did.
    {
      type: 'GROUP_HEADER',
      dataset: 'taxes',
      groupBy: "{{ 'all' }}",
      groupLevel: 0,
      heightMm: 9,
      keepWithNext: true,
      elements: [
        {
          id: 'tax-head',
          kind: 'TEXT',
          x: LEFT_MARGIN,
          y: 2.5,
          w: 80,
          h: 4,
          value: 'HSN / Rate wise tax summary',
          font: { family: 'NotoSans', size: 7, bold: true },
        },
        {
          id: 'tax-rule',
          kind: 'LINE',
          x1: LEFT_MARGIN,
          y1: 1,
          x2: LEFT_MARGIN + CONTENT_WIDTH,
          y2: 1,
          widthPt: 0.4,
        },
        {
          id: 'tax-ch-hsn',
          kind: 'TEXT',
          x: LEFT_MARGIN + 1,
          y: 6.4,
          w: 20,
          h: 3.5,
          value: 'HSN',
          font: FONT_SMALL,
        },
        {
          id: 'tax-ch-tv',
          kind: 'TEXT',
          x: 32,
          y: 6.4,
          w: 26,
          h: 3.5,
          value: 'Taxable',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-ch-cp',
          kind: 'TEXT',
          x: 62,
          y: 6.4,
          w: 12,
          h: 3.5,
          value: 'CGST%',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-ch-ca',
          kind: 'TEXT',
          x: 76,
          y: 6.4,
          w: 22,
          h: 3.5,
          value: 'CGST',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-ch-sp',
          kind: 'TEXT',
          x: 100,
          y: 6.4,
          w: 12,
          h: 3.5,
          value: 'SGST%',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-ch-sa',
          kind: 'TEXT',
          x: 114,
          y: 6.4,
          w: 22,
          h: 3.5,
          value: 'SGST',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-ch-ia',
          kind: 'TEXT',
          x: 138,
          y: 6.4,
          w: 24,
          h: 3.5,
          value: 'IGST',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-ch-tt',
          kind: 'TEXT',
          x: 164,
          y: 6.4,
          w: 30,
          h: 3.5,
          value: 'Total Tax',
          align: 'right',
          font: FONT_SMALL,
        },
      ],
    },
    {
      type: 'DETAIL',
      dataset: 'taxes',
      heightMm: TAX_ROW_HEIGHT,
      elements: [
        {
          id: 'tax-hsn',
          kind: 'FIELD',
          x: LEFT_MARGIN + 1,
          y: 0.5,
          w: 20,
          h: 4,
          value: '{{ row.hsnCode }}',
          font: FONT_SMALL,
        },
        {
          id: 'tax-taxable',
          kind: 'FIELD',
          x: 32,
          y: 0.5,
          w: 26,
          h: 4,
          value: "{{ row.taxableAmt|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-cgst-p',
          kind: 'FIELD',
          x: 62,
          y: 0.5,
          w: 12,
          h: 4,
          value: "{{ row.cgstPerc|fmt('0.0') }}",
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-cgst',
          kind: 'FIELD',
          x: 76,
          y: 0.5,
          w: 22,
          h: 4,
          value: "{{ row.cgstAmt|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-sgst-p',
          kind: 'FIELD',
          x: 100,
          y: 0.5,
          w: 12,
          h: 4,
          value: "{{ row.sgstPerc|fmt('0.0') }}",
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-sgst',
          kind: 'FIELD',
          x: 114,
          y: 0.5,
          w: 22,
          h: 4,
          value: "{{ row.sgstAmt|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'tax-igst',
          kind: 'FIELD',
          x: 138,
          y: 0.5,
          w: 24,
          h: 4,
          value: "{{ row.igstAmt|fmt('#,##0.00') }}",
          align: 'right',
          blankWhenZero: true,
          font: FONT_SMALL,
        },
        {
          id: 'tax-total',
          kind: 'FIELD',
          x: 164,
          y: 0.5,
          w: 30,
          h: 4,
          value: "{{ row.totalTax|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_SMALL,
        },
      ],
    },

    // ─── Totals, words, terms, signature ──────────────────────────────────
    // Two columns that never share a vertical range: money and signature on the
    // right, words and terms on the left. An earlier version ran the money list
    // down through the signature block and the two overprinted.
    {
      type: 'SUMMARY',
      heightMm: SUMMARY_HEIGHT,
      keepWithLastDetail: true,
      elements: [
        {
          id: 'sum-rule',
          kind: 'LINE',
          x1: LEFT_MARGIN,
          y1: 1,
          x2: LEFT_MARGIN + CONTENT_WIDTH,
          y2: 1,
          widthPt: 0.7,
        },

        // Line-count and quantity totals.
        {
          id: 'sum-count',
          kind: 'FIELD',
          x: LEFT_MARGIN + 1,
          y: 2.5,
          w: 60,
          h: 4,
          value: 'Items: {{ row.qty|fmt("0") }}',
          aggregate: { fn: 'count', scope: 'REPORT', dataset: 'items' },
          font: FONT_SMALL,
        },
        {
          id: 'sum-qty',
          kind: 'FIELD',
          x: column('qty').x,
          y: 2.5,
          w: column('qty').widthMm - 1,
          h: 4,
          value: "{{ row.qty|fmt('0.000') }}",
          align: 'right',
          aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'items' },
          font: { family: 'NotoSans', size: 8, bold: true },
        },

        // Right column: the money ladder, 3.4mm a row from y=8.
        ...[
          { key: 'gross', label: 'Gross Amount', field: 'invoice.grossAmt', always: true },
          { key: 'disc', label: 'Discount', field: 'invoice.totalDisc', always: false },
          { key: 'taxable', label: 'Taxable Value', field: 'invoice.taxableAmt', always: true },
          { key: 'cgst', label: 'CGST', field: 'invoice.cgstAmt', always: false },
          { key: 'sgst', label: 'SGST', field: 'invoice.sgstAmt', always: false },
          { key: 'igst', label: 'IGST', field: 'invoice.igstAmt', always: false },
          { key: 'cess', label: 'Cess', field: 'invoice.cessAmt', always: false },
          { key: 'freight', label: 'Freight', field: 'invoice.freightAmt', always: false },
          { key: 'loading', label: 'Loading', field: 'invoice.loadAmt', always: false },
          { key: 'round', label: 'Round Off', field: 'invoice.roundOff', always: false },
        ].flatMap((money, index) => {
          // Rounded: an unrounded ladder step leaves floating-point dust in the
          // stored coordinate (38.599999999999994), which jsonb then normalises
          // to a different digit on read and makes the gallery seed think the
          // template changed on every deploy.
          const y = Math.round((8 + index * 3.4) * 100) / 100;
          // A zero freight line is noise. The label hides with its figure,
          // which is why both carry the condition rather than relying on
          // blankWhenZero, which would leave a stranded label.
          const hide = money.always ? {} : { visible: `{{ ${money.field} != 0 }}` };
          return [
            {
              id: `tot-l-${money.key}`,
              kind: 'TEXT' as const,
              x: 126,
              y,
              w: 34,
              h: 3.2,
              value: money.label,
              align: 'right' as const,
              font: FONT_SMALL,
              ...hide,
            },
            {
              id: `tot-v-${money.key}`,
              kind: 'TEXT' as const,
              x: 162,
              y,
              w: 32,
              h: 3.2,
              value: `{{ ${money.field}|fmt('#,##0.00') }}`,
              align: 'right' as const,
              font: FONT_SMALL,
              ...hide,
            },
          ];
        }),

        // Grand total, boxed, below the ladder.
        {
          id: 'grand-box',
          kind: 'RECT',
          x: 126,
          y: 43,
          w: 68,
          h: 6.5,
          style: { fill: '#F0F0F0', stroke: '#000000', strokeWidthPt: 0.6 },
        },
        {
          id: 'grand-l',
          kind: 'TEXT',
          z: 1,
          x: 128,
          y: 44.8,
          w: 32,
          h: 4,
          value: 'Bill Amount',
          align: 'right',
          font: { family: 'NotoSans', size: 8.5, bold: true },
        },
        {
          id: 'grand-v',
          kind: 'TEXT',
          z: 1,
          x: 162,
          y: 44.8,
          w: 30,
          h: 4,
          value: "{{ invoice.billAmt|fmt('#,##0.00') }}",
          align: 'right',
          font: { family: 'NotoSans', size: 9.5, bold: true },
        },

        // Signature, below the grand total — never beside the money ladder.
        {
          id: 'sign-for',
          kind: 'TEXT',
          x: 126,
          y: 51.5,
          w: 68,
          h: 4,
          value: 'For {{ company.name }}',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'sign-line',
          kind: 'LINE',
          x1: 150,
          y1: 58.5,
          x2: 194,
          y2: 58.5,
          widthPt: 0.4,
        },
        {
          id: 'sign-l',
          kind: 'TEXT',
          x: 126,
          y: 58.8,
          w: 68,
          h: 4,
          value: 'Authorised Signatory',
          align: 'right',
          font: FONT_SMALL,
        },

        // Left column: amount in words, terms, greeting.
        {
          id: 'words-l',
          kind: 'TEXT',
          x: LEFT_MARGIN + 1,
          y: 8,
          w: 30,
          h: 3.5,
          value: 'Amount in words',
          font: FONT_SMALL,
        },
        {
          id: 'words',
          kind: 'TEXT',
          x: LEFT_MARGIN + 1,
          y: 12,
          w: 110,
          h: 8,
          value: '{{ invoice.billAmt|numToWords }}',
          wrap: true,
          font: { family: 'NotoSans', size: 7.5, bold: true },
        },
        {
          id: 'terms-l',
          kind: 'TEXT',
          x: LEFT_MARGIN + 1,
          y: 24,
          w: 30,
          h: 3.5,
          value: 'Terms',
          font: FONT_SMALL,
        },
        {
          id: 'terms',
          kind: 'TEXT',
          x: LEFT_MARGIN + 1,
          y: 28,
          w: 110,
          h: 20,
          value: '{{ invoice.termsConditions|default(branch.terms) }}',
          wrap: true,
          font: { family: 'NotoSans', size: 6 },
        },
        {
          id: 'greeting',
          kind: 'TEXT',
          x: LEFT_MARGIN + 1,
          y: 55,
          w: 110,
          h: 4,
          value: '{{ company.billGreeting }}',
          font: { family: 'NotoSans', size: 6.5, italic: true },
          visible: '{{ company.billGreeting }}',
        },
      ],
    },

    // ─── Page footer ──────────────────────────────────────────────────────
    {
      type: 'PAGE_FOOTER',
      heightMm: FOOTER_HEIGHT,
      printOn: 'ALL_PAGES',
      elements: [
        {
          id: 'foot-note',
          kind: 'TEXT',
          x: LEFT_MARGIN,
          y: 1.5,
          w: 120,
          h: 4,
          value: 'This is a computer generated invoice.',
          font: { family: 'NotoSans', size: 6 },
        },
        {
          id: 'foot-page',
          kind: 'TEXT',
          x: LEFT_MARGIN + CONTENT_WIDTH - 44,
          y: 1.5,
          w: 44,
          h: 4,
          value: 'Page {{ page.number }} of {{ page.total }}',
          align: 'right',
          font: { family: 'NotoSans', size: 6 },
        },
      ],
    },
  ],
});

/** Column geometry, exported so the A5 variant can derive from the same grid. */
export const A4_INVOICE_COLUMNS = COLUMNS;
