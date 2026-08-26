import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Job } from 'bullmq';
import { OutputMode } from '../templates/dto/template-definition.schema';
import { REPORT_QUEUE_NAMES } from './print.constants';
import { ReportRenderService } from './report-render.service';

/**
 * Bulk render worker.
 *
 * ── Why bulk print is not an HTTP loop ──────────────────────────────────────
 * Risk R8. PDF rendering is CPU-bound and synchronous inside PDFKit: it does
 * not yield. Rendering a hundred invoices in a request handler blocks the Node
 * event loop for the whole run, and on a single-process 4 GB VPS that stalls
 * every other API call — the counter cannot bill while the office prints a
 * month's statements.
 *
 * So anything over one document goes through BullMQ, and the worker's
 * concurrency is capped deliberately low. Two concurrent PDF renders on a 4 GB
 * box is already generous; the cap is set on the queue registration rather than
 * here so it can be tuned per deployment.
 *
 * Results are written to disk, not returned through Redis. A hundred-page PDF
 * is tens of megabytes and BullMQ stores a job's return value in Redis — a
 * handful of those would evict everything else in the cache.
 */

export interface BulkPrintJobData {
  readonly docType: string;
  readonly docIds: readonly string[];
  readonly outputMode: OutputMode;
  readonly paperCode: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly accYear: string;
  readonly userId: string | null;
  readonly templateId?: string;
  readonly printerProfileCode?: string;
  readonly params?: Record<string, unknown>;
}

export interface BulkPrintDocumentResult {
  readonly docId: string;
  readonly ok: boolean;
  readonly file?: string;
  readonly bytes?: number;
  readonly pageCount?: number;
  readonly error?: string;
}

export interface BulkPrintResult {
  readonly jobId: string;
  readonly requested: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly outputDir: string;
  readonly documents: readonly BulkPrintDocumentResult[];
  readonly durationMs: number;
}

@Processor(REPORT_QUEUE_NAMES.BULK_PRINT)
export class BulkPrintProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkPrintProcessor.name);

  constructor(private readonly renderer: ReportRenderService) {
    super();
  }

  async process(job: Job<BulkPrintJobData>): Promise<BulkPrintResult> {
    const startedAt = Date.now();
    const { docIds, docType, outputMode } = job.data;
    const jobId = String(job.id ?? 'unknown');

    const outputDir = join(resolveBulkOutputRoot(), jobId);
    await mkdir(outputDir, { recursive: true });

    this.logger.log(
      `Bulk print ${jobId}: ${docIds.length} ${docType} document(s) as ${outputMode} -> ${outputDir}`,
    );

    const documents: BulkPrintDocumentResult[] = [];

    // Strictly SEQUENTIAL. The queue's own concurrency setting decides how many
    // jobs run at once; rendering a job's documents in parallel on top of that
    // would multiply the two and defeat the cap entirely.
    for (const [index, docId] of docIds.entries()) {
      try {
        const rendered = await this.renderer.render({
          docType,
          docId,
          outputMode,
          paperCode: job.data.paperCode,
          companyId: job.data.companyId,
          branchId: job.data.branchId,
          accYear: job.data.accYear,
          userId: job.data.userId,
          templateId: job.data.templateId,
          printerProfileCode: job.data.printerProfileCode,
          params: job.data.params,
        });

        const fileName = `${String(index + 1).padStart(4, '0')}-${sanitise(docId)}.${rendered.extension}`;
        const filePath = join(outputDir, fileName);
        await writeFile(filePath, rendered.bytes);

        documents.push({
          docId,
          ok: true,
          file: filePath,
          bytes: rendered.bytes.length,
          pageCount: rendered.pageCount,
        });
      } catch (error) {
        // One bad document must not fail the batch. A month-end run of two
        // hundred statements where invoice 47 references a deleted party should
        // deliver 199 statements and a named failure, not nothing.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Bulk print ${jobId}: ${docType}/${docId} failed — ${message}`);
        documents.push({ docId, ok: false, error: message });
      }

      await job.updateProgress(Math.round(((index + 1) / docIds.length) * 100));
    }

    const succeeded = documents.filter((document) => document.ok).length;
    const result: BulkPrintResult = {
      jobId,
      requested: docIds.length,
      succeeded,
      failed: documents.length - succeeded,
      outputDir,
      documents,
      durationMs: Date.now() - startedAt,
    };

    this.logger.log(
      `Bulk print ${jobId} finished: ${succeeded}/${docIds.length} in ${result.durationMs}ms`,
    );

    return result;
  }
}

/**
 * Where rendered batches land.
 *
 * Outside the application directory by default, because these are large,
 * transient and must not end up in a deployment artefact or a git status. An
 * operator sets REPORT_BULK_OUTPUT_DIR to point at a volume with room.
 */
const resolveBulkOutputRoot = (): string => {
  const configured = process.env.REPORT_BULK_OUTPUT_DIR?.trim();
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  return resolve(process.cwd(), 'artifacts/bulk-print');
};

/** Make a document id safe as a path segment. */
const sanitise = (value: string): string => value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
