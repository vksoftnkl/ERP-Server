import {
  AGGREGATE_FUNCTIONS,
  CrosstabElement,
  CrosstabSort,
  FontSpec,
} from '../../definition/template-definition.schema';
import { formatNumber } from '../expression/transforms/format';
import {
  Accumulator,
  accumulate,
  emptyAccumulator,
  readAccumulator,
} from './aggregate.accumulator';
import { LinePrimitive, Primitive, RectPrimitive, TextPrimitive } from './layout-tree.types';
import { MeasuredFont } from './text-measure';

/**
 * The crosstab: a pivot table that expands into ordinary primitives.
 *
 * ── THE SHAPE OF THE PROBLEM ───────────────────────────────────────────────
 *
 * Everything else in a template has geometry the designer typed. A crosstab
 * does not: its column count comes from the data, so its width per column, its
 * total height and whether it fits on the page are all answers the engine has
 * to work out at layout time. That is the whole of the complexity here, and it
 * is deliberately kept OUT of the layout engine -- this file decides the
 * arithmetic, the engine decides where the pages break.
 *
 * ── THREE AXES, EACH A LIST ────────────────────────────────────────────────
 *
 * The pivot is not one row dimension by one column dimension by one number.
 * Each of the three is a LIST, and the three lists are independent:
 *
 *   rows     -> N label columns down the left edge, grouped left to right.
 *   columns  -> N header ROWS across the top; the printed columns are the
 *               combinations the data actually contains, not the cartesian
 *               product of the levels.
 *   measures -> every column group splits into one sub-column per measure,
 *               each with its own aggregate and number format.
 *
 * So the printed value columns are `leaves x measures`, and that flattened list
 * is what `CrosstabModel.columns` holds: everything downstream -- the width
 * plan, the slice, the emitter -- addresses a printed column by one index, and
 * only the header emitter has to know the two-dimensional structure behind it.
 *
 * `rowBy`, `columnBy` and `measure` are the FIRST entry of their list, with
 * `extraRowBys` / `extraColumnBys` / `extraMeasures` holding the rest. That is
 * why a template stored before nesting existed still renders unchanged: with
 * all three extras empty every code path below collapses to exactly the
 * one-by-one-by-one pivot that shipped first.
 *
 * ── THREE PASSES, IN THIS ORDER ────────────────────────────────────────────
 *
 *   1. buildCrosstabModel -- one pass over the dataset, accumulating a cell per
 *      (rowKey, leafKey, measure). Nothing about paper is known or needed yet.
 *   2. planCrosstab -- turn the model into positioned columns inside the `w`
 *      budget, folding or clipping whatever will not fit.
 *   3. sliceCrosstab / emitCrosstab -- hand the engine one page's worth of rows
 *      at a time, and turn a slice into primitives.
 *
 * Splitting 2 from 3 is what makes pagination possible: the engine can ask "how
 * many rows fit in the 40mm I have left" without committing to drawing them.
 */

type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number];

// ─── The model ───────────────────────────────────────────────────────────────

/**
 * Reserved column keys.
 *
 * A dataset whose own labels collide with these would mis-address a cell, so
 * they carry a character no SQL label ever contains.
 */
export const CROSSTAB_FOLD_KEY = '\u001Fcrosstab-fold';
export const CROSSTAB_TOTALS_KEY = '\u001Fcrosstab-total';

/**
 * Joins one axis's level labels into a single key.
 *
 * A separator rather than JSON because these keys are compared and built once
 * per source row, and because it makes "same group down to level N" a plain
 * string comparison of the first N joined labels. It is a control character for
 * the same reason the reserved keys are: no SQL label contains one.
 */
const LEVEL_SEPARATOR = '\u001E';

const joinKey = (labels: readonly string[]): string => labels.join(LEVEL_SEPARATOR);

/** One level of a row or column axis, first entry included. */
export interface CrosstabAxisLevel {
  readonly expression: string;
  readonly label: string;
  readonly widthMm: number;
}

/** One value column's definition, first entry included. */
export interface CrosstabMeasureSpec {
  readonly expression: string;
  readonly label: string;
  readonly fn: AggregateFunction;
  readonly format: string;
  readonly blankWhenZero: boolean;
}

/**
 * The row axis as a list: `rowBy` first, `extraRowBys` after it.
 *
 * Exported because the validators, the emitter and the tests all need the same
 * answer to "what are this crosstab's levels", and reconstructing it in three
 * places is how the first level ends up missing from one of them.
 */
export const crosstabRowAxes = (element: CrosstabElement): CrosstabAxisLevel[] => [
  { expression: element.rowBy, label: '', widthMm: 0 },
  ...element.extraRowBys.map((axis) => ({
    expression: axis.expression,
    label: axis.label,
    widthMm: axis.widthMm,
  })),
];

/** The column axis as a list: `columnBy` first, `extraColumnBys` after it. */
export const crosstabColumnAxes = (element: CrosstabElement): CrosstabAxisLevel[] => [
  { expression: element.columnBy, label: '', widthMm: 0 },
  ...element.extraColumnBys.map((axis) => ({
    expression: axis.expression,
    label: axis.label,
    widthMm: axis.widthMm,
  })),
];

