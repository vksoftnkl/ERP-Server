import { PathPrimitive } from './layout-tree.types';

/**
 * Outline geometry for the `path` primitive.
 *
 * Every path is written in PAGE MILLIMETRES with absolute M, L, C and Z only.
 * That restriction is the whole contract with the renderers: converting to
 * points is "multiply every number", and no renderer needs an SVG path parser
 * or an arc implementation. Curves are cubic Béziers -- four per full ellipse,
 * one per <= 90 degrees of a pie slice -- which is how PDF draws circles anyway.
 */

/** Control-point distance for a quarter-circle Bézier, as a fraction of the radius. */
const KAPPA = 0.5522847498;

/** Round to 0.001mm: far below any printer's resolution, and short to serialise. */
const n = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PathStyle {
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly strokeWidthPt: number;
  readonly dash?: PathPrimitive['dash'];
}

/** Bounding box of a point list. */
function boundsOf(points: readonly Point[]): { x: number; y: number; w: number; h: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function primitive(
  d: string,
  box: { x: number; y: number; w: number; h: number },
  style: PathStyle,
): PathPrimitive {
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

/** A closed polygon through `points`. */
export function polygonPath(points: readonly Point[], style: PathStyle): PathPrimitive {
  const [first, ...rest] = points;
  const d = [
    `M ${n(first.x)} ${n(first.y)}`,
    ...rest.map((point) => `L ${n(point.x)} ${n(point.y)}`),
    'Z',
  ].join(' ');
  return primitive(d, boundsOf(points), style);
}

/** An open polyline -- a chart series. */
export function polylinePath(points: readonly Point[], style: PathStyle): PathPrimitive {
  const [first, ...rest] = points;
  const d = [
    `M ${n(first.x)} ${n(first.y)}`,
    ...rest.map((point) => `L ${n(point.x)} ${n(point.y)}`),
  ].join(' ');
  return primitive(d, boundsOf(points), style);
}

/** The ellipse inscribed in a box. */
export function ellipsePath(
  x: number,
  y: number,
  w: number,
  h: number,
  style: PathStyle,
): PathPrimitive {
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

/** Apex at the top centre, base along the bottom edge. */
export function trianglePath(
  x: number,
  y: number,
  w: number,
  h: number,
  style: PathStyle,
): PathPrimitive {
  return polygonPath(
    [
      { x: x + w / 2, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    style,
  );
}

/** Corners at the midpoints of the box's sides. */
export function rhombusPath(
  x: number,
  y: number,
  w: number,
  h: number,
  style: PathStyle,
): PathPrimitive {
  return polygonPath(
    [
      { x: x + w / 2, y },
      { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h },
      { x, y: y + h / 2 },
    ],
    style,
  );
}

/**
 * A filled arrowhead whose TIP is at `tip`, pointing away from `from`.
 *
 * The head is a little wider than it is long (half-width 0.4 x length), the
 * proportion Qt's own arrow pens use, and never narrower than the line it caps.
 */
export function arrowHeadPath(
  from: Point,
  tip: Point,
  lengthMm: number,
  lineWidthMm: number,
  colour: string,
): PathPrimitive | null {
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
  return polygonPath(
    [
      tip,
      { x: baseX - uy * halfWidth, y: baseY + ux * halfWidth },
      { x: baseX + uy * halfWidth, y: baseY - ux * halfWidth },
    ],
    { fill: colour, stroke: null, strokeWidthPt: 0 },
  );
}

/** Point on a circle; angle in radians, 0 = 12 o'clock, clockwise. */
const polar = (cx: number, cy: number, r: number, angle: number): Point => ({
  x: cx + r * Math.sin(angle),
  y: cy - r * Math.cos(angle),
});

/** Bézier segments approximating a circular arc, each spanning <= 90 degrees. */
function arcSegments(cx: number, cy: number, r: number, start: number, end: number): string[] {
  const segments: string[] = [];
  const total = end - start;
  const count = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI / 2) - 1e-9));
  const step = total / count;
  const k = (4 / 3) * Math.tan(step / 4);
  for (let index = 0; index < count; index += 1) {
    const a0 = start + index * step;
    const a1 = a0 + step;
    const p0 = polar(cx, cy, r, a0);
    const p3 = polar(cx, cy, r, a1);
    // Tangents of a clockwise-from-12 parameterisation: d/da (sin a, -cos a).
    const c1 = { x: p0.x + k * r * Math.cos(a0), y: p0.y + k * r * Math.sin(a0) };
    const c2 = { x: p3.x - k * r * Math.cos(a1), y: p3.y - k * r * Math.sin(a1) };
    segments.push(`C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p3.x)} ${n(p3.y)}`);
  }
  return segments;
}

/**
 * A pie slice, or a ring slice when `innerRadius` > 0. Angles in radians from
 * 12 o'clock, clockwise. A full turn draws a whole disc (or ring).
 */
export function slicePath(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  start: number,
  end: number,
  style: PathStyle,
): PathPrimitive {
  const box = { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
  const full = end - start >= Math.PI * 2 - 1e-6;
  const outerStart = polar(cx, cy, radius, start);
  const parts: string[] = [
    `M ${n(outerStart.x)} ${n(outerStart.y)}`,
    ...arcSegments(cx, cy, radius, start, end),
  ];

  if (innerRadius > 0) {
    const innerEnd = polar(cx, cy, innerRadius, end);
    if (full) {
      // Two closed circles; the renderer fills with the even-odd rule.
      parts.push('Z', `M ${n(innerEnd.x)} ${n(innerEnd.y)}`);
    } else {
      parts.push(`L ${n(innerEnd.x)} ${n(innerEnd.y)}`);
    }
    parts.push(...arcSegments(cx, cy, innerRadius, end, start), 'Z');
  } else {
    if (!full) {
      parts.push(`L ${n(cx)} ${n(cy)}`);
    }
    parts.push('Z');
  }

  return primitive(parts.join(' '), box, style);
}
