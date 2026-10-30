import { Prisma } from '@prisma/client';
import { PrintTemplateService } from './print-template.service';
import { SavePrintTemplateDto } from './dto/save-print-template.dto';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';

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
    // [] against a stored dataset = "delete every one" — a real change (the server compares: user 2026-10-29)
    const { service } = buildService(templateRow({
      ptlPublishedRevId: 'v1',
      versions: [versionRow({ ptvId: 'v1', ptvStatus: 'PUBLISHED', ptvApprovedBy: USER, datasets: [datasetRow()] })],
    }));
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

/**
 * A body as the controller receives it: through the house ValidationPipe. Every
 * declared DTO field is then an OWN property (ES2022 class fields), the ones the
 * client left out holding `undefined`, so a hasOwnProperty "was it sent" test
 * is always true. Live 2026-10-29: a status-only publish wiped ptv_params and
 * ptv_note on PARTY_OUTSTANDING_BILLWISE_A4 rev 1.
 */
const viaPipe = (body: object): Promise<SavePrintTemplateDto> =>
  createHouseValidationPipe().transform(body, {
    type: 'body',
    metatype: SavePrintTemplateDto,
  }) as Promise<SavePrintTemplateDto>;

describe('fields a client leaves out are kept (through the house pipe)', () => {
  const VERSION_ID = '01963d86-caf0-7b26-89f0-58ac380a2d61';
  const DATASET_ID = '01963d86-caf0-7b26-89f0-58ac380a2d62';
  const COMPANY_ID = '01963d86-caf0-7b26-89f0-58ac380a2d63';
  const FORK_ID = '01963d86-caf0-7b26-89f0-58ac380a2d64';
  const PARAMS = [{ name: 'as_on', type: 'DATE', label: 'As on', required: true }];
  const SQL =
    'SELECT comp_id AS company_id, comp_name AS company_name FROM public.companys ' +
    'WHERE comp_id = :company_id::uuid';

  const draft = () =>
    templateRow({
      ptlCompanyId: COMPANY_ID,
      ptlDescription: 'kept description',
      ptlForkedFromId: FORK_ID,
      ptlForkedFromRev: 3,
      versions: [
        versionRow({
          ptvId: VERSION_ID,
          ptvParams: PARAMS,
          ptvNote: 'kept note',
          ptvFontFamily: 'Kept Font',
          datasets: [
            datasetRow({
              ptdId: DATASET_ID,
              ptdVersionId: VERSION_ID,
              ptdRole: 'MASTER',
              ptdDatasetNo: 0,
              ptdName: 'head',
              ptdLabel: 'kept label',
              ptdSourceKind: 'SQL',
              ptdProviderCode: null,
              ptdSql: SQL,
              ptdRemarks: 'kept remarks',
            }),
          ],
        }),
      ],
    });

  const published = () =>
    templateRow({
      ptlPublishedRevId: VERSION_ID,
      ptlDescription: 'kept description',
      versions: [
        versionRow({
          ptvId: VERSION_ID,
          ptvStatus: 'PUBLISHED',
          ptvApprovedBy: USER,
          ptvParams: PARAMS,
          ptvNote: 'kept note',
        }),
      ],
    });

  const firstDataOf = (mock: jest.Mock): Record<string, unknown> =>
    (mock.mock.calls[0][0] as Args).data;

  it('a status-only publish writes the status and leaves params, note and header alone', async () => {
    const { service, tx } = buildService(draft());
    const dto = await viaPipe({
      ptlId: TEMPLATE_ID,
      ptlIsActive: true,
      versions: [{ ptvId: VERSION_ID, ptvStatus: 'PUBLISHED', ptvApprovedBy: USER }],
    });
    await service.saveTemplate(dto);

    const version = firstDataOf(tx.printTemplateVersion.update);
    expect(version.ptvStatus).toBe('PUBLISHED');
    for (const key of [
      'ptvParams',
      'ptvNote',
      'ptvFontFamily',
      'ptvBody',
      'ptvEngine',
      'ptvPaperCode',
      'ptvColumns',
      'ptvWidthMm',
    ]) {
      expect(version).not.toHaveProperty(key);
    }

    const header = firstDataOf(tx.printTemplate.update);
    for (const key of [
      'ptlCompanyId',
      'ptlDescription',
      'ptlForkedFromId',
      'ptlForkedFromRev',
      'ptlCode',
      'ptlName',
      'ptlPublishedRevId',
    ]) {
      expect(header).not.toHaveProperty(key);
    }
    expect(tx.printTemplate.update).toHaveBeenLastCalledWith(
      containing({ data: containing({ ptlPublishedRevId: VERSION_ID }) }),
    );
    expect(tx.printTemplateDataset.update).not.toHaveBeenCalled();
  });

  it('a status-only retire of a live revision is not counted as a design edit', async () => {
    const { service, tx } = buildService(published());
    const dto = await viaPipe({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvId: VERSION_ID, ptvStatus: 'RETIRED' }],
    });
    await service.saveTemplate(dto);

    const version = firstDataOf(tx.printTemplateVersion.update);
    expect(version.ptvStatus).toBe('RETIRED');
    expect(version).not.toHaveProperty('ptvParams');
    expect(version).not.toHaveProperty('ptvNote');
  });

  it('a header-only rename keeps the published pointer', async () => {
    const { service, tx } = buildService(published());
    const dto = await viaPipe({ ptlId: TEMPLATE_ID, ptlName: 'Renamed' });
    await service.saveTemplate(dto);

    expect(tx.printTemplate.update).toHaveBeenCalledTimes(1);
    const header = firstDataOf(tx.printTemplate.update);
    expect(header.ptlName).toBe('Renamed');
    expect(header).not.toHaveProperty('ptlPublishedRevId');
    expect(header).not.toHaveProperty('ptlDescription');
  });

  it('a dataset row that only renames keeps its SQL, label and remarks', async () => {
    const { service, tx } = buildService(draft());
    const dto = await viaPipe({
      ptlId: TEMPLATE_ID,
      versions: [{ ptvId: VERSION_ID, datasets: [{ ptdId: DATASET_ID, ptdName: 'head2' }] }],
    });
    await service.saveTemplate(dto);

    const dataset = firstDataOf(tx.printTemplateDataset.update);
    expect(dataset.ptdName).toBe('head2');
    for (const key of ['ptdSql', 'ptdLabel', 'ptdRemarks', 'ptdProviderCode', 'ptdLinkFields']) {
      expect(dataset).not.toHaveProperty(key);
    }
  });

  it('an explicit null still clears', async () => {
    const { service, tx } = buildService(draft());
    const dto = await viaPipe({
      ptlId: TEMPLATE_ID,
      ptlDescription: null,
      versions: [
        {
          ptvId: VERSION_ID,
          ptvNote: null,
          ptvParams: null,
          datasets: [{ ptdId: DATASET_ID, ptdRemarks: null }],
        },
      ],
    });
    await service.saveTemplate(dto);

    expect(firstDataOf(tx.printTemplate.update)).toHaveProperty('ptlDescription', null);
    const version = firstDataOf(tx.printTemplateVersion.update);
    expect(version).toHaveProperty('ptvNote', null);
    expect(version).toHaveProperty('ptvParams');
    expect(version.ptvParams).not.toEqual(PARAMS);
    const dataset = firstDataOf(tx.printTemplateDataset.update);
    expect(dataset).toHaveProperty('ptdRemarks', null);
    expect(dataset).not.toHaveProperty('ptdLabel');
  });

  it('an explicit null ptlPublishedRevId still unpublishes', async () => {
    const { service, tx } = buildService(published());
    const dto = await viaPipe({ ptlId: TEMPLATE_ID, ptlPublishedRevId: null });
    await service.saveTemplate(dto);

    expect(tx.printTemplate.update).toHaveBeenLastCalledWith(
      containing({ data: containing({ ptlPublishedRevId: null }) }),
    );
  });
});

