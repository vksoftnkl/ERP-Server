import {
  CrosstabElement,
  TemplateDefinition,
  TemplateDefinitionInput,
  templateDefinitionSchema,
} from '../../definition/template-definition.schema';
import { FontRegistry } from '../fonts/font.registry';
import { LayoutEngine } from './layout.engine';
import { LayoutTree, TextPrimitive } from './layout-tree.types';
import { TextMeasurer } from './text-measure';
import { formatNumber } from '../expression/transforms/format';
import {
  CROSSTAB_FOLD_KEY,
  buildCrosstabModel,
  emitCrosstab,
  planCrosstab,
  sliceCrosstab,
} from './crosstab';
import { loadCanvasFixture, loadCanvasFixtureSample } from '../../__fixtures__/load-fixture';

/**
 * The crosstab, from three angles:
 *
 *   1. the MODEL -- does it aggregate the right numbers into the right cells,
 *      and do the totals still add up once columns are folded away;
 *   2. the PLAN -- does it stay inside the width it was given;
 *   3. the ENGINE -- does a table taller than the page split across pages with
 *      its header repeated, and does the band after it start in the right place.
 *
 * (3) is the one that matters most in practice: a crosstab is the only element
 * whose height the designer cannot see, so it is the only one that can silently
 * push a report's footer off the paper.
 */

const registry = new FontRegistry();
let engine: LayoutEngine;
let measurer: TextMeasurer;

beforeAll(() => {
  registry.load();
  measurer = new TextMeasurer(registry);
  engine = new LayoutEngine(measurer);
});

const parse = (definition: TemplateDefinitionInput): TemplateDefinition =>
  templateDefinitionSchema.parse(definition);

const A4 = {
  code: 'A4',
  widthMm: 210,
  heightMm: 297,
  orientation: 'PORTRAIT' as const,
  margins: { top: 10, right: 8, bottom: 12, left: 8 },
};

interface SaleRow {
  branch: string;
  month: string;
  amount: number;
}

const SALES: SaleRow[] = [
  { branch: 'Chennai', month: 'Apr', amount: 100 },
  { branch: 'Chennai', month: 'May', amount: 250 },
  { branch: 'Chennai', month: 'Apr', amount: 50 },
  { branch: 'Madurai', month: 'May', amount: 400 },
  { branch: 'Madurai', month: 'Jun', amount: 25 },
  { branch: 'Salem', month: 'Apr', amount: 75 },
];

/** A crosstab element, parsed through the real schema so defaults apply. */
const crosstabElement = (overrides: Record<string, unknown> = {}): CrosstabElement => {
  const definition = parse({
    schemaVersion: 1,
    layoutMode: 'GRAPHIC',
    paper: A4,
    datasets: [{ name: 'sales', provider: 'sales.by.branch', cardinality: 'many' }],
    bands: [
      {
        type: 'SUMMARY',
        heightMm: 10,
        elements: [
          {
            id: 'ct',
            kind: 'CROSSTAB',
            x: 8,
            y: 0,
            w: 190,
            dataset: 'sales',
            rowBy: '{{ row.branch }}',
            columnBy: '{{ row.month }}',
            measure: '{{ row.amount }}',
            ...overrides,
          },
        ],
      },
    ],
  });
  const element = definition.bands[0].elements[0];
  if (element.kind !== 'CROSSTAB') {
    throw new Error('fixture is not a crosstab');
  }
  return element;
};

/**
 * Reads the three expressions the way the engine does, without the engine.
 *
 * Only `{{ row.field }}` is understood, which is all these fixtures use; the
 * real evaluator is exercised by the through-the-engine block further down.
 */
const fieldOf = (expression: string): keyof SaleRow =>
  expression.replace(/[{}\s]/g, '').replace('row.', '') as keyof SaleRow;

const reader = {
  text: (expression: string, row: unknown) => {
    const value = (row as SaleRow)[fieldOf(expression)];
    return value === undefined || value === null ? '' : String(value);
  },
  number: (expression: string, row: unknown) => Number((row as SaleRow)[fieldOf(expression)] ?? 0),
};

const textOf = (tree: LayoutTree, page: number): string[] =>
  tree.pages[page].primitives
    .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
    .map((primitive) => primitive.text);

// ─── 1. The model ────────────────────────────────────────────────────────────

