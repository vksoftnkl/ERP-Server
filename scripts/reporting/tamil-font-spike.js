#!/usr/bin/env node
/**
 * Phase 0.2 — Tamil / complex-script rendering spike.
 *
 * Question: can PDFKit (fontkit shaping) render Tamil conjuncts and vowel
 * signs correctly, or is a Chromium renderer required?
 *
 * Run: node scripts/reporting/tamil-font-spike.js [outDir]
 *
 * Two verdicts are reported separately, because they have different fixes:
 *
 *   SHAPING  — does fontkit apply the Indic shaper (cluster ligation, pulli
 *              stacking, left-reordering vowel signs)?
 *              Fix if failing: Chromium renderer behind IRenderer.
 *
 *   COVERAGE — does a single font cover every codepoint in the string?
 *              Fix if failing: split text into script runs and pick a font
 *              per run (font fallback) — cheap, stays inside PDFKit.
 */
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const PdfDocument = require('pdfkit');
const fontkit = require('fontkit');

const FONT_DIR = '/usr/share/fonts/truetype/noto';
const FONTS = {
  latin: join(FONT_DIR, 'NotoSans-Regular.ttf'),
  latinBold: join(FONT_DIR, 'NotoSans-Bold.ttf'),
  tamil: join(FONT_DIR, 'NotoSansTamil-Regular.ttf'),
  tamilBold: join(FONT_DIR, 'NotoSansTamil-Bold.ttf'),
};

// Real-world Tamil business strings: conjuncts (ksha), the pulli (virama)
// that stacks consonants, and vowel signs that reorder left of their
// consonant. The last two samples deliberately mix scripts.
const SAMPLES = [
  { label: 'Company name', text: 'ஸ்ரீ லக்ஷ்மி வெங்கடேஸ்வரா ட்ரேடர்ஸ்' },
  { label: 'Address', text: 'திருச்சி மெயின் ரோடு, சேலம் - 636001' },
  { label: 'Invoice caption', text: 'வரி விலைப்பட்டியல்' },
  { label: 'Item name', text: 'சர்க்கரை 1 கிலோ பாக்கெட்' },
  { label: 'Amount in words', text: 'ரூபாய் இரண்டு லட்சம் ஐம்பதாயிரம் மட்டும்' },
  { label: 'Mixed script', text: 'GST 33AABCU9603R1ZM / ஜி.எஸ்.டி' },
  { label: 'Mixed item line', text: 'Sugar சர்க்கரை 1kg x 12' },
];

// Codepoint ranges that must be rendered with the Tamil face.
const isTamil = (codepoint) =>
  (codepoint >= 0x0b80 && codepoint <= 0x0bff) || // Tamil
  (codepoint >= 0x11fc0 && codepoint <= 0x11fff); // Tamil Supplement

// Neutral characters (space, digits, punctuation) attach to the current run
// rather than starting a new one, so "1 கிலோ" stays one Tamil run.
const isNeutral = (codepoint) =>
  codepoint === 0x20 ||
  codepoint === 0x2c ||
  codepoint === 0x2e ||
  codepoint === 0x2d ||
  codepoint === 0x2f ||
  (codepoint >= 0x30 && codepoint <= 0x39);

/** Split a string into runs of {script, text} so each run gets one font. */
const splitScriptRuns = (text) => {
  const runs = [];
  for (const char of text) {
    const codepoint = char.codePointAt(0);
    const script = isTamil(codepoint) ? 'tamil' : 'latin';
    const last = runs[runs.length - 1];

    if (last && (isNeutral(codepoint) || last.script === script)) {
      last.text += char;
      continue;
    }

    runs.push({ script, text: char });
  }
  return runs;
};

const readPackageVersion = (packageName) =>
  JSON.parse(readFileSync(join('node_modules', packageName, 'package.json'), 'utf8')).version;

const outDir = resolve(process.argv[2] || 'artifacts/reporting-spikes');
mkdirSync(outDir, { recursive: true });

const loadedFonts = {
  latin: fontkit.openSync(FONTS.latin),
  tamil: fontkit.openSync(FONTS.tamil),
};

