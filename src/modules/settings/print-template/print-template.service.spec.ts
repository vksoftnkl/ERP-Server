import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SavePrintTemplateDto } from './dto/save-print-template.dto';
import { PrintTemplateService } from './print-template.service';
import { PrintTemplateErrorCode } from './types/print-template-error-codes';

/**
 * print-template.save.spec.ts pins the three schema rules (frozen published
 * revisions, append-only history, publishing as a pointer move). This file
 * covers the rest of the service: the reads, the header checks, the refusals
 * the save spec does not reach, and the delete.
 */

const TEMPLATE_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const COMPANY_ID = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const USER = '01963d86-caf0-7b26-89f0-58ac380a2d60';
const CREATED_ON = new Date('2026-01-01T00:00:00.000Z');

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
  ptdCreatedOn: CREATED_ON,
  ptdCreatedBy: null,
  ptdModifiedOn: null,
  ptdModifiedBy: null,
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
  ptvCreatedOn: CREATED_ON,
  ptvCreatedBy: null,
  ptvModifiedOn: null,
  ptvModifiedBy: null,
  datasets: [] as unknown[],
  ...overrides,
});

const templateRow = (overrides: Record<string, unknown> = {}) => ({
  ptlId: TEMPLATE_ID,
  ptlCompanyId: null as string | null,
  ptlPurposeId: 'purpose-1',
  ptlCode: 'SALE_INVOICE_A4',
  ptlName: 'Tax Invoice A4',
  ptlDescription: null,
  ptlPublishedRevId: null as string | null,
  ptlForkedFromId: null,
  ptlForkedFromRev: null,
  ptlSortOrder: 100,
  ptlCompanyKey: '00000000-0000-0000-0000-000000000000',
  ptlIsActive: true,
  ptlIsDeleted: false,
  ptlSyncDate: null,
  ptlCreatedOn: CREATED_ON,
  ptlCreatedBy: null,
  ptlModifiedOn: null,
  ptlModifiedBy: null,
  company: null,
  purpose: { ppoCode: 'SALE_INVOICE', ppoName: 'Sale Invoice' },
  forkedFrom: null,
  publishedRev: null,
  versions: [] as unknown[],
  ...overrides,
});

type Args = { data: Record<string, unknown>; where?: Record<string, unknown> };

