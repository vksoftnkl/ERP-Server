import {
  TemplateDefinition,
  TemplateDefinitionInput,
  templateDefinitionSchema,
} from '../../templates/dto/template-definition.schema';
import { FontRegistry } from '../fonts/font.registry';
import { LayoutEngine } from './layout.engine';
import { LayoutTree, TextPrimitive } from './layout-tree.types';
import { TextMeasurer } from './text-measure';

/**
 * Phase 3b exit criteria: the five fixtures from the plan produce a correct
 * LayoutTree, with NO RENDERER INVOLVED. That last part is the point — if these
 * pass, pagination, grouping, aggregates and auto-grow are correct independently
 * of PDF, thermal or dot matrix, and a renderer bug can never be a layout bug.
 */

const registry = new FontRegistry();
let engine: LayoutEngine;

beforeAll(() => {
  registry.load();
  engine = new LayoutEngine(new TextMeasurer(registry));
});

/** Parse through the real zod schema, so a fixture cannot drift from the contract. */
const parse = (definition: TemplateDefinitionInput): TemplateDefinition =>
  templateDefinitionSchema.parse(definition);

const A4 = {
  code: 'A4',
  widthMm: 210,
  heightMm: 297,
  orientation: 'PORTRAIT' as const,
  margins: { top: 10, right: 8, bottom: 12, left: 8 },
};

interface LineRow {
  __index: number;
  itemName: string;
  hsnCode: string;
  qty: number;
  netAmount: number;
}

const makeRows = (count: number, hsnCycle = ['1006', '1512', '3401']): LineRow[] =>
  Array.from({ length: count }, (_unused, index) => ({
    __index: index + 1,
    itemName: `Item ${index + 1}`,
    hsnCode: hsnCycle[index % hsnCycle.length],
    qty: index + 1,
    netAmount: (index + 1) * 100,
  }));

/** The standard invoice shape: page header/footer, detail, summary. */
const invoiceTemplate = (overrides: Partial<TemplateDefinitionInput> = {}): TemplateDefinition =>
  parse({
    schemaVersion: 1,
    layoutMode: 'GRAPHIC',
    paper: A4,
    datasets: [
      { name: 'invoice', provider: 'sales.invoice.header', cardinality: 'one' },
      { name: 'items', provider: 'sales.invoice.lines', cardinality: 'many' },
    ],
    bands: [
      {
        type: 'PAGE_HEADER',
        heightMm: 30,
        elements: [
          { id: 'h1', kind: 'TEXT', x: 8, y: 4, w: 120, h: 7, value: 'TAX INVOICE' },
          { id: 'h2', kind: 'TEXT', x: 8, y: 14, w: 120, h: 5, value: '{{ invoice.billNo }}' },
        ],
      },
      {
        type: 'DETAIL',
        dataset: 'items',
        heightMm: 6,
        elements: [
          {
            id: 'd1',
            kind: 'FIELD',
            x: 8,
            y: 0,
            w: 10,
            h: 5,
            value: '{{ row.__index }}',
            align: 'right',
          },
          { id: 'd2', kind: 'FIELD', x: 20, y: 0, w: 90, h: 5, value: '{{ row.itemName }}' },
          {
            id: 'd3',
            kind: 'FIELD',
            x: 150,
            y: 0,
            w: 40,
            h: 5,
            value: "{{ row.netAmount|fmt('#,##0.00') }}",
            align: 'right',
          },
        ],
      },
      {
        type: 'SUMMARY',
        heightMm: 24,
        keepWithLastDetail: true,
        elements: [
          {
            id: 's1',
            kind: 'FIELD',
            x: 150,
            y: 2,
            w: 40,
            h: 5,
            value: "{{ row.netAmount|fmt('#,##0.00') }}",
            align: 'right',
            aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'items' },
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
            x: 160,
            y: 2,
            w: 40,
            h: 5,
            value: 'Page {{ page.number }} of {{ page.total }}',
            align: 'right',
          },
        ],
      },
    ],
    ...overrides,
  });

const textsOf = (tree: LayoutTree, pageIndex: number): string[] =>
  tree.pages[pageIndex].primitives
    .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
    .map((primitive) => primitive.text);

const allTexts = (tree: LayoutTree): string[] =>
  tree.pages.flatMap((_page, index) => textsOf(tree, index));

const render = (definition: TemplateDefinition, datasets: Record<string, unknown>): LayoutTree =>
  engine.render({
    definition,
    datasets,
    ctx: { companyId: 'c1', branchId: 'b1', accYear: '2026-2027', docId: 'd1' },
    // Injected so a snapshot cannot depend on the clock.
    sys: { now: '2026-08-24T00:00:00.000Z' },
  });

// ─── Fixture 1: a long invoice paginates ───────────────────────────────────

