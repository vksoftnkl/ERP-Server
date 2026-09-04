import { z } from 'zod';

/**
 * The template definition contract — schemaVersion 1.
 *
 * This file is the single source of truth for what a report design may contain.
 * The designer UI, the layout engine and every renderer are all downstream of
 * it, so a change here is a schema migration (see TemplateMigrationService),
 * never an edit in place.
 *
 * Two rules the shape encodes:
 *
 *   * All GRAPHIC coordinates are millimetres (float). Renderers convert at
 *     draw time -- PDF points are mm * 2.83465, screen pixels at 96 DPI are
 *     mm * 3.779528. Nothing upstream of a renderer ever sees a point or pixel.
 *   * All GRID coordinates are integer character cells (row/col). GRID is not a
 *     degraded GRAPHIC mode; a dot-matrix printer in draft mode has no concept
 *     of a millimetre, and pretending otherwise is what makes competitors slow.
 *
 * Expressions are `{{ ... }}` templates evaluated by the jexl sandbox. They are
 * validated for parseability and identifier whitelist at SAVE time
 * (ExpressionValidator), so a bad expression fails in the designer rather than
 * at the customer's printer.
 */

export const SCHEMA_VERSION = 1;

// ─── Vocabularies ────────────────────────────────────────────────────────────
// Deliberately not CHECK constraints in the database: these grow with every new
// report, and a migration per new paper size is not a trade worth making.

export const LAYOUT_MODES = ['GRAPHIC', 'GRID'] as const;
export const OUTPUT_MODES = ['PDF', 'ESCPOS', 'ESCP_DOTMATRIX', 'HTML'] as const;
export const ORIENTATIONS = ['PORTRAIT', 'LANDSCAPE'] as const;

export const BAND_TYPES = [
  'REPORT_HEADER',
  'PAGE_HEADER',
  'GROUP_HEADER',
  'DETAIL',
  'GROUP_FOOTER',
  'SUMMARY',
  'PAGE_FOOTER',
  'REPORT_FOOTER',
  'NO_DATA',
] as const;

export const ELEMENT_KINDS = [
  'TEXT',
  'FIELD',
  'LINE',
  'RECT',
  'IMAGE',
  'BARCODE',
  'QRCODE',
  'PAGEBREAK',
  'CROSSTAB',
] as const;

export const PRINT_ON = [
  'ALL_PAGES',
  'FIRST_PAGE',
  'LAST_PAGE',
  'NOT_FIRST_PAGE',
  'NOT_LAST_PAGE',
] as const;
export const H_ALIGN = ['left', 'center', 'right'] as const;
export const V_ALIGN = ['top', 'middle', 'bottom'] as const;
export const IMAGE_FIT = ['CONTAIN', 'COVER', 'STRETCH'] as const;
export const CARDINALITY = ['one', 'many'] as const;
export const AGGREGATE_FUNCTIONS = ['sum', 'count', 'avg', 'min', 'max'] as const;
export const AGGREGATE_SCOPES = ['GROUP', 'PAGE', 'REPORT'] as const;
export const BARCODE_SYMBOLOGIES = ['code128', 'ean13', 'ean8', 'upca', 'code39', 'itf14'] as const;

/** Symbologies bwip-js knows and we have committed to supporting. */
export type BarcodeSymbology = (typeof BARCODE_SYMBOLOGIES)[number];

/**
 * How a crosstab orders its row and column dimensions.
 *
 * FIRST_SEEN is not a lazy default -- it is the only ordering that preserves a
 * dataset's own ORDER BY, which is how a 'by month' crosstab gets April before
 * August without the labels having to sort that way.
 */
export const CROSSTAB_SORTS = [
  'LABEL_ASC',
  'LABEL_DESC',
  'VALUE_DESC',
  'VALUE_ASC',
  'FIRST_SEEN',
] as const;

/**
 * What happens to the columns past the cap.
 *
 * FOLD accumulates them into one trailing column, so the row totals and the
 * grand total still add up to the same figure the dataset carries. CLIP drops
 * them, and the totals then describe only what is printed. Both are defensible;
 * silently doing one while the operator assumes the other is not, which is why
 * this is a stored property rather than an engine convention.
 */
