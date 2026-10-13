import { FontSpecResolved, RichRun } from './layout-tree.types';
import { MeasuredFont, TextMeasurer } from './text-measure';

/**
 * Inline markup for text elements with `markup` on -- QtRPT's "HTML rendering".
 *
 * Tags are parsed from the TEMPLATE, before any expression is evaluated, and
 * `{{ ... }}` spans are copied through untouched. So markup comes only from
 * what the designer typed: a customer called "A<B>C" prints exactly that,
 * rather than turning bold half way through their name.
 *
 * Supported: <b>/<strong>, <i>/<em>, <u>, <s>/<strike>/<del>, <sup>, <sub>,
 * <br>, <p>/<div> (a break after), <font color size> and <span style> with
 * color, font-size, font-weight, font-style and text-decoration. Unknown tags
 * are dropped. Literal newlines are hard breaks, as in plain text.
 */

export interface MarkupStyle {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strikeout?: boolean;
  readonly color?: string;
  readonly sizePt?: number;
  readonly shift?: 'sup' | 'sub';
}

/** A run of template text in one style. `\n` inside it is a hard break. */
export interface MarkupSegment {
  readonly template: string;
  readonly style: MarkupStyle;
}

/** An evaluated segment, ready to lay out. */
export interface StyledText {
  readonly text: string;
  readonly font: FontSpecResolved;
  readonly color: string;
  readonly shift?: 'sup' | 'sub';
}

/** Super/subscript size relative to the surrounding text. */
export const SHIFT_SCALE = 0.7;

const NAMED_COLOURS: Readonly<Record<string, string>> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  maroon: '#800000',
  navy: '#000080',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  teal: '#008080',
  olive: '#808000',
  brown: '#a52a2a',
};

/** HTML <font size="1".."7"> in points. */
const FONT_SIZE_STEPS = [8, 10, 12, 14, 18, 24, 36];

function parseColour(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) {
    return value;
  }
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return NAMED_COLOURS[value];
}

function parseSize(raw: string | undefined, htmlSteps: boolean): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)\s*(pt|px)?$/.exec(value);
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  if (htmlSteps && !match[2]) {
    return FONT_SIZE_STEPS[Math.min(7, Math.max(1, Math.round(amount))) - 1];
  }
  // CSS px are 0.75pt.
  const points = match[2] === 'px' ? amount * 0.75 : amount;
  return Math.min(200, Math.max(1, points));
}

function attribute(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
    attributes,
  );
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function styleFromCss(css: string): MarkupStyle {
  const style: { -readonly [K in keyof MarkupStyle]: MarkupStyle[K] } = {};
  for (const declaration of css.split(';')) {
    const [property, ...rest] = declaration.split(':');
    const value = rest.join(':').trim().toLowerCase();
    switch (property?.trim().toLowerCase()) {
      case 'color':
        style.color = parseColour(value);
        break;
      case 'font-size':
        style.sizePt = parseSize(value, false);
        break;
      case 'font-weight':
        style.bold = value === 'bold' || value === 'bolder' || Number(value) >= 600;
        break;
      case 'font-style':
        style.italic = value === 'italic' || value === 'oblique';
        break;
      case 'text-decoration':
      case 'text-decoration-line':
        if (value.includes('underline')) {
          style.underline = true;
        }
        if (value.includes('line-through')) {
          style.strikeout = true;
        }
        break;
      default:
        break;
    }
  }
  return style;
}

const ENTITIES: Readonly<Record<string, string>> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decode character references in LITERAL text. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const TAG = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*?)(\/?)\s*>/;

const sameStyle = (left: MarkupStyle, right: MarkupStyle): boolean =>
  left.bold === right.bold &&
  left.italic === right.italic &&
  left.underline === right.underline &&
  left.strikeout === right.strikeout &&
  left.color === right.color &&
  left.sizePt === right.sizePt &&
  left.shift === right.shift;

