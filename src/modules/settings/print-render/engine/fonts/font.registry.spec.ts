import { FontRegistry } from './font.registry';
import { containsComplexScript, splitScriptRuns } from './script-runs';
import { TextMeasurer } from '../layout/text-measure';

describe('splitScriptRuns', () => {
  it('keeps a pure Latin string as one run', () => {
    expect(splitScriptRuns('Sugar 1kg')).toEqual([{ script: 'latin', text: 'Sugar 1kg' }]);
  });

  it('keeps a pure Tamil string as one run, digits and spaces included', () => {
    // Splitting at the space would let the Latin face lay out the gap between
    // two Tamil words, visibly shifting the text.
    expect(splitScriptRuns('சர்க்கரை 1 கிலோ')).toEqual([
      { script: 'tamil', text: 'சர்க்கரை 1 கிலோ' },
    ]);
  });

  it('splits at a real script boundary', () => {
    expect(splitScriptRuns('Sugar சர்க்கரை')).toEqual([
      { script: 'latin', text: 'Sugar ' },
      { script: 'tamil', text: 'சர்க்கரை' },
    ]);
  });

  it('round-trips: concatenated runs equal the input exactly', () => {
    // The renderer positions each run by measuring the ones before it, so a
    // dropped or duplicated character would misplace everything after it.
    for (const sample of [
      'GST 33AABCU9603R1ZM / ஜி.எஸ்.டி',
      'Sugar சர்க்கரை 1kg x 12',
      'ஸ்ரீ லக்ஷ்மி வெங்கடேஸ்வரா ட்ரேடர்ஸ்',
      '',
      '12,345.00',
    ]) {
      expect(
        splitScriptRuns(sample)
          .map((run) => run.text)
          .join(''),
      ).toBe(sample);
    }
  });

  it('detects complex script', () => {
    expect(containsComplexScript('Sugar')).toBe(false);
    expect(containsComplexScript('Sugar சர்க்கரை')).toBe(true);
  });
});

describe('FontRegistry', () => {
  const registry = new FontRegistry();
  beforeAll(() => registry.load());

  it('loads the bundled faces', () => {
    expect(registry.all().length).toBeGreaterThanOrEqual(6);
    expect(registry.families()).toEqual(
      expect.arrayContaining(['NotoSans', 'NotoSansTamil', 'NotoSansMono']),
    );
  });

  it('resolves an exact face', () => {
    const face = registry.resolve({ family: 'NotoSans', bold: true, italic: false });
    expect(face.family).toBe('NotoSans');
    expect(face.bold).toBe(true);
  });

  it('degrades rather than throwing for a face it does not have', () => {
    // NotoSansTamil ships no italic. Printing in the wrong style is a defect a
    // human reports; a 500 at the counter is not.
    const face = registry.resolve({ family: 'NotoSansTamil', bold: false, italic: true });
    expect(face.family).toBe('NotoSansTamil');
    expect(face.italic).toBe(false);
  });

  it('falls back to the default family for an unknown one', () => {
    expect(registry.resolve({ family: 'Helvetica', bold: false, italic: false }).family).toBe(
      'NotoSans',
    );
  });

  it('routes a Tamil run to the Tamil face and a Latin run to the Latin one', () => {
    // This is the Phase 0.2 finding as an assertion.
    expect(
      registry.resolveForScript({ family: 'NotoSans', bold: false, italic: false }, 'tamil').family,
    ).toBe('NotoSansTamil');
    expect(
      registry.resolveForScript({ family: 'NotoSans', bold: false, italic: false }, 'latin').family,
    ).toBe('NotoSans');
    // Even when the element asked for the Tamil family, Latin must not use it.
    expect(
      registry.resolveForScript({ family: 'NotoSansTamil', bold: false, italic: false }, 'latin')
        .family,
    ).toBe('NotoSans');
  });

  it('covers Latin only via the Latin face', () => {
    const tamilFace = registry.resolve({ family: 'NotoSansTamil', bold: false, italic: false });
    const latinFace = registry.resolve({ family: 'NotoSans', bold: false, italic: false });
    // The exact gap that makes per-run fallback mandatory.
    expect(tamilFace.font.hasGlyphForCodePoint('G'.codePointAt(0)!)).toBe(false);
    expect(latinFace.font.hasGlyphForCodePoint('G'.codePointAt(0)!)).toBe(true);
    expect(tamilFace.font.hasGlyphForCodePoint('க'.codePointAt(0)!)).toBe(true);
  });
});

