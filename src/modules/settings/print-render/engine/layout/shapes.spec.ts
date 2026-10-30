import {
  PathStyle,
  arrowHeadPath,
  ellipsePath,
  polygonPath,
  polylinePath,
  rhombusPath,
  slicePath,
  trianglePath,
} from './shapes';

const STYLE: PathStyle = { fill: '#ff0000', stroke: '#000000', strokeWidthPt: 0.5 };

/** Every number in a path, in order. */
const numbersOf = (d: string): number[] => d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);

/** The commands of a path, in order. */
const commandsOf = (d: string): string => d.replace(/[^MLCZ]/g, '');

describe('polygonPath / polylinePath', () => {
  const points = [
    { x: 10, y: 20 },
    { x: 30, y: 20 },
    { x: 20, y: 5 },
  ];

  it('closes a polygon and boxes its points', () => {
    expect(polygonPath(points, STYLE)).toEqual({
      k: 'path',
      x: 10,
      y: 5,
      w: 20,
      h: 15,
      d: 'M 10 20 L 30 20 L 20 5 Z',
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidthPt: 0.5,
    });
  });

  it('leaves a polyline open', () => {
    expect(polylinePath(points, STYLE).d).toBe('M 10 20 L 30 20 L 20 5');
  });

  it('rounds to the thousandth of a millimetre and never prints -0', () => {
    const path = polylinePath(
      [
        { x: 1.23456, y: -0.0001 },
        { x: 2, y: 3 },
      ],
      STYLE,
    );
    expect(path.d).toBe('M 1.235 0 L 2 3');
  });

  it('carries a dash only when it is not solid', () => {
    expect(polygonPath(points, { ...STYLE, dash: 'DASH' }).dash).toBe('DASH');
    expect(polygonPath(points, { ...STYLE, dash: 'SOLID' })).not.toHaveProperty('dash');
  });
});

describe('box shapes', () => {
  it('puts a triangle apex at the top centre', () => {
    expect(trianglePath(0, 0, 10, 8, STYLE).d).toBe('M 5 0 L 10 8 L 0 8 Z');
  });

  it('puts the rhombus corners on the side midpoints', () => {
    expect(rhombusPath(0, 0, 10, 8, STYLE).d).toBe('M 5 0 L 10 4 L 5 8 L 0 4 Z');
  });

  it('draws an ellipse as four curves inside its box', () => {
    const path = ellipsePath(10, 20, 40, 20, STYLE);

    expect(commandsOf(path.d)).toBe('MCCCCZ');
    expect(path).toMatchObject({ x: 10, y: 20, w: 40, h: 20 });
    expect(path.d.startsWith('M 10 30 ')).toBe(true);
    const numbers = numbersOf(path.d);
    expect(Math.min(...numbers.filter((_, i) => i % 2 === 0))).toBe(10);
    expect(Math.max(...numbers.filter((_, i) => i % 2 === 0))).toBe(50);
  });
});

describe('arrowHeadPath', () => {
  it('returns nothing for a zero-length line', () => {
    expect(arrowHeadPath({ x: 1, y: 1 }, { x: 1, y: 1 }, 3, 0.2, '#000')).toBeNull();
  });

  it('puts the tip on the end point, with a filled unstroked head', () => {
    const head = arrowHeadPath({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, 0.1, '#123456')!;

    // Head length 2, half-width 0.8: the base corners sit at x = 8.
    expect(head.d).toBe('M 10 0 L 8 0.8 L 8 -0.8 Z');
    expect(head).toMatchObject({ fill: '#123456', stroke: null, strokeWidthPt: 0 });
  });

  it('never makes the head longer than the line, nor narrower than the stroke', () => {
    const head = arrowHeadPath({ x: 0, y: 0 }, { x: 1, y: 0 }, 5, 2, '#000')!;

    expect(head.d).toBe('M 1 0 L 0 2 L 0 -2 Z');
  });
});

describe('slicePath', () => {
  const quarter = Math.PI / 2;

  it('draws a pie wedge back to the centre', () => {
    const path = slicePath(50, 50, 10, 0, 0, quarter, STYLE);

    // Starts at 12 o'clock, one curve to 3 o'clock, then back to the centre.
    expect(path.d.startsWith('M 50 40 C ')).toBe(true);
    expect(path.d.endsWith(' 60 50 L 50 50 Z')).toBe(true);
    expect(commandsOf(path.d)).toBe('MCLZ');
    expect(path).toMatchObject({ x: 40, y: 40, w: 20, h: 20 });
  });

  it('uses one curve per quarter turn or less', () => {
    expect(commandsOf(slicePath(0, 0, 10, 0, 0, Math.PI, STYLE).d)).toBe('MCCLZ');
    expect(commandsOf(slicePath(0, 0, 10, 0, 0, quarter + 0.1, STYLE).d)).toBe('MCCLZ');
  });

  it('draws a full turn as a closed disc with no spoke to the centre', () => {
    expect(commandsOf(slicePath(0, 0, 10, 0, 0, Math.PI * 2, STYLE).d)).toBe('MCCCCZ');
  });

  it('draws a ring slice along both radii', () => {
    const path = slicePath(50, 50, 10, 5, 0, quarter, STYLE);

    expect(commandsOf(path.d)).toBe('MCLCZ');
    // The inner arc starts at the inner radius on the slice's end angle.
    expect(path.d).toContain('L 55 50 C');
  });

  it('draws a full ring as two closed circles for even-odd filling', () => {
    expect(commandsOf(slicePath(0, 0, 10, 5, 0, Math.PI * 2, STYLE).d)).toBe('MCCCCZMCCCCZ');
  });
});