/** Split a template into styled segments. Pure; cache by template if hot. */
export function parseMarkup(template: string): MarkupSegment[] {
  const segments: { template: string; style: MarkupStyle }[] = [];
  const stack: { tag: string; style: MarkupStyle }[] = [];
  let current: MarkupStyle = {};
  let buffer = '';
  let literal = '';

  const flushLiteral = () => {
    if (literal) {
      buffer += decodeEntities(literal);
      literal = '';
    }
  };
  const flush = () => {
    flushLiteral();
    if (!buffer) {
      return;
    }
    const last = segments[segments.length - 1];
    if (last && sameStyle(last.style, current)) {
      last.template += buffer;
    } else {
      segments.push({ template: buffer, style: current });
    }
    buffer = '';
  };
  const lineBreak = () => {
    flushLiteral();
    buffer += '\n';
  };
  const push = (tag: string, change: MarkupStyle) => {
    flush();
    stack.push({ tag, style: current });
    current = {
      ...current,
      ...Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined)),
    };
  };
  const pop = (tag: string) => {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].tag === tag) {
        flush();
        current = stack[index].style;
        stack.length = index;
        return;
      }
    }
  };

  let index = 0;
  while (index < template.length) {
    // An expression is copied through whole, tags and all.
    if (template.startsWith('{{', index)) {
      const close = template.indexOf('}}', index + 2);
      const end = close === -1 ? template.length : close + 2;
      flushLiteral();
      buffer += template.slice(index, end);
      index = end;
      continue;
    }

    if (template[index] === '<') {
      const match = TAG.exec(template.slice(index));
      if (match) {
        const closing = match[1] === '/';
        const name = match[2].toLowerCase();
        const attributes = match[3] ?? '';
        const selfClosing = match[4] === '/';
        index += match[0].length;

        // An opening tag pushes a style, its closing tag pops back to what was
        // in force before it. A self-closing <b/> changes nothing.
        const toggle = (tag: string, change: () => MarkupStyle): void => {
          if (closing) {
            pop(tag);
          } else if (!selfClosing) {
            push(tag, change());
          }
        };

        switch (name) {
          case 'br':
            lineBreak();
            break;
          case 'p':
          case 'div':
            if (closing) {
              lineBreak();
            }
            break;
          case 'b':
          case 'strong':
            toggle('b', () => ({ bold: true }));
            break;
          case 'i':
          case 'em':
            toggle('i', () => ({ italic: true }));
            break;
          case 'u':
            toggle('u', () => ({ underline: true }));
            break;
          case 's':
          case 'strike':
          case 'del':
            toggle('s', () => ({ strikeout: true }));
            break;
          case 'sup':
          case 'sub':
            toggle(name, () => ({ shift: name }));
            break;
          case 'font':
            toggle('font', () => ({
              color: parseColour(attribute(attributes, 'color')),
              sizePt: parseSize(attribute(attributes, 'size'), true),
            }));
            break;
          case 'span':
            toggle('span', () => styleFromCss(attribute(attributes, 'style') ?? ''));
            break;
          default:
            // Unknown tags are dropped, as an HTML renderer would.
            break;
        }
        continue;
      }
    }

    literal += template[index];
    index += 1;
  }

  flush();
  return segments;
}

