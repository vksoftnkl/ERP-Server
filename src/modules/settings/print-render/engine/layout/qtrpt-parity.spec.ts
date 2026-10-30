import {
  TemplateDefinition,
  templateDefinitionSchema,
} from '../../definition/template-definition.schema';
import { FontRegistry } from '../fonts/font.registry';
import { BarcodeFactory } from '../renderers/barcode.factory';
import { ImageCache } from '../renderers/image.cache';
import { PdfKitRenderer } from '../renderers/pdfkit.renderer';
import { LayoutEngine } from './layout.engine';
import {
  LayoutTree,
  LinePrimitive,
  PathPrimitive,
  Primitive,
  RectPrimitive,
  TextPrimitive,
} from './layout-tree.types';
import { decodeEntities, parseMarkup } from './markup';
import { TextMeasurer } from './text-measure';

/**
 * The QtRPT designer features the engine prints: field frames and line
 * styles, background fill, conditional formatting, strikeout, justify, text
 * rotation, inline markup, stretch-with-band, arrows, shapes, charts,
 * watermarks, report pages, start-new-page and page-number restarts.
 */

const registry = new FontRegistry();
let engine: LayoutEngine;

beforeAll(() => {
  registry.load();
  engine = new LayoutEngine(new TextMeasurer(registry));
});

const A5 = {
  code: 'A5',
  widthMm: 148,
  heightMm: 210,
  orientation: 'PORTRAIT' as const,
  margins: { top: 5, right: 5, bottom: 5, left: 5 },
};

const ITEMS = { name: 'items', provider: 'sales.bill.items', cardinality: 'many' as const };

/** Loose input on purpose: the schema parse is the type check. */
const define = (overrides: Record<string, unknown>): TemplateDefinition =>
  templateDefinitionSchema.parse({
    schemaVersion: 1,
    layoutMode: 'GRAPHIC',
    paper: A5,
    datasets: [ITEMS],
    bands: [],
    ...overrides,
  });

const render = (definition: TemplateDefinition, items: unknown[] = []): LayoutTree =>
  engine.render({ definition, datasets: { items }, ctx: {}, sys: { now: '2026-10-13' } });

const of = <K extends Primitive['k']>(tree: LayoutTree, page: number, k: K) =>
  tree.pages[page].primitives.filter((primitive) => primitive.k === k) as Extract<
    Primitive,
    { k: K }
  >[];

const summary = (elements: unknown[], extra: Record<string, unknown> = {}) => ({
  type: 'SUMMARY' as const,
  heightMm: 40,
  elements,
  ...extra,
});

describe('field frames', () => {
  it('prints all four sides as one rectangle, after the text', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'cell',
              kind: 'TEXT',
              x: 10,
              y: 2,
              w: 30,
              h: 6,
              value: 'Qty',
              border: {
                top: true,
                right: true,
                bottom: true,
                left: true,
                widthPt: 1,
                style: 'DASH',
              },
            },
          ]),
        ],
      }),
    );

    const primitives = tree.pages[0].primitives;
    expect(primitives.map((primitive) => primitive.k)).toEqual(['text', 'rect']);
    expect(primitives[1]).toMatchObject({
      x: 10,
      y: 7,
      w: 30,
      h: 6,
      fill: null,
      stroke: '#000000',
      strokeWidthPt: 1,
      dash: 'DASH',
    });
  });

  it('prints chosen sides as lines that meet cleanly at the corner', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'cell',
              kind: 'TEXT',
              x: 10,
              y: 0,
              w: 30,
              h: 6,
              value: 'x',
              border: { top: true, left: true, color: '#ff0000' },
            },
          ]),
        ],
      }),
    );

    const lines = of(tree, 0, 'line');
    expect(lines).toHaveLength(2);
    const [top, left] = lines;
    // 0.5pt default width: the top rule reaches half a line width past the left one.
    expect(top.x1).toBeLessThan(10);
    expect(top.x2).toBe(40);
    expect(top.y1).toBe(5);
    expect(left).toMatchObject({ x1: 10, y1: 5, x2: 10, y2: 11, color: '#ff0000' });
    expect(top.dash).toBeUndefined();
  });

  it('frames a blanked-zero cell, so a grid row keeps its lines', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'amount',
              kind: 'TEXT',
              x: 10,
              y: 0,
              w: 30,
              h: 6,
              value: '0.00',
              blankWhenZero: true,
              border: { top: true, right: true, bottom: true, left: true },
            },
          ]),
        ],
      }),
    );
    expect(of(tree, 0, 'text')).toHaveLength(0);
    expect(of(tree, 0, 'rect')).toHaveLength(1);
  });

  it('draws nothing in GRID mode, where a frame has no characters', () => {
    const tree = engine.render({
      definition: templateDefinitionSchema.parse({
        schemaVersion: 1,
        layoutMode: 'GRID',
        paper: { ...A5, code: 'T80', heightMm: null, columns: 48 },
        bands: [
          {
            type: 'REPORT_HEADER',
            heightMm: 1,
            heightRows: 1,
            elements: [
              {
                id: 't',
                kind: 'TEXT',
                col: 0,
                row: 0,
                cols: 10,
                value: 'HI',
                border: { top: true, right: true, bottom: true, left: true },
              },
            ],
          },
        ],
      }),
      datasets: {},
      ctx: {},
    });
    expect(tree.pages[0].primitives.map((primitive) => primitive.k)).toEqual(['text']);
  });
});

