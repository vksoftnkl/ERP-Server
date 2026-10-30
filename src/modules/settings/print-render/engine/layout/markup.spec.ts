import { FontSpecResolved } from './layout-tree.types';
import { StyledText, decodeEntities, hasMarkup, layoutRich, parseMarkup } from './markup';
import { MeasuredFont, TextMeasurer } from './text-measure';

describe('parseMarkup — colours', () => {
  it('expands a three-digit hex colour and lower-cases it', () => {
    expect(parseMarkup('<font color="#ABC">x</font>')).toEqual([
      { template: 'x', style: { color: '#aabbcc' } },
    ]);
  });

  it('reads named colours case-insensitively, quoted or not', () => {
    expect(parseMarkup("<font color='Navy'>a</font><font color=maroon>b</font>")).toEqual([
      { template: 'a', style: { color: '#000080' } },
      { template: 'b', style: { color: '#800000' } },
    ]);
  });

  it('ignores a colour it cannot read rather than guessing', () => {
    expect(parseMarkup('<font color="bluish">x</font>')).toEqual([{ template: 'x', style: {} }]);
  });
});

describe('parseMarkup — sizes', () => {
  it('maps HTML font sizes onto the 1..7 steps, clamping outside them', () => {
    expect(parseMarkup('<font size="1">a</font>')[0].style.sizePt).toBe(8);
    expect(parseMarkup('<font size="3">a</font>')[0].style.sizePt).toBe(12);
    expect(parseMarkup('<font size="9">a</font>')[0].style.sizePt).toBe(36);
  });

  it('ignores a zero or unreadable size', () => {
    expect(parseMarkup('<font size="0">a</font>')[0].style).toEqual({});
    expect(parseMarkup('<font size="big">a</font>')[0].style).toEqual({});
  });

  it('reads CSS sizes in pt and px, and clamps to 1..200pt', () => {
    expect(parseMarkup('<span style="font-size: 16px">a</span>')[0].style.sizePt).toBe(12);
    expect(parseMarkup('<span style="font-size:11pt">a</span>')[0].style.sizePt).toBe(11);
    expect(parseMarkup('<span style="font-size:400pt">a</span>')[0].style.sizePt).toBe(200);
    expect(parseMarkup('<span style="font-size:0.5">a</span>')[0].style.sizePt).toBe(1);
  });
});

describe('parseMarkup — CSS on a span', () => {
  it('reads a numeric weight of 600 or more as bold', () => {
    expect(parseMarkup('<span style="font-weight:600">a</span>')[0].style).toEqual({
      bold: true,
    });
    expect(parseMarkup('<span style="font-weight:bolder">a</span>')[0].style.bold).toBe(true);
  });

  it('can turn bold off inside a bold run', () => {
    expect(parseMarkup('<b>a<span style="font-weight:normal">b</span></b>')).toEqual([
      { template: 'a', style: { bold: true } },
      { template: 'b', style: { bold: false } },
    ]);
  });

  it('reads oblique as italic and both text decorations at once', () => {
    expect(
      parseMarkup(
        '<span style="font-style:oblique;text-decoration:underline line-through">a</span>',
      )[0].style,
    ).toEqual({ italic: true, underline: true, strikeout: true });
  });

  it('ignores properties it does not know', () => {
    expect(parseMarkup('<span style="letter-spacing:2px">a</span>')).toEqual([
      { template: 'a', style: {} },
    ]);
  });
});

describe('parseMarkup — tags', () => {
  it('reads every alias of the styling tags', () => {
    expect(
      parseMarkup(
        '<strong>a</strong><em>b</em><u>c</u><s>d</s><strike>e</strike><del>f</del><sub>g</sub>',
      ),
    ).toEqual([
      { template: 'a', style: { bold: true } },
      { template: 'b', style: { italic: true } },
      { template: 'c', style: { underline: true } },
      { template: 'def', style: { strikeout: true } },
      { template: 'g', style: { shift: 'sub' } },
    ]);
  });

  it('treats tag names case-insensitively', () => {
    expect(parseMarkup('<B>a</B>')).toEqual([{ template: 'a', style: { bold: true } }]);
  });

  it('pops back past an inner tag the author forgot to close', () => {
    expect(parseMarkup('<b>a<i>b</b>c</i>')).toEqual([
      { template: 'a', style: { bold: true } },
      { template: 'b', style: { bold: true, italic: true } },
      { template: 'c', style: {} },
    ]);
  });

  it('ignores a closing tag with nothing open, and a self-closing style tag', () => {
    expect(parseMarkup('a</b>b<b/>c')).toEqual([{ template: 'abc', style: {} }]);
  });

  it('merges neighbouring text that ends up in the same style', () => {
    expect(parseMarkup('<b>a</b><b>b</b>')).toEqual([{ template: 'ab', style: { bold: true } }]);
  });

  it('breaks after a closing div, and not after an opening one', () => {
    expect(parseMarkup('<div>a</div>b')).toEqual([{ template: 'a\nb', style: {} }]);
  });

  it('copies an unterminated expression through to the end', () => {
    expect(parseMarkup('<b>x</b>{{ row.a <b>')).toEqual([
      { template: 'x', style: { bold: true } },
      { template: '{{ row.a <b>', style: {} },
    ]);
  });

  it('returns no segments for an empty template', () => {
    expect(parseMarkup('')).toEqual([]);
  });
});

