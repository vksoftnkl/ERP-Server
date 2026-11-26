import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { HttpException } from '@nestjs/common';
import { Prisma, PrintTemplateDataset, PrintTemplateVersion } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { PrintTemplateAssignmentService } from '../print-template-assignment/print-template-assignment.service';
import { testLabelBands } from '../../Inventory/stickers/sticker-jobs.service';
import { DatasetRunnerService } from './data/dataset-runner.service';
import { stickerSampleRows } from './data/providers/sticker-label.provider';
import { FontRegistry } from './engine/fonts/font.registry';
import { LayoutEngine } from './engine/layout/layout.engine';
import { TextMeasurer } from './engine/layout/text-measure';
import { BarcodeFactory } from './engine/renderers/barcode.factory';
import { EscPRenderer } from './engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from './engine/renderers/grid/escpos.renderer';
import { ImageCache } from './engine/renderers/image.cache';
import { PdfKitRenderer } from './engine/renderers/pdfkit.renderer';
import { PrintLogService } from './print-log.service';
import { PrintRenderService } from './print-render.service';

/**
 * Sticker printing S-P1 — THE label path (plan §4.4), end to end from a stored
 * label design to PDF bytes: the designer's Preview with the SAMPLE rows, a
 * job's rows, the single-label preview and Test print. The two SAMPLE designs
 * (§7.6) are the bodies shipped in docs/print-templates/sticker-samples, copied
 * into __fixtures__.
 */

const decimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8'));

interface Sheet {
  w: number;
  h: number;
  across: number;
  down?: number;
  gapX?: number;
  side?: number;
  rotate?: number;
  dpi?: number;
  paper?: string;
  pageW?: number | null;
  pageH?: number | null;
}

function labelVersion(
  body: unknown,
  sheet: Sheet | null,
  overrides: Partial<PrintTemplateVersion> = {},
) {
  return {
    ptvId: '0196-label-version',
    ptvTemplateId: '0196-label-template',
    ptvRevNo: 1,
    ptvStatus: 'PUBLISHED',
    ptvEngine: 'JSON_BANDS',
    ptvBody: JSON.stringify(body),
    ptvSchemaVer: 1,
    ptvPaperCode: sheet?.paper ?? 'LABEL',
    ptvOrientation: 'PORTRAIT',
    ptvWidthMm: sheet?.pageW ? decimal(sheet.pageW) : null,
    ptvHeightMm: sheet?.pageH ? decimal(sheet.pageH) : null,
    ptvMarginTopMm: decimal(0),
    ptvMarginBottomMm: decimal(0),
    ptvMarginLeftMm: decimal(sheet?.side ?? 1),
    ptvMarginRightMm: decimal(sheet?.side ?? 1),
    ptvColumns: null,
    ptvLabelWidthMm: sheet ? decimal(sheet.w) : null,
    ptvLabelHeightMm: sheet ? decimal(sheet.h) : null,
    ptvLabelAcross: sheet ? sheet.across : null,
    ptvLabelDown: sheet ? (sheet.down ?? 1) : null,
    ptvLabelGapXMm: decimal(sheet?.gapX ?? 0),
    ptvLabelGapYMm: decimal(0),
    ptvLabelRotate: sheet?.rotate ?? 0,
    ptvLabelDpi: sheet ? (sheet.dpi ?? 203) : null,
    ptvLang: 'en-IN',
    ptvFontFamily: null,
    ptvParams: null,
    ptvNote: null,
    ptvApprovedOn: new Date('2026-11-25T00:00:00Z'),
    ptvApprovedBy: null,
    ptvIsDeleted: false,
    ptvSyncDate: null,
    ptvCreatedOn: new Date('2026-11-25T00:00:00Z'),
    ptvCreatedBy: null,
    ptvModifiedOn: null,
    ptvModifiedBy: null,
    ...overrides,
  };
}

const LABEL_DATASET = {
  ptdId: '0196-label-dataset',
  ptdVersionId: '0196-label-version',
  ptdRole: 'MASTER',
  ptdDatasetNo: 0,
  ptdSortOrder: 0,
  ptdName: 'label',
  ptdLabel: null,
  ptdSourceKind: 'PROVIDER',
  ptdProviderCode: 'stickers.label',
  ptdSql: null,
  ptdSqlNorm: null,
  ptdParentNo: null,
  ptdLinkFields: null,
  ptdRowLimit: 1,
  ptdTimeoutMs: 15000,
  ptdRemarks: null,
  ptdIsDeleted: false,
  ptdSyncDate: null,
  ptdCreatedOn: new Date('2026-11-25T00:00:00Z'),
  ptdCreatedBy: null,
  ptdModifiedOn: null,
  ptdModifiedBy: null,
} as PrintTemplateDataset;