describe('text styling', () => {
  it('prints the background fill behind the text', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 't',
              kind: 'TEXT',
              x: 10,
              y: 0,
              w: 20,
              h: 5,
              value: 'Total',
              style: { fill: '#eeeeee' },
            },
          ]),
        ],
      }),
    );
    const [fill, text] = tree.pages[0].primitives;
    expect(fill).toMatchObject({ k: 'rect', fill: '#eeeeee', stroke: null, x: 10, w: 20, h: 5 });
    expect(text.k).toBe('text');
  });

  it('applies conditional formatting per row, and colour expressions see the row', () => {
    const tree = render(
      define({
        bands: [
          {
            type: 'DETAIL',
            dataset: 'items',
            heightMm: 6,
            elements: [
              {
                id: 'amount',
                kind: 'FIELD',
                x: 10,
                y: 0,
                w: 30,
                h: 5,
                value: '{{ row.amount }}',
                style: { color: "{{ row.amount < 0 ? '#ff0000' : '#000000' }}" },
                highlights: [
                  { when: '{{ row.amount > 100 }}', bold: true, strikeout: true, fill: '#ffff00' },
                ],
              },
            ],
          },
        ],
      }),
      [{ amount: -5 }, { amount: 50 }, { amount: 500 }],
    );

    const texts = of(tree, 0, 'text');
    expect(texts.map((text) => text.color)).toEqual(['#ff0000', '#000000', '#000000']);
    expect(texts.map((text) => text.font.bold)).toEqual([false, false, true]);
    expect(texts[2].font.strikeout).toBe(true);
    // Only the highlighted row gets a background.
    expect(of(tree, 0, 'rect').map((rect) => rect.fill)).toEqual(['#ffff00']);
  });

  it('marks every line but a paragraph’s last for justification', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'terms',
              kind: 'TEXT',
              x: 10,
              y: 0,
              w: 30,
              h: 30,
              wrap: true,
              align: 'justify',
              value:
                'Goods once sold will not be taken back or exchanged under any circumstances.\nThank you',
            },
          ]),
        ],
      }),
    );
    const [text] = of(tree, 0, 'text');
    expect(text.lines.length).toBeGreaterThan(2);
    expect(text.justify).toHaveLength(text.lines.length);
    expect(text.justify?.[text.justify.length - 1]).toBe(false);
    expect(text.justify?.[text.lines.length - 2]).toBe(false); // end of the first paragraph
    expect(text.justify?.[0]).toBe(true);
  });

  it('wraps sideways text to the box height', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'side',
              kind: 'TEXT',
              x: 10,
              y: 0,
              w: 6,
              h: 40,
              wrap: true,
              rotation: 270,
              value: 'Authorised signatory',
            },
          ]),
        ],
      }),
    );
    const [text] = of(tree, 0, 'text');
    expect(text.rotation).toBe(270);
    // 40mm is plenty for the phrase at 9pt; at the 6mm width it would wrap.
    expect(text.lines).toEqual(['Authorised signatory']);
  });
});

