import { toScalarText } from './scalar-text';

describe('toScalarText', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    ['INV/00417', 'INV/00417'],
    ['', ''],
    [42.5, '42.5'],
    [0, '0'],
    [false, 'false'],
    [12345678901234567890n, '12345678901234567890'],
  ])('renders %p as %p', (value, text) => {
    expect(toScalarText(value)).toBe(text);
  });

  it('renders a Date as its ISO instant', () => {
    expect(toScalarText(new Date('2026-10-19T04:30:00.000Z'))).toBe('2026-10-19T04:30:00.000Z');
  });

  it('keeps a json value readable instead of [object Object]', () => {
    expect(toScalarText({ batch: 'B1', qty: 2 })).toBe('{"batch":"B1","qty":2}');
    expect(toScalarText(['a', 1])).toBe('["a",1]');
  });

  it('tells two objects apart, so a link key cannot fold every row together', () => {
    expect(toScalarText({ id: 1 })).not.toBe(toScalarText({ id: 2 }));
  });

  it('survives a circular structure a provider could hand over', () => {
    const circular: Record<string, unknown> = { id: 1 };
    circular.self = circular;

    expect(toScalarText(circular)).toBe('[unprintable]');
  });

  it('renders a value JSON cannot express as blank', () => {
    expect(toScalarText(() => 1)).toBe('');
    expect(toScalarText(Symbol('x'))).toBe('');
  });
});