const buildService = (
  options: {
    template?: ReturnType<typeof templateRow> | null;
    clash?: boolean;
    userId?: string | null;
  } = {},
) => {
  const template = options.template ?? null;
  const userId = options.userId === undefined ? USER : options.userId;

  const tx = {
    printTemplate: {
      // Two callers: the read that loads the template, and the code-clash
      // check, which is the one that passes `select`.
      findFirst: jest.fn((args: { select?: unknown }) =>
        Promise.resolve(args.select ? (options.clash ? { ptlId: 'other' } : null) : template),
      ),
      findMany: jest.fn(() => Promise.resolve([] as unknown[])),
      count: jest.fn(() => Promise.resolve(0)),
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
      findMany: jest.fn(() => Promise.resolve([] as unknown[])),
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
  const audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };

  const service = new PrintTemplateService(
    prisma as never,
    audit as never,
    { getUserId: () => userId } as never,
  );
  return { service, tx, audit };
};

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

/** Every errors[].code a refusal carries, in order. */
const codesOf = async (promise: Promise<unknown>): Promise<string[]> => {
  const { body } = await refusalOf(promise);
  return (body as { errors: Array<{ code: string }> }).errors.map((error) => error.code);
};

const save = (dto: Record<string, unknown>) => dto as unknown as SavePrintTemplateDto;

const NEW_TEMPLATE = {
  ptlPurposeId: 'purpose-1',
  ptlCode: 'SALE_INVOICE_A4',
  ptlName: 'Tax Invoice A4',
};

describe('PrintTemplateService.getTemplateById', () => {
  it('refuses an id with no live template', async () => {
    const { service } = buildService();

    await expect(refusalOf(service.getTemplateById(TEMPLATE_ID))).resolves.toMatchObject({
      status: 404,
      body: { errors: [{ field: 'ptlId', code: PrintTemplateErrorCode.NOT_FOUND }] },
    });
  });

  it('reads only the live revisions unless asked for the deleted ones too', async () => {
    const { service, tx } = buildService({ template: templateRow() });

    await service.getTemplateById(TEMPLATE_ID);
    await service.getTemplateById(TEMPLATE_ID, true);

    const [live, all] = tx.printTemplate.findFirst.mock.calls.map(
      ([args]) => args as { include: { versions: Record<string, unknown> } },
    );
    expect(live.include.versions.where).toEqual({ ptvIsDeleted: false });
    expect(all.include.versions).not.toHaveProperty('where');
  });

  it('answers the template as a payload', async () => {
    const { service } = buildService({ template: templateRow() });

    await expect(service.getTemplateById(TEMPLATE_ID)).resolves.toMatchObject({
      ptlId: TEMPLATE_ID,
      ptlPurposeCode: 'SALE_INVOICE',
      ptlCreatedOn: CREATED_ON.toISOString(),
    });
  });
});

describe('PrintTemplateService.listTemplates', () => {
  const whereOf = (tx: ReturnType<typeof buildService>['tx']) =>
    (tx.printTemplate.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0]
      .where;

  it('answers every live template for a bare list, first page of twenty', async () => {
    const { service, tx } = buildService();

    const result = await service.listTemplates({});

    expect(tx.printTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ptlIsDeleted: false },
        orderBy: [{ ptlSortOrder: 'asc' }, { ptlCode: 'asc' }, { ptlId: 'asc' }],
        skip: 0,
        take: 20,
      }),
    );
    expect(result).toEqual({ items: [], page: 1, limit: 20, total: 0, total_pages: 0 });
  });

  it("narrowing to a company keeps the shipped designs it can use", async () => {
    const { service, tx } = buildService();

    await service.listTemplates({ ptlCompanyId: COMPANY_ID });

    expect(whereOf(tx).OR).toEqual([{ ptlCompanyId: COMPANY_ID }, { ptlCompanyId: null }]);
  });

  it('onlyOwned reads the company column alone', async () => {
    const { service, tx } = buildService();

    await service.listTemplates({ ptlCompanyId: COMPANY_ID, onlyOwned: true });

    expect(whereOf(tx)).toMatchObject({ ptlCompanyId: COMPANY_ID });
    expect(whereOf(tx)).not.toHaveProperty('OR');
  });

  it('reads published-ness off the pointer and the engine off the live revision', async () => {
    const { service, tx } = buildService();

    await service.listTemplates({ isPublished: true, engine: 'ESCPOS_TEXT', ptlIsActive: false });
    await service.listTemplates({ isPublished: false });

    expect(whereOf(tx)).toMatchObject({
      ptlPublishedRevId: { not: null },
      publishedRev: { ptvEngine: 'ESCPOS_TEXT' },
      ptlIsActive: false,
    });
    const second = (
      tx.printTemplate.findMany.mock.calls[1] as unknown as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(second.ptlPublishedRevId).toBeNull();
  });

  it('searches code and name loosely, beside the company clause', async () => {
    const { service, tx } = buildService();

    await service.listTemplates({ ptlCompanyId: COMPANY_ID, search: '  invoice ' });

    expect(whereOf(tx)).toMatchObject({
      OR: [{ ptlCompanyId: COMPANY_ID }, { ptlCompanyId: null }],
      AND: [
        {
          OR: [
            { ptlCode: { contains: 'invoice', mode: 'insensitive' } },
            { ptlName: { contains: 'invoice', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('leaves the revisions out when includeVersions is false', async () => {
    const { service, tx } = buildService();

    await service.listTemplates({ includeVersions: false });

    const include = (
      tx.printTemplate.findMany.mock.calls[0] as unknown as [{ include: Record<string, unknown> }]
    )[0].include;
    expect(Object.keys(include).sort()).toEqual(
      ['company', 'forkedFrom', 'publishedRev', 'purpose'].sort(),
    );
  });

  it('pages and counts the pages', async () => {
    const { service, tx } = buildService();
    tx.printTemplate.findMany.mockResolvedValue([templateRow()]);
    tx.printTemplate.count.mockResolvedValue(25);

    const result = await service.listTemplates({ page: 3, limit: 10 });

    expect(tx.printTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
    expect(result).toMatchObject({ page: 3, limit: 10, total: 25, total_pages: 3 });
    expect(result.items[0].ptlId).toBe(TEMPLATE_ID);
  });
});

describe('PrintTemplateService.saveTemplate — the header', () => {
  it('refuses a create missing purpose, code and name, all three at once', async () => {
    const { service, tx } = buildService();

    const refusal = await refusalOf(service.saveTemplate(save({})));

    expect(refusal).toMatchObject({
      status: 400,
      body: {
        errors: [
          { field: 'ptlPurposeId', code: PrintTemplateErrorCode.FIELD_REQUIRED },
          { field: 'ptlCode', code: PrintTemplateErrorCode.FIELD_REQUIRED },
          { field: 'ptlName', code: PrintTemplateErrorCode.FIELD_REQUIRED },
          // An empty code also fails ck_ptl_code_shape; both are reported.
          { field: 'ptlCode', code: PrintTemplateErrorCode.CODE_INVALID },
        ],
      },
    });
    expect(tx.printTemplate.create).not.toHaveBeenCalled();
  });

  it('refuses an id with no live template', async () => {
    const { service } = buildService();

    await expect(
      refusalOf(service.saveTemplate(save({ ptlId: TEMPLATE_ID, ptlName: 'X' }))),
    ).resolves.toMatchObject({
      status: 404,
      body: { errors: [{ code: PrintTemplateErrorCode.NOT_FOUND }] },
    });
  });

  it('creates with the defaults and audits the insert', async () => {
    const { service, tx, audit } = buildService();

    await service.saveTemplate(save(NEW_TEMPLATE));

    expect(tx.printTemplate.create).toHaveBeenCalledWith({
      data: {
        ptlCompanyId: null,
        ptlPurposeId: 'purpose-1',
        ptlCode: 'SALE_INVOICE_A4',
        ptlName: 'Tax Invoice A4',
        ptlDescription: null,
        ptlForkedFromId: null,
        ptlForkedFromRev: null,
        ptlSortOrder: 100,
        ptlIsActive: true,
        ptlCreatedBy: USER,
      },
    });
    expect(audit.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'insert',
        tableName: 'print template',
        screenName: 'Print Template',
        pk: 'new-template',
        originalRecord: null,
        userId: USER,
      }),
      tx,
    );
  });

  it('stores NULL, not the nil uuid, as the creator when nobody is signed in', async () => {
    // ptl_created_by is a real FK to user_master; the nil uuid would fail it.
    const { service, tx, audit } = buildService({ userId: null });

    await service.saveTemplate(save(NEW_TEMPLATE));

    expect(tx.printTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ptlCreatedBy: null }) as unknown,
    });
    // The audit log is not an FK, so it keeps the house default actor.
    expect(audit.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '00000000-0000-0000-0000-000000000000' }),
      tx,
    );
  });

  it('checks the code among the shipped designs, case-insensitively', async () => {
    const { service, tx } = buildService({ clash: true });

    const refusal = await refusalOf(service.saveTemplate(save(NEW_TEMPLATE)));

    expect(tx.printTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        ptlCompanyId: null,
        ptlIsDeleted: false,
        ptlCode: { equals: 'SALE_INVOICE_A4', mode: 'insensitive' },
      },
      select: { ptlId: true },
    });
    expect(refusal).toMatchObject({
      status: 409,
      body: {
        errors: [
          {
            field: 'ptlCode',
            code: PrintTemplateErrorCode.CODE_TAKEN,
            message: 'ptlCode SALE_INVOICE_A4 already exists among the shipped templates',
          },
        ],
      },
    });
    expect(tx.printTemplate.create).not.toHaveBeenCalled();
  });

  it("checks a company's code against that company only, and says so", async () => {
    const { service, tx } = buildService({ clash: true });

    const refusal = await refusalOf(
      service.saveTemplate(save({ ...NEW_TEMPLATE, ptlCompanyId: COMPANY_ID })),
    );

    expect(tx.printTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ptlCompanyId: COMPANY_ID }) as unknown,
      }),
    );
    expect(refusal).toMatchObject({
      body: {
        errors: [{ message: 'ptlCode SALE_INVOICE_A4 already exists for this company' }],
      },
    });
  });

  it('does not count the template being saved as its own clash', async () => {
    const { service, tx } = buildService({ template: templateRow() });

    await service.saveTemplate(save({ ptlId: TEMPLATE_ID, ptlCode: 'SALE_INVOICE_A4' }));

    expect(tx.printTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ptlId: { not: TEMPLATE_ID } }) as unknown,
        select: { ptlId: true },
      }),
    );
  });

  it('translates a unique-index race on the code into a 409', async () => {
    const { service, tx } = buildService();
    tx.printTemplate.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.2',
        meta: { target: 'ux_ptl_code' },
      }),
    );

    await expect(codesOf(service.saveTemplate(save(NEW_TEMPLATE)))).resolves.toEqual([
      PrintTemplateErrorCode.CODE_TAKEN,
    ]);
  });
});