describe('markup', () => {
  it('parses tags from the template, never from data', () => {
    expect(parseMarkup('Total <b>{{ row.name }}</b> &amp; tax')).toEqual([
      { template: 'Total ', style: {} },
      { template: '{{ row.name }}', style: { bold: true } },
      { template: ' & tax', style: {} },
    ]);
    expect(decodeEntities('a &lt;b&gt; &#65;')).toBe('a <b> A');

    const tree = render(
      define({
        bands: [
          {
            type: 'DETAIL',
            dataset: 'items',
            heightMm: 6,
            elements: [
              {
                id: 'name',
                kind: 'FIELD',
                x: 10,
                y: 0,
                w: 80,
                h: 5,
                markup: true,
                value: '<font color="red">*</font> {{ row.name }}<sup>2</sup>',
              },
            ],
          },
        ],
      }),
      [{ name: 'A<b>B' }],
    );
    const [text] = of(tree, 0, 'text');
    expect(text.lines).toEqual(['* A<b>B2']);
    expect(text.rich?.[0].map((run) => [run.text, run.color, run.shift ?? null])).toEqual([
      ['*', '#ff0000', null],
      [' A<b>B', '#000000', null],
      ['2', '#000000', 'sup'],
    ]);
    expect(text.rich?.[0][2].font.sizePt).toBeCloseTo(9 * 0.7);
  });
});

describe('markup parser parity with the designer', () => {
  // The same cases as the client's lib/markup.test.ts: the canvas and the PDF
  // must split a template into the same runs.
  it('nests, closes back to the outer style, and reads font and span styles', () => {
    expect(
      parseMarkup(
        '<font color="red" size="5">A<i>B</i></font><span style="font-weight:bold;text-decoration:line-through">C</span>x<sup>2</sup>',
      ),
    ).toEqual([
      { template: 'A', style: { color: '#ff0000', sizePt: 18 } },
      { template: 'B', style: { color: '#ff0000', sizePt: 18, italic: true } },
      { template: 'C', style: { bold: true, strikeout: true } },
      { template: 'x', style: {} },
      { template: '2', style: { shift: 'sup' } },
    ]);
  });

  it('turns <br> and a closing </p> into hard breaks and drops unknown tags', () => {
    expect(parseMarkup('<p>One</p>Two<br/>Three <blink>!</blink>')).toEqual([
      { template: 'One\nTwo\nThree !', style: {} },
    ]);
    expect(parseMarkup("{{ a < b ? '<b>' : '' }}")).toEqual([
      { template: "{{ a < b ? '<b>' : '' }}", style: {} },
    ]);
    expect(parseMarkup('a < b')).toEqual([{ template: 'a < b', style: {} }]);
  });
});

describe('padding', () => {
  it('insets the text inside its frame', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'cell',
              kind: 'TEXT',
              x: 10,
              y: 0,
              w: 30,
              h: 8,
              value: 'Qty',
              style: { padding: 1 },
              border: { top: true, right: true, bottom: true, left: true },
            },
          ]),
        ],
      }),
    );
    const [text] = of(tree, 0, 'text');
    const [frame] = of(tree, 0, 'rect');
    expect(text).toMatchObject({ x: 11, y: 6, w: 28, h: 6 });
    expect(frame).toMatchObject({ x: 10, y: 5, w: 30, h: 8 });
  });
});

describe('stretch with band', () => {
  it('grows a cell frame to the height its wrapped neighbour forced', () => {
    const tree = render(
      define({
        bands: [
          {
            type: 'DETAIL',
            dataset: 'items',
            heightMm: 6,
            autoGrow: true,
            elements: [
              {
                id: 'desc',
                kind: 'FIELD',
                x: 10,
                y: 0,
                w: 20,
                h: 6,
                wrap: true,
                value: '{{ row.name }}',
                stretchWithBand: true,
                border: { top: true, right: true, bottom: true, left: true },
              },
              {
                id: 'qty',
                kind: 'FIELD',
                x: 30,
                y: 0,
                w: 15,
                h: 6,
                value: '{{ row.qty }}',
                stretchWithBand: true,
                border: { top: true, right: true, bottom: true, left: true },
              },
            ],
          },
        ],
      }),
      [{ name: 'A very long description that wraps to several lines', qty: 2 }],
    );
    const frames = of(tree, 0, 'rect');
    expect(frames).toHaveLength(2);
    expect(frames[0].h).toBeGreaterThan(6);
    expect(frames[1].h).toBeCloseTo(frames[0].h, 5);
  });
});

