import { Prisma } from '@prisma/client';
import {
  asLabelPurpose,
  asReprintReason,
  bodyHasBarcode,
  cipherCode,
  istDateTimeText,
  jobRefno,
  labelsFromStock,
  pickLot,
  reasonText,
  savingOf,
  sizeKey,
  sizeText,
} from './sticker.rules';

const D = (value: number | string) => new Prisma.Decimal(value);

describe('sticker.rules — the cost-code cipher (S14 / SM4)', () => {
  it('BLACKHORSE: 96.20 → 96 → "EO", 104 → "LBK"', () => {
    expect(cipherCode(D('96.20'), 'BLACKHORSE')).toBe('EO');
    expect(cipherCode(104, 'BLACKHORSE')).toBe('LBK');
  });
  it('whole rupees rounded half up', () => {
    expect(cipherCode(D('96.50'), 'BLACKHORSE')).toBe('ER'); // 97
    expect(cipherCode(D('0.49'), 'BLACKHORSE')).toBe('B');
  });
  it('letters are read upper-case; no letters, 9 letters or a repeat → blank', () => {
    expect(cipherCode(45, 'blackhorse')).toBe('KH');
    expect(cipherCode(45, null)).toBeNull();
    expect(cipherCode(45, 'BLACKHORS')).toBeNull();
    expect(cipherCode(45, 'BLACKHORSB')).toBeNull();
  });
  it('no amount or a negative one → blank; longer than 12 letters → blank', () => {
    expect(cipherCode(null, 'BLACKHORSE')).toBeNull();
    expect(cipherCode(-5, 'BLACKHORSE')).toBeNull();
    expect(cipherCode(D('1234567890123'), 'BLACKHORSE')).toBeNull();
  });
});

describe('sticker.rules — labels from stock (decision 37, PQ6)', () => {
  it('rounded down in the label unit', () => {
    expect(labelsFromStock(D('12.9'), false)).toBe(12);
  });
  it('a unit with decimals (kg) gives 1; none or negative gives 0', () => {
    expect(labelsFromStock(D('3.75'), true)).toBe(1);
    expect(labelsFromStock(D(0), false)).toBe(0);
    expect(labelsFromStock(D(-2), true)).toBe(0);
    expect(labelsFromStock(null, false)).toBe(0);
  });
  it('capped at 9,999', () => {
    expect(labelsFromStock(D(25000), false)).toBe(9999);
  });
});

describe('sticker.rules — lots (SM7)', () => {
  it('none → no lot', () => {
    expect(pickLot([])).toEqual({ lotId: null, lotRequired: false });
  });
  it('one lot, or several with ONE MRP → the newest (first)', () => {
    expect(pickLot([{ lotId: 'a', mrp: D(165) }])).toEqual({ lotId: 'a', lotRequired: false });
    expect(
      pickLot([
        { lotId: 'a', mrp: D(165) },
        { lotId: 'b', mrp: D('165.00') },
      ]),
    ).toEqual({
      lotId: 'a',
      lotRequired: false,
    });
  });
  it('several MRPs → lot required, none picked', () => {
    expect(
      pickLot([
        { lotId: 'a', mrp: D(165) },
        { lotId: 'b', mrp: D(160) },
      ]),
    ).toEqual({
      lotId: null,
      lotRequired: true,
    });
  });
});

describe('sticker.rules — sizes, numbers, words', () => {
  it('size key = width × height × across (SM15, decision 33)', () => {
    expect(sizeKey(50, 25, 2)).toBe('50x25x2');
    expect(sizeKey(50, 25, 1)).not.toBe(sizeKey(50, 25, 2));
    expect(sizeKey(38.5, 25, 2)).toBe('38.5x25x2');
    expect(sizeText(50, 25, 2)).toBe('50 × 25 mm · 2 across');
  });
  it('job no = device code + 6-digit serial (PQ3)', () => {
    expect(jobRefno('D8', 127)).toBe('D8-000127');
  });
  it('reasons: the fixed list, Other with its note', () => {
    expect(asReprintReason('torn')).toBe('TORN');
    expect(asReprintReason('FOO')).toBeNull();
    expect(reasonText('TORN', null)).toBe('Label torn / fell off');
    expect(reasonText('OTHER', 'wrong roll')).toBe('Other: wrong roll');
  });
  it('purposes', () => {
    expect(asLabelPurpose('item_label')).toBe('ITEM_LABEL');
    expect(asLabelPurpose('SALE_INVOICE')).toBeNull();
  });
  it('IST 12-hour time', () => {
    expect(istDateTimeText(new Date('2026-11-25T05:00:00Z'))).toBe('25/11/2026 10:30 AM');
    expect(istDateTimeText(new Date('2026-11-25T12:45:00Z'))).toBe('25/11/2026 06:15 PM');
    expect(istDateTimeText(new Date('2026-11-25T18:35:00Z'))).toBe('26/11/2026 12:05 AM');
  });
  it('saving only when the MRP is above the price', () => {
    expect(savingOf(D(52), D(48))?.toString()).toBe('4');
    expect(savingOf(D(48), D(48))).toBeNull();
    expect(savingOf(null, D(48))).toBeNull();
  });
  it('a body prints a barcode when any band has a BARCODE element', () => {
    expect(bodyHasBarcode(JSON.stringify({ bands: [{ elements: [{ kind: 'BARCODE' }] }] }))).toBe(
      true,
    );
    expect(bodyHasBarcode(JSON.stringify({ bands: [{ elements: [{ kind: 'TEXT' }] }] }))).toBe(
      false,
    );
    expect(bodyHasBarcode('not json')).toBe(false);
  });
});
