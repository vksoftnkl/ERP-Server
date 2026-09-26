import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ACC_YEAR_PATTERN, PlgOutputMode, PlgStatus } from './print-render.constants';

/**
 * §7 — every render, one row per COPY, immutable.
 *
 * ── WHY A ROW PER COPY AND NOT PER RENDER ──────────────────────────────────
 *
 * Because that is what was printed. A tax invoice goes out as ORIGINAL,
 * DUPLICATE and TRIPLICATE, and `plg_copy_label` "records what was printed on
 * the paper". A single row saying "3 copies" cannot answer the only question
 * anybody asks of this table — which copy went where, and was the duplicate
 * ever issued.
 *
 * ── A REPRINT IS NOT A STATUS TRANSITION ───────────────────────────────────
 *
 * This table IS the record of printing. `sale_bill.sb_print_count` and its
 * siblings stay a denormalised cache of `COUNT(*)` over it, never the truth,
 * and nothing here writes them.
 *
 * ── IMMUTABLE MEANS IMMUTABLE ──────────────────────────────────────────────
 *
 * There is no update and no delete in this file, and the model has no
 * `_is_deleted`, no `_modified_on` and no `_sync_date` to support one. Correcting
 * the record means appending to it.
 *
 * ── WHY A FAILED LOG DOES NOT FAIL A PRINT ─────────────────────────────────
 *
 * The paper is already out of the printer by the time this runs. Throwing here
 * would turn a successful print into a 500, the operator would print again, and
 * the table this exists to keep honest would end up with two renders logged as
 * one — or with none, and a customer holding an invoice the system denies
 * issuing. So every failure here is logged loudly and swallowed, and the
 * missing-partition case, which is the one that actually happens, is repaired
 * and retried rather than reported.
 */

export interface PrintLogEntry {
  /** The RENDER's accounting year — the partition this row lands in. */
  accYear: string;
  companyId: string;
  branchId: string | null;
  deviceId: string | null;
  srcModule: string;
  srcDocType: string;
  srcDocId: string | null;
  /** The DOCUMENT's year. A reprint of last year's bill is logged this year. */
  srcAccYear: string | null;
  purposeId: string;
  templateId: string;
  versionId: string;
  printerId: string | null;
  outputMode: PlgOutputMode;
  copyNo: number;
  copyLabel: string | null;
  lang: string | null;
  /** The answers to ptv_params — ONE object for the whole render. */
  params: Record<string, unknown> | null;
  status: PlgStatus;
  error: string | null;
  pageCount: number | null;
  byteCount: number | null;
  durationMs: number | null;
  printedBy: string | null;
}

@Injectable()
export class PrintLogService {
  private readonly logger = new Logger(PrintLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The accounting year the RENDER happened in.
   *
   * `fiscal_years.fy_is_current` is the company's own answer and outranks the
   * calendar: a chain that has not yet rolled over is still working in the old
   * year, and its prints belong in that partition with its documents.
   *
   * The April–March fallback is for the render that happens before anyone has
   * marked a current year — a fresh install's first print — and is the Indian
   * financial year, which is what every other date rule in this system assumes.
   */
  async currentAccYear(companyId: string, fallback: string | null): Promise<string> {
    try {
      const current = await this.prisma.fiscalYear.findFirst({
        where: { compId: companyId, fyIsCurrent: true, isDeleted: false },
        select: { fyYearName: true },
      });
      if (current?.fyYearName && ACC_YEAR_PATTERN.test(current.fyYearName.trim())) {
        return current.fyYearName.trim();
      }
    } catch (error) {
      this.logger.warn(
        `Could not read the current fiscal year for company ${companyId}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (fallback && ACC_YEAR_PATTERN.test(fallback)) return fallback;

    const now = new Date();
    // April starts the year: before April the year began in the PREVIOUS
    // calendar year.
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }

  /** One row per copy, written together. Returns the ids, or [] if it could not. */
  async record(entries: readonly PrintLogEntry[]): Promise<string[]> {
    if (entries.length === 0) return [];

    try {
      return await this.insert(entries);
    } catch (error) {
      if (this.isMissingPartition(error)) {
        const accYear = entries[0].accYear;
        this.logger.warn(
          `public.print_log has no partition for ${accYear} — creating it and retrying. ` +
            'A new accounting year needs fn_create_printing_partitions before its first print.',
        );
        try {
          await this.createPartition(accYear);
          return await this.insert(entries);
        } catch (retryError) {
          this.reportSwallowed(entries, retryError);
          return [];
        }
      }

      this.reportSwallowed(entries, error);
      return [];
    }
  }

  private async insert(entries: readonly PrintLogEntry[]): Promise<string[]> {
    const written = await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.printLog.create({
          data: {
            plgAccYear: entry.accYear,
            plgCompanyId: entry.companyId,
            plgBranchId: entry.branchId,
            plgDeviceId: entry.deviceId,
            plgSrcModule: entry.srcModule,
            plgSrcDocType: entry.srcDocType,
            plgSrcDocId: entry.srcDocId,
            plgSrcAccYear: entry.srcAccYear,
            plgPurposeId: entry.purposeId,
            plgTemplateId: entry.templateId,
            // The point of the whole versioning design: a real FK to the exact
            // bytes that were rendered, so "what did this bill look like" is
            // enforced rather than snapshotted and hoped for.
            plgVersionId: entry.versionId,
            plgPrinterId: entry.printerId,
            plgOutputMode: entry.outputMode,
            plgCopyNo: entry.copyNo,
            plgCopyLabel: entry.copyLabel,
            plgLang: entry.lang,
            plgParams: (entry.params ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            plgStatus: entry.status,
            plgError: entry.error,
            plgPageCount: entry.pageCount,
            plgByteCount: entry.byteCount,
            plgDurationMs: entry.durationMs,
            plgPrintedBy: entry.printedBy,
          },
          select: { plgId: true },
        }),
      ),
    );

    return written.map((row) => row.plgId);
  }

  private async createPartition(accYear: string): Promise<void> {
    if (!ACC_YEAR_PATTERN.test(accYear)) {
      throw new Error(`'${accYear}' is not an accounting year, so no partition can be made for it`);
    }
    // The function is what §0 provides for exactly this, and it validates the
    // year's shape again on its own side.
    await this.prisma
      .$executeRaw`SELECT public.fn_create_printing_partitions(${accYear}::character(9))`;
  }

  private isMissingPartition(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /no partition of relation .*print_log.* found/i.test(message);
  }

  /**
   * A swallowed failure, said out loud.
   *
   * The message carries what the row WOULD have said, because the alternative
   * to a log line here is no record of the print anywhere at all.
   */
  private reportSwallowed(entries: readonly PrintLogEntry[], error: unknown): void {
    const first = entries[0];
    this.logger.error(
      `print_log could not be written for ${entries.length} copy/copies of ` +
        `${first.srcModule}/${first.srcDocType}/${first.srcDocId ?? '-'} ` +
        `(version ${first.versionId}, ${first.outputMode}): ` +
        `${error instanceof Error ? error.message : String(error)}. ` +
        'The render itself succeeded and the paper is out; this is a hole in the print history, ' +
        'not a failed print.',
      error instanceof Error ? error.stack : undefined,
    );
  }
}