/**
 * The measures as a list: the element-level `measure`/`fn`/`format` first,
 * `extraMeasures` after it.
 *
 * The first measure's settings stayed on the element rather than moving into
 * the list, so that every crosstab written before multiple measures existed
 * parses without a migration.
 */
export const crosstabMeasures = (element: CrosstabElement): CrosstabMeasureSpec[] => [
  {
    expression: element.measure,
    label: element.measureLabel,
    fn: element.fn,
    format: element.format,
    blankWhenZero: element.blankWhenZero,
  },
  ...element.extraMeasures.map((measure) => ({
    expression: measure.expression,
    label: measure.label,
    fn: measure.fn,
    format: measure.format,
    blankWhenZero: measure.blankWhenZero,
  })),
];

/** One combination of column-level labels: a leaf of the column header tree. */
export interface CrosstabLeafColumn {
  readonly key: string;
  /** One entry per column axis level, outermost first. */
  readonly labels: readonly string[];
  /** The deepest level's label -- the same thing as `labels[0]` when flat. */
  readonly label: string;
}

/** One PRINTED value column: a leaf crossed with one measure. */
export interface CrosstabColumn {
  readonly key: string;
  /** Header caption: the leaf's deepest label, or the measure's when nested. */
  readonly label: string;
  readonly leafIndex: number;
  readonly measureIndex: number;
}

export interface CrosstabModelRow {
  readonly key: string;
  /** One entry per row axis level, outermost first. */
  readonly labels: readonly string[];
  /** The outermost label -- the whole label when the axis is flat. */
  readonly label: string;
  /** One entry per model column; null where no source row landed in the cell. */
  readonly values: readonly (number | null)[];
  /** One row total per measure. */
  readonly totals: readonly (number | null)[];
  /** The first measure's row total, kept for callers that only have one. */
  readonly total: number | null;
}

export interface CrosstabModel {
  readonly rowAxes: readonly CrosstabAxisLevel[];
  readonly columnAxes: readonly CrosstabAxisLevel[];
  readonly measures: readonly CrosstabMeasureSpec[];
  /** The column combinations that print, in header order. */
  readonly leaves: readonly CrosstabLeafColumn[];
  /** `leaves x measures`, flattened -- one entry per printed value column. */
  readonly columns: readonly CrosstabColumn[];
  readonly rows: readonly CrosstabModelRow[];
  /** Aligned with `columns`. */
  readonly columnTotals: readonly (number | null)[];
  /** One grand total per measure. */
  readonly grandTotals: readonly (number | null)[];
  /** The first measure's grand total. */
  readonly grandTotal: number | null;
  /** Source rows read. Zero means the dataset was empty, not that it was absent. */
  readonly sourceRows: number;
  /** Leaf columns dropped or folded because of `maxColumns` or the width budget. */
  readonly droppedColumns: number;
}

/** Evaluates one of the crosstab's expressions against a source row. */
export interface CrosstabRowReader {
  text(expression: string, row: unknown, index: number, total: number): string;
  number(expression: string, row: unknown, index: number, total: number): number;
}

// ─── Nested sorting ──────────────────────────────────────────────────────────

interface SortEntry {
  readonly key: string;
  readonly labels: readonly string[];
  readonly firstSeen: number;
  readonly weight: number;
}