describe('fixture: 150-line invoice', () => {
  const tree = () =>
    render(invoiceTemplate(), { invoice: { billNo: 'A/1' }, items: makeRows(150) });

  it('breaks into multiple pages', () => {
    const result = tree();
    // body = 297 - 10 - 12 - 30 - 10 = 235mm; at 6mm a row that is 39 rows/page.
    expect(result.pageCount).toBeGreaterThan(3);
    expect(result.stats.detailRows).toBe(150);
  });

  it('emits every row exactly once, in order, across the pages', () => {
    const result = tree();
    const names = allTexts(result).filter((text) => text.startsWith('Item '));
    expect(names).toHaveLength(150);
    expect(names[0]).toBe('Item 1');
    expect(names[149]).toBe('Item 150');
    expect(new Set(names).size).toBe(150);
  });

  it('never places a band past the bottom of the printable body', () => {
    const result = tree();
    const bodyBottom = 297 - 12; // page height less the bottom margin
    for (const page of result.pages) {
      for (const primitive of page.primitives) {
        if (primitive.k === 'text') {
          expect(primitive.y).toBeLessThanOrEqual(bodyBottom + 0.001);
        }
      }
    }
  });

  it('repeats the page header and footer on every page', () => {
    const result = tree();
    for (let index = 0; index < result.pageCount; index += 1) {
      expect(textsOf(result, index)).toContain('TAX INVOICE');
    }
  });

  it('resolves page.total in the footer, on every page', () => {
    const result = tree();
    // The two-pass numbering: page 1 cannot know the total during pass 1.
    expect(textsOf(result, 0)).toContain(`Page 1 of ${result.pageCount}`);
    expect(textsOf(result, result.pageCount - 1)).toContain(
      `Page ${result.pageCount} of ${result.pageCount}`,
    );
  });

  it('totals the report-scope aggregate over all 150 rows', () => {
    const result = tree();
    // sum of 100..15000 step 100
    const expected = ((150 * 151) / 2) * 100;
    expect(allTexts(result)).toContain('11,32,500.00');
    expect(expected).toBe(1_132_500);
  });

  it('reports no warnings', () => {
    expect(tree().warnings).toEqual([]);
  });
});

// ─── Fixture 2: a single-line invoice ──────────────────────────────────────

describe('fixture: single-line invoice', () => {
  it('fits on one page with the summary not orphaned', () => {
    const result = render(invoiceTemplate(), { invoice: { billNo: 'A/2' }, items: makeRows(1) });
    expect(result.pageCount).toBe(1);
    const texts = textsOf(result, 0);
    expect(texts).toContain('Item 1');
    expect(texts).toContain('100.00'); // the sole row, and the summary total
    expect(texts).toContain('Page 1 of 1');
  });

  it('keeps the summary on the same page as the last detail row', () => {
    // keepWithLastDetail reserves the summary height while placing the final
    // row, so a summary can never land alone on a page of its own.
    const rowsThatNearlyFill = 38;
    const result = render(invoiceTemplate(), {
      invoice: { billNo: 'A/3' },
      items: makeRows(rowsThatNearlyFill),
    });

    const lastPage = result.pages[result.pageCount - 1];
    const lastPageTexts = lastPage.primitives
      .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
      .map((primitive) => primitive.text);

    // The final row and the total must share a page.
    expect(lastPageTexts).toContain(`Item ${rowsThatNearlyFill}`);
    const total = ((rowsThatNearlyFill * (rowsThatNearlyFill + 1)) / 2) * 100;
    expect(lastPageTexts.some((text) => text.replace(/,/g, '') === `${total}.00`)).toBe(true);
  });
});

// ─── Fixture 3: auto-grow with long item names ─────────────────────────────

describe('fixture: long item names reflow', () => {
  const autoGrowTemplate = (): TemplateDefinition =>
    parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'sales.invoice.lines', cardinality: 'many' }],
      bands: [
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
              w: 40,
              h: 5,
              value: '{{ row.itemName }}',
              wrap: true,
            },
          ],
        },
      ],
    });

  it('wraps a long name into multiple lines', () => {
    const result = render(autoGrowTemplate(), {
      items: [
        { itemName: 'Short' },
        {
          itemName:
            'Toor Dal Premium Grade One extra long descriptive product name that must wrap several times',
        },
        { itemName: 'Short again' },
      ],
    });

    const primitives = result.pages[0].primitives.filter(
      (primitive): primitive is TextPrimitive => primitive.k === 'text',
    );
    expect(primitives).toHaveLength(3);
    expect(primitives[0].lines).toHaveLength(1);
    expect(primitives[1].lines.length).toBeGreaterThan(2);
    expect(primitives[2].lines).toHaveLength(1);
  });

  it('grows the band so the following row does not overprint it', () => {
    const result = render(autoGrowTemplate(), {
      items: [
        {
          itemName:
            'Toor Dal Premium Grade One extra long descriptive product name that must wrap several times',
        },
        { itemName: 'Next row' },
      ],
    });

    const primitives = result.pages[0].primitives.filter(
      (primitive): primitive is TextPrimitive => primitive.k === 'text',
    );
    const [grown, next] = primitives;
    const grownBottom = grown.y + grown.lines.length * grown.lineHeightMm;

    // This is the assertion that matters: the reflow actually happened. Without
    // autoGrow the second row would sit 6mm below the first and collide.
    expect(next.y).toBeGreaterThanOrEqual(grownBottom - 0.001);
    expect(next.y).toBeGreaterThan(grown.y + 6);
  });

  it('leaves a non-autoGrow band at its declared height', () => {
    const fixed = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 6,
          autoGrow: false,
          elements: [
            {
              id: 'd1',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 5,
              value: '{{ row.itemName }}',
              wrap: true,
            },
          ],
        },
      ],
    });

    const result = render(fixed, {
      items: [
        { itemName: 'A very long name that wraps into several lines indeed' },
        { itemName: 'B' },
      ],
    });
    const primitives = result.pages[0].primitives.filter(
      (primitive): primitive is TextPrimitive => primitive.k === 'text',
    );
    expect(primitives[1].y - primitives[0].y).toBeCloseTo(6, 6);
  });
});

// ─── Fixture 4: grouping ───────────────────────────────────────────────────

