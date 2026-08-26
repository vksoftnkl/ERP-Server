import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OutputMode, TemplateDefinition } from '../templates/dto/template-definition.schema';
import { LayoutEngine } from '../engine/layout/layout.engine';
import { EscPRenderer } from '../engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from '../engine/renderers/grid/escpos.renderer';
import { PdfKitRenderer } from '../engine/renderers/pdfkit.renderer';
import { IRenderer, PrinterCommandProfile, RenderResult } from '../engine/renderers/renderer.types';
import { ReportContext, ReportRow } from '../providers/report-data-provider.types';
import { ReportDataProviderRegistry } from '../providers/report-data-provider.registry';
import { PrinterProfileService } from './printer-profile.service';
import { TemplatesService } from '../templates/templates.service';

/**
 * Renders one document: resolve template, resolve data, lay out, render.
 *
 * The single place those four steps are sequenced, so an HTTP request, a
 * designer preview and a BullMQ bulk job all produce identical bytes. A second
 * copy of this sequence anywhere else is how a preview starts disagreeing with
 * the print.
 */

export interface RenderRequest {
  readonly docType: string;
  readonly docId: string;
  readonly outputMode: OutputMode;
  readonly paperCode: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly accYear: string;
  readonly userId: string | null;
  readonly templateId?: string;
  readonly printerProfileCode?: string;
  /** Extra parameters handed to every provider, e.g. partyId for a statement. */
  readonly params?: Record<string, unknown>;
}

export interface RenderOutcome extends RenderResult {
  readonly templateId: string;
  readonly templateName: string;
  readonly templateVersion: number;
  readonly templateSource: string;
  readonly layoutMs: number;
  readonly detailRows: number;
}

/** Hard cap per render. Beyond this the request is failing, not slow. */
const DEFAULT_TIMEOUT_MS = 15_000;

@Injectable()
export class ReportRenderService {
  private readonly logger = new Logger(ReportRenderService.name);

  private readonly renderers: Readonly<Record<string, IRenderer>>;

  constructor(
    private readonly templates: TemplatesService,
    private readonly providers: ReportDataProviderRegistry,
    private readonly layout: LayoutEngine,
    private readonly printerProfiles: PrinterProfileService,
    pdf: PdfKitRenderer,
    escp: EscPRenderer,
    escpos: EscPosRenderer,
  ) {
    this.renderers = {
      PDF: pdf,
      ESCP_DOTMATRIX: escp,
      ESCPOS: escpos,
    };
  }

  /**
   * Render a real document.
   *
   * The timeout is a wall-clock race rather than a cooperative cancel. Neither
   * PDFKit nor the layout engine is interruptible, so a pathological template
   * cannot be stopped mid-flight — but the REQUEST can be released, which is
   * what keeps a counter queue from stalling behind one bad design.
   */
  async render(request: RenderRequest): Promise<RenderOutcome> {
    const template = await this.templates.resolveForPrint({
      docType: request.docType,
      outputMode: request.outputMode,
      paperCode: request.paperCode,
      companyId: request.companyId,
      branchId: request.branchId,
      templateId: request.templateId,
    });

    const context: ReportContext = {
      companyId: request.companyId,
      branchId: request.branchId,
      accYear: request.accYear,
      docId: request.docId,
      userId: request.userId,
      params: request.params,
    };

    const datasets = await this.resolveDatasets(template.definition, context);
    const profile = await this.resolveProfile(request);

    return this.layoutAndRender(template, datasets, context, profile, request);
  }

