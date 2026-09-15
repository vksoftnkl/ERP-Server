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
 */

/** The cheque fields `acc_tender_detail` has no columns for. */
export interface DraftChequeDetail {
  bankBranch: string | null;
  ifsc: string | null;
  micr: string | null;
  drawerName: string | null;
  bankLedgerId: string | null;
}

export interface DraftLines {
  otherLines: ReceiptOtherLine[];
  /** Keyed by `td_row_no`, which is what the tender row is identified by here. */
  cheques: Record<number, DraftChequeDetail | undefined>;
}

export function emptyDraft(): DraftLines {
  return { otherLines: [], cheques: {} };
}

/** Build the value to store. */
export function buildDraftLines(
  otherLines: readonly ReceiptOtherLine[],
  cheques: Record<number, DraftChequeDetail | null>,
): Prisma.InputJsonValue {
  return {
    otherLines: otherLines as unknown as Prisma.InputJsonValue,
    cheques: Object.fromEntries(
      Object.entries(cheques).filter(([, detail]) => detail !== null),
    ) as unknown as Prisma.InputJsonValue,
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
    return { otherLines: readOtherLines(value), cheques: {} };
  }
  if (typeof value !== 'object') {
    return emptyDraft();
  }

  const record = value as Record<string, unknown>;
  return {
    otherLines: Array.isArray(record.otherLines) ? readOtherLines(record.otherLines) : [],
    cheques: readCheques(record.cheques),
  };
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
