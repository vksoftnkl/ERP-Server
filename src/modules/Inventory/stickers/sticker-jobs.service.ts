import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { assertMenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
  appendTxnStatusLog,
} from 'src/common/txn-status-log/txn-status-log.helper';
import {
  isUniqueConstraintError,
  violatedConstraintOf,
} from 'src/common/utils/module-shared.utils';
import {
  LabelRenderOutcome,
  LabelRunRow,
  PrintRenderService,
} from '../../settings/print-render/print-render.service';
import { TemplateDefinition } from '../../settings/print-render/definition/template-definition.schema';
import { dotsToMm } from '../../settings/print-render/engine/label/bar-snap';
import { resolveDeviceCode } from '../../stocks/stock-voucher/stock-voucher-numbering.helper';
import {
  DesignRow,
  StickerLineInput,
  StickerLinesService,
  StickerScope,
} from './sticker-lines.service';
import { LabelShop, labelRow } from './sticker-label-row';
import { refuseSticker, throwRefusal } from './sticker.errors';
import {
  LabelsMode,
  PRINT_ASSIGNMENTS_MENU_ID,
  STICKER_MAX_LABELS_PER_JOB,
  STICKER_MAX_LABELS_PER_LINE,
  STICKER_MAX_LINES,
  asReprintReason,
  dayToDate,
  isoDay,
  istDateTimeText,
  jobRefno,
  labelsFromStock,
  money,
  money2,
  reasonText,
  sizeText,
} from './sticker.rules';
import {
  PRINT_ASSIGN_RIGHT_PREFIX,
  STICKER_ERROR,
  STOCK_DEVICE_NOT_FOUND,
} from './types/sticker-error-codes';
import {
  BuiltStickerLine,
  FrozenStickerLine,
  StickerAssignment,
  StickerJobInspect,
  StickerLine,
} from './types/sticker.types';

/**
 * Sticker jobs (plan S-P1 §4.7 / §4.8 / §5 / §7.2): print, status, reprint,
 * resend, get, preview and Test print.
 *
 * A job is ONE design group of one Print run. The server re-resolves every
 * line (StickerLinesService), freezes what it resolved on the job, renders
 * through the ONE label path (PrintRenderService.renderLabels) and numbers the
 * job per COUNTER (`D8-000127`, restarting each financial year). Render and
 * insert share one transaction, so a render that fails leaves no job and no
 * number (decision 27); the PDF goes back only after the commit.
 *
 * Nothing on a job is edited afterwards except its one status step (SENT →
 * PRINTED / FAILED, sent by the counter that printed it), which
 * txn_status_log records. A reprint (with a reason) and a resend of a failed
 * job are NEW jobs that copy the frozen figures and the frozen design revision.
 * Sticker jobs write no print_log (decision 25) and no audit revision (§5).
 */

export interface StickerPdfAnswer {
  outcome: LabelRenderOutcome;
  inspect: StickerJobInspect;
}

interface JobRow {
  lbj_id: string;
  lbj_acc_year: string;
  lbj_company_id: string;
  lbj_branch_id: string;
  lbj_device_id: string;
  lbj_refno: string;
  lbj_purpose_id: string;
  lbj_template_id: string;
  lbj_version_id: string;
  lbj_printer_name: string;
  lbj_printer_dpi: number | null;
  lbj_price_level: number;
  lbj_start_at: number;
  lbj_kind: string;
  lbj_reprint_of_id: string | null;
  lbj_reprint_of_acc_year: string | null;
  lbj_resend_of_id: string | null;
  lbj_resend_of_acc_year: string | null;
  lbj_reason_code: string | null;
  lbj_reason_note: string | null;
  lbj_line_count: number;
  lbj_label_count: number;
  lbj_page_count: number | null;
  lbj_status: string;
  lbj_status_on: Date | null;
  lbj_printer_message: string | null;
  lbj_printed_on: Date;
  lbj_printed_by: string;
}

interface JobLineRow {
  lbjl_id: string;
  lbjl_line_no: number;
  lbjl_item_id: string;
  lbjl_unit_id: string;
  lbjl_lot_id: string | null;
  lbjl_barcode: string | null;
  lbjl_mrp: Prisma.Decimal | null;
  lbjl_price: Prisma.Decimal | null;
  lbjl_batch_no: string | null;
  lbjl_mfg_date: string | null;
  lbjl_expiry_date: string | null;
  lbjl_cost_code: string | null;
  lbjl_price_code: string | null;
  lbjl_labels: number;
  lbjl_reprint_of_line_id: string | null;
  item_name: string | null;
  item_name_ta: string | null;
  item_code: string | null;
  brand: string | null;
  group_name: string | null;
  unit_name: string | null;
  size: string | null;
  colour: string | null;
  model: string | null;
  reprinted: number;
}

/** What a new job is made of, before its number. */
interface JobDraft {
  companyId: string;
  branchId: string;
  deviceId: string;
  accYear: string;
  purposeId: string;
  templateId: string;
  versionId: string;
  printerName: string;
  printerDpi: number | null;
  priceLevel: number;
  startAt: number;
  kind: 'PRINT' | 'REPRINT';
  reprintOf: { id: string; accYear: string } | null;
  resendOf: { id: string; accYear: string } | null;
  reasonCode: string | null;
  reasonNote: string | null;
  lines: FrozenStickerLine[];
  /** The label row of each line, given the job's number and time. */
  rowsFor: (job: { jobNo: string; printedOn: Date }) => Record<string, unknown>[];
  /**
   * A last check inside the job's transaction, after the counter's number lock
   * and before the number is taken (resend: no other resend of the job may be
   * SENT or PRINTED by now — SF1). Refuses by throwing.
   */
  guard?: (tx: Prisma.TransactionClient) => Promise<void>;
}

/** A resend of a failed job that already went out (SENT) or printed. */
interface ResendRow {
  refno: string;
  status: string;
  /** The counter that sent it (only it may mark it, STICKER_JOB_OTHER_COUNTER). */
  device_code?: string | null;
}

/** A job that reprinted lines of the job /jobs/get shows: a REPRINT, or a resend of one. */
interface ReprintRow {
  lbj_id: string;
  lbj_acc_year: string;
  lbj_refno: string;
  lbj_kind: string;
  lbj_printed_on: Date;
  lbj_status: string;
  lbj_reason_code: string | null;
  lbj_reason_note: string | null;
  lbj_resend_of_id: string | null;
  resend_of_no: string | null;
  why_code: string | null;
  why_note: string | null;
  labels: number;
}

/** One interactive transaction may hold a 5,000-label render (R4). */
const JOB_TX_OPTIONS = { timeout: 180_000, maxWait: 15_000 } as const;

const LABEL_SIZE_TEXT_DEFAULT = '';

@Injectable()
export class StickerJobsService {
  private readonly logger = new Logger(StickerJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly lines: StickerLinesService,
    private readonly render: PrintRenderService,
  ) {}

  // ═══ Lines routes ═════════════════════════════════════════════════════════

  /** GET /stickers/lines/from-items — Add items · F3 (§4.6, decision 37). */
  async fromItems(q: {
    companyId: string;
    branchId: string;
    purposeCode: string;
    priceLevel: number;
    groupId?: string;
    brandId?: string;
    supplierId?: string;
    name?: string;
    stickerOnly?: boolean;
    labelsMode?: string;
    labelsEach?: number;
  }): Promise<{
    lines: StickerLine[];
    skipped: { noStock: number };
    assignment: StickerAssignment;
  }> {
    await this.lines.assertRight('view');
    const scope = await this.lines.scopeFor(q);
    const mode = (q.labelsMode ?? 'ONE').toUpperCase() as LabelsMode;
    if (
      mode === 'TYPED' &&
      !(
        Number.isInteger(q.labelsEach) &&
        (q.labelsEach as number) >= 1 &&
        (q.labelsEach as number) <= STICKER_MAX_LABELS_PER_LINE
      )
    ) {
      refuseSticker(
        STICKER_ERROR.LABELS_INVALID,
        `labelsEach must be 1 to ${STICKER_MAX_LABELS_PER_LINE} for TYPED, got ${q.labelsEach ?? 'nothing'}`,
        'labelsEach',
      );
    }
    const itemIds = await this.lines.itemIdsFor({
      companyId: q.companyId,
      groupId: q.groupId ?? null,
      brandId: q.brandId ?? null,
      supplierId: q.supplierId ?? null,
      name: q.name ?? null,
      stickerOnly: q.stickerOnly ?? true,
      limit: STICKER_MAX_LINES + 1,
    });
    if (itemIds.length > STICKER_MAX_LINES) {
      refuseSticker(
        STICKER_ERROR.TOO_MANY_ITEMS,
        `The filters pick more than ${STICKER_MAX_LINES} items; narrow them`,
        'groupId',
      );
    }
    const built = await this.lines.buildLines(
      scope,
      itemIds.map((itemId, index) => ({
        key: String(index + 1),
        itemId,
        labels: mode === 'TYPED' ? (q.labelsEach as number) : 1,
      })),
    );
    let noStock = 0;
    const lines: StickerLine[] = [];
    for (const entry of built) {
      if (mode === 'STOCK') {
        const labels = labelsFromStock(entry.line.stockQty, entry.facts.unitHasDecimals);
        if (labels === 0) {
          noStock += 1;
          continue;
        }
        entry.line.labels = labels;
      }
      lines.push(entry.line);
    }
    return { lines, skipped: { noStock }, assignment: scope.assignment };
  }