describe('TextMeasurer', () => {
  const registry = new FontRegistry();
  let measurer: TextMeasurer;

  beforeAll(() => {
    registry.load();
    measurer = new TextMeasurer(registry);
  });

  const font = { family: 'NotoSans', sizePt: 9, bold: false, italic: false };

  it('measures a Latin string to a plausible width', () => {
    const width = measurer.measureWidthMm('Sugar 1kg', font);
    // 9pt over 9 characters is roughly 15-20mm; the point is that it is a real
    // measurement, not that it hits an exact figure.
    expect(width).toBeGreaterThan(8);
    expect(width).toBeLessThan(30);
  });

  it('measures the empty string as zero', () => {
    expect(measurer.measureWidthMm('', font)).toBe(0);
  });

  it('grows monotonically with text length and font size', () => {
    expect(measurer.measureWidthMm('AA', font)).toBeGreaterThan(measurer.measureWidthMm('A', font));
    expect(measurer.measureWidthMm('Sugar', { ...font, sizePt: 18 })).toBeCloseTo(
      measurer.measureWidthMm('Sugar', { ...font, sizePt: 9 }) * 2,
      5,
    );
  });

  it('measures mixed script without dropping the Latin half', () => {
    // A single-font measurement would under-measure, because the Tamil face
    // reports zero advance for characters it has no glyph for.
    const mixed = measurer.measureWidthMm('Sugar சர்க்கரை', font);
    const latinOnly = measurer.measureWidthMm('Sugar ', font);
    const tamilOnly = measurer.measureWidthMm('சர்க்கரை', font);
    expect(mixed).toBeCloseTo(latinOnly + tamilOnly, 6);
    expect(mixed).toBeGreaterThan(latinOnly);
  });

  it('wraps to a width budget', () => {
    const wrapped = measurer.wrap('Toor Dal Premium extra long descriptive product name', 30, font);
    expect(wrapped.lines.length).toBeGreaterThan(1);
    for (const line of wrapped.lines) {
      expect(measurer.measureWidthMm(line, font)).toBeLessThanOrEqual(30.001);
    }
    expect(wrapped.heightMm).toBeCloseTo(wrapped.lines.length * wrapped.lineHeightMm, 9);
  });

  it('honours author newlines as hard breaks', () => {
    // Terms-and-conditions blocks are stored with newlines and must not reflow.
    const wrapped = measurer.wrap('1. First term\n2. Second term', 200, font);
    expect(wrapped.lines).toEqual(['1. First term', '2. Second term']);
  });

  it('breaks a word wider than the column rather than overflowing', () => {
    const wrapped = measurer.wrap('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10, font);
    expect(wrapped.lines.length).toBeGreaterThan(1);
    for (const line of wrapped.lines) {
      expect(measurer.measureWidthMm(line, font)).toBeLessThanOrEqual(10.001);
    }
    expect(wrapped.lines.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  });

  it('returns a single line when given no width budget', () => {
    // Must not loop forever trying to break into nothing.
    expect(measurer.wrap('hello', 0, font).lines).toEqual(['hello']);
  });

  it('truncates inside the width budget including the ellipsis', () => {
    const truncated = measurer.truncateToWidth('Toor Dal Premium Grade One', 20, font);
    expect(truncated.endsWith('…')).toBe(true);
    expect(measurer.measureWidthMm(truncated, font)).toBeLessThanOrEqual(20.001);
  });

  it('leaves text that already fits untouched', () => {
    expect(measurer.truncateToWidth('Rice', 60, font)).toBe('Rice');
  });

  it('reports a positive line height and ascent', () => {
    expect(measurer.lineHeightMm(font)).toBeGreaterThan(2);
    expect(measurer.ascentMm(font)).toBeGreaterThan(1);
    expect(measurer.ascentMm(font)).toBeLessThan(measurer.lineHeightMm(font));
  });

  it('returns cached widths identical to uncached ones', () => {
    const first = measurer.measureWidthMm('cache probe', font);
    measurer.clearCache();
    expect(measurer.measureWidthMm('cache probe', font)).toBeCloseTo(first, 12);
  });
});