export const CROSSTAB_OVERFLOWS = ['FOLD', 'CLIP'] as const;

/**
 * The bands a CROSSTAB may sit in: the ones that appear at most once.
 *
 * See the placement check in the definition's superRefine for why every other
 * band is refused.
 */
export const CROSSTAB_BANDS: readonly string[] = [
  'REPORT_HEADER',
  'SUMMARY',
  'REPORT_FOOTER',
  'NO_DATA',
];

// ─── Primitive field schemas ─────────────────────────────────────────────────

/** A millimetre coordinate. Bounded well past any real paper to catch typos. */
const millimetres = z.number().finite().min(-10_000).max(10_000);
/** A non-negative millimetre extent. */
const millimetreSize = z.number().finite().min(0).max(10_000);
/** An integer character-cell coordinate for GRID mode. */
const cellIndex = z.number().int().min(0).max(2_000);

/**
 * An expression-bearing string. Plain text passes through; `{{ expr }}` spans
 * are evaluated. Capped to keep a pathological template from becoming a
 * denial-of-service on the expression compiler.
 */
const expressionString = z.string().max(4_000);

const hexColour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'colour must be #rrggbb')
  .or(
    expressionString.refine(
      (value) => value.includes('{{'),
      'colour must be #rrggbb or an expression',
    ),
  );

const identifier = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'must be a valid identifier');

// ─── Paper ───────────────────────────────────────────────────────────────────

export const marginsSchema = z.object({
  top: millimetreSize,
  right: millimetreSize,
  bottom: millimetreSize,
  left: millimetreSize,
});

export const paperSchema = z.object({
  /** A4 | A5 | T58 | T80 | DM80 | DM132 | ... free-form, resolved by code. */
  code: z.string().min(1).max(20),
  widthMm: millimetreSize.positive(),
  /**
   * Continuous stationery (thermal roll, dot-matrix fanfold cut by form length)
   * has no fixed page height. null means "grow until the content ends"; the
   * layout engine then paginates on explicit page breaks only.
   */
  heightMm: millimetreSize.positive().nullable().default(null),
  orientation: z.enum(ORIENTATIONS).default('PORTRAIT'),
  margins: marginsSchema,
  /** GRID mode only: printable character columns. */
  columns: z.number().int().min(1).max(2_000).optional(),
  /** GRID mode only: lines per page (form length). */
  rows: z.number().int().min(1).max(2_000).optional(),
});

// ─── Datasets ────────────────────────────────────────────────────────────────

export const datasetSchema = z.object({
  /** The name the template refers to it by, e.g. `items`. */
  name: identifier,
  /** A registered provider token, e.g. `sales.invoice.lines`. Never SQL. */
  provider: z.string().min(1).max(120),
  cardinality: z.enum(CARDINALITY),
  /** Static parameters handed to the provider alongside the request context. */
  params: z.record(z.string(), z.unknown()).optional(),
});

// ─── Element styling ─────────────────────────────────────────────────────────

export const fontSchema = z.object({
  /** A registry face name, not a system font path. */
  family: z.string().min(1).max(60).default('NotoSans'),
  /** Points. */
  size: z.number().min(1).max(200).default(9),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
});

export const styleSchema = z.object({
  /** Expression-capable, so a negative amount can print red. */
  color: hexColour.optional(),
  fill: hexColour.optional(),
  stroke: hexColour.optional(),
  strokeWidthPt: z.number().min(0).max(20).optional(),
  /** Padding inside the element box, millimetres. */
  padding: z.number().min(0).max(50).optional(),
});

// ─── Elements ────────────────────────────────────────────────────────────────

/**
 * Fields every element carries. `x`/`y` are relative to the band's top-left in
 * GRAPHIC mode, and are `col`/`row` character cells in GRID mode.
 */
const elementBase = z.object({
  id: z.string().min(1).max(60),
  x: millimetres.default(0),
  y: millimetres.default(0),
  w: millimetreSize.optional(),
  h: millimetreSize.optional(),
  /** GRID mode: character cell position and width. */
  col: cellIndex.optional(),
  row: cellIndex.optional(),
  cols: z.number().int().min(1).max(2_000).optional(),
  /** Expression; the element is skipped when it evaluates falsy. */
  visible: expressionString.optional(),
  style: styleSchema.optional(),
  /** Draw order within the band; higher paints later. */
  z: z.number().int().min(0).max(1_000).default(0),
});

