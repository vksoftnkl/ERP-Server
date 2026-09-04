import { PrintTemplateAssignmentService } from './print-template-assignment.service';
import { SavePrintTemplateAssignmentDto } from './dto/save-print-template-assignment.dto';

/**
 * The rules §5 states that the compiler cannot see:
 *
 *   1. pta_template_company_key is DERIVED from the template, never taken from
 *      the caller — a caller free to state the owner is free to state the wrong
 *      one, and ck_pta_template_scope rests entirely on that column being true.
 *   2. An every-company assignment may only name a SHIPPED design, and moving
 *      an existing row to that rung re-asks the question of a template that has
 *      not moved at all.
 *   3. "Every company" is asked for, not arrived at: an omitted company on
 *      create is refused rather than defaulted to the widest rung.
 *   4. The resolver considers the global rows too, and the ladder is the
 *      database's number, not one this service invents.
 */

const ACME = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const OTHER = '019cc7fc-3547-74a6-b65b-179b9db989a6';
const NIL = '00000000-0000-0000-0000-000000000000';
const PURPOSE = '01a041fa-d3c1-76b2-85e8-86494f756d06';
const TEMPLATE = '01a04322-b45f-7d14-952f-bc3e3645b903';
const BRANCH = '01a04322-b45f-7d14-952f-bc3e3645b904';
const PRINTER = '01a04322-b45f-7d14-952f-bc3e3645b905';
const USER = '01963d86-caf0-7b26-89f0-58ac380a2d60';

type Args = { where?: Record<string, unknown>; data?: Record<string, unknown> };

const assignmentRow = (overrides: Record<string, unknown> = {}) => ({
  ptaId: 'pta-1',
  ptaCompanyId: ACME,
  ptaBranchId: null,
  ptaDeviceId: null,
  ptaPurposeId: PURPOSE,
  ptaTemplateId: TEMPLATE,
  ptaTemplateCompanyKey: ACME,
  ptaOutputMode: 'PRINT',
  ptaPrinterId: null,
  ptaPrinterName: null,
  ptaCopies: null,
  ptaSpecificity: 1,
  ptaRemarks: null,
  ptaIsActive: true,
  ptaIsDeleted: false,
  ptaSyncDate: null,
  ptaCreatedOn: new Date('2026-08-27T00:00:00.000Z'),
  ptaCreatedBy: null,
  ptaModifiedOn: null,
  ptaModifiedBy: null,
  company: { compName: 'Acme Foods Pvt Ltd' },
  branch: null,
  device: null,
  purpose: {
    ppoCode: 'SALE_INVOICE',
    ppoName: 'Tax Invoice',
    ppoCopyCount: 2,
    ppoCopyLabels: 'ORIGINAL, DUPLICATE',
  },
  template: { ptlCode: 'saleinvoice', ptlName: 'Sale Invoice', ptlPublishedRevId: 'v1' },
  printer: null,
  ...overrides,
});

/** A template row as resolveTemplateCompanyKey selects it. */
const templateRow = (companyId: string | null) => ({
  ptlCode: companyId ? 'saleinvoice' : 'SHIPPED-A4',
  ptlCompanyId: companyId,
  ptlCompanyKey: companyId ?? NIL,
});

