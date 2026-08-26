import { AggregateFunction } from '../../templates/dto/template-definition.schema';

/**
 * Aggregate accumulation for the layout engine.
 *
 * Three scopes, and they are NOT computed the same way, because they cannot be:
 *
 *   REPORT and GROUP are PRE-COMPUTED in one pass over the dataset before
 *     layout begins. This is what makes a GROUP_HEADER able to print its own
 *     group's total -- a forward reference that a purely accumulate-as-you-go
 *     engine cannot satisfy, and the reason so many report tools force the
 *     total into the footer.
 *
 *   PAGE is accumulated LIVE, because it depends on where the pagination
 *     happened to land, which is not known until it has happened. A page
 *     footer reads it at page close, by which time it is complete.
 *
 * `count` counts rows, not values, and counts a row whose value is null.
 * `avg` divides by the number of NON-NULL values, which is what an accountant
 * means by an average rate.
 */

export interface AggregateSpec {
  /** The element id, which is what the layout engine looks results up by. */
  readonly key: string;
  readonly fn: AggregateFunction;
  readonly dataset: string;
}

interface Accumulator {
  sum: number;
  count: number;
  valueCount: number;
  min: number | null;
  max: number | null;
}

const emptyAccumulator = (): Accumulator => ({
  sum: 0,
  count: 0,
  valueCount: 0,
  min: null,
  max: null,
});

const accumulate = (accumulator: Accumulator, value: number | null): void => {
  accumulator.count += 1;
  if (value === null || !Number.isFinite(value)) {
    return;
  }
  accumulator.valueCount += 1;
  accumulator.sum += value;
  accumulator.min = accumulator.min === null ? value : Math.min(accumulator.min, value);
  accumulator.max = accumulator.max === null ? value : Math.max(accumulator.max, value);
};

const readAccumulator = (accumulator: Accumulator | undefined, fn: AggregateFunction): number => {
  if (!accumulator) {
    return 0;
  }
  switch (fn) {
    case 'sum':
      return accumulator.sum;
    case 'count':
      return accumulator.count;
    case 'avg':
      // Dividing by the row count instead would drag the average toward zero
      // for every blank cell -- an average rate that no line actually carried.
      return accumulator.valueCount === 0 ? 0 : accumulator.sum / accumulator.valueCount;
    case 'min':
      return accumulator.min ?? 0;
    case 'max':
      return accumulator.max ?? 0;
    default:
      return 0;
  }
};

/**
 * Pre-computed REPORT and GROUP totals.
 *
 * Group results are keyed by the group PATH -- the joined key values from the
 * outermost group inward. Using the path rather than a running index means a
 * header and its matching footer look up the same entry without having to
 * agree on ordinal position.
 */
export class PrecomputedAggregates {
  private readonly report = new Map<string, Accumulator>();

  private readonly groups = new Map<string, Map<string, Accumulator>>();

  /**
   * Accumulate one value into the REPORT scope.
   *
   * Separate from addGroup on purpose. An earlier shape had a single `add` that
   * always touched the report bucket and optionally a group bucket -- which
   * silently multiplied every report total by the number of group levels,
   * because the caller has to call once per enclosing level to fill the group
   * buckets. Two methods make the caller state which scope it means.
   */
  addReport(key: string, value: number | null): void {
    let accumulator = this.report.get(key);
    if (!accumulator) {
      accumulator = emptyAccumulator();
      this.report.set(key, accumulator);
    }
    accumulate(accumulator, value);
  }

  /** Accumulate one value into one group path. Never touches the report scope. */
  addGroup(groupPath: string, key: string, value: number | null): void {
    let groupBucket = this.groups.get(groupPath);
    if (!groupBucket) {
      groupBucket = new Map<string, Accumulator>();
      this.groups.set(groupPath, groupBucket);
    }

    let accumulator = groupBucket.get(key);
    if (!accumulator) {
      accumulator = emptyAccumulator();
      groupBucket.set(key, accumulator);
    }
    accumulate(accumulator, value);
  }

  readReport(key: string, fn: AggregateFunction): number {
    return readAccumulator(this.report.get(key), fn);
  }

  readGroup(groupPath: string, key: string, fn: AggregateFunction): number {
    return readAccumulator(this.groups.get(groupPath)?.get(key), fn);
  }
}

/** Live PAGE-scope accumulation, reset at every page break. */
export class PageAggregates {
  private accumulators = new Map<string, Accumulator>();

  add(key: string, value: number | null): void {
    let accumulator = this.accumulators.get(key);
    if (!accumulator) {
      accumulator = emptyAccumulator();
      this.accumulators.set(key, accumulator);
    }
    accumulate(accumulator, value);
  }

  read(key: string, fn: AggregateFunction): number {
    return readAccumulator(this.accumulators.get(key), fn);
  }

  reset(): void {
    this.accumulators = new Map<string, Accumulator>();
  }
}

/**
 * The separator that joins group key values into a path.
 *
 * A unit separator rather than a space or a slash: group keys are data (an HSN
 * code, an item name, a Tamil brand), and any printable delimiter can appear
 * inside one. Two distinct nestings that collided on their joined path would
 * silently share a total.
 */
export const GROUP_PATH_SEPARATOR = '\u001F';

export const buildGroupPath = (keys: readonly string[]): string => keys.join(GROUP_PATH_SEPARATOR);
