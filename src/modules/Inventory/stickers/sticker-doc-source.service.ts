import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { StickerLinesService } from './sticker-lines.service';
import { refuseSticker } from './sticker.errors';
import { STICKER_MAX_LABELS_PER_LINE, dmyText, isoDay, istDateTimeText } from './sticker.rules';
import { STICKER_ERROR } from './types/sticker-error-codes';
import { StickerAssignment, StickerJobSource, StickerLine } from './types/sticker.types';

/**
 * Stickers of a posted document (plan S-P2 §4.1 / §4.2 / §4.4 / §7.1 / §7.2).
 *
 * ONE reader per document type (S-P3 adds the Make's here):
 *   - PURCHASE_BILL: its lines' pur_item_alloc rows — its own (PURCHASE_BILL)
 *     for a direct / sister line, the GRN's (pia_doc_type GRN, pia_line_id =
 *     pii_src_item_id, pia_acc_year = pii_src_doc_year) for a line made from
 *     a GRN; one bill may mix both;
 *   - SHORTAGE_RECEIPT: its own rows (pia_doc_type SHORTAGE_RECEIPT).
 * Only SALEABLE, live rows with a lot count.
 *
 * Counts per document + item + lot — THE SAME RULE AS GRID 224 (the picker,
 * prisma/seed/Grid_Details.sql): its CTEs are mirrored here one for one, so
 * the picker's Labels / Printed and these figures agree.
 *   - needed = Σ (qty + free) × the line's factor, ÷ the Def unit's factor,
 *     round(…, 6) then floor, at least 1; 1 when the Def unit counts in
 *     decimals; 0 when nothing came in. Def unit = the default unit, else the
 *     base unit, else the first by slno (the grid's LATERAL, S-P1's pick).
 *   - printed = Σ labels of this document's PRINT jobs that are not FAILED,
 *     over the lines that are not a reprint's copy (lbjl_reprint_of_line_id
 *     IS NULL: a resend of a failed REPRINT is kind PRINT but reprints, F2,
 *     migration 20261127100100). REPRINT jobs and those copies come back as
 *     `reprinted`, never as printed.
 *   - carried (Q20, C4) = the same sum over the PRINT jobs of CANCELLED bills
 *     that billed one of this bill's lines' GRN lines, same item.
 *   - shown printed = min(printed, needed), shown carried = min(carried,
 *     needed − printed), left = needed − both: so printed + carried = the
 *     grid's Printed (LEAST(needed, printed + carried)).
 *   - state (the grid's state_code): NONE when needed sums to 0, NOT when
 *     nothing printed or carried, DONE when every item + lot is covered, else
 *     PART. Ticked items only (stickerOnly = the grid's isticker_only '1').
 *
 * "Left" at print is re-counted inside the job's transaction after a lock on
 * the document (C5), so two counters printing one bill cannot both pass.
 */

type Db = Pick<Prisma.TransactionClient, '$queryRaw'>;

export const STICKER_DOC_TYPES = ['PURCHASE_BILL', 'SHORTAGE_RECEIPT'] as const;
export type StickerDocType = (typeof STICKER_DOC_TYPES)[number];

/** The per-counter question after Post (C1): app_setting_def, max scope DEVICE. */
export const STICKER_AFTER_POST_SETTING = 'purchase.labels_after_post';
export const STICKER_AFTER_POST_VALUES = ['ASK', 'ALWAYS', 'NEVER'] as const;
export type StickerAfterPost = (typeof STICKER_AFTER_POST_VALUES)[number];

export type StickerDocState = 'NONE' | 'NOT' | 'PART' | 'DONE';

const DOC_WORDS: Record<StickerDocType, string> = {
  PURCHASE_BILL: 'This purchase bill',
  SHORTAGE_RECEIPT: 'This shortage receipt',
};

export function asStickerDocType(value: string | null | undefined): StickerDocType | null {
  const upper = (value ?? '').trim().toUpperCase();
  return (STICKER_DOC_TYPES as readonly string[]).includes(upper)
    ? (upper as StickerDocType)
    : null;
}

export interface StickerDocHead {
  docType: StickerDocType;
  docId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  /** '' while a draft has none. */
  refno: string;
  /** 'YYYY-MM-DD'. */
  docDate: string | null;
  status: string;
  supplierId: string | null;
  supplierName: string | null;
  /** The supplier's Short name (blank → null): a label's supplier_code when the lot has no supplier (F4). */
  supplierShort: string | null;
  /** DIRECT | GRN | SISTER_SALE on a bill; null on a shortage receipt. */
  sourceKind: string | null;
}

/** One live line of the document, with its item's tick and Def unit. */
export interface StickerDocLine {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemName: string | null;
  ticked: boolean;
  /** The line's *_to_base_factor (0 → 1). */
  factor: Prisma.Decimal;
  defUnitId: string | null;
  defFactor: Prisma.Decimal;
  defDecimals: number;
  /** A bill line made from a GRN: its GRN line / GRN; null otherwise. */
  grnLineId: string | null;
  grnId: string | null;
  grnYear: string | null;
  grnRefno: string | null;
}

/** Σ (qty + free) of one line's SALEABLE rows of one lot, in the line's unit. */
export interface StickerDocAlloc {
  lineId: string;
  lotId: string;
  qty: Prisma.Decimal;
  rowNo: number;
}

/** Labels of this document's jobs per item + lot (not FAILED). */
export interface StickerDocJobSum {
  itemId: string;
  lotId: string;
  printed: number;
  reprinted: number;
}

/** Labels of a cancelled bill of the same GRN lines, per item + lot (Q20). */
export interface StickerDocCarry {
  fromId: string;
  fromYear: string;
  fromRefno: string | null;
  itemId: string;
  lotId: string;
  labels: number;
}