describe('PrintTemplateService.saveTemplate — a new revision', () => {
  it('starts at revision 1 as a DRAFT with the house defaults', async () => {
    const { service, tx } = buildService();

    await service.saveTemplate(save({ ...NEW_TEMPLATE, versions: [{ ptvBody: '{"bands":[]}' }] }));

    const { data } = tx.printTemplateVersion.create.mock.calls[0][0];
    expect(data).toMatchObject({
      ptvTemplateId: 'new-template',
      ptvRevNo: 1,
      ptvStatus: 'DRAFT',
      ptvEngine: 'JSON_BANDS',
      ptvSchemaVer: 1,
      ptvPaperCode: 'A4',
      ptvOrientation: 'PORTRAIT',
      ptvLang: 'en-IN',
      ptvMarginTopMm: 0,
      ptvApprovedBy: null,
      ptvApprovedOn: null,
      ptvCreatedBy: USER,
    });
    // jsonb null has to reach Prisma as DbNull.
    expect(data.ptvParams).toBe(Prisma.DbNull);
  });

  it('refuses a JSON_BANDS body that is not a JSON object', async () => {
    const { service, tx } = buildService();

    await expect(
      codesOf(service.saveTemplate(save({ ...NEW_TEMPLATE, versions: [{ ptvBody: '[1,2]' }] }))),
    ).resolves.toContain(PrintTemplateErrorCode.BODY_NOT_JSON_OBJECT);
    expect(tx.printTemplate.create).not.toHaveBeenCalled();
  });

  it('signs a revision published with no approver with the user who published it', async () => {
    const { service, tx } = buildService({ template: templateRow() });

    await service.saveTemplate(
      save({ ptlId: TEMPLATE_ID, versions: [{ ptvBody: '{}', ptvStatus: 'PUBLISHED' }] }),
    );

    expect(tx.printTemplateVersion.create.mock.calls[0][0].data).toMatchObject({
      ptvStatus: 'PUBLISHED',
      ptvApprovedBy: USER,
      ptvApprovedOn: expect.any(Date) as unknown,
    });
  });

  it('keeps an approver the request names', async () => {
    const approver = '01963d86-caf0-7b26-89f0-58ac380a2d61';
    const { service, tx } = buildService({ template: templateRow() });

    await service.saveTemplate(
      save({
        ptlId: TEMPLATE_ID,
        versions: [{ ptvBody: '{}', ptvStatus: 'PUBLISHED', ptvApprovedBy: approver }],
      }),
    );

    expect(tx.printTemplateVersion.create.mock.calls[0][0].data.ptvApprovedBy).toBe(approver);
  });

  it('refuses to publish when there is nobody to sign it', async () => {
    const { service, tx } = buildService({ template: templateRow(), userId: null });

    await expect(
      codesOf(
        service.saveTemplate(
          save({ ptlId: TEMPLATE_ID, versions: [{ ptvBody: '{}', ptvStatus: 'PUBLISHED' }] }),
        ),
      ),
    ).resolves.toEqual([PrintTemplateErrorCode.APPROVER_REQUIRED]);
    expect(tx.printTemplateVersion.create).not.toHaveBeenCalled();
  });
});