function buildService(version: PrintTemplateVersion): {
  service: PrintRenderService;
  runs: number[];
} {
  const fonts = new FontRegistry();
  fonts.load();
  const layout = new LayoutEngine(new TextMeasurer(fonts));
  const runs: number[] = [];
  const prisma = {
    printTemplateVersion: {
      findFirst: () =>
        Promise.resolve({
          ...version,
          template: {
            ptlId: '0196-label-template',
            ptlCompanyId: null,
            ptlPurposeId: 'purpose-item-label',
            ptlCode: 'SAMPLE-ITEM-50X25',
            ptlName: 'SAMPLE item 50 × 25',
          },
          datasets: [LABEL_DATASET],
        }),
    },
  } as unknown as PrismaService;
  const datasetRunner = {
    run: (request: { datasets: unknown[] }) => {
      runs.push(request.datasets.length);
      return Promise.resolve({ data: {}, resolved: [], warnings: [] });
    },
  } as unknown as DatasetRunnerService;
  const printLog = {
    currentAccYear: () => Promise.resolve('2026-2027'),
    record: () => Promise.reject(new Error('the label path must not log')),
  } as unknown as PrintLogService;
  const service = new PrintRenderService(
    prisma,
    datasetRunner,
    {} as unknown as PrintTemplateAssignmentService,
    printLog,
    layout,
    new PdfKitRenderer(fonts, new BarcodeFactory(), new ImageCache()),
    new EscPosRenderer(),
    new EscPRenderer(),
  );
  return { service, runs };
}

const context = {
  companyId: 'company-1',
  branchId: 'branch-1',
  accYear: '2026-2027',
  docId: null,
  userId: 'user-1',
  deviceId: null,
};

