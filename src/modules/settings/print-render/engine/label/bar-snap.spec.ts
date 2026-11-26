import * as bwipjs from 'bwip-js';
import {
  dotsToPoints,
  layoutBars,
  mmToDots,
  moduleWidthMm,
  pageInWholeDots,
  snapMmToDot,
} from './bar-snap';

const EAN = '4006381333931';
const sbsOf = (bcid: string, text: string): number[] =>
  (bwipjs.raw(bcid, text, {}) as Array<{ sbs: number[] }>)[0].sbs;

const isWhole = (value: number) => Math.abs(value - Math.round(value)) < 1e-6;

describe('bar-snap — bars on whole printer dots (STK-06)', () => {
  it.each([
    [2, 203],
    [3, 203],
    [2, 300],
    [3, 300],
  ])('EAN-13 at %i dots, %i dpi: every edge a whole dot, 95 modules wide', (dots, dpi) => {
    const bars = layoutBars(sbsOf('ean13', EAN), dots, dpi, 7.3);
    expect(bars.widthDots).toBe(95 * dots);
    for (const bar of bars.bars) {
      expect(isWhole(mmToDots(bar.xMm, dpi))).toBe(true);
      expect(isWhole(mmToDots(bar.widthMm, dpi))).toBe(true);
      expect(bar.widthDots % dots).toBe(0);
    }
    // EAN-13 has 30 bars: 3 guard × 2 + … = 15 + 15.
    expect(bars.bars).toHaveLength(30);
  });

  it('the left edge is snapped to the nearest dot', () => {
    const bars = layoutBars(sbsOf('ean13', EAN), 3, 203, 7.3);
    // 7.3 mm × 203 / 25.4 = 58.34 dots → 58.
    expect(bars.leftDots).toBe(58);
    expect(bars.bars[0].xDots).toBe(58);
  });

  it('the narrow bar of a 3-dot EAN at 203 dpi is 0.375 mm', () => {
    expect(moduleWidthMm(3, 203)).toBeCloseTo(0.3754, 4);
  });

  it('a page in whole dots converts to points at exactly 72 / dpi a dot', () => {
    const page = pageInWholeDots(104, 25, 203);
    expect(page.widthDots).toBe(831);
    expect(page.heightDots).toBe(200);
    expect(page.widthPt).toBeCloseTo(dotsToPoints(831, 203), 9);
    expect(snapMmToDot(0.06, 203)).toBe(0);
  });
});