describe('fixture: 3 HSN groups', () => {
  const groupedTemplate = (): TemplateDefinition =>
    parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'sales.invoice.lines', cardinality: 'many' }],
      bands: [
        {
          type: 'GROUP_HEADER',
          dataset: 'items',
          groupBy: '{{ row.hsnCode }}',
          groupLevel: 0,
          heightMm: 6,
          elements: [
            { id: 'gh1', kind: 'TEXT', x: 8, y: 0, w: 60, h: 5, value: 'HSN {{ group.key }}' },
            {
              id: 'gh2',
              kind: 'FIELD',
              x: 150,
              y: 0,
              w: 40,
              h: 5,
              value: "{{ row.netAmount|fmt('0.00') }}",
              align: 'right',
              aggregate: { fn: 'sum', scope: 'GROUP', dataset: 'items' },
            },
          ],
        },
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [
            { id: 'd1', kind: 'FIELD', x: 20, y: 0, w: 90, h: 4, value: '{{ row.itemName }}' },
          ],
        },
        {
          type: 'GROUP_FOOTER',
          dataset: 'items',
          groupBy: '{{ row.hsnCode }}',
          groupLevel: 0,
          heightMm: 6,
          elements: [
            { id: 'gf1', kind: 'TEXT', x: 8, y: 0, w: 60, h: 5, value: 'Total {{ group.key }}' },
            {
              id: 'gf2',
              kind: 'FIELD',
              x: 150,
              y: 0,
              w: 40,
              h: 5,
              value: "{{ row.netAmount|fmt('0.00') }}",
              align: 'right',
              aggregate: { fn: 'sum', scope: 'GROUP', dataset: 'items' },
            },
          ],
        },
        {
          type: 'SUMMARY',
          heightMm: 8,
          elements: [
            {
              id: 's1',
              kind: 'FIELD',
              x: 150,
              y: 0,
              w: 40,
              h: 5,
              value: "{{ row.netAmount|fmt('0.00') }}",
              align: 'right',
              aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'items' },
            },
          ],
        },
      ],
    });

  // Rows pre-sorted by HSN, which is how a grouped report must be fed: the
  // engine breaks on key CHANGE, it does not sort.
  const groupedRows = [
    { itemName: 'Rice A', hsnCode: '1006', netAmount: 100 },
    { itemName: 'Rice B', hsnCode: '1006', netAmount: 200 },
    { itemName: 'Oil A', hsnCode: '1512', netAmount: 300 },
    { itemName: 'Soap A', hsnCode: '3401', netAmount: 400 },
    { itemName: 'Soap B', hsnCode: '3401', netAmount: 500 },
    { itemName: 'Soap C', hsnCode: '3401', netAmount: 600 },
  ];

  it('emits one header and one footer per group', () => {
    const result = render(groupedTemplate(), { items: groupedRows });
    const texts = allTexts(result);
    expect(texts.filter((text) => text.startsWith('HSN '))).toEqual([
      'HSN 1006',
      'HSN 1512',
      'HSN 3401',
    ]);
    expect(texts.filter((text) => text.startsWith('Total '))).toEqual([
      'Total 1006',
      'Total 1512',
      'Total 3401',
    ]);
  });

  it('interleaves headers, rows and footers in the right order', () => {
    const result = render(groupedTemplate(), { items: groupedRows });
    const texts = allTexts(result).filter(
      (text) =>
        text.startsWith('HSN ') || text.startsWith('Total ') || /^(Rice|Oil|Soap)/.test(text),
    );
    expect(texts).toEqual([
      'HSN 1006',
      'Rice A',
      'Rice B',
      'Total 1006',
      'HSN 1512',
      'Oil A',
      'Total 1512',
      'HSN 3401',
      'Soap A',
      'Soap B',
      'Soap C',
      'Total 3401',
    ]);
  });

  it('computes group totals correctly', () => {
    const result = render(groupedTemplate(), { items: groupedRows });
    const texts = allTexts(result);
    expect(texts).toContain('300.00'); // 1006: 100 + 200
    expect(texts).toContain('1500.00'); // 3401: 400 + 500 + 600
  });

  it('makes the report total equal the sum of the group totals', () => {
    // The invariant that catches a group-boundary bug: if a row were counted in
    // the wrong group these would still each look plausible on their own.
    const result = render(groupedTemplate(), { items: groupedRows });
    const texts = allTexts(result);
    expect(texts).toContain('2100.00'); // 300 + 300 + 1500
  });

  it('prints a group total in the HEADER, before its rows have been emitted', () => {
    // The forward reference the pre-pass exists for. An accumulate-as-you-go
    // engine prints 0.00 here.
    const result = render(groupedTemplate(), { items: groupedRows });
    const texts = allTexts(result);
    const firstHeaderIndex = texts.indexOf('HSN 1006');
    const totalAfterHeader = texts.slice(firstHeaderIndex, firstHeaderIndex + 2);
    expect(totalAfterHeader).toContain('300.00');
  });

  it('handles two-level nesting', () => {
    const nested = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'GROUP_HEADER',
          dataset: 'items',
          groupBy: '{{ row.hsnCode }}',
          groupLevel: 0,
          heightMm: 5,
          elements: [
            { id: 'a', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'H0 {{ group.key }}' },
          ],
        },
        {
          type: 'GROUP_HEADER',
          dataset: 'items',
          groupBy: '{{ row.unit }}',
          groupLevel: 1,
          heightMm: 5,
          elements: [
            { id: 'b', kind: 'TEXT', x: 12, y: 0, w: 60, h: 4, value: 'H1 {{ group.key }}' },
          ],
        },
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [
            { id: 'c', kind: 'FIELD', x: 20, y: 0, w: 60, h: 4, value: '{{ row.itemName }}' },
          ],
        },
        {
          type: 'GROUP_FOOTER',
          dataset: 'items',
          groupBy: '{{ row.unit }}',
          groupLevel: 1,
          heightMm: 5,
          elements: [
            { id: 'd', kind: 'TEXT', x: 12, y: 0, w: 60, h: 4, value: 'F1 {{ group.key }}' },
          ],
        },
        {
          type: 'GROUP_FOOTER',
          dataset: 'items',
          groupBy: '{{ row.hsnCode }}',
          groupLevel: 0,
          heightMm: 5,
          elements: [
            { id: 'e', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'F0 {{ group.key }}' },
          ],
        },
      ],
    });

    const result = render(nested, {
      items: [
        { itemName: 'r1', hsnCode: '1006', unit: 'BAG' },
        { itemName: 'r2', hsnCode: '1006', unit: 'BAG' },
        { itemName: 'r3', hsnCode: '1006', unit: 'KG' },
        { itemName: 'r4', hsnCode: '1512', unit: 'LTR' },
      ],
    });

    // Inner footers close before the outer one, and a change at level 0 closes
    // level 1 first even though its own key did not change.
    expect(allTexts(result)).toEqual([
      'H0 1006',
      'H1 BAG',
      'r1',
      'r2',
      'F1 BAG',
      'H1 KG',
      'r3',
      'F1 KG',
      'F0 1006',
      'H0 1512',
      'H1 LTR',
      'r4',
      'F1 LTR',
      'F0 1512',
    ]);
  });
});

