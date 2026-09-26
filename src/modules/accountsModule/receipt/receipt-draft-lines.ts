import { Prisma } from '@prisma/client';
import type { ReceiptOtherLine } from './types/receipt-api.types';
import { DrCr } from './types/receipt-enum';

/**
 * What lives in `acc_voucher_header.avh_draft_lines`, and how it is read back.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS COLUMN HOLDS TWO THINGS AND NOT ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * §2.6 adds the column for the other-ledger lines, which have no home until
 * they become legs at post (R10). But a DRAFT has a second piece of
 * homeless data, and the plan does not say where it goes: the CHEQUE DETAIL.
 *
 * `accounts.acc_tender_detail` carries `td_ref_no`, `td_bank_name` and
 * `td_instrument_date` — and nothing else about an instrument. A cheque also
 * has a bank branch, an IFSC, a MICR line, a drawer name and the bank it will
 * be deposited into, all of which `/receipts/create` accepts (§4.3's
 * `cheque: {…}`) and all of which `acc_pdc_register` needs at post. There is
 * nowhere on the tender row to keep them between the two.
 *
 * The alternatives were worse:
 *
 *   · Write the `acc_pdc_register` row at DRAFT time. It would work —
 *     `apd_voucher_id` can point at a draft header — but an abandoned draft
 *     would leave a HELD cheque in the register, and `ux_apd_instrument` would
 *     then refuse the same cheque number when the operator re-keyed it.
 *
 *   · Add five columns to `acc_tender_detail`. A shared table changed for one
 *     module's draft, and every other tender row carrying five permanent NULLs.
 *
 * So the column holds an OBJECT: `{ otherLines, cheques }`. It is scratch space
 * for a draft, cleared to NULL at post, and nothing reads it but this module.
 *
 * ── The array form ───────────────────────────────────────────────────────
 * A bare ARRAY is also accepted, and read as `otherLines` with no cheque
 * detail. That is the shape §2.6 describes, so a row written by anything that
 * followed the plan literally still opens.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AND SINCE 2026-09-18, THE BILL-WISE SETTLEMENT — AS A NOTE, NOT A FACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reopening a draft used to lose the allocation: the tenders and the other
 * lines came back, the bill-wise settlement did not, so every reopened draft
 * was re-settled by hand. Alt+A covers "spread down the bills, oldest first"
 * and nothing else — not a split, and not a deliberate out-of-order
 * settlement, which is precisely the receipt somebody saves as a draft to
 * think about.
 *
 * `allocations` and `creditsApplied` now sit in this object beside the other
 * two, in the shape `/receipts/post` takes them.
 *
 * ── R10 is NOT being undone ──────────────────────────────────────────────
 * **Nothing here writes `acc_bill_adjustment` and nothing moves
 * `abl_pending_amount`.** A draft still touches no bill, which is what lets
 * two people hold drafts against the same party without reserving each other's
 * outstanding, and what lets a draft be abandoned with no cleanup. The
 * allocation is REMEMBERED, not applied.
 *
 * ── It is a SUGGESTION, and is deliberately not validated ────────────────
 * Between saving the draft and reopening it somebody else may have settled the
 * same bills, so a remembered 5,000 against a bill that now has 1,200 pending
 * is stale. That is expected, and it is given back exactly as it was stored:
 * the screen re-reads `/receipts/open-items` on reopen and clamps each figure
 * to what the bill can still take. Validating it here would turn a recoverable
 * situation into a refused load — the operator would lose the whole draft
 * rather than one figure.
 *
 * So: no bill is looked up on the way in, nothing is refused on the way out,
 * and a remembered row naming a bill that has since been deleted still comes
 * back. `/post` and `/amend` ignore all of it and use the payload they are
 * given — this is a note to the screen, never an input to posting.
 */

/** The cheque fields `acc_tender_detail` has no columns for. */
export interface DraftChequeDetail {
  bankBranch: string | null;
  ifsc: string | null;
  micr: string | null;
  drawerName: string | null;
  bankLedgerId: string | null;
}

/**
 * One remembered bill settlement, in exactly the shape `/receipts/post` takes
 * it — so the screen sends the same object to `/create` that it will send to
 * `/post`, and gets the same one back.
 */
export interface DraftAllocation {
  billId: string;
  billAccYear: string;
  amount: number;
  discount: number;
  writeoff: number;
  roundoff: number;
  writeoffApprovedBy: string | null;
}

/** One remembered credit the operator ticked. `billId` is the CREDIT bill. */
export interface DraftCredit {
  billId: string;
  billAccYear: string;
  amount: number;
}

export interface DraftLines {
  otherLines: ReceiptOtherLine[];
  /** Keyed by `td_row_no`, which is what the tender row is identified by here. */
  cheques: Record<number, DraftChequeDetail | undefined>;
  /** Remembered, never applied. See the header note. */
  allocations: DraftAllocation[];
  creditsApplied: DraftCredit[];
}