describe('buildCrosstabModel', () => {
  it('pivots rows against columns and sums the cells', () => {
    const model = buildCrosstabModel(crosstabElement(), SALES, reader);

    expect(model.columns.map((column) => column.label)).toEqual(['Apr', 'Jun', 'May']);
    expect(model.rows.map((row) => row.label)).toEqual(['Chennai', 'Madurai', 'Salem']);

    const chennai = model.rows[0];
    // Two April rows for Chennai, 100 + 50.
    expect(chennai.values[0]).toBe(150);
    expect(chennai.values[1]).toBeNull();
    expect(chennai.values[2]).toBe(250);
    expect(chennai.total).toBe(400);
  });

  it('leaves a cell null rather than zero when no row landed in it', () => {
    const model = buildCrosstabModel(crosstabElement(), SALES, reader);
    // Salem traded only in April; May and June are absent, not zero. A zero
    // would read as "we were open and sold nothing", which is a different fact.
    expect(model.rows[2].values).toEqual([75, null, null]);
  });

  it('totals every column and the grand total', () => {
    const model = buildCrosstabModel(crosstabElement(), SALES, reader);
    expect(model.columnTotals).toEqual([225, 25, 650]);
    expect(model.grandTotal).toBe(900);
  });

  it('keeps FIRST_SEEN in the dataset order, which is how a month axis stays chronological', () => {
    const model = buildCrosstabModel(crosstabElement({ columnSort: 'FIRST_SEEN' }), SALES, reader);
    expect(model.columns.map((column) => column.label)).toEqual(['Apr', 'May', 'Jun']);
  });

  it('folds the columns past maxColumns into one, and the totals still add up', () => {
    const model = buildCrosstabModel(
      crosstabElement({ maxColumns: 2, overflow: 'FOLD', overflowLabel: 'Other' }),
      SALES,
      reader,
    );

    expect(model.columns.map((column) => column.label)).toEqual(['Apr', 'Jun', 'Other']);
    expect(model.columns[2].key).toBe(CROSSTAB_FOLD_KEY);
    // May folded in; Chennai still totals 400 and the grand total is untouched.
    expect(model.rows[0].values).toEqual([150, null, 250]);
    expect(model.rows[0].total).toBe(400);
    expect(model.grandTotal).toBe(900);
  });

  it('CLIP drops the surplus columns and the totals describe only what prints', () => {
    const model = buildCrosstabModel(
      crosstabElement({ maxColumns: 2, overflow: 'CLIP' }),
      SALES,
      reader,
    );

    expect(model.columns.map((column) => column.label)).toEqual(['Apr', 'Jun']);
    expect(model.droppedColumns).toBe(1);
    // 900 less the 650 that May carried.
    expect(model.grandTotal).toBe(250);
    expect(model.rows[0].total).toBe(150);
  });

  it('re-aggregates a folded avg rather than adding the sub-averages', () => {
    const model = buildCrosstabModel(
      crosstabElement({ fn: 'avg', maxColumns: 1, overflow: 'FOLD', columnSort: 'FIRST_SEEN' }),
      SALES,
      reader,
    );

    // Chennai's fold holds one May row of 250; averaging it must give 250, not
    // a sum, and not an average of averages.
    expect(model.rows[0].values[1]).toBe(250);
    // Madurai's fold holds May 400 and Jun 25 -> mean 212.5.
    expect(model.rows[1].values[1]).toBe(212.5);
  });

  it('counts rows, not values, under fn count', () => {
    const model = buildCrosstabModel(crosstabElement({ fn: 'count' }), SALES, reader);
    expect(model.rows[0].values[0]).toBe(2);
    expect(model.grandTotal).toBe(6);
  });

  it('survives an empty dataset', () => {
    const model = buildCrosstabModel(crosstabElement(), [], reader);
    expect(model.rows).toEqual([]);
    expect(model.columns).toEqual([]);
    expect(model.grandTotal).toBeNull();
  });
});

// ─── 2. The plan ─────────────────────────────────────────────────────────────

describe('planCrosstab', () => {
  it('shares the leftover width between the data columns and the totals column', () => {
    const element = crosstabElement({ w: 190, rowHeaderWidthMm: 40 });
    const plan = planCrosstab(element, buildCrosstabModel(element, SALES, reader), measurer);

    // 150mm left, three months plus a totals column.
    expect(plan.columns).toHaveLength(4);
    for (const column of plan.columns) {
      expect(column.wMm).toBeCloseTo(37.5, 5);
    }
    const last = plan.columns[3];
    expect(last.xMm + last.wMm).toBeCloseTo(190, 5);
    expect(plan.columnsCutForWidth).toBe(0);
  });

  it('never draws past its own width when the column width is fixed', () => {
    const element = crosstabElement({ w: 100, rowHeaderWidthMm: 40, columnWidthMm: 25 });
    const plan = planCrosstab(element, buildCrosstabModel(element, SALES, reader), measurer);

    // 60mm of budget at 25mm a column is two slots, and the totals column takes
    // one of them, so exactly one month prints and two are reported cut.
    expect(plan.columns.map((column) => column.label)).toEqual(['Apr', 'Total']);
    expect(plan.columnsCutForWidth).toBe(2);
    const last = plan.columns[1];
    expect(last.xMm + last.wMm).toBeLessThanOrEqual(100.001);
  });

  it('sizes itself from the row count, not from the declared height', () => {
    const element = crosstabElement({ headerHeightMm: 6, rowHeightMm: 5 });
    const plan = planCrosstab(element, buildCrosstabModel(element, SALES, reader), measurer);
    // Header + three branches + the totals row.
    expect(plan.fullHeightMm).toBeCloseTo(6 + 3 * 5 + 5, 5);
  });
});