interface SortNode {
  label: string;
  firstSeen: number;
  weight: number;
  entry: SortEntry | null;
  children: Map<string, SortNode>;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

const compareNodes = (left: SortNode, right: SortNode, sort: CrosstabSort): number => {
  switch (sort) {
    case 'LABEL_ASC':
      return collator.compare(left.label, right.label);
    case 'LABEL_DESC':
      return collator.compare(right.label, left.label);
    case 'VALUE_DESC':
      return right.weight - left.weight;
    case 'VALUE_ASC':
      return left.weight - right.weight;
    case 'FIRST_SEEN':
    default:
      return left.firstSeen - right.firstSeen;
  }
};

/**
 * Order a nested axis.
 *
 * Sorting the flat combinations would interleave the levels -- "2025 Jan, 2026
 * Jan, 2025 Feb" for a year-over-month header, which no reader can follow and
 * which no header cell could span. So the entries are made a tree first: each
 * level's siblings are sorted among themselves, and the flattened order is the
 * depth-first walk of that tree. A group's sort weight is the sum of its own
 * leaves' weights and its first-seen position the earliest of them, so
 * VALUE_DESC puts the biggest YEAR first and the biggest month inside it.
 */
function sortNested(entries: readonly SortEntry[], sort: CrosstabSort): SortEntry[] {
  const root: SortNode = {
    label: '',
    firstSeen: Number.POSITIVE_INFINITY,
    weight: 0,
    entry: null,
    children: new Map(),
  };

  for (const entry of entries) {
    let node = root;
    for (const label of entry.labels) {
      let child = node.children.get(label);
      if (!child) {
        child = {
          label,
          firstSeen: Number.POSITIVE_INFINITY,
          weight: 0,
          entry: null,
          children: new Map(),
        };
        node.children.set(label, child);
      }
      child.firstSeen = Math.min(child.firstSeen, entry.firstSeen);
      child.weight += entry.weight;
      node = child;
    }
    node.entry = entry;
  }

  const out: SortEntry[] = [];
  const walk = (node: SortNode): void => {
    if (node.entry) {
      out.push(node.entry);
    }
    const children = [...node.children.values()].sort((left, right) =>
      compareNodes(left, right, sort),
    );
    for (const child of children) {
      walk(child);
    }
  };
  walk(root);
  return out;
}

const mergeAccumulator = (into: Accumulator, from: Accumulator): void => {
  into.sum += from.sum;
  into.count += from.count;
  into.valueCount += from.valueCount;
  if (from.min !== null) {
    into.min = into.min === null ? from.min : Math.min(into.min, from.min);
  }
  if (from.max !== null) {
    into.max = into.max === null ? from.max : Math.max(into.max, from.max);
  }
};

/**
 * Aggregate the source rows into a pivot.
 *
 * `maxColumns` is applied HERE rather than at draw time, because folding the
 * tail into an 'Other' column has to happen before the row totals are read off
 * the accumulators -- otherwise the totals would describe columns that never
 * printed, and a reader adding the row up by eye would get a different answer
 * from the one on the paper. It counts LEAF columns, not printed ones: with
 * three measures a `maxColumns` of 12 is twelve months, not four.
 */
export function buildCrosstabModel(
  element: CrosstabElement,
  rows: readonly unknown[],
  reader: CrosstabRowReader,
): CrosstabModel {
  const rowAxes = crosstabRowAxes(element);
  const columnAxes = crosstabColumnAxes(element);
  const measures = crosstabMeasures(element);

  /** rowKey -> leafKey -> one accumulator per measure. */
  const cells = new Map<string, Map<string, Accumulator[]>>();
  const rowLabels = new Map<string, readonly string[]>();
  const leafLabels = new Map<string, readonly string[]>();
  const rowOrder: string[] = [];
  const leafOrder: string[] = [];

  const total = rows.length;

  rows.forEach((row, index) => {
    const rowLevels = rowAxes.map((axis) => reader.text(axis.expression, row, index, total));
    const columnLevels = columnAxes.map((axis) => reader.text(axis.expression, row, index, total));
    const rowKey = joinKey(rowLevels);
    const leafKey = joinKey(columnLevels);

    if (!rowLabels.has(rowKey)) {
      rowLabels.set(rowKey, rowLevels);
      rowOrder.push(rowKey);
    }
    if (!leafLabels.has(leafKey)) {
      leafLabels.set(leafKey, columnLevels);
      leafOrder.push(leafKey);
    }

    let byLeaf = cells.get(rowKey);
    if (!byLeaf) {
      byLeaf = new Map<string, Accumulator[]>();
      cells.set(rowKey, byLeaf);
    }
    let accumulators = byLeaf.get(leafKey);
    if (!accumulators) {
      accumulators = measures.map(() => emptyAccumulator());
      byLeaf.set(leafKey, accumulators);
    }
    measures.forEach((measure, measureIndex) => {
      const value = reader.number(measure.expression, row, index, total);
      accumulate(accumulators[measureIndex], Number.isFinite(value) ? value : null);
    });
  });

  // A leaf's sort weight is its own total across every row, read through the
  // FIRST measure: an axis cannot be ordered by two numbers at once, and the
  // first measure is the one the designer named as the pivot's subject.
  const leafWeight = new Map<string, number>();
  for (const key of leafOrder) {
    const column = emptyAccumulator();
    for (const byLeaf of cells.values()) {
      const cell = byLeaf.get(key);
      if (cell) {
        accumulate(column, readAccumulator(cell[0], measures[0].fn));
      }
    }
    leafWeight.set(key, readAccumulator(column, 'sum'));
  }

  const allLeaves = sortNested(
    leafOrder.map((key, position) => ({
      key,
      labels: leafLabels.get(key) ?? [key],
      firstSeen: position,
      weight: leafWeight.get(key) ?? 0,
    })),
    element.columnSort,
  );

  const kept = allLeaves.slice(0, element.maxColumns);
  const folded = allLeaves.slice(element.maxColumns);
  // A folded column belongs to no group: it is the remainder of every group at
  // once. So it carries its label at the OUTERMOST level and blanks below,
  // which is the only honest place for it in a nested header.
  const foldLeaf: CrosstabLeafColumn | null =
    folded.length > 0 && element.overflow === 'FOLD'
      ? {
          key: CROSSTAB_FOLD_KEY,
          labels: columnAxes.map((_, level) => (level === 0 ? element.overflowLabel : '')),
          label: element.overflowLabel,
        }
      : null;

  const leaves: CrosstabLeafColumn[] = [
    ...kept.map<CrosstabLeafColumn>((entry) => ({
      key: entry.key,
      labels: entry.labels,
      label: entry.labels[entry.labels.length - 1] ?? '',
    })),
    ...(foldLeaf ? [foldLeaf] : []),
  ];

  const columns: CrosstabColumn[] = [];
  leaves.forEach((leaf, leafIndex) => {
    measures.forEach((measure, measureIndex) => {
      columns.push({
        key: measures.length > 1 ? `${leaf.key}${LEVEL_SEPARATOR}${measureIndex}` : leaf.key,
        label: measures.length > 1 ? measure.label : leaf.label,
        leafIndex,
        measureIndex,
      });
    });
  });

  /** The leaves a total is allowed to cover: the printed ones. */
  const printableLeaves = element.overflow === 'FOLD' ? allLeaves : kept;

  const readCell = (
    rowKey: string,
    leaf: CrosstabLeafColumn,
    measureIndex: number,
  ): number | null => {
    const byLeaf = cells.get(rowKey);
    if (!byLeaf) {
      return null;
    }
    const fn = measures[measureIndex].fn;
    if (leaf.key === CROSSTAB_FOLD_KEY) {
      // The fold is a re-aggregation, not a sum of already-aggregated cells:
      // folding three 'avg' columns by adding them would print a number that is
      // not an average of anything.
      const merged = emptyAccumulator();
      let seen = false;
      for (const entry of folded) {
        const cell = byLeaf.get(entry.key);
        if (cell) {
          seen = true;
          mergeAccumulator(merged, cell[measureIndex]);
        }
      }
      return seen ? readAccumulator(merged, fn) : null;
    }
    const cell = byLeaf.get(leaf.key);
    return cell ? readAccumulator(cell[measureIndex], fn) : null;
  };

  // A row's total re-aggregates the row's own source rows over the PRINTED
  // columns, for the same reason the fold does.
  const rowTotalOf = (rowKey: string, measureIndex: number): number | null => {
    const byLeaf = cells.get(rowKey);
    if (!byLeaf) {
      return null;
    }
    const merged = emptyAccumulator();
    let seen = false;
    for (const entry of printableLeaves) {
      const cell = byLeaf.get(entry.key);
      if (cell) {
        seen = true;
        mergeAccumulator(merged, cell[measureIndex]);
      }
    }
    return seen ? readAccumulator(merged, measures[measureIndex].fn) : null;
  };

  const modelRows = sortNested(
    rowOrder.map((key, position) => ({
      key,
      labels: rowLabels.get(key) ?? [key],
      firstSeen: position,
      weight: rowTotalOf(key, 0) ?? 0,
    })),
    element.rowSort,
  ).map<CrosstabModelRow>((entry) => {
    const totals = measures.map((_, measureIndex) => rowTotalOf(entry.key, measureIndex));
    return {
      key: entry.key,
      labels: entry.labels,
      label: entry.labels[0] ?? '',
      values: columns.map((column) =>
        readCell(entry.key, leaves[column.leafIndex], column.measureIndex),
      ),
      totals,
      total: totals[0] ?? null,
    };
  });

  const columnTotals = columns.map((column) => {
    const leaf = leaves[column.leafIndex];
    const merged = emptyAccumulator();
    let seen = false;
    for (const rowKey of rowOrder) {
      const byLeaf = cells.get(rowKey);
      if (!byLeaf) {
        continue;
      }
      if (leaf.key === CROSSTAB_FOLD_KEY) {
        for (const entry of folded) {
          const cell = byLeaf.get(entry.key);
          if (cell) {
            seen = true;
            mergeAccumulator(merged, cell[column.measureIndex]);
          }
        }
        continue;
      }
      const cell = byLeaf.get(leaf.key);
      if (cell) {
        seen = true;
        mergeAccumulator(merged, cell[column.measureIndex]);
      }
    }
    return seen ? readAccumulator(merged, measures[column.measureIndex].fn) : null;
  });

  const printedKeys = new Set(printableLeaves.map((leaf) => leaf.key));
  const grandTotals = measures.map((measure, measureIndex) => {
    const grand = emptyAccumulator();
    let seen = false;
    for (const byLeaf of cells.values()) {
      for (const [key, cell] of byLeaf) {
        if (!printedKeys.has(key)) {
          continue;
        }
        seen = true;
        mergeAccumulator(grand, cell[measureIndex]);
      }
    }
    return seen ? readAccumulator(grand, measure.fn) : null;
  });

  return {
    rowAxes,
    columnAxes,
    measures,
    leaves,
    columns,
    rows: modelRows,
    columnTotals,
    grandTotals,
    grandTotal: grandTotals[0] ?? null,
    sourceRows: total,
    droppedColumns: element.overflow === 'FOLD' ? 0 : folded.length,
  };
}

// ─── The plan ────────────────────────────────────────────────────────────────

/** One label column down the left edge. */
export interface PlannedRowColumn {
  /** Offset from the crosstab's left edge, millimetres. */
  readonly xMm: number;
  readonly wMm: number;
  /** Header caption. The first column's is the crosstab's `corner`. */
  readonly label: string;
  /** Index into each model row's `labels`. */
  readonly levelIndex: number;
}

export interface PlannedColumn {
  readonly key: string;
  readonly label: string;
  /** Offset from the crosstab's left edge, millimetres. */
  readonly xMm: number;
  readonly wMm: number;
  /** Index into the model's column arrays; null for a row-totals column. */
  readonly modelIndex: number | null;
  /** Index into the model's leaves; null for a row-totals column. */
  readonly leafIndex: number | null;
  /** Which measure this column prints -- 0 when there is only one. */
  readonly measureIndex: number;
}

export interface CrosstabPlan {
  readonly element: CrosstabElement;
  readonly model: CrosstabModel;
  readonly rowHeaderWidthMm: number;
  /** The label columns the row axes print in, left to right. */
  readonly rowColumns: readonly PlannedRowColumn[];
  /** Data columns plus, when shown, one row-totals column per measure. */
  readonly columns: readonly PlannedColumn[];
  /** Height of ONE header row. */
  readonly headerRowHeightMm: number;
  /** One per column axis level, plus one for the measure captions when >1. */
  readonly headerRowCount: number;
  /** The whole header: `headerRowHeightMm * headerRowCount`. */
  readonly headerHeightMm: number;
  readonly rowHeightMm: number;
  /** 0 when column totals are off. */
  readonly totalsRowHeightMm: number;
  /** Header + every row + the totals row. */
  readonly fullHeightMm: number;
  readonly bodyFont: MeasuredFont;
  readonly headerFont: MeasuredFont;
  /** Carried so emission can truncate a label without re-plumbing the measurer. */
  readonly measurer: CrosstabMeasurer;
  /** Leaf columns the width budget cut, on top of the model's own maxColumns cut. */
  readonly columnsCutForWidth: number;
}

/** Just enough of TextMeasurer for this file to stay unit-testable. */
export interface CrosstabMeasurer {
  truncateToWidth(text: string, maxWidthMm: number, font: MeasuredFont, ellipsis?: string): string;
  lineHeightMm(font: MeasuredFont): number;
}

const fontOf = (spec: Partial<FontSpec> | undefined, fallback: MeasuredFont): MeasuredFont => ({
  family: spec?.family ?? fallback.family,
  sizePt: spec?.size ?? fallback.sizePt,
  bold: spec?.bold ?? fallback.bold,
  italic: spec?.italic ?? fallback.italic,
});

/**
 * Share `rowHeaderWidthMm` out between the row label columns.
 *
 * A level with a `widthMm` gets it; the rest split what is left. When the fixed
 * widths alone would overrun the budget they are scaled down proportionally
 * rather than allowed to push the data columns off the element -- `w` is a
 * budget the crosstab never draws outside of, and that has to hold for the row
 * header too.
 */
function planRowColumns(
  axes: readonly CrosstabAxisLevel[],
  rowHeaderWidthMm: number,
  cornerLabel: string,
): PlannedRowColumn[] {
  const fixedTotal = axes.reduce((sum, axis) => sum + Math.max(0, axis.widthMm), 0);
  const sharers = axes.filter((axis) => axis.widthMm <= 0).length;
  const overrun = fixedTotal >= rowHeaderWidthMm;
  const scale = overrun && fixedTotal > 0 ? rowHeaderWidthMm / fixedTotal : 1;
  const shareEach = sharers > 0 && !overrun ? (rowHeaderWidthMm - fixedTotal) / sharers : 0;

  const columns: PlannedRowColumn[] = [];
  let cursorMm = 0;
  axes.forEach((axis, levelIndex) => {
    const wMm = axis.widthMm > 0 ? axis.widthMm * scale : shareEach;
    columns.push({
      xMm: cursorMm,
      wMm,
      label: levelIndex === 0 ? cornerLabel : axis.label,
      levelIndex,
    });
    cursorMm += wMm;
  });
  return columns;
}

/**
 * Fit the model into the element's width.
 *
 * With `columnWidthMm` at 0 the data columns share what is left after the row
 * header and the totals columns, and every column always fits. With a fixed
 * width, columns are taken until the budget runs out and the rest are cut --
 * reported as `columnsCutForWidth` so the engine can warn rather than let a
 * report quietly lose a month. Cutting works in whole LEAVES: half a column
 * group -- "Jan qty" with no "Jan amount" beside it -- is a worse answer than
 * one column group fewer.
 */
export function planCrosstab(
  element: CrosstabElement,
  model: CrosstabModel,
  measurer: CrosstabMeasurer,
): CrosstabPlan {
  const bodyFont = fontOf(element.font, {
    family: 'NotoSans',
    sizePt: 9,
    bold: false,
    italic: false,
  });
  const headerFont = fontOf(element.headerFont, { ...bodyFont, bold: true });

  const measureCount = model.measures.length;
  const rowHeaderWidthMm = Math.min(element.rowHeaderWidthMm, Math.max(0, element.w - 1));
  const budgetMm = Math.max(0, element.w - rowHeaderWidthMm);

  const leafCount = model.leaves.length;
  const slotCount = leafCount * measureCount + (element.showRowTotals ? measureCount : 0);

  let widthMm: number;
  let printableLeaves: number;

  if (element.columnWidthMm > 0) {
    widthMm = element.columnWidthMm;
    const slotsThatFit = Math.max(0, Math.floor(budgetMm / widthMm + 0.001));
    // The totals columns are not negotiable when they are switched on: a table
    // whose last column got cut is confusing, one with no total is wrong.
    const dataSlots = element.showRowTotals ? slotsThatFit - measureCount : slotsThatFit;
    printableLeaves = Math.max(0, Math.min(leafCount, Math.floor(dataSlots / measureCount)));
  } else {
    widthMm = slotCount > 0 ? budgetMm / slotCount : budgetMm;
    printableLeaves = leafCount;
  }

  const columns: PlannedColumn[] = [];
  let cursorMm = rowHeaderWidthMm;
  for (let leafIndex = 0; leafIndex < printableLeaves; leafIndex += 1) {
    for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
      const modelIndex = leafIndex * measureCount + measureIndex;
      const column = model.columns[modelIndex];
      columns.push({
        key: column.key,
        label: column.label,
        xMm: cursorMm,
        wMm: widthMm,
        modelIndex,
        leafIndex,
        measureIndex,
      });
      cursorMm += widthMm;
    }
  }
  if (element.showRowTotals) {
    for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
      columns.push({
        key:
          measureCount > 1
            ? `${CROSSTAB_TOTALS_KEY}${LEVEL_SEPARATOR}${measureIndex}`
            : CROSSTAB_TOTALS_KEY,
        label: measureCount > 1 ? model.measures[measureIndex].label : element.totalsLabel,
        xMm: cursorMm,
        wMm: widthMm,
        modelIndex: null,
        leafIndex: null,
        measureIndex,
      });
      cursorMm += widthMm;
    }
  }

  const lineHeightMm = measurer.lineHeightMm(bodyFont);
  const rowHeightMm = Math.max(element.rowHeightMm, lineHeightMm);
  const headerRowHeightMm = Math.max(element.headerHeightMm, measurer.lineHeightMm(headerFont));
  // One row per column level, and one more for the measure captions -- but only
  // when there is more than one measure. A single-measure crosstab has nothing
  // to caption, and an empty band of white above the numbers is not free.
  const headerRowCount = model.columnAxes.length + (measureCount > 1 ? 1 : 0);
  const headerHeightMm = headerRowHeightMm * headerRowCount;
  const totalsRowHeightMm = element.showColumnTotals ? rowHeightMm : 0;

  return {
    element,
    model,
    rowHeaderWidthMm,
    rowColumns: planRowColumns(model.rowAxes, rowHeaderWidthMm, ''),
    columns,
    headerRowHeightMm,
    headerRowCount,
    headerHeightMm,
    rowHeightMm,
    totalsRowHeightMm,
    fullHeightMm: headerHeightMm + model.rows.length * rowHeightMm + totalsRowHeightMm,
    bodyFont,
    headerFont,
    measurer,
    columnsCutForWidth: leafCount - printableLeaves,
  };
}

