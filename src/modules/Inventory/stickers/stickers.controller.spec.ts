import {
  WARNING_TEXTS_HEADER,
  WARNING_TEXTS_MAX,
  WARNING_TEXTS_MAX_ENCODED,
  warningTextsHeader,
} from './stickers.controller';

/**
 * Review SF3: every sticker PDF answer carries the render's warning strings in
 * `X-Print-Warning-Texts` (standard base64 of the UTF-8 JSON array), so Qt can
 * ask Continue / Stop before the PDF reaches the printer. The Qt client is
 * coded against exactly this name and shape.
 */

const decode = (value: string): unknown => JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
const warn = (message: string) => ({ kind: 'renderer', message });

describe('X-Print-Warning-Texts (review SF3)', () => {
  it('is named exactly X-Print-Warning-Texts and holds at most 20 entries', () => {
    expect(WARNING_TEXTS_HEADER).toBe('X-Print-Warning-Texts');
    expect(WARNING_TEXTS_MAX).toBe(20);
  });

  it('no warning → no header', () => {
    expect(warningTextsHeader({ warnings: [] })).toBeNull();
  });

  it('standard base64 of the UTF-8 JSON array of the strings, in order', () => {
    const texts = [
      'Barcode wider than its box at 3 dots: use 2 dots or a wider box',
      "Barcode ean13 'ABC' could not be generated: bad value",
      'The label for "சர்க்கரை 1 kg × 2" needs more than one label\'s height',
    ];
    const header = warningTextsHeader({ warnings: texts.map(warn) }) as string;
    expect(header).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(decode(header)).toEqual(texts);
    // a header value must be Latin-1 safe on the wire: base64 always is
    expect([...header].every((ch) => ch.charCodeAt(0) < 128)).toBe(true);
  });

  it('more than 20 warnings → the first 20 (X-Print-Warnings keeps the full count)', () => {
    const texts = Array.from({ length: 25 }, (_unused, index) => `warning ${index + 1}`);
    const header = warningTextsHeader({ warnings: texts.map(warn) }) as string;
    expect(decode(header)).toEqual(texts.slice(0, 20));
  });

  it('RR9: the ENCODED header stays within 2,048 characters, entries dropped from the end', () => {
    expect(WARNING_TEXTS_MAX_ENCODED).toBe(2048);
    // 20 different 150-character warnings (one barcode value each): ~4 KB encoded uncapped.
    const texts = Array.from(
      { length: 20 },
      (_unused, index) =>
        `Barcode ean13 '${String(index).padStart(13, '9')}' could not be generated: ` + 'x'.repeat(100),
    );
    const header = warningTextsHeader({ warnings: texts.map(warn) }) as string;
    expect(header.length).toBeLessThanOrEqual(2048);
    const kept = decode(header) as string[];
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(20);
    expect(kept).toEqual(texts.slice(0, kept.length));
    // as many as fit: one more would not
    const onMore = Buffer.from(JSON.stringify(texts.slice(0, kept.length + 1)), 'utf8').toString('base64');
    expect(onMore.length).toBeGreaterThan(2048);
  });

  it('RR9: one warning alone too long is cut to fit, ending "…", valid UTF-8', () => {
    const long = 'பார்கோடு '.repeat(400);
    const header = warningTextsHeader({ warnings: [warn(long), warn('second')] }) as string;
    expect(header.length).toBeLessThanOrEqual(2048);
    const kept = decode(header) as string[];
    expect(kept).toHaveLength(1);
    expect(kept[0].endsWith('…')).toBe(true);
    expect(long.startsWith(kept[0].slice(0, -1))).toBe(true);
    expect(kept[0].length).toBeGreaterThan(100);
  });
});