// ─── 3. Slicing ──────────────────────────────────────────────────────────────

describe('sliceCrosstab', () => {
  const planFor = (overrides: Record<string, unknown> = {}) => {
    const element = crosstabElement({ headerHeightMm: 6, rowHeightMm: 5, ...overrides });
    return planCrosstab(element, buildCrosstabModel(element, SALES, reader), measurer);
  };

  it('takes every row and the totals when the space is there', () => {
    const slice = sliceCrosstab(planFor(), 0, 100, true);
    expect(slice.rowCount).toBe(3);
    expect(slice.withTotals).toBe(true);
    expect(slice.heightMm).toBeCloseTo(26, 5);
  });

  it('takes only the rows that fit under the header', () => {
    // 6mm header + 5mm a row: 17mm holds two rows and no totals.
    const slice = sliceCrosstab(planFor(), 0, 17, true);
    expect(slice.rowCount).toBe(2);
    expect(slice.withTotals).toBe(false);
  });

  it('sends the totals row to its own page rather than dropping it', () => {
    // Exactly enough for the header and all three rows, nothing spare.
    const slice = sliceCrosstab(planFor(), 0, 21, true);
    expect(slice.rowCount).toBe(3);
    expect(slice.withTotals).toBe(false);
  });

  it('reports nothing fitting, which is the engine’s cue to break the page', () => {
    expect(sliceCrosstab(planFor(), 0, 8, true).rowCount).toBe(0);
  });
});

// ─── 4. Through the engine ───────────────────────────────────────────────────

const crosstabTemplate = (
  overrides: Record<string, unknown> = {},
  bandOverrides: Record<string, unknown> = {},
): TemplateDefinition =>
  parse({
    schemaVersion: 1,
    layoutMode: 'GRAPHIC',
    paper: A4,
    datasets: [{ name: 'sales', provider: 'sales.by.branch', cardinality: 'many' }],
    bands: [
      {
        type: 'PAGE_HEADER',
        heightMm: 12,
        elements: [{ id: 'title', kind: 'TEXT', x: 8, y: 2, w: 120, h: 6, value: 'SALES' }],
      },
      {
        type: 'SUMMARY',
        heightMm: 10,
        elements: [
          { id: 'cap', kind: 'TEXT', x: 8, y: 0, w: 80, h: 5, value: 'By branch and month' },
          {
            id: 'ct',
            kind: 'CROSSTAB',
            x: 8,
            y: 6,
            w: 190,
            dataset: 'sales',
            rowBy: '{{ row.branch }}',
            columnBy: '{{ row.month }}',
            measure: '{{ row.amount }}',
            corner: 'Branch',
            format: '#,##0',
            headerHeightMm: 6,
            rowHeightMm: 5,
            ...overrides,
          },
        ],
        ...bandOverrides,
      },
      {
        type: 'REPORT_FOOTER',
        heightMm: 8,
        elements: [{ id: 'end', kind: 'TEXT', x: 8, y: 1, w: 60, h: 5, value: 'END OF REPORT' }],
      },
    ],
  });

const layout = (definition: TemplateDefinition, rows: SaleRow[]): LayoutTree =>
  engine.render({ definition, datasets: { sales: rows }, ctx: {}, sys: { now: '2026-01-01' } });