export function emptyDraft(): DraftLines {
  return { otherLines: [], cheques: {}, allocations: [], creditsApplied: [] };
}

/** Build the value to store. */
export function buildDraftLines(
  otherLines: readonly ReceiptOtherLine[],
  cheques: Record<number, DraftChequeDetail | null>,
  allocations: readonly DraftAllocation[],
  creditsApplied: readonly DraftCredit[],
): Prisma.InputJsonValue {
  return {
    otherLines: otherLines as unknown as Prisma.InputJsonValue,
    cheques: Object.fromEntries(
      Object.entries(cheques).filter(([, detail]) => detail !== null),
    ) as unknown as Prisma.InputJsonValue,
    allocations: allocations as unknown as Prisma.InputJsonValue,
    creditsApplied: creditsApplied as unknown as Prisma.InputJsonValue,
  } as Prisma.InputJsonValue;
}

/**
 * Read it back, defensively.
 *
 * jsonb is schemaless, so a value written by an older version of this module —
 * or by hand — must not take a GET or a POST down. Anything unreadable reads as
 * absent, which is what a receipt with no other lines would have said anyway.
 */
export function rehydrateDraft(value: Prisma.JsonValue | null | undefined): DraftLines {
  if (value === null || value === undefined) {
    return emptyDraft();
  }
  if (Array.isArray(value)) {
    return { ...emptyDraft(), otherLines: readOtherLines(value) };
  }
  if (typeof value !== 'object') {
    return emptyDraft();
  }

  const record = value as Record<string, unknown>;
  return {
    otherLines: Array.isArray(record.otherLines) ? readOtherLines(record.otherLines) : [],
    cheques: readCheques(record.cheques),
    // Absent on every row written before 2026-09-18 — 342 of them carried
    // `{"cheques":{},"otherLines":[]}` — which reads as "nothing was
    // remembered", exactly as it should.
    allocations: Array.isArray(record.allocations) ? readAllocations(record.allocations) : [],
    creditsApplied: Array.isArray(record.creditsApplied) ? readCredits(record.creditsApplied) : [],
  };
}

/**
 * Read back the remembered settlement.
 *
 * Structurally defensive — a bill id that is not a string, or an amount that is
 * not a number, is a row this cannot describe and it is dropped — but NOT
 * semantically. A bill that no longer exists, an amount larger than the bill
 * can now take, a bill belonging to somebody else: all of those come back
 * unchanged. They are the screen's problem to reconcile against a fresh
 * `/receipts/open-items`, and refusing them here would cost the operator the
 * whole draft to save them one figure.
 */
function readAllocations(value: readonly unknown[]): DraftAllocation[] {
  const rows: DraftAllocation[] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    if (!row || typeof row.billId !== 'string' || typeof row.billAccYear !== 'string') {
      continue;
    }
    rows.push({
      billId: row.billId,
      billAccYear: row.billAccYear,
      amount: num(row.amount),
      discount: num(row.discount),
      writeoff: num(row.writeoff),
      // Absent on a draft saved before the round-off column existed, which
      // reads as 0 — exactly what it was.
      roundoff: num(row.roundoff),
      writeoffApprovedBy: str(row.writeoffApprovedBy),
    });
  }
  return rows;
}

function readCredits(value: readonly unknown[]): DraftCredit[] {
  const rows: DraftCredit[] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    if (!row || typeof row.billId !== 'string' || typeof row.billAccYear !== 'string') {
      continue;
    }
    rows.push({
      billId: row.billId,
      billAccYear: row.billAccYear,
      amount: num(row.amount),
    });
  }
  return rows;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readOtherLines(value: readonly unknown[]): ReceiptOtherLine[] {
  const lines: ReceiptOtherLine[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.ledgerId !== 'string' || typeof row.amount !== 'number') {
      return;
    }
    lines.push({
      lineNo: typeof row.lineNo === 'number' ? row.lineNo : index + 1,
      role: typeof row.role === 'string' ? row.role : null,
      ledgerId: row.ledgerId,
      ledgerName: typeof row.ledgerName === 'string' ? row.ledgerName : null,
      drCr: row.drCr === DrCr.CR ? DrCr.CR : DrCr.DR,
      amount: row.amount,
      settlesBill: row.settlesBill === true,
      narration: typeof row.narration === 'string' ? row.narration : null,
    });
  });
  return lines;
}

function readCheques(value: unknown): Record<number, DraftChequeDetail | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const cheques: Record<number, DraftChequeDetail | undefined> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const rowNo = Number(key);
    if (!Number.isInteger(rowNo) || typeof entry !== 'object' || entry === null) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    cheques[rowNo] = {
      bankBranch: str(row.bankBranch),
      ifsc: str(row.ifsc),
      micr: str(row.micr),
      drawerName: str(row.drawerName),
      bankLedgerId: str(row.bankLedgerId),
    };
  }
  return cheques;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