/** One item + lot of the document: one Print-list line. */
export interface StickerDocEntry {
  itemId: string;
  lotId: string;
  itemName: string | null;
  ticked: boolean;
  defUnitId: string | null;
  /** Base units in. */
  base: Prisma.Decimal;
  needed: number;
  printedRaw: number;
  carriedRaw: number;
  /** min(printedRaw, needed). */
  printed: number;
  /** min(carriedRaw, needed − printed). */
  carried: number;
  left: number;
  reprinted: number;
  /** The document lines of this item + lot, line order (Q8 merges them). */
  lines: Array<{ lineId: string; lineNo: number; grnRefno: string | null }>;
  /** Sort key: the first line's number, then its first allocation row. */
  order: [number, number];
}

export interface StickerDocCounts {
  lines: StickerDocLine[];
  entries: StickerDocEntry[];
  carries: StickerDocCarry[];
}

// ─── Pure rules (the grid's arithmetic) ─────────────────────────────────────

/**
 * Labels one item + lot needs: the grid's
 * `CASE WHEN base <= 0 THEN 0 WHEN decimals > 0 THEN 1
 *       ELSE GREATEST(1, floor(round(base / def_factor, 6))) END`.
 */
export function neededLabels(
  base: Prisma.Decimal,
  defFactor: Prisma.Decimal,
  defDecimals: number,
): number {
  if (base.lessThanOrEqualTo(0)) {
    return 0;
  }
  if (defDecimals > 0) {
    return 1;
  }
  const factor = defFactor.isZero() ? new Prisma.Decimal(1) : defFactor;
  const whole = base.dividedBy(factor).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP).floor();
  return Math.max(1, whole.toNumber());
}

