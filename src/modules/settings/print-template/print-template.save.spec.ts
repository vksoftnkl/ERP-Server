import { PrintTemplateService } from './print-template.service';
import { SavePrintTemplateDto } from './dto/save-print-template.dto';

/**
 * The three rules the schema states and no constraint enforces:
 *
 *   1. A published version is never UPDATEd — print_log points at those bytes.
 *   2. The version history is append-only, so a revision MISSING from the array
 *      is left alone; the datasets array behaves the other way round.
 *   3. Publishing is a pointer move on print_template, not a flag on the row.
 *
 * All three are invisible to the compiler and are exactly what a refactor
 * loses, so the writes the service hands Prisma are pinned here.
 */

const TEMPLATE_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const USER = '01963d86-caf0-7b26-89f0-58ac380a2d60';

const templateRow = (overrides: Record<string, unknown> = {}) => ({
  ptlId: TEMPLATE_ID,
  ptlCompanyId: null,
  ptlPurposeId: 'purpose-1',
  ptlCode: 'SALE_INVOICE_A4',
  ptlName: 'Tax Invoice A4',
  ptlDescription: null,
  ptlPublishedRevId: null,
  ptlForkedFromId: null,
  ptlForkedFromRev: null,
  ptlSortOrder: 100,
  ptlCompanyKey: '00000000-0000-0000-0000-000000000000',
  ptlIsActive: true,
  ptlIsDeleted: false,
  ptlSyncDate: null,
  ptlCreatedOn: new Date('2026-01-01T00:00:00.000Z'),
  ptlCreatedBy: null,
  ptlModifiedOn: null,
  ptlModifiedBy: null,
  company: null,
  purpose: { ppoCode: 'SALE_INVOICE', ppoName: 'Sale Invoice' },
  forkedFrom: null,
  publishedRev: null,
  versions: [],
  ...overrides,
});

const versionRow = (overrides: Record<string, unknown> = {}) => ({
  ptvId: 'v1',
  ptvTemplateId: TEMPLATE_ID,
  ptvRevNo: 1,
  ptvStatus: 'DRAFT',
  ptvEngine: 'JSON_BANDS',
  ptvBody: '{"bands":[]}',
  ptvSchemaVer: 1,
  ptvPaperCode: 'A4',
  ptvOrientation: 'PORTRAIT',
  ptvWidthMm: null,
  ptvHeightMm: null,
  ptvMarginTopMm: 0,
  ptvMarginBottomMm: 0,
  ptvMarginLeftMm: 0,
  ptvMarginRightMm: 0,
  ptvColumns: null,
  ptvLang: 'en-IN',
  ptvFontFamily: null,
  ptvParams: null,
  ptvNote: null,
  ptvApprovedOn: null,
  ptvApprovedBy: null,
  ptvIsDeleted: false,
  ptvSyncDate: null,
  ptvCreatedOn: new Date('2026-01-01T00:00:00.000Z'),
  ptvCreatedBy: null,
  ptvModifiedOn: null,
  ptvModifiedBy: null,
  datasets: [],
  ...overrides,
});

const datasetRow = (overrides: Record<string, unknown> = {}) => ({
  ptdId: 'd1',
  ptdVersionId: 'v1',
  ptdRole: 'DETAIL',
  ptdDatasetNo: 1,
  ptdSortOrder: 0,
  ptdName: 'items',
  ptdLabel: null,
  ptdSourceKind: 'PROVIDER',
  ptdProviderCode: 'sales.bill.items',
  ptdSql: null,
  ptdSqlNorm: null,
  ptdRequiresCompany: true,
  ptdParentNo: null,
  ptdLinkFields: null,
  ptdRowLimit: 5000,
  ptdTimeoutMs: 15000,
  ptdRemarks: null,
  ptdIsDeleted: false,
  ptdSyncDate: null,
  ptdCreatedOn: new Date('2026-01-01T00:00:00.000Z'),
  ptdCreatedBy: null,
  ptdModifiedOn: null,
  ptdModifiedBy: null,
  ...overrides,
});

type Args = { data: Record<string, unknown>; where?: Record<string, unknown> };

/**
 * A Prisma double, not a stub: the assertions below are about WHICH writes the
 * service issues and in what order, so every method records its call and hands
 * back a row shaped like the real one.
 */