const textLikeElement = elementBase.extend({
  value: expressionString,
  font: fontSchema.partial().optional(),
  align: z.enum(H_ALIGN).default('left'),
  vAlign: z.enum(V_ALIGN).default('top'),
  wrap: z.boolean().default(false),
  /** Truncate with an ellipsis instead of overflowing. Ignored when wrap. */
  ellipsis: z.boolean().default(false),
  /** Blank the element when the value evaluates to zero — common on ERP grids. */
  blankWhenZero: z.boolean().default(false),
});

export const textElementSchema = textLikeElement.extend({ kind: z.literal('TEXT') });

/**
 * FIELD and TEXT differ only in intent: FIELD came from the dataset tree, TEXT
 * was typed. The engine treats them identically, and keeping both lets the
 * designer show the right icon without a separate flag.
 */
export const fieldElementSchema = textLikeElement.extend({
  kind: z.literal('FIELD'),
  aggregate: z
    .object({
      fn: z.enum(AGGREGATE_FUNCTIONS),
      scope: z.enum(AGGREGATE_SCOPES),
      /** Dataset the rows come from; defaults to the band's dataset. */
      dataset: identifier.optional(),
      /**
       * The RAW numeric expression to accumulate, e.g. `{{ row.pendingAmount }}`.
       *
       * Defaults to `value`, which is the convenient case: the element already
       * names the field it totals. Set it explicitly whenever `value` applies a
       * format the number cannot survive a round trip through -- an accounting
       * '(1,234.00)', a currency symbol, `numToWords`. `value` then stays purely
       * a display format and is applied to the total.
       */
      over: expressionString.optional(),
    })
    .optional(),
});

export const lineElementSchema = elementBase.extend({
  kind: z.literal('LINE'),
  x1: millimetres,
  y1: millimetres,
  x2: millimetres,
  y2: millimetres,
  widthPt: z.number().min(0).max(20).default(0.5),
  /** GRID mode: the character to repeat, e.g. '-' or '='. */
  gridChar: z.string().length(1).default('-'),
});

export const rectElementSchema = elementBase.extend({
  kind: z.literal('RECT'),
  w: millimetreSize,
  h: millimetreSize,
  radiusMm: z.number().min(0).max(50).default(0),
});

export const imageElementSchema = elementBase.extend({
  kind: z.literal('IMAGE'),
  w: millimetreSize,
  h: millimetreSize,
  /** Expression yielding a URL, a data: URI, or a registered asset key. */
  source: expressionString,
  fit: z.enum(IMAGE_FIT).default('CONTAIN'),
});

export const barcodeElementSchema = elementBase.extend({
  kind: z.literal('BARCODE'),
  w: millimetreSize,
  h: millimetreSize,
  symbology: z.enum(BARCODE_SYMBOLOGIES).default('code128'),
  value: expressionString,
  /** Print the human-readable digits under the bars. */
  showText: z.boolean().default(false),
});

export const qrcodeElementSchema = elementBase.extend({
  kind: z.literal('QRCODE'),
  /** QR is square; `size` wins over w/h. */
  size: millimetreSize.positive(),
  value: expressionString,
  /** L|M|Q|H. The e-invoice signed QR is large, so M is the practical default. */
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
});

export const pagebreakElementSchema = elementBase.extend({
  kind: z.literal('PAGEBREAK'),
  /** Expression; break only when it evaluates truthy. Defaults to always. */
  when: expressionString.optional(),
});