// ─── Fixture 5: zero-line document ─────────────────────────────────────────

describe('fixture: zero-line document', () => {
  it('renders the header and a NO_DATA band rather than a void', () => {
    const definition = invoiceTemplate({
      bands: [
        ...invoiceTemplate().bands,
        {
          type: 'NO_DATA',
          heightMm: 12,
          elements: [
            {
              id: 'n1',
              kind: 'TEXT',
              x: 8,
              y: 4,
              w: 120,
              h: 5,
              value: 'No items on this document',
            },
          ],
        },
      ],
    });

    const result = render(definition, { invoice: { billNo: 'A/0' }, items: [] });
    expect(result.pageCount).toBe(1);
    const texts = textsOf(result, 0);
    expect(texts).toContain('TAX INVOICE');
    expect(texts).toContain('No items on this document');
    expect(result.stats.detailRows).toBe(0);
  });

  it('still produces a page when the template has no NO_DATA band', () => {
    const result = render(invoiceTemplate(), { invoice: { billNo: 'A/0' }, items: [] });
    expect(result.pageCount).toBe(1);
    expect(textsOf(result, 0)).toContain('TAX INVOICE');
  });

  it('warns when a dataset a band binds to is absent entirely', () => {
    const result = render(invoiceTemplate(), { invoice: { billNo: 'A/0' } });
    expect(result.warnings.map((warning) => warning.kind)).toContain('missing-dataset');
  });

  it('reports a zero report-scope total rather than blank', () => {
    const result = render(invoiceTemplate(), { invoice: { billNo: 'A/0' }, items: [] });
    expect(textsOf(result, 0)).toContain('0.00');
  });
});

// ─── Behaviour that is not a plan fixture but would bite in production ──────

