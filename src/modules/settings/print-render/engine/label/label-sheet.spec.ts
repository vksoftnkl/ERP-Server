import {
  LabelSheetSpec,
  cellOrigin,
  cellSize,
  cellTransform,
  effectiveStartAt,
  impose,
  workedOutPage,
} from './label-sheet';
import { mmToDots } from './bar-snap';

const roll = (over: Partial<LabelSheetSpec> = {}): LabelSheetSpec => ({
  labelWidthMm: 50,
  labelHeightMm: 25,
  across: 2,
  down: 1,
  gapXMm: 2,
  gapYMm: 3,
  rotate: 0,
  paperCode: 'LABEL',
  marginLeftMm: 1,
  marginRightMm: 1,
  marginTopMm: 0,
  marginBottomMm: 0,
  dpi: 203,
  ...over,
});

const sheetA4 = (over: Partial<LabelSheetSpec> = {}): LabelSheetSpec =>
  roll({
    paperCode: 'A4',
    across: 3,
    down: 8,
    labelWidthMm: 64,
    labelHeightMm: 33.9,
    gapXMm: 2.5,
    gapYMm: 0,
    marginLeftMm: 7,
    marginTopMm: 13,
    ...over,
  });

const isWholeDot = (mm: number, dpi: number) =>
  Math.abs(mmToDots(mm, dpi) - Math.round(mmToDots(mm, dpi))) < 1e-6;

describe('label-sheet — the page worked out (plan §4.1)', () => {
  it('50 × 25, 2 across, gap 2, side 1 → 104 × 25 mm', () => {
    expect(workedOutPage(roll())).toEqual({ widthMm: 104, heightMm: 25 });
  });

  it('a quarter turn swaps the cell (25 × 50 cells)', () => {
    expect(cellSize(roll({ rotate: 90 }))).toEqual({ widthMm: 25, heightMm: 50 });
    expect(workedOutPage(roll({ rotate: 270 }))).toEqual({ widthMm: 54, heightMm: 50 });
  });

  it('a LABEL roll with 2 down adds the gap down and the top / bottom margins', () => {
    expect(workedOutPage(roll({ down: 2, marginTopMm: 1, marginBottomMm: 1 }))).toEqual({
      widthMm: 104,
      heightMm: 55,
    });
  });

  it('an A4 sheet is the A4 page', () => {
    expect(workedOutPage(sheetA4())).toEqual({ widthMm: 210, heightMm: 297 });
  });
});

