"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.polygonPath = polygonPath;
exports.polylinePath = polylinePath;
exports.ellipsePath = ellipsePath;
exports.trianglePath = trianglePath;
exports.rhombusPath = rhombusPath;
exports.arrowHeadPath = arrowHeadPath;
exports.slicePath = slicePath;
const KAPPA = 0.5522847498;
const n = (value) => {
    const rounded = Math.round(value * 1000) / 1000;
    return Object.is(rounded, -0) ? '0' : String(rounded);
};
function boundsOf(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function primitive(d, box, style) {
    return {
        k: 'path',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        d,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidthPt: style.strokeWidthPt,
        ...(style.dash && style.dash !== 'SOLID' ? { dash: style.dash } : {}),
    };
}
function polygonPath(points, style) {
    const [first, ...rest] = points;
    const d = [
        `M ${n(first.x)} ${n(first.y)}`,
        ...rest.map((point) => `L ${n(point.x)} ${n(point.y)}`),
        'Z',
    ].join(' ');
    return primitive(d, boundsOf(points), style);
}
function polylinePath(points, style) {
    const [first, ...rest] = points;
    const d = [
        `M ${n(first.x)} ${n(first.y)}`,
        ...rest.map((point) => `L ${n(point.x)} ${n(point.y)}`),
    ].join(' ');
    return primitive(d, boundsOf(points), style);
}
function ellipsePath(x, y, w, h, style) {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    const ox = rx * KAPPA;
    const oy = ry * KAPPA;
    const d = [
        `M ${n(cx - rx)} ${n(cy)}`,
        `C ${n(cx - rx)} ${n(cy - oy)} ${n(cx - ox)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}`,
        `C ${n(cx + ox)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - oy)} ${n(cx + rx)} ${n(cy)}`,
        `C ${n(cx + rx)} ${n(cy + oy)} ${n(cx + ox)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}`,
        `C ${n(cx - ox)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + oy)} ${n(cx - rx)} ${n(cy)}`,
        'Z',
    ].join(' ');
    return primitive(d, { x, y, w, h }, style);
}
function trianglePath(x, y, w, h, style) {
    return polygonPath([
        { x: x + w / 2, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
    ], style);
}
function rhombusPath(x, y, w, h, style) {
    return polygonPath([
        { x: x + w / 2, y },
        { x: x + w, y: y + h / 2 },
        { x: x + w / 2, y: y + h },
        { x, y: y + h / 2 },
    ], style);
}
function arrowHeadPath(from, tip, lengthMm, lineWidthMm, colour) {
    const dx = tip.x - from.x;
    const dy = tip.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
        return null;
    }
    const ux = dx / length;
    const uy = dy / length;
    const headLength = Math.min(lengthMm, length);
    const halfWidth = Math.max(headLength * 0.4, lineWidthMm);
    const baseX = tip.x - ux * headLength;
    const baseY = tip.y - uy * headLength;
    return polygonPath([
        tip,
        { x: baseX - uy * halfWidth, y: baseY + ux * halfWidth },
        { x: baseX + uy * halfWidth, y: baseY - ux * halfWidth },
    ], { fill: colour, stroke: null, strokeWidthPt: 0 });
}
const polar = (cx, cy, r, angle) => ({
    x: cx + r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
});
function arcSegments(cx, cy, r, start, end) {
    const segments = [];
    const total = end - start;
    const count = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI / 2) - 1e-9));
    const step = total / count;
    const k = (4 / 3) * Math.tan(step / 4);
    for (let index = 0; index < count; index += 1) {
        const a0 = start + index * step;
        const a1 = a0 + step;
        const p0 = polar(cx, cy, r, a0);
        const p3 = polar(cx, cy, r, a1);
        const c1 = { x: p0.x + k * r * Math.cos(a0), y: p0.y + k * r * Math.sin(a0) };
        const c2 = { x: p3.x - k * r * Math.cos(a1), y: p3.y - k * r * Math.sin(a1) };
        segments.push(`C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p3.x)} ${n(p3.y)}`);
    }
    return segments;
}
function slicePath(cx, cy, radius, innerRadius, start, end, style) {
    const box = { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
    const full = end - start >= Math.PI * 2 - 1e-6;
    const outerStart = polar(cx, cy, radius, start);
    const parts = [
        `M ${n(outerStart.x)} ${n(outerStart.y)}`,
        ...arcSegments(cx, cy, radius, start, end),
    ];
    if (innerRadius > 0) {
        const innerEnd = polar(cx, cy, innerRadius, end);
        if (full) {
            parts.push('Z', `M ${n(innerEnd.x)} ${n(innerEnd.y)}`);
        }
        else {
            parts.push(`L ${n(innerEnd.x)} ${n(innerEnd.y)}`);
        }
        parts.push(...arcSegments(cx, cy, innerRadius, end, start), 'Z');
    }
    else {
        if (!full) {
            parts.push(`L ${n(cx)} ${n(cy)}`);
        }
        parts.push('Z');
    }
    return primitive(parts.join(' '), box, style);
}
//# sourceMappingURL=shapes.js.map