describe('drawing', () => {
  it('draws arrowheads and pulls the stroke back from them', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'arrow',
              kind: 'LINE',
              x: 10,
              y: 0,
              x1: 10,
              y1: 5,
              x2: 60,
              y2: 5,
              widthPt: 1,
              arrowEnd: true,
              style: { lineStyle: 'DOT' },
            },
          ]),
        ],
      }),
    );
    const [line] = of(tree, 0, 'line') as LinePrimitive[];
    const heads = of(tree, 0, 'path') as PathPrimitive[];
    expect(line.x2).toBeLessThan(60);
    expect(line.dash).toBe('DOT');
    expect(heads).toHaveLength(1);
    expect(heads[0].d.startsWith('M 60 10')).toBe(true);
  });

  it('draws ellipses, triangles and rhombi as paths with a visible default stroke', () => {
    const tree = render(
      define({
        bands: [
          summary(
            ['ELLIPSE', 'TRIANGLE', 'RHOMBUS', 'RECT'].map((shape, index) => ({
              id: `s${index}`,
              kind: 'RECT',
              x: 10 + index * 25,
              y: 0,
              w: 20,
              h: 10,
              shape,
            })),
          ),
        ],
      }),
    );
    const paths = of(tree, 0, 'path');
    expect(paths).toHaveLength(3);
    expect(paths.every((path) => path.stroke === '#000000' && path.fill === null)).toBe(true);
    expect(paths[0].d).toContain('C');
    expect(of(tree, 0, 'rect')).toHaveLength(1);
  });
});

