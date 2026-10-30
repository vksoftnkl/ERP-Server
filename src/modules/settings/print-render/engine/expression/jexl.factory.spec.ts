import { TRANSFORM_NAMES, createExpressionEngine, expressionEngine } from './jexl.factory';

const engine = createExpressionEngine();
const run = (expression: string, context: Record<string, unknown> = {}): unknown =>
  engine.evalSync(expression, context);

describe('createExpressionEngine', () => {
  it('registers every transform the validator allows', () => {
    for (const name of TRANSFORM_NAMES) {
      expect(() => run(`value|${name}`, { value: 1 })).not.toThrow();
    }
  });

  it('refuses a transform it was not given', () => {
    expect(() => run('value|exfiltrate', { value: 1 })).toThrow('Transform exfiltrate is not defined');
  });

  it('builds independent sandboxes, and shares one process-wide instance', () => {
    const other = createExpressionEngine();
    other.addTransform('extra', () => 'x');

    expect(() => run('1|extra')).toThrow();
    expect(expressionEngine.evalSync('2|num')).toBe(2);
  });

  describe('numbers and dates', () => {
    it('formats with the default and a stated pattern', () => {
      expect(run('v|fmt', { v: 250000 })).toBe('250000.00');
      expect(run("v|fmt('#,##0')", { v: 250000 })).toBe('2,50,000');
      expect(run("v|fmtIntl('#,##0')", { v: 250000 })).toBe('250,000');
    });

    it('formats a date with the default and a stated pattern', () => {
      const d = new Date('2026-04-01T00:00:00.000Z');
      expect(run('d|date', { d })).toBe('01-04-2026');
      expect(run("d|date('dd MMM yyyy')", { d })).toBe('01 Apr 2026');
    });

    it('groups digit strings', () => {
      expect(run('v|groupIndian', { v: 1234567 })).toBe('12,34,567');
      expect(run('v|groupWestern', { v: '1234567' })).toBe('1,234,567');
    });
  });

  describe('amount in words', () => {
    it('defaults to Rupees and Paise and accepts other names', () => {
      expect(run('v|numToWords', { v: 1.5 })).toBe('Rupees One and Paise Fifty Only');
      expect(run("v|numToWords('Dirhams', 'Fils')", { v: 1.5 })).toBe(
        'Dirhams One and Fils Fifty Only',
      );
    });

    it('voices a bare integer, reading non-numbers as zero', () => {
      expect(run('v|intToWords', { v: '105' })).toBe('One Hundred and Five');
      expect(run('v|intToWords', { v: 'abc' })).toBe('Zero');
    });
  });

  describe('GST', () => {
    it('splits, backs out and tests the place of supply', () => {
      expect(run('v|gstSplit(18)', { v: 1000 })).toMatchObject({ cgstAmount: 90, sgstAmount: 90 });
      expect(run('v|gstSplit(18, true)', { v: 1000 })).toMatchObject({ igstAmount: 180 });
      expect(run('v|gstExclusive(5)', { v: 105 })).toBe(100);
      expect(run("s|interState('29AAA')", { s: '33AAA' })).toBe(true);
    });
  });

  describe('text', () => {
    it('reads a missing pad width as zero', () => {
      expect(run('v|pad', { v: 'x' })).toBe('x');
      expect(run("v|pad(4, '0')", { v: 7 })).toBe('0007');
      expect(run("v|padEnd(4, '.')", { v: 'ab' })).toBe('ab..');
      expect(run('v|padCenter(5)', { v: 'ab' })).toBe(' ab  ');
    });

    it('truncates, repeats, wraps and coalesces', () => {
      expect(run("v|truncate(4, '…')", { v: 'abcdef' })).toBe('abc…');
      expect(run('v|repeat(3)', { v: '=' })).toBe('===');
      expect(run('v|wrap(5)', { v: 'aa bb cc' })).toEqual(['aa bb', 'cc']);
      expect(run("v|coalesce(w, 'Cash')", { v: '', w: null })).toBe('Cash');
    });

    it('masks four characters by default and honours an explicit count', () => {
      expect(run('v|mask', { v: 'ABCDEFGH' })).toBe('XXXXEFGH');
      expect(run("v|mask(2, '*')", { v: 'ABCDEFGH' })).toBe('******GH');
    });

    it('changes case', () => {
      expect(run('v|upper', { v: 'a' })).toBe('A');
      expect(run('v|lower', { v: 'A' })).toBe('a');
      expect(run('v|title', { v: 'sri ram' })).toBe('Sri Ram');
      expect(run('v|trim', { v: ' a ' })).toBe('a');
    });
  });

  describe('arithmetic and coercion', () => {
    it('reads non-numbers as zero', () => {
      expect(run('v|abs', { v: -3 })).toBe(3);
      expect(run('v|neg', { v: '4' })).toBe(-4);
      expect(run('v|num', { v: 'x' })).toBe(0);
      expect(run('v|num', { v: null })).toBe(0);
    });

    it('rounds to whole numbers by default and to stated decimals', () => {
      expect(run('v|round', { v: 2.5 })).toBe(3);
      expect(run('v|round(2)', { v: 1.005 * 1000 })).toBe(1005);
      expect(run('v|round(1)', { v: 1.26 })).toBe(1.3);
      expect(run('v|round(-2)', { v: 1.6 })).toBe(2);
    });

    it('floors and ceils', () => {
      expect(run('v|ceil', { v: 1.1 })).toBe(2);
      expect(run('v|floor', { v: 1.9 })).toBe(1);
    });

    it('converts to text and to a boolean', () => {
      expect(run('v|str', { v: 12 })).toBe('12');
      expect(run('v|bool', { v: '' })).toBe(false);
      expect(run('v|bool', { v: 'x' })).toBe(true);
    });
  });

  describe('collections', () => {
    const rows = [
      { name: 'Rice', qty: 2, rate: 50 },
      { name: 'Dal', qty: 1, rate: 120 },
      { name: 'Atta', qty: 3, rate: 40 },
    ];

    it('measures an array or a string', () => {
      expect(run('rows|length', { rows })).toBe(3);
      expect(run('v|length', { v: 'abcd' })).toBe(4);
      expect(run('v|length', { v: null })).toBe(0);
    });

    it('joins non-blank entries with a default or stated separator', () => {
      expect(run('v|join', { v: ['a', '', null, 'b'] })).toBe('a, b');
      expect(run("v|join(' / ')", { v: ['a', 'b'] })).toBe('a / b');
      expect(run('v|join', { v: 'solo' })).toBe('solo');
    });

    it('takes the first and last element, or null when there is none', () => {
      expect(run('rows|first', { rows })).toEqual(rows[0]);
      expect(run('rows|last', { rows })).toEqual(rows[2]);
      expect(run('v|first', { v: [] })).toBeNull();
      expect(run('v|last', { v: null })).toBeNull();
      expect(run('v|first', { v: 'one' })).toBe('one');
    });

    it('sums a field, or the values themselves', () => {
      expect(run("rows|sum('qty')", { rows })).toBe(6);
      expect(run('v|sum', { v: [1, '2', 'x', null] })).toBe(3);
    });

    it('sorts numerically by a numeric field and alphabetically otherwise', () => {
      const names = (expression: string) =>
        (run(expression, { rows }) as typeof rows).map((row) => row.name);

      expect(names("rows|sortBy('rate')")).toEqual(['Atta', 'Rice', 'Dal']);
      expect(names("rows|sortBy('name')")).toEqual([
        'Atta',
        'Dal',
        'Rice',
      ]);
      expect(run('v|sortBy', { v: ['b', 'c', 'a'] })).toEqual(['a', 'b', 'c']);
    });

    it('leaves the source array unsorted', () => {
      const source = [3, 1, 2];
      run('v|sortBy', { v: source });
      expect(source).toEqual([3, 1, 2]);
    });

    it('filters by a field value, or by truthiness without one', () => {
      expect(run("rows|where('qty', 1)", { rows })).toEqual([rows[1]]);
      expect(run('v|where', { v: [0, 1, '', 'a', null] })).toEqual([1, 'a']);
    });
  });

  describe('default', () => {
    it('replaces null, undefined and the empty string only', () => {
      expect(run("v|default('-')", { v: null })).toBe('-');
      expect(run("v|default('-')", {})).toBe('-');
      expect(run("v|default('-')", { v: '' })).toBe('-');
      expect(run("v|default('-')", { v: 0 })).toBe(0);
      expect(run('v|default', { v: null })).toBe('');
    });
  });
});
