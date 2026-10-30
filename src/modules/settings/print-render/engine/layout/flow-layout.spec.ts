import {
  CrosstabElement,
  ReportElement,
  TemplateDefinition,
  TemplateDefinitionInput,
  templateDefinitionSchema,
} from '../../definition/template-definition.schema';
import { FontRegistry } from '../fonts/font.registry';
import { applyFlowLayout, verticalSpan } from './flow-layout';
import { LayoutEngine } from './layout.engine';
import { LayoutTree, LinePrimitive, TextPrimitive } from './layout-tree.types';
import { TextMeasurer } from './text-measure';

const registry = new FontRegistry();
let engine: LayoutEngine;

beforeAll(() => {
  registry.load();
  engine = new LayoutEngine(new TextMeasurer(registry));
});

const parse = (definition: TemplateDefinitionInput): TemplateDefinition =>
  templateDefinitionSchema.parse(definition);

// ─── The A5 Sale Invoice totals block ──────────────────────────────────────
//
// The REPORT_FOOTER of SaleInvoiceA5 rebuilt for flow: the charges crosstab is
// designed at its bare header height (3.12mm, 6.5pt bold), Discount sits right
// under it, and everything below the crosstab FLOATs. The expected positions
// are the plan's table, computed from its reference implementation.

const A5 = {
  code: 'A5',
  widthMm: 148,
  heightMm: 210,
  orientation: 'PORTRAIT' as const,
  margins: { top: 10, right: 5, bottom: 10, left: 5 },
};
const BODY_TOP_MM = A5.margins.top;

type FooterElement = Record<string, unknown> & { id: string; kind: string };

const label = (id: string, y: number, value: string, extra: object = {}): FooterElement => ({
  id,
  kind: 'TEXT',
  x: 89,
  y,
  w: 32,
  h: 3.4,
  value,
  ...extra,
});
const amount = (id: string, y: number, field: string, extra: object = {}): FooterElement => ({
  id,
  kind: 'FIELD',
  x: 123,
  y,
  w: 20,
  h: 3.4,
  align: 'right',
  value: `{{ header.${field}|fmt('##,##,##0.00') }}`,
  ...extra,
});
const rule = (id: string, y: number, extra: object = {}): FooterElement => ({
  id,
  kind: 'LINE',
  x: 88.5,
  y,
  x1: 88.5,
  y1: y,
  x2: 143.5,
  y2: y,
  widthPt: 0.8,
  ...extra,
});

const FLOAT = { positionType: 'FLOAT' };
const BLANK_DISC = {
  ...FLOAT,
  visible: '{{ header.total_disc|num }}',
  removeLineWhenBlank: true,
};
const BLANK_CASH = {
  ...FLOAT,
  visible: '{{ header.cash_disc|num }}',
  removeLineWhenBlank: true,
};

const footerElements = (): FooterElement[] => [
  { id: 'rf_rule_top', kind: 'LINE', x1: 5, y1: 0.2, x2: 143, y2: 0.2, widthPt: 0.8 },
  label('rf_l_gross', 1.2, 'Gross Amount'),
  amount('rf_v_gross', 1.2, 'taxable_amt'),
  {
    id: 'crosstab_1',
    kind: 'CROSSTAB',
    x: 88,
    y: 1.48,
    w: 56,
    h: 3.12,
    font: { size: 6.5 },
    headerFont: { size: 6.5, bold: true },
    dataset: 'charges',
    rowBy: '{{ row.chg_name }}',
    columnBy: "{{ '' }}",
    measure: '{{ row.cd_net_amt }}',
    format: '##,##,##0.00',
    rowHeaderWidthMm: 34,
    headerHeightMm: 0,
    rowHeightMm: 3.4,
    showRowTotals: false,
    showColumnTotals: false,
    columnSort: 'FIRST_SEEN',
    maxColumns: 1,
    overflow: 'FOLD',
    gridLines: false,
  },
  label('rf_l_disc', 4.6, 'Discount', BLANK_DISC),
  amount('rf_v_disc', 4.6, 'total_disc', BLANK_DISC),
  label('rf_l_cash', 8.0, 'Cash Discount', BLANK_CASH),
  amount('rf_v_cash', 8.0, 'cash_disc', BLANK_CASH),
  label('rf_l_round', 11.4, 'Round Off', FLOAT),
  amount('rf_v_round', 11.4, 'round_off', FLOAT),
  rule('rf_rule_total_top', 14.7, FLOAT),
  label('rf_l_total', 15.8, 'GRAND TOTAL', { ...FLOAT, h: 5 }),
  amount('rf_v_total', 15.8, 'bill_amt', { ...FLOAT, x: 122, w: 21, h: 5 }),
  rule('rf_rule_total_bot', 20.8, FLOAT),
];