/** Every page's MediaBox, in points (PDFKit writes page dictionaries uncompressed). */
function mediaBoxes(bytes: Buffer): number[][] {
  const text = bytes.toString('latin1');
  return [...text.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((match) =>
    match[1].trim().split(/\s+/).map(Number),
  );
}

/** Every content stream, inflated (PDFKit compresses them with FlateDecode). */
function pageContents(bytes: Buffer): string[] {
  const text = bytes.toString('latin1');
  const out: string[] = [];
  for (const match of text.matchAll(/stream\r?\n/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      out.push(inflateSync(bytes.subarray(start, end)).toString('latin1'));
    } catch {
      // not a Flate stream (a font, an image): skip
    }
  }
  return out;
}

const ITEM_SHEET: Sheet = {
  w: 50,
  h: 25,
  across: 2,
  gapX: 2,
  side: 1,
  dpi: 203,
  pageW: 104,
  pageH: 25,
};
const PACK_SHEET: Sheet = { w: 75, h: 50, across: 1, side: 1, dpi: 203, pageW: 77, pageH: 50 };

describe('PrintRenderService — the label path (sticker printing S-P1)', () => {
  it('the designer’s Preview of SAMPLE item: 3 SAMPLE rows × 2 labels, 2 across → 3 pages of 104 × 25 mm in whole dots', async () => {
    const { service, runs } = buildService(
      labelVersion(fixture('sticker-sample-item-50x25.json'), ITEM_SHEET),
    );
    const outcome = await service.preview({ versionId: '0196-label-version', context, params: {} });
    expect(outcome.pageCount).toBe(3);
    expect(outcome.contentType).toBe('application/pdf');
    expect(outcome.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    // 104 mm = 831 dots at 203 dpi = 294.74 pt; 25 mm = 200 dots = 70.94 pt.
    for (const box of mediaBoxes(outcome.bytes)) {
      expect(box[2]).toBeCloseTo((831 * 72) / 203, 3);
      expect(box[3]).toBeCloseTo((200 * 72) / 203, 3);
    }
    expect(outcome.warnings.filter((warning) => warning.kind === 'expression')).toEqual([]);
    // Only the label dataset, which the path binds itself: no dataset run.
    expect(runs).toEqual([]);
  });

  it('SAMPLE pack 75 × 50 renders a job’s rows, one label a page, no warnings', async () => {
    const { service } = buildService(
      labelVersion(fixture('sticker-sample-pack-75x50.json'), PACK_SHEET),
    );
    const rows = stickerSampleRows().map((row) => ({ row, labels: 1 }));
    const outcome = await service.renderLabels({ versionId: 'v', context, rows });
    expect(outcome.labelCount).toBe(3);
    expect(outcome.pageCount).toBe(3);
    expect(outcome.printDpi).toBe(203);
    expect(outcome.warnings).toEqual([]);
    const [box] = mediaBoxes(outcome.bytes);
    expect(box[2]).toBeCloseTo((Math.round((77 * 203) / 25.4) * 72) / 203, 3);
  });

  it('the item design: 7 labels 2 across → 4 pages; the printer’s 300 dpi re-snaps the page', async () => {
    const { service } = buildService(
      labelVersion(fixture('sticker-sample-item-50x25.json'), ITEM_SHEET),
    );
    const [sugar] = stickerSampleRows();
    const outcome = await service.renderLabels({
      versionId: 'v',
      context,
      rows: [{ row: sugar, labels: 7 }],
      printDpi: 300,
    });
    expect(outcome.pageCount).toBe(4);
    expect(outcome.printDpi).toBe(300);
    const [box] = mediaBoxes(outcome.bytes);
    expect(box[2]).toBeCloseTo((Math.round((104 * 300) / 25.4) * 72) / 300, 3);
    expect(outcome.warnings).toEqual([]);
  });

  it('the sticker preview pane: one label as read, alone on a 50 × 25 page', async () => {
    const { service } = buildService(
      labelVersion(fixture('sticker-sample-item-50x25.json'), ITEM_SHEET),
    );
    const outcome = await service.renderLabels({
      versionId: 'v',
      context,
      rows: [{ row: stickerSampleRows()[2], labels: 1 }],
      singleLabel: true,
    });
    expect(outcome.pageCount).toBe(1);
    const [box] = mediaBoxes(outcome.bytes);
    expect(box[2]).toBeCloseTo((Math.round((50 * 203) / 25.4) * 72) / 203, 3);
  });

  it('a label turned 90° sits in a 25 × 50 cell (page 54 × 50)', async () => {
    const { service } = buildService(
      labelVersion(fixture('sticker-sample-item-50x25.json'), { ...ITEM_SHEET, rotate: 90 }),
    );
    const outcome = await service.renderLabels({
      versionId: 'v',
      context,
      rows: [{ row: stickerSampleRows()[0], labels: 2 }],
    });
    expect(outcome.pageCount).toBe(1);
    const [box] = mediaBoxes(outcome.bytes);
    expect(box[2]).toBeCloseTo((Math.round((54 * 203) / 25.4) * 72) / 203, 3);
    expect(box[3]).toBeCloseTo((Math.round((50 * 203) / 25.4) * 72) / 203, 3);
  });

  it('Test print: the code-built test label through the same path, one label in cell 1', async () => {
    const { service } = buildService(
      labelVersion(fixture('sticker-sample-item-50x25.json'), ITEM_SHEET),
    );
    const outcome = await service.renderLabels({
      versionId: 'v',
      context,
      rows: [{ row: {}, labels: 1 }],
      printDpi: 203,
      bands: testLabelBands({
        widthMm: 50,
        heightMm: 25,
        across: 2,
        dpi: 203,
        counter: 'D8',
        printer: 'TSC TE244',
      }),
    });
    expect(outcome.pageCount).toBe(1);
    expect(outcome.labelCount).toBe(1);
    expect(outcome.warnings).toEqual([]);
  });

  it('SF3: every cell is clipped to its own label; a barcode wider than its box warns', async () => {
    const { service } = buildService(
      labelVersion(fixture('sticker-sample-item-50x25.json'), ITEM_SHEET),
    );
    // Auto picks Code 128 for a code with letters: ~178 modules × 3 dots ≈ 66.8 mm in a 36 mm box.
    const [sugar] = stickerSampleRows();
    const outcome = await service.renderLabels({
      versionId: 'v',
      context,
      rows: [{ row: { ...sugar, barcode: 'ITEM-ABC-1234' }, labels: 2 }],
      printDpi: 203,
    });
    expect(outcome.pageCount).toBe(1);
    expect(outcome.warnings.map((warning) => warning.message)).toContain(
      'Barcode wider than its box at 3 dots: use 2 dots or a wider box',
    );
    // Each of the 2 cells: "0 0 <w> <h> re" then "W n" (clip, no paint) before it draws.
    const content = pageContents(outcome.bytes).join('\n');
    const clips = [...content.matchAll(/0 0 ([\d.]+) ([\d.]+) re\s+W n/g)];
    expect(clips).toHaveLength(2);
    for (const clip of clips) {
      expect(Number(clip[1])).toBeCloseTo((50 * 72) / 25.4, 2);
      expect(Number(clip[2])).toBeCloseTo((25 * 72) / 25.4, 2);
    }
  });

  it('a design with no label sheet is refused STICKER_DESIGN_NOT_LABEL', async () => {
    const { service } = buildService(labelVersion(fixture('sticker-sample-item-50x25.json'), null));
    await expect(
      service.renderLabels({ versionId: 'v', context, rows: [{ row: {}, labels: 1 }] }),
    ).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'STICKER_DESIGN_NOT_LABEL' })] },
    });
    await expect(
      service.renderLabels({ versionId: 'v', context, rows: [{ row: {}, labels: 1 }] }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