describe('two repeating sections in one template', () => {
  // A GST invoice needs the item lines AND the HSN/rate tax summary that Rule
  // 46 requires. Two sequential DETAIL bands, each over its own dataset.
  const twoSectionTemplate = (): TemplateDefinition =>
    parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [
        { name: 'items', provider: 'sales.invoice.lines', cardinality: 'many' },
        { name: 'taxes', provider: 'sales.invoice.taxSummary', cardinality: 'many' },
      ],
      bands: [
        {
          type: 'GROUP_HEADER',
          dataset: 'items',
          groupBy: '{{ row.hsnCode }}',
          groupLevel: 0,
          heightMm: 5,
          elements: [
            { id: 'gh', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'G {{ group.key }}' },
          ],
        },
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [
            { id: 'i', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: 'I {{ row.itemName }}' },
          ],
        },
        {
          type: 'DETAIL',
          dataset: 'taxes',
          heightMm: 5,
          elements: [
            { id: 't', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: 'T {{ row.hsnCode }}' },
          ],
        },
        {
          type: 'SUMMARY',
          heightMm: 8,
          elements: [{ id: 's', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'END' }],
        },
      ],
    });

  const data = {
    items: [
      { itemName: 'a', hsnCode: '1006' },
      { itemName: 'b', hsnCode: '1006' },
      { itemName: 'c', hsnCode: '3401' },
    ],
    taxes: [{ hsnCode: '1006' }, { hsnCode: '3401' }],
  };

  it('emits both sections, in declaration order', () => {
    expect(allTexts(render(twoSectionTemplate(), data))).toEqual([
      'G 1006',
      'I a',
      'I b',
      'G 3401',
      'I c',
      'T 1006',
      'T 3401',
      'END',
    ]);
  });

  it('does not fire the items group header while the tax section repeats', () => {
    // Group bands are matched to a detail band by dataset. Without that filter
    // the items' GROUP_HEADER would break again on every tax row.
    const texts = allTexts(render(twoSectionTemplate(), data));
    const lastGroupHeader = texts.lastIndexOf('G 3401');
    const firstTaxRow = texts.indexOf('T 1006');
    expect(lastGroupHeader).toBeLessThan(firstTaxRow);
    expect(texts.filter((text) => text.startsWith('G '))).toHaveLength(2);
  });

  it('counts rows from every section', () => {
    expect(render(twoSectionTemplate(), data).stats.detailRows).toBe(5);
  });

  it('scopes an aggregate to its own dataset, not to every section', () => {
    // The bug this pins: without dataset filtering an item count also counted
    // the tax-summary rows, so a 6-line invoice printed "Items: 10".
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [
        { name: 'items', provider: 'p', cardinality: 'many' },
        { name: 'taxes', provider: 'q', cardinality: 'many' },
      ],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [{ id: 'i', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.amt }}' }],
        },
        {
          type: 'DETAIL',
          dataset: 'taxes',
          heightMm: 5,
          elements: [{ id: 't', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.amt }}' }],
        },
        {
          type: 'SUMMARY',
          heightMm: 20,
          elements: [
            {
              id: 'ic',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 4,
              value: "{{ row.amt|fmt('0') }}",
              aggregate: { fn: 'count', scope: 'REPORT', dataset: 'items' },
            },
            {
              id: 'isum',
              kind: 'FIELD',
              x: 8,
              y: 5,
              w: 40,
              h: 4,
              value: "{{ row.amt|fmt('0') }}",
              aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'items' },
            },
            {
              id: 'tsum',
              kind: 'FIELD',
              x: 8,
              y: 10,
              w: 40,
              h: 4,
              value: "{{ row.amt|fmt('0') }}",
              aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'taxes' },
            },
          ],
        },
      ],
    });

    const texts = allTexts(
      render(definition, {
        items: [{ amt: 10 }, { amt: 20 }, { amt: 30 }],
        taxes: [{ amt: 500 }],
      }),
    );

    // 3 item rows, 60 item total, 500 tax total — not 4 and 560.
    expect(texts.slice(-3)).toEqual(['3', '60', '500']);
  });

  it('warns when an aggregate cannot say which dataset it totals', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [
        { name: 'items', provider: 'p', cardinality: 'many' },
        { name: 'taxes', provider: 'q', cardinality: 'many' },
      ],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [{ id: 'i', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.amt }}' }],
        },
        {
          type: 'DETAIL',
          dataset: 'taxes',
          heightMm: 5,
          elements: [{ id: 't', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.amt }}' }],
        },
        {
          type: 'SUMMARY',
          heightMm: 10,
          elements: [
            {
              id: 'ambiguous',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 4,
              value: "{{ row.amt|fmt('0') }}",
              // No dataset, and the SUMMARY band has none of its own.
              aggregate: { fn: 'sum', scope: 'REPORT' },
            },
          ],
        },
      ],
    });

    const result = render(definition, { items: [{ amt: 10 }], taxes: [{ amt: 5 }] });
    expect(
      result.warnings.some((warning) => warning.message.includes('does not say which dataset')),
    ).toBe(true);
  });

  it('resolves an unqualified aggregate when there is only one repeating dataset', () => {
    // The common case, and it must keep working without a dataset field.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [{ id: 'i', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.amt }}' }],
        },
        {
          type: 'SUMMARY',
          heightMm: 10,
          elements: [
            {
              id: 'sum',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 4,
              value: "{{ row.amt|fmt('0') }}",
              aggregate: { fn: 'sum', scope: 'REPORT' },
            },
          ],
        },
      ],
    });

    const result = render(definition, { items: [{ amt: 10 }, { amt: 20 }] });
    expect(allTexts(result).slice(-1)).toEqual(['30']);
    expect(result.warnings).toEqual([]);
  });

  it('emits NO_DATA at most once when both sections are empty', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [
        { name: 'items', provider: 'p', cardinality: 'many' },
        { name: 'taxes', provider: 'q', cardinality: 'many' },
      ],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [{ id: 'i', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.a }}' }],
        },
        {
          type: 'DETAIL',
          dataset: 'taxes',
          heightMm: 5,
          elements: [{ id: 't', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.b }}' }],
        },
        {
          type: 'NO_DATA',
          heightMm: 8,
          elements: [{ id: 'n', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'NONE' }],
        },
      ],
    });

    expect(allTexts(render(definition, { items: [], taxes: [] }))).toEqual(['NONE']);
  });
});

describe('conditional visibility', () => {
  const conditionalTemplate = (): TemplateDefinition =>
    parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'invoice', provider: 'p', cardinality: 'one' }],
      bands: [
        {
          type: 'REPORT_HEADER',
          heightMm: 20,
          elements: [
            { id: 'a', kind: 'TEXT', x: 8, y: 0, w: 60, h: 5, value: 'always' },
            {
              id: 'b',
              kind: 'TEXT',
              x: 8,
              y: 6,
              w: 60,
              h: 5,
              value: 'conditional',
              visible: '{{ invoice.einvoiceApplicable }}',
            },
          ],
        },
      ],
    });

  it('emits a conditional element when the condition holds', () => {
    const result = render(conditionalTemplate(), { invoice: { einvoiceApplicable: true } });
    expect(textsOf(result, 0)).toEqual(['always', 'conditional']);
  });

  it('omits it when the condition does not', () => {
    const result = render(conditionalTemplate(), { invoice: { einvoiceApplicable: false } });
    expect(textsOf(result, 0)).toEqual(['always']);
  });

  it('suppresses a whole band on a band-level condition', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'invoice', provider: 'p', cardinality: 'one' }],
      bands: [
        {
          type: 'REPORT_HEADER',
          heightMm: 20,
          visible: '{{ invoice.show }}',
          elements: [{ id: 'a', kind: 'TEXT', x: 8, y: 0, w: 60, h: 5, value: 'header' }],
        },
        {
          type: 'SUMMARY',
          heightMm: 10,
          elements: [{ id: 'b', kind: 'TEXT', x: 8, y: 0, w: 60, h: 5, value: 'summary' }],
        },
      ],
    });

    expect(textsOf(render(definition, { invoice: { show: false } }), 0)).toEqual(['summary']);
    // And the suppressed band must not consume vertical space either.
    const shown = render(definition, { invoice: { show: true } });
    const hidden = render(definition, { invoice: { show: false } });
    const shownSummaryY = (
      shown.pages[0].primitives.find(
        (primitive): primitive is TextPrimitive =>
          primitive.k === 'text' && primitive.text === 'summary',
      ) as TextPrimitive
    ).y;
    const hiddenSummaryY = (
      hidden.pages[0].primitives.find(
        (primitive): primitive is TextPrimitive =>
          primitive.k === 'text' && primitive.text === 'summary',
      ) as TextPrimitive
    ).y;
    expect(shownSummaryY - hiddenSummaryY).toBeCloseTo(20, 6);
  });
});