describe('PrintTemplateService.saveTemplate — revision refusals', () => {
  it('refuses a ptvId that belongs to no revision of this template', async () => {
    const { service } = buildService({ template: templateRow() });

    const refusal = await refusalOf(
      service.saveTemplate(save({ ptlId: TEMPLATE_ID, versions: [{ ptvId: 'elsewhere' }] })),
    );

    expect(refusal).toMatchObject({
      status: 400,
      body: {
        errors: [{ field: 'versions[0].ptvId', code: PrintTemplateErrorCode.VERSION_NOT_FOUND }],
      },
    });
  });

  it('refuses a delete that names no revision', async () => {
    const { service } = buildService({ template: templateRow() });

    await expect(
      codesOf(service.saveTemplate(save({ ptlId: TEMPLATE_ID, versions: [{ ptvIsDeleted: true }] }))),
    ).resolves.toEqual([PrintTemplateErrorCode.VERSION_DELETE_NEEDS_ID]);
  });

  it('treats deleting an already-deleted revision as nothing to do', async () => {
    const { service, tx } = buildService({
      template: templateRow({ versions: [versionRow({ ptvIsDeleted: true })] }),
    });

    await service.saveTemplate(
      save({ ptlId: TEMPLATE_ID, versions: [{ ptvId: 'v1', ptvIsDeleted: true }] }),
    );

    expect(tx.printTemplateVersion.update).not.toHaveBeenCalled();
    expect(tx.printTemplateDataset.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to delete the revision the pointer names, even a DRAFT', async () => {
    const { service } = buildService({
      template: templateRow({ ptlPublishedRevId: 'v1', versions: [versionRow()] }),
    });

    await expect(
      codesOf(
        service.saveTemplate(
          save({ ptlId: TEMPLATE_ID, versions: [{ ptvId: 'v1', ptvIsDeleted: true }] }),
        ),
      ),
    ).resolves.toEqual([PrintTemplateErrorCode.VERSION_DELETE_IS_LIVE]);
  });

  it.each([
    ['RETIRED', 'PUBLISHED'],
    ['RETIRED', 'DRAFT'],
    ['PUBLISHED', 'DRAFT'],
  ])('refuses to move a %s revision to %s', async (from, to) => {
    const { service, tx } = buildService({
      template: templateRow({ versions: [versionRow({ ptvStatus: from, ptvApprovedBy: USER })] }),
    });

    const refusal = await refusalOf(
      service.saveTemplate(save({ ptlId: TEMPLATE_ID, versions: [{ ptvId: 'v1', ptvStatus: to }] })),
    );

    expect(refusal).toMatchObject({
      status: 400,
      body: {
        errors: [
          { field: 'versions[0].ptvStatus', code: PrintTemplateErrorCode.STATUS_MOVE_INVALID },
        ],
      },
    });
    expect(tx.printTemplateVersion.update).not.toHaveBeenCalled();
  });

  it('writes nothing for a frozen revision sent back with its own status', async () => {
    const { service, tx } = buildService({
      template: templateRow({
        ptlPublishedRevId: 'v1',
        versions: [versionRow({ ptvStatus: 'PUBLISHED', ptvApprovedBy: USER })],
      }),
    });

    await service.saveTemplate(
      save({ ptlId: TEMPLATE_ID, versions: [{ ptvId: 'v1', ptvStatus: 'PUBLISHED' }] }),
    );

    expect(tx.printTemplateVersion.update).not.toHaveBeenCalled();
    expect(tx.printTemplateVersion.create).not.toHaveBeenCalled();
  });
});

describe('PrintTemplateService.saveTemplate — datasets', () => {
  const draft = templateRow({ versions: [versionRow({ datasets: [datasetRow()] })] });

  it('refuses a ptdId that belongs to no dataset of the revision', async () => {
    const { service } = buildService({ template: draft });

    const refusal = await refusalOf(
      service.saveTemplate(
        save({ ptlId: TEMPLATE_ID, versions: [{ ptvId: 'v1', datasets: [{ ptdId: 'd9' }] }] }),
      ),
    );

    expect(refusal).toMatchObject({
      body: {
        errors: [
          {
            field: 'versions[0].datasets[0].ptdId',
            code: PrintTemplateErrorCode.DATASET_NOT_FOUND,
          },
        ],
      },
    });
  });

  it('wants a name and a number for a new DETAIL dataset', async () => {
    const { service } = buildService({ template: draft });

    const refusal = await refusalOf(
      service.saveTemplate(
        save({
          ptlId: TEMPLATE_ID,
          versions: [{ ptvId: 'v1', datasets: [{ ptdProviderCode: 'sales.bill.items' }] }],
        }),
      ),
    );

    const errors = (refusal.body as { errors: Array<{ field: string; code: string }> }).errors;
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'versions[0].datasets[0].ptdName',
          code: PrintTemplateErrorCode.FIELD_REQUIRED,
        }),
        expect.objectContaining({
          field: 'versions[0].datasets[0].ptdDatasetNo',
          code: PrintTemplateErrorCode.FIELD_REQUIRED,
        }),
      ]),
    );
  });

  it('numbers a new MASTER dataset 0 and fills the house limits', async () => {
    const { service, tx } = buildService({ template: draft });

    await service.saveTemplate(
      save({
        ptlId: TEMPLATE_ID,
        versions: [
          {
            ptvId: 'v1',
            datasets: [
              { ptdName: 'header', ptdRole: 'MASTER', ptdProviderCode: 'sales.bill.header' },
            ],
          },
        ],
      }),
    );

    expect(tx.printTemplateDataset.create.mock.calls[0][0].data).toMatchObject({
      ptdVersionId: 'v1',
      ptdRole: 'MASTER',
      ptdDatasetNo: 0,
      ptdSortOrder: 0,
      ptdSourceKind: 'PROVIDER',
      ptdRowLimit: 5000,
      ptdTimeoutMs: 15000,
      ptdCreatedBy: USER,
    });
  });
});