const buildService = (template: ReturnType<typeof templateRow> | null) => {
  const liveDatasets = (template?.versions ?? []).flatMap(
    (version: Record<string, unknown>) => (version.datasets as unknown[]) ?? [],
  );

  const tx = {
    printTemplate: {
      // findFirst serves two callers: the read that loads the template, and
      // assertCodeIsFree, which is the one that passes `select`.
      findFirst: jest.fn((args: Record<string, unknown>) =>
        Promise.resolve(args.select ? null : template),
      ),
      create: jest.fn(({ data }: Args) =>
        Promise.resolve({ ...templateRow(), ...data, ptlId: 'new-template' }),
      ),
      update: jest.fn(({ data }: Args) =>
        Promise.resolve({ ...templateRow(), ...template, ...data }),
      ),
    },
    printTemplateVersion: {
      create: jest.fn(({ data }: Args) =>
        Promise.resolve({ ...versionRow(), ...data, ptvId: 'new-version' }),
      ),
      update: jest.fn(({ where, data }: Args) =>
        Promise.resolve({ ...versionRow({ ptvId: where?.ptvId as string }), ...data }),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    printTemplateDataset: {
      findMany: jest.fn(() => Promise.resolve(liveDatasets)),
      create: jest.fn(({ data }: Args) =>
        Promise.resolve({ ...datasetRow(), ...data, ptdId: 'new-dataset' }),
      ),
      update: jest.fn(({ where, data }: Args) =>
        Promise.resolve({ ...datasetRow({ ptdId: where?.ptdId as string }), ...data }),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    printTemplateAssignment: {
      findFirst: jest.fn((): Promise<{ ptaId: string } | null> => Promise.resolve(null)),
    },
  };

  const prisma = {
    ...tx,
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const service = new PrintTemplateService(
    prisma as never,
    { logEntityChange: jest.fn() } as never,
    { getUserId: () => USER } as never,
  );
  return { service, tx };
};

/**
 * expect.objectContaining is typed `any`, which the repo's lint refuses. This
 * hands back the same matcher as an opaque value, so the assertions stay
 * readable without loosening the rule for the whole file.
 */
const containing = (value: Record<string, unknown>): unknown =>
  expect.objectContaining(value) as unknown;

const errorsOf = async (run: () => Promise<unknown>): Promise<Array<Record<string, string>>> => {
  try {
    await run();
  } catch (error) {
    const response = (
      error as { getResponse: () => { errors: Array<Record<string, string>> } }
    ).getResponse();
    return response.errors;
  }
  throw new Error('expected the request to be refused');
};

describe('rule 1 — a published version is never UPDATEd', () => {
  const published = templateRow({
    ptlPublishedRevId: 'v1',
    versions: [versionRow({ ptvId: 'v1', ptvStatus: 'PUBLISHED', ptvApprovedBy: USER })],
  });

  it('refuses an edit to the design and points at the way through', async () => {
    const { service, tx } = buildService(published);
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        versions: [{ ptvId: 'v1', ptvBody: '{"bands":[1]}' }],
      } as SavePrintTemplateDto),
    );

    expect(errors[0].field).toBe('versions[0].ptvBody');
    expect(errors[0].message).toContain('next revision');
    expect(tx.printTemplateVersion.update).not.toHaveBeenCalled();
  });

  it('refuses to touch the datasets of a live revision', async () => {
    const { service } = buildService(published);
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        versions: [{ ptvId: 'v1', datasets: [] }],
      } as SavePrintTemplateDto),
    );

    expect(errors[0].field).toBe('versions[0].datasets');
    expect(errors[0].message).toContain('frozen');
  });

  it('still allows the one move left — retiring it, which releases the pointer', async () => {
    const { service, tx } = buildService(published);
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvId: 'v1', ptvStatus: 'RETIRED' }],
    } as SavePrintTemplateDto);

    expect(tx.printTemplateVersion.update).toHaveBeenCalledWith(
      containing({ data: containing({ ptvStatus: 'RETIRED' }) }),
    );
    expect(tx.printTemplate.update).toHaveBeenCalledWith(
      containing({ data: containing({ ptlPublishedRevId: null }) }),
    );
  });

  it('refuses to delete a published revision out from under print_log', async () => {
    const { service } = buildService(published);
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        versions: [{ ptvId: 'v1', ptvIsDeleted: true }],
      } as SavePrintTemplateDto),
    );

    expect(errors[0].field).toBe('versions[0].ptvIsDeleted');
    expect(errors[0].message).toContain('Retire it first');
  });
});