describe('decodeEntities', () => {
  it('decodes hex and decimal references and named entities in any case', () => {
    expect(decodeEntities('&#x20B9;&#8377; &AMP; &quot;q&quot; &apos;')).toBe('₹₹ & "q" \'');
  });

  it('decodes &nbsp; to a no-break space', () => {
    expect(decodeEntities('a&nbsp;b')).toBe('a b');
  });

  it('leaves an entity it does not know as written', () => {
    expect(decodeEntities('&bogus; R&D')).toBe('&bogus; R&D');
  });
});

describe('hasMarkup', () => {
  it('spots a tag or an entity, and nothing else', () => {
    expect(hasMarkup('<b>x</b>')).toBe(true);
    expect(hasMarkup('a &amp; b')).toBe(true);
    expect(hasMarkup('&#65;')).toBe(true);
    expect(hasMarkup('Salt & Pepper')).toBe(false);
    expect(hasMarkup('plain text')).toBe(false);
  });
});

describe('layoutRich', () => {
  /** A monospace stand-in: one mm per character at 10pt, bold twice as wide. */
  const measurer = {
    measureWidthMm: (text: string, font: MeasuredFont) =>
      [...text].length * (font.sizePt / 10) * (font.bold ? 2 : 1),
    lineHeightMm: (font: MeasuredFont) => font.sizePt / 2,
  } as unknown as TextMeasurer;

  const base: MeasuredFont = { family: 'NotoSans', sizePt: 10, bold: false, italic: false };
  const font = (overrides: Partial<FontSpecResolved> = {}): FontSpecResolved => ({
    family: 'NotoSans',
    sizePt: 10,
    bold: false,
    italic: false,
    underline: false,
    ...overrides,
  });
  const run = (text: string, overrides: Partial<StyledText> = {}): StyledText => ({
    text,
    font: font(),
    color: '#000000',
    ...overrides,
  });

  it('wraps greedily and drops the space a line ends on', () => {
    const layout = layoutRich([run('aaa bbb ccc')], 7, true, measurer, base);

    expect(layout.plain).toEqual(['aaa bbb', 'ccc']);
    expect(layout.justify).toEqual([true, false]);
    expect(layout.lineHeightMm).toBe(5);
  });

  it('measures each word in its own face', () => {
    const layout = layoutRich(
      [run('aa '), run('bb', { font: font({ bold: true }) })],
      5,
      true,
      measurer,
      base,
    );

    // 'aa bb' would be 2 + 1 + 4 = 7mm with the bold word: too wide.
    expect(layout.plain).toEqual(['aa', 'bb']);
    expect(layout.lines[1]).toEqual([{ text: 'bb', font: font({ bold: true }), color: '#000000' }]);
  });

  it('starts a new paragraph at a hard break, each ending unjustified', () => {
    const layout = layoutRich([run('one\ntwo')], 50, true, measurer, base);

    expect(layout.plain).toEqual(['one', 'two']);
    expect(layout.justify).toEqual([false, false]);
  });

  it('keeps everything on one line when wrapping is off', () => {
    const layout = layoutRich([run('aaa bbb ccc')], 3, false, measurer, base);

    expect(layout.plain).toEqual(['aaa bbb ccc']);
  });

  it('breaks a word wider than the box by character', () => {
    const layout = layoutRich([run('abcdefghij')], 4, true, measurer, base);

    expect(layout.plain).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('merges same-style tokens and splits on a colour or shift change', () => {
    const layout = layoutRich(
      [
        run('Total '),
        run('due', { color: '#ff0000' }),
        run('2', { shift: 'sup', font: font({ sizePt: 7 }) }),
      ],
      100,
      true,
      measurer,
      base,
    );

    expect(layout.lines).toEqual([
      [
        { text: 'Total ', font: font(), color: '#000000' },
        { text: 'due', font: font(), color: '#ff0000' },
        { text: '2', font: font({ sizePt: 7 }), color: '#000000', shift: 'sup' },
      ],
    ]);
  });

  it('takes the line height from the tallest unshifted, non-blank run', () => {
    const layout = layoutRich(
      [
        run('big', { font: font({ sizePt: 20 }) }),
        run('x', { shift: 'sup', font: font({ sizePt: 30 }) }),
        run('   ', { font: font({ sizePt: 40 }) }),
      ],
      100,
      true,
      measurer,
      base,
    );

    expect(layout.lineHeightMm).toBe(10);
  });

  it('lays out no runs as one empty line', () => {
    const layout = layoutRich([], 10, true, measurer, base);

    expect(layout.plain).toEqual(['']);
    expect(layout.lineHeightMm).toBe(5);
  });
});
