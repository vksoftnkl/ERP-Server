import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SavePrintTemplateAssignmentDto } from './dto/save-print-template-assignment.dto';
import { PrintTemplateAssignmentService } from './print-template-assignment.service';
import { PrintTemplateAssignmentErrorCode } from './types/print-template-assignment-error-codes';

/**
 * print-template-assignment.save.spec.ts pins the scope rules and the ladder.
 * This file covers the rest: get, delete, the update's not-found and merged
 * checks, how the database's refusals are worded, the list filters, and the
 * corners of the resolver.
 */

const ACME = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const NIL = '00000000-0000-0000-0000-000000000000';
const PURPOSE = '01a041fa-d3c1-76b2-85e8-86494f756d06';
const TEMPLATE = '01a04322-b45f-7d14-952f-bc3e3645b903';
const BRANCH = '01a04322-b45f-7d14-952f-bc3e3645b904';
const DEVICE = '01a04322-b45f-7d14-952f-bc3e3645b906';
const PTA_ID = '01a04322-b45f-7d14-952f-bc3e3645b907';
const USER = '01963d86-caf0-7b26-89f0-58ac380a2d60';
const CREATED_ON = new Date('2026-08-27T00:00:00.000Z');

type Args = { where?: Record<string, unknown>; data?: Record<string, unknown> };

const assignmentRow = (overrides: Record<string, unknown> = {}) => ({
  ptaId: PTA_ID,
  ptaCompanyId: ACME as string | null,
  ptaBranchId: null as string | null,
  ptaDeviceId: null as string | null,
  ptaPurposeId: PURPOSE,
  ptaTemplateId: TEMPLATE,
  ptaTemplateCompanyKey: ACME,
  ptaOutputMode: 'PRINT',
  ptaPrinterId: null as string | null,
  ptaPrinterName: null as string | null,
  ptaCopies: null as number | null,
  ptaSpecificity: 1 as number | null,
  ptaRemarks: null,
  ptaIsActive: true,
  ptaIsDeleted: false,
  ptaSyncDate: null,
  ptaCreatedOn: CREATED_ON,
  ptaCreatedBy: null,
  ptaModifiedOn: null as Date | null,
  ptaModifiedBy: null as string | null,
  company: { compName: 'Acme Foods Pvt Ltd' },
  branch: null as { brName: string } | null,
  device: null,
  purpose: {
    ppoCode: 'SALE_INVOICE',
    ppoName: 'Tax Invoice',
    ppoCopyCount: 2,
    ppoCopyLabels: 'ORIGINAL, DUPLICATE',
  } as Record<string, unknown> | null,
  template: { ptlCode: 'saleinvoice', ptlName: 'Sale Invoice', ptlPublishedRevId: 'v1' },
  printer: null,
  ...overrides,
});