  /** POST /stickers/lines/resolve — scan / type, and every re-resolve of the list. */
  async resolve(body: {
    companyId: string;
    branchId: string;
    purposeCode: string;
    priceLevel: number;
    lines: StickerLineInput[];
  }): Promise<{ lines: StickerLine[]; assignment: StickerAssignment }> {
    await this.lines.assertRight('view');
    const scope = await this.lines.scopeFor(body);
    if (body.lines.length > STICKER_MAX_LINES) {
      refuseSticker(
        STICKER_ERROR.TOO_MANY_ITEMS,
        `One list takes at most ${STICKER_MAX_LINES} lines, got ${body.lines.length}`,
        'lines',
      );
    }
    const built = await this.lines.buildLines(scope, body.lines);
    return { lines: built.map((entry) => entry.line), assignment: scope.assignment };
  }

  // ═══ Preview (one label, nothing logged) ═════════════════════════════════

  async preview(body: {
    companyId: string;
    branchId: string;
    templateId: string;
    priceLevel: number;
    line: { itemId: string; unitId: string; lotId?: string | null };
    printerDpi?: number | null;
  }): Promise<LabelRenderOutcome> {
    await this.lines.assertRight('view');
    await this.lines.assertBranchInCompany(body.companyId, body.branchId);
    const design = await this.designFor(body.companyId, body.templateId, null);
    const scope = await this.jobScope(body.companyId, body.branchId, design, body.priceLevel);
    const [built] = await this.lines.buildLines(scope, [
      {
        key: '1',
        itemId: body.line.itemId,
        unitId: body.line.unitId,
        lotId: body.line.lotId ?? null,
      },
    ]);
    // The item / unit / lot refusals are the preview's too; a missing lot or
    // barcode is not — the preview shows what the label would look like.
    if (built.refusal && this.isLineIdentityRefusal(built.refusal.code)) {
      throwRefusal(built.refusal);
    }
    const shop = await this.loadShop(body.companyId, body.branchId);
    return this.render.renderLabels({
      versionId: design.ptv_id as string,
      context: this.renderContext(body.companyId, body.branchId),
      rows: [
        {
          row: labelRow(this.labelInput(built), shop, { jobNo: null, printedOn: new Date() }),
          labels: 1,
        },
      ],
      printDpi: body.printerDpi ?? null,
      singleLabel: true,
    });
  }

  // ═══ Print (§7.2 order) ═══════════════════════════════════════════════════

  async print(body: {
    companyId: string;
    branchId: string;
    purposeCode: string;
    templateId?: string | null;
    printerName?: string | null;
    printerDpi?: number | null;
    startAt?: number | null;
    priceLevel: number;
    lines: Array<{ itemId: string; unitId: string; lotId?: string | null; labels: number }>;
  }): Promise<StickerPdfAnswer> {
    await this.lines.assertRight('print');
    await this.lines.assertBranchInCompany(body.companyId, body.branchId);
    const purpose = await this.lines.loadPurpose(body.companyId, body.purposeCode);
    if (!body.templateId) {
      refuseSticker(STICKER_ERROR.NO_DESIGN, 'The job names no design (templateId)', 'templateId');
    }
    const design = await this.designFor(body.companyId, body.templateId, purpose.ppoCode);
    const printerName = this.requirePrinter(body.printerName);
    const deviceId = await this.requireDevice();
    if (body.lines.length === 0) {
      refuseSticker(STICKER_ERROR.NOTHING_TO_PRINT, 'The job has no lines', 'lines');
    }
    if (body.lines.length > STICKER_MAX_LINES) {
      refuseSticker(
        STICKER_ERROR.TOO_MANY_ITEMS,
        `One job takes at most ${STICKER_MAX_LINES} lines, got ${body.lines.length}`,
        'lines',
      );
    }

    const scope: StickerScope = {
      ...(await this.jobScope(body.companyId, body.branchId, design, body.priceLevel)),
      purpose,
    };
    const built = await this.lines.buildLines(
      scope,
      body.lines.map((line, index) => ({
        key: String(index + 1),
        itemId: line.itemId,
        unitId: line.unitId,
        lotId: line.lotId ?? null,
        labels: line.labels,
      })),
    );
    built.forEach((entry, index) => {
      const lineNo = index + 1;
      if (entry.refusal) {
        throwRefusal(entry.refusal, { line: lineNo });
      }
      if (entry.line.lotRequired) {
        refuseSticker(
          STICKER_ERROR.LOT_REQUIRED,
          `Line ${lineNo} (${entry.line.itemName}): the stock here has more than one MRP — pick the lot`,
          'lotId',
          { line: lineNo },
        );
      }
      if (entry.line.designHasBarcode && !entry.line.barcode) {
        refuseSticker(
          STICKER_ERROR.LINE_NO_BARCODE,
          `Line ${lineNo} (${entry.line.itemName}) has no barcode and ${design.ptl_name} prints one`,
          'barcode',
          { line: lineNo },
        );
      }
    });
    this.assertLabelTotal(built.reduce((total, entry) => total + entry.line.labels, 0));

    const shop = await this.loadShop(body.companyId, body.branchId);
    const frozen = built.map((entry, index) => this.freeze(entry, index + 1));
    return this.makeJob({
      companyId: body.companyId,
      branchId: body.branchId,
      deviceId,
      accYear: await this.currentAccYear(body.companyId),
      purposeId: purpose.ppoId,
      templateId: design.ptl_id,
      versionId: design.ptv_id as string,
      printerName,
      printerDpi: body.printerDpi ?? null,
      priceLevel: body.priceLevel,
      startAt: body.startAt ?? 1,
      kind: 'PRINT',
      reprintOf: null,
      resendOf: null,
      reasonCode: null,
      reasonNote: null,
      lines: frozen,
      rowsFor: (job) => built.map((entry) => labelRow(this.labelInput(entry), shop, job)),
    });
  }

  // ═══ Status (the counter that printed reports back) ══════════════════════

