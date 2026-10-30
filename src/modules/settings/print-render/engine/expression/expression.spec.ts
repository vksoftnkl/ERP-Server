import { ExpressionEvaluator } from './expression.evaluator';
import { ExpressionValidator, buildAllowedRoots } from './expression.validator';
import { formatDate, formatNumber, groupIndian, groupWestern } from './transforms/format';
import { gstExclusive, gstSplit, isInterState } from './transforms/gst';
import { integerToIndianWords, numberToIndianWords } from './transforms/num-to-words';
import { padCenter, truncate, wrapText } from './transforms/text';

describe('reporting expression transforms', () => {
  describe('number formatting', () => {
    it('groups in the Indian system, not the Western one', () => {
      // A GST invoice showing 250,000 reads as wrong to the person signing it.
      expect(groupIndian('250000')).toBe('2,50,000');
      expect(groupIndian('10000000')).toBe('1,00,00,000');
      expect(groupIndian('123456789')).toBe('12,34,56,789');
      expect(groupIndian('999')).toBe('999');
      expect(groupIndian('1000')).toBe('1,000');
      expect(groupWestern('250000')).toBe('250,000');
    });

    it('applies decimal patterns', () => {
      expect(formatNumber(1234.5, '#,##0.00')).toBe('1,234.50');
      expect(formatNumber(250000, '#,##0.00')).toBe('2,50,000.00');
      expect(formatNumber(12.5, '0.000')).toBe('12.500');
      expect(formatNumber(250000, '#,##0')).toBe('2,50,000');
      expect(formatNumber(0.5, '0')).toBe('1');
    });

    it('renders accounting negatives from the negative sub-pattern', () => {
      expect(formatNumber(-5, '0.00;(0.00)')).toBe('(5.00)');
      expect(formatNumber(-1234.5, '#,##0.00;(#,##0.00)')).toBe('(1,234.50)');
      expect(formatNumber(-5, '0.00')).toBe('-5.00');
    });

    it('never emits negative zero', () => {
      // -0.001 at two decimals is zero, and '-0.00' on an invoice looks broken.
      expect(formatNumber(-0.001, '0.00')).toBe('0.00');
    });

    it('returns empty for values that are not numbers', () => {
      expect(formatNumber(null, '0.00')).toBe('');
      expect(formatNumber(undefined, '0.00')).toBe('');
      expect(formatNumber('', '0.00')).toBe('');
      expect(formatNumber('abc', '0.00')).toBe('');
    });

    it('formats a Prisma Decimal-like object via its toString', () => {
      const decimalLike = { toString: () => '1234.56' };
      expect(formatNumber(decimalLike, '#,##0.00')).toBe('1,234.56');
    });
  });

  describe('date formatting', () => {
    it('formats in UTC, not the render machine timezone', () => {
      // The bug this guards: an invoice stored at 2026-04-01T00:30:00Z printing
      // as 31-03-2026 on a server west of UTC, landing in the wrong GST period.
      const date = new Date('2026-04-01T00:30:00.000Z');
      expect(formatDate(date, 'dd-MM-yyyy')).toBe('01-04-2026');
    });

    it('supports the common patterns', () => {
      const date = new Date('2026-08-24T14:05:09.000Z');
      expect(formatDate(date, 'dd-MM-yyyy')).toBe('24-08-2026');
      expect(formatDate(date, 'dd/MM/yy')).toBe('24/08/26');
      expect(formatDate(date, 'dd-MMM-yyyy')).toBe('24-Aug-2026');
      expect(formatDate(date, 'MMMM yyyy')).toBe('August 2026');
      expect(formatDate(date, 'dd-MM-yyyy HH:mm')).toBe('24-08-2026 14:05');
      expect(formatDate(date, 'hh:mm tt')).toBe('02:05 PM');
    });

    it('does not consume yyyy as two yy', () => {
      expect(formatDate(new Date('2026-01-02T00:00:00Z'), 'yyyy')).toBe('2026');
    });

    it('returns empty for unparseable input', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate('not a date')).toBe('');
    });
  });

  describe('amount in words', () => {
    it('produces the Indian lakh/crore scale', () => {
      expect(integerToIndianWords(250000)).toBe('Two Lakh Fifty Thousand');
      expect(integerToIndianWords(100000)).toBe('One Lakh');
      expect(integerToIndianWords(10000000)).toBe('One Crore');
      expect(integerToIndianWords(1)).toBe('One');
      expect(integerToIndianWords(0)).toBe('Zero');
      expect(integerToIndianWords(19)).toBe('Nineteen');
      expect(integerToIndianWords(21)).toBe('Twenty One');
      expect(integerToIndianWords(105)).toBe('One Hundred and Five');
    });

    it('is the invoice-ready form the plan specifies', () => {
      expect(numberToIndianWords(250000)).toBe('Rupees Two Lakh Fifty Thousand Only');
    });

    it('voices paise', () => {
      expect(numberToIndianWords(1234.56)).toBe(
        'Rupees One Thousand Two Hundred and Thirty Four and Paise Fifty Six Only',
      );
    });

    it('rounds to the voiced precision before voicing', () => {
      // 1234.567 prints as 1,234.57, so it must not be voiced as Fifty Six.
      expect(numberToIndianWords(1234.567)).toContain('Fifty Seven');
    });

    it('handles negatives and zero', () => {
      expect(numberToIndianWords(-500)).toBe('Minus Rupees Five Hundred Only');
      expect(numberToIndianWords(0)).toBe('Rupees Zero Only');
    });

    it('keeps counting crore past 999 rather than inventing arab', () => {
      // 10^11 is written "one thousand crore" on an Indian invoice.
      expect(integerToIndianWords(10_000_000_000)).toBe('One Thousand Crore');
    });
  });

  describe('GST', () => {
    it('splits an intra-state supply into equal halves', () => {
      const split = gstSplit(1000, 18, false);
      expect(split.cgstRate).toBe(9);
      expect(split.sgstRate).toBe(9);
      expect(split.igstRate).toBe(0);
      expect(split.cgstAmount).toBe(90);
      expect(split.sgstAmount).toBe(90);
      expect(split.totalTax).toBe(180);
    });

    it('carries the whole rate as IGST inter-state', () => {
      const split = gstSplit(1000, 18, true);
      expect(split.igstAmount).toBe(180);
      expect(split.cgstAmount).toBe(0);
      expect(split.sgstAmount).toBe(0);
      expect(split.interState).toBe(true);
    });

    it('keeps CGST + SGST exactly equal to the total tax', () => {
      // Two independent roundings of an odd half-rate can differ by a paisa and
      // fail the invoice's own footing check.
      for (const taxable of [100.01, 33.33, 999.99, 1.05, 7.77]) {
        const split = gstSplit(taxable, 5, false);
        expect(split.cgstAmount + split.sgstAmount).toBeCloseTo(split.totalTax, 10);
      }
    });

    it('reads the place of supply from GSTIN state prefixes', () => {
      expect(isInterState('33AABCU9603R1ZM', '33AAAAA0000A1Z5')).toBe(false);
      expect(isInterState('33AABCU9603R1ZM', '29AAAAA0000A1Z5')).toBe(true);
      // An unregistered counter sale has no recipient GSTIN.
      expect(isInterState('33AABCU9603R1ZM', '')).toBe(false);
    });

    it('reverses a GST-inclusive MRP to its taxable value', () => {
      expect(gstExclusive(118, 18)).toBe(100);
      expect(gstExclusive(105, 5)).toBe(100);
    });
  });

  describe('text', () => {
    it('wraps greedily to a character width', () => {
      expect(wrapText('the quick brown fox jumps', 10)).toEqual([
        'the quick',
        'brown fox',
        'jumps',
      ]);
    });

    it('breaks a word longer than the line rather than overflowing', () => {
      // On a character grid an overflow pushes every following column out.
      expect(wrapText('ABCDEFGHIJKLM', 5)).toEqual(['ABCDE', 'FGHIJ', 'KLM']);
    });

    it('centres with the odd space going to the right', () => {
      expect(padCenter('ab', 6)).toBe('  ab  ');
      expect(padCenter('abc', 6)).toBe(' abc  ');
      expect(padCenter('abcdef', 4)).toBe('abcdef');
    });

    it('truncates inside the width budget including the ellipsis', () => {
      expect(truncate('abcdefgh', 5, '..')).toBe('abc..');
      expect(truncate('abcdefgh', 5)).toBe('abcde');
      expect(truncate('abc', 5, '..')).toBe('abc');
    });
  });
});

