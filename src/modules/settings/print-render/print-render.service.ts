import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrintTemplate, PrintTemplateDataset, PrintTemplateVersion } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import {
  throwSettingsBadRequest,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { PrintTemplateAssignmentService } from '../print-template-assignment/print-template-assignment.service';
import { DatasetRunError, DatasetRunnerService } from './data/dataset-runner.service';
import { RenderParamError, resolveRenderParams } from './data/render-params';
import {
  PrintRenderDefinitionError,
  buildDefinition,
  buildDefinitionFromBody,
} from './definition/definition-from-version';
import { OutputMode, TemplateDefinition } from './definition/template-definition.schema';
import { LayoutEngine } from './engine/layout/layout.engine';
import { LayoutTree } from './engine/layout/layout-tree.types';
import { EscPRenderer } from './engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from './engine/renderers/grid/escpos.renderer';
import { PdfKitRenderer } from './engine/renderers/pdfkit.renderer';
import { IRenderer } from './engine/renderers/renderer.types';
import { PrintLogEntry, PrintLogService } from './print-log.service';
import {
  ACC_YEAR_PATTERN,
  IMPLEMENTED_RENDERERS,
  LAYOUT_MODE_FOR_RENDERER,
  MAX_COPIES,
  RENDERER_FOR_LAYOUT_MODE,
  RENDERER_FOR_OUTPUT_MODE,
  RENDER_COPY_TIMEOUT_MS,
  RENDER_TIMEOUT_MS,
} from './print-render.constants';
import {
  PrintRenderErrorDetail,
  PrintRenderErrorResponse,
  RenderContext,
  RenderOutcome,
  RenderWarning,
  ResolvedDataset,
} from './types/print-render-api.types';

/**
 * §8 — the renderer.
 *
 * The piece the whole printing subsystem is arranged around: it takes a
 * REVISION's body, runs the datasets that revision declares, and returns a PDF
 * or an ESC/POS stream.
 *
 * ── ONE SEQUENCE, TWO ENTRY POINTS ─────────────────────────────────────────
 *
 * `preview` and `print` differ in three things and nothing else: where the
 * revision comes from (named, or resolved through the assignment ladder),
 * whether an unsaved body may stand in for the stored one, and whether the
 * result is written to print_log. Everything between — parameters, datasets,
 * layout, renderer, copies — is one path, called from both. A second copy of
 * that path is precisely how a preview starts disagreeing with the print, which
 * is the failure this module exists to make impossible.
 *
 * ── WHY THE SERVER AND NOT THE CLIENT ──────────────────────────────────────
 *
 * 3.0 rendered on the client, and the result was that every template existed
 * twice — once in the designer and once in whatever the printer actually got —
 * with no way to tell which was authoritative. The body lives on the version
 * precisely so `print_log.plg_version_id` can point at the exact bytes that
 * were rendered; a client-side renderer would make that pointer a claim about
 * something the server never saw.
 */

interface RevisionBundle {
  readonly template: PrintTemplate;
  readonly version: PrintTemplateVersion;
  readonly datasets: PrintTemplateDataset[];
}

export interface PreviewRequest {
  readonly versionId: string;
  readonly context: RenderContext;
  readonly params: Record<string, unknown>;
  readonly outputMode?: OutputMode;
  readonly copies?: number;
  readonly copyLabels?: readonly string[];
  /** An unsaved body, allowed only against a DRAFT revision. */
  readonly body?: Record<string, unknown>;
}

export interface PrintRequest {
  readonly purposeId: string;
  /** Defaults to the purpose's own ppo_src_module. */
  readonly srcModule?: string;
  /** Defaults to the purpose's own ppo_doc_type. */
  readonly srcDocType?: string;
  readonly context: RenderContext;
  readonly params: Record<string, unknown>;
  readonly outputMode?: OutputMode;
  /**
   * §5's vocabulary (PRINT | PREVIEW | PDF | EMAIL | WHATSAPP | ESCPOS), which
   * is a RESOLUTION AXIS: a counter may be assigned one design for the paper it
   * prints and another for the PDF it mails. Distinct from `outputMode` above,
   * which names a renderer.
   */
  readonly assignmentOutputMode?: string;
  readonly copies?: number;
  readonly isReprint?: boolean;
}

export interface PrintOutcome extends RenderOutcome {
  readonly printLogIds: readonly string[];
  readonly assignment: {
    readonly ptaId: string;
    readonly scope: string;
    readonly printerName: string | null;
    readonly printerSource: string;
    readonly outputMode: string;
  };
}

@Injectable()
export class PrintRenderService {
  private readonly logger = new Logger(PrintRenderService.name);

  private readonly renderers: Readonly<Partial<Record<OutputMode, IRenderer>>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly datasetRunner: DatasetRunnerService,
    private readonly assignments: PrintTemplateAssignmentService,
    private readonly printLog: PrintLogService,
    private readonly layout: LayoutEngine,
    pdf: PdfKitRenderer,
    escpos: EscPosRenderer,
    escp: EscPRenderer,
  ) {
    this.renderers = { PDF: pdf, ESCPOS: escpos, ESCP_DOTMATRIX: escp };
  }

  // ─── Preview ───────────────────────────────────────────────────────────

  /**
   * Render a named revision — the designer's Preview.
   *
   * Nothing is logged. A preview is not a render of record: it is not on paper,
   * nobody received it, and a designer iterating a layout would put fifty rows
   * into an immutable table that exists to answer "what did the customer get".
   */
  async preview(request: PreviewRequest): Promise<RenderOutcome> {
    const bundle = await this.loadVersion(request.versionId, request.context.companyId);
    const context = await this.withCurrentAccYear(request.context);

    const definition = request.body
      ? this.buildFromUnsavedBody(bundle, request.body)
      : this.build(bundle);

    return this.renderDefinition({
      bundle,
      definition: definition.definition,
      layoutMode: definition.layoutMode,
      context,
      params: request.params,
      requestedMode: request.outputMode,
      copies: request.copies ?? 1,
      copyLabels: request.copyLabels ?? [],
      docType: 'PREVIEW',
    });
  }

  // ─── Print ─────────────────────────────────────────────────────────────

  /**
   * Render what the assignment ladder says to render, and log it.
   *
   * The template is NOT a parameter. Which design wins for this counter is §5's
   * question and it is already answered by data — "one row IS one choice" — so
   * a render that could be told which template to use would be a second place
   * to decide, and the two would drift.
   */
  async print(request: PrintRequest): Promise<PrintOutcome> {
    const context = await this.withCurrentAccYear(request.context);
    const purpose = await this.loadPurpose(request.purposeId, context.companyId);

    // ppo_allow_reprint is the purpose's own answer to whether this may be
    // printed twice. Refused here rather than at the printer, because the
    // paper is unrecoverable once it is out.
    if (request.isReprint && !purpose.ppoAllowReprint) {
      throwSettingsBadRequest<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'This purpose does not allow reprints',
        [
          {
            field: 'isReprint',
            message:
              'ppoAllowReprint is false for this purpose, so it may be printed once. Change the ' +
              'purpose if that is wrong; there is no override on the render.',
          },
        ],
      );
    }

    const resolution = await this.assignments.resolve({
      purposeId: request.purposeId,
      companyId: context.companyId,
      branchId: context.branchId ?? undefined,
      deviceId: context.deviceId ?? undefined,
      ...(request.assignmentOutputMode ? { outputMode: request.assignmentOutputMode } : {}),
    });

    if (!resolution.publishedRevId) {
      throwSettingsNotFound<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'The assigned template has no published revision',
        'purposeId',
        `Template ${resolution.ptaTemplateName ?? resolution.ptaTemplateId} is assigned at the ` +
          `${resolution.scope} scope but its publish pointer is empty — either nothing has been ` +
          'published yet, or the live revision was retired, which releases the pointer and is ' +
          'what withdrawing a design means.',
      );
    }

    const bundle = await this.loadVersion(resolution.publishedRevId, context.companyId);
    const built = this.build(bundle);

    const copies = Math.min(request.copies ?? resolution.copies ?? 1, MAX_COPIES);

    const outcome = await this.renderDefinition({
      bundle,
      definition: built.definition,
      layoutMode: built.layoutMode,
      context: request.context,
      params: request.params,
      requestedMode: request.outputMode ?? this.rendererForAssignment(resolution.ptaOutputMode),
      copies,
      copyLabels: resolution.copyLabels,
      docType: request.srcDocType ?? purpose.ppoDocType,
    });

    const accYear = await this.printLog.currentAccYear(context.companyId, context.accYear);

    const entries: PrintLogEntry[] = outcome.copyLabels.map((label, index) => ({
      accYear,
      companyId: context.companyId,
      branchId: context.branchId,
      deviceId: context.deviceId,
      srcModule: request.srcModule ?? purpose.ppoSrcModule,
      srcDocType: request.srcDocType ?? purpose.ppoDocType,
      srcDocId: context.docId,
      srcAccYear: context.accYear,
      purposeId: request.purposeId,
      templateId: bundle.template.ptlId,
      versionId: bundle.version.ptvId,
      printerId: resolution.ptaPrinterId,
      outputMode: request.isReprint ? 'REPRINT' : 'PRINT',
      copyNo: index + 1,
      copyLabel: label || null,
      lang: bundle.version.ptvLang,
      params: Object.keys(request.params).length > 0 ? request.params : null,
      status: 'SUCCESS',
      error: null,
      pageCount: outcome.pagesPerCopy[index] ?? null,
      // The whole render's size, on every copy's row. The copies are laid out
      // separately and emitted as one stream, so a per-copy byte count would
      // have to be invented. §7's authoritative column list adds plg_render_id
      // and plg_output_bytes, at which point this becomes a render-level fact
      // recorded once; until that correction lands this is the honest
      // approximation, and it is documented in the module README.
      byteCount: outcome.bytes.length,
      durationMs: outcome.layoutMs + outcome.renderMs,
      printedBy: context.userId,
    }));

    const printLogIds = await this.printLog.record(entries);

    return {
      ...outcome,
      printLogIds,
      assignment: {
        ptaId: resolution.ptaId,
        scope: resolution.scope,
        printerName: resolution.ptaPrinterName,
        printerSource: resolution.printerSource,
        outputMode: resolution.ptaOutputMode,
      },
    };
  }

  // ─── The shared path ───────────────────────────────────────────────────

  /**
   * The context, with the accounting year filled in where the caller named none.
   *
   * `:acc_year` is a PARTITION key — `sales.sale_quotation` and its siblings are
   * partitioned by list on it — so a dataset that binds it and gets null reads
   * nothing, or is refused outright. Every screen printing today's document was
   * therefore made to send a year it could only have got from the row it was
   * already holding, which is asking a caller for something the server knows
   * better: `fiscal_years.fy_is_current` is the company's OWN answer, and it
   * outranks the calendar for a chain that has not yet rolled over.
   *
   * This only fills a BLANK; it never overrides. A reprint of last year's paper
   * still names last year, and that is the one case where the caller genuinely
   * knows something the session does not.
   */
  private async withCurrentAccYear(context: RenderContext): Promise<RenderContext> {
    const named = context.accYear?.trim();
    if (named && ACC_YEAR_PATTERN.test(named)) {
      return { ...context, accYear: named };
    }
    return {
      ...context,
      accYear: await this.printLog.currentAccYear(context.companyId, null),
    };
  }

  private async renderDefinition(input: {
    bundle: RevisionBundle;
    definition: TemplateDefinition;
    layoutMode: 'GRAPHIC' | 'GRID';
    context: RenderContext;
    params: Record<string, unknown>;
    requestedMode: OutputMode | undefined;
    copies: number;
    copyLabels: readonly string[];
    docType: string;
  }): Promise<RenderOutcome> {
    const { bundle, definition, layoutMode, context } = input;
    const outputMode = this.chooseRenderer(layoutMode, input.requestedMode);
    const renderer = this.renderers[outputMode];

    if (!renderer) {
      // chooseRenderer already refuses an unimplemented mode; this is the
      // compiler's proof, not a second check.
      throw new InternalServerErrorException(`No renderer registered for ${outputMode}`);
    }

    const params = this.resolveParams(bundle.version, input.params);

    const started = Date.now();
    const { data, resolved, warnings } = await this.runDatasets(bundle, context, params);

    const copies = Math.max(1, Math.min(input.copies, MAX_COPIES));
    const labels = this.labelsFor(copies, input.copyLabels);

    // Each copy is laid out SEPARATELY, because it is a different document: its
    // copy label is in scope, so a design that prints 'ORIGINAL FOR RECIPIENT'
    // renders different text, and its page numbering has to start again at one.
    const trees: LayoutTree[] = [];
    for (const [index, label] of labels.entries()) {
      trees.push(
        this.layout.render({
          definition,
          datasets: data,
          ctx: {
            ...params,
            companyId: context.companyId,
            branchId: context.branchId,
            accYear: context.accYear,
            docId: context.docId,
            docType: input.docType,
            userId: context.userId,
            deviceId: context.deviceId,
            lang: bundle.version.ptvLang,
            copyNo: index + 1,
            copyLabel: label,
            copies,
            params,
          },
          sys: {
            now: new Date().toISOString(),
            template: bundle.template.ptlName,
            templateCode: bundle.template.ptlCode,
            revNo: bundle.version.ptvRevNo,
          },
        }),
      );
    }

    const layoutMs = Date.now() - started;
    const merged = this.mergeTrees(trees);

    const renderStarted = Date.now();
    const rendered = await this.withTimeout(
      renderer.render(merged, {
        creationDate: new Date(),
        timeoutMs: RENDER_COPY_TIMEOUT_MS * copies,
      }),
      RENDER_TIMEOUT_MS,
      `${bundle.template.ptlCode} rev ${bundle.version.ptvRevNo}`,
    );

    const allWarnings: RenderWarning[] = [
      ...warnings,
      ...merged.warnings.map((warning) => ({ kind: warning.kind, message: warning.message })),
      ...rendered.warnings.map((message) => ({ kind: 'renderer', message })),
    ];

    if (allWarnings.length > 0) {
      // Logged rather than returned on the customer's copy: a design referencing
      // a missing field still prints, and the operator needs to know, but the
      // person at the counter does not.
      this.logger.warn(
        `Render of ${bundle.template.ptlCode} rev ${bundle.version.ptvRevNo} produced ` +
          `${allWarnings.length} warning(s): ${allWarnings
            .slice(0, 5)
            .map((warning) => warning.message)
            .join(' | ')}`,
      );
    }

    this.logger.log(
      `Rendered ${bundle.template.ptlCode} rev ${bundle.version.ptvRevNo} · ${outputMode} · ` +
        `${copies} cop${copies === 1 ? 'y' : 'ies'} · ${merged.pageCount}p · ` +
        `layout ${layoutMs}ms · render ${rendered.durationMs}ms · ` +
        `${(rendered.bytes.length / 1024).toFixed(0)}KB`,
    );

    return {
      bytes: rendered.bytes,
      contentType: rendered.contentType,
      extension: rendered.extension,
      outputMode,
      pageCount: merged.pageCount,
      pagesPerCopy: trees.map((tree) => tree.pageCount),
      copies,
      copyLabels: labels,
      templateId: bundle.template.ptlId,
      templateName: bundle.template.ptlName,
      versionId: bundle.version.ptvId,
      revNo: bundle.version.ptvRevNo,
      status: bundle.version.ptvStatus,
      engine: bundle.version.ptvEngine,
      paperCode: definition.paper.code,
      layoutMs,
      renderMs: Date.now() - renderStarted,
      detailRows: merged.stats.detailRows,
      datasets: resolved,
      warnings: allWarnings,
    };
  }

  // ─── Steps ─────────────────────────────────────────────────────────────

  /**
   * The purpose, which says what is being printed and how many copies it
   * normally carries.
   *
   * A shipped purpose (ppo_company_id NULL) is visible to every company; a
   * company's own fork of it is visible only to that company. Both readings are
   * deliberate — NULLS NOT DISTINCT on ux_ppo_code dedupes the shipped rows
   * against each other only, so a shipped SALE_INVOICE and a company's own
   * SALE_INVOICE coexist by design, which is what makes forking possible.
   */
  private async loadPurpose(
    purposeId: string,
    companyId: string,
  ): Promise<{ ppoSrcModule: string; ppoDocType: string; ppoAllowReprint: boolean }> {
    const purpose = await this.prisma.printPurpose.findFirst({
      where: {
        ppoId: purposeId,
        ppoIsDeleted: false,
        ppoIsActive: true,
        OR: [{ ppoCompanyId: null }, { ppoCompanyId: companyId }],
      },
      select: { ppoSrcModule: true, ppoDocType: true, ppoAllowReprint: true },
    });

    if (!purpose) {
      throwSettingsNotFound<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'Print purpose not found',
        'purposeId',
        `No active print purpose has id ${purposeId} for this company. A purpose is what makes ` +
          'a thing printable at all — 3.0 kept this list in C++ as a magic integer, and it is a ' +
          'table now.',
      );
    }

    return purpose;
  }

  private async loadVersion(versionId: string, companyId: string): Promise<RevisionBundle> {
    const version = await this.prisma.printTemplateVersion.findFirst({
      where: { ptvId: versionId, ptvIsDeleted: false },
      include: {
        template: true,
        datasets: {
          where: { ptdIsDeleted: false },
          orderBy: [{ ptdDatasetNo: 'asc' }],
        },
      },
    });

    if (!version) {
      throwSettingsNotFound<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'Revision not found',
        'versionId',
        `No undeleted print_template_version has id ${versionId}`,
      );
    }

    // A shipped design (ptl_company_id NULL) is visible to every company; one
    // that belongs to a company is visible only to it. Without this a version
    // id — which the caller supplies — would be a cross-tenant read of a
    // competitor's design and of every query inside it.
    const owner = version.template.ptlCompanyId;
    if (owner !== null && owner !== companyId) {
      throwSettingsNotFound<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'Revision not found',
        'versionId',
        `Revision ${versionId} belongs to another company`,
      );
    }

    return { template: version.template, version, datasets: version.datasets };
  }

  private build(bundle: RevisionBundle): {
    definition: TemplateDefinition;
    layoutMode: 'GRAPHIC' | 'GRID';
  } {
    try {
      const built = buildDefinition(bundle.version, bundle.datasets);
      return { definition: built.definition, layoutMode: built.layoutMode };
    } catch (error) {
      this.asBadRequest(error);
    }
  }

  /**
   * A body held in hand rather than one stored — the canvas's unsaved change.
   *
   * Refused against a PUBLISHED or RETIRED revision, and not as a formality: a
   * live revision is frozen precisely so that `print_log`'s reference to it
   * stays true, and a preview that showed something OTHER than what that
   * revision holds would put a picture in front of the operator that no
   * document will ever match. The way through is the same one the save path
   * offers — a version row with no ptvId becomes the next revision.
   */
  private buildFromUnsavedBody(
    bundle: RevisionBundle,
    body: Record<string, unknown>,
  ): { definition: TemplateDefinition; layoutMode: 'GRAPHIC' | 'GRID' } {
    if (bundle.version.ptvStatus !== 'DRAFT') {
      throwSettingsBadRequest<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        'A live revision can only be previewed as it stands',
        [
          {
            field: 'body',
            message:
              `Revision ${bundle.version.ptvRevNo} is ${bundle.version.ptvStatus}, so it is frozen ` +
              'and previewing a different body against it would show a design nothing will print. ' +
              'Save the change as a new revision (send a version row with no ptvId) and preview that.',
          },
        ],
      );
    }

    try {
      const built = buildDefinitionFromBody(bundle.version, bundle.datasets, body);
      return { definition: built.definition, layoutMode: built.layoutMode };
    } catch (error) {
      this.asBadRequest(error);
    }
  }

  private resolveParams(
    version: PrintTemplateVersion,
    supplied: Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      return resolveRenderParams(version.ptvParams, supplied);
    } catch (error) {
      this.asBadRequest(error);
    }
  }

  private async runDatasets(
    bundle: RevisionBundle,
    context: RenderContext,
    params: Record<string, unknown>,
  ): Promise<{
    data: Record<string, unknown>;
    resolved: readonly ResolvedDataset[];
    warnings: RenderWarning[];
  }> {
    try {
      const result = await this.datasetRunner.run({
        datasets: bundle.datasets,
        context,
        params,
        lang: bundle.version.ptvLang,
      });
      return { data: result.data, resolved: result.resolved, warnings: [...result.warnings] };
    } catch (error) {
      this.asBadRequest(error);
    }
  }

  // ─── Renderer choice ───────────────────────────────────────────────────

  private rendererForAssignment(assignmentMode: string): OutputMode | undefined {
    const mapped = RENDERER_FOR_OUTPUT_MODE[assignmentMode];
    return mapped === undefined || mapped === 'BY_LAYOUT' ? undefined : mapped;
  }

  /**
   * Which renderer draws this design.
   *
   * A GRID design in a PDF is not a degraded render, it is a wrong one: its
   * coordinates are character cells and the PDF renderer reads millimetres, so
   * the two are refused against each other rather than reinterpreted. That is
   * also why an explicit request can be turned down — asking for a PDF of a
   * thermal receipt is a question with no right answer, and quietly answering
   * the other one produces a page nobody can use.
   */
  private chooseRenderer(
    layoutMode: 'GRAPHIC' | 'GRID',
    requested: OutputMode | undefined,
  ): OutputMode {
    const mode = requested ?? RENDERER_FOR_LAYOUT_MODE[layoutMode];

    if (!IMPLEMENTED_RENDERERS.includes(mode)) {
      throwSettingsBadRequest<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        `There is no ${mode} renderer`,
        [
          {
            field: 'outputMode',
            message: `Available renderers: ${IMPLEMENTED_RENDERERS.join(', ')}.`,
          },
        ],
      );
    }

    if (LAYOUT_MODE_FOR_RENDERER[mode] !== layoutMode) {
      throwSettingsBadRequest<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        `A ${layoutMode} design cannot be rendered as ${mode}`,
        [
          {
            field: 'outputMode',
            message:
              layoutMode === 'GRID'
                ? `This revision's engine lays out in CHARACTER CELLS, and ${mode} draws in ` +
                  'millimetres. Render it as ESCPOS or ESCP_DOTMATRIX, or design it with a page ' +
                  'engine (JSON_BANDS) if it is meant for a sheet.'
                : `This revision's engine lays out in MILLIMETRES, and ${mode} draws on a ` +
                  'character grid. Render it as PDF, or design it with ESCPOS_TEXT if it is meant ' +
                  'for a roll.',
          },
        ],
      );
    }

    return mode;
  }

  // ─── Copies ────────────────────────────────────────────────────────────

  /**
   * What each copy says it is.
   *
   * The purpose supplies the labels ('ORIGINAL,DUPLICATE,TRIPLICATE'), and
   * running out of them is normal rather than an error — a fourth copy of a
   * three-label invoice is still a copy, and it prints with no label instead of
   * a wrong one. Deciding that the second print of a tax invoice is a DUPLICATE
   * is a rule about GST and lives here in the service layer, which is exactly
   * where §7 says it belongs.
   *
   * 'NA' is what the seed writes for a purpose with one copy, and it means "this
   * paper says nothing about which copy it is" — not that the copy is called NA.
   */
  private labelsFor(copies: number, labels: readonly string[]): string[] {
    const usable = labels.filter((label) => label && label.toUpperCase() !== 'NA');
    return Array.from({ length: copies }, (_unused, index) => usable[index] ?? '');
  }

  /**
   * The copies, as one stream.
   *
   * Merged as TREES rather than as bytes, so both renderers get the same
   * treatment from one code path: the PDF renderer draws the pages in sequence
   * into one document, and the grid renderers emit page after page with their
   * own form feed or cut between — which is what a thermal printer needs
   * between two receipts and what a PDF viewer needs to show three copies of an
   * invoice as one file.
   *
   * Each tree keeps its own page numbering, because it was laid out separately.
   * `pageCount` here is the sum, which is what the paper tray sees.
   */
  private mergeTrees(trees: readonly LayoutTree[]): LayoutTree {
    if (trees.length === 1) return trees[0];

    const pages = trees.flatMap((tree) => tree.pages);

    return {
      ...trees[0],
      pageCount: pages.length,
      // Re-indexed so a renderer that trusts `index` sees a contiguous document.
      // The expressions were already evaluated against the per-copy numbering,
      // so nothing a reader sees changes.
      pages: pages.map((page, index) => ({ ...page, index })),
      warnings: trees.flatMap((tree) => tree.warnings),
      stats: {
        detailRows: trees.reduce((sum, tree) => sum + tree.stats.detailRows, 0),
        bandsEmitted: trees.reduce((sum, tree) => sum + tree.stats.bandsEmitted, 0),
        durationMs: trees.reduce((sum, tree) => sum + tree.stats.durationMs, 0),
      },
    };
  }

  // ─── Failure ───────────────────────────────────────────────────────────

  /**
   * The module's own errors, as a 400 carrying the paths that failed.
   *
   * Every one of them names a place in the design or the request — `bands.3.
   * elements.7.value`, `datasets.items.ptdSql`, `params.from_date` — because
   * the person who has to fix a refused render is looking at a designer, and a
   * message with no path sends them to read the whole template.
   */
  private asBadRequest(error: unknown): never {
    if (
      error instanceof PrintRenderDefinitionError ||
      error instanceof DatasetRunError ||
      error instanceof RenderParamError
    ) {
      throwSettingsBadRequest<PrintRenderErrorDetail, PrintRenderErrorResponse>(
        error.message,
        error.details,
      );
    }
    throw error;
  }

  private async withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    const expiry = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new InternalServerErrorException(
              `Rendering ${label} exceeded the ${timeoutMs}ms limit and was abandoned.`,
            ),
          ),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([work, expiry]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