/** True when the template carries anything markup would change. */
export const hasMarkup = (template: string): boolean => /<|&[#a-zA-Z]/.test(template);

interface Token {
  readonly text: string;
  readonly run: StyledText;
  readonly widthMm: number;
  readonly space: boolean;
}

const measuredFontOf = (run: StyledText): MeasuredFont => ({
  family: run.font.family,
  sizePt: run.font.sizePt,
  bold: run.font.bold,
  italic: run.font.italic,
});

export interface RichLayout {
  readonly lines: RichRun[][];
  /** The same lines without style, for GRID renderers and page re-evaluation. */
  readonly plain: string[];
  /** Per line: whether `justify` may stretch it (not a paragraph's last line). */
  readonly justify: boolean[];
  readonly lineHeightMm: number;
}

/**
 * Wrap styled text to a width.
 *
 * Greedy, like TextMeasurer.wrap, and measured with each run's own face so a
 * bold word takes a bold word's width. One line height for the whole element --
 * the tallest run's -- so the lines of a paragraph stay evenly spaced.
 */
export function layoutRich(
  runs: readonly StyledText[],
  maxWidthMm: number,
  wrap: boolean,
  measurer: TextMeasurer,
  baseFont: MeasuredFont,
): RichLayout {
  let lineHeightMm = measurer.lineHeightMm(baseFont);
  for (const run of runs) {
    if (!run.shift && run.text.trim()) {
      lineHeightMm = Math.max(lineHeightMm, measurer.lineHeightMm(measuredFontOf(run)));
    }
  }

  // Paragraphs: split every run at hard breaks.
  const paragraphs: StyledText[][] = [[]];
  for (const run of runs) {
    const parts = run.text.split(/\r?\n/);
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) {
        paragraphs.push([]);
      }
      if (part) {
        paragraphs[paragraphs.length - 1].push({ ...run, text: part });
      }
    });
  }

  const lines: RichRun[][] = [];
  const justify: boolean[] = [];

  const width = (text: string, run: StyledText) =>
    measurer.measureWidthMm(text, measuredFontOf(run));

  for (const paragraph of paragraphs) {
    const tokens: Token[] = [];
    for (const run of paragraph) {
      for (const piece of run.text.split(/(\s+)/)) {
        if (!piece) {
          continue;
        }
        const space = /^\s+$/.test(piece);
        const text = space ? ' ' : piece;
        tokens.push({ text, run, widthMm: width(text, run), space });
      }
    }

    const paragraphLines: Token[][] = [];
    let line: Token[] = [];
    let lineWidth = 0;
    const commit = () => {
      while (line.length > 0 && line[line.length - 1].space) {
        line.pop();
      }
      paragraphLines.push(line);
      line = [];
      lineWidth = 0;
    };

    for (const token of tokens) {
      if (!wrap || maxWidthMm <= 0) {
        line.push(token);
        continue;
      }
      if (token.space) {
        if (line.length > 0) {
          line.push(token);
          lineWidth += token.widthMm;
        }
        continue;
      }
      if (lineWidth + token.widthMm <= maxWidthMm + 1e-6 || line.length === 0) {
        if (line.length === 0 && token.widthMm > maxWidthMm) {
          // A word wider than the box is broken by character, as plain text is.
          let piece = '';
          for (const character of [...token.text]) {
            if (piece && width(piece + character, token.run) > maxWidthMm) {
              line.push({ ...token, text: piece, widthMm: width(piece, token.run) });
              commit();
              piece = '';
            }
            piece += character;
          }
          if (piece) {
            const pieceWidth = width(piece, token.run);
            line.push({ ...token, text: piece, widthMm: pieceWidth });
            lineWidth = pieceWidth;
          }
          continue;
        }
        line.push(token);
        lineWidth += token.widthMm;
        continue;
      }
      commit();
      line.push(token);
      lineWidth = token.widthMm;
    }
    commit();

    paragraphLines.forEach((tokensOfLine, lineIndex) => {
      const merged: RichRun[] = [];
      for (const token of tokensOfLine) {
        const last = merged[merged.length - 1];
        if (
          last &&
          last.color === token.run.color &&
          last.shift === token.run.shift &&
          JSON.stringify(last.font) === JSON.stringify(token.run.font)
        ) {
          merged[merged.length - 1] = { ...last, text: last.text + token.text };
        } else {
          merged.push({
            text: token.text,
            font: token.run.font,
            color: token.run.color,
            ...(token.run.shift ? { shift: token.run.shift } : {}),
          });
        }
      }
      lines.push(merged);
      justify.push(lineIndex < paragraphLines.length - 1);
    });
  }

  return {
    lines,
    plain: lines.map((line) => line.map((run) => run.text).join('')),
    justify,
    lineHeightMm,
  };
}
