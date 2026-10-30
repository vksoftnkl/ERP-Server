import {
  TemplateDefinition,
  TemplateDefinitionInput,
  templateDefinitionSchema,
} from '../../definition/template-definition.schema';
import { FontRegistry } from '../fonts/font.registry';
import { LayoutEngine } from './layout.engine';
import { LayoutTree, RectPrimitive, TextPrimitive } from './layout-tree.types';
import { TextMeasurer } from './text-measure';

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
  margins: { top: 3, right: 2, bottom: 2, left: 4 },
};

/** A page header, enough detail rows for several pages, and a numbered footer. */
const template = (overrides: Partial<TemplateDefinitionInput> = {}): TemplateDefinition =>
  templateDefinitionSchema.parse({
    schemaVersion: 1,
    layoutMode: 'GRAPHIC',
    paper: A5,
    datasets: [{ name: 'items', provider: 'sales.bill.items', cardinality: 'many' }],
    bands: [
      {
        type: 'PAGE_HEADER',
        heightMm: 10,
        elements: [{ id: 'title', kind: 'TEXT', x: 5, y: 2, w: 60, h: 5, value: 'TAX INVOICE' }],
      },
      {
        type: 'DETAIL',
        dataset: 'items',
        heightMm: 6,
        elements: [{ id: 'name', kind: 'FIELD', x: 5, y: 0, w: 60, h: 5, value: '{{ row.name }}' }],
      },
      {
        type: 'PAGE_FOOTER',
        heightMm: 6,
        printOn: 'NOT_LAST_PAGE',
        elements: [
          {
            id: 'more',
            kind: 'TEXT',
            x: 5,
            y: 0,
            w: 60,
            h: 5,
            value: 'Page {{ page.number }} of {{ page.total }} — continued',
          },
        ],
      },
    ],
    ...overrides,
  });

const rows = (count: number) =>
  Array.from({ length: count }, (_unused, index) => ({ name: `Item ${index + 1}` }));

const render = (definition: TemplateDefinition, count = 60): LayoutTree =>
  engine.render({
    definition,
    datasets: { items: rows(count) },
    ctx: {},
    sys: { now: '2026-10-13' },
  });

const bordersOf = (tree: LayoutTree, pageIndex: number): RectPrimitive[] =>
  tree.pages[pageIndex].primitives.filter(
    (primitive): primitive is RectPrimitive => primitive.k === 'rect',
  );

describe('page border', () => {
  it('frames every page on the margin line, behind everything else', () => {
    const tree = render(template({ pageBorder: {} }));

    expect(tree.pages.length).toBeGreaterThan(1);
    for (const page of tree.pages) {
      expect(page.primitives[0]).toEqual({
        k: 'rect',
        x: 4,
        y: 3,
        w: 148 - 4 - 2,
        h: 210 - 3 - 2,
        fill: null,
        stroke: '#000000',
        strokeWidthPt: 0.75,
        radiusMm: 0,
      });
      expect(bordersOf(tree, page.index)).toHaveLength(1);
    }
  });

  it('sits a fixed distance from the paper edge when given an inset', () => {
    const tree = render(
      template({ pageBorder: { insetMm: 6, widthPt: 1.5, color: '#1f3a93', radiusMm: 2 } }),
    );

    expect(tree.pages[0].primitives[0]).toMatchObject({
      x: 6,
      y: 6,
      w: 136,
      h: 198,
      stroke: '#1f3a93',
      strokeWidthPt: 1.5,
      radiusMm: 2,
    });
  });

  it('leaves last-page band suppression and page numbers intact', () => {
    const plain = render(template());
    const framed = render(template({ pageBorder: {} }));

    const texts = (tree: LayoutTree) =>
      tree.pages.map((page) =>
        page.primitives
          .filter((primitive): primitive is TextPrimitive => primitive.k === 'text')
          .map((primitive) => primitive.text),
      );

    // Identical text on every page: the NOT_LAST_PAGE footer is clipped from
    // the last page only, and "of N" resolved in the same primitives.
    expect(texts(framed)).toEqual(texts(plain));
    expect(framed.pages.map((page) => page.primitives.length)).toEqual(
      plain.pages.map((page) => page.primitives.length + 1),
    );
  });

  it('frames the single page of an empty document', () => {
    const tree = render(template({ pageBorder: {} }), 0);
    expect(bordersOf(tree, 0)).toHaveLength(1);
  });

  it('draws nothing on continuous paper, whose bottom edge is the content', () => {
    const tree = render(template({ paper: { ...A5, heightMm: null }, pageBorder: {} }), 3);
    expect(bordersOf(tree, 0)).toHaveLength(0);
  });

  it('draws nothing when the inset leaves no frame', () => {
    const tree = render(template({ pageBorder: { insetMm: 80 } }), 3);
    expect(bordersOf(tree, 0)).toHaveLength(0);
  });

  it('draws nothing in GRID mode', () => {
    const tree = engine.render({
      definition: templateDefinitionSchema.parse({
        schemaVersion: 1,
        layoutMode: 'GRID',
        paper: { ...A5, code: 'DM80', columns: 80, rows: 66 },
        pageBorder: {},
        bands: [
          {
            type: 'REPORT_HEADER',
            heightMm: 1,
            heightRows: 1,
            elements: [{ id: 't', kind: 'TEXT', row: 0, col: 0, cols: 10, value: 'HELLO' }],
          },
        ],
      }),
      datasets: {},
      ctx: {},
      sys: { now: '2026-10-13' },
    });
    expect(bordersOf(tree, 0)).toHaveLength(0);
  });
});