/**
 * A CROSSTAB -- one element that prints a whole pivot table.
 *
 * ── WHY IT IS AN ELEMENT AND NOT A BAND ────────────────────────────────────
 *
 * A band repeats once per row of a dataset the DESIGNER named at design time.
 * A crosstab's columns are not known until the data arrives: "sales by branch
 * per month" has as many columns as the rows happen to contain, and no
 * arrangement of bands can express a column count that the query decides. So
 * the crosstab owns its own dataset, does its own aggregation, and expands at
 * layout time into ordinary text, line and rect primitives. Every renderer
 * therefore prints one without knowing crosstabs exist.
 *
 * ── THE THREE EXPRESSIONS ──────────────────────────────────────────────────
 *
 *   rowBy     -> the label down the left edge   ({{ row.itemName }})
 *   columnBy  -> the label across the top       ({{ date(row.billDate, 'MMM') }})
 *   measure   -> the number in the cell         ({{ row.netAmount }})
 *
 * Each of the three is the FIRST of a list. `extraRowBys` adds further label
 * columns down the left edge, `extraColumnBys` adds further header rows across
 * the top, and `extraMeasures` splits every column group into one sub-column
 * per measure. All three default to empty, so a crosstab that names none of
 * them is exactly the one-row-one-column-one-measure pivot that shipped first,
 * and no stored `ptv_body` needs migrating.
 *
 * They are evaluated once per source row against the same `row` context a
 * DETAIL band would see, which is what lets `columnBy` be an expression rather
 * than a column name: a month bucket, a size band, a yes/no flag are all just
 * expressions over the row, and none of them exist as a field in the query.
 *
 * ── WIDTH IS A BUDGET, NOT A WISH ──────────────────────────────────────────
 *
 * `w` is the total width the table may occupy, and it is enforced. With
 * `columnWidthMm` at 0 the columns share whatever `w` leaves after the row
 * header and the totals column; with a fixed width, columns that would spill
 * past `w` are folded or clipped per `overflow`. A crosstab never draws outside
 * the box the designer drew, because the one thing worse than a missing column
 * is a column printed over the page margin.
 */
/**
 * One level of a crosstab's row or column axis.
 *
 * A crosstab used to have exactly one row dimension and one column dimension.
 * These are the SECOND and subsequent levels: `rowBy`/`columnBy` stay the first
 * level, so every template written before nesting existed still parses, and an
 * axis with no extra levels is byte-for-byte the crosstab that shipped.
 */
export const crosstabAxisSchema = z.object({
  /** Expression -> this level's label. */
  expression: expressionString,
  /**
   * Header caption for the column this level prints in.
   *
   * Row axes only: the first row column is captioned by `corner`, and a nested
   * COLUMN level has no fixed caption -- its header cells are the data's own
   * labels.
   */
  label: z.string().max(60).default(''),
  /** Row axes only. 0 = share whatever `rowHeaderWidthMm` leaves. */
  widthMm: millimetreSize.default(0),
});

/**
 * One value column of a crosstab.
 *
 * With a single measure the table is the classic pivot: one number per
 * (row, column). With several, every column group splits into one sub-column
 * per measure -- "Qty" and "Amount" under each month -- and each measure keeps
 * its OWN aggregate and number format, because a quantity summed as an integer
 * and a value averaged to two decimals cannot share either.
 */
export const crosstabMeasureSchema = z.object({
  /** Expression -> the number accumulated into the cell. */
  expression: expressionString,
  /** Sub-header caption. Printed only when the crosstab has >1 measure. */
  label: z.string().max(60).default(''),
  fn: z.enum(AGGREGATE_FUNCTIONS).default('sum'),
  format: z.string().max(60).default('#,##0.00'),
  blankWhenZero: z.boolean().default(true),
});

