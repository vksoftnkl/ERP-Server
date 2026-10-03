import { ChequeLedgerRole } from '../cheques/types/cheque-enum';
import { OpeningLedgerRole } from '../openingBalance/types/opening-balance-enum';
import { ReceiptLedgerRole } from '../receipt/types/receipt-enum';

/**
 * Which DOCUMENTS resolve which role — the fact that makes an unmapped role
 * dangerous rather than merely blank.
 *
 * Built from each engine's own role enum, never from a list written out here:
 * a role added to `ReceiptLedgerRole` appears in `/ledger-map/roles` and starts
 * being protected from `/ledger-map/delete` in the same commit that teaches the
 * receipt to post it. A second copy would be a second thing to forget.
 *
 * NOT the same question as "which roles exist" — that is
 * `accounts.acc_ledger_role`, the catalogue, and it is deliberately longer:
 * PURCHASE_RETURN is a real role that nothing posts yet, and unmapping it is
 * harmless. Nor is it "which roles a screen reads": the tax rate master
 * resolves every by-rate role to SHOW where a rate would post, and a screen
 * that displays a gap is not a posting that fails on it.
 */
export enum PostingDocument {
  /** `/receipts/post` — receipt-ledger-roles.ts. */
  RECEIPT = 'RECEIPT',
  /** `/cheques/*` — cheque-ledger-roles.ts, on bounce and on clearing. */
  CHEQUE = 'CHEQUE',
  /** Opening balances and the year-end carry-forward — openingBalance/ledger-roles.ts. */
  OPENING_BALANCE = 'OPENING_BALANCE',
}

const ROLES_BY_DOCUMENT: Readonly<Record<PostingDocument, readonly string[]>> = {
  [PostingDocument.RECEIPT]: Object.values(ReceiptLedgerRole),
  [PostingDocument.CHEQUE]: Object.values(ChequeLedgerRole),
  [PostingDocument.OPENING_BALANCE]: Object.values(OpeningLedgerRole),
};

const DOCUMENTS_BY_ROLE: ReadonlyMap<string, readonly PostingDocument[]> = buildIndex();

function buildIndex(): Map<string, PostingDocument[]> {
  const index = new Map<string, PostingDocument[]>();
  for (const [document, roles] of Object.entries(ROLES_BY_DOCUMENT) as [
    PostingDocument,
    readonly string[],
  ][]) {
    for (const role of roles) {
      const documents = index.get(role);
      if (documents) {
        documents.push(document);
      } else {
        index.set(role, [document]);
      }
    }
  }
  return index;
}

/** The documents that post this role today. Empty = nothing resolves it yet. */
export function documentsUsingRole(role: string): readonly PostingDocument[] {
  return DOCUMENTS_BY_ROLE.get(role) ?? [];
}

/** "RECEIPT and SALE_BILL" — for a message an operator reads. */
export function describeDocuments(documents: readonly PostingDocument[]): string {
  if (documents.length <= 1) {
    return documents.join('');
  }
  return `${documents.slice(0, -1).join(', ')} and ${documents[documents.length - 1]}`;
}
