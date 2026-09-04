import { Injectable } from '@nestjs/common';
import {
  AggregateFunction,
  AggregateScope,
  Band,
  BandType,
  CrosstabElement,
  PaperSpec,
  ReportElement,
  TemplateDefinition,
  isTextLike,
} from '../../definition/template-definition.schema';
import { ExpressionEvaluator } from '../expression/expression.evaluator';
import { wrapText } from '../expression/transforms/text';
import {
  LayoutPage,
  LayoutTree,
  LayoutWarning,
  Primitive,
  TextPrimitive,
} from './layout-tree.types';
import {
  GROUP_PATH_SEPARATOR,
  PageAggregates,
  PrecomputedAggregates,
  buildGroupPath,
} from './aggregate.accumulator';
import { MeasuredFont, TextMeasurer } from './text-measure';
import {
  CrosstabPlan,
  buildCrosstabModel,
  crosstabIsComplete,
  emitCrosstab,
  planCrosstab,
  sliceCrosstab,
} from './crosstab';

/**
 * Phase 3b -- the layout engine.
 *
 * Turns a template definition plus resolved data into a LayoutTree: pages of
 * absolutely positioned primitives with every expression already evaluated.
 * No renderer is involved and none is imported. That separation is what the
 * whole feature rests on: pagination, grouping, aggregates and auto-grow are
 * solved once here rather than three times, once per output format.
 *
 * ── The passes ──────────────────────────────────────────────────────────────
 *
 *   0. PRE-PASS over the detail dataset, computing REPORT- and GROUP-scope
 *      aggregates and the group key of every row. This is what lets a
 *      GROUP_HEADER print its own group's total, which is a forward reference
 *      an accumulate-as-you-go engine cannot satisfy.
 *
 *   1. LAYOUT: walk the bands, break groups, break pages, emit primitives.
 *      PAGE-scope aggregates accumulate live here, because where a page ends
 *      is not knowable until it has ended.
 *
 *   2. PAGE NUMBERING: `page.total` is only known once pass 1 finishes.
 *      Rather than lay the whole report out twice, pass 1 records the few
 *      primitives whose text referenced `page` and pass 2 re-evaluates just
 *      those. On a 200-page report that is a few hundred re-evaluations
 *      instead of a second full layout.
 */

/** Hard ceilings. A runaway template must degrade, not exhaust the process. */
const MAX_PAGES = 2_000;
const MAX_DETAIL_ROWS = 100_000;

export interface RenderDatasets {
  /** Dataset name -> resolved rows (or the single row for cardinality 'one'). */
  readonly [name: string]: unknown;
}

export interface LayoutInput {
  readonly definition: TemplateDefinition;
  readonly datasets: RenderDatasets;
  /** Request context exposed to expressions as `ctx`. */
  readonly ctx: Record<string, unknown>;
  /** Render-time constants exposed as `sys`. Injected for deterministic tests. */
  readonly sys?: Record<string, unknown>;
}

/** A text primitive whose value depends on the page total, deferred to pass 2. */
interface DeferredText {
  readonly pageIndex: number;
  readonly primitiveIndex: number;
  readonly template: string;
  readonly context: Record<string, unknown>;
  readonly maxWidthMm: number;
  readonly wrap: boolean;
  readonly font: MeasuredFont;
}

/** One repeating section: a DETAIL band, its rows, and its group bands. */
interface DetailSection {
  readonly band: Band;
  readonly rows: readonly unknown[];
  /** Indexed by nesting level; [0] is the outermost group. */
  readonly groupHeaders: readonly Band[];
  readonly groupFooters: readonly Band[];
  /**
   * The groupBy expression per nesting level.
   *
   * Taken from the header band if there is one, otherwise from the footer.
   * A subtotal without a repeated group caption is a normal design — an aged
   * statement that wants a total per ageing band but no band heading — and
   * driving grouping from headers alone would silently emit no footers at all.
   */
  readonly groupBy: readonly (string | undefined)[];
  /** Group key path per row, filled by the pre-pass. */
  readonly rowGroupPaths: string[][];
}

interface OpenGroup {
  readonly level: number;
  readonly key: string;
  readonly path: string;
  rowCount: number;
}

@Injectable()
export class LayoutEngine {
  constructor(private readonly measurer: TextMeasurer) {}

  render(input: LayoutInput): LayoutTree {
    const startedAt = Date.now();
    return new LayoutRun(this.measurer, input).run(startedAt);
  }
}

/**
 * One render. A class rather than a closure so the many pieces of mutable
 * state -- cursor, current page, open groups, deferred primitives -- are named
 * and inspectable rather than captured in a chain of nested functions.
 */
class LayoutRun {
  private readonly definition: TemplateDefinition;

  private readonly paper: PaperSpec;

  private readonly evaluator = new ExpressionEvaluator();

  private readonly warnings: LayoutWarning[] = [];

  private readonly pages: LayoutPage[] = [];

  private readonly deferred: DeferredText[] = [];

  private readonly pageAggregates = new PageAggregates();

  private precomputed = new PrecomputedAggregates();

  private currentPage: LayoutPage | null = null;

  /** Vertical cursor within the printable body, millimetres from body top. */
  private cursorMm = 0;

  private openGroups: OpenGroup[] = [];

  private detailRowsEmitted = 0;

  private bandsEmitted = 0;

  private bodyHeightMm = 0;

  private pageHeaderHeightMm = 0;

  private pageFooterHeightMm = 0;

  /**
   * One plan per crosstab element, built on first sight.
   *
   * A crosstab is measured by `bandHeight` and then again when it draws, and a
   * table that re-aggregated its whole dataset each time would turn a page
   * break into a second pass over every row. The cache also guarantees the two
   * calls agree, which is what stops a band reserving one height and drawing
   * another.
   */
  private readonly crosstabPlans = new Map<string, CrosstabPlan>();

  private readonly bandsByType: Map<BandType, Band[]>;

  private readonly rootContext: Record<string, unknown>;

  constructor(
    private readonly measurer: TextMeasurer,
    input: LayoutInput,
  ) {
    this.definition = input.definition;
    this.paper = input.definition.paper;

    this.bandsByType = new Map();
    for (const band of input.definition.bands) {
      const bucket = this.bandsByType.get(band.type);
      if (bucket) {
        bucket.push(band);
      } else {
        this.bandsByType.set(band.type, [band]);
      }
    }

    this.rootContext = {
      ...input.datasets,
      ctx: input.ctx,
      sys: input.sys ?? { now: new Date().toISOString() },
      page: { number: 1, total: 1, isFirst: true, isLast: true },
      agg: {},
      group: { key: '', level: 0, count: 0 },
      row: {},
    };
  }