let shapingFailures = 0;
let coverageFailuresSingleFont = 0;
let coverageFailuresWithFallback = 0;
const results = [];

for (const sample of SAMPLES) {
  const codepoints = Array.from(sample.text).map((char) => char.codePointAt(0));
  const hasTamil = codepoints.some(isTamil);

  // (a) Naive single-font path: everything through the Tamil face.
  const singleFont = loadedFonts.tamil;
  const singleRun = singleFont.layout(sample.text);
  const singleUncovered = codepoints.filter((cp) => !singleFont.hasGlyphForCodePoint(cp));

  // (b) Script-run path: each run laid out with the font for its script.
  const runs = splitScriptRuns(sample.text);
  let fallbackUncovered = 0;
  let fallbackGlyphs = 0;
  let fallbackNotdef = 0;

  for (const run of runs) {
    const font = loadedFonts[run.script];
    const laidOut = font.layout(run.text);
    fallbackGlyphs += laidOut.glyphs.length;
    fallbackNotdef += laidOut.glyphs.filter((glyph) => glyph.id === 0).length;
    fallbackUncovered += Array.from(run.text).filter(
      (char) => !font.hasGlyphForCodePoint(char.codePointAt(0)),
    ).length;
  }

  // Shaping is judged only on the Tamil portion, laid out with the Tamil
  // face — that is the thing PDFKit either can or cannot do.
  const tamilOnly = runs
    .filter((run) => run.script === 'tamil')
    .map((run) => run.text)
    .join('');
  const tamilRun = tamilOnly ? loadedFonts.tamil.layout(tamilOnly) : { glyphs: [] };
  const tamilCodepoints = Array.from(tamilOnly).length;
  const shapedIntoClusters = !hasTamil || tamilRun.glyphs.length < tamilCodepoints;
  const tamilNotdef = tamilRun.glyphs.filter((glyph) => glyph.id === 0).length;

  if (!shapedIntoClusters || tamilNotdef > 0) {
    shapingFailures += 1;
  }
  if (singleUncovered.length > 0) {
    coverageFailuresSingleFont += 1;
  }
  if (fallbackUncovered > 0 || fallbackNotdef > 0) {
    coverageFailuresWithFallback += 1;
  }

  results.push({
    label: sample.label,
    text: sample.text,
    codepoints: codepoints.length,
    singleFont: { glyphs: singleRun.glyphs.length, uncovered: singleUncovered.length },
    scriptRuns: runs.map((run) => `${run.script}:${JSON.stringify(run.text)}`),
    withFallback: { glyphs: fallbackGlyphs, uncovered: fallbackUncovered, notdef: fallbackNotdef },
    tamilShaping: tamilOnly
      ? { codepoints: tamilCodepoints, glyphs: tamilRun.glyphs.length, notdef: tamilNotdef }
      : null,
  });
}

// Left-reordering probe: in "கெ" (ka + vowel sign e) the vowel sign glyph
// must be emitted BEFORE the consonant, i.e. visual order != logical order.
const reorderRun = loadedFonts.tamil.layout('கெ');
const kaGlyphId = loadedFonts.tamil.glyphsForString('க')[0].id;
const reorderingHandled = reorderRun.glyphs.length === 2 && reorderRun.glyphs[1].id === kaGlyphId;
if (!reorderingHandled) {
  shapingFailures += 1;
}

// ── Visual proof PDF ────────────────────────────────────────────────────
const doc = new PdfDocument({ size: 'A4', margin: 40, autoFirstPage: true });
const chunks = [];
doc.on('data', (chunk) => chunks.push(chunk));

doc.registerFont('Latin', FONTS.latin);
doc.registerFont('LatinBold', FONTS.latinBold);
doc.registerFont('Tamil', FONTS.tamil);
doc.registerFont('TamilBold', FONTS.tamilBold);