describe('frozen revision — the server compares what is sent (user 2026-10-29)', () => {
  const stored = versionRow({
    ptvId: 'v1', ptvStatus: 'PUBLISHED', ptvApprovedBy: USER,
    ptvBody: '{"bands": [{"kind": "header", "items": []}], "b": 1}',
    ptvMarginTopMm: new Prisma.Decimal('10.00'), ptvMarginLeftMm: 8,
    ptvParams: [{ name: 'copies', type: 'int', default: 1 }],
    datasets: [datasetRow()],
  });
  const published = templateRow({ ptlPublishedRevId: 'v1', versions: [stored] });
  // the web Designer's Retire: the whole design back, body re-serialised (other key order), numbers as numbers, '' for null
  const wholeDesign = {
    ptvId: 'v1', ptvStatus: 'RETIRED', ptvEngine: 'JSON_BANDS', ptvBody: '{\n  "b": 1,\n  "bands": [{"items": [], "kind": "header"}]\n}',
    ptvPaperCode: 'A4', ptvOrientation: 'PORTRAIT', ptvWidthMm: null, ptvHeightMm: null, ptvMarginTopMm: 10, ptvMarginBottomMm: 0,
    ptvMarginLeftMm: 8, ptvMarginRightMm: 0, ptvColumns: null, ptvLang: 'en-IN', ptvFontFamily: '', ptvParams: [{ default: 1, type: 'int', name: 'copies' }],
    ptvNote: null,
    datasets: [{ ptdId: 'd1', ptdRole: 'DETAIL', ptdDatasetNo: 1, ptdName: 'items', ptdSourceKind: 'PROVIDER', ptdProviderCode: 'sales.bill.items', ptdRowLimit: 5000 }],
  };

  it('retire with the whole unchanged design: the status moves, the design is not rewritten', async () => {
    const { service, tx } = buildService(published);
    await service.saveTemplate({ ptlId: TEMPLATE_ID, versions: [wholeDesign] } as unknown as SavePrintTemplateDto);
    const call = (tx.printTemplateVersion.update.mock.calls as unknown as [{ data: Record<string, unknown> }][])[0][0];
    expect(call.data.ptvStatus).toBe('RETIRED');
    expect(Object.keys(call.data).filter((k) => ['ptvBody', 'ptvEngine', 'ptvMarginTopMm', 'ptvParams', 'ptvNote', 'ptvFontFamily'].includes(k))).toEqual([]);
    expect(tx.printTemplateDataset.update).not.toHaveBeenCalled();
    expect(tx.printTemplateDataset.updateMany).not.toHaveBeenCalled();
    expect(tx.printTemplate.update).toHaveBeenCalledWith(containing({ data: containing({ ptlPublishedRevId: null }) }));
  });

  it('one field really different is still refused — and only that field is named', async () => {
    const { service, tx } = buildService(published);
    const errors = await errorsOf(() =>
      service.saveTemplate({ ptlId: TEMPLATE_ID, versions: [{ ...wholeDesign, ptvMarginTopMm: 12 }] } as unknown as SavePrintTemplateDto));
    expect(errors[0].code).toBe('PRINT_TEMPLATE_VERSION_FROZEN');
    expect(errors[0].field).toBe('versions[0].ptvMarginTopMm');
    expect(errors[0].message).toContain('(Refused: ptvMarginTopMm.)');
    expect(tx.printTemplateVersion.update).not.toHaveBeenCalled();
  });

  it('a changed dataset field is refused', async () => {
    const { service } = buildService(published);
    const ds = [{ ...wholeDesign.datasets[0], ptdRowLimit: 100 }];
    const errors = await errorsOf(() =>
      service.saveTemplate({ ptlId: TEMPLATE_ID, versions: [{ ...wholeDesign, datasets: ds }] } as unknown as SavePrintTemplateDto));
    expect(errors[0].field).toBe('versions[0].datasets');
    expect(errors[0].message).toContain('datasets[0].ptdRowLimit');
  });
});