describe('rule 2 — the version history is append-only', () => {
  const withHistory = templateRow({
    versions: [
      versionRow({ ptvId: 'v2', ptvRevNo: 2, ptvIsDeleted: true }),
      versionRow({ ptvId: 'v1', ptvRevNo: 1, ptvStatus: 'RETIRED' }),
    ],
  });

  it('leaves a revision that is missing from the array alone', async () => {
    const { service, tx } = buildService(withHistory);
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvBody: '{"bands":[]}' }],
    } as SavePrintTemplateDto);

    expect(tx.printTemplateVersion.update).not.toHaveBeenCalled();
    expect(tx.printTemplateVersion.updateMany).not.toHaveBeenCalled();
  });

  it('numbers a new revision past the highest that ever existed, deleted ones included', async () => {
    const { service, tx } = buildService(withHistory);
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvBody: '{"bands":[]}' }],
    } as SavePrintTemplateDto);

    expect(tx.printTemplateVersion.create).toHaveBeenCalledWith(
      containing({ data: containing({ ptvRevNo: 3 }) }),
    );
  });

  it('refuses to reuse a revision number', async () => {
    const { service } = buildService(withHistory);
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        versions: [{ ptvRevNo: 2, ptvBody: '{"bands":[]}' }],
      } as SavePrintTemplateDto),
    );

    expect(errors[0].field).toBe('versions[0].ptvRevNo');
    expect(errors[0].message).toContain('never reused');
  });

  it('deletes a DRAFT revision when asked explicitly, taking its datasets with it', async () => {
    const { service, tx } = buildService(
      templateRow({ versions: [versionRow({ ptvId: 'v1', ptvStatus: 'DRAFT' })] }),
    );
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvId: 'v1', ptvIsDeleted: true }],
    } as SavePrintTemplateDto);

    expect(tx.printTemplateDataset.updateMany).toHaveBeenCalledWith(
      containing({ data: containing({ ptdIsDeleted: true }) }),
    );
    expect(tx.printTemplateVersion.update).toHaveBeenCalledWith(
      containing({ data: containing({ ptvIsDeleted: true }) }),
    );
  });
});

describe('rule 3 — publishing is a pointer move', () => {
  it('stamps the approval and moves the template pointer to the new revision', async () => {
    const { service, tx } = buildService(templateRow());
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvBody: '{"bands":[]}', ptvStatus: 'PUBLISHED' }],
    } as SavePrintTemplateDto);

    const created = tx.printTemplateVersion.create.mock.calls[0][0].data;
    expect(created.ptvStatus).toBe('PUBLISHED');
    // Nobody sent ptvApprovedBy, so whoever pressed publish signs it.
    expect(created.ptvApprovedBy).toBe(USER);
    expect(created.ptvApprovedOn).toBeInstanceOf(Date);

    expect(tx.printTemplate.update).toHaveBeenCalledWith(
      containing({
        data: containing({ ptlPublishedRevId: 'new-version' }),
      }),
    );
  });

  it('refuses two revisions published in one request — there is one pointer', async () => {
    const { service } = buildService(templateRow());
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        versions: [
          { ptvBody: '{"bands":[]}', ptvStatus: 'PUBLISHED' },
          { ptvBody: '{"bands":[2]}', ptvStatus: 'PUBLISHED' },
        ],
      } as SavePrintTemplateDto),
    );

    expect(errors[0].field).toBe('versions[1].ptvStatus');
    expect(errors[0].message).toContain('Only one revision');
  });

  it('refuses a pointer aimed at a revision that is not PUBLISHED', async () => {
    const { service } = buildService(
      templateRow({ versions: [versionRow({ ptvId: 'v1', ptvStatus: 'DRAFT' })] }),
    );
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        ptlPublishedRevId: 'v1',
      } as SavePrintTemplateDto),
    );

    expect(errors[0].field).toBe('ptlPublishedRevId');
    expect(errors[0].message).toContain('is DRAFT');
  });

  it('refuses a pointer aimed at another template’s revision', async () => {
    const { service } = buildService(templateRow());
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        ptlPublishedRevId: 'someone-elses-version',
      } as SavePrintTemplateDto),
    );

    expect(errors[0].message).toContain('THIS template');
  });
});