/** Draw one line of possibly mixed-script text using per-run fonts. */
const drawMixed = (text, { size, bold = false, x = 40 }) => {
  const runs = splitScriptRuns(text);
  let cursorX = x;
  const y = doc.y;

  for (const run of runs) {
    const fontName =
      run.script === 'tamil' ? (bold ? 'TamilBold' : 'Tamil') : bold ? 'LatinBold' : 'Latin';
    doc.font(fontName).fontSize(size);
    doc.text(run.text, cursorX, y, { lineBreak: false });
    cursorX += doc.widthOfString(run.text);
  }

  doc.x = x;
  doc.y = y + size * 1.35;
};

doc.font('LatinBold').fontSize(15).text('Phase 0.2 — PDFKit complex-script spike');
doc.moveDown(0.3);
doc
  .font('Latin')
  .fontSize(8.5)
  .fillColor('#555555')
  .text(
    'Left column: whole string forced through NotoSansTamil. Right of it: the same string ' +
      'split into script runs with a font per run. Check that Tamil clusters are identical in ' +
      'both, and that Latin is only legible in the script-run rendering.',
    { width: 515 },
  );
doc.fillColor('#000000').moveDown(1);

for (const sample of SAMPLES) {
  doc.font('Latin').fontSize(7.5).fillColor('#888888').text(sample.label.toUpperCase());
  doc.fillColor('#000000');

  doc.font('Latin').fontSize(7).fillColor('#aa3333').text('single font  ');
  doc.fillColor('#000000');
  doc.font('Tamil').fontSize(14).text(sample.text);
  doc.moveDown(0.15);

  doc.font('Latin').fontSize(7).fillColor('#337733').text('script runs  ');
  doc.fillColor('#000000');
  drawMixed(sample.text, { size: 14 });
  doc.moveDown(0.55);
}

doc.addPage();
doc.font('LatinBold').fontSize(12).text('Cluster analysis');
doc.moveDown(0.4);
doc.font('Latin').fontSize(8);
for (const result of results) {
  doc.text(
    `${result.label}: ${result.codepoints} cp | single-font ${result.singleFont.glyphs} glyphs ` +
      `(${result.singleFont.uncovered} uncovered) | script-runs ${result.withFallback.glyphs} glyphs ` +
      `(${result.withFallback.uncovered} uncovered, ${result.withFallback.notdef} notdef)`,
    { width: 515 },
  );
  doc.moveDown(0.2);
}
doc.moveDown(0.4);
doc.text(`Left-reordering vowel sign (ka + vowel sign e) handled: ${reorderingHandled ? 'yes' : 'NO'}`);

doc.end();

doc.on('end', () => {
  const pdfPath = join(outDir, 'tamil-shaping-spike.pdf');
  writeFileSync(pdfPath, Buffer.concat(chunks));

  const shapingVerdict = shapingFailures === 0 ? 'PASS' : 'FAIL';
  const coverageVerdict = coverageFailuresWithFallback === 0 ? 'PASS' : 'FAIL';

  const report = {
    phase: '0.2',
    shapingVerdict,
    coverageVerdict,
    pdfkitVersion: readPackageVersion('pdfkit'),
    fontkitVersion: readPackageVersion('fontkit'),
    fonts: FONTS,
    reorderingVowelSignHandled: reorderingHandled,
    samplesFailingCoverageWithSingleFont: coverageFailuresSingleFont,
    samplesFailingCoverageWithFallback: coverageFailuresWithFallback,
    samples: results,
    decision:
      shapingVerdict === 'PASS'
        ? 'PDFKit is the primary PDF renderer — fontkit applies the Indic shaper correctly. ' +
          'No Chromium fallback needed for Tamil. Phase 4 MUST implement per-script-run font ' +
          'selection: NotoSansTamil has no Latin coverage, so a single-font draw drops Latin ' +
          'glyphs silently.'
        : 'PDFKit failed complex-script shaping. Add chromium.renderer.ts behind IRenderer for ' +
          'templates flagged complexScript.',
  };
  writeFileSync(join(outDir, 'tamil-shaping-spike.json'), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nPDF written to ${pdfPath}`);
  process.exitCode = shapingVerdict === 'PASS' && coverageVerdict === 'PASS' ? 0 : 1;
});