describe('PrintTemplateService.saveTemplate — the published pointer', () => {
  const twoRevisions = () =>
    templateRow({
      ptlPublishedRevId: 'v1',
      versions: [
        versionRow({ ptvId: 'v2', ptvRevNo: 2, ptvStatus: 'PUBLISHED', ptvApprovedBy: USER }),
        versionRow({ ptvId: 'v1', ptvStatus: 'PUBLISHED', ptvApprovedBy: USER }),
      ],
    });

  it('refuses a pointer and a publish in the same request', async () => {
    const { service } = buildService({ template: templateRow() });

    await expect(
      codesOf(
        service.saveTemplate(
          save({
            ptlId: TEMPLATE_ID,
            ptlPublishedRevId: 'v1',
            versions: [{ ptvBody: '{}', ptvStatus: 'PUBLISHED' }],
          }),
        ),
      ),
    ).resolves.toEqual([PrintTemplateErrorCode.PUBLISH_BOTH_WAYS]);
  });

  it('refuses a pointer aimed at a deleted revision', async () => {
    const { service } = buildService({
      template: templateRow({
        versions: [versionRow({ ptvStatus: 'PUBLISHED', ptvIsDeleted: true })],
      }),
    });

    await expect(
      codesOf(service.saveTemplate(save({ ptlId: TEMPLATE_ID, ptlPublishedRevId: 'v1' }))),
    ).resolves.toEqual([PrintTemplateErrorCode.PUBLISH_DELETED]);
  });

  it('rolls back by moving the pointer to another published revision', async () => {
    const { service, tx } = buildService({ template: twoRevisions() });

    await service.saveTemplate(save({ ptlId: TEMPLATE_ID, ptlPublishedRevId: 'v2' }));

    expect(tx.printTemplate.update).toHaveBeenLastCalledWith({
      where: { ptlId: TEMPLATE_ID },
      data: {
        ptlPublishedRevId: 'v2',
        ptlModifiedOn: expect.any(Date) as unknown,
        ptlModifiedBy: USER,
      },
    });
  });

  it('withdraws the design when the pointer is sent as null', async () => {
    const { service, tx } = buildService({ template: twoRevisions() });

    await service.saveTemplate(save({ ptlId: TEMPLATE_ID, ptlPublishedRevId: null }));

    expect(tx.printTemplate.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ptlPublishedRevId: null }) as unknown,
      }),
    );
  });

  it('does not write the pointer again when it already names the revision', async () => {
    const { service, tx } = buildService({ template: twoRevisions() });

    await service.saveTemplate(save({ ptlId: TEMPLATE_ID, ptlPublishedRevId: 'v1' }));

    // The header update is the only template write.
    expect(tx.printTemplate.update).toHaveBeenCalledTimes(1);
  });
});