/** Per item + lot: needed, printed, carried, left (plan §4.2). */
export function foldDocCounts(input: {
  lines: readonly StickerDocLine[];
  allocs: readonly StickerDocAlloc[];
  jobs: readonly StickerDocJobSum[];
  carries: readonly StickerDocCarry[];
}): StickerDocEntry[] {
  const lineById = new Map(input.lines.map((line) => [line.lineId, line]));
  const byKey = new Map<
    string,
    StickerDocEntry & { defFactor: Prisma.Decimal; defDecimals: number }
  >();
  for (const alloc of input.allocs) {
    const line = lineById.get(alloc.lineId);
    if (!line) {
      continue;
    }
    const key = `${line.itemId}|${alloc.lotId}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        itemId: line.itemId,
        lotId: alloc.lotId,
        itemName: line.itemName,
        ticked: line.ticked,
        defUnitId: line.defUnitId,
        defFactor: line.defFactor,
        defDecimals: line.defDecimals,
        base: new Prisma.Decimal(0),
        needed: 0,
        printedRaw: 0,
        carriedRaw: 0,
        printed: 0,
        carried: 0,
        left: 0,
        reprinted: 0,
        lines: [],
        order: [line.lineNo, alloc.rowNo],
      };
      byKey.set(key, entry);
    }
    entry.base = entry.base.plus(alloc.qty.times(line.factor));
    if (!entry.lines.some((seen) => seen.lineId === line.lineId)) {
      entry.lines.push({ lineId: line.lineId, lineNo: line.lineNo, grnRefno: line.grnRefno });
    }
    if (
      line.lineNo < entry.order[0] ||
      (line.lineNo === entry.order[0] && alloc.rowNo < entry.order[1])
    ) {
      entry.order = [line.lineNo, alloc.rowNo];
    }
  }
  const jobs = new Map(input.jobs.map((sum) => [`${sum.itemId}|${sum.lotId}`, sum]));
  const carried = new Map<string, number>();
  for (const carry of input.carries) {
    const key = `${carry.itemId}|${carry.lotId}`;
    carried.set(key, (carried.get(key) ?? 0) + carry.labels);
  }
  const entries: StickerDocEntry[] = [];
  for (const [key, entry] of byKey) {
    const { defFactor, defDecimals, ...rest } = entry;
    rest.needed = neededLabels(rest.base, defFactor, defDecimals);
    rest.printedRaw = jobs.get(key)?.printed ?? 0;
    rest.reprinted = jobs.get(key)?.reprinted ?? 0;
    rest.carriedRaw = carried.get(key) ?? 0;
    rest.printed = Math.min(rest.printedRaw, rest.needed);
    rest.carried = Math.min(rest.carriedRaw, rest.needed - rest.printed);
    rest.left = rest.needed - rest.printed - rest.carried;
    rest.lines.sort((left, right) => left.lineNo - right.lineNo);
    entries.push(rest);
  }
  return entries.sort(
    (left, right) =>
      left.order[0] - right.order[0] ||
      left.order[1] - right.order[1] ||
      left.itemId.localeCompare(right.itemId) ||
      left.lotId.localeCompare(right.lotId),
  );
}

/** The grid's state_code over the entries it counts. */
export function docState(entries: readonly StickerDocEntry[]): StickerDocState {
  const needed = entries.reduce((sum, entry) => sum + entry.needed, 0);
  if (needed === 0) {
    return 'NONE';
  }
  const done = entries.reduce((sum, entry) => sum + entry.printedRaw + entry.carriedRaw, 0);
  if (done === 0) {
    return 'NOT';
  }
  return entries.every((entry) => entry.printedRaw + entry.carriedRaw >= entry.needed)
    ? 'DONE'
    : 'PART';
}

export function docTotals(entries: readonly StickerDocEntry[]): {
  needed: number;
  printed: number;
  carried: number;
  left: number;
} {
  return entries.reduce(
    (sum, entry) => ({
      needed: sum.needed + entry.needed,
      printed: sum.printed + entry.printed,
      carried: sum.carried + entry.carried,
      left: sum.left + entry.left,
    }),
    { needed: 0, printed: 0, carried: 0, left: 0 },
  );
}

/** A Print-list line's key (plan §7.1): `D:<srcLineId>:<lotId>`. */
export const docLineKey = (entry: StickerDocEntry): string =>
  `D:${entry.lines[0]?.lineId ?? ''}:${entry.lotId}`;

// ─── Answers ────────────────────────────────────────────────────────────────

export interface StickerDocLineAnswer extends StickerLine {
  srcDocType: StickerDocType;
  srcDocId: string;
  srcAccYear: string;
  srcRefno: string;
  srcLineId: string;
  srcLineNo: number;
  srcLineNos: number[];
  srcGrnRefno: string | null;
  needed: number;
  printed: number;
  carried: number;
  left: number;
  reprinted: number;
}

export interface StickerFromGrn {
  grnId: string;
  accYear: string;
  refno: string | null;
}

export interface StickerFromDocAnswer {
  doc: {
    docType: StickerDocType;
    docId: string;
    accYear: string;
    refno: string;
    docDate: string | null;
    status: string;
    supplierId: string | null;
    supplierName: string | null;
    sourceKind: string | null;
    fromGrns: StickerFromGrn[];
    linesAll: number;
    linesTicked: number;
  };
  lines: StickerDocLineAnswer[];
  skipped: { notTicked: Array<{ lineNo: number; itemName: string | null }> };
  assignment: StickerAssignment;
}

export interface StickerDocStateAnswer {
  docType: StickerDocType;
  docId: string;
  accYear: string;
  refno: string;
  status: string;
  sourceKind: string | null;
  fromGrns: StickerFromGrn[];
  linesAll: number;
  linesTicked: number;
  needed: number;
  printed: number;
  carried: number;
  left: number;
  state: StickerDocState;
  jobs: Array<{
    jobId: string;
    jobNo: string;
    accYear: string;
    labels: number;
    kind: string;
    /**
     * F2: true when the job prints labels again — a REPRINT, or a resend of a
     * failed reprint (kind PRINT, its lines copy a reprint's). Such a job never
     * counts in printed. false = a real print (or a resend of one).
     */
    reprint: boolean;
    status: string;
    printedOn: string | null;
  }>;
  carriedFrom: Array<{ docId: string; accYear: string; refno: string | null; labels: number }>;
  afterPost: StickerAfterPost;
}

/** One request line of a job with a source (§7.3). */
export interface StickerDocPrintLine {
  itemId: string;
  unitId: string;
  lotId?: string | null;
  labels: number;
  srcLineId?: string | null;
  /** The item's name for the words; absent = the document line's. */
  itemName?: string | null;
}

@Injectable()
export class StickerDocSourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly lines: StickerLinesService,
  ) {}

  // ═══ GET /stickers/lines/from-doc ═════════════════════════════════════════

  async fromDoc(q: {
    companyId: string;
    branchId: string;
    purposeCode: string;
    priceLevel: number;
    docType: string;
    docId: string;
    accYear: string;
    stickerOnly?: boolean;
  }): Promise<StickerFromDocAnswer> {
    await this.lines.assertRight('view');
    const scope = await this.lines.scopeFor(q);
    const docType = this.docTypeOf(q.docType);
    const head = await this.loadHead(this.prisma, { ...q, docType });
    this.assertPosted(head);
    const counts = await this.readCounts(this.prisma, head);
    const stickerOnly = q.stickerOnly ?? true;
    const linesTicked = counts.lines.filter((line) => line.ticked).length;
    if (stickerOnly && linesTicked === 0) {
      refuseSticker(
        STICKER_ERROR.DOC_NOTHING_TICKED,
        `${this.docName(head)} has no line whose item is ticked Sticker (stickerOnly)`,
        'stickerOnly',
        { params: { doc: this.docName(head) } },
      );
    }
    const entries = counts.entries.filter(
      (entry) => entry.needed > 0 && (!stickerOnly || entry.ticked),
    );
    // The builder decides barcode, MRP, Our price, design, codes and Last
    // printed exactly as for a typed line, with the Def unit and the row's lot.
    // It needs labels 1-9,999 to call a line good; the answer then says left.
    const built = await this.lines.buildLines(
      scope,
      entries.map((entry) => ({
        key: docLineKey(entry),
        itemId: entry.itemId,
        unitId: entry.defUnitId,
        lotId: entry.lotId,
        labels: Math.min(Math.max(entry.left, 1), STICKER_MAX_LABELS_PER_LINE),
      })),
    );
    const lines: StickerDocLineAnswer[] = built.map((entry, index) => {
      const counted = entries[index];
      const first = counted.lines[0];
      return {
        ...entry.line,
        // F9: one line takes at most 9,999 labels; the rest stays left.
        labels: Math.min(counted.left, STICKER_MAX_LABELS_PER_LINE),
        srcDocType: head.docType,
        srcDocId: head.docId,
        srcAccYear: head.accYear,
        srcRefno: head.refno,
        srcLineId: first.lineId,
        srcLineNo: first.lineNo,
        srcLineNos: counted.lines.map((line) => line.lineNo),
        srcGrnRefno: first.grnRefno,
        needed: counted.needed,
        printed: counted.printed,
        carried: counted.carried,
        left: counted.left,
        reprinted: counted.reprinted,
      };
    });
    return {
      doc: {
        docType: head.docType,
        docId: head.docId,
        accYear: head.accYear,
        refno: head.refno,
        docDate: dmyText(head.docDate),
        status: head.status,
        supplierId: head.supplierId,
        supplierName: head.supplierName,
        sourceKind: head.sourceKind,
        fromGrns: this.fromGrns(counts.lines),
        linesAll: counts.lines.length,
        linesTicked,
      },
      lines,
      skipped: {
        notTicked: stickerOnly
          ? counts.lines
              .filter((line) => !line.ticked)
              .map((line) => ({ lineNo: line.lineNo, itemName: line.itemName }))
          : [],
      },
      assignment: scope.assignment,
    };
  }

  // ═══ GET /stickers/docs/state ═════════════════════════════════════════════

  async state(q: {
    companyId: string;
    branchId: string;
    docType: string;
    docId: string;
    accYear: string;
  }): Promise<StickerDocStateAnswer> {
    await this.lines.assertRight('view');
    await this.lines.assertBranchInCompany(q.companyId, q.branchId);
    const docType = this.docTypeOf(q.docType);
    // Any status (C14): the pill and the cancel sentence read a posted or a
    // cancelled one alike; a draft has no lot yet, so it is NONE.
    const head = await this.loadHead(this.prisma, { ...q, docType });
    const counts = await this.readCounts(this.prisma, head);
    const ticked = counts.entries.filter((entry) => entry.ticked);
    const totals = docTotals(ticked);
    const keys = new Set(ticked.map((entry) => `${entry.itemId}|${entry.lotId}`));
    const carriedFrom = new Map<
      string,
      { docId: string; accYear: string; refno: string | null; labels: number }
    >();
    for (const carry of counts.carries) {
      if (!keys.has(`${carry.itemId}|${carry.lotId}`)) {
        continue;
      }
      const key = `${carry.fromId}|${carry.fromYear}`;
      const row = carriedFrom.get(key) ?? {
        docId: carry.fromId,
        accYear: carry.fromYear,
        refno: carry.fromRefno,
        labels: 0,
      };
      row.labels += carry.labels;
      carriedFrom.set(key, row);
    }
    return {
      docType: head.docType,
      docId: head.docId,
      accYear: head.accYear,
      refno: head.refno,
      status: head.status,
      sourceKind: head.sourceKind,
      fromGrns: this.fromGrns(counts.lines),
      linesAll: counts.lines.length,
      linesTicked: counts.lines.filter((line) => line.ticked).length,
      ...totals,
      state: docState(ticked),
      jobs: await this.jobsOf(head),
      carriedFrom: [...carriedFrom.values()].sort((left, right) =>
        (left.refno ?? '').localeCompare(right.refno ?? ''),
      ),
      afterPost: await this.afterPost(q.companyId, q.branchId, this.requestContext.getDeviceId()),
    };
  }

  // ═══ /jobs/print with a source (§4.4, §7.3) ═══════════════════════════════

  /**
   * The source and line checks of a job with a source (§7.3 steps 1-2), and
   * the in-transaction "left" check (step 3) as the job's guard. Refuses by
   * throwing.
   */
  async prepareDocJob(args: {
    companyId: string;
    branchId: string;
    source: { docType: string; docId: string; accYear: string };
    lines: readonly StickerDocPrintLine[];
  }): Promise<{
    source: StickerJobSource;
    head: StickerDocHead;
    guard: (tx: Prisma.TransactionClient) => Promise<void>;
  }> {
    const docType = this.docTypeOf(args.source.docType, 'source.docType');
    const head = await this.loadHead(this.prisma, {
      companyId: args.companyId,
      branchId: args.branchId,
      docType,
      docId: args.source.docId,
      accYear: args.source.accYear,
    });
    this.assertPosted(head);
    const counts = await this.readCounts(this.prisma, head);
    // The words name the item as the document does.
    const names = new Map(counts.lines.map((line) => [line.itemId, line.itemName]));
    const lines = args.lines.map((line) => ({
      ...line,
      itemName: line.itemName ?? names.get(line.itemId) ?? null,
    }));
    this.checkDocLines(head, counts, lines);
    return {
      source: {
        docType: head.docType,
        docId: head.docId,
        accYear: head.accYear,
        refno: head.refno,
      },
      head,
      guard: async (tx) => {
        await this.lockDocument(tx, head);
        // Read again under the lock: the document may have been cancelled, and
        // another counter's job may have committed while this one waited.
        const now = await this.loadHead(tx, {
          companyId: args.companyId,
          branchId: args.branchId,
          docType,
          docId: head.docId,
          accYear: head.accYear,
        });
        this.assertPosted(now);
        this.checkLeft(now, (await this.readCounts(tx, now)).entries, lines);
      },
    };
  }

  /**
   * F1 (review 2026-11-26): a resend of a FAILED job that has a document
   * source, inside the job's transaction after the numbering and resend
   * locks (order numbering → resend → document; print takes numbering →
   * document, so no cycle): lock the document, read it again — not POSTED any
   * more → STICKER_DOC_NOT_POSTED, as print — then the failed job's print
   * lines (not a reprint's copies, which never count, F2) per item + lot must
   * be ≤ left (STICKER_DOC_OVER_LEFT, the same params / meta as print). The
   * FAILED job never counted, so its labels are asked afresh.
   */
  async checkDocResend(
    tx: Db,
    args: {
      companyId: string;
      branchId: string;
      source: { docType: string; docId: string; accYear: string };
      lines: readonly StickerDocPrintLine[];
    },
  ): Promise<void> {
    const docType = this.docTypeOf(args.source.docType, 'jobId');
    await this.lockDocument(tx, {
      companyId: args.companyId,
      branchId: args.branchId,
      docId: args.source.docId,
    });
    const head = await this.loadHead(tx, {
      companyId: args.companyId,
      branchId: args.branchId,
      docType,
      docId: args.source.docId,
      accYear: args.source.accYear,
    });
    this.assertPosted(head);
    if (args.lines.length > 0) {
      const counts = await this.readCounts(tx, head);
      const names = new Map(counts.lines.map((line) => [line.itemId, line.itemName]));
      this.checkLeft(
        head,
        counts.entries,
        args.lines.map((line) => ({
          ...line,
          itemName: line.itemName ?? names.get(line.itemId) ?? null,
        })),
      );
    }
  }

  /** A job without a source holds no document line (C6). */
  refuseManualDocLines(lines: ReadonlyArray<{ srcLineId?: string | null }>): void {
    const index = lines.findIndex((line) => !!line.srcLineId);
    if (index >= 0) {
      refuseSticker(
        STICKER_ERROR.DOC_LINE_NOT_ON_DOC,
        `Line ${index + 1} names a document line (srcLineId) but the job has no source document; ` +
          'a manual job holds no document line',
        'srcLineId',
        { line: index + 1, params: { doc: 'its document' } },
      );
    }
  }

  /** §7.3 step 2: every line is of this document, its item and lot, in the Def unit. */
  private checkDocLines(
    head: StickerDocHead,
    counts: StickerDocCounts,
    lines: readonly StickerDocPrintLine[],
  ): void {
    const byLine = new Map(counts.lines.map((line) => [line.lineId, line]));
    const lotsOf = new Map<string, Set<string>>();
    for (const entry of counts.entries) {
      for (const line of entry.lines) {
        const lots = lotsOf.get(line.lineId) ?? new Set<string>();
        lots.add(entry.lotId);
        lotsOf.set(line.lineId, lots);
      }
    }
    const doc = this.docName(head);
    lines.forEach((line, index) => {
      const lineNo = index + 1;
      const item = line.itemName ?? line.itemId;
      const notOnDoc = (why: string, field: string): never =>
        refuseSticker(STICKER_ERROR.DOC_LINE_NOT_ON_DOC, `Line ${lineNo}: ${why}`, field, {
          line: lineNo,
          params: { doc, item },
        });
      if (!line.srcLineId) {
        return notOnDoc(
          `a job from ${doc} holds only its lines, and this one names no srcLineId`,
          'srcLineId',
        );
      }
      const docLine = byLine.get(line.srcLineId);
      if (!docLine) {
        return notOnDoc(`srcLineId ${line.srcLineId} is not a line of ${doc}`, 'srcLineId');
      }
      if (docLine.itemId !== line.itemId) {
        return notOnDoc(`line ${docLine.lineNo} of ${doc} is another item, not ${item}`, 'itemId');
      }
      if (!line.lotId || !lotsOf.get(docLine.lineId)?.has(line.lotId)) {
        return notOnDoc(
          line.lotId
            ? `lot ${line.lotId} did not come in on line ${docLine.lineNo} of ${doc}`
            : `a line from ${doc} names its lot (lotId)`,
          'lotId',
        );
      }
      if (!docLine.defUnitId || docLine.defUnitId !== line.unitId) {
        refuseSticker(
          STICKER_ERROR.DOC_LINE_NOT_ON_DOC,
          `Line ${lineNo}: ${item} prints from ${doc} in its default unit only (C2)`,
          'unitId',
          { rule: 'UNIT', line: lineNo, params: { doc, item } },
        );
      }
    });
  }

  /** §7.3 step 3 (under the lock): the labels per item + lot ≤ left. */
  private checkLeft(
    head: StickerDocHead,
    entries: readonly StickerDocEntry[],
    lines: readonly StickerDocPrintLine[],
  ): void {
    const byKey = new Map(entries.map((entry) => [`${entry.itemId}|${entry.lotId}`, entry]));
    const asked = new Map<string, { labels: number; firstLine: number; itemName: string }>();
    lines.forEach((line, index) => {
      const key = `${line.itemId}|${line.lotId ?? ''}`;
      const seen = asked.get(key) ?? {
        labels: 0,
        firstLine: index + 1,
        itemName: line.itemName ?? line.itemId,
      };
      seen.labels += line.labels;
      asked.set(key, seen);
    });
    const doc = this.docName(head);
    for (const [key, want] of asked) {
      const entry = byKey.get(key);
      const needed = entry?.needed ?? 0;
      const printed = entry?.printed ?? 0;
      const carried = entry?.carried ?? 0;
      const left = entry?.left ?? 0;
      if (want.labels <= left) {
        continue;
      }
      const [itemId, lotId] = key.split('|');
      const meta = { itemId, lotId, needed, printed, carried, left };
      const params = { doc, item: want.itemName, printed: printed + carried, needed, left };
      if (left === 0) {
        refuseSticker(
          STICKER_ERROR.DOC_OVER_LEFT,
          `${want.itemName}: ${printed + carried} of ${needed} labels of ${doc} are printed; nothing is ` +
            `left (asked ${want.labels}). Reprint in Printed jobs prints more`,
          'labels',
          { line: want.firstLine, params, meta },
        );
      }
      refuseSticker(
        STICKER_ERROR.DOC_OVER_LEFT,
        `${want.itemName}: only ${left} labels of ${doc} are left to print, asked ${want.labels}`,
        'labels',
        { rule: 'LEFT', line: want.firstLine, params, meta },
      );
    }
  }

  // ═══ Gates ════════════════════════════════════════════════════════════════

  docTypeOf(value: string, field = 'docType'): StickerDocType {
    const docType = asStickerDocType(value);
    if (!docType) {
      refuseSticker(
        STICKER_ERROR.DOC_TYPE_INVALID,
        `docType "${value}" is not PURCHASE_BILL or SHORTAGE_RECEIPT`,
        field,
      );
    }
    return docType;
  }

  /** The document's head: in this company (else 404) and this branch (else 422). Any status. */
  async loadHead(
    db: Db,
    args: {
      companyId: string;
      branchId: string;
      docType: StickerDocType;
      docId: string;
      accYear: string;
    },
  ): Promise<StickerDocHead> {
    const rows =
      args.docType === 'PURCHASE_BILL'
        ? await db.$queryRaw<HeadRow[]>`
            SELECT p.pi_id AS doc_id, p.pi_acc_year::text AS acc_year, p.pi_company_id AS company_id,
                   p.pi_branch_id AS branch_id, COALESCE(p.pi_refno, '') AS refno,
                   p.pi_doc_date::text AS doc_date, p.pi_status AS status, p.pi_is_deleted AS is_deleted,
                   p.pi_supplier_id AS supplier_id, s.sup_name AS supplier_name,
                   NULLIF(btrim(s.sup_short), '') AS supplier_short,
                   p.pi_source_kind::text AS source_kind
              FROM purchase.pur_invoice p
              LEFT JOIN purchase.suppliers s ON s.sup_id = p.pi_supplier_id
             WHERE p.pi_id = ${args.docId}::uuid AND p.pi_acc_year = ${args.accYear}::char(9)`
        : await db.$queryRaw<HeadRow[]>`
            SELECT r.psr_id AS doc_id, r.psr_acc_year::text AS acc_year, r.psr_company_id AS company_id,
                   r.psr_branch_id AS branch_id, COALESCE(r.psr_refno, '') AS refno,
                   r.psr_doc_date::text AS doc_date, r.psr_status AS status, r.psr_is_deleted AS is_deleted,
                   r.psr_supplier_id AS supplier_id, s.sup_name AS supplier_name,
                   NULLIF(btrim(s.sup_short), '') AS supplier_short,
                   NULL::text AS source_kind
              FROM purchase.pur_shortage_receipt r
              LEFT JOIN purchase.suppliers s ON s.sup_id = r.psr_supplier_id
             WHERE r.psr_id = ${args.docId}::uuid AND r.psr_acc_year = ${args.accYear}::char(9)`;
    const row = rows[0];
    if (!row || row.is_deleted || row.company_id !== args.companyId) {
      refuseSticker(
        STICKER_ERROR.DOC_NOT_FOUND,
        `No ${args.docType} ${args.docId} (${args.accYear}) in this company`,
        'docId',
        { params: { doc: DOC_WORDS[args.docType] } },
      );
    }
    const head: StickerDocHead = {
      docType: args.docType,
      docId: row.doc_id,
      accYear: row.acc_year,
      companyId: row.company_id,
      branchId: row.branch_id,
      refno: row.refno,
      docDate: isoDay(row.doc_date),
      status: row.status,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      supplierShort: row.supplier_short ?? null,
      sourceKind: row.source_kind,
    };
    if (row.branch_id !== args.branchId) {
      refuseSticker(
        STICKER_ERROR.DOC_OTHER_BRANCH,
        `${this.docName(head)} belongs to another branch; its stickers print there (Q17)`,
        'branchId',
        { params: { doc: this.docName(head) } },
      );
    }
    return head;
  }

  assertPosted(head: StickerDocHead): void {
    if (head.status !== 'POSTED') {
      refuseSticker(
        STICKER_ERROR.DOC_NOT_POSTED,
        `${this.docName(head)} is ${head.status}; only a posted document gives stickers`,
        'docId',
        { params: { doc: this.docName(head), status: head.status.toLowerCase() } },
      );
    }
  }

  /**
   * C5: one document's "left" is checked by one transaction at a time —
   * pg_advisory_xact_lock(hashtextextended('STICKER_DOC|company|branch|doc', 0)),
   * held to the job's commit. Code, never a constraint (§5).
   */
  async lockDocument(
    tx: Db,
    head: Pick<StickerDocHead, 'companyId' | 'branchId' | 'docId'>,
  ): Promise<void> {
    const key = `STICKER_DOC|${head.companyId}|${head.branchId}|${head.docId}`;
    await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtextextended(${key}::text, 0)))::int AS locked`;
  }

  /** `{doc}` in the words: the number, else "This purchase bill" (a draft has none). */
  docName(head: StickerDocHead): string {
    return head.refno.trim() || DOC_WORDS[head.docType];
  }

  // ═══ Reads ════════════════════════════════════════════════════════════════

  /** The document's lines, rows, job sums and carry-over, folded per item + lot. */
  async readCounts(db: Db, head: StickerDocHead): Promise<StickerDocCounts> {
    const ln = this.linesSql(head);
    const lineRows = await db.$queryRaw<LineRow[]>`
      WITH ln AS (${ln})
      SELECT ln.line_id, ln.line_no, ln.item_id, ln.factor, ln.grn_line_id, ln.grn_id,
             ln.grn_year::text AS grn_year, g.grn_refno,
             i.item_name_en AS item_name, COALESCE(i.item_barcode_sticker, false) AS ticked,
             u.iuc_id AS def_unit_id, COALESCE(u.factor, 1) AS def_factor,
             COALESCE(u.decimals, 0)::int AS def_decimals
        FROM ln
        JOIN inventory.item_master i ON i.item_id = ln.item_id
        LEFT JOIN purchase.pur_grn g ON g.grn_id = ln.grn_id AND g.grn_acc_year = ln.grn_year
        LEFT JOIN LATERAL (
              SELECT c.iuc_id,
                     COALESCE(NULLIF(c.iuc_to_base_factor, 0), 1) AS factor,
                     COALESCE(m.unit_decimal_count, 0) AS decimals
                FROM inventory.item_unit_conversion c
                LEFT JOIN inventory.item_unit_master m ON m.unit_id = c.iuc_unit_id
               WHERE c.iuc_item_id = i.item_id
                 AND c.iuc_is_deleted = false
               ORDER BY c.iuc_is_default_unit DESC, c.iuc_is_base_unit DESC, c.iuc_unit_slno
               LIMIT 1) u ON true
       ORDER BY ln.line_no, ln.line_id`;
    const allocRows = await db.$queryRaw<AllocRow[]>`
      WITH ln AS (${ln})
      SELECT ln.line_id, a.pia_lot_id AS lot_id, SUM(a.pia_qty + a.pia_free_qty) AS qty,
             MIN(a.pia_row_no)::int AS row_no
        FROM ln
        JOIN purchase.pur_item_alloc a
          ON a.pia_doc_type = ln.alloc_type
         AND a.pia_line_id = ln.alloc_line_id
         AND a.pia_acc_year = ln.alloc_year
         AND a.pia_is_deleted = false
       WHERE a.pia_bucket = 'SALEABLE'
         AND a.pia_lot_id IS NOT NULL
       GROUP BY ln.line_id, a.pia_lot_id`;
    const jobRows = await db.$queryRaw<JobSumRow[]>`
      SELECT l.lbjl_item_id AS item_id, l.lbjl_lot_id AS lot_id,
             COALESCE(SUM(l.lbjl_labels) FILTER (
               WHERE j.lbj_kind = 'PRINT' AND l.lbjl_reprint_of_line_id IS NULL), 0)::int AS printed,
             COALESCE(SUM(l.lbjl_labels) FILTER (
               WHERE j.lbj_kind = 'REPRINT' OR l.lbjl_reprint_of_line_id IS NOT NULL), 0)::int AS reprinted
        FROM inventory.label_job j
        JOIN inventory.label_job_line l
          ON l.lbjl_job_id = j.lbj_id AND l.lbjl_acc_year = j.lbj_acc_year
       WHERE j.lbj_src_doc_id = ${head.docId}::uuid
         AND j.lbj_src_acc_year = ${head.accYear}::char(9)
         AND j.lbj_src_doc_type = ${head.docType}
         AND j.lbj_status <> 'FAILED'
         AND l.lbjl_lot_id IS NOT NULL
       GROUP BY l.lbjl_item_id, l.lbjl_lot_id`;
    const lines: StickerDocLine[] = lineRows.map((row) => ({
      lineId: row.line_id,
      lineNo: Number(row.line_no),
      itemId: row.item_id,
      itemName: row.item_name,
      ticked: row.ticked === true,
      factor: new Prisma.Decimal(row.factor as Prisma.Decimal.Value),
      defUnitId: row.def_unit_id,
      defFactor: new Prisma.Decimal(row.def_factor as Prisma.Decimal.Value),
      defDecimals: Number(row.def_decimals ?? 0),
      grnLineId: row.grn_line_id,
      grnId: row.grn_id,
      grnYear: row.grn_year,
      grnRefno: row.grn_refno,
    }));
    const carries =
      head.docType === 'PURCHASE_BILL' && lines.some((line) => line.grnLineId)
        ? await this.readCarries(db, head, ln)
        : [];
    const entries = foldDocCounts({
      lines,
      allocs: allocRows.map((row) => ({
        lineId: row.line_id,
        lotId: row.lot_id,
        qty: new Prisma.Decimal(row.qty as Prisma.Decimal.Value),
        rowNo: Number(row.row_no ?? 0),
      })),
      jobs: jobRows.map((row) => ({
        itemId: row.item_id,
        lotId: row.lot_id,
        printed: Number(row.printed),
        reprinted: Number(row.reprinted),
      })),
      carries,
    });
    return { lines, entries, carries };
  }

  /**
   * Q20 / C4 (the grid's carried_from + carried): the PRINT jobs (not FAILED)
   * of CANCELLED bills with a line of the same GRN line and the same item.
   */
  private async readCarries(
    db: Db,
    head: StickerDocHead,
    ln: Prisma.Sql,
  ): Promise<StickerDocCarry[]> {
    const rows = await db.$queryRaw<
      Array<{
        from_id: string;
        from_year: string;
        from_refno: string | null;
        item_id: string;
        lot_id: string;
        labels: number;
      }>
    >`
      WITH ln AS (${ln}),
      from_bills AS (
        SELECT DISTINCT ln.item_id, x.pi_id AS from_id, x.pi_acc_year AS from_year, x.pi_refno AS from_refno
          FROM ln
          JOIN purchase.pur_invoice_item xl
            ON xl.pii_src_doc_type = 'GRN'
           AND xl.pii_src_item_id = ln.grn_line_id
           AND xl.pii_src_doc_year = ln.grn_year
           AND xl.pii_src_item_id IS NOT NULL
           AND xl.pii_is_deleted = false
           AND xl.pii_item_id = ln.item_id
          JOIN purchase.pur_invoice x
            ON x.pi_id = xl.pii_pi_id
           AND x.pi_acc_year = xl.pii_acc_year
           AND x.pi_status = 'CANCELLED'
         WHERE ln.grn_line_id IS NOT NULL
           AND x.pi_id <> ${head.docId}::uuid
      )
      SELECT f.from_id, f.from_year::text AS from_year, f.from_refno,
             l.lbjl_item_id AS item_id, l.lbjl_lot_id AS lot_id, SUM(l.lbjl_labels)::int AS labels
        FROM from_bills f
        JOIN inventory.label_job j
          ON j.lbj_src_doc_id = f.from_id
         AND j.lbj_src_acc_year = f.from_year
         AND j.lbj_src_doc_type = 'PURCHASE_BILL'
        JOIN inventory.label_job_line l
          ON l.lbjl_job_id = j.lbj_id
         AND l.lbjl_acc_year = j.lbj_acc_year
         AND l.lbjl_item_id = f.item_id
       WHERE j.lbj_kind = 'PRINT'
         AND j.lbj_status <> 'FAILED'
         AND l.lbjl_reprint_of_line_id IS NULL
         AND l.lbjl_lot_id IS NOT NULL
       GROUP BY f.from_id, f.from_year, f.from_refno, l.lbjl_item_id, l.lbjl_lot_id`;
    return rows.map((row) => ({
      fromId: row.from_id,
      fromYear: row.from_year,
      fromRefno: row.from_refno,
      itemId: row.item_id,
      lotId: row.lot_id,
      labels: Number(row.labels),
    }));
  }

  /** §4.1: the document's live lines and where their allocation rows are. */
  private linesSql(head: StickerDocHead): Prisma.Sql {
    if (head.docType === 'PURCHASE_BILL') {
      return Prisma.sql`
        SELECT l.pii_id AS line_id, l.pii_line_no AS line_no, l.pii_item_id AS item_id,
               COALESCE(NULLIF(l.pii_to_base_factor, 0), 1) AS factor,
               CASE WHEN l.pii_src_doc_type = 'GRN' THEN 'GRN' ELSE 'PURCHASE_BILL' END AS alloc_type,
               CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_item_id ELSE l.pii_id END AS alloc_line_id,
               CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_doc_year ELSE l.pii_acc_year END AS alloc_year,
               CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_item_id END AS grn_line_id,
               CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_doc_id END AS grn_id,
               CASE WHEN l.pii_src_doc_type = 'GRN' THEN l.pii_src_doc_year END AS grn_year
          FROM purchase.pur_invoice_item l
         WHERE l.pii_pi_id = ${head.docId}::uuid
           AND l.pii_acc_year = ${head.accYear}::char(9)
           AND l.pii_is_deleted = false`;
    }
    return Prisma.sql`
      SELECT l.psri_id AS line_id, l.psri_line_no AS line_no, l.psri_item_id AS item_id,
             COALESCE(NULLIF(l.psri_to_base_factor, 0), 1) AS factor,
             'SHORTAGE_RECEIPT'::text AS alloc_type,
             l.psri_id AS alloc_line_id,
             l.psri_acc_year AS alloc_year,
             NULL::uuid AS grn_line_id,
             NULL::uuid AS grn_id,
             NULL::character(9) AS grn_year
        FROM purchase.pur_shortage_receipt_item l
       WHERE l.psri_psr_id = ${head.docId}::uuid
         AND l.psri_acc_year = ${head.accYear}::char(9)
         AND l.psri_is_deleted = false`;
  }

  /** The GRNs a bill's lines were made from (distinct, by number). */
  private fromGrns(lines: readonly StickerDocLine[]): StickerFromGrn[] {
    const seen = new Map<string, StickerFromGrn>();
    for (const line of lines) {
      if (line.grnId && line.grnYear && !seen.has(`${line.grnId}|${line.grnYear}`)) {
        seen.set(`${line.grnId}|${line.grnYear}`, {
          grnId: line.grnId,
          accYear: line.grnYear,
          refno: line.grnRefno,
        });
      }
    }
    return [...seen.values()].sort((left, right) =>
      (left.refno ?? '').localeCompare(right.refno ?? ''),
    );
  }

  /** Every job of the document (any kind and status), oldest first. */
  private async jobsOf(head: StickerDocHead): Promise<StickerDocStateAnswer['jobs']> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        lbj_id: string;
        lbj_refno: string;
        lbj_acc_year: string;
        lbj_label_count: number;
        lbj_kind: string;
        reprint: boolean;
        lbj_status: string;
        lbj_printed_on: Date;
      }>
    >`
      SELECT j.lbj_id, j.lbj_refno, j.lbj_acc_year::text AS lbj_acc_year, j.lbj_label_count,
             j.lbj_kind, j.lbj_status, j.lbj_printed_on,
             (j.lbj_kind = 'REPRINT' OR EXISTS (
                SELECT 1 FROM inventory.label_job_line l
                 WHERE l.lbjl_job_id = j.lbj_id AND l.lbjl_acc_year = j.lbj_acc_year
                   AND l.lbjl_reprint_of_line_id IS NOT NULL)) AS reprint
        FROM inventory.label_job j
       WHERE j.lbj_src_doc_id = ${head.docId}::uuid
         AND j.lbj_src_acc_year = ${head.accYear}::char(9)
         AND j.lbj_src_doc_type = ${head.docType}
       ORDER BY j.lbj_printed_on, j.lbj_id`;
    return rows.map((row) => ({
      jobId: row.lbj_id,
      jobNo: row.lbj_refno,
      accYear: row.lbj_acc_year,
      labels: Number(row.lbj_label_count),
      kind: row.lbj_kind,
      reprint: row.reprint === true,
      status: row.lbj_status,
      printedOn: istDateTimeText(row.lbj_printed_on),
    }));
  }

  /**
   * C1: "Stickers after post" for this counter — fn_app_settings_effective
   * with the session's device (DEVICE → BRANCH → COMPANY → default ASK).
   */
  async afterPost(
    companyId: string,
    branchId: string,
    deviceId: string | null,
  ): Promise<StickerAfterPost> {
    const [row] = await this.prisma.$queryRaw<{ value: string | null }[]>`
      SELECT out_effective_value AS value
        FROM public.fn_app_settings_effective(${companyId}::uuid, ${branchId}::uuid,
                                              ${deviceId}::uuid, NULL::uuid)
       WHERE out_asd_key = ${STICKER_AFTER_POST_SETTING}`;
    const value = (row?.value ?? '').trim().toUpperCase();
    return (STICKER_AFTER_POST_VALUES as readonly string[]).includes(value)
      ? (value as StickerAfterPost)
      : 'ASK';
  }

  /**
   * What a reprint / resend label reads from its job's source document
   * (§7.5, F4): the date (dd/MM/yyyy) for `doc_date`, and the document
   * supplier's Short name for `supplier_code` when the line's lot has no
   * supplier (a blank Short name stays blank, user 2026-11-26). Read when the
   * label is laid out, never frozen; nulls when the document is gone.
   */
  async docLabelFacts(source: {
    docType: string;
    docId: string;
    accYear: string;
  }): Promise<{ docDate: string | null; supplierCode: string | null }> {
    const docType = asStickerDocType(source.docType);
    if (!docType) {
      return { docDate: null, supplierCode: null };
    }
    const [row] =
      docType === 'PURCHASE_BILL'
        ? await this.prisma.$queryRaw<{ d: string | null; short: string | null }[]>`
            SELECT p.pi_doc_date::text AS d, NULLIF(btrim(s.sup_short), '') AS short
              FROM purchase.pur_invoice p
              LEFT JOIN purchase.suppliers s ON s.sup_id = p.pi_supplier_id
             WHERE p.pi_id = ${source.docId}::uuid AND p.pi_acc_year = ${source.accYear}::char(9)`
        : await this.prisma.$queryRaw<{ d: string | null; short: string | null }[]>`
            SELECT r.psr_doc_date::text AS d, NULLIF(btrim(s.sup_short), '') AS short
              FROM purchase.pur_shortage_receipt r
              LEFT JOIN purchase.suppliers s ON s.sup_id = r.psr_supplier_id
             WHERE r.psr_id = ${source.docId}::uuid AND r.psr_acc_year = ${source.accYear}::char(9)`;
    return { docDate: dmyText(row?.d ?? null), supplierCode: row?.short ?? null };
  }
}

interface HeadRow {
  doc_id: string;
  acc_year: string;
  company_id: string;
  branch_id: string;
  refno: string;
  doc_date: string | null;
  status: string;
  is_deleted: boolean;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_short: string | null;
  source_kind: string | null;
}

interface LineRow {
  line_id: string;
  line_no: number;
  item_id: string;
  factor: unknown;
  grn_line_id: string | null;
  grn_id: string | null;
  grn_year: string | null;
  grn_refno: string | null;
  item_name: string | null;
  ticked: boolean | null;
  def_unit_id: string | null;
  def_factor: unknown;
  def_decimals: number | null;
}

interface AllocRow {
  line_id: string;
  lot_id: string;
  qty: unknown;
  row_no: number | null;
}

interface JobSumRow {
  item_id: string;
  lot_id: string;
  printed: number;
  reprinted: number;
}
