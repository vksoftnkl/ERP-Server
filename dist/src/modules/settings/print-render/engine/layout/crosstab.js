"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crosstabIsComplete = exports.crosstabMeasures = exports.crosstabColumnAxes = exports.crosstabRowAxes = exports.CROSSTAB_TOTALS_KEY = exports.CROSSTAB_FOLD_KEY = void 0;
exports.buildCrosstabModel = buildCrosstabModel;
exports.planCrosstab = planCrosstab;
exports.sliceCrosstab = sliceCrosstab;
exports.emitCrosstab = emitCrosstab;
const format_1 = require("../expression/transforms/format");
const aggregate_accumulator_1 = require("./aggregate.accumulator");
exports.CROSSTAB_FOLD_KEY = '\u001Fcrosstab-fold';
exports.CROSSTAB_TOTALS_KEY = '\u001Fcrosstab-total';
const LEVEL_SEPARATOR = '\u001E';
const joinKey = (labels) => labels.join(LEVEL_SEPARATOR);
const crosstabRowAxes = (element) => [
    { expression: element.rowBy, label: '', widthMm: 0 },
    ...element.extraRowBys.map((axis) => ({
        expression: axis.expression,
        label: axis.label,
        widthMm: axis.widthMm,
    })),
];
exports.crosstabRowAxes = crosstabRowAxes;
const crosstabColumnAxes = (element) => [
    { expression: element.columnBy, label: '', widthMm: 0 },
    ...element.extraColumnBys.map((axis) => ({
        expression: axis.expression,
        label: axis.label,
        widthMm: axis.widthMm,
    })),
];
exports.crosstabColumnAxes = crosstabColumnAxes;
const crosstabMeasures = (element) => [
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
exports.crosstabMeasures = crosstabMeasures;
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const compareNodes = (left, right, sort) => {
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
function sortNested(entries, sort) {
    const root = {
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
    const out = [];
    const walk = (node) => {
        if (node.entry) {
            out.push(node.entry);
        }
        const children = [...node.children.values()].sort((left, right) => compareNodes(left, right, sort));
        for (const child of children) {
            walk(child);
        }
    };
    walk(root);
    return out;
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
function buildCrosstabModel(element, rows, reader) {
    const rowAxes = (0, exports.crosstabRowAxes)(element);
    const columnAxes = (0, exports.crosstabColumnAxes)(element);
    const measures = (0, exports.crosstabMeasures)(element);
    const cells = new Map();
    const rowLabels = new Map();
    const leafLabels = new Map();
    const rowOrder = [];
    const leafOrder = [];
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
            byLeaf = new Map();
            cells.set(rowKey, byLeaf);
        }
        let accumulators = byLeaf.get(leafKey);
        if (!accumulators) {
            accumulators = measures.map(() => (0, aggregate_accumulator_1.emptyAccumulator)());
            byLeaf.set(leafKey, accumulators);
        }
        measures.forEach((measure, measureIndex) => {
            const value = reader.number(measure.expression, row, index, total);
            (0, aggregate_accumulator_1.accumulate)(accumulators[measureIndex], Number.isFinite(value) ? value : null);
        });
    });
    const leafWeight = new Map();
    for (const key of leafOrder) {
        const column = (0, aggregate_accumulator_1.emptyAccumulator)();
        for (const byLeaf of cells.values()) {
            const cell = byLeaf.get(key);
            if (cell) {
                (0, aggregate_accumulator_1.accumulate)(column, (0, aggregate_accumulator_1.readAccumulator)(cell[0], measures[0].fn));
            }
        }
        leafWeight.set(key, (0, aggregate_accumulator_1.readAccumulator)(column, 'sum'));
    }
    const allLeaves = sortNested(leafOrder.map((key, position) => ({
        key,
        labels: leafLabels.get(key) ?? [key],
        firstSeen: position,
        weight: leafWeight.get(key) ?? 0,
    })), element.columnSort);
    const kept = allLeaves.slice(0, element.maxColumns);
    const folded = allLeaves.slice(element.maxColumns);
    const foldLeaf = folded.length > 0 && element.overflow === 'FOLD'
        ? {
            key: exports.CROSSTAB_FOLD_KEY,
            labels: columnAxes.map((_, level) => (level === 0 ? element.overflowLabel : '')),
            label: element.overflowLabel,
        }
        : null;
    const leaves = [
        ...kept.map((entry) => ({
            key: entry.key,
            labels: entry.labels,
            label: entry.labels[entry.labels.length - 1] ?? '',
        })),
        ...(foldLeaf ? [foldLeaf] : []),
    ];
    const columns = [];
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
    const printableLeaves = element.overflow === 'FOLD' ? allLeaves : kept;
    const readCell = (rowKey, leaf, measureIndex) => {
        const byLeaf = cells.get(rowKey);
        if (!byLeaf) {
            return null;
        }
        const fn = measures[measureIndex].fn;
        if (leaf.key === exports.CROSSTAB_FOLD_KEY) {
            const merged = (0, aggregate_accumulator_1.emptyAccumulator)();
            let seen = false;
            for (const entry of folded) {
                const cell = byLeaf.get(entry.key);
                if (cell) {
                    seen = true;
                    mergeAccumulator(merged, cell[measureIndex]);
                }
            }
            return seen ? (0, aggregate_accumulator_1.readAccumulator)(merged, fn) : null;
        }
        const cell = byLeaf.get(leaf.key);
        return cell ? (0, aggregate_accumulator_1.readAccumulator)(cell[measureIndex], fn) : null;
    };
    const rowTotalOf = (rowKey, measureIndex) => {
        const byLeaf = cells.get(rowKey);
        if (!byLeaf) {
            return null;
        }
        const merged = (0, aggregate_accumulator_1.emptyAccumulator)();
        let seen = false;
        for (const entry of printableLeaves) {
            const cell = byLeaf.get(entry.key);
            if (cell) {
                seen = true;
                mergeAccumulator(merged, cell[measureIndex]);
            }
        }
        return seen ? (0, aggregate_accumulator_1.readAccumulator)(merged, measures[measureIndex].fn) : null;
    };
    const modelRows = sortNested(rowOrder.map((key, position) => ({
        key,
        labels: rowLabels.get(key) ?? [key],
        firstSeen: position,
        weight: rowTotalOf(key, 0) ?? 0,
    })), element.rowSort).map((entry) => {
        const totals = measures.map((_, measureIndex) => rowTotalOf(entry.key, measureIndex));
        return {
            key: entry.key,
            labels: entry.labels,
            label: entry.labels[0] ?? '',
            values: columns.map((column) => readCell(entry.key, leaves[column.leafIndex], column.measureIndex)),
            totals,
            total: totals[0] ?? null,
        };
    });
    const columnTotals = columns.map((column) => {
        const leaf = leaves[column.leafIndex];
        const merged = (0, aggregate_accumulator_1.emptyAccumulator)();
        let seen = false;
        for (const rowKey of rowOrder) {
            const byLeaf = cells.get(rowKey);
            if (!byLeaf) {
                continue;
            }
            if (leaf.key === exports.CROSSTAB_FOLD_KEY) {
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
        return seen ? (0, aggregate_accumulator_1.readAccumulator)(merged, measures[column.measureIndex].fn) : null;
    });
    const printedKeys = new Set(printableLeaves.map((leaf) => leaf.key));
    const grandTotals = measures.map((measure, measureIndex) => {
        const grand = (0, aggregate_accumulator_1.emptyAccumulator)();
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
        return seen ? (0, aggregate_accumulator_1.readAccumulator)(grand, measure.fn) : null;
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
const fontOf = (spec, fallback) => ({
    family: spec?.family ?? fallback.family,
    sizePt: spec?.size ?? fallback.sizePt,
    bold: spec?.bold ?? fallback.bold,
    italic: spec?.italic ?? fallback.italic,
});
function planRowColumns(axes, rowHeaderWidthMm, cornerLabel) {
    const fixedTotal = axes.reduce((sum, axis) => sum + Math.max(0, axis.widthMm), 0);
    const sharers = axes.filter((axis) => axis.widthMm <= 0).length;
    const overrun = fixedTotal >= rowHeaderWidthMm;
    const scale = overrun && fixedTotal > 0 ? rowHeaderWidthMm / fixedTotal : 1;
    const shareEach = sharers > 0 && !overrun ? (rowHeaderWidthMm - fixedTotal) / sharers : 0;
    const columns = [];
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
function planCrosstab(element, model, measurer) {
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
    let widthMm;
    let printableLeaves;
    if (element.columnWidthMm > 0) {
        widthMm = element.columnWidthMm;
        const slotsThatFit = Math.max(0, Math.floor(budgetMm / widthMm + 0.001));
        const dataSlots = element.showRowTotals ? slotsThatFit - measureCount : slotsThatFit;
        printableLeaves = Math.max(0, Math.min(leafCount, Math.floor(dataSlots / measureCount)));
    }
    else {
        widthMm = slotCount > 0 ? budgetMm / slotCount : budgetMm;
        printableLeaves = leafCount;
    }
    const columns = [];
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
                key: measureCount > 1
                    ? `${exports.CROSSTAB_TOTALS_KEY}${LEVEL_SEPARATOR}${measureIndex}`
                    : exports.CROSSTAB_TOTALS_KEY,
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
function headerSpans(plan, level) {
    const spans = [];
    const prefixOf = (column) => {
        if (column.leafIndex === null) {
            return exports.CROSSTAB_TOTALS_KEY;
        }
        return joinKey(plan.model.leaves[column.leafIndex].labels.slice(0, level + 1));
    };
    let current = null;
    for (const column of plan.columns) {
        const prefix = prefixOf(column);
        const label = column.leafIndex === null
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
    const cellText = (value, measureIndex) => {
        if (value === null) {
            return '';
        }
        const measure = model.measures[measureIndex] ?? model.measures[0];
        if (measure.blankWhenZero && value === 0) {
            return '';
        }
        return (0, format_1.formatNumber)(value, measure.format);
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
        const captionTopMm = cursorMm + (plan.headerRowCount - 1) * plan.headerRowHeightMm;
        plan.rowColumns.forEach((rowColumn, index) => {
            text(index === 0 ? options.cornerText : rowColumn.label, rowColumn.xMm, captionTopMm, rowColumn.wMm, plan.headerRowHeightMm, plan.headerFont, 'left');
        });
        for (let level = 0; level < model.columnAxes.length; level += 1) {
            const levelTopMm = cursorMm + level * plan.headerRowHeightMm;
            for (const span of headerSpans(plan, level)) {
                text(span.label, span.xMm, levelTopMm, span.wMm, plan.headerRowHeightMm, plan.headerFont, 'center');
            }
        }
        if (model.measures.length > 1) {
            const measureTopMm = cursorMm + model.columnAxes.length * plan.headerRowHeightMm;
            for (const column of plan.columns) {
                text(model.measures[column.measureIndex].label, column.xMm, measureTopMm, column.wMm, plan.headerRowHeightMm, plan.headerFont, 'center');
            }
        }
        cursorMm += plan.headerHeightMm;
    }
    const bodyTopMm = cursorMm;
    for (let offset = 0; offset < slice.rowCount; offset += 1) {
        const row = model.rows[slice.fromRow + offset];
        const previous = offset > 0 ? model.rows[slice.fromRow + offset - 1] : null;
        for (const rowColumn of plan.rowColumns) {
            const repeated = previous !== null &&
                joinKey(previous.labels.slice(0, rowColumn.levelIndex + 1)) ===
                    joinKey(row.labels.slice(0, rowColumn.levelIndex + 1));
            text(repeated ? '' : (row.labels[rowColumn.levelIndex] ?? ''), rowColumn.xMm, cursorMm, rowColumn.wMm, plan.rowHeightMm, plan.bodyFont, 'left');
        }
        for (const column of plan.columns) {
            const value = column.modelIndex === null
                ? (row.totals[column.measureIndex] ?? null)
                : row.values[column.modelIndex];
            text(cellText(value, column.measureIndex), column.xMm, cursorMm, column.wMm, plan.rowHeightMm, plan.bodyFont, 'right');
        }
        cursorMm += plan.rowHeightMm;
    }
    const totalsTopMm = cursorMm;
    if (slice.withTotals) {
        text(element.totalsLabel, 0, cursorMm, plan.rowHeaderWidthMm, plan.totalsRowHeightMm, plan.headerFont, 'left');
        for (const column of plan.columns) {
            const value = column.modelIndex === null
                ? (model.grandTotals[column.measureIndex] ?? null)
                : model.columnTotals[column.modelIndex];
            text(cellText(value, column.measureIndex), column.xMm, cursorMm, column.wMm, plan.totalsRowHeightMm, plan.headerFont, 'right');
        }
        cursorMm += plan.totalsRowHeightMm;
    }
    const heightMm = cursorMm;
    if (element.gridLines && heightMm > 0) {
        const strokeWidthPt = element.style?.strokeWidthPt ?? 0.4;
        const rule = (y) => ({
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
        const stile = (x, fromMm, toMm) => ({
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
            const captionTopMm = (plan.headerRowCount - 1) * plan.headerRowHeightMm;
            for (const rowColumn of plan.rowColumns.slice(1)) {
                primitives.push(stile(rowColumn.xMm, captionTopMm, heightMm));
            }
        }
        else {
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
//# sourceMappingURL=crosstab.js.map