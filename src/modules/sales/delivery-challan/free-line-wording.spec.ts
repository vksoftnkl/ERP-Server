import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setErrorWording, wordingFor, type ErrorWordingRow } from '../../../common/error-wording/error-wording';

/**
 * User 2026-11-17 — SALES_AMOUNT_MISMATCH rule FREE_LINE (challan) and
 * FREE_LINE_BILL (bill) carry their own wording, read straight from the seed
 * file (prisma/seed/Error_Messages.json, catalogue 2026-11-17.1); the plain
 * row stays the generic wrong-request one, TAX_SPLIT its own.
 */
describe('free-line wording (catalogue 2026-11-17.1)', () => {
  const file = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../prisma/seed/Error_Messages.json'), 'utf8'),
  ) as { version: string; rows: (Omit<ErrorWordingRow, 'variant' | 'lang'> & { variant?: string; lang?: string })[] };

  beforeAll(() => {
    setErrorWording(
      file.rows.map((r) => ({ ...r, variant: r.variant ?? '', lang: r.lang ?? 'en' })),
      file.version,
    );
  });

  const err = (rule?: string) => ({
    code: 'SALES_AMOUNT_MISMATCH',
    field: 'items',
    line: 2,
    params: { n: 2 },
    ...(rule ? { rule } : {}),
  });

  it('is version 2026-11-17.1 or later (the rows came in with .1)', () => {
    expect(file.version >= '2026-11-17.1').toBe(true);
  });

  it('words the challan refusal: pick the order lines again with Ctrl+F4', () => {
    expect(wordingFor(err('FREE_LINE'))).toEqual({
      title: "Free line doesn't match the order",
      line: "Line 2's free mark is not what the order says. The order may have changed after you picked it.",
      todo: 'Pick the order lines again with Ctrl+F4.',
    });
  });

  it('words the bill refusal: pick the order or challan lines again', () => {
    expect(wordingFor(err('FREE_LINE_BILL'))).toEqual({
      title: "Free line doesn't match the order",
      line: "Line 2's free mark is not what its order or challan says. It may have changed after you picked it.",
      todo: 'Pick the order or challan lines again.',
    });
  });

  it('leaves the plain row and TAX_SPLIT as they were', () => {
    expect(wordingFor(err())?.line).toBe('The app sent a wrong request.');
    expect(wordingFor(err('TAX_SPLIT'))?.title).toBe('GST split wrong');
  });
});
