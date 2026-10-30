import { ChequeLedgerRole } from '../cheques/types/cheque-enum';
import { OpeningLedgerRole } from '../openingBalance/types/opening-balance-enum';
import { ReceiptLedgerRole } from '../receipt/types/receipt-enum';
import { PostingDocument, describeDocuments, documentsUsingRole } from './role-usage';

describe('role-usage', () => {
  describe('documentsUsingRole', () => {
    // Built from each engine's own enum: a role added there is protected here.
    it.each([
      ...Object.values(ReceiptLedgerRole).map((role) => [role, PostingDocument.RECEIPT] as const),
      ...Object.values(ChequeLedgerRole).map((role) => [role, PostingDocument.CHEQUE] as const),
      ...Object.values(OpeningLedgerRole).map(
        (role) => [role, PostingDocument.OPENING_BALANCE] as const,
      ),
    ])('names %s as posted by %s', (role, document) => {
      expect(documentsUsingRole(role)).toContain(document);
    });

    it('names every document of a role two engines post', () => {
      expect(documentsUsingRole('BANK_CHARGES')).toEqual([
        PostingDocument.RECEIPT,
        PostingDocument.CHEQUE,
      ]);
    });

    it('answers [] for a role nothing posts yet', () => {
      expect(documentsUsingRole('PURCHASE_RETURN')).toEqual([]);
    });
  });

  describe('describeDocuments', () => {
    it.each([
      [[], ''],
      [[PostingDocument.RECEIPT], 'RECEIPT'],
      [[PostingDocument.RECEIPT, PostingDocument.CHEQUE], 'RECEIPT and CHEQUE'],
      [
        [PostingDocument.RECEIPT, PostingDocument.CHEQUE, PostingDocument.OPENING_BALANCE],
        'RECEIPT, CHEQUE and OPENING_BALANCE',
      ],
    ])('reads %p as %p', (documents, text) => {
      expect(describeDocuments(documents)).toBe(text);
    });
  });
});
