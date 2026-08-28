import { OutputMode } from './definition/template-definition.schema';

/**
 * §8 — the renderer's own vocabulary and ceilings.
 *
 * Everything here is either a mapping between two vocabularies that already
 * exist elsewhere (a version's ENGINE, an assignment's OUTPUT MODE, a
 * renderer's OUTPUT MODE) or a ceiling that keeps one bad design from taking
 * the process down. Nothing here is a new concept: this module renders what
 * §3 and §4 already describe, and inventing a third vocabulary is how the two
 * halves start disagreeing.
 */

/** A screen name the audit log groups this module's activity under. */
export const PRINT_RENDER_SCREEN_NAME = 'Print Render';

// ── Engines this renderer can actually draw ────────────────────────────────
// ptv_engine declares what ptv_body IS (§3). Three of its five members have no
// renderer here and are refused by name rather than half-rendered:
//
//   JSON_BANDS    the canvas's band/element definition          → GRAPHIC
//   ESCPOS_TEXT   the same definition in character cells        → GRID
//   HTML_CSS      would need a browser; deliberately not one
//   QTRPT_XML     3.0's format, kept so a migration can read it
//   RAW           bytes the server must not interpret at all
export const RENDERABLE_ENGINES = ['JSON_BANDS', 'ESCPOS_TEXT'] as const;
export type RenderableEngine = (typeof RENDERABLE_ENGINES)[number];

/**
 * Which layout the body is in, from the engine.
 *
 * The SAME rule the client's `canvasBridge.layoutModeFor` applies, and it has
 * to be: the canvas decides in millimetres or in character cells on the way in,
 * and a server that decided the other way would lay out a design nobody drew.
 */
export const LAYOUT_MODE_FOR_ENGINE: Readonly<Record<RenderableEngine, 'GRAPHIC' | 'GRID'>> = {
  JSON_BANDS: 'GRAPHIC',
  ESCPOS_TEXT: 'GRID',
};

// ── The assignment's output mode → a renderer ──────────────────────────────
// §5's vocabulary (PRINT | PREVIEW | PDF | EMAIL | WHATSAPP | ESCPOS) answers
// "where does this go", not "what bytes are these". PRINT is the only member
// that cannot answer on its own — printing to a thermal roll and printing to a
// laser tray are the same intent and different bytes — so it defers to the
// layout mode, and every carrier mode (mail, chat, a file) means PDF because
// that is the only member of the three that survives being attached to
// something.
export const RENDERER_FOR_OUTPUT_MODE: Readonly<Record<string, OutputMode | 'BY_LAYOUT'>> = {
  PRINT: 'BY_LAYOUT',
  PREVIEW: 'PDF',
  PDF: 'PDF',
  EMAIL: 'PDF',
  WHATSAPP: 'PDF',
  ESCPOS: 'ESCPOS',
};

/** What a GRAPHIC and a GRID design render to when nothing else decides. */
export const RENDERER_FOR_LAYOUT_MODE: Readonly<Record<'GRAPHIC' | 'GRID', OutputMode>> = {
  GRAPHIC: 'PDF',
  GRID: 'ESCPOS',
};

/**
 * Which renderers can draw which layout.
 *
 * A GRID design in a PDF is not a degraded render, it is a wrong one: its
 * coordinates are character cells, and the PDF renderer reads millimetres. The
 * two are refused against each other rather than reinterpreted.
 */
export const LAYOUT_MODE_FOR_RENDERER: Readonly<Record<OutputMode, 'GRAPHIC' | 'GRID'>> = {
  PDF: 'GRAPHIC',
  HTML: 'GRAPHIC',
  ESCPOS: 'GRID',
  ESCP_DOTMATRIX: 'GRID',
};

/** Renderers this module has. HTML is in the schema's vocabulary and has none. */
export const IMPLEMENTED_RENDERERS: readonly OutputMode[] = ['PDF', 'ESCPOS', 'ESCP_DOTMATRIX'];

// ── The log's vocabulary (§7) ──────────────────────────────────────────────
export const PLG_OUTPUT_MODES = ['PRINT', 'PREVIEW', 'EMAIL', 'FILE', 'REPRINT'] as const;
export type PlgOutputMode = (typeof PLG_OUTPUT_MODES)[number];
export const PLG_STATUSES = ['SUCCESS', 'FAILED', 'QUEUED', 'CANCELLED'] as const;
export type PlgStatus = (typeof PLG_STATUSES)[number];

// ── Ceilings ───────────────────────────────────────────────────────────────

/**
 * Wall clock for one render, all copies included.
 *
 * A race rather than a cancel: neither PDFKit nor the layout engine is
 * interruptible, so a pathological design cannot be stopped mid-flight — but
 * the REQUEST can be released, which is what keeps a counter queue from
 * stalling behind one bad template.
 */
export const RENDER_TIMEOUT_MS = 30_000;

/** Per copy, so `copies` cannot multiply a slow design into a dead worker. */
export const RENDER_COPY_TIMEOUT_MS = 15_000;

/**
 * ppo_copy_count is a SMALLINT with no upper CHECK, and a mistyped assignment
 * that asks for 500 copies of a 40-page statement is a denial of service with
 * a purchase order attached.
 */
export const MAX_COPIES = 10;

/** The accounting-year shape ck_plg_acc_year_shape enforces. */
export const ACC_YEAR_PATTERN = /^[0-9]{4}-[0-9]{4}$/;