const invoiceFooterTemplate = (
  options: {
    flowLayout?: boolean;
    keepTogether?: boolean;
    elements?: FooterElement[];
    before?: TemplateDefinitionInput['bands'];
  } = {},
): TemplateDefinition =>
  parse({
    schemaVersion: 1,
    layoutMode: 'GRAPHIC',
    paper: A5,
    datasets: [
      { name: 'header', provider: 'sales.bill.header', cardinality: 'one' },
      { name: 'charges', provider: 'sales.bill.charges', cardinality: 'many' },
    ],
    bands: [
      ...(options.before ?? []),
      {
        type: 'REPORT_FOOTER',
        heightMm: 53.12,
        keepTogether: options.keepTogether ?? true,
        ...(options.flowLayout === undefined ? {} : { flowLayout: options.flowLayout }),
        elements: (options.elements ?? footerElements()) as never,
      },
      // Declared AFTER the footer, so it emits right under it: its marker's y
      // minus the footer's top is the footer's height.
      {
        type: 'SUMMARY',
        heightMm: 4,
        elements: [{ id: 'after', kind: 'TEXT', x: 5, y: 0, w: 20, h: 4, value: 'AFTER' }],
      },
    ],
  });

const CHARGE_NAMES = ['Freight', 'Packing', 'Loading'];

const invoiceData = (charges: number, discount: boolean, cashDiscount: boolean) => ({
  header: {
    taxable_amt: 1000,
    total_disc: discount ? 25 : 0,
    cash_disc: cashDiscount ? 10 : 0,
    round_off: 0.4,
    bill_amt: 1200,
  },
  charges: Array.from({ length: charges }, (_unused, index) => ({
    chg_name: CHARGE_NAMES[index] ?? `Charge ${index + 1}`,
    cd_net_amt: 50 * (index + 1),
  })),
});

const render = (definition: TemplateDefinition, datasets: Record<string, unknown>): LayoutTree =>
  engine.render({ definition, datasets, ctx: {}, sys: { now: '2026-10-13T00:00:00.000Z' } });

const textOn = (tree: LayoutTree, text: string): { page: number; primitive: TextPrimitive } => {
  for (const page of tree.pages) {
    const found = page.primitives.find(
      (primitive): primitive is TextPrimitive => primitive.k === 'text' && primitive.text === text,
    );
    if (found) {
      return { page: page.index, primitive: found };
    }
  }
  throw new Error(`no '${text}' anywhere in the tree`);
};

const lineY = (tree: LayoutTree, x1: number, nth: number): number =>
  tree.pages
    .flatMap((page) => page.primitives)
    .filter(
      (primitive): primitive is LinePrimitive => primitive.k === 'line' && primitive.x1 === x1,
    )
    .map((primitive) => primitive.y1)
    .sort((left, right) => left - right)[nth];

/** Band-relative y of a text the footer printed. */
const footerY = (tree: LayoutTree, text: string): number =>
  textOn(tree, text).primitive.y - BODY_TOP_MM;

// ─── The plan's table ──────────────────────────────────────────────────────