const buildService = (options: { existing?: unknown; userId?: string | null } = {}) => {
  const userId = options.userId === undefined ? USER : options.userId;

  const tx = {
    printTemplate: {
      findFirst: jest.fn(() =>
        Promise.resolve({ ptlCode: 'saleinvoice', ptlCompanyId: ACME, ptlCompanyKey: ACME } as
          | Record<string, unknown>
          | null),
      ),
    },
    printTemplateAssignment: {
      findFirst: jest.fn(() => Promise.resolve(options.existing ?? null)),
      findMany: jest.fn(() => Promise.resolve([assignmentRow()])),
      count: jest.fn(() => Promise.resolve(1)),
      create: jest.fn(({ data }: Args) => Promise.resolve({ ...assignmentRow(), ...data })),
      update: jest.fn(({ data }: Args) => Promise.resolve({ ...assignmentRow(), ...data })),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
  };

  const prisma = {
    ...tx,
    // The writes hand $transaction a callback; the list hands it an array.
    $transaction: (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
  };
  const audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };

  const service = new PrintTemplateAssignmentService(
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

const dto = (overrides: Record<string, unknown> = {}) =>
  ({
    ptaCompanyId: ACME,
    ptaPurposeId: PURPOSE,
    ptaTemplateId: TEMPLATE,
    ...overrides,
  }) as SavePrintTemplateAssignmentDto;

const createdData = (tx: ReturnType<typeof buildService>['tx']) =>
  (tx.printTemplateAssignment.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0]
    .data;

describe('PrintTemplateAssignmentService.getById', () => {
  it('refuses an id with no live assignment', async () => {
    const { service } = buildService();

    await expect(refusalOf(service.getById(PTA_ID))).resolves.toMatchObject({
      status: 404,
      body: { errors: [{ field: 'ptaId', code: PrintTemplateAssignmentErrorCode.NOT_FOUND }] },
    });
  });

  it('answers the row with its related names and its rung', async () => {
    const { service, tx } = buildService({
      existing: assignmentRow({
        ptaBranchId: BRANCH,
        ptaSpecificity: 2,
        branch: { brName: 'Main Branch' },
        ptaModifiedOn: new Date('2026-09-01T00:00:00.000Z'),
      }),
    });

    await expect(service.getById(PTA_ID)).resolves.toMatchObject({
      ptaId: PTA_ID,
      ptaCompanyName: 'Acme Foods Pvt Ltd',
      ptaBranchName: 'Main Branch',
      ptaPurposeCode: 'SALE_INVOICE',
      ptaTemplateCode: 'saleinvoice',
      ptaTemplateIsShipped: false,
      ptaScope: 'BRANCH',
      ptaCreatedOn: CREATED_ON.toISOString(),
      ptaModifiedOn: '2026-09-01T00:00:00.000Z',
    });
    expect(tx.printTemplateAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ptaId: PTA_ID, ptaIsDeleted: false } }),
    );
  });
});

describe('PrintTemplateAssignmentService.createAssignment', () => {
  it('writes the defaults: PRINT, no copy override, live, signed by the caller', async () => {
    const { service, tx, audit } = buildService();

    await service.createAssignment(dto(), USER);

    expect(createdData(tx)).toMatchObject({
      ptaCompanyId: ACME,
      ptaBranchId: null,
      ptaDeviceId: null,
      ptaOutputMode: 'PRINT',
      ptaPrinterId: null,
      ptaPrinterName: null,
      ptaCopies: null,
      ptaRemarks: null,
      ptaIsActive: true,
      ptaIsDeleted: false,
      ptaCreatedBy: USER,
      ptaModifiedBy: USER,
    });
    expect(audit.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'New',
        tableName: 'print template assignments',
        displayName: 'COMPANY: SALE_INVOICE -> saleinvoice (PRINT)',
        originalRecord: null,
        userId: USER,
      }),
      tx,
    );
  });

  it('takes the creator the body names over the caller', async () => {
    const other = '01963d86-caf0-7b26-89f0-58ac380a2d61';
    const { service, tx } = buildService();

    await service.createAssignment(dto({ ptaCreatedBy: other }), USER);

    expect(createdData(tx)).toMatchObject({ ptaCreatedBy: other, ptaModifiedBy: other });
  });

  it('stores NULL rather than the nil uuid when nobody is signed in', async () => {
    // pta_created_by is a real FK to user_master; the nil uuid would fail it.
    const { service, tx } = buildService({ userId: null });

    await service.save(dto());

    expect(createdData(tx)).toMatchObject({ ptaCreatedBy: null, ptaModifiedBy: null });
  });

  it('refuses a template that does not exist, before writing', async () => {
    const { service, tx } = buildService();
    tx.printTemplate.findFirst.mockResolvedValue(null);

    await expect(refusalOf(service.createAssignment(dto(), USER))).resolves.toMatchObject({
      status: 400,
      body: {
        errors: [
          { field: 'ptaTemplateId', code: PrintTemplateAssignmentErrorCode.TEMPLATE_NOT_FOUND },
        ],
      },
    });
    expect(tx.printTemplate.findFirst).toHaveBeenCalledWith({
      where: { ptlId: TEMPLATE, ptlIsDeleted: false },
      select: { ptlCode: true, ptlCompanyId: true, ptlCompanyKey: true },
    });
    expect(tx.printTemplateAssignment.create).not.toHaveBeenCalled();
  });

  it('answers a second assignment for the same scope with a 409', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(refusalOf(service.createAssignment(dto(), USER))).resolves.toMatchObject({
      status: 409,
      body: {
        errors: [{ field: 'ptaPurposeId', code: PrintTemplateAssignmentErrorCode.ALREADY_EXISTS }],
      },
    });
  });

  it('answers a missing related row (P2003) with a 400', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.create.mockRejectedValue(
      Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }),
    );

    await expect(refusalOf(service.createAssignment(dto(), USER))).resolves.toMatchObject({
      status: 400,
      body: {
        errors: [{ field: 'request', code: PrintTemplateAssignmentErrorCode.REFERENCE_INVALID }],
      },
    });
  });

  it('names the CHECK the database refused the row on', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.create.mockRejectedValue(
      new Error('23514: new row violates check constraint "ck_pta_output_mode"'),
    );

    await expect(refusalOf(service.createAssignment(dto(), USER))).resolves.toMatchObject({
      status: 400,
      body: {
        errors: [
          {
            code: PrintTemplateAssignmentErrorCode.DB_REFUSED,
            message: 'The database refused this row: ck_pta_output_mode',
          },
        ],
      },
    });
  });

  it('still answers 400 for a CHECK it cannot name', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.create.mockRejectedValue(new Error('23514 check violation'));

    await expect(refusalOf(service.createAssignment(dto(), USER))).resolves.toMatchObject({
      body: { errors: [{ message: 'The database refused this row: ck_pta_unknown' }] },
    });
  });

  it('rethrows any other failure untouched', async () => {
    const { service, tx } = buildService();
    const failure = new Error('connection reset');
    tx.printTemplateAssignment.create.mockRejectedValue(failure);

    await expect(service.createAssignment(dto(), USER)).rejects.toBe(failure);
  });
});

