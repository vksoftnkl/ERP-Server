import { CrosstabElement, ReportElement } from '../../definition/template-definition.schema';

/**
 * Flow layout for one band: where its elements print once the data has had its
 * say, and how tall the band really is.
 *
 * A fixed band places every element at its design `y`, so a crosstab sized for
 * three rows leaves a gap when the document has none, and a hidden Discount line
 * leaves its 3.4mm behind. A band with `flowLayout` closes those up:
 *
 *   1. Every visible CROSSTAB records a shift at its design bottom of
 *      (height its rows need - design h). Growth and shrink alike.
 *   2. Every hidden `removeLineWhenBlank` element offers its vertical span.
 *      Overlapping and touching spans merge; a merged span that no VISIBLE
 *      element occupies records a shift of minus its height at its bottom.
 *   3. A FLOAT element moves by the sum of every shift at or above its top.
 *      FIX elements never move.
 *   4. The band's height is its declared height plus every shift.
 *
 * All of it is in design coordinates -- millimetres from the band's top --
 * and nothing is mutated: moved elements are copies. GRAPHIC mode only; the
 * caller decides that.
 */

/** Closer than this is the same coordinate: designer snap noise, not intent. */
export const FLOW_EPSILON_MM = 0.01;

export interface FlowShift {
  /** Design `y` the shift applies from: FLOAT elements whose top is at or below it move. */
  readonly atMm: number;
  readonly deltaMm: number;
}

export interface FlowLayout {
  /**
   * The band's VISIBLE elements in their original order, FLOAT ones moved.
   * Hidden elements and PAGEBREAK markers are absent -- the caller draws
   * this list as it stands.
   */
  readonly elements: readonly ReportElement[];
  /** Declared height plus every shift. Spacing rows are the caller's to add. */
  readonly heightMm: number;
  readonly shifts: readonly FlowShift[];
}

/**
 * An element's design vertical extent, [top, bottom].
 *
 * A LINE draws from y1/y2 alone (its `y` is not read by the engine), and a QR
 * code is `size` square whatever w/h say -- both are measured the way they
 * print, not the way the base fields suggest.
 */
export function verticalSpan(element: ReportElement): readonly [number, number] {
  switch (element.kind) {
    case 'LINE':
      return [Math.min(element.y1, element.y2), Math.max(element.y1, element.y2)];
    case 'QRCODE':
      return [element.y, element.y + element.size];
    default:
      return [element.y, element.y + (element.h ?? 0)];
  }
}

/** A copy of `element` moved down by `deltaMm` (up when negative). */
function moved(element: ReportElement, deltaMm: number): ReportElement {
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

export function applyFlowLayout(
  band: { readonly heightMm: number; readonly elements: readonly ReportElement[] },
  isVisible: (element: ReportElement) => boolean,
  crosstabHeightMm: (element: CrosstabElement) => number,
): FlowLayout {
  // A PAGEBREAK draws nothing and occupies nothing; it is a marker the engine
  // reads off the band itself.
  const placeable = band.elements.filter((element) => element.kind !== 'PAGEBREAK');
  const visible = new Set(placeable.filter((element) => isVisible(element)));

  const shifts: FlowShift[] = [];
  const tableHeights = new Map<string, number>();

  for (const element of visible) {
    if (element.kind !== 'CROSSTAB') {
      continue;
    }
    const actualMm = crosstabHeightMm(element);
    tableHeights.set(element.id, actualMm);
    const deltaMm = actualMm - element.h;
    if (Math.abs(deltaMm) > FLOW_EPSILON_MM) {
      shifts.push({ atMm: element.y + element.h, deltaMm });
    }
  }

  // A blank line only closes up when NOTHING visible stands in it. A label
  // beside a hidden value keeps the line; so does a box drawn around the
  // whole band -- the space is still in use.
  const blankSpans = placeable
    .filter((element) => element.removeLineWhenBlank && !visible.has(element))
    .map(verticalSpan)
    .filter(([top, bottom]) => bottom - top > FLOW_EPSILON_MM)
    .sort((left, right) => left[0] - right[0]);

  const merged: Array<[number, number]> = [];
  for (const [top, bottom] of blankSpans) {
    const last = merged[merged.length - 1];
    if (last && top <= last[1] + FLOW_EPSILON_MM) {
      last[1] = Math.max(last[1], bottom);
    } else {
      merged.push([top, bottom]);
    }
  }

  const occupiedSpans = [...visible].map(verticalSpan);
  for (const [start, end] of merged) {
    const occupied = occupiedSpans.some(
      ([top, bottom]) => top < end - FLOW_EPSILON_MM && bottom > start + FLOW_EPSILON_MM,
    );
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
        .filter((shift) => top >= shift.atMm - FLOW_EPSILON_MM)
        .reduce((sum, shift) => sum + shift.deltaMm, 0);
      return deltaMm === 0 ? element : moved(element, deltaMm);
    });

  // The band never ends above a table it prints. Only reachable when space
  // collapses above a FIX crosstab -- the table stays put while the band's
  // bottom rises into it.
  let heightMm = band.heightMm + shifts.reduce((sum, shift) => sum + shift.deltaMm, 0);
  for (const element of elements) {
    const tableMm = tableHeights.get(element.id);
    if (tableMm !== undefined) {
      heightMm = Math.max(heightMm, element.y + tableMm);
    }
  }

  return { elements, heightMm: Math.max(0, heightMm), shifts };
}
