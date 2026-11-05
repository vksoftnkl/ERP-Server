"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasMarkup = exports.SHIFT_SCALE = void 0;
exports.decodeEntities = decodeEntities;
exports.parseMarkup = parseMarkup;
exports.layoutRich = layoutRich;
exports.SHIFT_SCALE = 0.7;
const NAMED_COLOURS = {
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
const FONT_SIZE_STEPS = [8, 10, 12, 14, 18, 24, 36];
function parseColour(raw) {
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
function parseSize(raw, htmlSteps) {
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
    const points = match[2] === 'px' ? amount * 0.75 : amount;
    return Math.min(200, Math.max(1, points));
}
function attribute(attributes, name) {
    const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
    return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}
function styleFromCss(css) {
    const style = {};
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
const ENTITIES = {
    lt: '<',
    gt: '>',
    amp: '&',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};
function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
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
const sameStyle = (left, right) => left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline &&
    left.strikeout === right.strikeout &&
    left.color === right.color &&
    left.sizePt === right.sizePt &&
    left.shift === right.shift;
function parseMarkup(template) {
    const segments = [];
    const stack = [];
    let current = {};
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
        }
        else {
            segments.push({ template: buffer, style: current });
        }
        buffer = '';
    };
    const lineBreak = () => {
        flushLiteral();
        buffer += '\n';
    };
    const push = (tag, change) => {
        flush();
        stack.push({ tag, style: current });
        current = {
            ...current,
            ...Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined)),
        };
    };
    const pop = (tag) => {
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
                const toggle = (tag, change) => {
                    if (closing) {
                        pop(tag);
                    }
                    else if (!selfClosing) {
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
const hasMarkup = (template) => /<|&[#a-zA-Z]/.test(template);
exports.hasMarkup = hasMarkup;
const measuredFontOf = (run) => ({
    family: run.font.family,
    sizePt: run.font.sizePt,
    bold: run.font.bold,
    italic: run.font.italic,
});
function layoutRich(runs, maxWidthMm, wrap, measurer, baseFont) {
    let lineHeightMm = measurer.lineHeightMm(baseFont);
    for (const run of runs) {
        if (!run.shift && run.text.trim()) {
            lineHeightMm = Math.max(lineHeightMm, measurer.lineHeightMm(measuredFontOf(run)));
        }
    }
    const paragraphs = [[]];
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
    const lines = [];
    const justify = [];
    const width = (text, run) => measurer.measureWidthMm(text, measuredFontOf(run));
    for (const paragraph of paragraphs) {
        const tokens = [];
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
        const paragraphLines = [];
        let line = [];
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
            const merged = [];
            for (const token of tokensOfLine) {
                const last = merged[merged.length - 1];
                if (last &&
                    last.color === token.run.color &&
                    last.shift === token.run.shift &&
                    JSON.stringify(last.font) === JSON.stringify(token.run.font)) {
                    merged[merged.length - 1] = { ...last, text: last.text + token.text };
                }
                else {
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
//# sourceMappingURL=markup.js.map