describe('PrintTemplateAssignmentService.save — update', () => {
  it('refuses an id with no live assignment', async () => {
    const { service, tx } = buildService();

    await expect(refusalOf(service.save(dto({ ptaId: PTA_ID })))).resolves.toMatchObject({
      status: 404,
      body: { errors: [{ code: PrintTemplateAssignmentErrorCode.NOT_FOUND }] },
    });
    expect(tx.printTemplateAssignment.update).not.toHaveBeenCalled();
  });

  it('checks the ladder on the row the update would leave behind', async () => {
    const { service, tx } = buildService({
      existing: assignmentRow({ ptaBranchId: BRANCH, ptaDeviceId: DEVICE, ptaSpecificity: 3 }),
    });

    const refusal = await refusalOf(
      service.save(
        dto({ ptaId: PTA_ID, ptaCompanyId: ACME, ptaBranchId: null, ptaDeviceId: DEVICE }),
      ),
    );

    expect(refusal).toMatchObject({
      status: 400,
      body: {
        errors: [
          { field: 'ptaBranchId', code: PrintTemplateAssignmentErrorCode.DEVICE_NEEDS_BRANCH },
        ],
      },
    });
    expect(tx.printTemplateAssignment.update).not.toHaveBeenCalled();
  });

  it('writes the change, signs it with the caller and audits the before and after', async () => {
    const { service, tx, audit } = buildService({ existing: assignmentRow() });

    const payload = await service.save(
      dto({ ptaId: PTA_ID, ptaOutputMode: 'PREVIEW', ptaCopies: 3 }),
    );

    expect(tx.printTemplateAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ptaId: PTA_ID },
        data: expect.objectContaining({
          ptaOutputMode: 'PREVIEW',
          ptaCopies: 3,
          ptaModifiedBy: USER,
          ptaModifiedOn: expect.any(Date) as unknown,
          ptaTemplateCompanyKey: ACME,
        }) as unknown,
      }),
    );
    expect(audit.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        pk: PTA_ID,
        originalRecord: expect.objectContaining({ ptaOutputMode: 'PRINT' }) as unknown,
        modifiedRecord: payload,
        userId: USER,
      }),
      tx,
    );
  });

  it('runs a database refusal on update through the same wording', async () => {
    const { service, tx } = buildService({ existing: assignmentRow() });
    tx.printTemplateAssignment.update.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(refusalOf(service.save(dto({ ptaId: PTA_ID })))).resolves.toMatchObject({
      status: 409,
      body: { errors: [{ code: PrintTemplateAssignmentErrorCode.ALREADY_EXISTS }] },
    });
  });
});