// ─── Slicing ─────────────────────────────────────────────────────────────────

export interface CrosstabSlice {
  readonly fromRow: number;
  readonly rowCount: number;
  readonly withHeader: boolean;
  readonly withTotals: boolean;
  readonly heightMm: number;
}

/**
 * The next page's worth of the table.
 *
 * Returns a slice with `rowCount: 0` when not even one row fits under the
 * header, which is the engine's signal to break the page first. The totals row
 * only ever rides with the final slice, and only if it fits there -- otherwise
 * it takes a page of its own rather than being dropped.
 */
export function sliceCrosstab(
  plan: CrosstabPlan,
  fromRow: number,
  availableMm: number,
  withHeader: boolean,
): CrosstabSlice {
  const remaining = plan.model.rows.length - fromRow;
  const headerMm = withHeader ? plan.headerHeightMm : 0;
  const forRows = availableMm - headerMm;

  const fits = plan.rowHeightMm > 0 ? Math.floor(forRows / plan.rowHeightMm + 0.001) : 0;
  const rowCount = Math.max(0, Math.min(remaining, fits));

  const isLast = rowCount === remaining;
  const usedMm = headerMm + rowCount * plan.rowHeightMm;
  const withTotals =
    isLast && plan.totalsRowHeightMm > 0 && usedMm + plan.totalsRowHeightMm <= availableMm + 0.001;

  return {
    fromRow,
    rowCount,
    withHeader,
    withTotals,
    heightMm: usedMm + (withTotals ? plan.totalsRowHeightMm : 0),
  };
}