export const crosstabElementSchema = elementBase.extend({
  kind: z.literal('CROSSTAB'),
  /** The total width the table may occupy. Enforced, not advisory. */
  w: millimetreSize.positive(),
  /**
   * A MINIMUM height. The real height is header + one line per row group, and
   * the layout engine grows the band to it -- which is why a crosstab in a band
   * with autoGrow off still gets the space it needs.
   */
  h: millimetreSize.default(0),
  /** The repeating dataset the pivot reads. Not the band's dataset. */
  dataset: identifier,
  /** Expression -> the FIRST row dimension label. */
  rowBy: expressionString,
  /** Expression -> the FIRST column dimension label. */
  columnBy: expressionString,
  /** Expression -> the number the FIRST measure accumulates into the cell. */
  measure: expressionString,
  fn: z.enum(AGGREGATE_FUNCTIONS).default('sum'),
  /** Number pattern for the first measure's cells and totals, e.g. '#,##0.00'. */
  format: z.string().max(60).default('#,##0.00'),
  /** Print an empty cell instead of a zero. An empty grid reads far faster. */
  blankWhenZero: z.boolean().default(true),
  /**
   * Sub-header caption for the first measure. Printed only when there is more
   * than one, which is why it is not `measure`'s own required field.
   */
  measureLabel: z.string().max(60).default(''),
  /**
   * Row dimensions AFTER `rowBy`, printed as further label columns down the
   * left edge and grouped left to right: HSN, then description within it.
   */
  extraRowBys: z.array(crosstabAxisSchema).max(6).default([]),
  /**
   * Column dimensions AFTER `columnBy`, printed as further HEADER ROWS: year
   * across the top, month underneath it, one leaf column per combination the
   * data actually contains.
   */
  extraColumnBys: z.array(crosstabAxisSchema).max(4).default([]),
  /** Value columns AFTER `measure`. Every column group repeats all of them. */
  extraMeasures: z.array(crosstabMeasureSchema).max(8).default([]),
  /** The top-left cell, above the row labels. Expression-capable. */
  corner: expressionString.default(''),
  rowHeaderWidthMm: millimetreSize.default(40),
  /** 0 = share the width left after the row header and totals column. */
  columnWidthMm: millimetreSize.default(0),
  headerHeightMm: millimetreSize.default(6),
  rowHeightMm: millimetreSize.positive().default(5),
  showRowTotals: z.boolean().default(true),
  showColumnTotals: z.boolean().default(true),
  totalsLabel: z.string().max(60).default('Total'),
  rowSort: z.enum(CROSSTAB_SORTS).default('LABEL_ASC'),
  columnSort: z.enum(CROSSTAB_SORTS).default('LABEL_ASC'),
  /** Hard ceiling on printed columns, before the width budget cuts further. */
  maxColumns: z.number().int().min(1).max(200).default(12),
  overflow: z.enum(CROSSTAB_OVERFLOWS).default('FOLD'),
  overflowLabel: z.string().max(60).default('Other'),
  font: fontSchema.partial().optional(),
  /** Falls back to `font` with bold on. */
  headerFont: fontSchema.partial().optional(),
  gridLines: z.boolean().default(true),
  headerFill: hexColour.optional(),
  /** Reprint the column header at the top of each page the table spills onto. */
  repeatHeader: z.boolean().default(true),
});

export const elementSchema = z.discriminatedUnion('kind', [
  textElementSchema,
  fieldElementSchema,
  lineElementSchema,
  rectElementSchema,
  imageElementSchema,
  barcodeElementSchema,
  qrcodeElementSchema,
  pagebreakElementSchema,
  crosstabElementSchema,
]);

// ─── Bands ───────────────────────────────────────────────────────────────────

export const bandSchema = z.object({
  type: z.enum(BAND_TYPES),
  /** Millimetres in GRAPHIC mode. */
  heightMm: millimetreSize.default(0),
  /** Character lines in GRID mode. */
  heightRows: z.number().int().min(0).max(500).optional(),
  /** Required on DETAIL, GROUP_HEADER and GROUP_FOOTER. */
  dataset: identifier.optional(),
  /** GROUP_HEADER / GROUP_FOOTER: the expression whose change ends the group. */
  groupBy: expressionString.optional(),
  /**
   * Nesting depth for grouped bands, 0 = outermost. v1 supports two levels;
   * deeper nesting is rejected at save time rather than silently flattened.
   */
  groupLevel: z.number().int().min(0).max(1).default(0),
  printOn: z.enum(PRINT_ON).default('ALL_PAGES'),
  /** Grow the band to fit wrapped text, then reflow what follows. */
  autoGrow: z.boolean().default(false),
  /** Never split this band across a page boundary. */
  keepTogether: z.boolean().default(false),
  /** Do not leave this band as the last thing on a page. */
  keepWithNext: z.boolean().default(false),
  /** SUMMARY: keep it on the same page as the final DETAIL row when it fits. */
  keepWithLastDetail: z.boolean().default(false),
  /** Suppress the whole band when this expression is falsy. */
  visible: expressionString.optional(),
  /** Blank lines to emit after the band. GRID mode readability. */
  spacingRows: z.number().int().min(0).max(20).default(0),
  elements: z.array(elementSchema).max(500).default([]),
});

