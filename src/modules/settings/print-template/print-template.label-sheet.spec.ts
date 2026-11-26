import { PrintTemplateService } from './print-template.service';
import {
  EffectiveLabelSheet,
  collectLabelBodyErrors,
  collectLabelSheetErrors,
} from './utils/print-template-invariants';

/**
 * Sticker printing S-P1 (plan §4.1 / §7.3, §9.1 T1 / T2): the label sheet on
 * a design — the rules, the worked-out page the server stores, and the body
 * shape a label revision must have to be published.
 */

const USER = '01963d86-caf0-7b26-89f0-58ac380a2d60';

const sheet = (over: Partial<EffectiveLabelSheet> = {}): EffectiveLabelSheet => ({
  ptvLabelWidthMm: 50,
  ptvLabelHeightMm: 25,
  ptvLabelAcross: 2,
  ptvLabelDown: 1,
  ptvLabelGapXMm: 2,
  ptvLabelGapYMm: 0,
  ptvLabelRotate: 0,
  ptvLabelDpi: 203,
  ...over,
});
const page = { ptvPaperCode: 'LABEL', ptvEngine: 'JSON_BANDS' };
const codes = (errors: Array<{ code: string; field: string }>) =>
  errors.map((e) => `${e.code}:${e.field}`);

describe('collectLabelSheetErrors', () => {
  it('a complete sheet on a label purpose passes', () => {
    expect(collectLabelSheetErrors({ ...page, ...sheet() }, true)).toEqual([]);
  });
  it('a label purpose with no sheet → REQUIRED (named by the first missing key)', () => {
    const none = sheet({
      ptvLabelWidthMm: null,
      ptvLabelHeightMm: null,
      ptvLabelAcross: null,
      ptvLabelDown: null,
      ptvLabelDpi: null,
    });
    expect(codes(collectLabelSheetErrors({ ...page, ...none }, true))).toEqual([
      'PRINT_TEMPLATE_LABEL_SHEET_REQUIRED:ptvLabelWidthMm',
    ]);
  });
  it('across 0, dpi 250, rotate 45, a negative gap → INVALID with the bare field (the wording variant)', () => {
    expect(
      codes(
        collectLabelSheetErrors(
          {
            ...page,
            ...sheet({
              ptvLabelAcross: 0,
              ptvLabelDpi: 250,
              ptvLabelRotate: 45,
              ptvLabelGapXMm: -1,
            }),
          },
          true,
          'versions[0]',
        ),
      ),
    ).toEqual([
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvLabelAcross',
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvLabelGapXMm',
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvLabelRotate',
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvLabelDpi',
    ]);
  });
  it('a label larger than 500 mm, 51 down, A5 paper and a text engine are INVALID', () => {
    expect(
      codes(
        collectLabelSheetErrors(
          {
            ptvPaperCode: 'A5',
            ptvEngine: 'ESCPOS_TEXT',
            ...sheet({ ptvLabelWidthMm: 501, ptvLabelDown: 51 }),
          },
          true,
        ),
      ),
    ).toEqual([
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvLabelWidthMm',
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvLabelDown',
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvPaperCode',
      'PRINT_TEMPLATE_LABEL_SHEET_INVALID:ptvEngine',
    ]);
  });
  it('A4 is a sheet of labels and passes', () => {
    expect(
      collectLabelSheetErrors(
        { ...page, ptvPaperCode: 'A4', ...sheet({ ptvLabelDown: 8, ptvLabelAcross: 3 }) },
        true,
      ),
    ).toEqual([]);
  });
  it('a sheet on a Tax Invoice → NOT_LABEL; a plain design passes', () => {
    expect(codes(collectLabelSheetErrors({ ...page, ...sheet() }, false))).toEqual([
      'PRINT_TEMPLATE_LABEL_SHEET_NOT_LABEL:ptvLabelWidthMm',
    ]);
    const plain = sheet({
      ptvLabelWidthMm: null,
      ptvLabelHeightMm: null,
      ptvLabelAcross: null,
      ptvLabelDown: null,
      ptvLabelDpi: null,
      ptvLabelGapXMm: 0,
    });
    expect(collectLabelSheetErrors({ ...page, ...plain }, false)).toEqual([]);
  });
});

describe('collectLabelBodyErrors (publishing a label revision)', () => {
  const labelDataset = [
    { ptdRole: 'MASTER', ptdSourceKind: 'PROVIDER', ptdProviderCode: 'stickers.label' },
  ];
  const body = (bands: unknown[]) => JSON.stringify({ bands });
  it('one REPORT_HEADER band reading stickers.label passes', () => {
    expect(
      collectLabelBodyErrors(body([{ type: 'REPORT_HEADER', elements: [] }]), labelDataset),
    ).toEqual([]);
  });
  it('two bands, a DETAIL band, or no label dataset → LABEL_BODY_INVALID', () => {
    const two = body([{ type: 'REPORT_HEADER' }, { type: 'PAGE_FOOTER' }]);
    expect(codes(collectLabelBodyErrors(two, labelDataset))).toEqual([
      'PRINT_TEMPLATE_LABEL_BODY_INVALID:ptvBody',
    ]);
    expect(
      codes(collectLabelBodyErrors(body([{ type: 'DETAIL', dataset: 'items' }]), labelDataset)),
    ).toHaveLength(1);
    expect(codes(collectLabelBodyErrors(body([{ type: 'REPORT_HEADER' }]), []))).toHaveLength(1);
  });
});

