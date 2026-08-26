#!/usr/bin/env tsx
/**
 * Render a sample invoice from the real engine, using the providers' own
 * sample data.
 *
 * The visual counterpart to the unit tests: those prove the PDF is structurally
 * valid and byte-reproducible, this proves it LOOKS like an invoice. Run it
 * after any change to the layout engine, the PDF renderer or a gallery
 * template, and actually open the file.
 *
 * Usage:
 *   npx tsx scripts/reporting/render-sample-invoice.ts [gallery-key] [outDir]
 *
 * Gallery keys come from the gallery index; pass none to render every one.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { templateDefinitionSchema } from '../../src/modules/reporting/templates/dto/template-definition.schema';
import { GALLERY_TEMPLATES } from '../../src/modules/reporting/templates/gallery/gallery.index';
import { FontRegistry } from '../../src/modules/reporting/engine/fonts/font.registry';
import { LayoutEngine } from '../../src/modules/reporting/engine/layout/layout.engine';
import { TextMeasurer } from '../../src/modules/reporting/engine/layout/text-measure';
import { BarcodeFactory } from '../../src/modules/reporting/engine/renderers/barcode.factory';
import { EscPRenderer } from '../../src/modules/reporting/engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from '../../src/modules/reporting/engine/renderers/grid/escpos.renderer';
import { ImageCache } from '../../src/modules/reporting/engine/renderers/image.cache';
import { PdfKitRenderer } from '../../src/modules/reporting/engine/renderers/pdfkit.renderer';
import { IRenderer } from '../../src/modules/reporting/engine/renderers/renderer.types';
import { SAMPLE_DATASETS } from '../../src/modules/reporting/templates/gallery/sample-data';

const galleryKey = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : null;
const outDir = resolve(process.argv[3] || 'artifacts/reporting-samples');

/** Pinned, so re-running produces byte-identical files and git shows no churn. */
const CREATION_DATE = new Date('2026-08-24T00:00:00.000Z');

const run = async (): Promise<void> => {
  mkdirSync(outDir, { recursive: true });

  const fonts = new FontRegistry();
  fonts.load();
  const engine = new LayoutEngine(new TextMeasurer(fonts));

  const renderers: Record<string, IRenderer> = {
    PDF: new PdfKitRenderer(fonts, new BarcodeFactory(), new ImageCache()),
    ESCP_DOTMATRIX: new EscPRenderer(),
    ESCPOS: new EscPosRenderer(),
  };

  const selected = galleryKey
    ? GALLERY_TEMPLATES.filter((entry) => entry.key === galleryKey)
    : GALLERY_TEMPLATES;

  if (selected.length === 0) {
    console.error(
      `Unknown gallery key '${galleryKey}'. Available: ${GALLERY_TEMPLATES.map((entry) => entry.key).join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  const report: unknown[] = [];

  for (const entry of selected) {
    const definition = templateDefinitionSchema.parse(entry.build());
    const renderer = renderers[entry.outputMode];

    if (!renderer) {
      console.error(`No renderer for output mode ${entry.outputMode}`);
      process.exitCode = 1;
      continue;
    }

    const tree = engine.render({
      definition,
      datasets: SAMPLE_DATASETS,
      ctx: { companyId: 'sample', branchId: 'sample', accYear: '2026-2027', docId: 'sample' },
      sys: { now: CREATION_DATE.toISOString() },
    });

    const result = await renderer.render(tree, { creationDate: CREATION_DATE });
    const filePath = join(outDir, `${entry.key}.${result.extension}`);
    writeFileSync(filePath, result.bytes);

    report.push({
      key: entry.key,
      mode: entry.outputMode,
      paper: entry.paperCode,
      pages: result.pageCount,
      bytes: result.bytes.length,
      layoutMs: tree.stats.durationMs,
      renderMs: result.durationMs,
      detailRows: tree.stats.detailRows,
      warnings: result.warnings,
      file: filePath,
    });
  }

  console.log(JSON.stringify(report, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