describe('PrintTemplateService.softDeleteTemplate', () => {
  it('refuses an id with no live template', async () => {
    const { service } = buildService();

    await expect(refusalOf(service.softDeleteTemplate(TEMPLATE_ID))).resolves.toMatchObject({
      status: 404,
      body: { errors: [{ code: PrintTemplateErrorCode.NOT_FOUND }] },
    });
  });

  it('refuses while an assignment points at it, with its own code', async () => {
    const { service, tx } = buildService({ template: templateRow() });
    tx.printTemplateAssignment.findFirst.mockResolvedValue({ ptaId: 'a1' });

    await expect(refusalOf(service.softDeleteTemplate(TEMPLATE_ID))).resolves.toMatchObject({
      status: 409,
      body: { errors: [{ field: 'ptlId', code: PrintTemplateErrorCode.STILL_ASSIGNED }] },
    });
    expect(tx.printTemplateAssignment.findFirst).toHaveBeenCalledWith({
      where: { ptaTemplateId: TEMPLATE_ID, ptaIsDeleted: false },
      select: { ptaId: true },
    });
    expect(tx.printTemplate.update).not.toHaveBeenCalled();
  });

  it('touches no revision table when the template has none', async () => {
    const { service, tx } = buildService({ template: templateRow() });

    await expect(service.softDeleteTemplate(TEMPLATE_ID)).resolves.toEqual({
      deleted: true,
      ptlId: TEMPLATE_ID,
    });
    expect(tx.printTemplateVersion.updateMany).not.toHaveBeenCalled();
    expect(tx.printTemplateDataset.updateMany).not.toHaveBeenCalled();
  });

  it('stamps the actor it is given and audits a cancel', async () => {
    const actor = '01963d86-caf0-7b26-89f0-58ac380a2d62';
    const { service, tx, audit } = buildService({ template: templateRow() });

    await service.softDeleteTemplate(TEMPLATE_ID, `  ${actor}  `);

    expect(tx.printTemplate.update).toHaveBeenCalledWith({
      where: { ptlId: TEMPLATE_ID },
      data: {
        ptlIsDeleted: true,
        ptlIsActive: false,
        ptlModifiedOn: expect.any(Date) as unknown,
        ptlModifiedBy: actor,
      },
    });
    expect(audit.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel', pk: TEMPLATE_ID, displayName: 'Tax Invoice A4' }),
      tx,
    );
  });
});