  /**
   * Render an UNSAVED definition against sample data — the designer preview.
   *
   * Sample data comes from the providers, so a preview shows exactly what a
   * real render will show, with no database access at all. That last part is
   * what lets the designer be used against a production tenant safely.
   */
  async preview(
    rawDefinition: Record<string, unknown>,
    options: {
      outputMode?: OutputMode;
      companyId: string;
      branchId: string | null;
      accYear: string;
      userId: string | null;
      docId?: string;
      useSampleData?: boolean;
      params?: Record<string, unknown>;
      printerProfileCode?: string;
    },
  ): Promise<RenderOutcome> {
    const definition = this.templates.validateDefinition(rawDefinition, {
      outputMode: options.outputMode,
    });

    const outputMode: OutputMode =
      options.outputMode ?? (definition.layoutMode === 'GRID' ? 'ESCPOS' : 'PDF');

    const context: ReportContext = {
      companyId: options.companyId,
      branchId: options.branchId,
      accYear: options.accYear,
      docId: options.docId ?? '',
      userId: options.userId,
      params: options.params,
    };

    const useSample = options.useSampleData ?? !options.docId;
    const datasets = useSample
      ? this.sampleDatasets(definition)
      : await this.resolveDatasets(definition, context);

    const profile = options.printerProfileCode
      ? await this.printerProfiles.findByCode(options.printerProfileCode, options.companyId)
      : await this.printerProfiles.findDefault(outputMode, options.companyId);

    return this.layoutAndRender(
      {
        ptId: 'preview',
        name: 'preview',
        version: 0,
        outputMode,
        paperCode: definition.paper.code,
        definition,
        source: 'EXPLICIT',
      },
      datasets,
      context,
      profile,
      { outputMode, docType: 'PREVIEW', docId: context.docId },
    );
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private async layoutAndRender(
    template: {
      ptId: string;
      name: string;
      version: number;
      outputMode: string;
      paperCode: string;
      definition: TemplateDefinition;
      source: string;
    },
    datasets: Record<string, unknown>,
    context: ReportContext,
    profile: PrinterCommandProfile | null,
    request: { outputMode: OutputMode; docType: string; docId: string },
  ): Promise<RenderOutcome> {
    const renderer = this.renderers[request.outputMode];
    if (!renderer) {
      throw new NotFoundException(
        `No renderer for output mode ${request.outputMode}. ` +
          `Available: ${Object.keys(this.renderers).join(', ')}`,
      );
    }

    const tree = this.layout.render({
      definition: template.definition,
      datasets,
      ctx: {
        companyId: context.companyId,
        branchId: context.branchId,
        accYear: context.accYear,
        docId: context.docId,
        userId: context.userId,
        docType: request.docType,
        ...(context.params ?? {}),
      },
      sys: { now: new Date().toISOString() },
    });

    const rendered = await this.withTimeout(
      renderer.render(tree, {
        printerProfile: profile,
        creationDate: new Date(),
        timeoutMs: DEFAULT_TIMEOUT_MS,
      }),
      DEFAULT_TIMEOUT_MS,
      `${request.docType}/${request.docId}`,
    );

    // Warnings are logged rather than returned to the customer's copy: a
    // template referencing a missing field still prints, and the operator needs
    // to know, but the person at the counter does not.
    if (rendered.warnings.length > 0) {
      this.logger.warn(
        `Render of ${request.docType}/${request.docId} via template ${template.ptId} ` +
          `produced ${rendered.warnings.length} warning(s): ${rendered.warnings.slice(0, 5).join(' | ')}`,
      );
    }

    this.logger.log(
      `Rendered ${request.docType}/${request.docId} · template ${template.name} v${template.version} ` +
        `(${template.source}) · ${request.outputMode} · ${rendered.pageCount}p · ` +
        `layout ${tree.stats.durationMs}ms · render ${rendered.durationMs}ms · ` +
        `${(rendered.bytes.length / 1024).toFixed(0)}KB`,
    );

    return {
      ...rendered,
      templateId: template.ptId,
      templateName: template.name,
      templateVersion: template.version,
      templateSource: template.source,
      layoutMs: tree.stats.durationMs,
      detailRows: tree.stats.detailRows,
    };
  }

  /**
   * Resolve every dataset the definition declares.
   *
   * Providers run CONCURRENTLY. They are independent reads against a connection
   * pool, and an invoice with five datasets would otherwise pay five sequential
   * round-trips before layout even starts.
   */
  private async resolveDatasets(
    definition: TemplateDefinition,
    context: ReportContext,
  ): Promise<Record<string, unknown>> {
    const resolved = await Promise.all(
      definition.datasets.map(async (dataset) => {
        const provider = this.providers.get(dataset.provider);
        const rows = await provider.resolve({
          ...context,
          params: { ...(context.params ?? {}), ...(dataset.params ?? {}) },
        });
        return [dataset.name, this.coerceCardinality(rows, dataset.cardinality)] as const;
      }),
    );

    return Object.fromEntries(resolved);
  }

  private sampleDatasets(definition: TemplateDefinition): Record<string, unknown> {
    const entries = definition.datasets.map((dataset) => {
      const rows = this.providers.sample(dataset.provider);
      return [dataset.name, this.coerceCardinality(rows, dataset.cardinality)] as const;
    });
    return Object.fromEntries(entries);
  }

  /**
   * Make the resolved value match its declared cardinality.
   *
   * A `one` dataset bound to an array would make `{{ invoice.billNo }}` resolve
   * to undefined and print blank — the most confusing possible failure, because
   * the data is right there. Taking the first row is the only useful reading.
   */
  private coerceCardinality(rows: ReportRow[] | ReportRow, cardinality: 'one' | 'many'): unknown {
    if (cardinality === 'one') {
      return Array.isArray(rows) ? (rows[0] ?? {}) : rows;
    }
    return Array.isArray(rows) ? rows : [rows];
  }

  private async resolveProfile(request: RenderRequest): Promise<PrinterCommandProfile | null> {
    if (request.outputMode === 'PDF' || request.outputMode === 'HTML') {
      return null;
    }
    if (request.printerProfileCode) {
      return this.printerProfiles.findByCode(request.printerProfileCode, request.companyId);
    }
    return this.printerProfiles.findDefault(request.outputMode, request.companyId);
  }

  private async withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_resolve, reject) => {
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
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