describe('a crosstab through the layout engine', () => {
  it('prints the corner, the column headers, the cells and the totals', () => {
    const tree = layout(crosstabTemplate(), SALES);
    const text = textOf(tree, 0);

    expect(text).toEqual(expect.arrayContaining(['Branch', 'Apr', 'May', 'Jun', 'Total']));
    expect(text).toEqual(expect.arrayContaining(['Chennai', 'Madurai', 'Salem']));
    // Chennai's April cell, formatted by the element's own pattern.
    expect(text).toContain('150');
    expect(text).toContain('900');
  });

  it('leaves an empty cell where no row landed', () => {
    const tree = layout(crosstabTemplate(), SALES);
    // blankWhenZero defaults on, and a null cell emits no primitive at all --
    // so the three months of Salem contribute exactly one number.
    const numbers = textOf(tree, 0).filter((value) => /^[\d,]+$/.test(value));
    expect(numbers).not.toContain('0');
  });

  it('grows the band past its declared height, so what follows is not overprinted', () => {
    const tree = layout(crosstabTemplate(), SALES);
    const footer = tree.pages[0].primitives.find(
      (primitive): primitive is TextPrimitive =>
        primitive.k === 'text' && primitive.text === 'END OF REPORT',
    );
    const lastRow = tree.pages[0].primitives.find(
      (primitive): primitive is TextPrimitive =>
        primitive.k === 'text' && primitive.text === 'Salem',
    );

    expect(footer).toBeDefined();
    expect(lastRow).toBeDefined();
    // The SUMMARY band declares 10mm; the table alone needs 6 + 3*5 + 5 = 26mm
    // from y=6. A band that had not grown would put the footer over the table.
    expect(footer!.y).toBeGreaterThan(lastRow!.y);
  });

  it('splits a tall table across pages and repeats the column header', () => {
    const many: SaleRow[] = Array.from({ length: 120 }, (_unused, index) => ({
      branch: `Branch ${String(index + 1).padStart(3, '0')}`,
      month: index % 2 === 0 ? 'Apr' : 'May',
      amount: index + 1,
    }));

    const tree = layout(crosstabTemplate(), many);

    expect(tree.pageCount).toBeGreaterThan(1);
    // Every page the table reaches reprints the month headings.
    expect(textOf(tree, 0)).toEqual(expect.arrayContaining(['Apr', 'May']));
    expect(textOf(tree, 1)).toEqual(expect.arrayContaining(['Apr', 'May']));
    // The caption belongs to the first page only; repeating it would read as a
    // second, separate table.
    expect(textOf(tree, 0)).toContain('By branch and month');
    expect(textOf(tree, 1)).not.toContain('By branch and month');

    // No row is lost or printed twice.
    const printed = tree.pages.flatMap((page) =>
      page.primitives
        .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
        .map((primitive) => primitive.text)
        .filter((text) => text.startsWith('Branch ')),
    );
    expect(new Set(printed).size).toBe(120);
    expect(printed).toHaveLength(120);
  });

  it('does not repeat the header when repeatHeader is off', () => {
    const many: SaleRow[] = Array.from({ length: 120 }, (_unused, index) => ({
      branch: `Branch ${index + 1}`,
      month: 'Apr',
      amount: index + 1,
    }));

    const tree = layout(crosstabTemplate({ repeatHeader: false }), many);
    expect(tree.pageCount).toBeGreaterThan(1);
    expect(textOf(tree, 1)).not.toContain('Branch');
  });

  it('keeps the report footer on the last page, after the table ends', () => {
    const many: SaleRow[] = Array.from({ length: 90 }, (_unused, index) => ({
      branch: `Branch ${index + 1}`,
      month: 'Apr',
      amount: index + 1,
    }));

    const tree = layout(crosstabTemplate(), many);
    const lastPage = tree.pages[tree.pageCount - 1];
    expect(
      lastPage.primitives.some(
        (primitive) => primitive.k === 'text' && primitive.text === 'END OF REPORT',
      ),
    ).toBe(true);
  });

  it('warns, rather than silently narrowing, when columns will not fit the width', () => {
    const tree = layout(
      crosstabTemplate({ w: 100, rowHeaderWidthMm: 40, columnWidthMm: 25 }),
      SALES,
    );
    expect(tree.warnings.some((warning) => /did not fit/.test(warning.message))).toBe(true);
  });

  it('draws grid rules only when gridLines is on', () => {
    const ruled = layout(crosstabTemplate(), SALES);
    const bare = layout(crosstabTemplate({ gridLines: false }), SALES);

    const lines = (tree: LayoutTree) =>
      tree.pages[0].primitives.filter((primitive) => primitive.k === 'line').length;

    expect(lines(ruled)).toBeGreaterThan(0);
    expect(lines(bare)).toBe(0);
  });

  it('prints nothing but leaves the report standing when the dataset is empty', () => {
    const tree = layout(crosstabTemplate(), []);
    expect(tree.pageCount).toBe(1);
    expect(textOf(tree, 0)).toContain('END OF REPORT');
  });
});

// ─── 5. What the schema refuses ──────────────────────────────────────────────

