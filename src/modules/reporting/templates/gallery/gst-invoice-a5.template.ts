import { TemplateDefinitionInput } from '../dto/template-definition.schema';

/**
 * A5 GST tax invoice — 148mm wide.
 *
 * ── Why this is not the A4 template scaled ──────────────────────────────────
 * 132mm of content width against A4's 194. Scaling the A4 grid by 0.68 would
 * leave the item description 42mm wide, which holds about 22 characters of
 * 8pt text — not enough for a real product name, so every line would wrap and
 * the "compact" invoice would run longer than the A4 one.
 *
 * So columns are DROPPED instead of narrowed: the separate discount column
 * folds into the rate (net rate is printed), and the taxable column goes, since
 * the HSN summary block below already states taxable value per rate. What
 * remains is the seven fields that have to be on the face of the document.
 *
 * A5 is the counter-sale format — one or two dozen lines, handed over with the
 * goods — so the header is also trimmed: no order reference, no delivery terms.
 */

const LEFT_MARGIN = 7;
const RIGHT_MARGIN = 7;
const PAGE_WIDTH = 148;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN; // 134mm

interface Column {
  readonly key: string;
  readonly label: string;
  readonly widthMm: number;
  readonly align: 'left' | 'center' | 'right';
}

const COLUMN_SPEC: readonly Column[] = [
  { key: 'sl', label: '#', widthMm: 6, align: 'right' },
  { key: 'item', label: 'Description', widthMm: 52, align: 'left' },
  { key: 'hsn', label: 'HSN', widthMm: 14, align: 'left' },
  { key: 'qty', label: 'Qty', widthMm: 14, align: 'right' },
  { key: 'rate', label: 'Rate', widthMm: 16, align: 'right' },
  { key: 'gst', label: 'GST%', widthMm: 10, align: 'right' },
  { key: 'amount', label: 'Amount', widthMm: 22, align: 'right' },
];

const COLUMNS = (() => {
  let cursor = LEFT_MARGIN;
  const resolved = COLUMN_SPEC.map((column) => {
    const entry = { ...column, x: cursor };
    cursor += column.widthMm;
    return entry;
  });

  const total = cursor - LEFT_MARGIN;
  if (Math.abs(total - CONTENT_WIDTH) > 0.001) {
    throw new Error(`A5 GST invoice column widths total ${total}mm, expected ${CONTENT_WIDTH}mm.`);
  }

  return resolved;
})();

const column = (key: string) => {
  const found = COLUMNS.find((candidate) => candidate.key === key);
  if (!found) {
    throw new Error(`Unknown A5 invoice column '${key}'`);
  }
  return found;
};

const FONT_BASE = { family: 'NotoSans', size: 7.5 } as const;
const FONT_SMALL = { family: 'NotoSans', size: 6 } as const;

export const GST_INVOICE_A5_NAME = 'GST Tax Invoice — A5';

