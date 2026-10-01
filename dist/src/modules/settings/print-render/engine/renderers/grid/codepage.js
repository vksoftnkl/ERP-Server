"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUnprintableScripts = exports.getCodepage = exports.Codepage = void 0;
const CP437_HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
    'áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
    '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
    'αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const CP850_HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒ' +
    'áíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
    '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀' +
    'ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
const CP1252_HIGH = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ' +
    '‘’“”•–—˜™š›œžŸ' +
    ' ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿' +
    'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ';
const HIGH_RANGES = {
    CP437: CP437_HIGH,
    CP850: CP850_HIGH,
    CP1252: CP1252_HIGH,
    ASCII: '',
};
const TRANSLITERATIONS = [
    [/₹/g, 'Rs.'],
    [/[‘’‛]/g, "'"],
    [/[“”‟]/g, '"'],
    [/[–—―]/g, '-'],
    [/…/g, '...'],
    [/ /g, ' '],
    [/•/g, '*'],
    [/×/g, 'x'],
    [/₹/g, 'Rs.'],
    [/[̀-ͯ]/g, ''],
];
const SUBSTITUTE_BYTE = 0x3f;
class Codepage {
    name;
    reverse;
    constructor(name) {
        this.name = name;
        this.reverse = buildReverseMap(name);
    }
    encode(text) {
        const prepared = Codepage.prepare(text);
        const bytes = Buffer.alloc(prepared.length);
        const unmapped = new Set();
        let cursor = 0;
        for (const character of prepared) {
            const codePoint = character.codePointAt(0) ?? 0;
            if (codePoint < 0x80) {
                bytes[cursor] = codePoint < 0x20 && codePoint !== 0x09 ? 0x20 : codePoint;
                cursor += 1;
                continue;
            }
            const mapped = this.reverse.get(codePoint);
            if (mapped !== undefined) {
                bytes[cursor] = mapped;
                cursor += 1;
                continue;
            }
            bytes[cursor] = SUBSTITUTE_BYTE;
            cursor += 1;
            unmapped.add(character);
        }
        return { bytes: bytes.subarray(0, cursor), unmapped: [...unmapped] };
    }
    covers(text) {
        return this.encode(text).unmapped.length === 0;
    }
    static prepare(text) {
        let prepared = text.normalize('NFC');
        for (const [pattern, replacement] of TRANSLITERATIONS) {
            prepared = prepared.replace(pattern, replacement);
        }
        return prepared;
    }
}
exports.Codepage = Codepage;
const buildReverseMap = (name) => {
    const reverse = new Map();
    const high = HIGH_RANGES[name];
    for (let index = 0; index < high.length; index += 1) {
        const codePoint = high.codePointAt(index);
        if (codePoint === undefined) {
            continue;
        }
        if (!reverse.has(codePoint)) {
            reverse.set(codePoint, 0x80 + index);
        }
    }
    return reverse;
};
const codepageCache = new Map();
const getCodepage = (name) => {
    const normalised = (name ?? 'CP437').trim().toUpperCase();
    const resolved = normalised in HIGH_RANGES ? normalised : 'CP437';
    const cached = codepageCache.get(resolved);
    if (cached) {
        return cached;
    }
    const codepage = new Codepage(resolved);
    codepageCache.set(resolved, codepage);
    return codepage;
};
exports.getCodepage = getCodepage;
const findUnprintableScripts = (text) => {
    const scripts = new Set();
    for (const character of text) {
        const codePoint = character.codePointAt(0) ?? 0;
        if (codePoint >= 0x0b80 && codePoint <= 0x0bff) {
            scripts.add('Tamil');
        }
        else if (codePoint >= 0x0900 && codePoint <= 0x097f) {
            scripts.add('Devanagari');
        }
        else if (codePoint >= 0x0c00 && codePoint <= 0x0c7f) {
            scripts.add('Telugu');
        }
        else if (codePoint >= 0x0c80 && codePoint <= 0x0cff) {
            scripts.add('Kannada');
        }
        else if (codePoint >= 0x0d00 && codePoint <= 0x0d7f) {
            scripts.add('Malayalam');
        }
    }
    return [...scripts];
};
exports.findUnprintableScripts = findUnprintableScripts;
//# sourceMappingURL=codepage.js.map