"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLOW_EPSILON_MM = void 0;
exports.verticalSpan = verticalSpan;
exports.applyFlowLayout = applyFlowLayout;
exports.FLOW_EPSILON_MM = 0.01;
function verticalSpan(element) {
    switch (element.kind) {
        case 'LINE':
            return [Math.min(element.y1, element.y2), Math.max(element.y1, element.y2)];
        case 'QRCODE':
            return [element.y, element.y + element.size];
        default:
            return [element.y, element.y + (element.h ?? 0)];
    }
}
function moved(element, deltaMm) {
    if (element.kind === 'LINE') {
        return {
            ...element,
            y: element.y + deltaMm,
            y1: element.y1 + deltaMm,
            y2: element.y2 + deltaMm,
        };
    }
    return { ...element, y: element.y + deltaMm };
}
function applyFlowLayout(band, isVisible, crosstabHeightMm) {
    const placeable = band.elements.filter((element) => element.kind !== 'PAGEBREAK');
    const visible = new Set(placeable.filter((element) => isVisible(element)));
    const shifts = [];
    const tableHeights = new Map();
    for (const element of visible) {
        if (element.kind !== 'CROSSTAB') {
            continue;
        }
        const actualMm = crosstabHeightMm(element);
        tableHeights.set(element.id, actualMm);
        const deltaMm = actualMm - element.h;
        if (Math.abs(deltaMm) > exports.FLOW_EPSILON_MM) {
            shifts.push({ atMm: element.y + element.h, deltaMm });
        }
    }
    const blankSpans = placeable
        .filter((element) => element.removeLineWhenBlank && !visible.has(element))
        .map(verticalSpan)
        .filter(([top, bottom]) => bottom - top > exports.FLOW_EPSILON_MM)
        .sort((left, right) => left[0] - right[0]);
    const merged = [];
    for (const [top, bottom] of blankSpans) {
        const last = merged[merged.length - 1];
        if (last && top <= last[1] + exports.FLOW_EPSILON_MM) {
            last[1] = Math.max(last[1], bottom);
        }
        else {
            merged.push([top, bottom]);
        }
    }
    const occupiedSpans = [...visible].map(verticalSpan);
    for (const [start, end] of merged) {
        const occupied = occupiedSpans.some(([top, bottom]) => top < end - exports.FLOW_EPSILON_MM && bottom > start + exports.FLOW_EPSILON_MM);
        if (!occupied) {
            shifts.push({ atMm: end, deltaMm: -(end - start) });
        }
    }
    const elements = placeable
        .filter((element) => visible.has(element))
        .map((element) => {
        if (element.positionType !== 'FLOAT') {
            return element;
        }
        const [top] = verticalSpan(element);
        const deltaMm = shifts
            .filter((shift) => top >= shift.atMm - exports.FLOW_EPSILON_MM)
            .reduce((sum, shift) => sum + shift.deltaMm, 0);
        return deltaMm === 0 ? element : moved(element, deltaMm);
    });
    let heightMm = band.heightMm + shifts.reduce((sum, shift) => sum + shift.deltaMm, 0);
    for (const element of elements) {
        const tableMm = tableHeights.get(element.id);
        if (tableMm !== undefined) {
            heightMm = Math.max(heightMm, element.y + tableMm);
        }
    }
    return { elements, heightMm: Math.max(0, heightMm), shifts };
}
//# sourceMappingURL=flow-layout.js.map