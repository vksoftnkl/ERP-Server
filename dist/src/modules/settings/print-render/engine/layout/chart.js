"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHART_PALETTE = void 0;
exports.aggregateChart = aggregateChart;
exports.niceStep = niceStep;
exports.buildChart = buildChart;
const format_1 = require("../expression/transforms/format");
const shapes_1 = require("./shapes");
exports.CHART_PALETTE = [
    '#4e79a7',
    '#f28e2b',
    '#e15759',
    '#76b7b2',
    '#59a14f',
    '#edc948',
    '#b07aa1',
    '#ff9da7',
    '#9c755f',
    '#bab0ac',
];
const PADDING_MM = 1.5;
const GRID_COLOUR = '#d0d0d0';
const AXIS_COLOUR = '#404040';
const toNumber = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const cleaned = value.replace(/,/g, '').trim();
        if (!cleaned) {
            return null;
        }
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
function aggregateChart(element, rows, env) {
    const order = [];
    const byCategory = new Map();
    rows.forEach((row, index) => {
        const context = env.rowContext(row, index, rows.length);
        const label = env.evaluateText(element.category, context);
        let accumulators = byCategory.get(label);
        if (!accumulators) {
            accumulators = element.series.map(() => ({
                sum: 0,
                count: 0,
                rows: 0,
                min: Number.POSITIVE_INFINITY,
                max: Number.NEGATIVE_INFINITY,
            }));
            byCategory.set(label, accumulators);
            order.push(label);
        }
        element.series.forEach((series, seriesIndex) => {
            const accumulator = accumulators[seriesIndex];
            accumulator.rows += 1;
            const value = toNumber(env.evaluate(series.value, context));
            if (value === null) {
                return;
            }
            accumulator.sum += value;
            accumulator.count += 1;
            accumulator.min = Math.min(accumulator.min, value);
            accumulator.max = Math.max(accumulator.max, value);
        });
    });
    const categories = order.slice(0, element.maxCategories);
    const values = element.series.map((_series, seriesIndex) => categories.map((category) => {
        const accumulator = byCategory.get(category)?.[seriesIndex];
        if (!accumulator) {
            return null;
        }
        switch (element.fn) {
            case 'count':
                return accumulator.rows;
            case 'avg':
                return accumulator.count > 0 ? accumulator.sum / accumulator.count : null;
            case 'min':
                return accumulator.count > 0 ? accumulator.min : null;
            case 'max':
                return accumulator.count > 0 ? accumulator.max : null;
            case 'sum':
            default:
                return accumulator.count > 0 ? accumulator.sum : null;
        }
    }));
    return { categories, values, droppedCategories: Math.max(0, order.length - categories.length) };
}
function niceStep(span, target = 4) {
    if (!(span > 0)) {
        return 1;
    }
    const raw = span / target;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / magnitude;
    const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return nice * magnitude;
}
const resolvedFont = (font, fallbackSize, fallbackBold) => ({
    family: font?.family ?? 'NotoSans',
    sizePt: font?.size ?? fallbackSize,
    bold: font?.bold ?? fallbackBold,
    italic: font?.italic ?? false,
    underline: font?.underline ?? false,
    strikeout: font?.strikeout ?? false,
});
const measured = (font) => ({
    family: font.family,
    sizePt: font.sizePt,
    bold: font.bold,
    italic: font.italic,
});
function buildChart(element, rows, context, xMm, yMm, env) {
    const primitives = [];
    const warnings = [];
    const { measurer } = env;
    const axisFont = resolvedFont(element.font, 7, false);
    const titleFont = resolvedFont(element.titleFont, 10, true);
    const legendFont = resolvedFont(element.legendFont, 7, false);
    const titleColour = env.resolveColour(element.titleColor, context, '#000000');
    const legendColour = env.resolveColour(element.legendColor, context, '#000000');
    const textColour = '#202020';
    const text = (value, x, y, w, font, align, color) => {
        if (!value || w <= 0) {
            return;
        }
        const lineHeightMm = measurer.lineHeightMm(measured(font));
        const fitted = measurer.truncateToWidth(value, w, measured(font));
        if (!fitted) {
            return;
        }
        primitives.push({
            k: 'text',
            x,
            y,
            w,
            h: lineHeightMm,
            text: fitted,
            font,
            align,
            vAlign: 'top',
            color,
            lines: [fitted],
            lineHeightMm,
        });
    };
    const rect = (x, y, w, h, fill, stroke = null, strokeWidthPt = 0) => {
        if (w <= 0 || h <= 0) {
            return;
        }
        const primitive = {
            k: 'rect',
            x,
            y,
            w,
            h,
            fill,
            stroke,
            strokeWidthPt,
            radiusMm: 0,
        };
        primitives.push(primitive);
    };
    const line = (x1, y1, x2, y2, color, widthPt) => {
        const primitive = { k: 'line', x1, y1, x2, y2, widthPt, color, gridChar: '-' };
        primitives.push(primitive);
    };
    if (element.background) {
        rect(xMm, yMm, element.w, element.h, env.resolveColour(element.background, context, '#ffffff'));
    }
    let top = yMm + PADDING_MM;
    let bottom = yMm + element.h - PADDING_MM;
    let left = xMm + PADDING_MM;
    let right = xMm + element.w - PADDING_MM;
    const title = element.title ? env.evaluateText(element.title, context) : '';
    if (title) {
        const titleHeight = measurer.lineHeightMm(measured(titleFont));
        text(title, left, top, right - left, titleFont, 'center', titleColour);
        top += titleHeight + 1;
    }
    const data = aggregateChart(element, rows, env);
    if (data.droppedCategories > 0) {
        warnings.push(`Chart '${element.id}' dropped ${data.droppedCategories} categor${data.droppedCategories === 1 ? 'y' : 'ies'} past maxCategories=${element.maxCategories}`);
    }
    const isPie = element.chartType === 'PIE';
    const seriesColour = (index) => env.resolveColour(element.series[index]?.color, context, exports.CHART_PALETTE[index % exports.CHART_PALETTE.length]);
    const sliceColour = (index) => exports.CHART_PALETTE[index % exports.CHART_PALETTE.length];
    if (element.showLegend) {
        const entries = isPie
            ? data.categories.map((label, index) => ({ label: label || '—', colour: sliceColour(index) }))
            : element.series.map((series, index) => ({
                label: series.name || `Series ${index + 1}`,
                colour: seriesColour(index),
            }));
        const lineHeight = measurer.lineHeightMm(measured(legendFont));
        const swatch = Math.max(1.5, lineHeight * 0.6);
        const entryWidth = (label) => swatch + 1 + measurer.measureWidthMm(label, measured(legendFont)) + 3;
        const drawEntry = (entry, x, y, maxWidth) => {
            rect(x, y + (lineHeight - swatch) / 2, swatch, swatch, entry.colour);
            text(entry.label, x + swatch + 1, y, maxWidth - swatch - 1, legendFont, 'left', legendColour);
        };
        if (entries.length > 0 &&
            (element.legendPosition === 'BOTTOM' || element.legendPosition === 'TOP')) {
            const rowsOfEntries = [[]];
            let rowWidth = 0;
            for (const entry of entries) {
                const width = Math.min(entryWidth(entry.label), right - left);
                if (rowWidth + width > right - left && rowsOfEntries[rowsOfEntries.length - 1].length > 0) {
                    rowsOfEntries.push([]);
                    rowWidth = 0;
                }
                rowsOfEntries[rowsOfEntries.length - 1].push({ ...entry, width });
                rowWidth += width;
            }
            const legendHeight = rowsOfEntries.length * lineHeight;
            let y = element.legendPosition === 'BOTTOM' ? bottom - legendHeight : top;
            for (const row of rowsOfEntries) {
                const total = row.reduce((sum, entry) => sum + entry.width, 0);
                let x = left + Math.max(0, (right - left - total) / 2);
                for (const entry of row) {
                    drawEntry(entry, x, y, entry.width);
                    x += entry.width;
                }
                y += lineHeight;
            }
            if (element.legendPosition === 'BOTTOM') {
                bottom -= legendHeight + 1;
            }
            else {
                top += legendHeight + 1;
            }
        }
        else if (entries.length > 0) {
            const legendWidth = Math.min(Math.max(...entries.map((entry) => entryWidth(entry.label))), (right - left) * 0.4);
            const legendHeight = entries.length * lineHeight;
            let y = top + Math.max(0, (bottom - top - legendHeight) / 2);
            const x = element.legendPosition === 'LEFT' ? left : right - legendWidth;
            for (const entry of entries) {
                if (y + lineHeight > bottom + 0.01) {
                    break;
                }
                drawEntry(entry, x, y, legendWidth);
                y += lineHeight;
            }
            if (element.legendPosition === 'LEFT') {
                left += legendWidth + 1;
            }
            else {
                right -= legendWidth + 1;
            }
        }
    }
    const plotWidth = right - left;
    const plotHeight = bottom - top;
    if (plotWidth <= 2 || plotHeight <= 2) {
        warnings.push(`Chart '${element.id}' has no room left to plot; enlarge it or move the legend`);
        return { primitives, warnings };
    }
    const format = (value) => (0, format_1.formatNumber)(value, element.format);
    const axisLineHeight = measurer.lineHeightMm(measured(axisFont));
    if (isPie) {
        const values = (data.values[0] ?? []).map((value) => (value !== null && value > 0 ? value : 0));
        const total = values.reduce((sum, value) => sum + value, 0);
        const radius = Math.max(1, Math.min(plotWidth, plotHeight) / 2 - 0.5);
        const inner = radius * (element.holeSizePct / 100);
        const cx = left + plotWidth / 2;
        const cy = top + plotHeight / 2;
        if (total <= 0) {
            primitives.push((0, shapes_1.slicePath)(cx, cy, radius, inner, 0, Math.PI * 2, {
                fill: null,
                stroke: GRID_COLOUR,
                strokeWidthPt: 0.5,
            }));
            return { primitives, warnings };
        }
        let angle = 0;
        const labels = [];
        values.forEach((value, index) => {
            if (value <= 0) {
                return;
            }
            const sweep = (value / total) * Math.PI * 2;
            primitives.push((0, shapes_1.slicePath)(cx, cy, radius, inner, angle, angle + sweep, {
                fill: sliceColour(index),
                stroke: '#ffffff',
                strokeWidthPt: 0.5,
            }));
            if (element.showValues || element.showPercent) {
                const middle = angle + sweep / 2;
                const labelRadius = inner + (radius - inner) * (inner > 0 ? 0.5 : 0.62);
                labels.push({
                    text: element.showPercent ? `${((value / total) * 100).toFixed(1)}%` : format(value),
                    x: cx + labelRadius * Math.sin(middle),
                    y: cy - labelRadius * Math.cos(middle),
                });
            }
            angle += sweep;
        });
        for (const label of labels) {
            const width = measurer.measureWidthMm(label.text, measured(axisFont)) + 1;
            text(label.text, label.x - width / 2, label.y - axisLineHeight / 2, width, axisFont, 'center', '#ffffff');
        }
        return { primitives, warnings };
    }
    const stacked = element.chartType === 'STACKED_BAR';
    let minValue = 0;
    let maxValue = 0;
    data.categories.forEach((_category, categoryIndex) => {
        if (stacked) {
            let positive = 0;
            let negative = 0;
            for (const series of data.values) {
                const value = series[categoryIndex] ?? 0;
                if (value >= 0) {
                    positive += value;
                }
                else {
                    negative += value;
                }
            }
            maxValue = Math.max(maxValue, positive);
            minValue = Math.min(minValue, negative);
        }
        else {
            for (const series of data.values) {
                const value = series[categoryIndex];
                if (value !== null && value !== undefined) {
                    maxValue = Math.max(maxValue, value);
                    minValue = Math.min(minValue, value);
                }
            }
        }
    });
    if (maxValue === minValue) {
        maxValue = minValue + 1;
    }
    const step = niceStep(maxValue - minValue);
    const axisMin = Math.floor(minValue / step - 1e-9) * step;
    const axisMax = Math.ceil(maxValue / step - 1e-9) * step;
    const ticks = [];
    for (let tick = axisMin; tick <= axisMax + step / 2; tick += step) {
        ticks.push(Math.abs(tick) < step / 1e6 ? 0 : tick);
    }
    const tickLabelWidth = Math.max(...ticks.map((tick) => measurer.measureWidthMm(format(tick), measured(axisFont)))) + 1;
    const plotLeft = left + tickLabelWidth;
    const plotBottom = bottom - axisLineHeight - 0.5;
    const plotTop = top + axisLineHeight / 2;
    const innerWidth = right - plotLeft;
    const innerHeight = plotBottom - plotTop;
    if (innerWidth <= 2 || innerHeight <= 2) {
        warnings.push(`Chart '${element.id}' has no room left to plot; enlarge it or move the legend`);
        return { primitives, warnings };
    }
    const yOf = (value) => plotBottom - ((value - axisMin) / (axisMax - axisMin)) * innerHeight;
    for (const tick of ticks) {
        const y = yOf(tick);
        if (element.showGrid && tick !== 0) {
            line(plotLeft, y, right, y, GRID_COLOUR, 0.3);
        }
        text(format(tick), left, y - axisLineHeight / 2, tickLabelWidth - 1, axisFont, 'right', textColour);
    }
    line(plotLeft, plotTop, plotLeft, plotBottom, AXIS_COLOUR, 0.5);
    const zeroY = yOf(Math.min(Math.max(0, axisMin), axisMax));
    const count = data.categories.length;
    if (count === 0) {
        line(plotLeft, zeroY, right, zeroY, AXIS_COLOUR, 0.5);
        return { primitives, warnings };
    }
    const slot = innerWidth / count;
    data.categories.forEach((category, index) => {
        text(category, plotLeft + index * slot, plotBottom + 0.5, slot, axisFont, 'center', textColour);
    });
    const valueLabels = [];
    const queueValueLabel = (value, centreX, edgeY, above) => {
        if (!element.showValues) {
            return;
        }
        const label = format(value);
        const width = measurer.measureWidthMm(label, measured(axisFont)) + 1;
        valueLabels.push({
            text: label,
            x: centreX - width / 2,
            y: above ? edgeY - axisLineHeight - 0.3 : edgeY + 0.3,
            width,
        });
    };
    if (element.chartType === 'BAR') {
        const seriesCount = data.values.length;
        const groupWidth = slot * 0.75;
        const barWidth = groupWidth / seriesCount;
        data.values.forEach((series, seriesIndex) => {
            series.forEach((value, categoryIndex) => {
                if (value === null) {
                    return;
                }
                const x = plotLeft + categoryIndex * slot + (slot - groupWidth) / 2 + seriesIndex * barWidth;
                const y = yOf(value);
                rect(x, Math.min(y, zeroY), barWidth * 0.92, Math.abs(zeroY - y), seriesColour(seriesIndex));
                queueValueLabel(value, x + (barWidth * 0.92) / 2, value >= 0 ? y : y, value >= 0);
            });
        });
    }
    else if (stacked) {
        const barWidth = slot * 0.6;
        data.categories.forEach((_category, categoryIndex) => {
            let positive = 0;
            let negative = 0;
            const x = plotLeft + categoryIndex * slot + (slot - barWidth) / 2;
            data.values.forEach((series, seriesIndex) => {
                const value = series[categoryIndex];
                if (value === null || value === undefined || value === 0) {
                    return;
                }
                const from = value >= 0 ? positive : negative;
                const to = from + value;
                if (value >= 0) {
                    positive = to;
                }
                else {
                    negative = to;
                }
                const y1 = yOf(from);
                const y2 = yOf(to);
                rect(x, Math.min(y1, y2), barWidth, Math.abs(y2 - y1), seriesColour(seriesIndex));
            });
            if (positive !== 0) {
                queueValueLabel(positive, x + barWidth / 2, yOf(positive), true);
            }
        });
    }
    else {
        data.values.forEach((series, seriesIndex) => {
            const colour = seriesColour(seriesIndex);
            const points = series
                .map((value, categoryIndex) => value === null
                ? null
                : { x: plotLeft + (categoryIndex + 0.5) * slot, y: yOf(value), value })
                .filter((point) => point !== null);
            if (points.length >= 2) {
                primitives.push((0, shapes_1.polylinePath)(points, { fill: null, stroke: colour, strokeWidthPt: 1 }));
            }
            const marker = 1.2;
            for (const point of points) {
                rect(point.x - marker / 2, point.y - marker / 2, marker, marker, colour);
                queueValueLabel(point.value, point.x, point.y - marker / 2, true);
            }
        });
    }
    line(plotLeft, zeroY, right, zeroY, AXIS_COLOUR, 0.5);
    for (const label of valueLabels) {
        text(label.text, label.x, label.y, label.width, axisFont, 'center', textColour);
    }
    return { primitives, warnings };
}
//# sourceMappingURL=chart.js.map