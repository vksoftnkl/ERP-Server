import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AccVoucherSeq } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service';
import type { CreateSequenceDto } from './dto/create-sequence.dto';
import type { UpdateSequenceDto } from './dto/update-sequence.dto';
import { SequenceService } from './sequence.service';

const SEQ_ID = '019f0000-0000-7000-8000-0000000000a1';
const OTHER_SEQ_ID = '019f0000-0000-7000-8000-0000000000a2';
const COMPANY_ID = '019f0000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '019f0000-0000-7000-8000-0000000000c2';
const OTHER_BRANCH_ID = '019f0000-0000-7000-8000-0000000000c3';
const DEVICE_ID = '019f0000-0000-7000-8000-0000000000d1';
const USER_ID = '019f0000-0000-7000-8000-0000000000e1';
const CREATED_ON = new Date('2026-04-01T04:30:00.000Z');

const makeSeq = (overrides: Partial<AccVoucherSeq> = {}): AccVoucherSeq =>
  ({
    id: SEQ_ID,
    vchrTypeId: 3,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    accYear: '2026-2027',
    deviceId: null,
    deviceCode: 'MAIN',
    periodKey: 'YEAR',
    lastNo: BigInt(41),
    voucherPrefix: 'SB/',
    companyCode: null,
    branchCode: null,
    voucherSuffix: null,
    noWidth: 5,
    lastRefno: 'SB/00041',
    isActive: true,
    isDeleted: false,
    createdOn: CREATED_ON,
    createdBy: null,
    modifiedOn: null,
    modifiedBy: null,
    ...overrides,
  }) as AccVoucherSeq;

const createDto = (overrides: Partial<CreateSequenceDto> = {}): CreateSequenceDto =>
  ({
    vchrTypeId: 3,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    accYear: '2026-2027',
    periodKey: 'YEAR',
    ...overrides,
  }) as CreateSequenceDto;

type FindFirstArgs = {
  where: Record<string, unknown>;
  orderBy?: unknown;
  select?: Record<string, boolean>;
};

/**
 * accVoucherSeq.findFirst serves four reads; they are told apart by shape:
 * the running-number read orders by lastNo, the uniqueness check selects only
 * the id, the live-row read filters isDeleted, and the scope read is the rest.
 */
const makePrisma = (
  options: {
    latestLastNo?: bigint | null;
    scopeRow?: AccVoucherSeq | null;
    existing?: AccVoucherSeq | null;
    duplicateId?: string | null;
    voucherType?: boolean;
    company?: boolean;
    branch?: boolean;
  } = {},
) => {
  const findFirst = jest.fn(async (args: FindFirstArgs) => {
    if (args.orderBy) {
      return options.latestLastNo == null ? null : { lastNo: options.latestLastNo };
    }
    if (args.select?.id) {
      return options.duplicateId ? { id: options.duplicateId } : null;
    }
    if (args.where.isDeleted === false) {
      return options.existing ?? null;
    }
    return options.scopeRow ?? null;
  });
  const accVoucherSeq = {
    findFirst,
    findMany: jest.fn(async (_args: unknown) => [makeSeq()]),
    count: jest.fn(async (_args: { where: Record<string, any> }) => 1),
    create: jest.fn(async (args: { data: Partial<AccVoucherSeq> }) => makeSeq(args.data)),
    update: jest.fn(async (args: { data: Partial<AccVoucherSeq> }) =>
      makeSeq({ ...(options.existing ?? options.scopeRow ?? {}), ...args.data }),
    ),
    updateMany: jest.fn(async (_args: { where: unknown; data: Record<string, unknown> }) => ({
      count: 1,
    })),
  };
  const tx = {
    accVoucherSeq,
    accVoucherType: {
      findFirst: jest.fn(async () => (options.voucherType === false ? null : { vchrTypeId: 3 })),
    },
    company: {
      findFirst: jest.fn(async () => (options.company === false ? null : { compId: COMPANY_ID })),
    },
    branchMaster: {
      findFirst: jest.fn(async () => (options.branch === false ? null : { brId: BRANCH_ID })),
    },
    $queryRaw: jest.fn(async (..._args: unknown[]) => [{ locked: 1 }]),
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx };
};

const serviceWith = (options: Parameters<typeof makePrisma>[0] = {}) => {
  const harness = makePrisma(options);
  return {
    ...harness,
    service: new SequenceService(harness.prisma as unknown as PrismaService),
  };
};