describe('PrintTemplateAssignmentService.list', () => {
  const whereOf = (tx: ReturnType<typeof buildService>['tx']) =>
    (
      tx.printTemplateAssignment.findMany.mock.calls[0] as unknown as [
        { where: Record<string, unknown> },
      ]
    )[0].where;

  it('globalOnly reads the every-company rows, whatever company is named', async () => {
    const { service, tx } = buildService();

    await service.list({ ptaCompanyId: ACME, globalOnly: true });

    expect(whereOf(tx)).toEqual({ ptaIsDeleted: false, ptaCompanyId: null });
  });

  it('a company alone reads that company’s rows only', async () => {
    const { service, tx } = buildService();

    await service.list({ ptaCompanyId: ACME });

    expect(whereOf(tx)).toEqual({ ptaIsDeleted: false, ptaCompanyId: ACME });
  });

  it('narrows by every other column it is given', async () => {
    const { service, tx } = buildService();

    await service.list({
      ptaBranchId: BRANCH,
      ptaDeviceId: DEVICE,
      ptaPurposeId: PURPOSE,
      ptaTemplateId: TEMPLATE,
      ptaOutputMode: 'PDF',
      ptaIsActive: false,
    });

    expect(whereOf(tx)).toEqual({
      ptaIsDeleted: false,
      ptaBranchId: BRANCH,
      ptaDeviceId: DEVICE,
      ptaPurposeId: PURPOSE,
      ptaTemplateId: TEMPLATE,
      ptaOutputMode: 'PDF',
      ptaIsActive: false,
    });
  });

  it('searches template, purpose, printer and remarks when no company clause is in the way', async () => {
    const { service, tx } = buildService();

    await service.list({ search: 'invoice' });

    expect(whereOf(tx).OR).toHaveLength(6);
    expect(whereOf(tx)).not.toHaveProperty('AND');
  });

  it('reads narrowest first and pages', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.count.mockResolvedValue(7);

    const result = await service.list({ page: 2, limit: 5 });

    expect(tx.printTemplateAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ ptaSpecificity: 'desc' }, { ptaCreatedOn: 'desc' }],
        skip: 5,
        take: 5,
      }),
    );
    expect(result).toMatchObject({ page: 2, limit: 5, total: 7 });
    expect(result.items[0]).toMatchObject({ ptaId: PTA_ID, ptaScope: 'COMPANY' });
  });
});