describe('flow layout: the A5 sale invoice footer', () => {
  //   charges, discount, cash disc -> Round Off y, Grand Total y, bottom rule y, band height
  const CASES: Array<[number, boolean, boolean, number, number, number, number]> = [
    [0, false, false, 4.6, 9.0, 14.0, 46.32],
    [0, true, false, 8.0, 12.4, 17.4, 49.72],
    [0, false, true, 8.0, 12.4, 17.4, 49.72],
    [1, false, false, 8.0, 12.4, 17.4, 49.72],
    [2, true, true, 18.2, 22.6, 27.6, 59.92],
    [3, true, true, 21.6, 26.0, 31.0, 63.32],
  ];

  it.each(CASES)(
    '%i charge(s), discount %s, cash discount %s',
    (charges, discount, cash, roundY, totalY, bottomRuleY, heightMm) => {
      const tree = render(
        invoiceFooterTemplate({ flowLayout: true }),
        invoiceData(charges, discount, cash),
      );

      expect(footerY(tree, 'Round Off')).toBeCloseTo(roundY, 2);
      expect(footerY(tree, 'GRAND TOTAL')).toBeCloseTo(totalY, 2);
      expect(lineY(tree, 88.5, 1) - BODY_TOP_MM).toBeCloseTo(bottomRuleY, 2);
      expect(footerY(tree, 'AFTER')).toBeCloseTo(heightMm, 2);
      expect(tree.warnings).toEqual([]);
    },
  );

  it('keeps the 3.4mm pitch from the last charge to the next line', () => {
    const tree = render(invoiceFooterTemplate({ flowLayout: true }), invoiceData(2, true, false));

    // Two charges print FIRST_SEEN-free, label-ascending: Freight, Packing.
    const lastCharge = footerY(tree, 'Packing');
    expect(footerY(tree, 'Discount') - lastCharge).toBeCloseTo(3.4, 2);
  });

  it('matches the old fixed layout element for element when every line prints', () => {
    // The fixed design this replaced: crosstab reserved for three charges,
    // Discount at 14.8, Cash at 18.2, Round Off at 21.6, Grand Total at 26.
    const tree = render(invoiceFooterTemplate({ flowLayout: true }), invoiceData(3, true, true));

    expect(footerY(tree, 'Discount')).toBeCloseTo(14.8, 2);
    expect(footerY(tree, 'Cash Discount')).toBeCloseTo(18.2, 2);
    expect(lineY(tree, 88.5, 0) - BODY_TOP_MM).toBeCloseTo(24.9, 2);
  });

  it('never moves a FIX element', () => {
    const tree = render(invoiceFooterTemplate({ flowLayout: true }), invoiceData(0, false, false));

    expect(footerY(tree, 'Gross Amount')).toBeCloseTo(1.2, 5);
    expect(lineY(tree, 5, 0) - BODY_TOP_MM).toBeCloseTo(0.2, 5);
  });
});

// ─── Backward compatibility ────────────────────────────────────────────────

describe('flow layout: off is the old behaviour', () => {
  /** The same footer with the three new keys never written. */
  const legacyElements = (): FooterElement[] =>
    footerElements().map((element) => {
      const { positionType: _position, removeLineWhenBlank: _remove, ...rest } = element;
      return rest as FooterElement;
    });

  it.each([
    [0, false, false],
    [3, true, true],
  ])('renders identically with flowLayout off (%i charges)', (charges, discount, cash) => {
    const data = invoiceData(charges, discount, cash);
    const withKeys = render(invoiceFooterTemplate({ flowLayout: false }), data);
    const without = render(invoiceFooterTemplate({ elements: legacyElements() }), data);

    // Everything but the wall-clock timing.
    expect(withKeys.pages).toEqual(without.pages);
    expect(withKeys.warnings).toEqual(without.warnings);
    expect(withKeys.stats.bandsEmitted).toBe(without.stats.bandsEmitted);
  });

  it('leaves the fixed layout fixed: hidden lines keep their gap', () => {
    const tree = render(invoiceFooterTemplate(), invoiceData(0, false, false));

    expect(footerY(tree, 'Round Off')).toBeCloseTo(11.4, 5);
    expect(footerY(tree, 'AFTER')).toBeCloseTo(53.12, 5);
  });

  it('ignores flowLayout in GRID mode', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRID',
      paper: { ...A5, code: 'T80', columns: 48, heightMm: null },
      datasets: [{ name: 'header', provider: 'sales.bill.header', cardinality: 'one' }],
      bands: [
        {
          type: 'REPORT_FOOTER',
          heightMm: 3,
          heightRows: 3,
          flowLayout: true,
          elements: [
            {
              id: 'disc',
              kind: 'TEXT',
              row: 0,
              col: 0,
              cols: 20,
              value: 'Discount',
              visible: '{{ header.total_disc|num }}',
              removeLineWhenBlank: true,
            },
            {
              id: 'total',
              kind: 'TEXT',
              row: 1,
              col: 0,
              cols: 20,
              value: 'TOTAL',
              positionType: 'FLOAT',
            },
          ],
        },
      ],
    });

    const tree = render(definition, { header: { total_disc: 0 } });
    expect(textOn(tree, 'TOTAL').primitive.y).toBe(1);
  });
});