/** True once every row AND the totals row have been emitted. */
export const crosstabIsComplete = (plan: CrosstabPlan, slice: CrosstabSlice): boolean =>
  slice.fromRow + slice.rowCount >= plan.model.rows.length &&
  (plan.totalsRowHeightMm === 0 || slice.withTotals);

// ─── Emission ────────────────────────────────────────────────────────────────

/** Millimetres of breathing room between a cell's text and its grid line. */
const CELL_PADDING_MM = 1;

export interface CrosstabEmitOptions {
  /** Page coordinates of the table's top-left corner. */
  readonly xMm: number;
  readonly yMm: number;
  readonly slice: CrosstabSlice;
  /** Already-evaluated corner caption. */
  readonly cornerText: string;
  readonly strokeColour: string;
  readonly textColour: string;
  readonly headerFill: string | null;
}

/** A merged run of printed columns sharing one header cell. */
interface HeaderSpan {
  readonly label: string;
  readonly xMm: number;
  readonly wMm: number;
}

/**
 * Merge the printed columns into the header cells of one column level.
 *
 * Two adjacent columns share a header cell at `level` when they belong to
 * leaves whose labels agree from level 0 down to `level` -- the prefix test, not
 * just the label at that level, or "Jan" under 2025 would merge with "Jan"
 * under 2026 whenever the two happened to be adjacent.
 */