describe('label-sheet — imposition (plan §4.4)', () => {
  it('7 labels 2 across on a roll → 4 pages, the last cell blank', () => {
    const run = impose(roll(), [7], { dpi: 203 });
    expect(run.pages).toHaveLength(4);
    expect(run.pages.map((page) => page.length)).toEqual([2, 2, 2, 1]);
    expect(run.labelCount).toBe(7);
  });

  it('3 + 4: row 2 continues in the free cell (cell 2 of the second page)', () => {
    const run = impose(roll(), [3, 4], { dpi: 203 });
    expect(run.pages[1]).toEqual([
      expect.objectContaining({ rowIndex: 0, copyIndex: 2, cellIndex: 0 }),
      expect.objectContaining({ rowIndex: 1, copyIndex: 0, cellIndex: 1 }),
    ]);
    expect(run.pages).toHaveLength(4);
  });

  it('start at applies on a sheet: A4 3 × 8 from cell 5', () => {
    const run = impose(sheetA4(), [2], { startAt: 5, dpi: 300 });
    expect(run.startAt).toBe(5);
    expect(run.pages[0].map((cell) => cell.cellIndex)).toEqual([4, 5]);
  });

  it('start at is 1 on a roll, and clamped to the page on a sheet', () => {
    expect(effectiveStartAt(roll(), 5)).toBe(1);
    expect(effectiveStartAt(sheetA4(), 99)).toBe(24);
    expect(effectiveStartAt(sheetA4(), 0)).toBe(1);
  });

  it('a full sheet then the next page from cell 1', () => {
    const run = impose(sheetA4(), [30], { startAt: 20, dpi: 203 });
    expect(run.pages.map((page) => page.length)).toEqual([5, 24, 1]);
    expect(run.pages[1][0].cellIndex).toBe(0);
  });

  it('cell origins and the page are whole dots of the print dpi', () => {
    for (const dpi of [203, 300, 600]) {
      const run = impose(roll(), [4], { dpi });
      expect(Number.isInteger(run.page.widthDots)).toBe(true);
      expect(run.page.widthPt).toBeCloseTo((run.page.widthDots * 72) / dpi, 9);
      for (const cell of run.pages.flat()) {
        expect(isWholeDot(cell.xMm, dpi)).toBe(true);
        expect(isWholeDot(cell.yMm, dpi)).toBe(true);
      }
    }
    // 104 mm at 203 dpi = 831.2 dots → 831 dots, 0.025 mm short of 104.
    expect(impose(roll(), [1], { dpi: 203 }).page.widthDots).toBe(831);
  });

  it('the second cell of the roll is at side + cell + gap (53 mm, snapped)', () => {
    const origin = cellOrigin(roll(), 1, 203);
    // Within half a dot of 53 mm (53 mm = 423.66 dots → 424).
    expect(Math.abs(origin.xMm - 53)).toBeLessThanOrEqual(25.4 / 203 / 2);
    expect(isWholeDot(origin.xMm, 203)).toBe(true);
    expect(origin.yMm).toBe(0);
  });

  it('the vertical gap is on the page only for a sheet (decision 38)', () => {
    const a4 = sheetA4({ gapYMm: 2 });
    expect(cellOrigin(a4, 3, 600).yMm).toBeCloseTo(13 + 33.9 + 2, 1);
  });
});

describe('label-sheet — the cell transform', () => {
  // 254 dpi = exactly 10 dots per mm, so whole millimetres are whole dots.
  const origin = { xMm: 10, yMm: 5 };
  const close = (
    got: { translateXMm: number; translateYMm: number; rotate: number },
    want: { translateXMm: number; translateYMm: number; rotate: number },
  ) => {
    expect(got.rotate).toBe(want.rotate);
    expect(got.translateXMm).toBeCloseTo(want.translateXMm, 9);
    expect(got.translateYMm).toBeCloseTo(want.translateYMm, 9);
  };
  it('0°: translate to the cell', () => {
    expect(cellTransform(roll(), origin, 254)).toEqual({
      translateXMm: 10,
      translateYMm: 5,
      rotate: 0,
    });
  });
  it('90°: the label turned clockwise sits in the h × w cell', () => {
    close(cellTransform(roll({ rotate: 90 }), origin, 254), {
      translateXMm: 35,
      translateYMm: 5,
      rotate: 90,
    });
  });
  it('180° and 270°', () => {
    close(cellTransform(roll({ rotate: 180 }), origin, 254), {
      translateXMm: 60,
      translateYMm: 30,
      rotate: 180,
    });
    close(cellTransform(roll({ rotate: 270 }), origin, 254), {
      translateXMm: 10,
      translateYMm: 55,
      rotate: 270,
    });
  });
  it('a turned label’s translate sits on a whole dot (NIT10: 50 mm at 203 dpi is 399.6 dots)', () => {
    const dpi = 203;
    const onDot = cellOrigin(roll(), 1, dpi);
    expect(isWholeDot(onDot.xMm, dpi)).toBe(true);
    for (const rotate of [90, 180, 270] as const) {
      const turned = cellTransform(roll({ rotate }), onDot, dpi);
      expect(isWholeDot(turned.translateXMm, dpi)).toBe(true);
      expect(isWholeDot(turned.translateYMm, dpi)).toBe(true);
    }
    // 180°: origin + 50 mm, snapped to the nearest dot (never more than half a dot away).
    const half = cellTransform(roll({ rotate: 180 }), onDot, dpi);
    expect(Math.abs(half.translateXMm - (onDot.xMm + 50))).toBeLessThanOrEqual(25.4 / dpi / 2);
    expect(Math.abs(half.translateYMm - 25)).toBeLessThanOrEqual(25.4 / dpi / 2);
  });
});