// ─── Pagination ────────────────────────────────────────────────────────────

describe('flow layout: page fit uses the flowed height', () => {
  // A5 body is 190mm. 140mm of header leaves 50mm: room for the collapsed
  // footer (46.32mm) but not for the fixed one (53.12mm).
  const spacer = [
    {
      type: 'REPORT_HEADER' as const,
      heightMm: 140,
      elements: [{ id: 'top', kind: 'TEXT' as const, x: 5, y: 0, w: 20, h: 4, value: 'TOP' }],
    },
  ];

  it('keeps a footer that only fits once its blank lines close up', () => {
    const tree = render(
      invoiceFooterTemplate({ flowLayout: true, before: spacer }),
      invoiceData(0, false, false),
    );
    expect(textOn(tree, 'GRAND TOTAL').page).toBe(0);
  });

  it('moves the footer whole when the charges grow it past the space left', () => {
    // 3 charges, everything printing: 63.32mm, which 50mm cannot hold.
    const tree = render(
      invoiceFooterTemplate({ flowLayout: true, before: spacer }),
      invoiceData(3, true, true),
    );
    expect(textOn(tree, 'Gross Amount').page).toBe(1);
    expect(textOn(tree, 'GRAND TOTAL').page).toBe(1);
    expect(footerY(tree, 'GRAND TOTAL')).toBeCloseTo(26.0, 2);
  });

  it('splits a flow band that does not ask to be kept together', () => {
    // The crosstab's own rule: caption, header and a row fit here, so the
    // table starts here -- and the tail that no longer fits under it moves on.
    const tree = render(
      invoiceFooterTemplate({ flowLayout: true, keepTogether: false, before: spacer }),
      invoiceData(3, true, true),
    );
    expect(textOn(tree, 'Gross Amount').page).toBe(0);
    expect(textOn(tree, 'Loading').page).toBe(0);
    expect(textOn(tree, 'GRAND TOTAL').page).toBe(1);
  });
});

describe('flow layout: a crosstab split across pages', () => {
  const manyCharges = (count: number) => ({
    ...invoiceData(0, false, false),
    charges: Array.from({ length: count }, (_unused, index) => ({
      chg_name: `Charge ${String(index + 1).padStart(3, '0')}`,
      cd_net_amt: 10,
    })),
  });

  const lastChargeOf = (tree: LayoutTree, count: number) =>
    textOn(tree, `Charge ${String(count).padStart(3, '0')}`);

  it('prints the lines below the table after its last row, not on its first page', () => {
    const count = 64;
    const tree = render(invoiceFooterTemplate({ flowLayout: true }), manyCharges(count));

    expect(tree.pages.length).toBeGreaterThan(1);
    expect(textOn(tree, 'Gross Amount').page).toBe(0);

    const last = lastChargeOf(tree, count);
    const round = textOn(tree, 'Round Off');
    const total = textOn(tree, 'GRAND TOTAL');
    expect(round.page).toBe(last.page);
    expect(round.primitive.y - last.primitive.y).toBeCloseTo(3.4, 2);
    expect(total.primitive.y - round.primitive.y).toBeCloseTo(4.4, 2);
  });

  it('moves the tail to a fresh page when it will not fit under the table', () => {
    // Enough rows to end the table close to the bottom of its last page.
    const count = 104;
    const tree = render(invoiceFooterTemplate({ flowLayout: true }), manyCharges(count));

    const last = lastChargeOf(tree, count);
    const round = textOn(tree, 'Round Off');
    const total = textOn(tree, 'GRAND TOTAL');
    expect(round.page).toBe(last.page + 1);
    expect(round.primitive.y).toBeCloseTo(BODY_TOP_MM, 2);
    expect(total.page).toBe(round.page);
    expect(total.primitive.y - round.primitive.y).toBeCloseTo(4.4, 2);
  });
});