function headerSpans(plan: CrosstabPlan, level: number): HeaderSpan[] {
  const spans: HeaderSpan[] = [];
  const prefixOf = (column: PlannedColumn): string => {
    if (column.leafIndex === null) {
      // The totals columns are ONE group of their own at every level: they
      // belong to no leaf, so no real column may span across them -- but with
      // several measures they are several columns under a single 'Total', and
      // giving them a shared reserved prefix is what merges them into it. A
      // data label cannot collide: the key carries a control character.
      return CROSSTAB_TOTALS_KEY;
    }
    return joinKey(plan.model.leaves[column.leafIndex].labels.slice(0, level + 1));
  };

  interface OpenSpan {
    prefix: string;
    label: string;
    xMm: number;
    endMm: number;
  }

  let current: OpenSpan | null = null;
  for (const column of plan.columns) {
    const prefix = prefixOf(column);
    const label =
      column.leafIndex === null
        ? level === 0
          ? plan.element.totalsLabel
          : ''
        : (plan.model.leaves[column.leafIndex].labels[level] ?? '');

    if (current && current.prefix === prefix) {
      current.endMm = column.xMm + column.wMm;
      continue;
    }
    if (current) {
      spans.push({ label: current.label, xMm: current.xMm, wMm: current.endMm - current.xMm });
    }
    current = { prefix, label, xMm: column.xMm, endMm: column.xMm + column.wMm };
  }
  if (current) {
    spans.push({ label: current.label, xMm: current.xMm, wMm: current.endMm - current.xMm });
  }
  return spans;
}