  run(startedAt: number): LayoutTree {
    this.computePageGeometry();

    const sections = this.collectDetailSections();
    this.prePass(sections);

    this.startPage();

    // Bands are emitted in DECLARATION ORDER, not in a fixed band-type order.
    // That is what lets one template carry two repeating sections -- the item
    // lines and then the HSN/rate tax summary, which Rule 46 requires on a GST
    // invoice. Two sequential DETAIL bands are not a subreport (nothing nests),
    // so this stays inside the v1 scope while removing the need for one.
    let noDataEmitted = false;

    for (const band of this.definition.bands) {
      switch (band.type) {
        // Page furniture is drawn by startPage/finishPage, and group bands are
        // driven by their owning detail section.
        case 'PAGE_HEADER':
        case 'PAGE_FOOTER':
        case 'GROUP_HEADER':
        case 'GROUP_FOOTER':
        case 'NO_DATA':
          break;

        case 'DETAIL': {
          const section = sections.find((candidate) => candidate.band === band);
          if (!section) {
            break;
          }
          if (section.rows.length > 0) {
            this.emitDetailSection(section);
          } else if (!noDataEmitted) {
            // A zero-line document still has to print: a cancelled invoice, or
            // a statement for a customer who owes nothing. Falling through
            // silently would produce a header and a total with a void between.
            noDataEmitted = this.emitBandIfPresent('NO_DATA');
          }
          break;
        }

        default:
          this.emitBand(band, this.rootContext);
          break;
      }
    }

    this.finishPage();
    this.resolveDeferredText();

    // A single-band template that emitted nothing still owes the caller a page,
    // or every renderer downstream has to special-case an empty tree.
    if (this.pages.length === 0) {
      this.pages.push({ index: 0, primitives: [] });
    }

    for (const failure of this.evaluator.getFailures()) {
      this.warnings.push({
        kind: 'expression',
        message: `Expression failed: ${failure.message}`,
        detail: failure.expression,
      });
    }

    return {
      pageCount: this.pages.length,
      paper: this.paper,
      layoutMode: this.definition.layoutMode,
      pages: this.pages,
      warnings: this.warnings,
      stats: {
        detailRows: this.detailRowsEmitted,
        bandsEmitted: this.bandsEmitted,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  // ─── Detail sections ───────────────────────────────────────────────────

  /**
   * One section per DETAIL band: the band, its rows, and the group bands that
   * belong to it.
   *
   * Group bands are matched to a detail band BY DATASET. A template with an
   * items section grouped by HSN and a separate tax-summary section must not
   * have the items' group header fire while the tax summary is repeating.
   */
  private collectDetailSections(): DetailSection[] {
    const sections: DetailSection[] = [];

    for (const band of this.definition.bands) {
      if (band.type !== 'DETAIL' || !band.dataset) {
        continue;
      }

      const rows = this.rowsOf(band.dataset);
      if (rows.length > MAX_DETAIL_ROWS) {
        this.warnings.push({
          kind: 'row-limit',
          message: `Dataset '${band.dataset}' truncated at ${MAX_DETAIL_ROWS} rows`,
          detail: `${rows.length} rows were resolved`,
        });
      }

      const groupHeaders = this.bandsByLevel('GROUP_HEADER', band.dataset);
      const groupFooters = this.bandsByLevel('GROUP_FOOTER', band.dataset);
      const levels = Math.max(groupHeaders.length, groupFooters.length);

      sections.push({
        band,
        rows: rows.slice(0, MAX_DETAIL_ROWS),
        groupHeaders,
        groupFooters,
        groupBy: Array.from(
          { length: levels },
          (_unused, level) => groupHeaders[level]?.groupBy ?? groupFooters[level]?.groupBy,
        ),
        rowGroupPaths: [],
      });
    }

    return sections;
  }

  // ─── Geometry ──────────────────────────────────────────────────────────

  /**
   * Available body height = page height - margins - page header - page footer.
   *
   * Page header and footer are measured ONCE, against the root context. They
   * are allowed to contain expressions but not to change height per page: a
   * header that grew on page 4 would invalidate the body height every previous
   * page was paginated against, and the report would have to be laid out again.
   */
  private computePageGeometry(): void {
    const pageHeader = this.firstBand('PAGE_HEADER');
    const pageFooter = this.firstBand('PAGE_FOOTER');

    this.pageHeaderHeightMm = pageHeader ? this.bandHeight(pageHeader, this.rootContext) : 0;
    this.pageFooterHeightMm = pageFooter ? this.bandHeight(pageFooter, this.rootContext) : 0;

    // GRID mode's vertical unit is LINES, not millimetres, so the page extent
    // comes from paper.rows (the form length) and not from paper.heightMm.
    // Mixing the two puts the page footer of an 80-column invoice at line 277
    // of a 66-line form — two hundred blank lines, and a form feed in the wrong
    // place on every page after the first.
    const isGrid = this.definition.layoutMode === 'GRID';
    const pageExtent = isGrid ? (this.paper.rows ?? null) : this.paper.heightMm;
    const unit = isGrid ? 'lines' : 'mm';

    // Continuous stationery (thermal roll, unset fanfold length) has no page
    // extent. The body is then unbounded and pagination happens only on
    // explicit breaks.
    if (pageExtent === null) {
      this.bodyHeightMm = Number.POSITIVE_INFINITY;
      return;
    }

    // GRID margins are not a thing a printer honours in text mode — the head
    // starts at column 0, line 1 — so only GRAPHIC subtracts them.
    const margins = isGrid ? 0 : this.paper.margins.top + this.paper.margins.bottom;

    const usable = pageExtent - margins - this.pageHeaderHeightMm - this.pageFooterHeightMm;

    if (usable <= 0) {
      this.warnings.push({
        kind: 'overflow',
        message: 'Page header, page footer and margins consume the whole page',
        detail:
          `page ${pageExtent}${unit}, header ${this.pageHeaderHeightMm.toFixed(1)}${unit}, ` +
          `footer ${this.pageFooterHeightMm.toFixed(1)}${unit}`,
      });
    }

    this.bodyHeightMm = Math.max(usable, 1);
  }

  // ─── Pre-pass ──────────────────────────────────────────────────────────

  /**
   * Compute group keys per row and pre-accumulate REPORT/GROUP aggregates.
   *
   * Runs before any layout, so a GROUP_HEADER can print the total of a group
   * whose rows have not been emitted yet.
   */
  private prePass(sections: readonly DetailSection[]): void {
    this.precomputed = new PrecomputedAggregates();

    const aggregateElements = this.collectAggregateElements(sections);

    for (const section of sections) {
      const { rows, groupBy } = section;
      // Only the aggregates that target THIS dataset. Without the filter an
      // item-count total also counts the tax-summary rows, because both
      // sections' rows flow through the same pre-pass.
      const applicable = aggregateElements.filter(
        (element) => element.dataset === section.band.dataset,
      );

      rows.forEach((row, index) => {
        const context = this.rowContext(row, index, rows.length, []);

        const keys = groupBy.map((expression) => this.evaluator.evaluateText(expression, context));
        section.rowGroupPaths.push(keys);

        for (const element of applicable) {
          const value = this.evaluator.evaluateNumber(element.value, context);

          this.precomputed.addReport(element.id, value);

          // Accumulate into every ENCLOSING group level too, so a level-0
          // footer sees the sum of all its level-1 children without a second
          // traversal.
          for (let level = 0; level < keys.length; level += 1) {
            this.precomputed.addGroup(buildGroupPath(keys.slice(0, level + 1)), element.id, value);
          }
        }
      });
    }
  }

  /**
   * Every aggregate element, with the dataset it aggregates over resolved.
   *
   * Resolution order: the aggregate's own `dataset`, then the owning band's
   * dataset, then — only if the template declares exactly one repeating
   * dataset — that one. A SUMMARY band's aggregate has no band dataset of its
   * own, so on a template with two repeating sections it MUST name one, and an
   * element that cannot be resolved is dropped with a warning rather than
   * silently totalling the wrong rows.
   */
  private collectAggregateElements(
    sections: readonly DetailSection[],
  ): Array<{ id: string; value: string; dataset: string }> {
    const sectionDatasets = [
      ...new Set(
        sections
          .map((section) => section.band.dataset)
          .filter((dataset): dataset is string => dataset !== undefined),
      ),
    ];
    const soleDataset = sectionDatasets.length === 1 ? sectionDatasets[0] : undefined;

    const collected: Array<{ id: string; value: string; dataset: string }> = [];

    for (const band of this.definition.bands) {
      for (const element of band.elements) {
        if (element.kind !== 'FIELD' || !element.aggregate) {
          continue;
        }

        const dataset = element.aggregate.dataset ?? band.dataset ?? soleDataset;

        if (!dataset) {
          this.warnings.push({
            kind: 'missing-dataset',
            message:
              `Aggregate on element '${element.id}' does not say which dataset to total, ` +
              'and the template has more than one repeating dataset',
            detail: `candidates: ${sectionDatasets.join(', ')}`,
          });
          continue;
        }

        // `over` is the raw numeric expression; `value` is the display format.
        collected.push({ id: element.id, value: element.aggregate.over ?? element.value, dataset });
      }
    }

    return collected;
  }

  private emitDetailSection(section: DetailSection): void {
    const { band: detailBand, rows, groupHeaders, groupFooters } = section;
    const summaryBand = this.firstBand('SUMMARY');
    const pageAggregateElements = this.pageScopeElementsFor(section);

    // Each section opens with no groups of its own, whatever the previous one
    // left behind.
    this.openGroups = [];

    rows.forEach((row, index) => {
      const keys = section.rowGroupPaths[index] ?? [];
      const isLastRow = index === rows.length - 1;

      // ── Group breaks ─────────────────────────────────────────────────
      // Find the outermost level whose key changed. Everything from there
      // inward closes (footers, innermost first) and reopens (headers,
      // outermost first).
      let changedFrom = keys.length;
      for (let level = 0; level < keys.length; level += 1) {
        const open = this.openGroups[level];
        if (!open || open.key !== keys[level]) {
          changedFrom = level;
          break;
        }
      }

      if (changedFrom < this.openGroups.length) {
        this.closeGroupsFrom(changedFrom, groupFooters);
      }

      for (let level = changedFrom; level < keys.length; level += 1) {
        const path = buildGroupPath(keys.slice(0, level + 1));
        this.openGroups[level] = { level, key: keys[level], path, rowCount: 0 };

        const headerBand = groupHeaders[level];
        if (headerBand) {
          // Only the keys down to THIS level, so `group.key` in a level-0 header
          // is the level-0 key. Passing the full path would make an outer header
          // print its innermost child's key.
          this.emitBand(
            headerBand,
            this.rowContext(row, index, rows.length, keys.slice(0, level + 1)),
          );
        }
      }

      for (const open of this.openGroups) {
        open.rowCount += 1;
      }

      // ── The row itself ───────────────────────────────────────────────
      const context = this.rowContext(row, index, rows.length, keys);

      // keepWithLastDetail: reserve the summary's height while placing the
      // final row, so the summary can never land alone on a page of its own
      // with the last line of the invoice orphaned on the previous one.
      const reserveMm =
        isLastRow && summaryBand?.keepWithLastDetail
          ? this.bandHeight(summaryBand, this.rootContext) +
            this.closingFootersHeight(groupFooters, context)
          : 0;

      this.emitBand(detailBand, context, { reserveMm });
      this.detailRowsEmitted += 1;

      // Accumulate PAGE-scope aggregates as rows land on the page. Done AFTER
      // emitting, so a row that pushed to a new page counts on the new page.
      this.accumulatePageAggregates(pageAggregateElements, context);
    });

    this.closeGroupsFrom(0, groupFooters);
  }

  private closeGroupsFrom(level: number, groupFooters: readonly Band[]): void {
    // Innermost first: a level-1 footer prints above its level-0 footer.
    for (let index = this.openGroups.length - 1; index >= level; index -= 1) {
      const open = this.openGroups[index];
      if (!open) {
        continue;
      }
      const footerBand = groupFooters[index];
      if (footerBand) {
        this.emitBand(footerBand, this.groupContext(open));
      }
    }
    this.openGroups = this.openGroups.slice(0, level);
  }

  /** PAGE-scope aggregate elements that total this section's dataset. */
  private pageScopeElementsFor(section: DetailSection): Array<{ id: string; value: string }> {
    const elements: Array<{ id: string; value: string }> = [];

    for (const band of this.definition.bands) {
      for (const element of band.elements) {
        if (element.kind !== 'FIELD' || element.aggregate?.scope !== 'PAGE') {
          continue;
        }
        const dataset = element.aggregate.dataset ?? band.dataset;
        // An unqualified PAGE aggregate on a template with one repeating
        // dataset resolves to it; collectAggregateElements has already warned
        // about the ambiguous case.
        if (dataset === undefined || dataset === section.band.dataset) {
          elements.push({ id: element.id, value: element.aggregate.over ?? element.value });
        }
      }
    }

    return elements;
  }

  /** Height of the footers that will close when the last row is placed. */
  private closingFootersHeight(
    groupFooters: readonly Band[],
    context: Record<string, unknown>,
  ): number {
    return this.openGroups.reduce((total, open) => {
      const footerBand = open ? groupFooters[open.level] : undefined;
      return footerBand ? total + this.bandHeight(footerBand, context) : total;
    }, 0);
  }

  /**
   * PAGE-scope accumulation, for the rows of ONE section.
   *
   * `applicable` is pre-filtered by dataset for the same reason the pre-pass
   * filters: a per-page item subtotal must not be fed the tax-summary rows.
   */
  private accumulatePageAggregates(
    applicable: readonly { id: string; value: string }[],
    context: Record<string, unknown>,
  ): void {
    for (const element of applicable) {
      this.pageAggregates.add(element.id, this.evaluator.evaluateNumber(element.value, context));
    }
  }

  /** Emit a band if the template declares one. Returns whether it did. */
  private emitBandIfPresent(type: BandType): boolean {
    const band = this.firstBand(type);
    if (!band) {
      return false;
    }
    this.emitBand(band, this.rootContext);
    return true;
  }

  // ─── Band emission and pagination ──────────────────────────────────────

  private emitBand(
    band: Band,
    context: Record<string, unknown>,
    options: { reserveMm?: number } = {},
  ): void {
    if (!this.evaluator.evaluateCondition(band.visible, context)) {
      return;
    }

    const heightMm = this.bandHeight(band, context);
    const reserveMm = options.reserveMm ?? 0;

    // A crosstab is the one element that can be taller than the paper. When a
    // band carries exactly one, and the whole band will not fit where the
    // cursor stands, the table is split across pages instead of overflowing --
    // see emitCrosstabBand. Two crosstabs in one band have no single split to
    // make, so they fall through and are drawn whole.
    const crosstab = this.soleCrosstab(band);
    if (crosstab && !this.fitsInRemainingBody(heightMm + reserveMm)) {
      this.emitCrosstabBand(band, context, crosstab, reserveMm);
      return;
    }

    if (this.needsPageBreak(heightMm + reserveMm)) {
      this.finishPage();
      this.startPage();
    }

    const bandTopMm = this.bodyTopMm() + this.cursorMm;
    this.drawBandElements(band, context, bandTopMm);

    this.cursorMm += heightMm;
    this.bandsEmitted += 1;

    // A PAGEBREAK element inside the band takes effect AFTER the band draws,
    // so the band that requested the break still appears above it.
    if (this.bandRequestsPageBreak(band, context)) {
      this.finishPage();
      this.startPage();
    }
  }

  // ─── Crosstabs ─────────────────────────────────────────────────────────

  /** The band's only crosstab, or null when it has none or more than one. */
  private soleCrosstab(band: Band): CrosstabElement | null {
    const found = band.elements.filter(
      (element): element is CrosstabElement => element.kind === 'CROSSTAB',
    );
    return found.length === 1 ? found[0] : null;
  }

  /**
   * The plan for a crosstab, aggregated once and reused.
   *
   * Cached by element id because `bandHeight` asks for it before the band is
   * placed and `drawCrosstab` asks again for every page the table spills onto.
   * Rebuilding would be a full pass over the dataset each time, and -- worse --
   * two passes could disagree if the measure expression is not pure.
   */
  private crosstabPlanFor(
    element: CrosstabElement,
    context: Record<string, unknown>,
  ): CrosstabPlan {
    const cached = this.crosstabPlans.get(element.id);
    if (cached) {
      return cached;
    }

    const rows = this.rowsOf(element.dataset);
    const model = buildCrosstabModel(element, rows, {
      text: (expression, row, index, total) =>
        this.evaluator.evaluateText(
          expression,
          this.crosstabRowContext(context, row, index, total),
        ),
      number: (expression, row, index, total) =>
        this.evaluator.evaluateNumber(
          expression,
          this.crosstabRowContext(context, row, index, total),
        ),
    });

    const plan = planCrosstab(element, model, this.measurer);
    this.crosstabPlans.set(element.id, plan);

    if (plan.columnsCutForWidth > 0) {
      this.warnings.push({
        kind: 'overflow',
        message: `Crosstab '${element.id}' dropped ${plan.columnsCutForWidth} column(s) that did not fit its ${element.w}mm width`,
        detail: 'Widen the element, narrow columnWidthMm, or lower maxColumns.',
      });
    }
    if (model.droppedColumns > 0) {
      this.warnings.push({
        kind: 'overflow',
        message: `Crosstab '${element.id}' clipped ${model.droppedColumns} column(s) past maxColumns=${element.maxColumns}`,
        detail:
          'Its totals describe only the printed columns; set overflow to FOLD to keep them whole.',
      });
    }

    return plan;
  }

  /**
   * The context a crosstab expression sees.
   *
   * The band's own context with `row` swapped for the source row, so the same
   * `{{ row.netAmount }}` a designer would write in a DETAIL band works here.
   *
   * The plan cache below is keyed by element id alone, which is only safe
   * because a crosstab may only live in a band that appears at most once
   * (CROSSTAB_BANDS) -- so each element is aggregated and emitted exactly once
   * per render.
   */
  private crosstabRowContext(
    context: Record<string, unknown>,
    row: unknown,
    index: number,
    totalRows: number,
  ): Record<string, unknown> {
    return { ...context, row: this.rowValue(row, index, totalRows) };
  }

  /** Push one slice's primitives onto the current page. */
  private drawCrosstab(
    plan: CrosstabPlan,
    context: Record<string, unknown>,
    xMm: number,
    yMm: number,
    slice: ReturnType<typeof sliceCrosstab>,
  ): void {
    if (!this.currentPage) {
      return;
    }
    const { element } = plan;
    const primitives = emitCrosstab(plan, {
      xMm,
      yMm,
      slice,
      cornerText: this.evaluator.evaluateText(element.corner, context),
      strokeColour: this.resolveColour(element.style?.stroke, context, '#000000'),
      textColour: this.resolveColour(element.style?.color, context, '#000000'),
      headerFill: element.headerFill
        ? this.resolveColour(element.headerFill, context, '#eeeeee')
        : null,
    });
    this.currentPage.primitives.push(...primitives);
  }

  /**
   * A band whose crosstab is taller than the space left, split across pages.
   *
   * The band's OTHER elements draw once, on the page the table starts on. A
   * caption above a two-page table belongs with its first page, and repeating
   * it would read as two separate tables; the column header repeats instead,
   * which is what `repeatHeader` is for.
   */
  private emitCrosstabBand(
    band: Band,
    context: Record<string, unknown>,
    element: CrosstabElement,
    reserveMm: number,
  ): void {
    const plan = this.crosstabPlanFor(element, context);
    const offsetMm = this.elementY(element);

    // Start on the next page unless the caption, the column header and at
    // least one row fit here -- a heading stranded above a page break is worse
    // than a slightly short page.
    if (this.needsPageBreak(offsetMm + plan.headerHeightMm + plan.rowHeightMm + reserveMm)) {
      this.finishPage();
      this.startPage();
    }

    const bandTopMm = this.bodyTopMm() + this.cursorMm;
    this.drawBandElements(band, context, bandTopMm, { skipCrosstabId: element.id });
    this.bandsEmitted += 1;

    let tableTopMm = bandTopMm + offsetMm;
    let fromRow = 0;
    let withHeader = true;
    let pagesBroken = 0;

    for (let guard = 0; guard <= MAX_PAGES; guard += 1) {
      if (!this.currentPage) {
        return;
      }

      const availableMm = this.bodyTopMm() + this.bodyHeightMm - tableTopMm;
      let slice = sliceCrosstab(plan, fromRow, availableMm, withHeader);

      const rowsRemain = fromRow < plan.model.rows.length;
      if (slice.rowCount === 0 && rowsRemain) {
        if (pagesBroken > 0 && tableTopMm <= this.bodyTopMm() + 0.001) {
          // A fresh page cannot hold the header and one row. Breaking again
          // would loop for ever, so place a row and say so.
          this.warnings.push({
            kind: 'band-too-tall',
            message: `Crosstab '${element.id}' needs ${(plan.headerHeightMm + plan.rowHeightMm).toFixed(1)}mm for a header and one row but the page body is ${this.bodyHeightMm.toFixed(1)}mm`,
            detail: 'It will overflow the page rather than loop.',
          });
          slice = {
            ...slice,
            rowCount: 1,
            heightMm: (withHeader ? plan.headerHeightMm : 0) + plan.rowHeightMm,
          };
        } else {
          this.finishPage();
          this.startPage();
          pagesBroken += 1;
          tableTopMm = this.bodyTopMm();
          withHeader = element.repeatHeader;
          continue;
        }
      }

      this.drawCrosstab(plan, context, this.elementX(element), tableTopMm, slice);
      fromRow = slice.fromRow + slice.rowCount;

      if (crosstabIsComplete(plan, slice)) {
        const tableBottomMm = tableTopMm + slice.heightMm + this.spacingMm(band);
        const bottomMm =
          pagesBroken === 0
            ? Math.max(tableBottomMm, bandTopMm + this.bandHeight(band, context))
            : tableBottomMm;
        this.cursorMm = Math.max(0, bottomMm - this.bodyTopMm());

        if (this.bandRequestsPageBreak(band, context)) {
          this.finishPage();
          this.startPage();
        }
        return;
      }

      this.finishPage();
      this.startPage();
      pagesBroken += 1;
      tableTopMm = this.bodyTopMm();
      withHeader = element.repeatHeader;
    }
  }

  /**
   * Does `requiredMm` fit between the cursor and the bottom of the body?
   *
   * NOT the same question as needsPageBreak, which answers 'no' for a band
   * taller than a whole page -- breaking for one would loop, so it is placed
   * and allowed to overflow. A crosstab taller than the page is the one case
   * that has a better answer than overflowing, so the routing test has to be
   * the plain geometric one.
   */
  private fitsInRemainingBody(requiredMm: number): boolean {
    if (this.bodyHeightMm === Number.POSITIVE_INFINITY) {
      return true;
    }
    return this.cursorMm + requiredMm <= this.bodyHeightMm + 0.001;
  }

  private needsPageBreak(requiredMm: number): boolean {
    if (!this.currentPage) {
      return false;
    }
    if (this.bodyHeightMm === Number.POSITIVE_INFINITY) {
      return false;
    }
    // A band taller than a whole page can never fit. Breaking for it would
    // loop: new page, still does not fit, new page. Place it and warn.
    if (requiredMm > this.bodyHeightMm) {
      if (this.cursorMm === 0) {
        this.warnings.push({
          kind: 'band-too-tall',
          message: `A band is ${requiredMm.toFixed(1)}mm tall but the page body is only ${this.bodyHeightMm.toFixed(1)}mm`,
          detail: 'It will overflow the page rather than loop.',
        });
        return false;
      }
      return true;
    }
    return this.cursorMm + requiredMm > this.bodyHeightMm + 0.001;
  }

  private bandRequestsPageBreak(band: Band, context: Record<string, unknown>): boolean {
    for (const element of band.elements) {
      if (element.kind === 'PAGEBREAK' && this.evaluator.evaluateCondition(element.when, context)) {
        return true;
      }
    }
    return false;
  }

  /**
   * A band's height: its declared height, or -- with autoGrow -- the height its
   * tallest wrapped text actually needs.
   */
  private bandHeight(band: Band, context: Record<string, unknown>): number {
    const declaredMm =
      this.definition.layoutMode === 'GRID' ? (band.heightRows ?? band.heightMm) : band.heightMm;

    // A crosstab sizes itself from its data, so it grows the band whether or
    // not autoGrow is on. autoGrow is a promise about WRAPPED TEXT the designer
    // could have measured by eye; a table whose row count the query decides is
    // not something a declared height can ever be right about.
    let crosstabMm = declaredMm;
    for (const element of band.elements) {
      if (element.kind !== 'CROSSTAB') {
        continue;
      }
      if (!this.evaluator.evaluateCondition(element.visible, context)) {
        continue;
      }
      const plan = this.crosstabPlanFor(element, context);
      crosstabMm = Math.max(crosstabMm, element.y + plan.fullHeightMm);
    }

    if (!band.autoGrow) {
      return crosstabMm + this.spacingMm(band);
    }

    let neededMm = crosstabMm;

    for (const element of band.elements) {
      if (!isTextLike(element) || !element.wrap) {
        continue;
      }
      if (!this.evaluator.evaluateCondition(element.visible, context)) {
        continue;
      }

      const text = this.evaluator.evaluateText(element.value, context);
      if (!text) {
        continue;
      }

      // GRID measures in CHARACTERS and grows by LINES; GRAPHIC measures in
      // millimetres. Running the millimetre measurer over a column count is
      // how a 2-line receipt row became six lines tall — 48 was read as 48mm
      // of text width, and the font metrics then reported four wrapped lines.
      if (this.definition.layoutMode === 'GRID') {
        const columns = element.cols ?? element.w ?? 0;
        const lineCount = columns > 0 ? wrapText(text, columns).length : 1;
        neededMm = Math.max(neededMm, (element.row ?? 0) + lineCount);
        continue;
      }

      const font = this.fontOf(element);
      const wrapped = this.measurer.wrap(text, element.w ?? 0, font);
      neededMm = Math.max(neededMm, element.y + wrapped.heightMm);
    }

    return neededMm + this.spacingMm(band);
  }

  private spacingMm(band: Band): number {
    if (band.spacingRows === 0) {
      return 0;
    }
    // In GRID mode a spacing row IS a row; in GRAPHIC it is a blank line at the
    // band's own default text size.
    return this.definition.layoutMode === 'GRID'
      ? band.spacingRows
      : band.spacingRows *
          this.measurer.lineHeightMm({ family: 'NotoSans', sizePt: 9, bold: false, italic: false });
  }

  /**
   * Top of the printable body. Millimetres in GRAPHIC mode, LINES in GRID —
   * the whole vertical axis carries whichever unit the layout mode uses, which
   * is why every field here is named *Mm but holds lines under GRID.
   */
  private bodyTopMm(): number {
    return this.definition.layoutMode === 'GRID'
      ? this.pageHeaderHeightMm
      : this.paper.margins.top + this.pageHeaderHeightMm;
  }

  private startPage(): void {
    if (this.pages.length >= MAX_PAGES) {
      this.warnings.push({
        kind: 'page-limit',
        message: `Render stopped at the ${MAX_PAGES}-page ceiling`,
      });
      return;
    }

    this.currentPage = { index: this.pages.length, primitives: [] };
    this.pages.push(this.currentPage);
    this.cursorMm = 0;
    this.pageAggregates.reset();

    const pageHeader = this.firstBand('PAGE_HEADER');
    if (pageHeader && this.shouldPrintOnPage(pageHeader, this.currentPage.index)) {
      this.drawBandElements(
        pageHeader,
        this.pageContext(this.currentPage.index),
        this.definition.layoutMode === 'GRID' ? 0 : this.paper.margins.top,
      );
      this.bandsEmitted += 1;
    }
  }

  /**
   * Close the current page, drawing its footer.
   *
   * The footer is drawn at page CLOSE rather than page open, because a
   * PAGE-scope aggregate in the footer is only complete once every row that
   * landed on the page has been counted.
   */
  private finishPage(): void {
    if (!this.currentPage) {
      return;
    }

    const pageFooter = this.firstBand('PAGE_FOOTER');
    if (pageFooter && this.shouldPrintOnPage(pageFooter, this.currentPage.index)) {
      const footerTopMm =
        this.definition.layoutMode === 'GRID'
          ? this.pageHeaderHeightMm + this.bodyHeightMm
          : (this.paper.heightMm ?? 0) - this.paper.margins.bottom - this.pageFooterHeightMm;

      this.drawBandElements(pageFooter, this.pageContext(this.currentPage.index), footerTopMm);
      this.bandsEmitted += 1;
    }

    this.currentPage = null;
  }

  /**
   * printOn, evaluated against the page index.
   *
   * LAST_PAGE and NOT_LAST_PAGE cannot be decided during pass 1 -- the last
   * page is not known until the report ends. They are handled by drawing the
   * band and letting pass 2 blank it, which is the same mechanism `page.total`
   * uses, rather than by a speculative second layout.
   */
  private shouldPrintOnPage(band: Band, pageIndex: number): boolean {
    switch (band.printOn) {
      case 'FIRST_PAGE':
        return pageIndex === 0;
      case 'NOT_FIRST_PAGE':
        return pageIndex > 0;
      case 'LAST_PAGE':
      case 'NOT_LAST_PAGE':
      case 'ALL_PAGES':
      default:
        return true;
    }
  }

  // ─── Element drawing ───────────────────────────────────────────────────

  private drawBandElements(
    band: Band,
    context: Record<string, unknown>,
    bandTopMm: number,
    options: { skipCrosstabId?: string } = {},
  ): void {
    if (!this.currentPage) {
      return;
    }

    const page = this.currentPage;

    // z-order within the band: a background rect must paint before the text
    // that sits on it, whatever order the designer happened to add them in.
    const ordered = [...band.elements].sort((left, right) => left.z - right.z);

    for (const element of ordered) {
      if (element.kind === 'PAGEBREAK') {
        continue;
      }
      if (!this.evaluator.evaluateCondition(element.visible, context)) {
        continue;
      }

      if (element.kind === 'CROSSTAB') {
        // The paginating path draws this one itself, page by page.
        if (element.id === options.skipCrosstabId) {
          continue;
        }
        const plan = this.crosstabPlanFor(element, context);
        this.drawCrosstab(
          plan,
          context,
          this.elementX(element),
          bandTopMm + this.elementY(element),
          {
            fromRow: 0,
            rowCount: plan.model.rows.length,
            withHeader: true,
            withTotals: plan.totalsRowHeightMm > 0,
            heightMm: plan.fullHeightMm,
          },
        );
        continue;
      }

      const primitive = this.buildPrimitive(element, context, bandTopMm);
      if (!primitive) {
        continue;
      }

      page.primitives.push(primitive);

      // Record a deferred re-evaluation if the text depends on the page total.
      if (primitive.k === 'text' && isTextLike(element) && this.dependsOnPage(element.value)) {
        this.deferred.push({
          pageIndex: page.index,
          primitiveIndex: page.primitives.length - 1,
          template: element.value,
          context,
          maxWidthMm: element.w ?? 0,
          wrap: element.wrap,
          font: this.fontOf(element),
        });
      }
    }
  }

  private buildPrimitive(
    element: ReportElement,
    context: Record<string, unknown>,
    bandTopMm: number,
  ): Primitive | null {
    const baseX = this.elementX(element);
    const baseY = bandTopMm + this.elementY(element);

    switch (element.kind) {
      case 'TEXT':
      case 'FIELD': {
        const raw = this.resolveTextValue(element, context);
        if (raw === null) {
          return null;
        }
        return this.buildTextPrimitive(element, raw, baseX, baseY);
      }

      case 'LINE': {
        const style = element.style;
        return {
          k: 'line',
          x1: element.x1,
          y1: bandTopMm + element.y1,
          x2: element.x2,
          y2: bandTopMm + element.y2,
          widthPt: element.widthPt,
          color: this.resolveColour(style?.stroke, context, '#000000'),
          gridChar: element.gridChar,
        };
      }

      case 'RECT': {
        const style = element.style;
        return {
          k: 'rect',
          x: baseX,
          y: baseY,
          w: element.w,
          h: element.h,
          fill: style?.fill ? this.resolveColour(style.fill, context, '#000000') : null,
          stroke: style?.stroke ? this.resolveColour(style.stroke, context, '#000000') : null,
          strokeWidthPt: style?.strokeWidthPt ?? 0.5,
          radiusMm: element.radiusMm,
        };
      }

      case 'IMAGE': {
        const src = this.evaluator.evaluateText(element.source, context);
        if (!src) {
          return null;
        }
        return {
          k: 'image',
          x: baseX,
          y: baseY,
          w: element.w,
          h: element.h,
          src,
          fit: element.fit,
        };
      }

      case 'BARCODE': {
        const value = this.evaluator.evaluateText(element.value, context);
        if (!value) {
          return null;
        }
        return {
          k: 'barcode',
          x: baseX,
          y: baseY,
          w: element.w,
          h: element.h,
          symbology: element.symbology,
          value,
          showText: element.showText,
        };
      }

      case 'QRCODE': {
        const value = this.evaluator.evaluateText(element.value, context);
        if (!value) {
          return null;
        }
        return {
          k: 'qrcode',
          x: baseX,
          y: baseY,
          size: element.size,
          value,
          errorCorrection: element.errorCorrection,
        };
      }

      default:
        return null;
    }
  }

  /**
   * A text element's value, or null to skip it entirely.
   *
   * An aggregate FIELD reads its pre-computed or live total instead of
   * evaluating its own expression -- the expression is the thing being
   * aggregated, not the thing being printed.
   */
  private resolveTextValue(
    element: Extract<ReportElement, { kind: 'TEXT' | 'FIELD' }>,
    context: Record<string, unknown>,
  ): string | null {
    if (element.kind === 'FIELD' && element.aggregate) {
      const total = this.readAggregate(element.id, element.aggregate.fn, element.aggregate.scope);
      if (element.blankWhenZero && total === 0) {
        return null;
      }
      // Aggregates are numbers; the element's own format pattern is applied by
      // wrapping the total back through the expression context as `agg.value`.
      return this.formatAggregate(element, total, context);
    }

    const text = this.evaluator.evaluateText(element.value, context);

    if (element.blankWhenZero) {
      // A grid of zeroes is noise. Blank when the value is numerically zero,
      // whatever the pattern rendered it as ('0.00', '-', '0').
      const numeric = Number(text.replace(/[^0-9.-]/g, ''));
      if (text.trim() === '' || (Number.isFinite(numeric) && numeric === 0)) {
        return null;
      }
    }

    return text;
  }

  /**
   * Apply the element's own formatting to an aggregate result.
   *
   * The aggregate value is injected as `agg.value` and the element's expression
   * is re-run with `row` shadowed, so `{{ row.netAmount|fmt('#,##0.00') }}` on a
   * total element formats the TOTAL rather than the last row's amount. Without
   * this the designer would have to write a second, different expression on
   * every total, and get the pattern subtly wrong on half of them.
   */
  private formatAggregate(
    element: Extract<ReportElement, { kind: 'FIELD' }>,
    total: number,
    context: Record<string, unknown>,
  ): string {
    const aggregateContext = {
      ...context,
      agg: { ...(context.agg as Record<string, unknown>), value: total },
      row: new Proxy(
        {},
        {
          // Every field read on `row` yields the aggregate, so whichever column
          // the expression names, the formatting lands on the total.
          get: () => total,
          has: () => true,
        },
      ),
    };
    return this.evaluator.evaluateText(element.value, aggregateContext);
  }

  private readAggregate(elementId: string, fn: AggregateFunction, scope: AggregateScope): number {
    switch (scope) {
      case 'REPORT':
        return this.precomputed.readReport(elementId, fn);
      case 'PAGE':
        return this.pageAggregates.read(elementId, fn);
      case 'GROUP': {
        const innermost = this.openGroups[this.openGroups.length - 1];
        return innermost ? this.precomputed.readGroup(innermost.path, elementId, fn) : 0;
      }
      default:
        return 0;
    }
  }

  private buildTextPrimitive(
    element: Extract<ReportElement, { kind: 'TEXT' | 'FIELD' }>,
    text: string,
    x: number,
    y: number,
  ): TextPrimitive {
    const font = this.fontOf(element);
    const widthMm = element.w ?? 0;

    let lines: string[];
    let lineHeightMm: number;

    if (this.definition.layoutMode === 'GRID') {
      // One line is one printer row, and the budget is a column count. Using
      // the font measurer here would wrap against millimetres of a proportional
      // face, which has nothing to do with a character grid.
      const columns = element.cols ?? element.w ?? 0;
      lineHeightMm = 1;
      lines = element.wrap && columns > 0 ? wrapText(text, columns) : [text];
      if (lines.length === 0) {
        lines = [''];
      }
    } else if (element.wrap && widthMm > 0) {
      const wrapped = this.measurer.wrap(text, widthMm, font);
      lines = [...wrapped.lines];
      lineHeightMm = wrapped.lineHeightMm;
    } else {
      lineHeightMm = this.measurer.lineHeightMm(font);
      lines = [
        element.ellipsis && widthMm > 0 ? this.measurer.truncateToWidth(text, widthMm, font) : text,
      ];
    }

    return {
      k: 'text',
      x,
      y,
      w: widthMm,
      h: element.h ?? lines.length * lineHeightMm,
      text: lines.join('\n'),
      font: {
        family: font.family,
        sizePt: font.sizePt,
        bold: font.bold,
        italic: font.italic,
        underline: element.font?.underline ?? false,
      },
      align: element.align,
      vAlign: element.vAlign,
      color: this.resolveColour(element.style?.color, this.rootContext, '#000000'),
      lines,
      lineHeightMm,
    };
  }

  private elementX(element: ReportElement): number {
    return this.definition.layoutMode === 'GRID' ? (element.col ?? 0) : element.x;
  }

  private elementY(element: ReportElement): number {
    return this.definition.layoutMode === 'GRID' ? (element.row ?? 0) : element.y;
  }

  private fontOf(element: Extract<ReportElement, { kind: 'TEXT' | 'FIELD' }>): MeasuredFont {
    return {
      family: element.font?.family ?? 'NotoSans',
      sizePt: element.font?.size ?? 9,
      bold: element.font?.bold ?? false,
      italic: element.font?.italic ?? false,
    };
  }

  /**
   * A colour may itself be an expression -- that is how a negative amount
   * prints red. A non-expression value passes straight through.
   */
  private resolveColour(
    value: string | undefined,
    context: Record<string, unknown>,
    fallback: string,
  ): string {
    if (!value) {
      return fallback;
    }
    if (!value.includes('{{')) {
      return value;
    }
    const resolved = this.evaluator.evaluateText(value, context);
    return /^#[0-9a-fA-F]{6}$/.test(resolved) ? resolved : fallback;
  }

  // ─── Pass 2: page numbering ────────────────────────────────────────────

  private dependsOnPage(template: string): boolean {
    return template.includes('{{') && /\bpage\s*\./.test(template);
  }

  /**
   * Re-evaluate the primitives that referenced `page`, now that the total is
   * known, and apply LAST_PAGE / NOT_LAST_PAGE suppression.
   */
  private resolveDeferredText(): void {
    const total = this.pages.length;

    for (const entry of this.deferred) {
      const page = this.pages[entry.pageIndex];
      if (!page) {
        continue;
      }

      const existing = page.primitives[entry.primitiveIndex];
      if (!existing || existing.k !== 'text') {
        continue;
      }

      const context = {
        ...entry.context,
        page: {
          number: entry.pageIndex + 1,
          total,
          isFirst: entry.pageIndex === 0,
          isLast: entry.pageIndex === total - 1,
        },
      };

      const text = this.evaluator.evaluateText(entry.template, context);
      const lines =
        entry.wrap && entry.maxWidthMm > 0
          ? [...this.measurer.wrap(text, entry.maxWidthMm, entry.font).lines]
          : [text];

      page.primitives[entry.primitiveIndex] = { ...existing, text: lines.join('\n'), lines };
    }

    this.suppressLastPageBands(total);
  }

  /**
   * Apply LAST_PAGE and NOT_LAST_PAGE to the page header and footer.
   *
   * Both are only decidable once the page count is final. Rather than lay the
   * report out twice, the bands were drawn optimistically in pass 1 and the
   * primitives they contributed are removed here. Bands are drawn contiguously,
   * so a band's primitives are a contiguous slice -- the header's at the front
   * of the page, the footer's at the back.
   */
  private suppressLastPageBands(total: number): void {
    const pageHeader = this.firstBand('PAGE_HEADER');
    const pageFooter = this.firstBand('PAGE_FOOTER');

    const suppressionNeeded = (band: Band | undefined, pageIndex: number): boolean => {
      if (!band) {
        return false;
      }
      const isLast = pageIndex === total - 1;
      return (
        (band.printOn === 'LAST_PAGE' && !isLast) || (band.printOn === 'NOT_LAST_PAGE' && isLast)
      );
    };

    for (const page of this.pages) {
      if (suppressionNeeded(pageFooter, page.index)) {
        const count = this.visibleElementCount(pageFooter as Band);
        page.primitives.splice(page.primitives.length - count, count);
      }
      if (suppressionNeeded(pageHeader, page.index)) {
        const count = this.visibleElementCount(pageHeader as Band);
        page.primitives.splice(0, count);
      }
    }
  }

  /**
   * How many primitives a band contributed.
   *
   * Counts the elements that produce a primitive at all: PAGEBREAK produces
   * none, and a page header/footer is evaluated against the page context whose
   * `visible` conditions do not vary per page in practice. An element that IS
   * conditionally hidden would make this count wrong, so conditional visibility
   * inside a LAST_PAGE-only band is the one combination not supported -- it is
   * rejected below rather than silently mis-clipping the page.
   */
  private visibleElementCount(band: Band): number {
    let count = 0;
    for (const element of band.elements) {
      if (element.kind === 'PAGEBREAK') {
        continue;
      }
      if (element.visible) {
        this.warnings.push({
          kind: 'overflow',
          message:
            `A ${band.printOn} band has an element with a 'visible' condition, ` +
            'which cannot be combined with last-page suppression',
          detail: `element ${element.id}`,
        });
      }
      count += 1;
    }
    return count;
  }

  // ─── Context construction ──────────────────────────────────────────────

  private rowContext(
    row: unknown,
    index: number,
    totalRows: number,
    keys: readonly string[],
  ): Record<string, unknown> {
    const innermost = keys.length > 0 ? keys[keys.length - 1] : '';
    return {
      ...this.rootContext,
      row: this.rowValue(row, index, totalRows),
      group: {
        key: innermost,
        level: Math.max(0, keys.length - 1),
        count: this.openGroups[this.openGroups.length - 1]?.rowCount ?? 0,
        keys: [...keys],
      },
      page: this.currentPageDescriptor(),
    };
  }

  private groupContext(open: OpenGroup): Record<string, unknown> {
    return {
      ...this.rootContext,
      group: {
        key: open.key,
        level: open.level,
        count: open.rowCount,
        keys: open.path.split(GROUP_PATH_SEPARATOR),
      },
      page: this.currentPageDescriptor(),
    };
  }

  private pageContext(pageIndex: number): Record<string, unknown> {
    return {
      ...this.rootContext,
      page: {
        number: pageIndex + 1,
        total: this.pages.length,
        isFirst: pageIndex === 0,
        isLast: false,
      },
    };
  }

  private currentPageDescriptor(): Record<string, unknown> {
    const index = this.currentPage?.index ?? 0;
    return { number: index + 1, total: this.pages.length, isFirst: index === 0, isLast: false };
  }

  /**
   * The row object exposed to expressions, with `__index` and `__count`
   * injected. `__index` is 1-based because it is what prints in the serial
   * number column, and a template author writing `{{ row.__index }}` means the
   * number the customer reads, not an array offset.
   */
  private rowValue(row: unknown, index: number, totalRows: number): Record<string, unknown> {
    const base = row && typeof row === 'object' ? (row as Record<string, unknown>) : { value: row };
    return {
      ...base,
      __index: (base.__index as number) ?? index + 1,
      __zeroIndex: index,
      __count: totalRows,
      __isFirst: index === 0,
      __isLast: index === totalRows - 1,
      __isEven: index % 2 === 1,
    };
  }

  // ─── Lookups ───────────────────────────────────────────────────────────

  private firstBand(type: BandType): Band | undefined {
    return this.bandsByType.get(type)?.[0];
  }

  /**
   * Group bands for one dataset, indexed so that [0] is the outermost level.
   *
   * Filtering by dataset is what keeps two repeating sections independent: the
   * items section's group header must not fire while the tax summary repeats.
   */
  private bandsByLevel(type: BandType, dataset: string): Band[] {
    const bands = (this.bandsByType.get(type) ?? []).filter((band) => band.dataset === dataset);
    const byLevel: Band[] = [];
    for (const band of bands) {
      byLevel[band.groupLevel] = band;
    }
    // Collapse holes so index === nesting depth even if a template declared
    // only a level-1 group.
    return byLevel.filter((band): band is Band => band !== undefined);
  }

  private rowsOf(datasetName: string): unknown[] {
    const value = this.rootContext[datasetName];
    if (Array.isArray(value)) {
      return value;
    }
    if (value === null || value === undefined) {
      this.warnings.push({
        kind: 'missing-dataset',
        message: `Dataset '${datasetName}' resolved to nothing`,
      });
      return [];
    }
    // A DETAIL band bound to a cardinality-'one' dataset repeats exactly once,
    // which is the only sensible reading and is what the schema's own
    // cardinality check already warns about at save time.
    return [value];
  }
}