// ─── The save path ────────────────────────────────────────────────────────────

function buildService(purposeCode: string) {
  const tx = {
    printTemplate: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ptlSyncDate: null,
          ptlModifiedOn: null,
          ...data,
          ptlId: 'new-template',
          ptlCreatedOn: new Date(),
          ptlPublishedRevId: null,
        }),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ptlId: 'new-template', ...data }),
      ),
    },
    printTemplateVersion: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ptvApprovedOn: null,
          ptvSyncDate: null,
          ptvModifiedOn: null,
          ...data,
          ptvId: 'new-version',
          ptvCreatedOn: new Date(),
          ptvIsDeleted: false,
        }),
      ),
      update: jest.fn(),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    printTemplateDataset: {
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ptdSyncDate: null,
          ptdModifiedOn: null,
          ptdCreatedOn: new Date(),
          ...data,
          ptdId: 'new-dataset',
        }),
      ),
      update: jest.fn(),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    printTemplateAssignment: { findFirst: jest.fn(() => Promise.resolve(null)) },
    printPurpose: { findUnique: jest.fn(() => Promise.resolve({ ppoCode: purposeCode })) },
  };
  const prisma = { ...tx, $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) };
  const service = new PrintTemplateService(
    prisma as never,
    { logEntityChange: jest.fn() } as never,
    { getUserId: () => USER } as never,
  );
  return { service, tx };
}

const errorsOf = async (
  run: () => Promise<unknown>,
): Promise<Array<{ code: string; field: string }>> => {
  try {
    await run();
  } catch (error) {
    return (
      error as { getResponse: () => { errors: Array<{ code: string; field: string }> } }
    ).getResponse().errors;
  }
  throw new Error('expected a refusal');
};

const labelBody = { bands: [{ type: 'REPORT_HEADER', heightMm: 25, elements: [] }] };
const labelDatasetRow = {
  ptdRole: 'MASTER',
  ptdName: 'label',
  ptdSourceKind: 'PROVIDER',
  ptdProviderCode: 'stickers.label',
};

describe('PrintTemplateService.saveTemplate — a label design (T1 / T2)', () => {
  it('stores the label sheet and the worked-out page: 50 × 25, 2 across, gap 2, side 1 → 104 × 25', async () => {
    const { service, tx } = buildService('ITEM_LABEL');
    await service.saveTemplate({
      ptlPurposeId: 'ppo-item',
      ptlCode: 'ZT-STICKER',
      ptlName: 'ZT sticker',
      versions: [
        {
          ptvBody: JSON.stringify(labelBody),
          ptvPaperCode: 'LABEL',
          ptvMarginLeftMm: 1,
          ptvLabelWidthMm: 50,
          ptvLabelHeightMm: 25,
          ptvLabelAcross: 2,
          ptvLabelDown: 1,
          ptvLabelGapXMm: 2,
          ptvLabelDpi: 203,
          datasets: [labelDatasetRow],
        },
      ],
    });
    expect(tx.printTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ptvWidthMm: 104,
          ptvHeightMm: 25,
          ptvMarginRightMm: 1,
          ptvLabelWidthMm: 50,
          ptvLabelAcross: 2,
          ptvLabelDpi: 203,
          ptvLabelGapXMm: 2,
          ptvLabelRotate: 0,
        }),
      }),
    );
  });

  it('refuses a label purpose with no sheet, and a sheet on a Tax Invoice', async () => {
    const label = buildService('ITEM_LABEL');
    const errors = await errorsOf(() =>
      label.service.saveTemplate({
        ptlPurposeId: 'ppo-item',
        ptlCode: 'ZT-STICKER',
        ptlName: 'ZT sticker',
        versions: [{ ptvBody: JSON.stringify(labelBody), ptvPaperCode: 'LABEL' }],
      }),
    );
    expect(errors.map((e) => e.code)).toContain('PRINT_TEMPLATE_LABEL_SHEET_REQUIRED');

    const invoice = buildService('SALE_INVOICE');
    const notLabel = await errorsOf(() =>
      invoice.service.saveTemplate({
        ptlPurposeId: 'ppo-invoice',
        ptlCode: 'ZT-INV',
        ptlName: 'ZT invoice',
        versions: [{ ptvBody: JSON.stringify(labelBody), ptvLabelWidthMm: 50 }],
      }),
    );
    expect(notLabel.map((e) => e.code)).toEqual(['PRINT_TEMPLATE_LABEL_SHEET_NOT_LABEL']);
  });

  it('publishing a label revision with two bands → PRINT_TEMPLATE_LABEL_BODY_INVALID', async () => {
    const { service } = buildService('ITEM_LABEL');
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlPurposeId: 'ppo-item',
        ptlCode: 'ZT-STICKER',
        ptlName: 'ZT sticker',
        versions: [
          {
            ptvStatus: 'PUBLISHED',
            ptvBody: JSON.stringify({
              bands: [{ type: 'REPORT_HEADER' }, { type: 'PAGE_FOOTER' }],
            }),
            ptvPaperCode: 'LABEL',
            ptvLabelWidthMm: 50,
            ptvLabelHeightMm: 25,
            ptvLabelAcross: 2,
            ptvLabelDown: 1,
            ptvLabelDpi: 203,
            datasets: [labelDatasetRow],
          },
        ],
      }),
    );
    expect(errors.map((e) => e.code)).toEqual(['PRINT_TEMPLATE_LABEL_BODY_INVALID']);
  });
});
