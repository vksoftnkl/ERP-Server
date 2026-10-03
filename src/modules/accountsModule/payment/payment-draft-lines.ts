import { Prisma } from '@prisma/client';
import type { DraftAllocation, DraftCredit } from '../receipt/receipt-draft-lines';
import type { PaymentBeneficiary, PaymentOtherLine } from './types/payment-api.types';
import { DrCr } from './types/payment-enum';

/**
 * What lives in `acc_voucher_header.avh_draft_lines` for a PAYMENT, and how it
 * is read back. The receipt's column, the receipt's reasons
 * (`receipt-draft-lines.ts`): scratch space for a draft, cleared at post,
 * holding what `acc_tender_detail` has no columns for.
 *
 * Two things more than the receipt keeps:
 *
 *   · the CHEQUE detail is ours — the book the leaf will come from, who the
 *     cheque is made out to, A/c payee. `acc_pdc_register` gets all three at
 *     post (`apd_cheque_book_id`, `apd_favouring`, `apd_ac_payee`);
 *   · the BENEFICIARY of a transfer row, kept here so a reopened draft shows
 *     it; at post it is written onto the tender row's `td_beneficiary_*`.
 */

export type { DraftAllocation, DraftCredit };

/** The cheque fields of a cheque WE issue. */
export interface PaymentDraftChequeDetail {
  chequeBookId: string;
  favouring: string | null;
  acPayee: boolean;
  bankBranch: string | null;
  ifsc: string | null;
  micr: string | null;
  drawerName: string | null;
}

export interface PaymentDraftLines {
  otherLines: PaymentOtherLine[];
  /** Keyed by `td_row_no`. */
  cheques: Record<number, PaymentDraftChequeDetail | undefined>;
  /** Keyed by `td_row_no`. */
  beneficiaries: Record<number, PaymentBeneficiary | undefined>;
  /** Remembered, never applied (notes 30). */
  allocations: DraftAllocation[];
  creditsApplied: DraftCredit[];
}

export function emptyPaymentDraft(): PaymentDraftLines {
  return { otherLines: [], cheques: {}, beneficiaries: {}, allocations: [], creditsApplied: [] };
}

export function buildPaymentDraftLines(
  otherLines: readonly PaymentOtherLine[],
  cheques: Record<number, PaymentDraftChequeDetail | null>,
  beneficiaries: Record<number, PaymentBeneficiary | null>,
  allocations: readonly DraftAllocation[],
  creditsApplied: readonly DraftCredit[],
): Prisma.InputJsonValue {
  return {
    otherLines: otherLines as unknown as Prisma.InputJsonValue,
    cheques: Object.fromEntries(
      Object.entries(cheques).filter(([, detail]) => detail !== null),
    ) as unknown as Prisma.InputJsonValue,
    beneficiaries: Object.fromEntries(
      Object.entries(beneficiaries).filter(([, detail]) => detail !== null),
    ) as unknown as Prisma.InputJsonValue,
    allocations: allocations as unknown as Prisma.InputJsonValue,
    creditsApplied: creditsApplied as unknown as Prisma.InputJsonValue,
  } as Prisma.InputJsonValue;
}

/** Read it back, defensively: anything unreadable reads as absent. */
export function rehydratePaymentDraft(
  value: Prisma.JsonValue | null | undefined,
): PaymentDraftLines {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return emptyPaymentDraft();
  }
  const record = value as Record<string, unknown>;
  return {
    otherLines: Array.isArray(record.otherLines) ? readOtherLines(record.otherLines) : [],
    cheques: readCheques(record.cheques),
    beneficiaries: readBeneficiaries(record.beneficiaries),
    allocations: Array.isArray(record.allocations) ? readAllocations(record.allocations) : [],
    creditsApplied: Array.isArray(record.creditsApplied) ? readCredits(record.creditsApplied) : [],
  };
}

function readOtherLines(value: readonly unknown[]): PaymentOtherLine[] {
  const lines: PaymentOtherLine[] = [];
  value.forEach((entry, index) => {
    const row = asRecord(entry);
    if (!row || typeof row.ledgerId !== 'string' || typeof row.amount !== 'number') {
      return;
    }
    lines.push({
      lineNo: typeof row.lineNo === 'number' ? row.lineNo : index + 1,
      role: typeof row.role === 'string' ? row.role : null,
      ledgerId: row.ledgerId,
      ledgerName: typeof row.ledgerName === 'string' ? row.ledgerName : null,
      drCr: row.drCr === DrCr.DR ? DrCr.DR : DrCr.CR,
      amount: row.amount,
      settlesBill: row.settlesBill === true,
      narration: str(row.narration),
      approvedBy: str(row.approvedBy),
    });
  });
  return lines;
}

function readCheques(value: unknown): Record<number, PaymentDraftChequeDetail | undefined> {
  const out: Record<number, PaymentDraftChequeDetail | undefined> = {};
  const record = asRecord(value);
  if (!record) {
    return out;
  }
  for (const [key, entry] of Object.entries(record)) {
    const rowNo = Number(key);
    const row = asRecord(entry);
    if (!Number.isInteger(rowNo) || !row || typeof row.chequeBookId !== 'string') {
      continue;
    }
    out[rowNo] = {
      chequeBookId: row.chequeBookId,
      favouring: str(row.favouring),
      acPayee: row.acPayee !== false,
      bankBranch: str(row.bankBranch),
      ifsc: str(row.ifsc),
      micr: str(row.micr),
      drawerName: str(row.drawerName),
    };
  }
  return out;
}

function readBeneficiaries(value: unknown): Record<number, PaymentBeneficiary | undefined> {
  const out: Record<number, PaymentBeneficiary | undefined> = {};
  const record = asRecord(value);
  if (!record) {
    return out;
  }
  for (const [key, entry] of Object.entries(record)) {
    const rowNo = Number(key);
    const row = asRecord(entry);
    if (!Number.isInteger(rowNo) || !row) {
      continue;
    }
    out[rowNo] = { name: str(row.name), accountNo: str(row.accountNo), ifsc: str(row.ifsc) };
  }
  return out;
}

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
    rows.push({ billId: row.billId, billAccYear: row.billAccYear, amount: num(row.amount) });
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

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
