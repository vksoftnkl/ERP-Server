import {
  GROUP_PATH_SEPARATOR,
  PageAggregates,
  PrecomputedAggregates,
  accumulate,
  buildGroupPath,
  emptyAccumulator,
  readAccumulator,
} from './aggregate.accumulator';

const filled = (...values: (number | null)[]) => {
  const accumulator = emptyAccumulator();
  for (const value of values) {
    accumulate(accumulator, value);
  }
  return accumulator;
};

describe('accumulate / readAccumulator', () => {
  it('sums, and reads min and max', () => {
    const accumulator = filled(10, -4, 25);

    expect(readAccumulator(accumulator, 'sum')).toBe(31);
    expect(readAccumulator(accumulator, 'min')).toBe(-4);
    expect(readAccumulator(accumulator, 'max')).toBe(25);
  });

  it('counts a row whose value is null, but averages over the values only', () => {
    const accumulator = filled(10, null, 20, Number.NaN);

    expect(readAccumulator(accumulator, 'count')).toBe(4);
    expect(readAccumulator(accumulator, 'avg')).toBe(15);
    expect(accumulator.valueCount).toBe(2);
  });

  it('ignores infinities as it ignores nulls', () => {
    const accumulator = filled(5, Number.POSITIVE_INFINITY);

    expect(readAccumulator(accumulator, 'sum')).toBe(5);
    expect(readAccumulator(accumulator, 'max')).toBe(5);
  });

  it('reads zero from a bucket with no values, or no bucket at all', () => {
    const onlyNulls = filled(null, null);

    expect(readAccumulator(onlyNulls, 'avg')).toBe(0);
    expect(readAccumulator(onlyNulls, 'min')).toBe(0);
    expect(readAccumulator(onlyNulls, 'max')).toBe(0);
    expect(readAccumulator(onlyNulls, 'count')).toBe(2);
    expect(readAccumulator(undefined, 'sum')).toBe(0);
  });

  it('reads zero for a function it does not know', () => {
    expect(readAccumulator(filled(3), 'median' as never)).toBe(0);
  });
});

describe('PrecomputedAggregates', () => {
  it('keeps the report scope and each group path apart', () => {
    const aggregates = new PrecomputedAggregates();
    const north = buildGroupPath(['North']);
    const south = buildGroupPath(['South']);

    for (const [path, value] of [
      [north, 100],
      [north, 50],
      [south, 30],
    ] as const) {
      aggregates.addReport('amount', value);
      aggregates.addGroup(path, 'amount', value);
    }

    expect(aggregates.readReport('amount', 'sum')).toBe(180);
    expect(aggregates.readGroup(north, 'amount', 'sum')).toBe(150);
    expect(aggregates.readGroup(south, 'amount', 'count')).toBe(1);
  });

  it('never touches the report total when only a group is fed', () => {
    const aggregates = new PrecomputedAggregates();
    aggregates.addGroup(buildGroupPath(['A', 'x']), 'qty', 4);

    expect(aggregates.readReport('qty', 'sum')).toBe(0);
  });

  it('reads zero for an unknown key or path', () => {
    const aggregates = new PrecomputedAggregates();
    aggregates.addReport('qty', 1);

    expect(aggregates.readReport('rate', 'sum')).toBe(0);
    expect(aggregates.readGroup('nope', 'qty', 'sum')).toBe(0);
  });
});

describe('PageAggregates', () => {
  it('accumulates per key until reset', () => {
    const page = new PageAggregates();
    page.add('amount', 10);
    page.add('amount', 15);
    page.add('qty', 1);

    expect(page.read('amount', 'sum')).toBe(25);
    expect(page.read('qty', 'count')).toBe(1);

    page.reset();

    expect(page.read('amount', 'sum')).toBe(0);
    page.add('amount', 7);
    expect(page.read('amount', 'sum')).toBe(7);
  });
});

describe('buildGroupPath', () => {
  it('joins keys with the unit separator, so a delimiter inside a key cannot collide', () => {
    expect(GROUP_PATH_SEPARATOR).toBe('\u001F');
    expect(buildGroupPath(['a/b', 'c'])).not.toBe(buildGroupPath(['a', 'b/c']));
    expect(buildGroupPath(['a b', 'c'])).toBe('a b\u001Fc');
    expect(buildGroupPath([])).toBe('');
  });
});