describe('aggregate scopes', () => {
  const aggregateTemplate = (scope: 'PAGE' | 'REPORT'): TemplateDefinition =>
    parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: { ...A4, heightMm: 100 },
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 10,
          elements: [
            { id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 5, value: '{{ row.itemName }}' },
          ],
        },
        {
          type: 'PAGE_FOOTER',
          heightMm: 10,
          elements: [
            {
              id: 'pf',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 60,
              h: 5,
              value: "{{ row.netAmount|fmt('0.00') }}",
              aggregate: { fn: 'sum', scope, dataset: 'items' },
            },
          ],
        },
      ],
    });

  it('accumulates a PAGE-scope total per page, not across the report', () => {
    // 100mm page, 10 top/12 bottom margin, 10mm footer -> 68mm body -> 6 rows.
    const result = render(aggregateTemplate('PAGE'), { items: makeRows(9) });
    expect(result.pageCount).toBeGreaterThan(1);

    const footerTotals = result.pages.map((page) => {
      const footer = page.primitives
        .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
        .slice(-1)[0];
      return Number(footer.text.replace(/,/g, ''));
    });

    const grandTotal = ((9 * 10) / 2) * 100;
    expect(footerTotals.reduce((sum, value) => sum + value, 0)).toBeCloseTo(grandTotal, 6);
    // And no single page carries the whole thing.
    expect(footerTotals.every((total) => total < grandTotal)).toBe(true);
  });

  it('repeats the same REPORT-scope total on every page', () => {
    const result = render(aggregateTemplate('REPORT'), { items: makeRows(9) });
    const footerTotals = result.pages.map((page) => {
      const footer = page.primitives
        .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
        .slice(-1)[0];
      return Number(footer.text.replace(/,/g, ''));
    });
    expect(new Set(footerTotals).size).toBe(1);
    expect(footerTotals[0]).toBeCloseTo(((9 * 10) / 2) * 100, 6);
  });

  it('supports count, avg, min and max', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [
            { id: 'd', kind: 'FIELD', x: 8, y: 0, w: 40, h: 4, value: '{{ row.itemName }}' },
          ],
        },
        {
          type: 'SUMMARY',
          heightMm: 30,
          elements: [
            {
              id: 'c',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 4,
              value: "{{ row.qty|fmt('0') }}",
              aggregate: { fn: 'count', scope: 'REPORT' },
            },
            {
              id: 'a',
              kind: 'FIELD',
              x: 8,
              y: 6,
              w: 40,
              h: 4,
              value: "{{ row.qty|fmt('0.00') }}",
              aggregate: { fn: 'avg', scope: 'REPORT' },
            },
            {
              id: 'mn',
              kind: 'FIELD',
              x: 8,
              y: 12,
              w: 40,
              h: 4,
              value: "{{ row.qty|fmt('0') }}",
              aggregate: { fn: 'min', scope: 'REPORT' },
            },
            {
              id: 'mx',
              kind: 'FIELD',
              x: 8,
              y: 18,
              w: 40,
              h: 4,
              value: "{{ row.qty|fmt('0') }}",
              aggregate: { fn: 'max', scope: 'REPORT' },
            },
          ],
        },
      ],
    });

    const result = render(definition, {
      items: [
        { itemName: 'a', qty: 2 },
        { itemName: 'b', qty: 4 },
        { itemName: 'c', qty: 9 },
      ],
    });
    const texts = textsOf(result, 0);
    expect(texts).toContain('3'); // count
    expect(texts).toContain('5.00'); // avg (2+4+9)/3
    expect(texts).toContain('2'); // min
    expect(texts).toContain('9'); // max
  });
});