const buildService = (options: { templateOwner?: string | null; existing?: unknown } = {}) => {
  const owner = options.templateOwner === undefined ? ACME : options.templateOwner;

  const tx = {
    printTemplate: {
      findFirst: jest.fn(() => Promise.resolve(templateRow(owner))),
    },
    printTemplateAssignment: {
      findFirst: jest.fn(() => Promise.resolve(options.existing ?? null)),
      findMany: jest.fn((args: Args) => Promise.resolve(args.where ? [assignmentRow()] : [])),
      count: jest.fn(() => Promise.resolve(1)),
      create: jest.fn(({ data }: Args) => Promise.resolve({ ...assignmentRow(), ...data })),
      update: jest.fn(({ data }: Args) => Promise.resolve({ ...assignmentRow(), ...data })),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
  };

  const prisma = {
    ...tx,
    $transaction: (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
  };

  const service = new PrintTemplateAssignmentService(
    prisma as never,
    { logEntityChange: jest.fn() } as never,
    { getUserId: () => USER } as never,
  );
  return { service, tx };
};

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

const dto = (overrides: Partial<SavePrintTemplateAssignmentDto> = {}) =>
  ({
    ptaCompanyId: ACME,
    ptaPurposeId: PURPOSE,
    ptaTemplateId: TEMPLATE,
    ...overrides,
  }) as SavePrintTemplateAssignmentDto;

describe('rule 1 — the template owner is derived, never taken from the caller', () => {
  it('writes the key it read off the template', async () => {
    const { service, tx } = buildService();
    await service.createAssignment(dto(), USER);

    expect(tx.printTemplateAssignment.create).toHaveBeenCalledWith(
      containing({ data: containing({ ptaTemplateCompanyKey: ACME }) }),
    );
  });

  it('writes the nil sentinel for a shipped design', async () => {
    const { service, tx } = buildService({ templateOwner: null });
    await service.createAssignment(dto({ ptaCompanyId: null }), USER);

    expect(tx.printTemplateAssignment.create).toHaveBeenCalledWith(
      containing({ data: containing({ ptaCompanyId: null, ptaTemplateCompanyKey: NIL }) }),
    );
  });

  it('re-derives it on update, so moving the row re-asks the question', async () => {
    const { service, tx } = buildService({
      templateOwner: null,
      existing: assignmentRow({ ptaTemplateCompanyKey: NIL }),
    });
    await service.save(dto({ ptaId: 'pta-1', ptaCompanyId: null }));

    expect(tx.printTemplate.findFirst).toHaveBeenCalled();
    expect(tx.printTemplateAssignment.update).toHaveBeenCalledWith(
      containing({ data: containing({ ptaTemplateCompanyKey: NIL }) }),
    );
  });
});

describe('rule 2 — an every-company row may only name a shipped design', () => {
  it('refuses a private design on the global rung', async () => {
    const { service } = buildService({ templateOwner: ACME });
    const errors = await errorsOf(() =>
      service.createAssignment(dto({ ptaCompanyId: null }), USER),
    );

    expect(errors[0].field).toBe('ptaTemplateId');
    expect(errors[0].message).toContain('EVERY company');
  });

  it("refuses another company's private design", async () => {
    const { service } = buildService({ templateOwner: OTHER });
    const errors = await errorsOf(() => service.createAssignment(dto(), USER));

    expect(errors[0].field).toBe('ptaTemplateId');
    expect(errors[0].message).toContain('Fork it first');
  });

  it('refuses a branch that names no company', async () => {
    const { service } = buildService({ templateOwner: null });
    const errors = await errorsOf(() =>
      service.createAssignment(dto({ ptaCompanyId: null, ptaBranchId: BRANCH }), USER),
    );

    expect(errors[0].field).toBe('ptaCompanyId');
  });

  it('refuses a counter that names no branch', async () => {
    const { service } = buildService();
    const errors = await errorsOf(() =>
      service.createAssignment(dto({ ptaDeviceId: 'dev-1' }), USER),
    );

    expect(errors[0].field).toBe('ptaBranchId');
  });

  it('refuses both printer answers at once', async () => {
    const { service } = buildService();
    const errors = await errorsOf(() =>
      service.createAssignment(dto({ ptaPrinterId: PRINTER, ptaPrinterName: 'HP-Front' }), USER),
    );

    expect(errors[0].field).toBe('ptaPrinterName');
  });
});

describe('rule 3 — "every company" is asked for, not arrived at', () => {
  it('refuses a create with no company field at all', async () => {
    const { service } = buildService();
    const errors = await errorsOf(() =>
      service.createAssignment(
        { ptaPurposeId: PURPOSE, ptaTemplateId: TEMPLATE } as SavePrintTemplateAssignmentDto,
        USER,
      ),
    );

    expect(errors[0].field).toBe('ptaCompanyId');
    expect(errors[0].message).toContain('null');
  });
});

describe('rule 4 — the resolver walks the ladder the database numbered', () => {
  it('considers the every-company rows alongside the company ones', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst = jest.fn(() =>
      Promise.resolve(assignmentRow({ ptaCompanyId: null, ptaSpecificity: 0 })),
    );

    const resolution = await service.resolve({ companyId: ACME, purposeId: PURPOSE });

    expect(tx.printTemplateAssignment.findFirst).toHaveBeenCalledWith(
      containing({
        where: containing({
          AND: [
            { OR: [{ ptaCompanyId: null }, { ptaCompanyId: ACME }] },
            { OR: [{ ptaBranchId: null }] },
            { OR: [{ ptaDeviceId: null }] },
          ],
        }),
        orderBy: [{ ptaSpecificity: 'desc' }, { ptaCreatedOn: 'desc' }],
      }),
    );
    expect(resolution.scope).toBe('GLOBAL');
  });

  it('names each rung by the number the database derived', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst = jest.fn(() =>
      Promise.resolve(assignmentRow({ ptaSpecificity: 3 })),
    );

    const resolution = await service.resolve({ companyId: ACME, purposeId: PURPOSE });
    expect(resolution.scope).toBe('COUNTER');
  });

  it('falls back to the purpose copy count and reads its labels', async () => {
    const { service, tx } = buildService();
    tx.printTemplateAssignment.findFirst = jest.fn(() => Promise.resolve(assignmentRow()));

    const resolution = await service.resolve({ companyId: ACME, purposeId: PURPOSE });

    expect(resolution.copies).toBe(2);
    expect(resolution.copyLabels).toEqual(['ORIGINAL', 'DUPLICATE']);
  });

  it('says where the paper comes out, and how much can be asserted about it', async () => {
    const { service, tx } = buildService();

    tx.printTemplateAssignment.findFirst = jest.fn(() =>
      Promise.resolve(assignmentRow({ ptaPrinterId: PRINTER, printer: { prfName: 'Counter 1' } })),
    );
    await expect(service.resolve({ companyId: ACME, purposeId: PURPOSE })).resolves.toEqual(
      containing({ printerSource: 'PROFILE', ptaPrinterName: 'Counter 1' }),
    );

    tx.printTemplateAssignment.findFirst = jest.fn(() =>
      Promise.resolve(assignmentRow({ ptaPrinterName: 'HP-Front' })),
    );
    await expect(service.resolve({ companyId: ACME, purposeId: PURPOSE })).resolves.toEqual(
      containing({ printerSource: 'NAME', ptaPrinterName: 'HP-Front' }),
    );

    tx.printTemplateAssignment.findFirst = jest.fn(() => Promise.resolve(assignmentRow()));
    await expect(service.resolve({ companyId: ACME, purposeId: PURPOSE })).resolves.toEqual(
      containing({ printerSource: 'DEFAULT', ptaPrinterName: null }),
    );
  });
});

describe('the list reads the ladder the same way', () => {
  it('unions the company rows with the global ones when asked', async () => {
    const { service, tx } = buildService();
    await service.list({ ptaCompanyId: ACME, includeGlobal: true });

    expect(tx.printTemplateAssignment.findMany).toHaveBeenCalledWith(
      containing({
        where: containing({ OR: [{ ptaCompanyId: ACME }, { ptaCompanyId: null }] }),
      }),
    );
  });

  it('nests the search beside the company clause instead of replacing it', async () => {
    const { service, tx } = buildService();
    await service.list({ ptaCompanyId: ACME, includeGlobal: true, search: 'invoice' });

    const where = tx.printTemplateAssignment.findMany.mock.calls[0][0].where as {
      OR?: unknown;
      AND?: unknown[];
    };
    expect(where.OR).toBeUndefined();
    expect(where.AND).toHaveLength(2);
  });
});