describe('a hidden crosstab in a band that does not fit', () => {
  it('is not printed by the page-splitting path', () => {
    const elements = footerElements().map((element) =>
      element.id === 'crosstab_1' ? { ...element, visible: '{{ false }}' } : element,
    );
    const tree = render(
      invoiceFooterTemplate({
        elements,
        before: [
          {
            type: 'REPORT_HEADER',
            heightMm: 180,
            elements: [{ id: 'top', kind: 'TEXT', x: 5, y: 0, w: 20, h: 4, value: 'TOP' }],
          },
        ],
      }),
      invoiceData(3, true, true),
    );

    for (const name of CHARGE_NAMES) {
      expect(() => textOn(tree, name)).toThrow();
    }
  });
});

// ─── The pass itself ───────────────────────────────────────────────────────

describe('applyFlowLayout', () => {
  const element = (overrides: Record<string, unknown>): ReportElement =>
    parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A5,
      datasets: [{ name: 'rows', provider: 'p', cardinality: 'many' }],
      bands: [{ type: 'SUMMARY', elements: [{ id: 'e', kind: 'TEXT', value: 'x', ...overrides }] }],
    }).bands[0].elements[0];

  const visibleUnless =
    (...hidden: string[]) =>
    (candidate: ReportElement) =>
      !hidden.includes(candidate.id);

  const noTable = (_table: CrosstabElement): number => 0;

  it('measures a LINE by y1/y2, not by its unused y', () => {
    const line = {
      ...element({}),
      kind: 'LINE',
      y: 0,
      y1: 9,
      y2: 4,
      x1: 0,
      x2: 10,
    } as unknown as ReportElement;
    expect(verticalSpan(line)).toEqual([4, 9]);
  });

  it('merges touching blank lines into one collapse', () => {
    const band = {
      heightMm: 20,
      elements: [
        element({ id: 'a', y: 2, h: 3, removeLineWhenBlank: true }),
        element({ id: 'b', y: 5, h: 3, removeLineWhenBlank: true }),
        element({ id: 'c', y: 8, h: 3, positionType: 'FLOAT' }),
      ],
    };
    const flow = applyFlowLayout(band, visibleUnless('a', 'b'), noTable);

    expect(flow.shifts).toEqual([{ atMm: 8, deltaMm: -6 }]);
    expect(flow.elements.map((placed) => [placed.id, placed.y])).toEqual([['c', 2]]);
    expect(flow.heightMm).toBe(14);
  });

  it('keeps a blank line that a visible element still stands in', () => {
    const band = {
      heightMm: 20,
      elements: [
        element({ id: 'value', x: 50, y: 2, h: 3, removeLineWhenBlank: true }),
        element({ id: 'caption', x: 0, y: 2, h: 3 }),
        element({ id: 'below', y: 5, h: 3, positionType: 'FLOAT' }),
      ],
    };
    const flow = applyFlowLayout(band, visibleUnless('value'), noTable);

    expect(flow.shifts).toEqual([]);
    expect(flow.elements.find((placed) => placed.id === 'below')?.y).toBe(5);
  });

  it('collapses nothing for a hidden element that did not ask to', () => {
    const band = {
      heightMm: 20,
      elements: [
        element({ id: 'a', y: 2, h: 3 }),
        element({ id: 'b', y: 5, h: 3, positionType: 'FLOAT' }),
      ],
    };
    expect(applyFlowLayout(band, visibleUnless('a'), noTable).shifts).toEqual([]);
  });

  it('never moves a FIX element and never mutates the design', () => {
    const fixed = element({ id: 'fixed', y: 10, h: 3 });
    const band = {
      heightMm: 20,
      elements: [element({ id: 'gone', y: 2, h: 3, removeLineWhenBlank: true }), fixed],
    };
    const flow = applyFlowLayout(band, visibleUnless('gone'), noTable);

    expect(flow.elements).toEqual([fixed]);
    expect(band.elements[1].y).toBe(10);
  });

  it('does not end the band above a FIX table that space collapsed over', () => {
    const table = {
      ...element({ id: 'table', y: 10 }),
      kind: 'CROSSTAB',
      h: 0,
    } as unknown as ReportElement;
    const band = {
      heightMm: 10,
      elements: [element({ id: 'gone', y: 2, h: 3, removeLineWhenBlank: true }), table],
    };
    const flow = applyFlowLayout(band, visibleUnless('gone'), () => 8);

    // 10 + 8 (table) - 3 (blank line) = 15 would cut the table off at 15.
    expect(flow.heightMm).toBe(18);
  });
});