describe('aggregate.over', () => {
  it('aggregates the raw expression when the display format destroys the sign', () => {
    // Without `over`, the sum reads the formatted '(5,000.00)' and the credit
    // vanishes: the total would be 60 rather than 50.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'rows', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'rows',
          heightMm: 5,
          elements: [
            {
              id: 'd',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 4,
              value: "{{ row.amt|fmt('#,##0.00;(#,##0.00)') }}",
              align: 'right',
            },
          ],
        },
        {
          type: 'SUMMARY',
          heightMm: 10,
          elements: [
            {
              id: 's',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 4,
              value: "{{ row.amt|fmt('#,##0.00;(#,##0.00)') }}",
              align: 'right',
              aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'rows', over: '{{ row.amt }}' },
            },
          ],
        },
      ],
    });

    const texts = allTexts(render(definition, { rows: [{ amt: 40 }, { amt: 20 }, { amt: -10 }] }));
    expect(texts).toEqual(['40.00', '20.00', '(10.00)', '50.00']);
  });

  it('makes a report total equal the sum of its group subtotals', () => {
    // The invariant a statement is read for. A sign lost anywhere breaks it.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'rows', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'rows',
          heightMm: 4,
          elements: [{ id: 'd', kind: 'FIELD', x: 8, y: 0, w: 40, h: 3, value: '{{ row.ref }}' }],
        },
        {
          type: 'GROUP_FOOTER',
          dataset: 'rows',
          groupBy: '{{ row.bucket }}',
          groupLevel: 0,
          heightMm: 4,
          elements: [
            {
              id: 'gf',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 3,
              value: "{{ row.amt|fmt('0.00;(0.00)') }}",
              aggregate: { fn: 'sum', scope: 'GROUP', dataset: 'rows', over: '{{ row.amt }}' },
            },
          ],
        },
        {
          type: 'SUMMARY',
          heightMm: 8,
          elements: [
            {
              id: 's',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 40,
              h: 3,
              value: "{{ row.amt|fmt('0.00;(0.00)') }}",
              aggregate: { fn: 'sum', scope: 'REPORT', dataset: 'rows', over: '{{ row.amt }}' },
            },
          ],
        },
      ],
    });

    const texts = allTexts(
      render(definition, {
        rows: [
          { ref: 'a', bucket: 'old', amt: 100 },
          { ref: 'b', bucket: 'new', amt: 60 },
          { ref: 'c', bucket: 'new', amt: -10 },
        ],
      }),
    );

    const subtotals = texts
      .filter((text) => /^\(?\d/.test(text))
      .map((text) => (text.startsWith('(') ? -Number(text.slice(1, -1)) : Number(text)));
    // [100, 50, 150] — the last is the report total, and it equals 100 + 50.
    expect(subtotals).toEqual([100, 50, 150]);
    expect(subtotals[2]).toBe(subtotals[0] + subtotals[1]);
  });
});

describe('GRID mode measurement', () => {
  it('wraps and grows by CHARACTERS, not millimetres', () => {
    // The bug this pins: GRID autoGrow ran the millimetre text measurer over a
    // column count, so a 48-column receipt row measured 48mm of proportional
    // text and grew to six lines instead of two.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRID',
      paper: {
        code: 'T80',
        widthMm: 80,
        heightMm: null,
        orientation: 'PORTRAIT',
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        columns: 48,
      },
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightRows: 1,
          heightMm: 1,
          autoGrow: true,
          elements: [
            {
              id: 'n',
              kind: 'FIELD',
              col: 0,
              row: 0,
              cols: 20,
              x: 0,
              y: 0,
              w: 20,
              h: 1,
              value: '{{ row.name }}',
              wrap: true,
            },
          ],
        },
      ],
    });

    const tree = render(definition, {
      items: [{ name: 'short' }, { name: 'a name that needs exactly three lines of twenty' }],
    });

    const primitives = tree.pages[0].primitives.filter(
      (primitive): primitive is TextPrimitive => primitive.k === 'text',
    );

    // Every wrapped line must fit the 20-column budget.
    for (const line of primitives[1].lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
    // And the second row starts one LINE below the first, not one millimetre.
    expect(primitives[0].lineHeightMm).toBe(1);
    expect(primitives[1].y - primitives[0].y).toBe(1);
  });

  it('paginates a GRID page on the form length in LINES', () => {
    // paper.rows is the form length. Using paper.heightMm here put the page
    // footer of a 66-line form at line 277 — two hundred blank lines a page.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRID',
      paper: {
        code: 'DM80',
        widthMm: 241.3,
        heightMm: 279.4,
        orientation: 'PORTRAIT',
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        columns: 80,
        rows: 20,
      },
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'PAGE_HEADER',
          heightRows: 2,
          heightMm: 2,
          elements: [
            {
              id: 'h',
              kind: 'TEXT',
              col: 0,
              row: 0,
              cols: 40,
              x: 0,
              y: 0,
              w: 40,
              h: 1,
              value: 'HEAD',
            },
          ],
        },
        {
          type: 'DETAIL',
          dataset: 'items',
          heightRows: 1,
          heightMm: 1,
          elements: [
            {
              id: 'd',
              kind: 'FIELD',
              col: 0,
              row: 0,
              cols: 40,
              x: 0,
              y: 0,
              w: 40,
              h: 1,
              value: '{{ row.n }}',
            },
          ],
        },
        {
          type: 'PAGE_FOOTER',
          heightRows: 2,
          heightMm: 2,
          elements: [
            {
              id: 'f',
              kind: 'TEXT',
              col: 0,
              row: 0,
              cols: 40,
              x: 0,
              y: 0,
              w: 40,
              h: 1,
              value: 'FOOT',
            },
          ],
        },
      ],
    });

    // body = 20 - 2 header - 2 footer = 16 lines, so 40 rows is 3 pages.
    const tree = render(definition, {
      items: Array.from({ length: 40 }, (_unused, index) => ({ n: `r${index}` })),
    });
    expect(tree.pageCount).toBe(3);

    // The footer sits at line 18 (header 2 + body 16), not somewhere past 200.
    const footer = tree.pages[0].primitives.find(
      (primitive): primitive is TextPrimitive =>
        primitive.k === 'text' && primitive.text === 'FOOT',
    );
    expect(footer?.y).toBe(18);
  });
});