describe('the datasets array replaces the set, and clears the index before it writes', () => {
  const draft = templateRow({
    versions: [
      versionRow({
        ptvId: 'v1',
        ptvStatus: 'DRAFT',
        datasets: [datasetRow({ ptdId: 'd1', ptdDatasetNo: 1, ptdName: 'items' })],
      }),
    ],
  });

  it('takes every live row down BEFORE writing, so a reused number cannot collide', async () => {
    const { service, tx } = buildService(draft);
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [
        {
          ptvId: 'v1',
          // No ptdId: a brand new row that reuses the number and name of the
          // row this same request drops. Written first, it would trip
          // ux_ptd_dataset_no.
          datasets: [
            {
              ptdDatasetNo: 1,
              ptdName: 'items',
              ptdSourceKind: 'PROVIDER',
              ptdProviderCode: 'sales.bill.lines',
            },
          ],
        },
      ],
    } as SavePrintTemplateDto);

    const clearedAt = tx.printTemplateDataset.updateMany.mock.invocationCallOrder[0];
    const createdAt = tx.printTemplateDataset.create.mock.invocationCallOrder[0];
    expect(clearedAt).toBeLessThan(createdAt);
    expect(tx.printTemplateDataset.updateMany).toHaveBeenCalledWith(
      containing({ data: containing({ ptdIsDeleted: true }) }),
    );
  });

  it('brings a kept row back up rather than leaving it deleted', async () => {
    const { service, tx } = buildService(draft);
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvId: 'v1', datasets: [{ ptdId: 'd1', ptdLabel: 'Line items' }] }],
    } as SavePrintTemplateDto);

    expect(tx.printTemplateDataset.update).toHaveBeenCalledWith(
      containing({
        where: { ptdId: 'd1' },
        data: containing({ ptdIsDeleted: false, ptdLabel: 'Line items' }),
      }),
    );
  });

  it('an empty array deletes every dataset', async () => {
    const { service, tx } = buildService(draft);
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvId: 'v1', datasets: [] }],
    } as SavePrintTemplateDto);

    expect(tx.printTemplateDataset.updateMany).toHaveBeenCalledWith(
      containing({ data: containing({ ptdIsDeleted: true }) }),
    );
    expect(tx.printTemplateDataset.create).not.toHaveBeenCalled();
    expect(tx.printTemplateDataset.update).not.toHaveBeenCalled();
  });

  it('omitting the key leaves the datasets alone', async () => {
    const { service, tx } = buildService(draft);
    await service.saveTemplate({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvId: 'v1', ptvNote: 'renamed' }],
    } as SavePrintTemplateDto);

    expect(tx.printTemplateDataset.updateMany).not.toHaveBeenCalled();
    expect(tx.printTemplateDataset.create).not.toHaveBeenCalled();
  });

  it('reports every problem in the payload at once, with a path into it', async () => {
    const { service } = buildService(templateRow());
    const errors = await errorsOf(() =>
      service.saveTemplate({
        ptlId: TEMPLATE_ID,
        versions: [
          {
            ptvBody: '{"bands":[]}',
            ptvLang: 'nope',
            datasets: [
              { ptdDatasetNo: 1, ptdName: 'Items', ptdProviderCode: 'sales.items' },
              { ptdDatasetNo: 1, ptdName: 'taxes', ptdProviderCode: 'sales.taxes' },
            ],
          },
        ],
      } as SavePrintTemplateDto),
    );

    expect(errors.map((error) => error.field)).toEqual([
      'versions[0].ptvLang',
      'versions[0].datasets[0].ptdName',
      'versions[0].datasets[1].ptdDatasetNo',
    ]);
  });
});

describe('delete', () => {
  it('refuses while an assignment still points at the template', async () => {
    const { service, tx } = buildService(templateRow());
    tx.printTemplateAssignment.findFirst = jest.fn(() => Promise.resolve({ ptaId: 'a1' }));

    await expect(service.softDeleteTemplate(TEMPLATE_ID)).rejects.toMatchObject({
      response: { message: 'Print template is still assigned' },
    });
  });

  it('takes the revisions and their datasets down with the template', async () => {
    const { service, tx } = buildService(
      templateRow({ versions: [versionRow({ ptvId: 'v1', datasets: [datasetRow()] })] }),
    );
    await service.softDeleteTemplate(TEMPLATE_ID, USER);

    expect(tx.printTemplate.update).toHaveBeenCalledWith(
      containing({ data: containing({ ptlIsDeleted: true }) }),
    );
    expect(tx.printTemplateDataset.updateMany).toHaveBeenCalledWith(
      containing({
        where: containing({ ptdVersionId: { in: ['v1'] } }),
        data: containing({ ptdIsDeleted: true }),
      }),
    );
    expect(tx.printTemplateVersion.updateMany).toHaveBeenCalledWith(
      containing({ data: containing({ ptvIsDeleted: true }) }),
    );
  });
});