export const buildGstInvoiceA5 = (): TemplateDefinitionInput => ({
  schemaVersion: 1,
  layoutMode: 'GRAPHIC',
  meta: {
    gallery: 'gst-invoice-a5',
    description: 'Compact A5 counter-sale tax invoice with HSN summary and amount in words.',
  },
  paper: {
    code: 'A5',
    widthMm: PAGE_WIDTH,
    heightMm: 210,
    orientation: 'PORTRAIT',
    margins: { top: 6, right: RIGHT_MARGIN, bottom: 8, left: LEFT_MARGIN },
  },
  datasets: [
    { name: 'company', provider: 'company.profile', cardinality: 'one' },
    { name: 'branch', provider: 'branch.profile', cardinality: 'one' },
    { name: 'invoice', provider: 'sales.invoice.header', cardinality: 'one' },
    { name: 'items', provider: 'sales.invoice.lines', cardinality: 'many' },
    { name: 'taxes', provider: 'sales.invoice.taxSummary', cardinality: 'many' },
  ],
  bands: [
    {
      type: 'PAGE_HEADER',
      heightMm: 46,
      printOn: 'ALL_PAGES',
      elements: [
        {
          id: 'frame',
          kind: 'RECT',
          z: 0,
          x: LEFT_MARGIN,
          y: 0,
          w: CONTENT_WIDTH,
          h: 43,
          style: { stroke: '#000000', strokeWidthPt: 0.6 },
        },
        {
          id: 'title',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN,
          y: 1.2,
          w: CONTENT_WIDTH,
          h: 4.5,
          value: 'TAX INVOICE',
          align: 'center',
          font: { family: 'NotoSans', size: 9.5, bold: true },
        },
        {
          id: 'co-name',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 1.5,
          y: 6.5,
          w: 84,
          h: 5,
          value: '{{ company.name }}',
          font: { family: 'NotoSans', size: 10, bold: true },
        },
        {
          id: 'co-addr',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 1.5,
          y: 11.5,
          w: 84,
          h: 7,
          value: '{{ branch.addressBlock|default(company.addressBlock) }}',
          wrap: true,
          font: FONT_SMALL,
        },
        {
          id: 'co-gstin',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 1.5,
          y: 19,
          w: 84,
          h: 3.5,
          value: 'GSTIN {{ branch.gstin|default(company.gstin) }}',
          font: { family: 'NotoSans', size: 6.5, bold: true },
        },

        {
          id: 'no-l',
          kind: 'TEXT',
          z: 1,
          x: 94,
          y: 6.5,
          w: 18,
          h: 3.5,
          value: 'Invoice',
          font: FONT_SMALL,
        },
        {
          id: 'no',
          kind: 'TEXT',
          z: 1,
          x: 112,
          y: 6.5,
          w: 29,
          h: 3.5,
          value: '{{ invoice.billNo }}',
          align: 'right',
          font: { family: 'NotoSans', size: 7, bold: true },
        },
        {
          id: 'dt-l',
          kind: 'TEXT',
          z: 1,
          x: 94,
          y: 10.5,
          w: 18,
          h: 3.5,
          value: 'Date',
          font: FONT_SMALL,
        },
        {
          id: 'dt',
          kind: 'TEXT',
          z: 1,
          x: 112,
          y: 10.5,
          w: 29,
          h: 3.5,
          value: "{{ invoice.billDate|date('dd-MM-yyyy') }}",
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 'md-l',
          kind: 'TEXT',
          z: 1,
          x: 94,
          y: 14.5,
          w: 18,
          h: 3.5,
          value: 'Terms',
          font: FONT_SMALL,
        },
        {
          id: 'md',
          kind: 'TEXT',
          z: 1,
          x: 112,
          y: 14.5,
          w: 29,
          h: 3.5,
          value: '{{ invoice.billType }}',
          align: 'right',
          font: FONT_SMALL,
        },

        {
          id: 'einv-qr',
          kind: 'QRCODE',
          z: 2,
          x: PAGE_WIDTH - RIGHT_MARGIN - 18,
          y: 19.5,
          size: 16,
          value: '{{ invoice.irnSignedQr }}',
          errorCorrection: 'M',
          visible: '{{ company.einvoiceApplicable && invoice.irnSignedQr }}',
        },

        {
          id: 'sep',
          kind: 'LINE',
          z: 1,
          x1: LEFT_MARGIN,
          y1: 23.5,
          x2: LEFT_MARGIN + CONTENT_WIDTH,
          y2: 23.5,
          widthPt: 0.4,
        },
        {
          id: 'to-l',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 1.5,
          y: 24.5,
          w: 30,
          h: 3.5,
          value: 'Billed to',
          font: FONT_SMALL,
        },
        {
          id: 'cust',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 1.5,
          y: 28,
          w: 84,
          h: 4,
          value: '{{ invoice.custName }}',
          font: { family: 'NotoSans', size: 8.5, bold: true },
        },
        {
          id: 'cust-addr',
          kind: 'TEXT',
          z: 1,
          x: LEFT_MARGIN + 1.5,
          y: 32,
          w: 84,
          h: 6,
          value: '{{ invoice.custAddress }}',
          wrap: true,
          font: FONT_SMALL,
        },
        {
          id: 'cust-gstin',
          kind: 'TEXT',
          z: 1,
          x: 94,
          y: 28,
          w: 47,
          h: 3.5,
          value: 'GSTIN {{ invoice.custGstin|default("URP") }}',
          align: 'right',
          font: { family: 'NotoSans', size: 6.5, bold: true },
        },
        {
          id: 'pos',
          kind: 'TEXT',
          z: 1,
          x: 94,
          y: 32,
          w: 47,
          h: 3.5,
          value: 'PoS {{ invoice.posStateCode }}',
          align: 'right',
          font: FONT_SMALL,
        },

        {
          id: 'head-bg',
          kind: 'RECT',
          z: 1,
          x: LEFT_MARGIN,
          y: 38.5,
          w: CONTENT_WIDTH,
          h: 5,
          style: { fill: '#E8E8E8', stroke: '#000000', strokeWidthPt: 0.4 },
        },
        ...COLUMNS.map((col) => ({
          id: `head-${col.key}`,
          kind: 'TEXT' as const,
          z: 2,
          x: col.x + 0.4,
          y: 39.8,
          w: col.widthMm - 0.8,
          h: 3.5,
          value: col.label,
          align: col.align,
          font: { family: 'NotoSans', size: 6.5, bold: true },
        })),
      ],
    },

    {
      type: 'DETAIL',
      dataset: 'items',
      heightMm: 5,
      autoGrow: true,
      elements: [
        {
          id: 'r-sl',
          kind: 'FIELD',
          x: column('sl').x,
          y: 0.5,
          w: column('sl').widthMm - 0.8,
          h: 3.5,
          value: '{{ row.__index }}',
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'r-item',
          kind: 'FIELD',
          x: column('item').x + 0.8,
          y: 0.5,
          w: column('item').widthMm - 1.6,
          h: 3.5,
          value: '{{ row.itemPrintName }}',
          wrap: true,
          font: FONT_BASE,
        },
        {
          id: 'r-hsn',
          kind: 'FIELD',
          x: column('hsn').x,
          y: 0.5,
          w: column('hsn').widthMm - 0.8,
          h: 3.5,
          value: '{{ row.hsnCode }}',
          font: FONT_BASE,
        },
        {
          id: 'r-qty',
          kind: 'FIELD',
          x: column('qty').x,
          y: 0.5,
          w: column('qty').widthMm - 0.8,
          h: 3.5,
          value: "{{ row.qty|fmt('0.##') }} {{ row.unitName }}",
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'r-rate',
          kind: 'FIELD',
          x: column('rate').x,
          y: 0.5,
          w: column('rate').widthMm - 0.8,
          h: 3.5,
          value: "{{ row.rate|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'r-gst',
          kind: 'FIELD',
          x: column('gst').x,
          y: 0.5,
          w: column('gst').widthMm - 0.8,
          h: 3.5,
          value: "{{ row.taxPerc|fmt('0.#') }}",
          align: 'right',
          font: FONT_BASE,
        },
        {
          id: 'r-amt',
          kind: 'FIELD',
          x: column('amount').x,
          y: 0.5,
          w: column('amount').widthMm - 0.8,
          h: 3.5,
          value: "{{ row.netAmount|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_BASE,
          style: { color: "{{ row.netAmount < 0 ? '#8B1D1D' : '#000000' }}" },
        },
      ],
    },

    {
      type: 'DETAIL',
      dataset: 'taxes',
      heightMm: 4,
      elements: [
        {
          id: 't-head',
          kind: 'TEXT',
          x: LEFT_MARGIN,
          y: -4,
          w: 60,
          h: 3.5,
          value: 'HSN wise tax',
          font: { family: 'NotoSans', size: 6.5, bold: true },
          visible: '{{ row.__isFirst }}',
        },
        {
          id: 't-hsn',
          kind: 'FIELD',
          x: LEFT_MARGIN + 0.8,
          y: 0.4,
          w: 16,
          h: 3,
          value: '{{ row.hsnCode }}',
          font: FONT_SMALL,
        },
        {
          id: 't-taxable',
          kind: 'FIELD',
          x: 26,
          y: 0.4,
          w: 22,
          h: 3,
          value: "{{ row.taxableAmt|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 't-cgst',
          kind: 'FIELD',
          x: 50,
          y: 0.4,
          w: 20,
          h: 3,
          value: "{{ row.cgstAmt|fmt('#,##0.00') }}",
          align: 'right',
          blankWhenZero: true,
          font: FONT_SMALL,
        },
        {
          id: 't-sgst',
          kind: 'FIELD',
          x: 72,
          y: 0.4,
          w: 20,
          h: 3,
          value: "{{ row.sgstAmt|fmt('#,##0.00') }}",
          align: 'right',
          blankWhenZero: true,
          font: FONT_SMALL,
        },
        {
          id: 't-igst',
          kind: 'FIELD',
          x: 94,
          y: 0.4,
          w: 20,
          h: 3,
          value: "{{ row.igstAmt|fmt('#,##0.00') }}",
          align: 'right',
          blankWhenZero: true,
          font: FONT_SMALL,
        },
        {
          id: 't-total',
          kind: 'FIELD',
          x: 116,
          y: 0.4,
          w: 25,
          h: 3,
          value: "{{ row.totalTax|fmt('#,##0.00') }}",
          align: 'right',
          font: FONT_SMALL,
        },
      ],
    },

    {
      type: 'SUMMARY',
      heightMm: 40,
      keepWithLastDetail: true,
      elements: [
        {
          id: 's-rule',
          kind: 'LINE',
          x1: LEFT_MARGIN,
          y1: 1,
          x2: LEFT_MARGIN + CONTENT_WIDTH,
          y2: 1,
          widthPt: 0.5,
        },
        ...[
          { key: 'taxable', label: 'Taxable', field: 'invoice.taxableAmt', always: true },
          { key: 'tax', label: 'GST', field: 'invoice.taxAmt', always: true },
          { key: 'freight', label: 'Freight', field: 'invoice.freightAmt', always: false },
          { key: 'round', label: 'Round Off', field: 'invoice.roundOff', always: false },
        ].flatMap((money, index) => {
          // Rounded: an unrounded ladder step leaves floating-point dust in the
          // stored coordinate (38.599999999999994), which jsonb then normalises
          // to a different digit on read and makes the gallery seed think the
          // template changed on every deploy.
          const y = Math.round((2.5 + index * 3.4) * 100) / 100;
          const hide = money.always ? {} : { visible: `{{ ${money.field} != 0 }}` };
          return [
            {
              id: `s-l-${money.key}`,
              kind: 'TEXT' as const,
              x: 86,
              y,
              w: 26,
              h: 3.2,
              value: money.label,
              align: 'right' as const,
              font: FONT_SMALL,
              ...hide,
            },
            {
              id: `s-v-${money.key}`,
              kind: 'TEXT' as const,
              x: 113,
              y,
              w: 28,
              h: 3.2,
              value: `{{ ${money.field}|fmt('#,##0.00') }}`,
              align: 'right' as const,
              font: FONT_SMALL,
              ...hide,
            },
          ];
        }),
        {
          id: 's-box',
          kind: 'RECT',
          x: 86,
          y: 16.5,
          w: 55,
          h: 5.5,
          style: { fill: '#F0F0F0', stroke: '#000000', strokeWidthPt: 0.5 },
        },
        {
          id: 's-l',
          kind: 'TEXT',
          z: 1,
          x: 88,
          y: 18,
          w: 24,
          h: 3.5,
          value: 'Bill Amount',
          align: 'right',
          font: { family: 'NotoSans', size: 7.5, bold: true },
        },
        {
          id: 's-v',
          kind: 'TEXT',
          z: 1,
          x: 113,
          y: 18,
          w: 26,
          h: 3.5,
          value: "{{ invoice.billAmt|fmt('#,##0.00') }}",
          align: 'right',
          font: { family: 'NotoSans', size: 8.5, bold: true },
        },
        {
          id: 's-words',
          kind: 'TEXT',
          x: LEFT_MARGIN + 0.8,
          y: 3,
          w: 78,
          h: 8,
          value: '{{ invoice.billAmt|numToWords }}',
          wrap: true,
          font: { family: 'NotoSans', size: 6.5, bold: true },
        },
        {
          id: 's-terms',
          kind: 'TEXT',
          x: LEFT_MARGIN + 0.8,
          y: 13,
          w: 78,
          h: 10,
          value: '{{ invoice.termsConditions|default(branch.terms) }}',
          wrap: true,
          font: { family: 'NotoSans', size: 5.5 },
        },
        {
          id: 's-sign',
          kind: 'TEXT',
          x: 86,
          y: 26,
          w: 55,
          h: 3.5,
          value: 'For {{ company.name }}',
          align: 'right',
          font: FONT_SMALL,
        },
        {
          id: 's-signline',
          kind: 'LINE',
          x1: 106,
          y1: 34,
          x2: 141,
          y2: 34,
          widthPt: 0.3,
        },
        {
          id: 's-signl',
          kind: 'TEXT',
          x: 86,
          y: 30.5,
          w: 55,
          h: 3.5,
          value: 'Authorised Signatory',
          align: 'right',
          font: FONT_SMALL,
        },
      ],
    },

    {
      type: 'PAGE_FOOTER',
      heightMm: 6,
      printOn: 'ALL_PAGES',
      elements: [
        {
          id: 'f-page',
          kind: 'TEXT',
          x: LEFT_MARGIN,
          y: 1,
          w: CONTENT_WIDTH,
          h: 3.5,
          value: 'Page {{ page.number }} of {{ page.total }}  ·  computer generated invoice',
          align: 'right',
          font: { family: 'NotoSans', size: 5.5 },
        },
      ],
    },
  ],
});