// ─── The definition ──────────────────────────────────────────────────────────

export const templateDefinitionSchema = z
  .object({
    schemaVersion: z.number().int().min(1).max(SCHEMA_VERSION),
    layoutMode: z.enum(LAYOUT_MODES),
    /**
     * Free-form designer metadata: notes, grid snap, last zoom. The engine
     * ignores it entirely; it exists so the designer does not need a second
     * store for things that must travel with an exported template.
     */
    meta: z.record(z.string(), z.unknown()).optional(),
    paper: paperSchema,
    datasets: z.array(datasetSchema).max(20).default([]),
    bands: z.array(bandSchema).min(1).max(60),
  })
  .superRefine((definition, ctx) => {
    // ── Element ids are unique across the whole definition ──────────────
    // Not merely per band: the designer addresses elements by id for
    // selection, undo and alignment, and a duplicate would silently make one
    // of them unreachable.
    const seenElementIds = new Set<string>();
    for (const [bandIndex, band] of definition.bands.entries()) {
      for (const [elementIndex, element] of band.elements.entries()) {
        if (seenElementIds.has(element.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['bands', bandIndex, 'elements', elementIndex, 'id'],
            message: `duplicate element id '${element.id}'`,
          });
        }
        seenElementIds.add(element.id);
      }
    }

    // ── Dataset names are unique and every reference resolves ───────────
    const datasetNames = new Set<string>();
    for (const [index, dataset] of definition.datasets.entries()) {
      if (datasetNames.has(dataset.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['datasets', index, 'name'],
          message: `duplicate dataset name '${dataset.name}'`,
        });
      }
      datasetNames.add(dataset.name);
    }

    const rowBands = new Set(['DETAIL', 'GROUP_HEADER', 'GROUP_FOOTER']);

    for (const [bandIndex, band] of definition.bands.entries()) {
      if (band.dataset !== undefined && !datasetNames.has(band.dataset)) {
        ctx.addIssue({
          code: 'custom',
          path: ['bands', bandIndex, 'dataset'],
          message: `band references unknown dataset '${band.dataset}'`,
        });
      }

      // A row-repeating band with no dataset has nothing to repeat over, and
      // would silently render once. Reject rather than guess.
      if (rowBands.has(band.type) && band.dataset === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['bands', bandIndex, 'dataset'],
          message: `${band.type} requires a dataset`,
        });
      }

      if ((band.type === 'GROUP_HEADER' || band.type === 'GROUP_FOOTER') && !band.groupBy) {
        ctx.addIssue({
          code: 'custom',
          path: ['bands', bandIndex, 'groupBy'],
          message: `${band.type} requires groupBy`,
        });
      }

      for (const [elementIndex, element] of band.elements.entries()) {
        if (element.kind === 'FIELD' && element.aggregate?.dataset !== undefined) {
          if (!datasetNames.has(element.aggregate.dataset)) {
            ctx.addIssue({
              code: 'custom',
              path: ['bands', bandIndex, 'elements', elementIndex, 'aggregate', 'dataset'],
              message: `aggregate references unknown dataset '${element.aggregate.dataset}'`,
            });
          }
        }

        // A GROUP-scoped aggregate outside a grouped band has no group to
        // accumulate into.
        if (
          element.kind === 'FIELD' &&
          element.aggregate?.scope === 'GROUP' &&
          band.type !== 'GROUP_FOOTER' &&
          band.type !== 'GROUP_HEADER'
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['bands', bandIndex, 'elements', elementIndex, 'aggregate', 'scope'],
            message: 'GROUP-scoped aggregates are only valid inside a GROUP_HEADER or GROUP_FOOTER',
          });
        }
      }
    }

    // ── Cardinality: only a `many` dataset can drive a repeating band ────
    const cardinalityByName = new Map(
      definition.datasets.map((dataset) => [dataset.name, dataset.cardinality]),
    );
    for (const [bandIndex, band] of definition.bands.entries()) {
      if (band.dataset && cardinalityByName.get(band.dataset) === 'one') {
        ctx.addIssue({
          code: 'custom',
          path: ['bands', bandIndex, 'dataset'],
          message: `band repeats over '${band.dataset}', which the template declares as cardinality 'one'`,
        });
      }
    }

    // ── At most one of each singleton band ──────────────────────────────
    const singletonBands = [
      'REPORT_HEADER',
      'PAGE_HEADER',
      'PAGE_FOOTER',
      'SUMMARY',
      'REPORT_FOOTER',
      'NO_DATA',
    ];
    for (const bandType of singletonBands) {
      const occurrences = definition.bands.filter((band) => band.type === bandType);
      if (occurrences.length > 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['bands'],
          message: `${bandType} may appear at most once (found ${occurrences.length})`,
        });
      }
    }

    // ── Crosstab placement ──────────────────────────────────────────────
    // A crosstab reads its whole dataset and prints a whole table, so a band
    // that repeats would print the same table once per row. And in GRID mode
    // there is no width to share out -- the columns are character cells and a
    // dynamic column count has nowhere to go on a 48-column receipt. Both are
    // refused here rather than rendered into something nobody meant.
    for (const [bandIndex, band] of definition.bands.entries()) {
      for (const [elementIndex, element] of band.elements.entries()) {
        if (element.kind !== 'CROSSTAB') {
          continue;
        }
        if (!CROSSTAB_BANDS.includes(band.type)) {
          // Three separate reasons, one rule.
          //
          //   DETAIL and the GROUP bands REPEAT. A crosstab reads its whole
          //     named dataset with no group filter, so it would print the same
          //     complete table once per row, or once per group. (A crosstab
          //     scoped to its enclosing group is a real feature; it is not this
          //     one, and pretending otherwise prints a plausible wrong number.)
          //   PAGE_HEADER and PAGE_FOOTER are redrawn on every page, and are
          //     the one thing the engine clips by primitive COUNT when a band
          //     is suppressed on the last page -- a variable primitive count
          //     breaks that clip.
          //
          // What is left is the four bands that appear at most once in a
          // report, which is exactly where a summary table belongs.
          ctx.addIssue({
            code: 'custom',
            path: ['bands', bandIndex, 'elements', elementIndex],
            message: `a CROSSTAB cannot sit in a ${band.type} band; use one of ${CROSSTAB_BANDS.join(', ')}`,
          });
        }
        if (definition.layoutMode === 'GRID') {
          ctx.addIssue({
            code: 'custom',
            path: ['bands', bandIndex, 'elements', elementIndex],
            message: 'CROSSTAB is a GRAPHIC-mode element; GRID stationery cannot size its columns',
          });
        }
        if (!definition.datasets.some((dataset) => dataset.name === element.dataset)) {
          ctx.addIssue({
            code: 'custom',
            path: ['bands', bandIndex, 'elements', elementIndex, 'dataset'],
            message: `unknown dataset '${element.dataset}'`,
          });
        }
        if (element.rowHeaderWidthMm >= element.w) {
          ctx.addIssue({
            code: 'custom',
            path: ['bands', bandIndex, 'elements', elementIndex, 'rowHeaderWidthMm'],
            message: 'the row-label column leaves no width for the data columns',
          });
        }
        // An empty EXTRA level is not the same mistake as an empty `rowBy`.
        // `rowBy` empty gives one unnamed row group, which is visibly wrong on
        // the paper; an extra level that evaluates to nothing silently doubles
        // the row count with a blank column beside it, or -- on the column axis
        // -- multiplies the leaf columns by one nameless level. So the extras
        // are refused where the originals only warn.
        for (const [axisIndex, axis] of element.extraRowBys.entries()) {
          if (!axis.expression.trim()) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'bands',
                bandIndex,
                'elements',
                elementIndex,
                'extraRowBys',
                axisIndex,
                'expression',
              ],
              message: 'a row level needs an expression',
            });
          }
        }
        for (const [axisIndex, axis] of element.extraColumnBys.entries()) {
          if (!axis.expression.trim()) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'bands',
                bandIndex,
                'elements',
                elementIndex,
                'extraColumnBys',
                axisIndex,
                'expression',
              ],
              message: 'a column level needs an expression',
            });
          }
        }
        for (const [measureIndex, measure] of element.extraMeasures.entries()) {
          if (!measure.expression.trim()) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'bands',
                bandIndex,
                'elements',
                elementIndex,
                'extraMeasures',
                measureIndex,
                'expression',
              ],
              message: 'a measure needs an expression',
            });
          }
        }
      }
    }

    // ── Mode-specific geometry ──────────────────────────────────────────
    if (definition.layoutMode === 'GRID') {
      if (definition.paper.columns === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['paper', 'columns'],
          message: 'GRID layout requires paper.columns',
        });
      }

      for (const [bandIndex, band] of definition.bands.entries()) {
        for (const [elementIndex, element] of band.elements.entries()) {
          if (element.kind === 'LINE' || element.kind === 'PAGEBREAK') {
            continue;
          }
          if (element.col === undefined || element.row === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: ['bands', bandIndex, 'elements', elementIndex],
              message: 'GRID layout requires col and row on every element',
            });
          }
          if (
            definition.paper.columns !== undefined &&
            element.col !== undefined &&
            element.cols !== undefined &&
            element.col + element.cols > definition.paper.columns
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['bands', bandIndex, 'elements', elementIndex, 'cols'],
              message: `element runs past column ${definition.paper.columns}`,
            });
          }
        }
      }
    } else {
      // GRAPHIC: every element must sit inside the printable area. Catching
      // this at save time is the difference between a designer warning and a
      // clipped invoice at the customer's counter.
      const { paper } = definition;
      const printableWidth = paper.widthMm - paper.margins.left - paper.margins.right;
      if (printableWidth <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['paper', 'margins'],
          message: 'horizontal margins leave no printable width',
        });
      }

      for (const [bandIndex, band] of definition.bands.entries()) {
        for (const [elementIndex, element] of band.elements.entries()) {
          const right =
            element.kind === 'LINE'
              ? Math.max(element.x1, element.x2)
              : element.kind === 'QRCODE'
                ? element.x + element.size
                : element.x + (element.w ?? 0);

          if (right > paper.widthMm + 0.01) {
            ctx.addIssue({
              code: 'custom',
              path: ['bands', bandIndex, 'elements', elementIndex, 'x'],
              message: `element extends to ${right.toFixed(1)}mm, past the ${paper.widthMm}mm page width`,
            });
          }
        }
      }
    }
  });

