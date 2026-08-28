import { Codepage, findUnprintableScripts, getCodepage } from './codepage';
import { GridCanvas } from './grid-canvas';

describe('Codepage', () => {
  const cp437 = getCodepage('CP437');

  it('encodes ASCII one byte per character', () => {
    const result = cp437.encode('Rice 12kg');
    expect(result.bytes.toString('latin1')).toBe('Rice 12kg');
    expect(result.unmapped).toEqual([]);
  });

  it('transliterates the rupee sign, which no code page carries', () => {
    // Without this every amount column on a thermal receipt is a substitute
    // character. And the length changes — ₹ becomes Rs. — so it must happen
    // before the grid measures the string.
    expect(Codepage.prepare('₹1,234')).toBe('Rs.1,234');
    const result = cp437.encode('₹1,234');
    expect(result.bytes.toString('latin1')).toBe('Rs.1,234');
    expect(result.unmapped).toEqual([]);
  });

  it('maps a CP437 high character to its single byte', () => {
    // 'ñ' is at 0xA4 in CP437.
    const result = cp437.encode('jalapeño');
    expect(result.bytes.length).toBe('jalapeño'.length);
    expect(result.unmapped).toEqual([]);
  });

  it('substitutes an unmappable character and reports it', () => {
    // A Tamil character has no CP437 representation.
    const result = cp437.encode('rice அரிசி');
    expect(result.bytes.toString('latin1')).toContain('?');
    expect(result.unmapped.length).toBeGreaterThan(0);
  });

  it('keeps the byte count equal to the character count, for grid alignment', () => {
    // A substitution must occupy exactly one cell, or every column to its right
    // shifts.
    const text = 'aあb£c';
    const result = cp437.encode(text);
    expect(result.bytes.length).toBe([...text].length);
  });

  it('strips control characters that would be read as commands', () => {
    const result = cp437.encode('a\x1bb');
    expect(result.bytes[1]).toBe(0x20);
  });

  it('names a complex script as unprintable, distinct from an unmapped character', () => {
    // Different remedy: not another code page, but the PDF path.
    expect(findUnprintableScripts('Sugar சர்க்கரை')).toEqual(['Tamil']);
    expect(findUnprintableScripts('Sugar 1kg')).toEqual([]);
  });

  it('falls back to CP437 for an unknown code page name', () => {
    expect(getCodepage('NONSENSE').name).toBe('CP437');
    expect(getCodepage(undefined).name).toBe('CP437');
  });
});

describe('GridCanvas', () => {
  it('writes text at a position and reads it back', () => {
    const canvas = new GridCanvas(48);
    canvas.write(0, 4, 'Rice');
    expect(canvas.toText()).toBe('    Rice');
  });

  it('right-aligns text to end at a column', () => {
    const canvas = new GridCanvas(48);
    canvas.writeRight(0, 48, '1,234.00');
    expect(canvas.toText()).toBe(' '.repeat(40) + '1,234.00');
  });

  it('centres text within a width', () => {
    const canvas = new GridCanvas(10);
    canvas.writeCentered(0, 0, 10, 'TOTAL');
    expect(canvas.toText()).toBe('  TOTAL');
  });

  it('overwrites earlier writes — the basis of z-order', () => {
    // A label drawn over a rule replaces its dashes; the layout engine emits in
    // ascending z so this is how a boxed field works.
    const canvas = new GridCanvas(20);
    canvas.fillRow(0, 0, 20, '-');
    canvas.write(0, 5, 'LABEL');
    expect(canvas.toText()).toBe('-----LABEL----------');
  });

  it('clips at the column budget rather than wrapping', () => {
    const canvas = new GridCanvas(10);
    canvas.write(0, 6, 'toolongtofit');
    expect(canvas.toText().length).toBeLessThanOrEqual(10);
    expect(canvas.clipped.columns).toBeGreaterThan(0);
  });

  it('merges same-style cells into one run and trims trailing blanks', () => {
    const canvas = new GridCanvas(48);
    canvas.write(0, 0, 'A');
    canvas.write(0, 10, 'B');
    const runs = canvas.runsForRow(0);
    // 'A', the gap, and 'B' all carry the default style, so they are ONE run —
    // and it stops at 'B', not at column 48.
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('A         B');
  });

  it('separates runs when the style changes', () => {
    const canvas = new GridCanvas(48);
    canvas.write(0, 0, 'plain');
    canvas.write(0, 6, 'BOLD', {
      bold: true,
      underline: false,
      doubleWidth: false,
      doubleHeight: false,
      centered: false,
    });
    const runs = canvas.runsForRow(0);
    const bold = runs.find((run) => run.text.includes('BOLD'));
    expect(bold?.style.bold).toBe(true);
  });

  it('draws an empty row as no runs', () => {
    const canvas = new GridCanvas(48);
    canvas.write(2, 0, 'row two');
    expect(canvas.runsForRow(0)).toEqual([]);
    expect(canvas.runsForRow(2).length).toBeGreaterThan(0);
  });
});