describe('crosstab placement rules', () => {
  const attempt = (band: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    templateDefinitionSchema.safeParse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'sales', provider: 'sales.by.branch', cardinality: 'many' }],
      ...extra,
      bands: [band],
    });

  const element = {
    id: 'ct',
    kind: 'CROSSTAB',
    x: 8,
    y: 0,
    w: 190,
    dataset: 'sales',
    rowBy: '{{ row.branch }}',
    columnBy: '{{ row.month }}',
    measure: '{{ row.amount }}',
  };

  it('refuses a crosstab in a DETAIL band', () => {
    const result = attempt({
      type: 'DETAIL',
      heightMm: 6,
      dataset: 'sales',
      elements: [element],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/cannot sit in a DETAIL/);
  });

  it('refuses a crosstab in page furniture', () => {
    const result = attempt({ type: 'PAGE_FOOTER', heightMm: 10, elements: [element] });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/PAGE_FOOTER/);
  });

  it.each(['GROUP_HEADER', 'GROUP_FOOTER'])('refuses a crosstab in a %s band', (type) => {
    // These repeat per group, and a crosstab has no group filter -- it would
    // print the same complete table under every group heading.
    const result = attempt({
      type,
      heightMm: 8,
      dataset: 'sales',
      groupBy: '{{ row.branch }}',
      elements: [element],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/cannot sit in a GROUP_/);
  });

  it('refuses a crosstab bound to a dataset the template does not declare', () => {
    const result = attempt({
      type: 'SUMMARY',
      heightMm: 10,
      elements: [{ ...element, dataset: 'nowhere' }],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/unknown dataset/);
  });

  it('refuses a row-label column that leaves no width for the data', () => {
    const result = attempt({
      type: 'SUMMARY',
      heightMm: 10,
      elements: [{ ...element, w: 40, rowHeaderWidthMm: 40 }],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/no width for the data/);
  });

  it('refuses a crosstab on GRID stationery, which cannot size dynamic columns', () => {
    const result = templateDefinitionSchema.safeParse({
      schemaVersion: 1,
      layoutMode: 'GRID',
      paper: { ...A4, code: 'T80', widthMm: 80, heightMm: null, columns: 48, rows: 200 },
      datasets: [{ name: 'sales', provider: 'sales.by.branch', cardinality: 'many' }],
      bands: [
        {
          type: 'SUMMARY',
          heightMm: 0,
          heightRows: 4,
          elements: [{ ...element, col: 0, row: 0, cols: 40 }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/GRAPHIC-mode element/);
  });

  it('accepts a crosstab in a SUMMARY band', () => {
    const result = attempt({ type: 'SUMMARY', heightMm: 10, elements: [element] });
    expect(result.success).toBe(true);
  });
});

// ─── 6. The shipped crosstab design ──────────────────────────────────────────

/**
 * The quotation rate-matrix fixture, rendered with its own sample data.
 *
 * This is the only test that asserts the ARITHMETIC a reader would check by
 * eye: the crosstab's grand total has to equal the independent `sum` aggregate
 * printed above it, and the column totals have to add up to both. A pivot that
 * disagrees with the invoice it sits on is worse than no pivot.
 */
describe('the shipped quotation-rate-matrix-a4 design', () => {
  const definition = templateDefinitionSchema.parse(loadCanvasFixture('quotation-rate-matrix-a4'));
  const datasets = loadCanvasFixtureSample('quotation-rate-matrix-a4');

  const render = () =>
    engine.render({ definition, datasets, ctx: {}, sys: { now: '2026-09-01T00:00:00.000Z' } });

  it('lays out on one page with no warnings', () => {
    const tree = render();
    expect(tree.warnings).toEqual([]);
    expect(tree.pageCount).toBe(1);
  });

  it('cross-tabulates taxable value by HSN against the GST rate slabs present', () => {
    const text = textOf(render(), 0);
    expect(text).toContain('HSN / SAC');
    // The sample carries 5%, 18% and 28% lines and no 12% line, so no 12%
    // column may appear -- a crosstab prints the columns the DATA has.
    expect(text).toEqual(expect.arrayContaining(['5%', '18%', '28%']));
    expect(text).not.toContain('12%');
  });

  it('agrees with the band aggregate it sits under', () => {
    const rows = datasets.items as Array<{ taxable_amt: number }>;
    const expected = rows.reduce((sum, row) => sum + row.taxable_amt, 0);

    const text = textOf(render(), 0);
    const printed = formatNumber(expected, '#,##0.00');

    // Once for the DETAIL band's own sum aggregate, once for the crosstab's
    // grand total. If the crosstab were wrong, only one would appear.
    expect(text.filter((value) => value === printed).length).toBeGreaterThanOrEqual(2);
  });

  it('splits across pages and repeats its header when the quotation is long', () => {
    const many = Array.from({ length: 70 }, (_unused, index) => ({
      line_no: index + 1,
      item_name: `Article ${index + 1}`,
      hsn_code: `${1000 + (index % 40) * 7}`,
      unit_name: 'PCS',
      qty: 1,
      rate: 100,
      mrp: 120,
      total_disc_amt: 0,
      taxable_amt: 1000 + index * 137.5,
      tax_perc: [5, 12, 18, 28][(index * 3) % 4],
      net_amt: 1000 + index * 137.5,
      is_free: false,
    }));

    const tree = engine.render({
      definition,
      datasets: { ...datasets, items: many },
      ctx: {},
      sys: { now: '2026-09-01T00:00:00.000Z' },
    });

    expect(tree.warnings).toEqual([]);
    expect(tree.pageCount).toBeGreaterThan(1);

    const last = tree.pageCount - 1;
    // The column header reprints on the page the table continues onto.
    expect(textOf(tree, last)).toContain('HSN / SAC');
    // And every HSN in the data is printed exactly once across all pages.
    const printedHsn = tree.pages
      .flatMap((page) => textOf(tree, page.index))
      .filter((value) => /^1\d{3}$/.test(value));
    expect(new Set(printedHsn).size).toBe(40);
  });
});

// ─── 4. Several rows, several columns, several measures ──────────────────────

/**
 * The three axes are LISTS, and each one nests independently.
 *
 * These fixtures are deliberately small enough to add up by eye, because the
 * mistake that matters here is not a crash -- it is a table that looks right
 * and totals the wrong cells. Every case therefore asserts on both the shape
 * (which columns exist, in what order) and the arithmetic behind them.
 */
describe('a crosstab with more than one of each axis', () => {
  interface WideRow {
    year: string;
    month: string;
    hsn: string;
    item: string;
    qty: number;
    amount: number;
  }

  const WIDE: WideRow[] = [
    { year: '2025', month: 'Apr', hsn: '6109', item: 'T-SHIRT', qty: 3, amount: 300 },
    { year: '2025', month: 'Apr', hsn: '6109', item: 'VEST', qty: 2, amount: 150 },
    { year: '2025', month: 'May', hsn: '6109', item: 'T-SHIRT', qty: 4, amount: 400 },
    { year: '2025', month: 'Apr', hsn: '6203', item: 'TROUSER', qty: 1, amount: 500 },
    { year: '2026', month: 'Apr', hsn: '6109', item: 'T-SHIRT', qty: 5, amount: 550 },
    { year: '2026', month: 'Apr', hsn: '6203', item: 'TROUSER', qty: 2, amount: 900 },
  ];

  /** `{{ row.field }}` against a WideRow, which is all these fixtures use. */
  const wideField = (expression: string): keyof WideRow =>
    expression.replace(/[{}\s]/g, '').replace('row.', '') as keyof WideRow;

  const wideReader = {
    text: (expression: string, row: unknown) => {
      const value = (row as WideRow)[wideField(expression)];
      return value === undefined || value === null ? '' : String(value);
    },
    number: (expression: string, row: unknown) =>
      Number((row as WideRow)[wideField(expression)] ?? 0),
  };

  const wideElement = (overrides: Record<string, unknown>): CrosstabElement =>
    crosstabElement({
      rowBy: '{{ row.hsn }}',
      columnBy: '{{ row.year }}',
      measure: '{{ row.amount }}',
      columnSort: 'FIRST_SEEN',
      rowSort: 'FIRST_SEEN',
      ...overrides,
    });

  it('keeps `rowBy`/`columnBy`/`measure` as the first entry of each list', () => {
    const model = buildCrosstabModel(wideElement({}), WIDE, wideReader);

    expect(model.rowAxes).toHaveLength(1);
    expect(model.columnAxes).toHaveLength(1);
    expect(model.measures).toHaveLength(1);
    expect(model.measures[0].expression).toBe('{{ row.amount }}');
    // With no extras the flat model is exactly what it always was.
    expect(model.columns.map((column) => column.label)).toEqual(['2025', '2026']);
    expect(model.rows.map((row) => row.label)).toEqual(['6109', '6203']);
  });

  // ── Several measures ───────────────────────────────────────────────────

  it('splits every column group into one sub-column per measure', () => {
    const model = buildCrosstabModel(
      wideElement({
        measureLabel: 'Amt',
        extraMeasures: [{ expression: '{{ row.qty }}', label: 'Qty', fn: 'sum', format: '#,##0' }],
      }),
      WIDE,
      wideReader,
    );

    // Two years x two measures = four printed columns, measures innermost.
    expect(model.leaves.map((leaf) => leaf.label)).toEqual(['2025', '2026']);
    expect(model.columns.map((column) => [column.label, column.measureIndex])).toEqual([
      ['Amt', 0],
      ['Qty', 1],
      ['Amt', 0],
      ['Qty', 1],
    ]);

    // HSN 6109 in 2025: 300 + 150 + 400 amount, 3 + 2 + 4 qty.
    expect(model.rows[0].values).toEqual([850, 9, 550, 5]);
    expect(model.rows[0].totals).toEqual([1400, 14]);
    expect(model.grandTotals).toEqual([2800, 17]);
  });

  it('gives each measure its own aggregate rather than one for the whole table', () => {
    const model = buildCrosstabModel(
      wideElement({
        fn: 'sum',
        extraMeasures: [
          { expression: '{{ row.amount }}', label: 'Max', fn: 'max', format: '#,##0' },
          { expression: '{{ row.qty }}', label: 'Lines', fn: 'count', format: '#,##0' },
        ],
      }),
      WIDE,
      wideReader,
    );

    const hsn6109in2025 = model.rows[0];
    expect(hsn6109in2025.values[0]).toBe(850); // sum
    expect(hsn6109in2025.values[1]).toBe(400); // max of 300/150/400
    expect(hsn6109in2025.values[2]).toBe(3); // three source lines
    // A row total is a RE-aggregation of the source rows, so the max column's
    // total is the largest single line, not the sum of the per-column maxima.
    expect(hsn6109in2025.totals[1]).toBe(550);
  });

  it('folds surplus columns per measure, keeping each measure honest', () => {
    const model = buildCrosstabModel(
      wideElement({
        columnBy: '{{ row.month }}',
        maxColumns: 1,
        overflow: 'FOLD',
        overflowLabel: 'Other',
        extraMeasures: [{ expression: '{{ row.qty }}', label: 'Qty', fn: 'sum', format: '#,##0' }],
      }),
      WIDE,
      wideReader,
    );

    expect(model.leaves.map((leaf) => leaf.label)).toEqual(['Apr', 'Other']);
    expect(model.leaves[1].key).toBe(CROSSTAB_FOLD_KEY);
    // 6109: April is 300 + 150 + 550 = 1000 (qty 10); May folds to 400 (qty 4).
    expect(model.rows[0].values).toEqual([1000, 10, 400, 4]);
    expect(model.rows[0].totals).toEqual([1400, 14]);
  });

  it('prints a measure caption row and formats each measure its own way', () => {
    const element = wideElement({
      measureLabel: 'Amount',
      format: '#,##0.00',
      extraMeasures: [
        {
          expression: '{{ row.qty }}',
          label: 'Qty',
          fn: 'sum',
          format: '#,##0',
          blankWhenZero: true,
        },
      ],
    });
    const model = buildCrosstabModel(element, WIDE, wideReader);
    const plan = planCrosstab(element, model, measurer);

    // One row for the year, one for the measure captions.
    expect(plan.headerRowCount).toBe(2);
    expect(plan.headerHeightMm).toBeCloseTo(plan.headerRowHeightMm * 2, 5);

    const printed = emitted(plan);
    expect(printed).toContain('Amount');
    expect(printed).toContain('Qty');
    // The amount keeps two decimals, the quantity none -- one format per column.
    expect(printed).toContain(formatNumber(850, '#,##0.00'));
    expect(printed).toContain(formatNumber(9, '#,##0'));
  });

  // ── Nested column levels ───────────────────────────────────────────────

  it('nests column levels instead of interleaving them', () => {
    const model = buildCrosstabModel(
      wideElement({
        columnBy: '{{ row.year }}',
        extraColumnBys: [{ expression: '{{ row.month }}' }],
      }),
      WIDE,
      wideReader,
    );

    // 2025 has April and May; 2026 only April. The leaves are the combinations
    // the data holds, NOT the 2 x 2 cartesian product.
    expect(model.leaves.map((leaf) => leaf.labels)).toEqual([
      ['2025', 'Apr'],
      ['2025', 'May'],
      ['2026', 'Apr'],
    ]);
    expect(model.rows[0].values).toEqual([450, 400, 550]);
    expect(model.rows[0].total).toBe(1400);
  });

  it('sorts a nested column axis level by level, never across levels', () => {
    const model = buildCrosstabModel(
      wideElement({
        columnBy: '{{ row.year }}',
        extraColumnBys: [{ expression: '{{ row.month }}' }],
        columnSort: 'LABEL_DESC',
      }),
      WIDE,
      wideReader,
    );

    // Years descend, and the months descend WITHIN each year -- an axis sorted
    // flat would give 2026-May, 2025-May, 2026-Apr and span nothing.
    expect(model.leaves.map((leaf) => leaf.labels.join(' '))).toEqual([
      '2026 Apr',
      '2025 May',
      '2025 Apr',
    ]);
  });

  it('merges a nested header into spanning cells and rules them separately', () => {
    const element = wideElement({
      columnBy: '{{ row.year }}',
      extraColumnBys: [{ expression: '{{ row.month }}' }],
      showRowTotals: true,
    });
    const model = buildCrosstabModel(element, WIDE, wideReader);
    const plan = planCrosstab(element, model, measurer);

    expect(plan.headerRowCount).toBe(2);

    const primitives = emitCrosstab(plan, {
      xMm: 0,
      yMm: 0,
      slice: sliceCrosstab(plan, 0, 200, true),
      cornerText: 'HSN',
      strokeColour: '#000000',
      textColour: '#000000',
      headerFill: null,
    });
    const texts = primitives.filter((p): p is TextPrimitive => p.k === 'text');

    // '2025' is printed once, over BOTH its months.
    const years = texts.filter((t) => t.text === '2025');
    expect(years).toHaveLength(1);
    const aprils = texts.filter((t) => t.text === 'Apr');
    expect(aprils).toHaveLength(2);
    expect(years[0].w).toBeGreaterThan(aprils[0].w);

    // The totals column is its own group at the top level, so the year cell
    // cannot bleed across it.
    const totalHeading = texts.find((t) => t.text === 'Total' && t.y < plan.headerHeightMm);
    expect(totalHeading).toBeDefined();
    expect(totalHeading!.x).toBeGreaterThan(years[0].x + years[0].w);
  });

  it('spans one Total heading over every measure, not one per measure', () => {
    const element = wideElement({
      measureLabel: 'Amt',
      extraMeasures: [{ expression: '{{ row.qty }}', label: 'Qty', fn: 'sum', format: '#,##0' }],
      showRowTotals: true,
    });
    const plan = planCrosstab(element, buildCrosstabModel(element, WIDE, wideReader), measurer);
    const printed = emitted(plan);

    // Two totals columns, one heading over both -- the reader is told once that
    // this group is the total, and the measure captions below say which is which.
    expect(printed.filter((value) => value === 'Total')).toHaveLength(
      // Once in the header, once as the column-totals row label.
      2,
    );
  });

  // ── Several row levels ─────────────────────────────────────────────────

  it('prints one label column per row level, grouped left to right', () => {
    const element = wideElement({
      rowBy: '{{ row.hsn }}',
      extraRowBys: [{ expression: '{{ row.item }}', label: 'Description' }],
      columnBy: '{{ row.year }}',
    });
    const model = buildCrosstabModel(element, WIDE, wideReader);
    const plan = planCrosstab(element, model, measurer);

    expect(model.rows.map((row) => row.labels)).toEqual([
      ['6109', 'T-SHIRT'],
      ['6109', 'VEST'],
      ['6203', 'TROUSER'],
    ]);
    expect(plan.rowColumns).toHaveLength(2);
    // Both share `rowHeaderWidthMm` when neither names a width.
    expect(plan.rowColumns[0].wMm).toBeCloseTo(plan.rowHeaderWidthMm / 2, 5);
    expect(plan.rowColumns[1].xMm).toBeCloseTo(plan.rowHeaderWidthMm / 2, 5);
  });

  it('honours a fixed width on a row level and shares the rest', () => {
    const element = wideElement({
      rowHeaderWidthMm: 60,
      extraRowBys: [{ expression: '{{ row.item }}', widthMm: 20 }],
    });
    const plan = planCrosstab(element, buildCrosstabModel(element, WIDE, wideReader), measurer);

    expect(plan.rowColumns[0].wMm).toBeCloseTo(40, 5);
    expect(plan.rowColumns[1].wMm).toBeCloseTo(20, 5);
  });

  it('prints a repeated group label once, and again at the top of a new page', () => {
    const element = wideElement({
      extraRowBys: [{ expression: '{{ row.item }}', label: 'Description' }],
    });
    const model = buildCrosstabModel(element, WIDE, wideReader);
    const plan = planCrosstab(element, model, measurer);

    const firstTwo = emitted(
      plan,
      sliceCrosstab(plan, 0, plan.headerHeightMm + plan.rowHeightMm * 2, true),
    );
    // '6109' covers both T-SHIRT and VEST, so it is written once.
    expect(firstTwo.filter((value) => value === '6109')).toHaveLength(1);
    expect(firstTwo).toContain('T-SHIRT');
    expect(firstTwo).toContain('VEST');

    // A continuation slice opens on a row whose group started overleaf; it
    // reprints the group rather than leaving the column blank.
    const continued = emitted(plan, sliceCrosstab(plan, 1, plan.rowHeightMm * 2, false));
    expect(continued).toContain('6109');
  });

  // ── All three at once, through the real engine ─────────────────────────

  it('renders all three nested at once without warnings', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'sales', provider: 'sales.by.branch', cardinality: 'many' }],
      bands: [
        {
          type: 'SUMMARY',
          heightMm: 10,
          autoGrow: true,
          elements: [
            {
              id: 'ct',
              kind: 'CROSSTAB',
              x: 8,
              y: 0,
              w: 190,
              dataset: 'sales',
              corner: 'HSN',
              rowBy: '{{ row.hsn }}',
              // 'Item', not 'Description': the two row levels share the 40mm
              // row header, and a caption wider than its 20mm column is
              // truncated with an ellipsis like any other cell.
              extraRowBys: [{ expression: '{{ row.item }}', label: 'Item' }],
              columnBy: '{{ row.year }}',
              extraColumnBys: [{ expression: '{{ row.month }}' }],
              measure: '{{ row.amount }}',
              measureLabel: 'Amt',
              extraMeasures: [
                { expression: '{{ row.qty }}', label: 'Qty', fn: 'sum', format: '#,##0' },
              ],
              columnSort: 'FIRST_SEEN',
              rowSort: 'FIRST_SEEN',
            },
          ],
        },
      ],
    });

    const tree = engine.render({
      definition,
      datasets: { sales: WIDE },
      ctx: {},
      sys: { now: '2026-09-01T00:00:00.000Z' },
    });

    expect(tree.warnings).toEqual([]);
    const texts = textOf(tree, 0);
    expect(texts).toContain('HSN');
    expect(texts).toContain('Item');
    expect(texts).toContain('2025');
    expect(texts).toContain('Amt');
    expect(texts).toContain('Qty');
    expect(texts).toContain('TROUSER');
  });

  /** The text a slice prints, in order. */
  function emitted(
    plan: ReturnType<typeof planCrosstab>,
    slice = sliceCrosstab(plan, 0, 400, true),
  ) {
    return emitCrosstab(plan, {
      xMm: 0,
      yMm: 0,
      slice,
      cornerText: 'HSN',
      strokeColour: '#000000',
      textColour: '#000000',
      headerFill: null,
    })
      .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
      .map((primitive) => primitive.text);
  }
});
