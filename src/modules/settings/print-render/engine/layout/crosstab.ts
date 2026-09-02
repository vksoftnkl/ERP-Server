import {
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
 * ── THREE PASSES, IN THIS ORDER ────────────────────────────────────────────
 *
 *   1. buildCrosstabModel -- one pass over the dataset, accumulating a cell per
 *      (rowKey, columnKey). Nothing about paper is known or needed yet.
 *   2. planCrosstab -- turn the model into positioned columns inside the `w`
 *      budget, folding or clipping whatever will not fit.
 *   3. sliceCrosstab / emitCrosstab -- hand the engine one page's worth of rows
 *      at a time, and turn a slice into primitives.
 *
 * Splitting 2 from 3 is what makes pagination possible: the engine can ask "how
 * many rows fit in the 40mm I have left" without committing to drawing them.
 */

// ─── The model ───────────────────────────────────────────────────────────────

/**
 * Reserved column keys.
 *
 * A dataset whose own labels collide with these would mis-address a cell, so
 * they carry a character no SQL label ever contains.
 */
export const CROSSTAB_FOLD_KEY = '\u001Fcrosstab-fold';
export const CROSSTAB_TOTALS_KEY = '\u001Fcrosstab-total';

export interface CrosstabColumn {
  readonly key: string;
  readonly label: string;
}

export interface CrosstabModelRow {
  readonly key: string;
  readonly label: string;
  /** One entry per model column; null where no source row landed in the cell. */
  readonly values: readonly (number | null)[];
  readonly total: number | null;
}

export interface CrosstabModel {
  readonly columns: readonly CrosstabColumn[];
  readonly rows: readonly CrosstabModelRow[];
  readonly columnTotals: readonly (number | null)[];
  readonly grandTotal: number | null;
  /** Source rows read. Zero means the dataset was empty, not that it was absent. */
  readonly sourceRows: number;
  /** Columns dropped or folded because of `maxColumns` or the width budget. */
  readonly droppedColumns: number;
}

/** Evaluates one of the crosstab's three expressions against a source row. */
export interface CrosstabRowReader {
  text(expression: string, row: unknown, index: number, total: number): string;
  number(expression: string, row: unknown, index: number, total: number): number;
}

const sortLabels = <T extends { key: string; label: string }>(
  entries: T[],
  order: readonly string[],
  sort: CrosstabSort,
  weightOf: (entry: T) => number,
): T[] => {
  if (sort === 'FIRST_SEEN') {
    const position = new Map(order.map((key, index) => [key, index]));
    return [...entries].sort(
      (left, right) => (position.get(left.key) ?? 0) - (position.get(right.key) ?? 0),
    );
  }

  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

  switch (sort) {
    case 'LABEL_ASC':
      return [...entries].sort((left, right) => collator.compare(left.label, right.label));
    case 'LABEL_DESC':
      return [...entries].sort((left, right) => collator.compare(right.label, left.label));
    case 'VALUE_DESC':
      return [...entries].sort((left, right) => weightOf(right) - weightOf(left));
    case 'VALUE_ASC':
      return [...entries].sort((left, right) => weightOf(left) - weightOf(right));
    default:
      return entries;
  }
};

/**
 * Aggregate the source rows into a pivot.
 *
 * `maxColumns` is applied HERE rather than at draw time, because folding the
 * tail into an 'Other' column has to happen before the row totals are read off
 * the accumulators -- otherwise the totals would describe columns that never
 * printed, and a reader adding the row up by eye would get a different answer
 * from the one on the paper.
 */
export function buildCrosstabModel(
  element: CrosstabElement,
  rows: readonly unknown[],
  reader: CrosstabRowReader,
): CrosstabModel {
  const cells = new Map<string, Map<string, Accumulator>>();
  const rowLabels = new Map<string, string>();
  const columnLabels = new Map<string, string>();
  const rowOrder: string[] = [];
  const columnOrder: string[] = [];

  const total = rows.length;

  rows.forEach((row, index) => {
    const rowLabel = reader.text(element.rowBy, row, index, total);
    const columnLabel = reader.text(element.columnBy, row, index, total);
    const value = reader.number(element.measure, row, index, total);

    if (!rowLabels.has(rowLabel)) {
      rowLabels.set(rowLabel, rowLabel);
      rowOrder.push(rowLabel);
    }
    if (!columnLabels.has(columnLabel)) {
      columnLabels.set(columnLabel, columnLabel);
      columnOrder.push(columnLabel);
    }

    let byColumn = cells.get(rowLabel);
    if (!byColumn) {
      byColumn = new Map<string, Accumulator>();
      cells.set(rowLabel, byColumn);
    }
    let accumulator = byColumn.get(columnLabel);
    if (!accumulator) {
      accumulator = emptyAccumulator();
      byColumn.set(columnLabel, accumulator);
    }
    accumulate(accumulator, Number.isFinite(value) ? value : null);
  });

  // Column weight for a VALUE_* sort: the column's own total across all rows.
  const columnWeight = new Map<string, number>();
  for (const key of columnOrder) {
    const column = emptyAccumulator();
    for (const byColumn of cells.values()) {
      const cell = byColumn.get(key);
      if (cell) {
        accumulate(column, readAccumulator(cell, element.fn));
      }
    }
    columnWeight.set(key, readAccumulator(column, 'sum'));
  }

  const allColumns = sortLabels(
    columnOrder.map((key) => ({ key, label: columnLabels.get(key) ?? key })),
    columnOrder,
    element.columnSort,
    (entry) => columnWeight.get(entry.key) ?? 0,
  );

  const kept = allColumns.slice(0, element.maxColumns);
  const folded = allColumns.slice(element.maxColumns);
  const foldColumn: CrosstabColumn | null =
    folded.length > 0 && element.overflow === 'FOLD'
      ? { key: CROSSTAB_FOLD_KEY, label: element.overflowLabel }
      : null;

  const columns: CrosstabColumn[] = foldColumn ? [...kept, foldColumn] : kept;

  const readCell = (rowKey: string, columnKey: string): number | null => {
    const byColumn = cells.get(rowKey);
    if (!byColumn) {
      return null;
    }
    if (columnKey === CROSSTAB_FOLD_KEY) {
      // The fold is a re-aggregation, not a sum of already-aggregated cells:
      // folding three 'avg' columns by adding them would print a number that is
      // not an average of anything.
      const merged = emptyAccumulator();
      let seen = false;
      for (const entry of folded) {
        const cell = byColumn.get(entry.key);
        if (cell) {
          seen = true;
          mergeAccumulator(merged, cell);
        }
      }
      return seen ? readAccumulator(merged, element.fn) : null;
    }
    const cell = byColumn.get(columnKey);
    return cell ? readAccumulator(cell, element.fn) : null;
  };

  // A row's total re-aggregates the row's own source rows over the PRINTED
  // columns, for the same reason the fold does.
  const rowTotalOf = (rowKey: string): number | null => {
    const byColumn = cells.get(rowKey);
    if (!byColumn) {
      return null;
    }
    const printable =
      element.overflow === 'FOLD' ? allColumns : allColumns.slice(0, element.maxColumns);
    const merged = emptyAccumulator();
    let seen = false;
    for (const entry of printable) {
      const cell = byColumn.get(entry.key);
      if (cell) {
        seen = true;
        mergeAccumulator(merged, cell);
      }
    }
    return seen ? readAccumulator(merged, element.fn) : null;
  };

  const modelRows = sortLabels(
    rowOrder.map((key) => ({ key, label: rowLabels.get(key) ?? key })),
    rowOrder,
    element.rowSort,
    (entry) => rowTotalOf(entry.key) ?? 0,
  ).map<CrosstabModelRow>((entry) => ({
    key: entry.key,
    label: entry.label,
    values: columns.map((column) => readCell(entry.key, column.key)),
    total: rowTotalOf(entry.key),
  }));

  const columnTotals = columns.map((column) => {
    const merged = emptyAccumulator();
    let seen = false;
    for (const rowKey of rowOrder) {
      const byColumn = cells.get(rowKey);
      if (!byColumn) {
        continue;
      }
      if (column.key === CROSSTAB_FOLD_KEY) {
        for (const entry of folded) {
          const cell = byColumn.get(entry.key);
          if (cell) {
            seen = true;
            mergeAccumulator(merged, cell);
          }
        }
        continue;
      }
      const cell = byColumn.get(column.key);
      if (cell) {
        seen = true;
        mergeAccumulator(merged, cell);
      }
    }
    return seen ? readAccumulator(merged, element.fn) : null;
  });

  const grand = emptyAccumulator();
  let grandSeen = false;
  const printedKeys = new Set(
    element.overflow === 'FOLD' ? allColumns.map((c) => c.key) : kept.map((c) => c.key),
  );
  for (const byColumn of cells.values()) {
    for (const [key, cell] of byColumn) {
      if (!printedKeys.has(key)) {
        continue;
      }
      grandSeen = true;
      mergeAccumulator(grand, cell);
    }
  }

  return {
    columns,
    rows: modelRows,
    columnTotals,
    grandTotal: grandSeen ? readAccumulator(grand, element.fn) : null,
    sourceRows: total,
    droppedColumns: element.overflow === 'FOLD' ? 0 : folded.length,
  };
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

// ─── The plan ────────────────────────────────────────────────────────────────

export interface PlannedColumn {
  readonly key: string;
  readonly label: string;
  /** Offset from the crosstab's left edge, millimetres. */
  readonly xMm: number;
  readonly wMm: number;
  /** Index into the model's column arrays; null for the row-totals column. */
  readonly modelIndex: number | null;
}

export interface CrosstabPlan {
  readonly element: CrosstabElement;
  readonly model: CrosstabModel;
  readonly rowHeaderWidthMm: number;
  /** Data columns plus, when shown, the row-totals column. */
  readonly columns: readonly PlannedColumn[];
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
  /** Columns the width budget cut, on top of the model's own maxColumns cut. */
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
 * Fit the model into the element's width.
 *
 * With `columnWidthMm` at 0 the data columns share what is left after the row
 * header and the totals column, and every column always fits. With a fixed
 * width, columns are taken until the budget runs out and the rest are cut --
 * reported as `columnsCutForWidth` so the engine can warn rather than let a
 * report quietly lose a month.
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

  const rowHeaderWidthMm = Math.min(element.rowHeaderWidthMm, Math.max(0, element.w - 1));
  const budgetMm = Math.max(0, element.w - rowHeaderWidthMm);

  const dataCount = model.columns.length;
  const slotCount = dataCount + (element.showRowTotals ? 1 : 0);

  let widthMm: number;
  let printableData: number;

  if (element.columnWidthMm > 0) {
    widthMm = element.columnWidthMm;
    const slotsThatFit = Math.max(0, Math.floor(budgetMm / widthMm + 0.001));
    // The totals column is not negotiable when it is switched on: a table whose
    // last column got cut is confusing, one with no total is wrong.
    const dataSlots = element.showRowTotals ? slotsThatFit - 1 : slotsThatFit;
    printableData = Math.max(0, Math.min(dataCount, dataSlots));
  } else {
    widthMm = slotCount > 0 ? budgetMm / slotCount : budgetMm;
    printableData = dataCount;
  }

  const columns: PlannedColumn[] = [];
  let cursorMm = rowHeaderWidthMm;
  for (let index = 0; index < printableData; index += 1) {
    const column = model.columns[index];
    columns.push({
      key: column.key,
      label: column.label,
      xMm: cursorMm,
      wMm: widthMm,
      modelIndex: index,
    });
    cursorMm += widthMm;
  }
  if (element.showRowTotals) {
    columns.push({
      key: CROSSTAB_TOTALS_KEY,
      label: element.totalsLabel,
      xMm: cursorMm,
      wMm: widthMm,
      modelIndex: null,
    });
  }

  const lineHeightMm = measurer.lineHeightMm(bodyFont);
  const rowHeightMm = Math.max(element.rowHeightMm, lineHeightMm);
  const headerHeightMm = Math.max(element.headerHeightMm, measurer.lineHeightMm(headerFont));
  const totalsRowHeightMm = element.showColumnTotals ? rowHeightMm : 0;

  return {
    element,
    model,
    rowHeaderWidthMm,
    columns,
    headerHeightMm,
    rowHeightMm,
    totalsRowHeightMm,
    fullHeightMm: headerHeightMm + model.rows.length * rowHeightMm + totalsRowHeightMm,
    bodyFont,
    headerFont,
    measurer,
    columnsCutForWidth: dataCount - printableData,
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

  const cellText = (value: number | null): string => {
    if (value === null) {
      return '';
    }
    if (element.blankWhenZero && value === 0) {
      return '';
    }
    return formatNumber(value, element.format);
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
    text(
      options.cornerText,
      0,
      cursorMm,
      plan.rowHeaderWidthMm,
      plan.headerHeightMm,
      plan.headerFont,
      'left',
    );
    for (const column of plan.columns) {
      text(
        column.label,
        column.xMm,
        cursorMm,
        column.wMm,
        plan.headerHeightMm,
        plan.headerFont,
        'center',
      );
    }
    cursorMm += plan.headerHeightMm;
  }

  // ── Body ──────────────────────────────────────────────────────────────
  const bodyTopMm = cursorMm;
  for (let offset = 0; offset < slice.rowCount; offset += 1) {
    const row = model.rows[slice.fromRow + offset];
    text(row.label, 0, cursorMm, plan.rowHeaderWidthMm, plan.rowHeightMm, plan.bodyFont, 'left');
    for (const column of plan.columns) {
      const value = column.modelIndex === null ? row.total : row.values[column.modelIndex];
      text(
        cellText(value),
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
        column.modelIndex === null ? model.grandTotal : model.columnTotals[column.modelIndex];
      text(
        cellText(value),
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
    const rule = (y: number): LinePrimitive => ({
      k: 'line',
      x1: xMm,
      y1: yMm + y,
      x2: xMm + widthMm,
      y2: yMm + y,
      widthPt: element.style?.strokeWidthPt ?? 0.4,
      color: options.strokeColour,
      gridChar: '-',
    });

    primitives.push(rule(0));
    if (slice.withHeader) {
      primitives.push(rule(plan.headerHeightMm));
    }
    for (let offset = 1; offset <= slice.rowCount; offset += 1) {
      primitives.push(rule(bodyTopMm + offset * plan.rowHeightMm));
    }
    if (slice.withTotals) {
      primitives.push(rule(totalsTopMm + plan.totalsRowHeightMm));
    }

    const stile = (x: number): LinePrimitive => ({
      k: 'line',
      x1: xMm + x,
      y1: yMm,
      x2: xMm + x,
      y2: yMm + heightMm,
      widthPt: element.style?.strokeWidthPt ?? 0.4,
      color: options.strokeColour,
      gridChar: '|',
    });

    primitives.push(stile(0));
    primitives.push(stile(plan.rowHeaderWidthMm));
    for (const column of plan.columns) {
      primitives.push(stile(column.xMm + column.wMm));
    }
  }

  return primitives;
}