export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;
export type TemplateDefinitionInput = z.input<typeof templateDefinitionSchema>;
export type Band = z.infer<typeof bandSchema>;
export type BandType = (typeof BAND_TYPES)[number];
export type ReportElement = z.infer<typeof elementSchema>;
export type ElementKind = (typeof ELEMENT_KINDS)[number];
export type PaperSpec = z.infer<typeof paperSchema>;
export type Margins = z.infer<typeof marginsSchema>;
export type DatasetBinding = z.infer<typeof datasetSchema>;
export type FontSpec = z.infer<typeof fontSchema>;
export type StyleSpec = z.infer<typeof styleSchema>;
export type LayoutMode = (typeof LAYOUT_MODES)[number];
export type OutputMode = (typeof OUTPUT_MODES)[number];
export type HorizontalAlign = (typeof H_ALIGN)[number];
export type VerticalAlign = (typeof V_ALIGN)[number];
export type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number];
export type AggregateScope = (typeof AGGREGATE_SCOPES)[number];
export type CrosstabSort = (typeof CROSSTAB_SORTS)[number];
export type CrosstabOverflow = (typeof CROSSTAB_OVERFLOWS)[number];
export type CrosstabAxis = z.infer<typeof crosstabAxisSchema>;
export type CrosstabMeasure = z.infer<typeof crosstabMeasureSchema>;
export type CrosstabElement = z.infer<typeof crosstabElementSchema>;

/** Text-bearing elements share one shape; the engine measures them together. */
export type TextLikeElement =
  | z.infer<typeof textElementSchema>
  | z.infer<typeof fieldElementSchema>;

export const isTextLike = (element: ReportElement): element is TextLikeElement =>
  element.kind === 'TEXT' || element.kind === 'FIELD';