/**
 * One slice of the table, as primitives.
 *
 * Order matters: the header fill is a rect and has to be pushed before the text
 * that sits on it, because the engine's z-sort is per ELEMENT and everything
 * here shares one element's z.
 */
export function emitCrosstab(plan: CrosstabPlan, options: CrosstabEmitOptions): Primitive[] {
  const { element, model } = plan;
  const { slice, xMm, yMm } = options;
  const primitives: Primitive[] = [];

  const widthMm = plan.columns.length
    ? plan.columns[plan.columns.length - 1].xMm + plan.columns[plan.columns.length - 1].wMm
    : plan.rowHeaderWidthMm;

  const text = (
    value: string,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number,
    font: MeasuredFont,
    align: 'left' | 'center' | 'right',
  ): void => {
    if (!value) {
      return;
    }
    const innerW = Math.max(0, cellW - CELL_PADDING_MM * 2);
    const clipped = plan.measurer.truncateToWidth(value, innerW, font);
    const primitive: TextPrimitive = {
      k: 'text',
      x: xMm + cellX + CELL_PADDING_MM,
      y: yMm + cellY,
      w: innerW,
      h: cellH,
      text: clipped,
      font: { ...font, underline: false },
      align,
      vAlign: 'middle',
      color: options.textColour,
      lines: [clipped],
      lineHeightMm: cellH,
    };
    primitives.push(primitive);
  };

  const cellText = (value: number | null, measureIndex: number): string => {
    if (value === null) {
      return '';
    }
    const measure = model.measures[measureIndex] ?? model.measures[0];
    if (measure.blankWhenZero && value === 0) {
      return '';
    }
    return formatNumber(value, measure.format);
  };

  let cursorMm = 0;

  // ── Header ────────────────────────────────────────────────────────────
  if (slice.withHeader) {
    if (options.headerFill) {
      const fill: RectPrimitive = {
        k: 'rect',
        x: xMm,
        y: yMm,
        w: widthMm,
        h: plan.headerHeightMm,
        fill: options.headerFill,
        stroke: null,
        strokeWidthPt: 0,
        radiusMm: 0,
      };
      primitives.push(fill);
    }

    // The row-label captions sit in the BOTTOM header row, directly above the
    // labels they name; with one column level and one measure that is the only
    // header row there is, which is where `corner` has always printed.
    const captionTopMm = cursorMm + (plan.headerRowCount - 1) * plan.headerRowHeightMm;
    plan.rowColumns.forEach((rowColumn, index) => {
      text(
        index === 0 ? options.cornerText : rowColumn.label,
        rowColumn.xMm,
        captionTopMm,
        rowColumn.wMm,
        plan.headerRowHeightMm,
        plan.headerFont,
        'left',
      );
    });

    for (let level = 0; level < model.columnAxes.length; level += 1) {
      const levelTopMm = cursorMm + level * plan.headerRowHeightMm;
      for (const span of headerSpans(plan, level)) {
        text(
          span.label,
          span.xMm,
          levelTopMm,
          span.wMm,
          plan.headerRowHeightMm,
          plan.headerFont,
          'center',
        );
      }
    }

    if (model.measures.length > 1) {
      const measureTopMm = cursorMm + model.columnAxes.length * plan.headerRowHeightMm;
      for (const column of plan.columns) {
        text(
          model.measures[column.measureIndex].label,
          column.xMm,
          measureTopMm,
          column.wMm,
          plan.headerRowHeightMm,
          plan.headerFont,
          'center',
        );
      }
    }

    cursorMm += plan.headerHeightMm;
  }

  // ── Body ──────────────────────────────────────────────────────────────
  const bodyTopMm = cursorMm;
  for (let offset = 0; offset < slice.rowCount; offset += 1) {
    const row = model.rows[slice.fromRow + offset];
    const previous = offset > 0 ? model.rows[slice.fromRow + offset - 1] : null;
    for (const rowColumn of plan.rowColumns) {
      // A repeated group label is printed once and then left blank until it
      // changes -- the whole point of nesting the row axis. `previous` is null
      // on the first row of a PAGE, so a table continued overleaf reprints the
      // group it is still inside rather than opening with a blank column.
      const repeated =
        previous !== null &&
        joinKey(previous.labels.slice(0, rowColumn.levelIndex + 1)) ===
          joinKey(row.labels.slice(0, rowColumn.levelIndex + 1));
      text(
        repeated ? '' : (row.labels[rowColumn.levelIndex] ?? ''),
        rowColumn.xMm,
        cursorMm,
        rowColumn.wMm,
        plan.rowHeightMm,
        plan.bodyFont,
        'left',
      );
    }
    for (const column of plan.columns) {
      const value =
        column.modelIndex === null
          ? (row.totals[column.measureIndex] ?? null)
          : row.values[column.modelIndex];
      text(
        cellText(value, column.measureIndex),
        column.xMm,
        cursorMm,
        column.wMm,
        plan.rowHeightMm,
        plan.bodyFont,
        'right',
      );
    }
    cursorMm += plan.rowHeightMm;
  }

  // ── Column totals ─────────────────────────────────────────────────────
  const totalsTopMm = cursorMm;
  if (slice.withTotals) {
    text(
      element.totalsLabel,
      0,
      cursorMm,
      plan.rowHeaderWidthMm,
      plan.totalsRowHeightMm,
      plan.headerFont,
      'left',
    );
    for (const column of plan.columns) {
      const value =
        column.modelIndex === null
          ? (model.grandTotals[column.measureIndex] ?? null)
          : model.columnTotals[column.modelIndex];
      text(
        cellText(value, column.measureIndex),
        column.xMm,
        cursorMm,
        column.wMm,
        plan.totalsRowHeightMm,
        plan.headerFont,
        'right',
      );
    }
    cursorMm += plan.totalsRowHeightMm;
  }

  const heightMm = cursorMm;

  // ── Rules ─────────────────────────────────────────────────────────────
  if (element.gridLines && heightMm > 0) {
    const strokeWidthPt = element.style?.strokeWidthPt ?? 0.4;

    const rule = (y: number): LinePrimitive => ({
      k: 'line',
      x1: xMm,
      y1: yMm + y,
      x2: xMm + widthMm,
      y2: yMm + y,
      widthPt: strokeWidthPt,
      color: options.strokeColour,
      gridChar: '-',
    });

    primitives.push(rule(0));
    if (slice.withHeader) {
      // A rule under every header row, not just under the header as a whole: a
      // two-level header with no line between the levels reads as one smudge.
      for (let level = 1; level <= plan.headerRowCount; level += 1) {
        primitives.push(rule(level * plan.headerRowHeightMm));
      }
    }
    for (let offset = 1; offset <= slice.rowCount; offset += 1) {
      primitives.push(rule(bodyTopMm + offset * plan.rowHeightMm));
    }
    if (slice.withTotals) {
      primitives.push(rule(totalsTopMm + plan.totalsRowHeightMm));
    }

    // Stiles are drawn as SEGMENTS, not full-height lines: a header cell that
    // spans four months must not have the months' own dividers drawn through
    // it, and the measure sub-columns must not be divided above the row that
    // captions them.
    const stile = (x: number, fromMm: number, toMm: number): LinePrimitive => ({
      k: 'line',
      x1: xMm + x,
      y1: yMm + fromMm,
      x2: xMm + x,
      y2: yMm + toMm,
      widthPt: strokeWidthPt,
      color: options.strokeColour,
      gridChar: '|',
    });

    primitives.push(stile(0, 0, heightMm));
    primitives.push(stile(plan.rowHeaderWidthMm, 0, heightMm));
    primitives.push(stile(widthMm, 0, heightMm));

    if (slice.withHeader) {
      for (let level = 0; level < model.columnAxes.length; level += 1) {
        const topMm = level * plan.headerRowHeightMm;
        for (const span of headerSpans(plan, level)) {
          primitives.push(stile(span.xMm, topMm, heightMm));
        }
      }
      if (model.measures.length > 1) {
        const topMm = model.columnAxes.length * plan.headerRowHeightMm;
        for (const column of plan.columns) {
          primitives.push(stile(column.xMm, topMm, heightMm));
        }
      }
      // Inner row-label dividers start at the caption row, so the corner text
      // spans the whole row header above them.
      const captionTopMm = (plan.headerRowCount - 1) * plan.headerRowHeightMm;
      for (const rowColumn of plan.rowColumns.slice(1)) {
        primitives.push(stile(rowColumn.xMm, captionTopMm, heightMm));
      }
    } else {
      // A continuation slice has no header, so every divider runs the full
      // height of what is drawn.
      for (const column of plan.columns) {
        primitives.push(stile(column.xMm, 0, heightMm));
      }
      for (const rowColumn of plan.rowColumns.slice(1)) {
        primitives.push(stile(rowColumn.xMm, 0, heightMm));
      }
    }
  }

  return primitives;
}