/** The house error body a refusal carries. */
const refusal = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as BadRequestException;
  }
  throw new Error('expected a refusal');
};
const codeOf = async (promise: Promise<unknown>) =>
  ((await refusal(promise)).getResponse() as { errors: { code: string; field: string }[] })
    .errors[0];

describe('SequenceService', () => {
  describe('save', () => {
    it('creates when no id is given and updates when one is', async () => {
      const { service } = serviceWith({ existing: makeSeq() });
      const create = jest.spyOn(service, 'create');
      const update = jest.spyOn(service, 'update');

      await service.save(createDto());
      await service.save({ ...createDto(), id: SEQ_ID });

      expect(create).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(SEQ_ID, expect.objectContaining({ id: SEQ_ID }));
    });
  });

  describe('create', () => {
    it('opens a new sequence one past the last number in its company/branch/year/device', async () => {
      const { service, tx } = serviceWith({ latestLastNo: BigInt(41) });

      const payload = await service.create(createDto());

      expect(tx.accVoucherSeq.create).toHaveBeenCalledWith({
        data: {
          vchrTypeId: 3,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          accYear: '2026-2027',
          deviceCode: 'MAIN',
          periodKey: 'YEAR',
          deviceId: null,
          lastNo: BigInt(42),
          noWidth: 5,
        },
      });
      expect(payload.lastNo).toBe('42');
      // The running number spans every voucher type of the scope.
      expect(tx.accVoucherSeq.findFirst).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: '2026-2027', deviceId: null },
        orderBy: { lastNo: 'desc' },
        select: { lastNo: true },
      });
    });

    it('starts at 1 when the scope has no sequence yet', async () => {
      const { service, tx } = serviceWith({ latestLastNo: null });

      await service.create(createDto());

      expect(tx.accVoucherSeq.create.mock.calls[0][0].data.lastNo).toBe(BigInt(1));
    });

    it('locks the running number of its scope before reading it', async () => {
      const { service, tx } = serviceWith();

      await service.create(createDto({ deviceId: DEVICE_ID }));

      const [, namespace, key] = tx.$queryRaw.mock.calls[0] as unknown as [
        TemplateStringsArray,
        string,
        string,
      ];
      expect(namespace).toBe('accounts.acc_voucher_seq.last_no');
      expect(key).toBe(`${COMPANY_ID}|${BRANCH_ID}|2026-2027|${DEVICE_ID}`);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.accVoucherSeq.findFirst.mock.invocationCallOrder[0],
      );
    });

    it('keys a scope without a device as NO_DEVICE', async () => {
      const { service, tx } = serviceWith();

      await service.create(createDto());

      expect(tx.$queryRaw.mock.calls[0][2]).toBe(`${COMPANY_ID}|${BRANCH_ID}|2026-2027|NO_DEVICE`);
    });

    it('takes the optional fields, trimmed, with blank text stored as null', async () => {
      const { service, tx } = serviceWith();

      await service.create(
        createDto({
          deviceCode: ' POS1 ',
          noWidth: '6' as unknown as number,
          isActive: 'false' as unknown as boolean,
          createdBy: USER_ID,
          voucherPrefix: ' SB/ ',
          companyCode: '',
          branchCode: 'BR1',
          voucherSuffix: null as unknown as string,
          lastRefno: 'SB/000',
        }),
      );

      expect(tx.accVoucherSeq.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          deviceCode: 'POS1',
          noWidth: 6,
          isActive: false,
          createdBy: USER_ID,
          voucherPrefix: 'SB/',
          companyCode: null,
          branchCode: 'BR1',
          voucherSuffix: null,
          lastRefno: 'SB/000',
        }),
      );
    });

    it('reuses the row already holding the scope — reviving a deleted one', async () => {
      const deleted = makeSeq({ id: OTHER_SEQ_ID, isDeleted: true, isActive: false });
      const { service, tx } = serviceWith({ scopeRow: deleted, latestLastNo: BigInt(9) });

      const payload = await service.create(createDto({ noWidth: 4 }));

      expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
      expect(tx.accVoucherSeq.update).toHaveBeenCalledWith({
        where: { id: OTHER_SEQ_ID },
        data: expect.objectContaining({
          lastNo: BigInt(10),
          isDeleted: false,
          isActive: true,
          noWidth: 4,
          modifiedOn: expect.any(Date),
        }),
      });
      expect(payload).toMatchObject({ id: OTHER_SEQ_ID, isDeleted: false, lastNo: '10' });
    });

    it('keeps an explicit isActive:false when reusing the row', async () => {
      const { service, tx } = serviceWith({ scopeRow: makeSeq() });

      await service.create(createDto({ isActive: false }));

      expect(tx.accVoucherSeq.update.mock.calls[0][0].data.isActive).toBe(false);
    });

    it.each([
      ['vchrTypeId', { vchrTypeId: 0 }, 'VALIDATION_MIN'],
      ['vchrTypeId', { vchrTypeId: 'x' }, 'VALIDATION_IS_INT'],
      ['companyId', { companyId: 'not-a-uuid' }, 'VALIDATION_IS_UUID'],
      ['branchId', { branchId: undefined }, 'VALIDATION_IS_UUID'],
      ['accYear', { accYear: '2026-20270' }, 'VALIDATION_MAX_LENGTH'],
      ['accYear', { accYear: 2026 }, 'VALIDATION_IS_STRING'],
      ['periodKey', { periodKey: '   ' }, 'VALIDATION_IS_NOT_EMPTY'],
      ['noWidth', { noWidth: 0 }, 'VALIDATION_MIN'],
      ['isActive', { isActive: 'maybe' }, 'VALIDATION_IS_BOOLEAN'],
      ['deviceId', { deviceId: 'nope' }, 'VALIDATION_IS_UUID'],
    ])('refuses a bad %s with 400 %s', async (field, overrides, code) => {
      const { service, tx } = serviceWith();

      const error = await refusal(service.create(createDto(overrides as Partial<CreateSequenceDto>)));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(await codeOf(Promise.reject(error))).toEqual(expect.objectContaining({ field, code }));
      expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
    });

    it.each([
      ['voucherType', 'vchrTypeId', 'SEQUENCE_VOUCHER_TYPE_NOT_FOUND'],
      ['company', 'companyId', 'SEQUENCE_COMPANY_NOT_FOUND'],
      ['branch', 'branchId', 'SEQUENCE_BRANCH_NOT_FOUND'],
    ])('refuses when the %s does not exist', async (missing, field, code) => {
      const { service } = serviceWith({ [missing]: false });

      expect(await codeOf(service.create(createDto()))).toEqual(
        expect.objectContaining({ field, code }),
      );
    });

    it('looks the branch up under the company, among live branches', async () => {
      const { service, tx } = serviceWith();

      await service.create(createDto());

      expect(tx.branchMaster.findFirst).toHaveBeenCalledWith({
        where: { brId: BRANCH_ID, brCompId: COMPANY_ID, brIsDeleted: false },
        select: { brId: true },
      });
    });

    it.each([
      ['an ORM unique violation (P2002)', { code: 'P2002' }],
      ['a raw unique violation (P2010 / 23505)', { code: 'P2010', meta: { code: '23505' } }],
    ])('answers %s with 409 SEQUENCE_SCOPE_DUPLICATE', async (_label, prismaError) => {
      const { service, tx } = serviceWith();
      tx.accVoucherSeq.create.mockRejectedValue(prismaError);

      const error = await refusal(service.create(createDto()));

      expect(error).toBeInstanceOf(ConflictException);
      expect(await codeOf(Promise.reject(error))).toEqual(
        expect.objectContaining({ field: 'scope', code: 'SEQUENCE_SCOPE_DUPLICATE' }),
      );
    });

    it('rethrows any other failure as it is', async () => {
      const { service, tx } = serviceWith();
      const boom = new Error('connection lost');
      tx.accVoucherSeq.create.mockRejectedValue(boom);

      await expect(service.create(createDto())).rejects.toBe(boom);
    });
  });

  describe('findAll', () => {
    it('lists live sequences, page 1 of 20 by default, newest year first', async () => {
      const { service, prisma } = serviceWith();
      prisma.accVoucherSeq.count.mockResolvedValue(45);

      const result = await service.findAll();

      expect(prisma.accVoucherSeq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
          skip: 0,
          take: 20,
          orderBy: expect.arrayContaining([{ accYear: 'desc' }]),
        }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 45, total_pages: 3 });
      expect(result.items[0]).toMatchObject({
        id: SEQ_ID,
        lastNo: '41',
        createdOn: CREATED_ON.toISOString(),
        modifiedOn: null,
      });
    });

    it('pages with skip', async () => {
      const { service, prisma } = serviceWith();

      await service.findAll({ page: '3', limit: '10' } as never);

      expect(prisma.accVoucherSeq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('caps the page size at 100', async () => {
      expect(await codeOf(serviceWith().service.findAll({ limit: 101 } as never))).toEqual(
        expect.objectContaining({ field: 'limit', code: 'VALIDATION_MAX' }),
      );
    });

    it('includes deleted rows only when asked', async () => {
      const { service, prisma } = serviceWith();

      await service.findAll({ includeDeleted: 'yes' } as never);

      expect(prisma.accVoucherSeq.count).toHaveBeenCalledWith({ where: {} });
    });

    it('applies each filter, trimmed', async () => {
      const { service, prisma } = serviceWith();

      await service.findAll({
        vchrTypeId: '3',
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ' 2026-2027 ',
        deviceId: '',
        deviceCode: 'POS1',
        periodKey: 'YEAR',
        isActive: 'off',
      } as never);

      expect(prisma.accVoucherSeq.count).toHaveBeenCalledWith({
        where: {
          isDeleted: false,
          vchrTypeId: 3,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          accYear: '2026-2027',
          deviceId: null,
          deviceCode: 'POS1',
          periodKey: 'YEAR',
          isActive: false,
        },
      });
    });

    it('searches the text columns, case-insensitively', async () => {
      const { service, prisma } = serviceWith();

      await service.findAll({ search: '  SB/ ' } as never);

      const where = prisma.accVoucherSeq.count.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(8);
      expect(where.OR).toContainEqual({ voucherPrefix: { contains: 'SB/', mode: 'insensitive' } });
      expect(where.OR).not.toContainEqual({ id: expect.anything() });
    });

    it('also matches the id when the search is a uuid', async () => {
      const { service, prisma } = serviceWith();

      await service.findAll({ search: SEQ_ID } as never);

      expect(prisma.accVoucherSeq.count.mock.calls[0][0].where.OR).toContainEqual({ id: SEQ_ID });
    });

    it('ignores a blank search', async () => {
      const { service, prisma } = serviceWith();

      await service.list({ search: '   ' } as never);

      expect(prisma.accVoucherSeq.count.mock.calls[0][0].where).not.toHaveProperty('OR');
    });
  });

  describe('findOne', () => {
    it('reads a live sequence', async () => {
      const { service, prisma } = serviceWith({ existing: makeSeq() });

      await expect(service.getById(SEQ_ID)).resolves.toMatchObject({ id: SEQ_ID });
      expect(prisma.accVoucherSeq.findFirst).toHaveBeenCalledWith({
        where: { id: SEQ_ID, isDeleted: false },
      });
    });

    it('answers 404 SEQUENCE_NOT_FOUND for no live row', async () => {
      const error = await refusal(serviceWith().service.findOne(SEQ_ID));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(JSON.stringify(error.getResponse())).toContain('SEQUENCE_NOT_FOUND');
    });

    it('refuses an id that is not a uuid', async () => {
      expect(await codeOf(serviceWith().service.findOne('42'))).toEqual(
        expect.objectContaining({ field: 'id', code: 'VALIDATION_IS_UUID' }),
      );
    });
  });

  describe('update', () => {
    const update = (dto: Partial<UpdateSequenceDto>, options: Parameters<typeof makePrisma>[0] = {}) => {
      const harness = serviceWith({ existing: makeSeq(), ...options });
      return { ...harness, result: harness.service.update(SEQ_ID, dto as UpdateSequenceDto) };
    };

    it('answers 404 when no live row has the id', async () => {
      const { result } = update({}, { existing: null });

      await expect(result).rejects.toBeInstanceOf(NotFoundException);
    });

    it('changes only what is given and stamps modifiedOn', async () => {
      const { result, tx } = update({ voucherPrefix: 'INV/', noWidth: 6, modifiedBy: USER_ID });
      await result;

      expect(tx.accVoucherSeq.update).toHaveBeenCalledWith({
        where: { id: SEQ_ID },
        data: {
          modifiedOn: expect.any(Date),
          voucherPrefix: 'INV/',
          noWidth: 6,
          modifiedBy: USER_ID,
        },
      });
    });

    it('keeps the running number when the company/branch/year/device stay put', async () => {
      const { result, tx } = update({ periodKey: 'MONTH-04' });
      await result;

      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.accVoucherSeq.update.mock.calls[0][0].data).not.toHaveProperty('lastNo');
    });

    it('renumbers, under the lock, when the sequence moves to another branch', async () => {
      const { result, tx } = update({ branchId: OTHER_BRANCH_ID }, { latestLastNo: BigInt(7) });
      await result;

      expect(tx.$queryRaw.mock.calls[0][2]).toBe(
        `${COMPANY_ID}|${OTHER_BRANCH_ID}|2026-2027|NO_DEVICE`,
      );
      expect(tx.accVoucherSeq.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: OTHER_BRANCH_ID, id: { not: SEQ_ID } }),
          orderBy: { lastNo: 'desc' },
        }),
      );
      expect(tx.accVoucherSeq.update.mock.calls[0][0].data).toMatchObject({
        branchId: OTHER_BRANCH_ID,
        lastNo: BigInt(8),
      });
    });

    it('treats a blank deviceId as no device — a scope change when one was set', async () => {
      const { result, tx } = update(
        { deviceId: '' as unknown as string },
        { existing: makeSeq({ deviceId: DEVICE_ID }) },
      );
      await result;

      expect(tx.accVoucherSeq.update.mock.calls[0][0].data).toMatchObject({
        deviceId: null,
        lastNo: expect.any(BigInt),
      });
    });

    it('refuses to move onto a scope another sequence holds', async () => {
      const { result, tx } = update({ accYear: '2027-2028' }, { duplicateId: OTHER_SEQ_ID });

      expect(await codeOf(result)).toEqual(
        expect.objectContaining({ field: 'scope', code: 'SEQUENCE_SCOPE_DUPLICATE' }),
      );
      expect(tx.accVoucherSeq.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accYear: '2027-2028', id: { not: SEQ_ID } }),
          select: { id: true },
        }),
      );
      expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
    });

    it('checks the references of the resulting scope', async () => {
      const { result } = update({ companyId: COMPANY_ID }, { company: false });

      expect(await codeOf(result)).toEqual(
        expect.objectContaining({ code: 'SEQUENCE_COMPANY_NOT_FOUND' }),
      );
    });

    it.each([
      ['deviceCode', { deviceCode: '' }, 'VALIDATION_IS_NOT_EMPTY'],
      ['noWidth', { noWidth: 0 }, 'VALIDATION_MIN'],
      ['modifiedBy', { modifiedBy: 'x' }, 'VALIDATION_IS_UUID'],
      ['lastRefno', { lastRefno: 'x'.repeat(101) }, 'VALIDATION_MAX_LENGTH'],
    ])('refuses a bad %s', async (field, dto, code) => {
      const { result } = update(dto as Partial<UpdateSequenceDto>);

      expect(await codeOf(result)).toEqual(expect.objectContaining({ field, code }));
    });

    it('answers a unique violation with 409', async () => {
      const { service, tx } = serviceWith({ existing: makeSeq() });
      tx.accVoucherSeq.update.mockRejectedValue({ code: 'P2002' });

      await expect(service.update(SEQ_ID, {} as UpdateSequenceDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('softDelete', () => {
    it('deactivates and hides a live row', async () => {
      const { service, prisma } = serviceWith();

      await expect(service.remove(SEQ_ID, USER_ID)).resolves.toEqual({ id: SEQ_ID, deleted: true });

      expect(prisma.accVoucherSeq.updateMany).toHaveBeenCalledWith({
        where: { id: SEQ_ID, isDeleted: false },
        data: {
          isActive: false,
          isDeleted: true,
          modifiedOn: expect.any(Date),
          modifiedBy: USER_ID,
        },
      });
    });

    it('leaves modifiedBy alone when no user is given', async () => {
      const { service, prisma } = serviceWith();

      await service.softDelete(SEQ_ID);

      expect(prisma.accVoucherSeq.updateMany.mock.calls[0][0].data).not.toHaveProperty(
        'modifiedBy',
      );
    });

    it('answers 404 when nothing live had the id', async () => {
      const { service, prisma } = serviceWith();
      prisma.accVoucherSeq.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.softDelete(SEQ_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