  async status(body: {
    companyId: string;
    branchId: string;
    accYear: string;
    jobId: string;
    status: 'PRINTED' | 'FAILED';
    printerMessage?: string | null;
  }): Promise<{ jobId: string; jobNo: string; status: string; statusOn: string | null }> {
    await this.lines.assertRight('print');
    await this.lines.assertBranchInCompany(body.companyId, body.branchId);
    const job = await this.findJob(body.companyId, body.branchId, body.accYear, body.jobId);
    if (job.lbj_status !== 'SENT') {
      refuseSticker(
        STICKER_ERROR.JOB_STATUS_SET,
        `Job ${job.lbj_refno} is already ${job.lbj_status}`,
        'status',
      );
    }
    const deviceId = this.requestContext.getDeviceId();
    if (deviceId !== job.lbj_device_id) {
      refuseSticker(
        STICKER_ERROR.JOB_OTHER_COUNTER,
        `Job ${job.lbj_refno} was printed by another counter; only that counter marks it`,
        'jobId',
      );
    }
    const userId = this.requestContext.getUserId();
    const now = new Date();
    const message = body.printerMessage?.trim() ? body.printerMessage.trim().slice(0, 250) : null;
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.labelJob.updateMany({
        where: { lbjId: job.lbj_id, lbjAccYear: job.lbj_acc_year, lbjStatus: 'SENT' },
        data: {
          lbjStatus: body.status,
          lbjStatusOn: now,
          lbjPrinterMessage: body.status === 'FAILED' ? message : null,
          lbjModifiedOn: now,
          lbjModifiedBy: userId,
        },
      });
      if (moved.count === 0) {
        refuseSticker(
          STICKER_ERROR.JOB_STATUS_SET,
          `Job ${job.lbj_refno} was marked meanwhile`,
          'status',
        );
      }
      await appendTxnStatusLog(tx, {
        companyId: job.lbj_company_id,
        branchId: job.lbj_branch_id,
        accYear: job.lbj_acc_year,
        srcModule: TxnStatusSrcModule.INVENTORY,
        srcDocType: TxnStatusDocType.LABEL_JOB,
        srcDocId: job.lbj_id,
        srcDocRefno: job.lbj_refno,
        event: body.status === 'PRINTED' ? TxnStatusEvent.PRINTED : TxnStatusEvent.PRINT_FAILED,
        fromStatus: 'SENT',
        toStatus: body.status,
        changedOn: now,
        changedBy: userId ?? '',
        remarks: body.status === 'FAILED' ? message : null,
        deviceId,
      });
    });
    return {
      jobId: job.lbj_id,
      jobNo: job.lbj_refno,
      status: body.status,
      statusOn: istDateTimeText(now),
    };
  }

  // ═══ Reprint (§4.8, decision 29) ══════════════════════════════════════════

  async reprint(body: {
    companyId: string;
    branchId: string;
    accYear: string;
    jobId: string;
    reasonCode?: string | null;
    reasonNote?: string | null;
    printerName?: string | null;
    printerDpi?: number | null;
    startAt?: number | null;
    lines: Array<{ lineId: string; labels: number }>;
  }): Promise<StickerPdfAnswer> {
    await this.lines.assertRight('print');
    await this.lines.assertBranchInCompany(body.companyId, body.branchId);
    if (!body.reasonCode?.trim()) {
      refuseSticker(STICKER_ERROR.REASON_REQUIRED, 'A reprint needs a reason', 'reasonCode');
    }
    const reason = asReprintReason(body.reasonCode);
    if (!reason) {
      refuseSticker(
        STICKER_ERROR.REASON_INVALID,
        `reasonCode "${body.reasonCode}" is not JAMMED, ROLL_OUT, TORN or OTHER`,
        'reasonCode',
      );
    }
    const note = body.reasonNote?.trim() ? body.reasonNote.trim().slice(0, 250) : null;
    if (reason === 'OTHER' && !note) {
      refuseSticker(STICKER_ERROR.NOTE_REQUIRED, 'Reason Other needs a note', 'reasonNote');
    }

    const clicked = await this.findJob(body.companyId, body.branchId, body.accYear, body.jobId);
    if (clicked.lbj_status !== 'PRINTED') {
      refuseSticker(
        STICKER_ERROR.REPRINT_NOT_PRINTED,
        `Job ${clicked.lbj_refno} is ${clicked.lbj_status}; only a printed job is reprinted`,
        'jobId',
      );
    }
    // "Reprint" on a reprint job opens its original (decision 29).
    const original =
      clicked.lbj_kind === 'REPRINT' && clicked.lbj_reprint_of_id && clicked.lbj_reprint_of_acc_year
        ? await this.findJob(
            body.companyId,
            body.branchId,
            clicked.lbj_reprint_of_acc_year,
            clicked.lbj_reprint_of_id,
          )
        : clicked;
    const printerName = this.requirePrinter(body.printerName);
    const deviceId = await this.requireDevice();

    // The lines are the ORIGINAL's. A line id may name one of them, or — when
    // the selected job is itself a reprint — one of ITS lines (what /jobs/get
    // of that job shows), which stands for the original line it reprinted
    // (lbjl_reprint_of_line_id). Two entries naming one original line add up.
    const sourceLines = await this.loadJobLines(body.companyId, original);
    const byId = new Map(sourceLines.map((line) => [line.lbjl_id, line]));
    const aliases = new Map<string, JobLineRow>();
    if (original !== clicked) {
      for (const line of await this.loadJobLines(body.companyId, clicked)) {
        const target = line.lbjl_reprint_of_line_id
          ? byId.get(line.lbjl_reprint_of_line_id)
          : undefined;
        if (target) {
          aliases.set(line.lbjl_id, target);
        }
      }
    }
    const pickedByLine = new Map<string, { source: JobLineRow; labels: number }>();
    body.lines.forEach((wanted, index) => {
      const source = byId.get(wanted.lineId) ?? aliases.get(wanted.lineId);
      if (!source) {
        refuseSticker(
          STICKER_ERROR.LINE_NOT_ON_JOB,
          `Line ${wanted.lineId} is not on job ${original.lbj_refno}` +
            (original !== clicked ? ` nor on its reprint ${clicked.lbj_refno}` : ''),
          'lineId',
          { line: index + 1 },
        );
      }
      if (
        !Number.isInteger(wanted.labels) ||
        wanted.labels < 0 ||
        wanted.labels > STICKER_MAX_LABELS_PER_LINE
      ) {
        refuseSticker(
          STICKER_ERROR.LABELS_INVALID,
          `labels must be 0 to ${STICKER_MAX_LABELS_PER_LINE}, got ${wanted.labels}`,
          'labels',
          { line: index + 1 },
        );
      }
      if (wanted.labels > 0) {
        const entry = pickedByLine.get(source.lbjl_id) ?? { source, labels: 0 };
        entry.labels += wanted.labels;
        if (entry.labels > STICKER_MAX_LABELS_PER_LINE) {
          refuseSticker(
            STICKER_ERROR.LABELS_INVALID,
            `Line ${source.lbjl_line_no} of ${original.lbj_refno} is asked ${entry.labels} labels in all; ` +
              `one line takes at most ${STICKER_MAX_LABELS_PER_LINE}`,
            'labels',
            { line: index + 1 },
          );
        }
        pickedByLine.set(source.lbjl_id, entry);
      }
    });
    const picked = [...pickedByLine.values()];
    if (picked.length === 0) {
      refuseSticker(STICKER_ERROR.NOTHING_TO_PRINT, 'Every line asks for 0 labels', 'lines');
    }
    this.assertLabelTotal(picked.reduce((total, entry) => total + entry.labels, 0));

    const shop = await this.loadShop(body.companyId, body.branchId);
    const levelShort = await this.priceLevelShort(original.lbj_price_level);
    picked.sort((left, right) => left.source.lbjl_line_no - right.source.lbjl_line_no);
    return this.makeJob({
      companyId: body.companyId,
      branchId: body.branchId,
      deviceId,
      accYear: await this.currentAccYear(body.companyId),
      purposeId: original.lbj_purpose_id,
      templateId: original.lbj_template_id,
      versionId: original.lbj_version_id,
      printerName,
      printerDpi: body.printerDpi ?? null,
      priceLevel: original.lbj_price_level,
      startAt: body.startAt ?? 1,
      kind: 'REPRINT',
      reprintOf: { id: original.lbj_id, accYear: original.lbj_acc_year },
      resendOf: null,
      reasonCode: reason,
      reasonNote: note,
      lines: picked.map((entry, index) =>
        this.copyFrozen(entry.source, index + 1, entry.labels, entry.source.lbjl_id),
      ),
      rowsFor: (job) =>
        picked.map((entry) => this.frozenLabelRow(entry.source, levelShort, shop, job)),
    });
  }

  // ═══ Resend a FAILED job (§4.8, decision 30) ══════════════════════════════

  async resend(body: {
    companyId: string;
    branchId: string;
    accYear: string;
    jobId: string;
    printerName?: string | null;
    printerDpi?: number | null;
  }): Promise<StickerPdfAnswer> {
    await this.lines.assertRight('print');
    await this.lines.assertBranchInCompany(body.companyId, body.branchId);
    const failed = await this.findJob(body.companyId, body.branchId, body.accYear, body.jobId);
    if (failed.lbj_status !== 'FAILED') {
      refuseSticker(
        STICKER_ERROR.RESEND_NOT_FAILED,
        `Job ${failed.lbj_refno} is ${failed.lbj_status}; only a failed job is sent again`,
        'jobId',
      );
    }
    // Once only (SF1): refused while another resend of this job is still SENT
    // (on its way, not marked yet) or once one PRINTED. A FAILED resend does
    // not count. Checked here for a quick answer, and again inside the job's
    // transaction under a per-job lock, so two presses at once (this counter
    // or another) cannot both pass.
    this.refuseIfResent(failed, await this.findResend(this.prisma, failed));
    const printerName = this.requirePrinter(body.printerName);
    const deviceId = await this.requireDevice();
    const sourceLines = await this.loadJobLines(body.companyId, failed);
    const shop = await this.loadShop(body.companyId, body.branchId);
    const levelShort = await this.priceLevelShort(failed.lbj_price_level);
    return this.makeJob({
      companyId: body.companyId,
      branchId: body.branchId,
      deviceId,
      accYear: await this.currentAccYear(body.companyId),
      purposeId: failed.lbj_purpose_id,
      templateId: failed.lbj_template_id,
      versionId: failed.lbj_version_id,
      printerName,
      printerDpi: body.printerDpi ?? null,
      priceLevel: failed.lbj_price_level,
      startAt: failed.lbj_start_at,
      kind: 'PRINT',
      reprintOf: null,
      resendOf: { id: failed.lbj_id, accYear: failed.lbj_acc_year },
      reasonCode: null,
      reasonNote: null,
      lines: sourceLines.map((line, index) =>
        this.copyFrozen(line, index + 1, line.lbjl_labels, line.lbjl_reprint_of_line_id),
      ),
      rowsFor: (job) => sourceLines.map((line) => this.frozenLabelRow(line, levelShort, shop, job)),
      guard: async (tx) => {
        const lockKey = `${failed.lbj_id}|${failed.lbj_acc_year}`;
        await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('label_job_resend'), hashtext(${lockKey})))::int AS locked`;
        this.refuseIfResent(failed, await this.findResend(tx, failed));
      },
    });
  }

  /** The resend of `failed` that blocks another: a PRINTED one first, else a SENT one. */
  private async findResend(
    db: Pick<Prisma.TransactionClient, '$queryRaw'>,
    failed: JobRow,
  ): Promise<ResendRow | undefined> {
    const [row] = await db.$queryRaw<ResendRow[]>`
      SELECT j.lbj_refno AS refno, j.lbj_status AS status, d.dev_code AS device_code
        FROM inventory.label_job j
        LEFT JOIN fixed.device_master d ON d.dev_id = j.lbj_device_id
       WHERE j.lbj_resend_of_id = ${failed.lbj_id}::uuid
         AND j.lbj_resend_of_acc_year = ${failed.lbj_acc_year}::char(9)
         AND j.lbj_status IN ('SENT', 'PRINTED')
       ORDER BY (j.lbj_status = 'PRINTED') DESC, j.lbj_printed_on DESC
       LIMIT 1`;
    return row;
  }

  /** 409 STICKER_ALREADY_RESENT: plain = printed; variant rule=SENT = not marked yet. */
  private refuseIfResent(failed: JobRow, resend: ResendRow | undefined): void {
    if (!resend) {
      return;
    }
    if (resend.status === 'PRINTED') {
      refuseSticker(
        STICKER_ERROR.ALREADY_RESENT,
        `Job ${failed.lbj_refno} was already sent again and printed as ${resend.refno}`,
        'jobId',
      );
    }
    // Only the counter that sent the resend can mark it (RR5): name it.
    const counter = resend.device_code ? `counter ${resend.device_code}` : 'the counter that sent it';
    refuseSticker(
      STICKER_ERROR.ALREADY_RESENT,
      `Job ${failed.lbj_refno} was already sent again as ${resend.refno}, which is not marked ` +
        `Printed or Failed yet; ${counter} marks it first`,
      'jobId',
      { rule: 'SENT' },
    );
  }

  // ═══ Get ══════════════════════════════════════════════════════════════════

  async get(q: { companyId: string; branchId: string; accYear: string; id: string }): Promise<{
    job: Record<string, unknown>;
    lines: Array<Record<string, unknown>>;
    reprints: Array<Record<string, unknown>>;
  }> {
    await this.lines.assertRight('view');
    await this.lines.assertBranchInCompany(q.companyId, q.branchId);
    const job = await this.findJob(q.companyId, q.branchId, q.accYear, q.id);
    const [facts] = await this.prisma.$queryRaw<
      Array<{
        purpose_code: string;
        template_name: string;
        rev_no: number;
        width: Prisma.Decimal | null;
        height: Prisma.Decimal | null;
        across: number | null;
        down: number | null;
        paper_code: string | null;
        printed_by_name: string | null;
        device_code: string | null;
        device_name: string | null;
        reprint_of_no: string | null;
        resend_of_no: string | null;
      }>
    >`
      SELECT p.ppo_code AS purpose_code, t.ptl_name AS template_name, v.ptv_rev_no AS rev_no,
             v.ptv_label_width_mm AS width, v.ptv_label_height_mm AS height,
             v.ptv_label_across AS across, v.ptv_label_down AS down, v.ptv_paper_code AS paper_code,
             COALESCE(NULLIF(btrim(u.usr_full_name), ''), u.usr_login_name) AS printed_by_name,
             d.dev_code AS device_code, d.dev_device_name AS device_name,
             (SELECT o.lbj_refno FROM inventory.label_job o
               WHERE o.lbj_id = ${job.lbj_reprint_of_id}::uuid AND o.lbj_acc_year = ${job.lbj_reprint_of_acc_year}::char(9)) AS reprint_of_no,
             (SELECT o.lbj_refno FROM inventory.label_job o
               WHERE o.lbj_id = ${job.lbj_resend_of_id}::uuid AND o.lbj_acc_year = ${job.lbj_resend_of_acc_year}::char(9)) AS resend_of_no
        FROM public.print_purpose p
        JOIN public.print_template t ON t.ptl_id = ${job.lbj_template_id}::uuid
        JOIN public.print_template_version v ON v.ptv_id = ${job.lbj_version_id}::uuid
        LEFT JOIN public.user_master u ON u.usr_id = ${job.lbj_printed_by}::uuid
        LEFT JOIN fixed.device_master d ON d.dev_id = ${job.lbj_device_id}::uuid
       WHERE p.ppo_id = ${job.lbj_purpose_id}::uuid`;
    const lines = await this.loadJobLines(q.companyId, job);
    const reprints = await this.loadReprints(job);
    return {
      job: {
        jobId: job.lbj_id,
        jobNo: job.lbj_refno,
        accYear: job.lbj_acc_year,
        kind: job.lbj_kind,
        reprintOfJobId: job.lbj_reprint_of_id,
        reprintOfJobNo: facts?.reprint_of_no ?? null,
        // The year of the job in reprint_of / resend_of (SF5): a reprint made
        // in April of a March job opens its original with this, not with the
        // clicked job's own accYear. null when the job is neither.
        reprintOfAccYear: job.lbj_reprint_of_acc_year ?? null,
        resendOfJobId: job.lbj_resend_of_id,
        resendOfJobNo: facts?.resend_of_no ?? null,
        resendOfAccYear: job.lbj_resend_of_acc_year ?? null,
        reasonCode: job.lbj_reason_code,
        reasonText: reasonText(job.lbj_reason_code, null),
        reasonNote: job.lbj_reason_note,
        status: job.lbj_status,
        statusOn: istDateTimeText(job.lbj_status_on),
        printerMessage: job.lbj_printer_message,
        purposeCode: facts?.purpose_code ?? null,
        templateId: job.lbj_template_id,
        templateName: facts?.template_name ?? null,
        versionId: job.lbj_version_id,
        revNo: facts?.rev_no ?? null,
        labelWidthMm: facts?.width ? Number(facts.width) : null,
        labelHeightMm: facts?.height ? Number(facts.height) : null,
        labelsAcross: facts?.across ?? null,
        labelsDown: facts?.down ?? null,
        paperCode: facts?.paper_code ?? null,
        printerName: job.lbj_printer_name,
        printerDpi: job.lbj_printer_dpi,
        priceLevel: job.lbj_price_level,
        startAt: job.lbj_start_at,
        lineCount: job.lbj_line_count,
        labelCount: job.lbj_label_count,
        pageCount: job.lbj_page_count,
        printedOn: istDateTimeText(job.lbj_printed_on),
        printedBy: job.lbj_printed_by,
        printedByName: facts?.printed_by_name ?? null,
        deviceId: job.lbj_device_id,
        deviceCode: facts?.device_code ?? null,
        deviceName: facts?.device_name ?? null,
      },
      lines: lines.map((line) => ({
        lineId: line.lbjl_id,
        lineNo: line.lbjl_line_no,
        itemId: line.lbjl_item_id,
        itemName: line.item_name,
        unitId: line.lbjl_unit_id,
        unitName: line.unit_name,
        lotId: line.lbjl_lot_id,
        barcode: line.lbjl_barcode,
        batchNo: line.lbjl_batch_no,
        mrp: money(line.lbjl_mrp),
        price: money(line.lbjl_price),
        mfgDate: line.lbjl_mfg_date,
        expiryDate: line.lbjl_expiry_date,
        labels: line.lbjl_labels,
        reprintedLabels: line.reprinted,
        reprintOfLineId: line.lbjl_reprint_of_line_id,
      })),
      reprints: reprints.map((row) => ({
        jobId: row.lbj_id,
        jobNo: row.lbj_refno,
        accYear: row.lbj_acc_year,
        // REPRINT, or PRINT for a resend of a failed reprint (decision 30 keeps a resend PRINT).
        kind: row.lbj_kind,
        printedOn: istDateTimeText(row.lbj_printed_on),
        // the labels of this job's lines it printed again (what Reprinted sums)
        labels: row.labels,
        // a resend carries the reason of the reprint it sends again
        reasonText: reasonText(row.why_code, row.why_note),
        // SENT / PRINTED / FAILED: a FAILED one is listed but not counted in Reprinted (SF2).
        status: row.lbj_status,
        // set on a resend ("Sent again"): the failed job it copies
        resendOfJobId: row.lbj_resend_of_id,
        resendOfJobNo: row.resend_of_no,
      })),
    };
  }

  // ═══ Test print (Print Assignments, PQ4) ═════════════════════════════════

  async testPrint(body: {
    companyId: string;
    branchId: string;
    templateId: string;
    printerName: string;
    printerDpi?: number | null;
    counterName?: string | null;
  }): Promise<LabelRenderOutcome> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: PRINT_ASSIGNMENTS_MENU_ID,
      right: 'print',
      codePrefix: PRINT_ASSIGN_RIGHT_PREFIX,
      action: 'print a test label',
    });
    await this.lines.assertBranchInCompany(body.companyId, body.branchId);
    // The published revision, else the newest live one (a design being made).
    const rows = await this.prisma.$queryRaw<
      Array<{
        ptl_id: string;
        ptl_company_id: string | null;
        ptl_is_deleted: boolean;
        ptv_id: string | null;
        width: Prisma.Decimal | null;
        height: Prisma.Decimal | null;
        across: number | null;
        dpi: number | null;
      }>
    >`
      SELECT t.ptl_id, t.ptl_company_id, t.ptl_is_deleted, v.ptv_id,
             v.ptv_label_width_mm AS width, v.ptv_label_height_mm AS height,
             v.ptv_label_across AS across, v.ptv_label_dpi AS dpi
        FROM public.print_template t
        LEFT JOIN LATERAL (
          SELECT * FROM public.print_template_version x
           WHERE x.ptv_template_id = t.ptl_id AND x.ptv_is_deleted = false
           ORDER BY (x.ptv_id = t.ptl_published_rev_id) DESC, x.ptv_rev_no DESC
           LIMIT 1) v ON true
       WHERE t.ptl_id = ${body.templateId}::uuid`;
    const design = rows[0];
    if (
      !design ||
      design.ptl_is_deleted ||
      (design.ptl_company_id !== null && design.ptl_company_id !== body.companyId) ||
      !design.ptv_id
    ) {
      refuseSticker(
        STICKER_ERROR.DESIGN_NOT_FOUND,
        `No live design ${body.templateId}`,
        'templateId',
      );
    }
    if (
      design.width === null ||
      design.height === null ||
      design.across === null ||
      design.dpi === null
    ) {
      refuseSticker(
        STICKER_ERROR.DESIGN_NOT_LABEL,
        'This design has no label sheet, so it cannot print a test label',
        'templateId',
      );
    }
    const width = Number(design.width);
    const height = Number(design.height);
    const dpi = body.printerDpi && body.printerDpi >= 72 ? Math.round(body.printerDpi) : design.dpi;
    return this.render.renderLabels({
      versionId: design.ptv_id,
      context: this.renderContext(body.companyId, body.branchId),
      rows: [{ row: {}, labels: 1 }],
      startAt: 1,
      printDpi: dpi,
      bands: testLabelBands({
        widthMm: width,
        heightMm: height,
        across: design.across,
        dpi,
        counter: body.counterName?.trim() || 'Counter',
        printer: body.printerName.trim(),
      }),
    });
  }

  // ═══ The job write (number, freeze, render, log) ═════════════════════════

  private async makeJob(draft: JobDraft, attempt = 1): Promise<StickerPdfAnswer> {
    const userId = this.requestContext.getUserId();
    if (!userId) {
      refuseSticker(STICKER_ERROR.RIGHT_PRINT, 'No user in the session', 'userId');
    }
    const labels = draft.lines.reduce((total, line) => total + line.labels, 0);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const deviceCode = await resolveDeviceCode(tx, draft.deviceId);
        const lockKey = [
          'LABEL_JOB',
          draft.companyId,
          draft.branchId,
          draft.deviceId,
          draft.accYear,
        ].join('|');
        await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('label_job_no'), hashtext(${lockKey})))::int AS locked`;
        if (draft.guard) {
          await draft.guard(tx);
        }
        const [next] = await tx.$queryRaw<{ n: number }[]>`
          SELECT (COALESCE(MAX(lbj_slno), 0) + 1)::int AS n FROM inventory.label_job
           WHERE lbj_company_id = ${draft.companyId}::uuid AND lbj_branch_id = ${draft.branchId}::uuid
             AND lbj_device_id = ${draft.deviceId}::uuid AND lbj_acc_year = ${draft.accYear}::char(9)`;
        const slno = Number(next?.n ?? 1);
        const jobNo = jobRefno(deviceCode, slno);
        const printedOn = new Date();

        // Render inside the transaction: a failed render rolls the number back.
        const rows = draft.rowsFor({ jobNo, printedOn });
        const outcome = await this.render.renderLabels({
          versionId: draft.versionId,
          context: this.renderContext(draft.companyId, draft.branchId),
          rows: rows.map((row, index): LabelRunRow => ({ row, labels: draft.lines[index].labels })),
          startAt: draft.startAt,
          printDpi: draft.printerDpi,
        });

        const job = await tx.labelJob.create({
          data: {
            lbjAccYear: draft.accYear,
            lbjCompanyId: draft.companyId,
            lbjBranchId: draft.branchId,
            lbjDeviceId: draft.deviceId,
            lbjSlno: slno,
            lbjRefno: jobNo,
            lbjPurposeId: draft.purposeId,
            lbjTemplateId: draft.templateId,
            lbjVersionId: draft.versionId,
            lbjPrinterName: draft.printerName,
            lbjPrinterDpi: draft.printerDpi,
            lbjPriceLevel: draft.priceLevel,
            lbjStartAt: outcome.startAt,
            lbjKind: draft.kind,
            lbjReprintOfId: draft.reprintOf?.id ?? null,
            lbjReprintOfAccYear: draft.reprintOf?.accYear ?? null,
            lbjResendOfId: draft.resendOf?.id ?? null,
            lbjResendOfAccYear: draft.resendOf?.accYear ?? null,
            lbjReasonCode: draft.reasonCode,
            lbjReasonNote: draft.reasonNote,
            lbjLineCount: draft.lines.length,
            lbjLabelCount: labels,
            lbjPageCount: outcome.pageCount,
            lbjStatus: 'SENT',
            lbjPrintedOn: printedOn,
            lbjPrintedBy: userId,
            lines: {
              create: draft.lines.map((line) => ({
                lbjlLineNo: line.lineNo,
                lbjlItemId: line.itemId,
                lbjlUnitId: line.unitId,
                lbjlLotId: line.lotId,
                lbjlBarcode: line.barcode,
                lbjlMrp: line.mrp,
                lbjlPrice: line.price,
                lbjlBatchNo: line.batchNo,
                lbjlMfgDate: dayToDate(line.mfgDate),
                lbjlExpiryDate: dayToDate(line.expiryDate),
                lbjlCostCode: line.costCode,
                lbjlPriceCode: line.priceCode,
                lbjlLabels: line.labels,
                lbjlReprintOfLineId: line.reprintOfLineId,
              })),
            },
          },
          include: { lines: { orderBy: { lbjlLineNo: 'asc' } } },
        });

        await appendTxnStatusLog(tx, {
          companyId: draft.companyId,
          branchId: draft.branchId,
          accYear: draft.accYear,
          srcModule: TxnStatusSrcModule.INVENTORY,
          srcDocType: TxnStatusDocType.LABEL_JOB,
          srcDocId: job.lbjId,
          srcDocRefno: jobNo,
          event: TxnStatusEvent.SENT,
          fromStatus: null,
          toStatus: 'SENT',
          changedOn: printedOn,
          changedBy: userId,
          remarks:
            draft.kind === 'REPRINT'
              ? reasonText(draft.reasonCode, draft.reasonNote)
              : draft.resendOf
                ? 'Sent again'
                : null,
          deviceId: draft.deviceId,
        });

        const warnings = outcome.warnings.map((warning) => warning.message);
        return {
          outcome,
          inspect: {
            jobId: job.lbjId,
            jobNo,
            accYear: draft.accYear,
            labels,
            pages: outcome.pageCount,
            lines: job.lines.map((line) => ({
              lineId: line.lbjlId,
              lineNo: line.lbjlLineNo,
              itemId: line.lbjlItemId,
              unitId: line.lbjlUnitId,
              lotId: line.lbjlLotId,
              barcode: line.lbjlBarcode,
              mrp: money(line.lbjlMrp),
              price: money(line.lbjlPrice),
              batchNo: line.lbjlBatchNo,
              mfgDate: isoDay(line.lbjlMfgDate),
              expiryDate: isoDay(line.lbjlExpiryDate),
              costCode: line.lbjlCostCode,
              priceCode: line.lbjlPriceCode,
              labels: line.lbjlLabels,
            })),
            warnings,
          },
        };
      }, JOB_TX_OPTIONS);
    } catch (error) {
      // Two prints on one counter at once: the advisory lock serialises them,
      // so a clash on ux_lbj_device_no is a lost race at most — try once more.
      if (
        attempt === 1 &&
        isUniqueConstraintError(error) &&
        (await this.isDeviceNumberClash(error))
      ) {
        this.logger.warn(`Sticker job number clash on device ${draft.deviceId}; retrying once`);
        return this.makeJob(draft, 2);
      }
      throw error;
    }
  }

  /** A duplicate names the PARTITION's index; pg_inherits maps it to ux_lbj_device_no. */
  private async isDeviceNumberClash(error: unknown): Promise<boolean> {
    const reported = violatedConstraintOf(error) ?? '';
    if (reported.includes('ux_lbj_device_no') || reported.includes('lbj_slno')) {
      return true;
    }
    try {
      const rows = await this.prisma.$queryRaw<{ parent: string }[]>`
        SELECT parent.relname AS parent
          FROM pg_class child
          JOIN pg_inherits inh ON inh.inhrelid = child.oid
          JOIN pg_class parent ON parent.oid = inh.inhparent
         WHERE child.relname = ${reported}`;
      return rows[0]?.parent === 'ux_lbj_device_no';
    } catch {
      return false;
    }
  }

  // ═══ Helpers ══════════════════════════════════════════════════════════════

  /** A design the job / preview names: live, published, a label design of the purpose (if given). */
  private async designFor(
    companyId: string,
    templateId: string,
    purposeCode: string | null,
  ): Promise<DesignRow> {
    const design = (await this.lines.loadDesigns([templateId])).get(templateId);
    const verdict = this.lines.designVerdict(
      templateId,
      design,
      purposeCode ?? design?.ppo_code ?? '',
      companyId,
    );
    if (verdict) {
      throwRefusal(verdict);
    }
    return design as DesignRow;
  }

  /** The scope of a one-design job: every line JOB, no assignment needed. */
  private async jobScope(
    companyId: string,
    branchId: string,
    design: DesignRow,
    priceLevel: number,
  ): Promise<StickerScope> {
    const purpose = await this.lines.loadPurpose(companyId, design.ppo_code);
    return {
      companyId,
      branchId,
      deviceId: this.requestContext.getDeviceId(),
      purpose,
      priceLevel,
      assignment: {
        purposeId: purpose.ppoId,
        purposeCode: purpose.ppoCode,
        purposeName: purpose.ppoName,
        ptaId: null,
        scope: null,
        templateId: null,
        templateName: null,
        printerName: null,
        printerSource: null,
        lastPriceLevel: priceLevel,
      },
      jobTemplateId: design.ptl_id,
    };
  }

  private requirePrinter(name: string | null | undefined): string {
    const printer = name?.trim() ?? '';
    if (!printer) {
      refuseSticker(STICKER_ERROR.NO_PRINTER, 'No printer is named for this job', 'printerName');
    }
    return printer.slice(0, 150);
  }

  /** The counter that prints owns the number series; the shared helper words its refusals. */
  private async requireDevice(): Promise<string> {
    const deviceId = this.requestContext.getDeviceId();
    if (!deviceId) {
      refuseSticker(
        STOCK_DEVICE_NOT_FOUND,
        'This session logged in at no registered counter; sticker jobs are numbered per counter',
        'deviceId',
      );
    }
    await this.prisma.$transaction((tx) => resolveDeviceCode(tx, deviceId));
    return deviceId;
  }

  private assertLabelTotal(total: number): void {
    if (total > STICKER_MAX_LABELS_PER_JOB) {
      refuseSticker(
        STICKER_ERROR.TOO_MANY_LABELS,
        `One print takes at most ${STICKER_MAX_LABELS_PER_JOB} labels, this one ${total}`,
        'lines',
      );
    }
  }

  /** Item, unit and lot refusals stop a preview; the rest show on the label. */
  private isLineIdentityRefusal(code: string): boolean {
    return (
      code === STICKER_ERROR.ITEM_NOT_FOUND ||
      code === STICKER_ERROR.UNIT_NOT_OF_ITEM ||
      code === STICKER_ERROR.LOT_NOT_OF_ITEM ||
      code === STICKER_ERROR.DESIGN_NOT_FOUND ||
      code === STICKER_ERROR.DESIGN_NOT_PUBLISHED ||
      code === STICKER_ERROR.DESIGN_NOT_LABEL
    );
  }

  private renderContext(companyId: string, branchId: string) {
    return {
      companyId,
      branchId,
      accYear: null,
      docId: null,
      userId: this.requestContext.getUserId(),
      deviceId: this.requestContext.getDeviceId(),
    };
  }

  /** The company's current financial year (fy_is_current), else April–March. */
  private async currentAccYear(companyId: string): Promise<string> {
    const [row] = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT btrim(fy_year_name) AS name FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND fy_is_current = true AND is_deleted = false
       ORDER BY fy_begin_date DESC LIMIT 1`;
    if (row?.name && /^\d{4}-\d{4}$/.test(row.name)) {
      return row.name;
    }
    const [today] = await this.prisma.$queryRaw<{ y: number; m: number }[]>`
      SELECT extract(year FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int AS y,
             extract(month FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int AS m`;
    const start = today.m >= 4 ? today.y : today.y - 1;
    return `${start}-${start + 1}`;
  }

  private async findJob(
    companyId: string,
    branchId: string,
    accYear: string,
    jobId: string,
  ): Promise<JobRow> {
    const [job] = await this.prisma.$queryRaw<JobRow[]>`
      SELECT * FROM inventory.label_job
       WHERE lbj_id = ${jobId}::uuid AND lbj_acc_year = ${accYear}::char(9)
         AND lbj_company_id = ${companyId}::uuid AND lbj_branch_id = ${branchId}::uuid`;
    if (!job) {
      refuseSticker(
        STICKER_ERROR.JOB_NOT_FOUND,
        `No sticker job ${jobId} (${accYear}) at this branch`,
        'jobId',
      );
    }
    return job;
  }

  /**
   * The jobs that printed lines of `job` again (RR6): every job with a line
   * whose lbjl_reprint_of_line_id is one of `job`'s lines — the same source as
   * the Reprinted sum, so the list and the count agree. That is each REPRINT
   * job of it and also a resend of a failed reprint (kind PRINT, decision 30:
   * its lines keep pointing at the original lines). `labels` = the labels of
   * those lines. The reason is the job's own, else (a resend) the reason of the
   * REPRINT up its resend chain. Oldest first; FAILED ones are listed too.
   */
  private async loadReprints(job: JobRow): Promise<ReprintRow[]> {
    return this.prisma.$queryRaw<ReprintRow[]>`
      WITH mine AS (
        SELECT l.lbjl_id FROM inventory.label_job_line l
         WHERE l.lbjl_job_id = ${job.lbj_id}::uuid AND l.lbjl_acc_year = ${job.lbj_acc_year}::char(9)
      ), hits AS (
        SELECT r.lbjl_job_id AS job_id, r.lbjl_acc_year AS acc_year, SUM(r.lbjl_labels)::int AS labels
          FROM inventory.label_job_line r
         WHERE r.lbjl_reprint_of_line_id IN (SELECT lbjl_id FROM mine)
         GROUP BY r.lbjl_job_id, r.lbjl_acc_year
      )
      SELECT j.lbj_id, j.lbj_acc_year, j.lbj_refno, j.lbj_kind, j.lbj_printed_on, j.lbj_status,
             j.lbj_reason_code, j.lbj_reason_note, j.lbj_resend_of_id,
             src.lbj_refno AS resend_of_no,
             COALESCE(j.lbj_reason_code, why.lbj_reason_code) AS why_code,
             CASE WHEN j.lbj_reason_code IS NOT NULL THEN j.lbj_reason_note ELSE why.lbj_reason_note END AS why_note,
             h.labels
        FROM hits h
        JOIN inventory.label_job j ON j.lbj_id = h.job_id AND j.lbj_acc_year = h.acc_year
        LEFT JOIN inventory.label_job src
          ON src.lbj_id = j.lbj_resend_of_id AND src.lbj_acc_year = j.lbj_resend_of_acc_year
        LEFT JOIN LATERAL (
          WITH RECURSIVE up AS (
            SELECT u.lbj_kind, u.lbj_reason_code, u.lbj_reason_note, u.lbj_resend_of_id,
                   u.lbj_resend_of_acc_year, 1 AS depth
              FROM inventory.label_job u
             WHERE u.lbj_id = j.lbj_resend_of_id AND u.lbj_acc_year = j.lbj_resend_of_acc_year
            UNION ALL
            SELECT u.lbj_kind, u.lbj_reason_code, u.lbj_reason_note, u.lbj_resend_of_id,
                   u.lbj_resend_of_acc_year, up.depth + 1
              FROM up
              JOIN inventory.label_job u
                ON u.lbj_id = up.lbj_resend_of_id AND u.lbj_acc_year = up.lbj_resend_of_acc_year
             WHERE up.lbj_kind <> 'REPRINT' AND up.depth < 20
          )
          SELECT up.lbj_reason_code, up.lbj_reason_note FROM up
           WHERE up.lbj_kind = 'REPRINT' ORDER BY up.depth LIMIT 1
        ) why ON j.lbj_reason_code IS NULL
       ORDER BY j.lbj_printed_on, j.lbj_id`;
  }

  /**
   * A job's frozen lines, with today's names and the "Reprinted" sum per line.
   * Reprinted (and the Reprint dialog's Before) counts the lines of every job
   * that points at the line, except a FAILED job's — the labels never came
   * out — as Last printed does (review SF2). A SENT job counts: it went out.
   */
  private async loadJobLines(companyId: string, job: JobRow): Promise<JobLineRow[]> {
    return this.prisma.$queryRaw<JobLineRow[]>`
      SELECT l.lbjl_id, l.lbjl_line_no, l.lbjl_item_id, l.lbjl_unit_id, l.lbjl_lot_id, l.lbjl_barcode,
             l.lbjl_mrp, l.lbjl_price, l.lbjl_batch_no,
             l.lbjl_mfg_date::text AS lbjl_mfg_date, l.lbjl_expiry_date::text AS lbjl_expiry_date,
             l.lbjl_cost_code, l.lbjl_price_code, l.lbjl_labels, l.lbjl_reprint_of_line_id,
             i.item_name_en AS item_name, NULLIF(btrim(i.item_name_ta), '') AS item_name_ta,
             NULLIF(btrim(i.item_code), '') AS item_code, b.brand_name AS brand, g.itg_name AS group_name,
             um.unit_name, sz.isz_name AS size, cl.icl_name AS colour, NULLIF(btrim(sbd.sbd_model), '') AS model,
             COALESCE((SELECT SUM(r.lbjl_labels) FROM inventory.label_job_line r
                         JOIN inventory.label_job rj
                           ON rj.lbj_id = r.lbjl_job_id AND rj.lbj_acc_year = r.lbjl_acc_year
                        WHERE r.lbjl_reprint_of_line_id = l.lbjl_id
                          AND rj.lbj_status <> 'FAILED'), 0)::int AS reprinted
        FROM inventory.label_job_line l
        JOIN inventory.item_master i ON i.item_id = l.lbjl_item_id
        LEFT JOIN inventory.item_brand_master b ON b.brand_id = i.item_brand_id
        LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
        LEFT JOIN inventory.item_unit_conversion c ON c.iuc_id = l.lbjl_unit_id
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = c.iuc_unit_id
        LEFT JOIN LATERAL (
          SELECT d.sbd_size_id, d.sbd_colour_id, d.sbd_model FROM stock.stock_batch_detail d
           WHERE d.sbd_item_id = l.lbjl_item_id AND d.sbd_batch_no = l.lbjl_batch_no
             AND d.sbd_company_id = ${companyId}::uuid AND d.sbd_is_deleted = false
           ORDER BY d.sbd_created_on DESC LIMIT 1) sbd ON true
        LEFT JOIN inventory.item_size_master sz ON sz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master cl ON cl.icl_id = sbd.sbd_colour_id
       WHERE l.lbjl_job_id = ${job.lbj_id}::uuid AND l.lbjl_acc_year = ${job.lbj_acc_year}::char(9)
       ORDER BY l.lbjl_line_no`;
  }

  private async loadShop(companyId: string, branchId: string): Promise<LabelShop> {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        comp_name: string | null;
        comp_legal_name: string | null;
        comp_fssai_no: string | null;
        comp_support_phone: string | null;
        comp_support_email: string | null;
        br_name: string | null;
        br_short: string | null;
        br_address: string | null;
        br_fssai_no: string | null;
      }>
    >`
      SELECT c.comp_name, NULLIF(btrim(c.comp_legal_name), '') AS comp_legal_name,
             NULLIF(btrim(c.comp_fssai_no), '') AS comp_fssai_no,
             NULLIF(btrim(c.comp_support_phone), '') AS comp_support_phone,
             NULLIF(btrim(c.comp_support_email), '') AS comp_support_email,
             b.br_name, NULLIF(btrim(b.br_short), '') AS br_short,
             NULLIF(concat_ws(', ', NULLIF(btrim(b.br_addr1), ''), NULLIF(btrim(b.br_addr2), ''),
                              NULLIF(btrim(b.br_addr3), ''), NULLIF(btrim(b.br_city), ''),
                              b.br_pin::text), '') AS br_address,
             NULLIF(btrim(b.br_fssai_no), '') AS br_fssai_no
        FROM public.companys c
        JOIN public.branch_master b ON b.br_id = ${branchId}::uuid
       WHERE c.comp_id = ${companyId}::uuid`;
    return {
      companyName: row?.comp_name ?? null,
      legalName: row?.comp_legal_name ?? null,
      companyFssai: row?.comp_fssai_no ?? null,
      carePhone: row?.comp_support_phone ?? null,
      careEmail: row?.comp_support_email ?? null,
      branchName: row?.br_name ?? null,
      branchShort: row?.br_short ?? null,
      branchAddress: row?.br_address ?? null,
      branchFssai: row?.br_fssai_no ?? null,
    };
  }

  private async priceLevelShort(level: number): Promise<string | null> {
    const [row] = await this.prisma.$queryRaw<{ short: string | null }[]>`
      SELECT NULLIF(btrim(price_lvl_short), '') AS short FROM fixed.price_levels WHERE price_lvl_id = ${level}`;
    return row?.short ?? null;
  }

  /** A resolved line, as the job freezes it (numeric(14,2) money, never the client's figures). */
  private freeze(entry: BuiltStickerLine, lineNo: number): FrozenStickerLine {
    const { line, facts } = entry;
    return {
      lineNo,
      itemId: line.itemId as string,
      unitId: line.unitId as string,
      lotId: line.lotId,
      barcode: line.barcode,
      mrp: money2(facts.mrp),
      price: money2(facts.price),
      batchNo: line.batchNo,
      mfgDate: line.mfgDate,
      expiryDate: line.expiryDate,
      costCode: line.costCode,
      priceCode: line.priceCode,
      labels: line.labels,
      reprintOfLineId: null,
    };
  }

  private copyFrozen(
    source: JobLineRow,
    lineNo: number,
    labels: number,
    reprintOfLineId: string | null,
  ): FrozenStickerLine {
    return {
      lineNo,
      itemId: source.lbjl_item_id,
      unitId: source.lbjl_unit_id,
      lotId: source.lbjl_lot_id,
      barcode: source.lbjl_barcode,
      mrp: source.lbjl_mrp === null ? null : new Prisma.Decimal(source.lbjl_mrp),
      price: source.lbjl_price === null ? null : new Prisma.Decimal(source.lbjl_price),
      batchNo: source.lbjl_batch_no,
      mfgDate: isoDay(source.lbjl_mfg_date),
      expiryDate: isoDay(source.lbjl_expiry_date),
      costCode: source.lbjl_cost_code,
      priceCode: source.lbjl_price_code,
      labels,
      reprintOfLineId,
    };
  }

  private labelInput(entry: BuiltStickerLine) {
    const { line, facts } = entry;
    return {
      itemName: line.itemName,
      itemNameTa: line.itemNameTa,
      itemCode: line.itemCode,
      brand: facts.brand,
      groupName: facts.groupName,
      size: facts.size,
      colour: facts.colour,
      model: facts.model,
      unitName: line.unitName,
      barcode: line.barcode,
      mrp: facts.mrp,
      price: facts.price,
      priceLevel: facts.priceLevelShort,
      costCode: line.costCode,
      priceCode: line.priceCode,
      batchNo: line.batchNo,
      mfgDate: line.mfgDate,
      expiryDate: line.expiryDate,
    };
  }

  private frozenLabelRow(
    source: JobLineRow,
    levelShort: string | null,
    shop: LabelShop,
    job: { jobNo: string; printedOn: Date },
  ): Record<string, unknown> {
    return labelRow(
      {
        itemName: source.item_name,
        itemNameTa: source.item_name_ta,
        itemCode: source.item_code,
        brand: source.brand,
        groupName: source.group_name,
        size: source.size,
        colour: source.colour,
        model: source.model,
        unitName: source.unit_name,
        barcode: source.lbjl_barcode,
        mrp: source.lbjl_mrp === null ? null : new Prisma.Decimal(source.lbjl_mrp),
        price: source.lbjl_price === null ? null : new Prisma.Decimal(source.lbjl_price),
        priceLevel: levelShort,
        costCode: source.lbjl_cost_code,
        priceCode: source.lbjl_price_code,
        batchNo: source.lbjl_batch_no,
        mfgDate: isoDay(source.lbjl_mfg_date),
        expiryDate: isoDay(source.lbjl_expiry_date),
      },
      shop,
      job,
    );
  }
}

/**
 * The Test print label (plan §7.2, STK-13): built in code, laid out through
 * the same label path. A frame at the label edge, who / where it was sent,
 * the dpi and size, a 1-4 dot bar ladder, text at 6 / 8 / 10 pt, Tamil, and
 * the EAN-13 4006381333931 at 2 dots — everything a dealer checks on a new
 * label printer. Positions are whole dots so the ladder is exact.
 */
export function testLabelBands(spec: {
  widthMm: number;
  heightMm: number;
  across: number;
  dpi: number;
  counter: string;
  printer: string;
}): TemplateDefinition['bands'] {
  const { widthMm: w, heightMm: h, dpi } = spec;
  const dot = (dots: number) => dotsToMm(dots, dpi);
  const snap = (mm: number) => dot(Math.round((mm * dpi) / 25.4));
  const small = Math.max(4.5, Math.min(7, h * 0.24));
  const lineMm = (small / 72) * 25.4 * 1.25;
  const text = (
    id: string,
    x: number,
    y: number,
    width: number,
    value: string,
    size: number,
    bold = false,
  ) => ({
    kind: 'TEXT' as const,
    id,
    x,
    y,
    w: width,
    h: (size / 72) * 25.4 * 1.3,
    value,
    font: { family: 'NotoSans', size, bold },
    align: 'left' as const,
  });

  const elements: Record<string, unknown>[] = [
    {
      // A 1-dot line drawn half a dot in, so the whole stroke (0 to 1 dot on
      // each side) is inside the label: every cell is clipped to its label
      // (review SF3), and a stroke centred on the edge would lose half.
      kind: 'RECT',
      id: 'frame',
      x: dot(0.5),
      y: dot(0.5),
      w: Math.max(0.1, w - dot(1)),
      h: Math.max(0.1, h - dot(1)),
      style: { stroke: '#000000', strokeWidthPt: (72 / dpi) * 1 },
    },
    text('who', 1, 0.8, w - 2, `TEST · ${spec.counter} · ${spec.printer}`, small, true),
    text(
      'what',
      1,
      0.8 + lineMm,
      w - 2,
      `${dpi} dpi · ${sizeText(w, h, spec.across) || LABEL_SIZE_TEXT_DEFAULT}`,
      small * 0.9,
    ),
    text('aa6', 1, 0.8 + lineMm * 2, 6, 'Aa', 6),
    text('aa8', 4.5, 0.8 + lineMm * 2, 7, 'Aa', 8),
    text('aa10', 9, 0.8 + lineMm * 2, 9, 'Aa', 10),
    {
      ...text('tamil', 15, 0.8 + lineMm * 2, Math.max(5, w - 16), 'தமிழ் எழுத்து', 7),
      font: { family: 'NotoSansTamil', size: 7 },
    },
  ];

  // The ladder: 3 bars of n dots with n-dot spaces, n = 1..4, 1 mm between groups,
  // under the Aa row (whose tallest is 10 pt).
  const ladderTop = snap(0.8 + lineMm * 2 + (10 / 72) * 25.4 * 1.3 + 0.3);
  const ladderHeight = Math.max(2, h - ladderTop - 1.2);
  let x = snap(1);
  for (let n = 1; n <= 4; n += 1) {
    for (let bar = 0; bar < 3; bar += 1) {
      elements.push({
        kind: 'RECT',
        id: `ladder${n}_${bar}`,
        x,
        y: ladderTop,
        w: dot(n),
        h: ladderHeight,
        style: { fill: '#000000' },
      });
      x += dot(2 * n);
    }
    x = snap(x + 1);
  }

  // EAN-13 at 2 dots (95 modules), to the right of the ladder.
  const barcodeWidth = dot(95 * 2);
  const barcodeX = snap(Math.max(x + 0.5, w - barcodeWidth - 1.5));
  elements.push({
    kind: 'BARCODE',
    id: 'ean',
    x: barcodeX,
    y: ladderTop,
    w: Math.max(barcodeWidth, w - barcodeX - 0.5),
    h: ladderHeight,
    symbology: 'ean13',
    value: '4006381333931',
    showText: true,
    moduleDots: 2,
  });

  return [
    { type: 'REPORT_HEADER', heightMm: h, elements },
  ] as unknown as TemplateDefinition['bands'];
}
