import {
  PAPER_PRESETS,
  cpiToCellWidthMm,
  findPaperPreset,
  lpiToLineHeightMm,
  mmToPixels,
  mmToPoints,
  pointsToMm,
} from './units';

describe('reporting units', () => {
  it('converts millimetres to PDF points at 72 dpi', () => {
    // A4 width: 210mm is exactly 595.276pt, the figure every PDF tool reports.
    expect(mmToPoints(210)).toBeCloseTo(595.276, 3);
    expect(mmToPoints(297)).toBeCloseTo(841.89, 2);
    expect(mmToPoints(25.4)).toBeCloseTo(72, 6);
  });

  it('round-trips points back to millimetres', () => {
    expect(pointsToMm(mmToPoints(148))).toBeCloseTo(148, 9);
  });

  it('converts millimetres to screen pixels at 96 dpi', () => {
    expect(mmToPixels(1)).toBeCloseTo(3.779528, 6);
    expect(mmToPixels(25.4)).toBeCloseTo(96, 6);
  });

  it('derives dot-matrix cell geometry from pitch', () => {
    expect(cpiToCellWidthMm(10)).toBeCloseTo(2.54, 4);
    expect(cpiToCellWidthMm(12)).toBeCloseTo(2.1167, 4);
    expect(cpiToCellWidthMm(15)).toBeCloseTo(1.6933, 4);
    // 6 LPI is the draft default: a 12-inch form is 72 lines.
    expect(lpiToLineHeightMm(6)).toBeCloseTo(4.2333, 4);
  });

  it('resolves paper presets case-insensitively', () => {
    expect(findPaperPreset('a4')?.widthMm).toBe(210);
    expect(findPaperPreset(' T80 ')?.columns).toBe(48);
    expect(findPaperPreset('NOPE')).toBeUndefined();
  });

  it('gives continuous stationery a null height and a column count', () => {
    for (const preset of PAPER_PRESETS.filter((candidate) => candidate.layoutMode === 'GRID')) {
      expect(preset.columns).toBeGreaterThan(0);
    }
    expect(findPaperPreset('T58')?.heightMm).toBeNull();
    expect(findPaperPreset('T80')?.heightMm).toBeNull();
  });
});
