import { ChartElement } from '../../definition/template-definition.schema';
import { CHART_PALETTE, ChartEnvironment, aggregateChart, niceStep } from './chart';

type Row = Record<string, unknown>;

/**
 * Just enough of the environment for aggregation: the category template names
 * a row field, and a series value template names one too.
 */
const env: ChartEnvironment = {
  measurer: {} as ChartEnvironment['measurer'],
  rowContext: (row) => ({ row }),
  evaluate: (template, context) => ((context.row as Row) ?? {})[template],
  evaluateText: (template, context) => {
    const value = ((context.row as Row) ?? {})[template];
    return value === undefined || value === null ? '' : String(value as string | number);
  },
  resolveColour: (_value, _context, fallback) => fallback,
};

const chart = (overrides: Partial<ChartElement> = {}): ChartElement =>
  ({
    category: 'month',
    series: [{ value: 'sales' }],
    fn: 'sum',
    maxCategories: 12,
    ...overrides,
  }) as unknown as ChartElement;

const rows: Row[] = [
  { month: 'Apr', sales: 100, returns: 5 },
  { month: 'May', sales: '1,250.50', returns: null },
  { month: 'Apr', sales: 50, returns: 'n/a' },
  { month: 'Jun', sales: '', returns: 2 },
];

describe('aggregateChart', () => {
  it('sums by category in first-seen order, reading grouped numeric text', () => {
    expect(aggregateChart(chart(), rows, env)).toEqual({
      categories: ['Apr', 'May', 'Jun'],
      values: [[150, 1250.5, null]],
      droppedCategories: 0,
    });
  });

  it('aggregates every series side by side', () => {
    const data = aggregateChart(
      chart({ series: [{ value: 'sales' }, { value: 'returns' }] as ChartElement['series'] }),
      rows,
      env,
    );

    expect(data.values).toEqual([
      [150, 1250.5, null],
      [5, null, 2],
    ]);
  });

  it('counts rows, including rows whose value is not a number', () => {
    expect(aggregateChart(chart({ fn: 'count' }), rows, env).values).toEqual([[2, 1, 1]]);
  });

  it('averages, and takes min and max, over numeric values only', () => {
    expect(aggregateChart(chart({ fn: 'avg' }), rows, env).values).toEqual([[75, 1250.5, null]]);
    expect(aggregateChart(chart({ fn: 'min' }), rows, env).values).toEqual([[50, 1250.5, null]]);
    expect(aggregateChart(chart({ fn: 'max' }), rows, env).values).toEqual([[100, 1250.5, null]]);
  });

  it('drops categories past maxCategories and says how many', () => {
    const data = aggregateChart(chart({ maxCategories: 2 }), rows, env);

    expect(data.categories).toEqual(['Apr', 'May']);
    expect(data.values).toEqual([[150, 1250.5]]);
    expect(data.droppedCategories).toBe(1);
  });

  it('gathers rows with no category under a blank one', () => {
    const data = aggregateChart(chart(), [{ sales: 3 }, { month: null, sales: 4 }], env);

    expect(data.categories).toEqual(['']);
    expect(data.values).toEqual([[7]]);
  });

  it('returns no categories for no rows', () => {
    expect(aggregateChart(chart(), [], env)).toEqual({
      categories: [],
      values: [[]],
      droppedCategories: 0,
    });
  });
});

describe('niceStep', () => {
  it('picks a 1, 2 or 5 times a power of ten step for about four intervals', () => {
    expect(niceStep(100)).toBe(50);
    expect(niceStep(40)).toBe(10);
    expect(niceStep(7)).toBe(2);
    expect(niceStep(3)).toBe(1);
    expect(niceStep(0.9)).toBe(0.5);
    expect(niceStep(2_50_000)).toBe(1_00_000);
  });

  it('honours a different interval target', () => {
    expect(niceStep(100, 10)).toBe(10);
  });

  it('falls back to 1 for a span that is zero, negative or not a number', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });
});

describe('CHART_PALETTE', () => {
  it('holds ten distinct hex colours', () => {
    expect(CHART_PALETTE).toHaveLength(10);
    expect(new Set(CHART_PALETTE).size).toBe(10);
    for (const colour of CHART_PALETTE) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
