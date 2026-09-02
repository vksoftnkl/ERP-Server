"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crosstabIsComplete = exports.CROSSTAB_TOTALS_KEY = exports.CROSSTAB_FOLD_KEY = void 0;
exports.buildCrosstabModel = buildCrosstabModel;
exports.planCrosstab = planCrosstab;
exports.sliceCrosstab = sliceCrosstab;
exports.emitCrosstab = emitCrosstab;
const format_1 = require("../expression/transforms/format");
const aggregate_accumulator_1 = require("./aggregate.accumulator");
exports.CROSSTAB_FOLD_KEY = '\u001Fcrosstab-fold';
exports.CROSSTAB_TOTALS_KEY = '\u001Fcrosstab-total';
const sortLabels = (entries, order, sort, weightOf) => {
    if (sort === 'FIRST_SEEN') {
        const position = new Map(order.map((key, index) => [key, index]));
        return [...entries].sort((left, right) => (position.get(left.key) ?? 0) - (position.get(right.key) ?? 0));
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
function buildCrosstabModel(element, rows, reader) {
    const cells = new Map();
    const rowLabels = new Map();
    const columnLabels = new Map();
    const rowOrder = [];
    const columnOrder = [];
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
            byColumn = new Map();
            cells.set(rowLabel, byColumn);
        }
        let accumulator = byColumn.get(columnLabel);
        if (!accumulator) {
            accumulator = (0, aggregate_accumulator_1.emptyAccumulator)();
            byColumn.set(columnLabel, accumulator);
        }
        (0, aggregate_accumulator_1.accumulate)(accumulator, Number.isFinite(value) ? value : null);
    });
    const columnWeight = new Map();
    for (const key of columnOrder) {
        const column = (0, aggregate_accumulator_1.emptyAccumulator)();
        for (const byColumn of cells.values()) {
            const cell = byColumn.get(key);
            if (cell) {
                (0, aggregate_accumulator_1.accumulate)(column, (0, aggregate_accumulator_1.readAccumulator)(cell, element.fn));
            }
        }
        columnWeight.set(key, (0, aggregate_accumulator_1.readAccumulator)(column, 'sum'));
    }
    const allColumns = sortLabels(columnOrder.map((key) => ({ key, label: columnLabels.get(key) ?? key })), columnOrder, element.columnSort, (entry) => columnWeight.get(entry.key) ?? 0);
    const kept = allColumns.slice(0, element.maxColumns);
    const folded = allColumns.slice(element.maxColumns);
    const foldColumn = folded.length > 0 && element.overflow === 'FOLD'
        ? { key: exports.CROSSTAB_FOLD_KEY, label: element.overflowLabel }
        : null;
    const columns = foldColumn ? [...kept, foldColumn] : kept;
    const readCell = (rowKey, columnKey) => {
        const byColumn = cells.get(rowKey);
        if (!byColumn) {
            return null;
        }
        if (columnKey === exports.CROSSTAB_FOLD_KEY) {
            const merged = (0, aggregate_accumulator_1.emptyAccumulator)();
            let seen = false;
            for (const entry of folded) {
                const cell = byColumn.get(entry.key);
                if (cell) {
                    seen = true;
                    mergeAccumulator(merged, cell);
                }
            }
            return seen ? (0, aggregate_accumulator_1.readAccumulator)(merged, element.fn) : null;
        }
        const cell = byColumn.get(columnKey);
        return cell ? (0, aggregate_accumulator_1.readAccumulator)(cell, element.fn) : null;
    };
    const rowTotalOf = (rowKey) => {
        const byColumn = cells.get(rowKey);
        if (!byColumn) {
            return null;
        }
        const printable = element.overflow === 'FOLD' ? allColumns : allColumns.slice(0, element.maxColumns);
        const merged = (0, aggregate_accumulator_1.emptyAccumulator)();
        let seen = false;
        for (const entry of printable) {
            const cell = byColumn.get(entry.key);
            if (cell) {
                seen = true;
                mergeAccumulator(merged, cell);
            }
        }
        return seen ? (0, aggregate_accumulator_1.readAccumulator)(merged, element.fn) : null;
    };
    const modelRows = sortLabels(rowOrder.map((key) => ({ key, label: rowLabels.get(key) ?? key })), rowOrder, element.rowSort, (entry) => rowTotalOf(entry.key) ?? 0).map((entry) => ({
        key: entry.key,
        label: entry.label,
        values: columns.map((column) => readCell(entry.key, column.key)),
        total: rowTotalOf(entry.key),
    }));
    const columnTotals = columns.map((column) => {
        const merged = (0, aggregate_accumulator_1.emptyAccumulator)();
        let seen = false;
        for (const rowKey of rowOrder) {
            const byColumn = cells.get(rowKey);
            if (!byColumn) {
                continue;
            }
            if (column.key === exports.CROSSTAB_FOLD_KEY) {
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
        return seen ? (0, aggregate_accumulator_1.readAccumulator)(merged, element.fn) : null;
    });
    const grand = (0, aggregate_accumulator_1.emptyAccumulator)();
    let grandSeen = false;
    const printedKeys = new Set(element.overflow === 'FOLD' ? allColumns.map((c) => c.key) : kept.map((c) => c.key));
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
        grandTotal: grandSeen ? (0, aggregate_accumulator_1.readAccumulator)(grand, element.fn) : null,
        sourceRows: total,
        droppedColumns: element.overflow === 'FOLD' ? 0 : folded.length,
    };
}
const mergeAccumulator = (into, from) => {
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
const fontOf = (spec, fallback) => ({
    family: spec?.family ?? fallback.family,
    sizePt: spec?.size ?? fallback.sizePt,
    bold: spec?.bold ?? fallback.bold,
    italic: spec?.italic ?? fallback.italic,
});
function planCrosstab(element, model, measurer) {
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
    let widthMm;
    let printableData;
    if (element.columnWidthMm > 0) {
        widthMm = element.columnWidthMm;
        const slotsThatFit = Math.max(0, Math.floor(budgetMm / widthMm + 0.001));
        const dataSlots = element.showRowTotals ? slotsThatFit - 1 : slotsThatFit;
        printableData = Math.max(0, Math.min(dataCount, dataSlots));
    }
    else {
        widthMm = slotCount > 0 ? budgetMm / slotCount : budgetMm;
        printableData = dataCount;
    }
    const columns = [];
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
            key: exports.CROSSTAB_TOTALS_KEY,
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
function sliceCrosstab(plan, fromRow, availableMm, withHeader) {
    const remaining = plan.model.rows.length - fromRow;
    const headerMm = withHeader ? plan.headerHeightMm : 0;
    const forRows = availableMm - headerMm;
    const fits = plan.rowHeightMm > 0 ? Math.floor(forRows / plan.rowHeightMm + 0.001) : 0;
    const rowCount = Math.max(0, Math.min(remaining, fits));
    const isLast = rowCount === remaining;
    const usedMm = headerMm + rowCount * plan.rowHeightMm;
    const withTotals = isLast && plan.totalsRowHeightMm > 0 && usedMm + plan.totalsRowHeightMm <= availableMm + 0.001;
    return {
        fromRow,
        rowCount,
        withHeader,
        withTotals,
        heightMm: usedMm + (withTotals ? plan.totalsRowHeightMm : 0),
    };
}
const crosstabIsComplete = (plan, slice) => slice.fromRow + slice.rowCount >= plan.model.rows.length &&
    (plan.totalsRowHeightMm === 0 || slice.withTotals);
exports.crosstabIsComplete = crosstabIsComplete;
const CELL_PADDING_MM = 1;
function emitCrosstab(plan, options) {
    const { element, model } = plan;
    const { slice, xMm, yMm } = options;
    const primitives = [];
    const widthMm = plan.columns.length
        ? plan.columns[plan.columns.length - 1].xMm + plan.columns[plan.columns.length - 1].wMm
        : plan.rowHeaderWidthMm;
    const text = (value, cellX, cellY, cellW, cellH, font, align) => {
        if (!value) {
            return;
        }
        const innerW = Math.max(0, cellW - CELL_PADDING_MM * 2);
        const clipped = plan.measurer.truncateToWidth(value, innerW, font);
        const primitive = {
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
    const cellText = (value) => {
        if (value === null) {
            return '';
        }
        if (element.blankWhenZero && value === 0) {
            return '';
        }
        return (0, format_1.formatNumber)(value, element.format);
    };
    let cursorMm = 0;
    if (slice.withHeader) {
        if (options.headerFill) {
            const fill = {
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
        text(options.cornerText, 0, cursorMm, plan.rowHeaderWidthMm, plan.headerHeightMm, plan.headerFont, 'left');
        for (const column of plan.columns) {
            text(column.label, column.xMm, cursorMm, column.wMm, plan.headerHeightMm, plan.headerFont, 'center');
        }
        cursorMm += plan.headerHeightMm;
    }
    const bodyTopMm = cursorMm;
    for (let offset = 0; offset < slice.rowCount; offset += 1) {
        const row = model.rows[slice.fromRow + offset];
        text(row.label, 0, cursorMm, plan.rowHeaderWidthMm, plan.rowHeightMm, plan.bodyFont, 'left');
        for (const column of plan.columns) {
            const value = column.modelIndex === null ? row.total : row.values[column.modelIndex];
            text(cellText(value), column.xMm, cursorMm, column.wMm, plan.rowHeightMm, plan.bodyFont, 'right');
        }
        cursorMm += plan.rowHeightMm;
    }
    const totalsTopMm = cursorMm;
    if (slice.withTotals) {
        text(element.totalsLabel, 0, cursorMm, plan.rowHeaderWidthMm, plan.totalsRowHeightMm, plan.headerFont, 'left');
        for (const column of plan.columns) {
            const value = column.modelIndex === null ? model.grandTotal : model.columnTotals[column.modelIndex];
            text(cellText(value), column.xMm, cursorMm, column.wMm, plan.totalsRowHeightMm, plan.headerFont, 'right');
        }
        cursorMm += plan.totalsRowHeightMm;
    }
    const heightMm = cursorMm;
    if (element.gridLines && heightMm > 0) {
        const rule = (y) => ({
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
        const stile = (x) => ({
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
//# sourceMappingURL=crosstab.js.map