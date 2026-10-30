import {
  BarcodeSymbology,
  HorizontalAlign,
  LineStyle,
  PaperSpec,
  VerticalAlign,
} from '../../definition/template-definition.schema';

/**
 * The renderer-agnostic output of the layout pass.
 *
 * ONE LAYOUT PASS, MANY RENDERERS. Everything hard — pagination, grouping,
 * aggregates, auto-grow, expression evaluation, page numbering — happens once,
 * here. A renderer receives absolutely positioned primitives and only has to
 * know how to draw a rectangle, a line and a run of text in its own output
 * format. That is what makes a fourth output format a few hundred lines rather
 * than a reimplementation.
 *
 * Coordinates are MILLIMETRES from the top-left of the page in GRAPHIC mode,
 * and integer CHARACTER CELLS (col, row) in GRID mode. A primitive carries
 * whichever its tree declares; a renderer only ever sees the mode it handles.
 */

export interface FontSpecResolved {
  readonly family: string;
  readonly sizePt: number;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  /** Optional so the many primitives built before strikeout existed stay valid. */
  readonly strikeout?: boolean;
}

/** One styled stretch of a markup line. */
export interface RichRun {
  readonly text: string;
  readonly font: FontSpecResolved;
  readonly color: string;
  /** Superscript / subscript: a smaller face shifted off the baseline. */
  readonly shift?: 'sup' | 'sub';
}

export interface TextPrimitive {
  readonly k: 'text';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Already evaluated. Renderers never see an expression. */
  readonly text: string;
  readonly font: FontSpecResolved;
  readonly align: HorizontalAlign;
  readonly vAlign: VerticalAlign;
  readonly color: string;
  /** Pre-wrapped lines when the element wrapped; single entry otherwise. */
  readonly lines: readonly string[];
  readonly lineHeightMm: number;
  /**
   * Clockwise degrees about the box centre. At 90/270 the lines run along the
   * box's height and were wrapped to it. Absent = 0.
   */
  readonly rotation?: number;
  /** 0..1. Absent = opaque. Watermarks only. */
  readonly opacity?: number;
  /**
   * align 'justify': per line, whether to stretch it to the box width. The
   * last line of each paragraph stays ragged, as in any justified text.
   */
  readonly justify?: readonly boolean[];
  /**
   * Markup text: the same lines as `lines`, split into styled runs. A renderer
   * that cannot style text (GRID) prints `lines` and loses nothing but style.
   */
  readonly rich?: readonly (readonly RichRun[])[];
}

export interface LinePrimitive {
  readonly k: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly widthPt: number;
  readonly color: string;
  /** GRID mode: the character to repeat along the run. */
  readonly gridChar: string;
  /** Absent = SOLID. */
  readonly dash?: LineStyle;
}

export interface RectPrimitive {
  readonly k: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly strokeWidthPt: number;
  readonly radiusMm: number;
  /** Absent = SOLID. */
  readonly dash?: LineStyle;
}

/**
 * Any other outline: an ellipse, a triangle, an arrowhead, a pie slice, a
 * chart's polyline.
 *
 * `d` is an SVG path in PAGE MILLIMETRES using only absolute M, L, C and Z, so
 * a renderer converts it by scaling every number. x/y/w/h are its bounding box,
 * for overflow checks and continuous-paper height. GRID renderers skip it.
 */
export interface PathPrimitive {
  readonly k: 'path';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly d: string;
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly strokeWidthPt: number;
  /** Absent = SOLID. DOUBLE strokes once. */
  readonly dash?: LineStyle;
}

/**
 * Images carry a SOURCE, not bytes.
 *
 * A deliberate departure from the plan's `data: Buffer`. Resolving a logo means
 * a filesystem read or an HTTP fetch, and putting that inside the layout pass
 * would make layout asynchronous and I/O-bound for every renderer, including
 * the two that cannot draw an image at all. The renderer resolves and caches
 * instead — see ImageCache — so a dot-matrix render never fetches a logo it is
 * only going to discard.
 */
export interface ImagePrimitive {
  readonly k: 'image';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly src: string;
  readonly fit: 'CONTAIN' | 'COVER' | 'STRETCH';
  /** 0..1. Absent = opaque. Watermarks only. */
  readonly opacity?: number;
}

export interface BarcodePrimitive {
  readonly k: 'barcode';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly symbology: BarcodeSymbology;
  readonly value: string;
  readonly showText: boolean;
}

export interface QrCodePrimitive {
  readonly k: 'qrcode';
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly value: string;
  readonly errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export type Primitive =
  | TextPrimitive
  | LinePrimitive
  | RectPrimitive
  | PathPrimitive
  | ImagePrimitive
  | BarcodePrimitive
  | QrCodePrimitive;

export interface LayoutPage {
  /** 0-based. `page.number` in expressions is this plus one. */
  readonly index: number;
  readonly primitives: Primitive[];
}

export interface LayoutWarning {
  readonly kind:
    | 'expression'
    | 'overflow'
    | 'missing-dataset'
    | 'band-too-tall'
    | 'row-limit'
    | 'page-limit';
  readonly message: string;
  readonly detail?: string;
}

export interface LayoutTree {
  readonly pageCount: number;
  readonly paper: PaperSpec;
  readonly layoutMode: 'GRAPHIC' | 'GRID';
  readonly pages: readonly LayoutPage[];
  /**
   * Problems that did not stop the render. A template referencing a missing
   * field still prints; the operator needs to know it happened, and the log
   * needs it more than the customer does.
   */
  readonly warnings: readonly LayoutWarning[];
  readonly stats: {
    readonly detailRows: number;
    readonly bandsEmitted: number;
    readonly durationMs: number;
  };
}