describe('charts', () => {
  const chart = (overrides: Record<string, unknown>) =>
    define({
      bands: [
        summary([
          {
            id: 'chart',
            kind: 'CHART',
            x: 10,
            y: 0,
            w: 100,
            h: 60,
            dataset: 'items',
            category: '{{ row.month }}',
            series: [{ name: 'Sales', value: '{{ row.amount }}' }],
            ...overrides,
          },
        ]),
      ],
    });
  const rows = [
    { month: 'Apr', amount: 10 },
    { month: 'May', amount: 30 },
    { month: 'Apr', amount: 5 },
  ];

  it('aggregates by category in first-seen order and draws one bar each', () => {
    const tree = render(chart({ showLegend: false, showGrid: false }), rows);
    const bars = of(tree, 0, 'rect') as RectPrimitive[];
    expect(bars).toHaveLength(2);
    // Apr = 15, May = 30: May's bar is twice as tall.
    expect(bars[1].h / bars[0].h).toBeCloseTo(2, 1);
    const labels = of(tree, 0, 'text').map((text) => text.text);
    expect(labels).toEqual(expect.arrayContaining(['Apr', 'May']));
  });

  it('draws a doughnut slice per category with percentage labels', () => {
    const tree = render(chart({ chartType: 'PIE', holeSizePct: 50, showPercent: true }), rows);
    expect(of(tree, 0, 'path')).toHaveLength(2);
    const labels = of(tree, 0, 'text').map((text) => text.text);
    expect(labels).toEqual(expect.arrayContaining(['33.3%', '66.7%', 'Apr', 'May']));
  });

  it('refuses a chart in a repeating band', () => {
    const result = templateDefinitionSchema.safeParse({
      schemaVersion: 1,
      layoutMode: 'GRAPHIC',
      paper: A5,
      datasets: [ITEMS],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 6,
          elements: [
            {
              id: 'c',
              kind: 'CHART',
              x: 0,
              y: 0,
              w: 50,
              h: 30,
              dataset: 'items',
              category: '{{ row.m }}',
              series: [{ value: '{{ row.v }}' }],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('crosstab subtotals', () => {
  it('prints a subtotal row after each outer group, re-aggregated', () => {
    const tree = render(
      define({
        bands: [
          summary([
            {
              id: 'pivot',
              kind: 'CROSSTAB',
              x: 10,
              y: 0,
              w: 120,
              h: 20,
              dataset: 'items',
              rowBy: '{{ row.grp }}',
              extraRowBys: [{ expression: '{{ row.item }}', label: 'Item' }],
              columnBy: '{{ row.month }}',
              measure: '{{ row.qty }}',
              format: '0',
              rowSort: 'FIRST_SEEN',
              columnSort: 'FIRST_SEEN',
              showSubtotals: true,
              totalsFill: '#eeeeee',
            },
          ]),
        ],
      }),
      [
        { grp: 'Rice', item: 'Ponni', month: 'Apr', qty: 2 },
        { grp: 'Rice', item: 'Basmati', month: 'Apr', qty: 3 },
        { grp: 'Rice', item: 'Ponni', month: 'May', qty: 4 },
        { grp: 'Oil', item: 'Sunflower', month: 'May', qty: 5 },
      ],
    );

    const texts = of(tree, 0, 'text');
    // Rows run Ponni, Basmati, Subtotal (Rice), Sunflower, Subtotal (Oil).
    const labels = texts.map((text) => text.text).filter((text) => text === 'Subtotal');
    expect(labels).toHaveLength(2);
    // Rice: Apr 5, May 4, row total 9 -- all in the header (bold) font.
    const riceSubtotal = texts.filter(
      (text) => text.font.bold && ['5', '4', '9'].includes(text.text),
    );
    expect(riceSubtotal.map((text) => text.text)).toEqual(expect.arrayContaining(['5', '4', '9']));
    // The totals fill sits behind both subtotal rows and the column totals.
    expect(of(tree, 0, 'rect').filter((rect) => rect.fill === '#eeeeee')).toHaveLength(3);
  });
});

describe('pages', () => {
  const footer = {
    type: 'PAGE_FOOTER' as const,
    heightMm: 6,
    elements: [
      {
        id: 'pn',
        kind: 'TEXT',
        x: 5,
        y: 0,
        w: 60,
        h: 5,
        value: 'Page {{ page.number }} of {{ page.total }}',
        border: { top: true },
      },
    ],
  };
  const pageNumbers = (tree: LayoutTree) =>
    tree.pages.map(
      (page) =>
        page.primitives.find(
          (primitive): primitive is TextPrimitive =>
            primitive.k === 'text' && primitive.text.startsWith('Page'),
        )?.text,
    );

  it('puts a watermark behind every page', () => {
    const tree = render(
      define({
        watermark: { text: 'DRAFT', opacity: 0.2 },
        bands: [{ type: 'DETAIL', dataset: 'items', heightMm: 20, elements: [] }],
      }),
      Array.from({ length: 20 }, () => ({})),
    );
    expect(tree.pages.length).toBeGreaterThan(1);
    for (const page of tree.pages) {
      expect(page.primitives[0]).toMatchObject({
        k: 'text',
        text: 'DRAFT',
        opacity: 0.2,
        rotation: -45,
      });
    }
  });

  it('prints each report page as its own run after the report', () => {
    const tree = render(
      define({
        bands: [
          {
            type: 'REPORT_HEADER',
            heightMm: 10,
            elements: [{ id: 'a', kind: 'TEXT', x: 5, y: 0, w: 40, h: 5, value: 'INVOICE' }],
          },
          footer,
          {
            type: 'REPORT_HEADER',
            reportPage: 1,
            heightMm: 10,
            elements: [{ id: 'b', kind: 'TEXT', x: 5, y: 0, w: 40, h: 5, value: 'TERMS' }],
          },
        ],
      }),
    );
    expect(tree.pageCount).toBe(2);
    expect(tree.pages.map((page) => page.index)).toEqual([0, 1]);
    expect(of(tree, 1, 'text').map((text) => text.text)).toEqual(['TERMS']);
  });

  it('allows a page header per report page but not two on one page', () => {
    const header = (reportPage: number) => ({
      type: 'PAGE_HEADER',
      heightMm: 5,
      reportPage,
      elements: [],
    });
    const parse = (bands: unknown[]) =>
      templateDefinitionSchema.safeParse({
        schemaVersion: 1,
        layoutMode: 'GRAPHIC',
        paper: A5,
        bands,
      });
    expect(parse([header(0), header(1)]).success).toBe(true);
    expect(parse([header(1), header(1)]).success).toBe(false);
  });

  it('starts each row of a start-new-page detail band on a fresh page', () => {
    const tree = render(
      define({
        bands: [
          {
            type: 'DETAIL',
            dataset: 'items',
            heightMm: 6,
            startNewPage: true,
            elements: [{ id: 'n', kind: 'FIELD', x: 5, y: 0, w: 40, h: 5, value: '{{ row.n }}' }],
          },
        ],
      }),
      [{ n: 'one' }, { n: 'two' }, { n: 'three' }],
    );
    expect(tree.pages.map((page) => of(tree, page.index, 'text').map((text) => text.text))).toEqual(
      [['one'], ['two'], ['three']],
    );
  });

  it('starts each group on a new page and restarts the numbering', () => {
    const tree = render(
      define({
        bands: [
          {
            type: 'GROUP_HEADER',
            dataset: 'items',
            groupBy: '{{ row.customer }}',
            heightMm: 6,
            startNewNumeration: true,
            elements: [
              { id: 'g', kind: 'FIELD', x: 5, y: 0, w: 60, h: 5, value: '{{ row.customer }}' },
            ],
          },
          { type: 'DETAIL', dataset: 'items', heightMm: 60, elements: [] },
          footer,
        ],
      }),
      [
        { customer: 'A' },
        { customer: 'A' },
        { customer: 'A' },
        { customer: 'A' },
        { customer: 'B' },
      ],
    );
    // A takes two pages (four 60mm rows), B one, each numbered from 1.
    expect(pageNumbers(tree)).toEqual(['Page 1 of 2', 'Page 2 of 2', 'Page 1 of 1']);
  });

  it('suppresses a framed NOT_LAST_PAGE footer completely', () => {
    const tree = render(
      define({
        bands: [
          { type: 'DETAIL', dataset: 'items', heightMm: 60, elements: [] },
          { ...footer, printOn: 'NOT_LAST_PAGE' },
        ],
      }),
      Array.from({ length: 5 }, () => ({})),
    );
    const last = tree.pages[tree.pages.length - 1];
    expect(last.primitives).toEqual([]);
    expect(tree.pages[0].primitives.map((primitive) => primitive.k)).toEqual(['text', 'line']);
  });
});

describe('PDF output', () => {
  it('renders every new primitive without error', async () => {
    const renderer = new PdfKitRenderer(registry, new BarcodeFactory(), new ImageCache());
    const tree = render(
      define({
        watermark: { text: 'COPY' },
        pageBorder: { style: 'DOUBLE' },
        bands: [
          summary(
            [
              {
                id: 'rich',
                kind: 'TEXT',
                x: 10,
                y: 0,
                w: 60,
                h: 12,
                wrap: true,
                markup: true,
                align: 'justify',
                value:
                  '<b>Bold</b> <i>italic</i> <u>under</u> <s>struck</s> x<sup>2</sup> H<sub>2</sub>O and more words to wrap',
                border: { top: true, right: true, bottom: true, left: true, style: 'DOUBLE' },
              },
              {
                id: 'rot',
                kind: 'TEXT',
                x: 75,
                y: 0,
                w: 6,
                h: 30,
                rotation: 90,
                value: 'Sideways',
              },
              {
                id: 'ell',
                kind: 'RECT',
                x: 85,
                y: 0,
                w: 20,
                h: 10,
                shape: 'ELLIPSE',
                style: { fill: '#dddddd', lineStyle: 'DASH_DOT' },
              },
              {
                id: 'arr',
                kind: 'LINE',
                x: 10,
                y: 0,
                x1: 10,
                y1: 20,
                x2: 60,
                y2: 30,
                arrowStart: true,
                arrowEnd: true,
                style: { lineStyle: 'DOUBLE' },
              },
              {
                id: 'chart',
                kind: 'CHART',
                x: 10,
                y: 32,
                w: 120,
                h: 25,
                dataset: 'items',
                chartType: 'LINE',
                title: 'Sales',
                category: '{{ row.m }}',
                series: [{ name: 'Value', value: '{{ row.v }}' }],
              },
            ],
            { heightMm: 60 },
          ),
        ],
      }),
      [
        { m: 'A', v: 1 },
        { m: 'B', v: 3 },
      ],
    );
    const result = await renderer.render(tree, { creationDate: new Date('2026-10-13T00:00:00Z') });
    expect(result.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.pageCount).toBe(1);
  });
});
