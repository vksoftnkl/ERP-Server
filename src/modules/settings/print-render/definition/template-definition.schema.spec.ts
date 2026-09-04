import { templateDefinitionSchema } from './template-definition.schema';
import { loadCanvasFixture } from '../__fixtures__/load-fixture';

/**
 * The two fixtures are the CLIENT's own, copied verbatim from
 * `ERP client/features/print-designer/lib/__fixtures__/`. That provenance is
 * the point: they are the bodies the canvas actually holds, so a green test
 * here is evidence that what a designer saves is what this server can parse —
 * not that two copies of one idea agree with each other.
 */
const CANVAS_FIXTURES: ReadonlyArray<readonly [string, unknown]> = [
  ['gst-invoice-a4', loadCanvasFixture('gst-invoice-a4')],
  ['thermal-receipt-t80', loadCanvasFixture('thermal-receipt-t80')],
  ['quotation-rate-matrix-a4', loadCanvasFixture('quotation-rate-matrix-a4')],
];

/**
 * The schema's cross-field invariants — the checks class-validator cannot
 * express, and the reason validation lives in zod. Each is a rejection a
 * designer save has to surface, not a runtime surprise.
 */

const base = {
  schemaVersion: 1,
  layoutMode: 'GRAPHIC' as const,
  paper: {
    code: 'A4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'PORTRAIT' as const,
    margins: { top: 10, right: 8, bottom: 12, left: 8 },
  },
};

const parse = (definition: unknown) => templateDefinitionSchema.safeParse(definition);

describe('templateDefinitionSchema invariants', () => {
  it('accepts the designs the canvas produces', () => {
    for (const [key, definition] of CANVAS_FIXTURES) {
      const result = parse(definition);
      if (!result.success) {
        throw new Error(
          `${key} failed: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
        );
      }
      expect(result.success).toBe(true);
    }
  });

  it('rejects a duplicate element id across bands', () => {
    const result = parse({
      ...base,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'REPORT_HEADER',
          heightMm: 5,
          elements: [{ id: 'dup', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'a' }],
        },
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [{ id: 'dup', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.n }}' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('duplicate element id');
  });

  it('rejects a band referencing an undeclared dataset', () => {
    const result = parse({
      ...base,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'nope',
          heightMm: 5,
          elements: [{ id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.n }}' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('unknown dataset');
  });

  it('rejects a DETAIL band over a cardinality-one dataset', () => {
    const result = parse({
      ...base,
      datasets: [{ name: 'invoice', provider: 'p', cardinality: 'one' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'invoice',
          heightMm: 5,
          elements: [{ id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.n }}' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("cardinality 'one'");
  });

  it('requires groupBy on a group band', () => {
    const result = parse({
      ...base,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        { type: 'GROUP_HEADER', dataset: 'items', heightMm: 5, elements: [] },
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [{ id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 4, value: '{{ row.n }}' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('requires groupBy');
  });

  it('rejects an element that extends past the page width', () => {
    // The save-time bounds check that keeps a clipped column out of production.
    const result = parse({
      ...base,
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 5,
          elements: [{ id: 'd', kind: 'FIELD', x: 190, y: 0, w: 40, h: 4, value: '{{ row.n }}' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('past the 210mm page width');
  });

  it('requires columns on a GRID template', () => {
    const result = parse({
      schemaVersion: 1,
      layoutMode: 'GRID',
      paper: {
        code: 'T80',
        widthMm: 80,
        heightMm: null,
        orientation: 'PORTRAIT',
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
      bands: [
        {
          type: 'DETAIL',
          dataset: 'items',
          heightMm: 1,
          elements: [{ id: 'd', kind: 'FIELD', col: 0, row: 0, cols: 20, value: '{{ row.n }}' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('paper.columns');
  });

  it('requires col and row on a GRID element', () => {
    const result = parse({
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
          heightMm: 1,
          elements: [{ id: 'd', kind: 'FIELD', x: 8, y: 0, w: 20, h: 1, value: '{{ row.n }}' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('col and row');
  });

  it('rejects more than one of a singleton band', () => {
    const result = parse({
      ...base,
      datasets: [],
      bands: [
        {
          type: 'SUMMARY',
          heightMm: 5,
          elements: [{ id: 'a', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'a' }],
        },
        {
          type: 'SUMMARY',
          heightMm: 5,
          elements: [{ id: 'b', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'b' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain('at most once');
  });

  it('applies element defaults', () => {
    const result = parse({
      ...base,
      datasets: [],
      bands: [
        {
          type: 'SUMMARY',
          heightMm: 5,
          elements: [{ id: 'a', kind: 'TEXT', x: 8, y: 0, w: 60, h: 4, value: 'a' }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const element = result.data.bands[0].elements[0];
      // A TEXT element carries align; the discriminated union has to be
      // narrowed to reach it.
      expect(element.kind).toBe('TEXT');
      if (element.kind === 'TEXT') {
        expect(element.align).toBe('left');
      }
      expect(element.z).toBe(0);
    }
  });
});
