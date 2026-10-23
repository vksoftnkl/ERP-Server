import { generateNextBatchNo } from './batch-number.util';

describe('generateNextBatchNo', () => {
  describe('with no prefix configured', () => {
    it('starts at B-1 for an item with no batches', () => {
      expect(generateNextBatchNo([])).toBe('B-1');
    });

    it('follows the highest numbered batch, keeping its prefix and width', () => {
      expect(generateNextBatchNo(['LOT-007', 'LOT-012', 'LOT-003'])).toBe('LOT-013');
    });

    it('widens past the padding once the number outgrows it', () => {
      expect(generateNextBatchNo(['B-99'])).toBe('B-100');
      expect(generateNextBatchNo(['X009'])).toBe('X010');
    });

    it('compares numbers, not text', () => {
      expect(generateNextBatchNo(['B-9', 'B-10'])).toBe('B-11');
    });

    it('ignores batches that do not end in a number', () => {
      expect(generateNextBatchNo(['OPENING', 'MANUAL-A'])).toBe('B-1');
    });

    it('ignores blank entries and trims the rest', () => {
      expect(generateNextBatchNo(['', '   ', '  B-4  '])).toBe('B-5');
    });

    it('treats a bare number as a batch with no prefix', () => {
      expect(generateNextBatchNo(['0041'])).toBe('0042');
    });

    it('keeps the spelling of the highest batch when the case varies', () => {
      expect(generateNextBatchNo(['LOT-5', 'lot-6', 'Lot-7'])).toBe('Lot-8');
    });

    it('takes the first of two equal numbers written with different padding', () => {
      expect(generateNextBatchNo(['B-09', 'B-9'])).toBe('B-10');
      expect(generateNextBatchNo(['B-9', 'B-009'])).toBe('B-10');
    });
  });

  describe('with a configured prefix', () => {
    it('starts at 01 under the prefix, adding a dash when it ends in none', () => {
      expect(generateNextBatchNo([], { prefix: 'GRN' })).toBe('GRN-01');
    });

    it.each(['GRN-', 'GRN_', 'GRN/'])('keeps a prefix that already ends in a separator (%s)', (p) => {
      expect(generateNextBatchNo([], { prefix: p })).toBe(`${p}01`);
    });

    it('continues only the batches under that prefix', () => {
      expect(
        generateNextBatchNo(['GRN-04', 'OLD-99', 'GRN-02'], { prefix: 'GRN' }),
      ).toBe('GRN-05');
    });

    it('matches the prefix in any case and keeps the stored spelling', () => {
      expect(generateNextBatchNo(['grn-07'], { prefix: 'GRN' })).toBe('grn-08');
    });

    it('trims the prefix and treats a blank one as none', () => {
      expect(generateNextBatchNo([], { prefix: '  GRN  ' })).toBe('GRN-01');
      expect(generateNextBatchNo([], { prefix: '   ' })).toBe('B-1');
      expect(generateNextBatchNo([], { prefix: null })).toBe('B-1');
    });

    it('ignores a hand-typed batch under the prefix that does not end in a number', () => {
      expect(generateNextBatchNo(['GRN-01x', 'GRN-01'], { prefix: 'GRN' })).toBe('GRN-02');
    });
  });
});