describe('explicit page breaks', () => {
  it('breaks after the band carrying a PAGEBREAK element', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 6,
          elements: [
            { id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 5, value: '{{ row.itemName }}' },
            { id: 'pb', kind: 'PAGEBREAK', x: 0, y: 0, when: '{{ row.breakAfter }}' },
          ],
        },
      ],
    });

    const result = render(definition, {
      items: [
        { itemName: 'a', breakAfter: false },
        { itemName: 'b', breakAfter: true },
        { itemName: 'c', breakAfter: false },
      ],
    });

    expect(result.pageCount).toBe(2);
    // The band that requested the break still appears above it.
    expect(textsOf(result, 0)).toEqual(['a', 'b']);
    expect(textsOf(result, 1)).toEqual(['c']);
  });
});

describe('printOn', () => {
  const printOnTemplate = (
    printOn: 'FIRST_PAGE' | 'NOT_FIRST_PAGE' | 'LAST_PAGE' | 'NOT_LAST_PAGE',
  ) =>
    parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: { ...A4, heightMm: 80 },
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 10,
          elements: [
            { id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 5, value: '{{ row.itemName }}' },
          ],
        },
        {
          type: 'PAGE_FOOTER',
          heightMm: 8,
          printOn,
          elements: [{ id: 'f', kind: 'TEXT', x: 8, y: 0, w: 60, h: 5, value: 'FOOT' }],
        },
      ],
    });

  const footerPages = (
    printOn: 'FIRST_PAGE' | 'NOT_FIRST_PAGE' | 'LAST_PAGE' | 'NOT_LAST_PAGE',
  ) => {
    const result = render(printOnTemplate(printOn), { items: makeRows(12) });
    expect(result.pageCount).toBeGreaterThan(2);
    return {
      total: result.pageCount,
      pages: result.pages
        .filter((page) =>
          page.primitives.some((primitive) => primitive.k === 'text' && primitive.text === 'FOOT'),
        )
        .map((page) => page.index),
    };
  };

  it('FIRST_PAGE prints only on page 1', () => {
    expect(footerPages('FIRST_PAGE').pages).toEqual([0]);
  });

  it('NOT_FIRST_PAGE skips page 1', () => {
    const { total, pages } = footerPages('NOT_FIRST_PAGE');
    expect(pages).not.toContain(0);
    expect(pages).toHaveLength(total - 1);
  });

  it('LAST_PAGE prints only on the final page', () => {
    // Decidable only in pass 2 — the last page is not known during pass 1.
    const { total, pages } = footerPages('LAST_PAGE');
    expect(pages).toEqual([total - 1]);
  });

  it('NOT_LAST_PAGE skips the final page', () => {
    const { total, pages } = footerPages('NOT_LAST_PAGE');
    expect(pages).not.toContain(total - 1);
    expect(pages).toHaveLength(total - 1);
  });
});

describe('robustness', () => {
  it('does not loop on a band taller than the page body', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: { ...A4, heightMm: 60 },
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 200,
          elements: [
            { id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 5, value: '{{ row.itemName }}' },
          ],
        },
      ],
    });

    const result = render(definition, { items: makeRows(3) });
    expect(result.pageCount).toBe(3);
    expect(result.warnings.map((warning) => warning.kind)).toContain('band-too-tall');
  });

  it('collects an expression failure as a warning and still renders', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 6,
          elements: [
            { id: 'd1', kind: 'FIELD', x: 8, y: 0, w: 60, h: 5, value: '{{ row.itemName }}' },
            { id: 'd2', kind: 'FIELD', x: 80, y: 0, w: 60, h: 5, value: '{{ !!! }}' },
          ],
        },
      ],
    });

    const result = render(definition, { items: makeRows(2) });
    expect(textsOf(result, 0)).toContain('Item 1');
    expect(result.warnings.some((warning) => warning.kind === 'expression')).toBe(true);
  });

  it('treats continuous stationery as an unbounded page', () => {
    // A thermal roll has no page height; pagination happens only on explicit
    // breaks, so 200 rows must NOT produce 200 pages.
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: {
        code: 'T80',
        widthMm: 80,
        heightMm: null,
        orientation: 'PORTRAIT',
        margins: { top: 2, right: 2, bottom: 2, left: 2 },
      },
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [
            { id: 'd', kind: 'FIELD', x: 2, y: 0, w: 60, h: 4, value: '{{ row.itemName }}' },
          ],
        },
      ],
    });

    const result = render(definition, { items: makeRows(200) });
    expect(result.pageCount).toBe(1);
    expect(result.stats.detailRows).toBe(200);
  });

  it('exposes row position helpers', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 6,
          elements: [
            {
              id: 'd',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 60,
              h: 5,
              value: '{{ row.__index }}/{{ row.__count }}{{ row.__isLast ? " END" : "" }}',
            },
          ],
        },
      ],
    });

    const result = render(definition, { items: [{ a: 1 }, { a: 2 }, { a: 3 }] });
    expect(textsOf(result, 0)).toEqual(['1/3', '2/3', '3/3 END']);
  });

  it('blanks a zero value when blankWhenZero is set', () => {
    const definition = parse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A4,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 6,
          elements: [
            {
              id: 'd',
              kind: 'FIELD',
              x: 8,
              y: 0,
              w: 60,
              h: 5,
              value: "{{ row.disc|fmt('0.00') }}",
              blankWhenZero: true,
            },
          ],
        },
      ],
    });

    const result = render(definition, { items: [{ disc: 0 }, { disc: 12.5 }, { disc: 0 }] });
    expect(textsOf(result, 0)).toEqual(['12.50']);
  });
});