describe('ExpressionEvaluator', () => {
  let evaluator: ExpressionEvaluator;

  beforeEach(() => {
    evaluator = new ExpressionEvaluator();
  });

  it('returns a bare expression with its type intact', () => {
    expect(evaluator.evaluate('{{ row.qty }}', { row: { qty: 12 } })).toBe(12);
    expect(evaluator.evaluate('{{ row.ok }}', { row: { ok: true } })).toBe(true);
  });

  it('interpolates mixed literal and expression spans to a string', () => {
    expect(
      evaluator.evaluate('Invoice {{ inv.no }} dated {{ inv.date }}', {
        inv: { no: 'A/1', date: '01-04-2026' },
      }),
    ).toBe('Invoice A/1 dated 01-04-2026');
  });

  it('passes plain text through untouched', () => {
    expect(evaluator.evaluate('Tax Invoice', {})).toBe('Tax Invoice');
  });

  it('applies the registered transforms', () => {
    expect(evaluator.evaluateText("{{ row.amt|fmt('#,##0.00') }}", { row: { amt: 250000 } })).toBe(
      '2,50,000.00',
    );
    expect(evaluator.evaluateText('{{ total|numToWords }}', { total: 250000 })).toBe(
      'Rupees Two Lakh Fifty Thousand Only',
    );
  });

  it('treats an absent condition as visible', () => {
    // An element with no `visible` must render; only a STATED falsy condition
    // hides it. An empty string is falsy, so this cannot be a plain coercion.
    expect(evaluator.evaluateCondition(undefined, {})).toBe(true);
    expect(evaluator.evaluateCondition('', {})).toBe(true);
    expect(evaluator.evaluateCondition('   ', {})).toBe(true);
    expect(evaluator.evaluateCondition('{{ inv.qr }}', { inv: { qr: null } })).toBe(false);
    expect(evaluator.evaluateCondition('{{ inv.qr }}', { inv: { qr: 'x' } })).toBe(true);
  });

  it('reads a false-y string condition as false', () => {
    expect(evaluator.evaluateCondition('{{ flag }}', { flag: false })).toBe(false);
    expect(evaluator.evaluateCondition('{{ flag }} ', { flag: false })).toBe(false);
  });

  it('degrades a failing expression to empty instead of aborting the render', () => {
    // A template may reference a field a particular document does not have.
    // The customer still gets their invoice.
    expect(evaluator.evaluateText('{{ missing.deep.field }}', {})).toBe('');
    expect(evaluator.evaluateText('A{{ !!! }}B', {})).toBe('AB');
    expect(evaluator.getFailures().length).toBeGreaterThan(0);
  });

  it('records each distinct failure once, not once per row', () => {
    for (let index = 0; index < 500; index += 1) {
      evaluator.evaluateText('{{ !!! }}', { row: { index } });
    }
    expect(evaluator.getFailures()).toHaveLength(1);
  });

  it('blanks an object-valued expression rather than printing [object Object]', () => {
    expect(evaluator.evaluateText('{{ row }}', { row: { a: 1 } })).toBe('');
  });

  it('coerces to a number for aggregate inputs', () => {
    expect(evaluator.evaluateNumber('{{ row.amt }}', { row: { amt: '1,234.50' } })).toBe(1234.5);
    expect(evaluator.evaluateNumber('{{ row.amt }}', { row: { amt: null } })).toBe(0);
    expect(evaluator.evaluateNumber('{{ row.amt }}', { row: { amt: 42 } })).toBe(42);
    expect(evaluator.evaluateNumber('{{ row.amt }}', { row: { amt: -7.5 } })).toBe(-7.5);
  });

  it('reads accounting parentheses back as a negative', () => {
    // The bug this pins: a pending column formatted '#,##0.00;(#,##0.00)' fed a
    // sum aggregate. '(5,000.00)' parsed as NaN -> 0, so every credit counted
    // as nothing and a statement's closing balance exceeded the sum of its own
    // subtotals by the credit amount.
    expect(
      evaluator.evaluateNumber("{{ row.amt|fmt('#,##0.00;(#,##0.00)') }}", { row: { amt: -5000 } }),
    ).toBe(-5000);
    expect(
      evaluator.evaluateNumber("{{ row.amt|fmt('#,##0.00;(#,##0.00)') }}", { row: { amt: 5000 } }),
    ).toBe(5000);
  });

  it('strips currency decoration before coercing', () => {
    expect(evaluator.evaluateNumber('{{ row.amt }}', { row: { amt: 'Rs. 1,234.50' } })).toBe(
      1234.5,
    );
    expect(evaluator.evaluateNumber('{{ row.amt }}', { row: { amt: 'abc' } })).toBe(0);
  });

  it('binds a transform tighter than arithmetic — a parenthesis trap', () => {
    // jexl gives `|` higher precedence than `*`, so this formats row.rate ALONE
    // and then multiplies, yielding '6' rather than '6.00'. Template authors
    // must parenthesise. Pinned as a test because the wrong form looks right.
    expect(
      evaluator.evaluateText("{{ row.qty * row.rate|fmt('0.00') }}", { row: { qty: 3, rate: 2 } }),
    ).toBe('6');
    expect(
      evaluator.evaluateText("{{ (row.qty * row.rate)|fmt('0.00') }}", {
        row: { qty: 3, rate: 2 },
      }),
    ).toBe('6.00');
  });

  it('reuses one compiled expression across rows', () => {
    // The hot path: 500 DETAIL rows must not re-parse the same expression.
    const template = "{{ (row.qty * row.rate)|fmt('0.00') }}";
    const results = Array.from({ length: 1000 }, (_unused, index) =>
      evaluator.evaluateText(template, { row: { qty: index, rate: 2 } }),
    );
    expect(results[3]).toBe('6.00');
    expect(results[999]).toBe('1998.00');
  });
});