describe('PrintTemplateAssignmentService.resolve', () => {
  it('refuses when nothing resolves, naming the scope it searched', async () => {
    const { service } = buildService();

    await expect(
      refusalOf(service.resolve({ companyId: ACME, purposeId: PURPOSE })),
    ).resolves.toMatchObject({
      status: 404,
      body: {
        errors: [
          {
            field: 'purposeId',
            code: PrintTemplateAssignmentErrorCode.NONE_RESOLVES,
            message: expect.stringContaining(
              `company ${ACME}, purpose ${PURPOSE}, output mode PRINT`,
            ) as unknown,
          },
        ],
      },
    });
  });

  it('considers the counter and branch rows when the caller names them', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst.mockResolvedValue(assignmentRow());

    await service.resolve({
      companyId: ACME,
      purposeId: PURPOSE,
      branchId: BRANCH,
      deviceId: DEVICE,
      outputMode: 'PDF',
    });

    expect(tx.printTemplateAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ptaPurposeId: PURPOSE,
          ptaOutputMode: 'PDF',
          ptaIsActive: true,
          ptaIsDeleted: false,
          AND: [
            { OR: [{ ptaCompanyId: null }, { ptaCompanyId: ACME }] },
            { OR: [{ ptaBranchId: null }, { ptaBranchId: BRANCH }] },
            { OR: [{ ptaDeviceId: null }, { ptaDeviceId: DEVICE }] },
          ],
        },
      }),
    );
  });

  it('lets the assignment override the purpose copy count', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst.mockResolvedValue(assignmentRow({ ptaCopies: 3 }));

    await expect(service.resolve({ companyId: ACME, purposeId: PURPOSE })).resolves.toMatchObject(
      { copies: 3 },
    );
  });

  it('prints one unlabelled copy when neither the row nor the purpose says otherwise', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst.mockResolvedValue(assignmentRow({ purpose: null }));

    await expect(service.resolve({ companyId: ACME, purposeId: PURPOSE })).resolves.toMatchObject(
      { copies: 1, copyLabels: [] },
    );
  });

  it('reports a shipped design and the revision it publishes', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst.mockResolvedValue(
      assignmentRow({ ptaCompanyId: null, ptaTemplateCompanyKey: NIL, ptaSpecificity: 0 }),
    );

    await expect(service.resolve({ companyId: ACME, purposeId: PURPOSE })).resolves.toMatchObject(
      {
        ptaId: PTA_ID,
        scope: 'GLOBAL',
        ptaTemplateIsShipped: true,
        publishedRevId: 'v1',
        ptaTemplateCode: 'saleinvoice',
        ptaOutputMode: 'PRINT',
      },
    );
  });

  it('reads an unknown rung as the widest one', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst.mockResolvedValue(assignmentRow({ ptaSpecificity: null }));

    await expect(service.resolve({ companyId: ACME, purposeId: PURPOSE })).resolves.toMatchObject(
      { scope: 'GLOBAL' },
    );
  });
});

describe('PrintTemplateAssignmentService.softDelete', () => {
  it('refuses an id with no live assignment', async () => {
    const { service, tx } = buildService();

    await expect(refusalOf(service.softDelete(PTA_ID))).resolves.toMatchObject({
      status: 404,
      body: { errors: [{ code: PrintTemplateAssignmentErrorCode.NOT_FOUND }] },
    });
    expect(tx.printTemplateAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('refuses when the row was deleted between the read and the write', async () => {
    const { service, tx, audit } = buildService({ existing: assignmentRow() });
    tx.printTemplateAssignment.updateMany.mockResolvedValue({ count: 0 });

    await expect(refusalOf(service.softDelete(PTA_ID))).resolves.toMatchObject({ status: 404 });
    expect(audit.logEntityChange).not.toHaveBeenCalled();
  });

  it('takes the row down, signed by the caller, and audits a cancel', async () => {
    const { service, tx, audit } = buildService({ existing: assignmentRow() });

    await expect(service.softDelete(PTA_ID)).resolves.toEqual({ ptaId: PTA_ID, deleted: true });
    expect(tx.printTemplateAssignment.updateMany).toHaveBeenCalledWith({
      where: { ptaId: PTA_ID, ptaIsDeleted: false },
      data: {
        ptaIsDeleted: true,
        ptaIsActive: false,
        ptaModifiedOn: expect.any(Date) as unknown,
        ptaModifiedBy: USER,
      },
    });
    expect(audit.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cancel',
        pk: PTA_ID,
        modifiedRecord: expect.objectContaining({ ptaIsDeleted: true }) as unknown,
      }),
      tx,
    );
  });

  it('signs the delete NULL when nobody is signed in', async () => {
    const { service, tx } = buildService({ existing: assignmentRow(), userId: null });

    await service.softDelete(PTA_ID);

    expect(tx.printTemplateAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ptaModifiedBy: null }) as unknown,
      }),
    );
  });
});

// Keeps the Prisma import meaningful for readers: the service's own error
// handling recognises the plain `{ code }` shape these tests throw, which is
// what a PrismaClientKnownRequestError carries too.
void Prisma;