describe('ExpressionValidator', () => {
  const validator = new ExpressionValidator();
  const roots = buildAllowedRoots(['company', 'invoice', 'items']);

  it('accepts a well-formed expression over declared datasets', () => {
    expect(validator.validateTemplateString('{{ company.name }}', 'p', roots)).toEqual([]);
    expect(validator.validateTemplateString("{{ row.qty|fmt('0.000') }}", 'p', roots)).toEqual([]);
    expect(
      validator.validateTemplateString("{{ row.net < 0 ? '#8B1D1D' : '#000000' }}", 'p', roots),
    ).toEqual([]);
  });

  it('rejects an identifier no dataset declares', () => {
    // The common real case is a typo'd dataset name, which would otherwise
    // print a blank column that nobody notices until a customer does.
    const issues = validator.validateTemplateString('{{ invoce.number }}', 'p', roots);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("unknown identifier 'invoce'");
  });

  it('rejects a reach at the host runtime', () => {
    for (const attempt of [
      '{{ process.env.DATABASE_URL }}',
      '{{ globalThis }}',
      '{{ global.x }}',
    ]) {
      const issues = validator.validateTemplateString(attempt, 'p', roots);
      expect(issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects an unregistered transform', () => {
    const issues = validator.validateTemplateString('{{ row.x|exfiltrate }}', 'p', roots);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("unknown transform '|exfiltrate'");
  });

  it('reports a syntax error', () => {
    const issues = validator.validateTemplateString('{{ row.x + }}', 'p', roots);
    expect(issues).toHaveLength(1);
  });

  it('reports unbalanced delimiters, which the span regex cannot see', () => {
    const issues = validator.validateTemplateString('{{ row.x }} and {{ row.y', 'p', roots);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('unbalanced');
  });

  it('reports an empty expression', () => {
    const issues = validator.validateTemplateString('{{ }}', 'p', roots);
    expect(issues[0].message).toBe('empty expression');
  });

  it('allows relative identifiers inside a collection filter', () => {
    // `items[.qty > 0]` — the leading dot is the current element, not a root.
    expect(validator.validateTemplateString('{{ items[.qty > 0]|length }}', 'p', roots)).toEqual(
      [],
    );
  });

  it('walks into object and array literals', () => {
    expect(validator.validateTemplateString('{{ { a: nope.x } }}', 'p', roots).length).toBe(1);
    expect(validator.validateTemplateString('{{ [nope.x, company.y] }}', 'p', roots).length).toBe(
      1,
    );
  });

  it('walks into transform arguments', () => {
    expect(validator.validateTemplateString('{{ company.n|pad(nope.w) }}', 'p', roots).length).toBe(
      1,
    );
  });

  it('walks into every branch of a conditional', () => {
    expect(
      validator.validateTemplateString('{{ company.a ? bad1.b : bad2.c }}', 'p', roots),
    ).toHaveLength(2);
  });

  it('ignores plain text with no expression', () => {
    expect(validator.validateTemplateString('Tax Invoice', 'p', roots)).toEqual([]);
    expect(validator.validateTemplateString(undefined, 'p', roots)).toEqual([]);
  });

  it('allows every builtin root', () => {
    for (const builtin of ['row', 'page', 'agg', 'ctx', 'sys', 'group']) {
      expect(validator.validateTemplateString(`{{ ${builtin}.x }}`, 'p', roots)).toEqual([]);
    }
  });
});
