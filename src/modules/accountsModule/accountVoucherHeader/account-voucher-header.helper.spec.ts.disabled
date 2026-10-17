import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccVoucherHeader, DeviceType, Prisma, VoucherStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  buildAccountVoucherHeaderCreateInput,
  buildAccountVoucherHeaderUpdateInput,
  createAccountVoucherHeader,
  CreateAccountVoucherHeaderPayload,
  softDeleteAccountVoucherHeader,
  updateAccountVoucherHeader,
  UpdateAccountVoucherHeaderPayload,
} from './account-voucher-header.helper';

const COMPANY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f40001';
const BRANCH_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f40002';
const OTHER_BRANCH_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f40006';
const PARTY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f40003';
const USER_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f40004';
const EMPLOYEE_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f40005';

type TransactionClientMock = {
  accVoucherHeader: {
    create: jest.Mock<Promise<AccVoucherHeader>, [Prisma.AccVoucherHeaderCreateArgs]>;
    findFirst: jest.Mock<Promise<unknown>, [Prisma.AccVoucherHeaderFindFirstArgs]>;
    update: jest.Mock<Promise<AccVoucherHeader>, [Prisma.AccVoucherHeaderUpdateArgs]>;
  };
  accVoucherType: {
    findFirst: jest.Mock<Promise<unknown>, [Prisma.AccVoucherTypeFindFirstArgs]>;
  };
  $queryRaw: jest.Mock<Promise<unknown>, [TemplateStringsArray | Prisma.Sql, ...unknown[]]>;
};

type PrismaRootMock = {
  $transaction: jest.Mock<
    Promise<AccVoucherHeader>,
    [(tx: Prisma.TransactionClient) => Promise<AccVoucherHeader>]
  >;
};

const makePayload = (
  overrides: Partial<CreateAccountVoucherHeaderPayload> = {},
): CreateAccountVoucherHeaderPayload => ({
  avhAccYear: '2025-2026',
  avhCompanyId: COMPANY_ID,
  avhBranchId: BRANCH_ID,
  avhVoucherTypeId: 25,
  avhVoucherDate: new Date('2026-03-27T10:00:00.000Z'),
  avhPartyId: PARTY_ID,
  avhEmployeeId: [EMPLOYEE_ID],
  avhUserId: USER_ID,
  avhDeviceType: DeviceType.WEB,
  avhCounterId: 'COUNTER-1',
  ...overrides,
});

const makeUpdatePayload = (
  overrides: Partial<UpdateAccountVoucherHeaderPayload> = {},
): UpdateAccountVoucherHeaderPayload => ({
  avhBillRefno: 'BILL-UPDATED',
  avhRemarks: 'Updated voucher',
  avhUpdatedBy: USER_ID,
  ...overrides,
});

const makeRecord = (overrides: Partial<AccVoucherHeader> = {}): AccVoucherHeader =>
  ({
    avhVoucherId: '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f40010',
    avhAccYear: '2025-2026',
    avhCompanyId: COMPANY_ID,
    avhBranchId: BRANCH_ID,
    avhVoucherTypeId: 25,
    avhVoucherNo: BigInt(25),
    avhVoucherSlno: BigInt(10),
    avhUserRefno: null,
    avhVoucherDate: new Date('2026-03-27T10:00:00.000Z'),
    avhVoucherRefno: 'clo-10',
    avhBillDate: null,
    avhBillRefno: 'BILL-001',
    avhBillAmount: new Prisma.Decimal('0'),
    avhAdjustAmount: new Prisma.Decimal('0'),
    avhTotalDebit: new Prisma.Decimal('0'),
    avhTotalCredit: new Prisma.Decimal('0'),
    avhPartyId: PARTY_ID,
    avhOppositeLedgerId: null,
    avhEmployeeId: [EMPLOYEE_ID],
    avhPayNotes: null,
    avhRemarks: null,
    avhVoucherStatus: VoucherStatus.DRAFT,
    avhStatusOn: null,
    avhStatusBy: null,
    avhCancelReason: null,
    avhUserId: USER_ID,
    avhSessionId: null,
    avhDeviceType: DeviceType.WEB,
    avhDeviceId: null,
    avhCounterId: 'COUNTER-1',
    avhPrintCount: 0,
    avhWhatsappStatus: 'NA' as AccVoucherHeader['avhWhatsappStatus'],
    avhSmsStatus: 'NA' as AccVoucherHeader['avhSmsStatus'],
    avhTallyExportStatus: 'PENDING' as AccVoucherHeader['avhTallyExportStatus'],
    avhTallyExportedOn: null,
    avhTallyGuid: null,
    avhTallyErrorMsg: null,
    avhIsActive: true,
    avhIsDeleted: false,
    avhSyncDate: null,
    avhCreatedOn: new Date('2026-03-27T10:00:00.000Z'),
    avhCreatedBy: null,
    avhUpdatedOn: null,
    avhUpdatedBy: null,
    ...overrides,
  }) as AccVoucherHeader;

describe('account voucher header helper', () => {
  let tx: TransactionClientMock;
  let prisma: PrismaRootMock;

  beforeEach(() => {
    tx = {
      accVoucherHeader: {
        create: jest.fn<Promise<AccVoucherHeader>, [Prisma.AccVoucherHeaderCreateArgs]>(),
        findFirst: jest.fn<Promise<unknown>, [Prisma.AccVoucherHeaderFindFirstArgs]>(),
        update: jest.fn<Promise<AccVoucherHeader>, [Prisma.AccVoucherHeaderUpdateArgs]>(),
      },
      accVoucherType: {
        findFirst: jest.fn<Promise<unknown>, [Prisma.AccVoucherTypeFindFirstArgs]>(),
      },
      $queryRaw: jest.fn<Promise<unknown>, [TemplateStringsArray | Prisma.Sql, ...unknown[]]>(),
    };

    prisma = {
      $transaction: jest.fn<
        Promise<AccVoucherHeader>,
        [(client: Prisma.TransactionClient) => Promise<AccVoucherHeader>]
      >(),
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: Prisma.TransactionClient) => Promise<AccVoucherHeader>) =>
        callback(tx as unknown as Prisma.TransactionClient),
    );

    tx.$queryRaw.mockResolvedValue([]);
  });

  it('creates a voucher header with generated voucher numbers and refno', async () => {
    tx.accVoucherType.findFirst.mockResolvedValue({
      vchrTypeId: 25,
      vchrTypeCode: 'clo',
    });
    tx.accVoucherHeader.findFirst
      .mockResolvedValueOnce({ avhVoucherNo: BigInt(24) })
      .mockResolvedValueOnce({ avhVoucherSlno: BigInt(9) });
    tx.accVoucherHeader.create.mockResolvedValue(
      makeRecord({
        avhBillRefno: 'clo-10',
      }),
    );

    const result = await createAccountVoucherHeader(
      prisma as unknown as PrismaService,
      makePayload(),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.accVoucherHeader.create).toHaveBeenCalledTimes(1);
    expect(tx.accVoucherHeader.create.mock.calls[0][0]).toEqual({
      data: expect.objectContaining({
        avhVoucherNo: BigInt(25),
        avhVoucherSlno: BigInt(10),
        avhBillDate: new Date('2026-03-27T10:00:00.000Z'),
        avhVoucherRefno: 'clo-10',
        avhBillRefno: 'clo-10',
      }),
    });
    expect(result.avhVoucherRefno).toBe('clo-10');
    expect(result.avhBillRefno).toBe('clo-10');
  });

  it('builds create input inside an existing transaction client', async () => {
    tx.accVoucherType.findFirst.mockResolvedValue({
      vchrTypeId: 25,
      vchrTypeCode: 'JV',
    });
    tx.accVoucherHeader.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ avhVoucherSlno: BigInt(4) });

    const result = await buildAccountVoucherHeaderCreateInput(
      tx as unknown as Prisma.TransactionClient,
      makePayload({
        avhVoucherTypeId: 99,
      }),
    );

    expect(result.avhVoucherNo).toBe(BigInt(1));
    expect(result.avhVoucherSlno).toBe(BigInt(5));
    expect(result.avhBillDate).toEqual(new Date('2026-03-27T10:00:00.000Z'));
    expect(result.avhVoucherRefno).toBe('JV-5');
    expect(result.avhBillRefno).toBe('JV-5');
    expect(tx.accVoucherHeader.findFirst.mock.calls[1][0]).toEqual({
      where: expect.objectContaining({
        avhAccYear: '2025-2026',
        avhCompanyId: COMPANY_ID,
        avhBranchId: BRANCH_ID,
        avhVoucherTypeId: 99,
      }),
      orderBy: {
        avhVoucherSlno: 'desc',
      },
      select: {
        avhVoucherSlno: true,
      },
    });
  });

  it('rejects buildAccountVoucherHeaderCreateInput when a root prisma client is passed', async () => {
    await expect(
      buildAccountVoucherHeaderCreateInput(prisma as unknown as PrismaService, makePayload()),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when the voucher type does not exist', async () => {
    tx.accVoucherType.findFirst.mockResolvedValue(null);

    await expect(
      buildAccountVoucherHeaderCreateInput(
        tx as unknown as Prisma.TransactionClient,
        makePayload(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when the voucher type code is blank', async () => {
    tx.accVoucherType.findFirst.mockResolvedValue({
      vchrTypeId: 25,
      vchrTypeCode: '   ',
    });

    await expect(
      buildAccountVoucherHeaderCreateInput(
        tx as unknown as Prisma.TransactionClient,
        makePayload(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates a voucher header without renumbering when the voucher scope is unchanged', async () => {
    const existing = makeRecord();
    const updated = makeRecord({
      avhBillRefno: 'BILL-UPDATED',
      avhRemarks: 'Updated voucher',
      avhUpdatedOn: new Date('2026-03-28T09:00:00.000Z'),
      avhUpdatedBy: USER_ID,
    });

    tx.accVoucherHeader.findFirst.mockResolvedValue(existing);
    tx.accVoucherHeader.update.mockResolvedValue(updated);

    const result = await updateAccountVoucherHeader(
      prisma as unknown as PrismaService,
      existing.avhVoucherId,
      makeUpdatePayload(),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.accVoucherHeader.update).toHaveBeenCalledWith({
      where: {
        avhVoucherId: existing.avhVoucherId,
      },
      data: expect.objectContaining({
        avhBillRefno: 'BILL-UPDATED',
        avhRemarks: 'Updated voucher',
        avhUpdatedBy: USER_ID,
        avhUpdatedOn: expect.any(Date),
      }),
    });
    expect(result.avhVoucherNo).toBe(existing.avhVoucherNo);
    expect(result.avhVoucherRefno).toBe(existing.avhVoucherRefno);
  });

  it('syncs bill date with voucher date when building update input', async () => {
    const existing = makeRecord({
      avhBillDate: new Date('2026-03-20T10:00:00.000Z'),
    });

    tx.accVoucherHeader.findFirst.mockResolvedValue(existing);

    const result = await buildAccountVoucherHeaderUpdateInput(
      tx as unknown as Prisma.TransactionClient,
      existing.avhVoucherId,
      makeUpdatePayload({
        avhVoucherDate: new Date('2026-03-29T10:00:00.000Z'),
      }),
    );

    expect(result.avhBillDate).toEqual(new Date('2026-03-29T10:00:00.000Z'));
  });

  it('rebuilds voucher serial and refno when the voucher type changes', async () => {
    const existing = makeRecord();
    const updated = makeRecord({
      avhVoucherTypeId: 99,
      avhVoucherSlno: BigInt(5),
      avhVoucherRefno: 'JV-5',
      avhBillRefno: 'JV-5',
      avhUpdatedOn: new Date('2026-03-28T10:00:00.000Z'),
      avhUpdatedBy: USER_ID,
    });

    tx.accVoucherHeader.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ avhVoucherSlno: BigInt(4) });
    tx.accVoucherType.findFirst.mockResolvedValue({
      vchrTypeId: 99,
      vchrTypeCode: 'JV',
    });
    tx.accVoucherHeader.update.mockResolvedValue(updated);

    const result = await updateAccountVoucherHeader(
      tx as unknown as Prisma.TransactionClient,
      existing.avhVoucherId,
      makeUpdatePayload({
        avhVoucherTypeId: 99,
      }),
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.accVoucherHeader.update.mock.calls[0][0]).toEqual({
      where: {
        avhVoucherId: existing.avhVoucherId,
      },
      data: expect.objectContaining({
        avhVoucherTypeId: 99,
        avhVoucherSlno: BigInt(5),
        avhVoucherRefno: 'JV-5',
        avhBillRefno: 'JV-5',
        avhUpdatedOn: expect.any(Date),
      }),
    });
    expect(
      tx.accVoucherHeader.update.mock.calls[0][0]
        .data as Prisma.AccVoucherHeaderUncheckedUpdateInput,
    ).not.toHaveProperty('avhVoucherNo');
    expect(result.avhVoucherRefno).toBe('JV-5');
    expect(result.avhBillRefno).toBe('JV-5');
  });

  it('rebuilds voucher number, serial, and refno when the numbering scope changes', async () => {
    const existing = makeRecord();
    const updated = makeRecord({
      avhBranchId: OTHER_BRANCH_ID,
      avhVoucherTypeId: 99,
      avhVoucherNo: BigInt(3),
      avhVoucherSlno: BigInt(8),
      avhVoucherRefno: 'BR-8',
      avhBillRefno: 'BR-8',
      avhUpdatedOn: new Date('2026-03-28T11:00:00.000Z'),
    });

    tx.accVoucherHeader.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ avhVoucherSlno: BigInt(7) })
      .mockResolvedValueOnce({ avhVoucherNo: BigInt(2) });
    tx.accVoucherType.findFirst.mockResolvedValue({
      vchrTypeId: 99,
      vchrTypeCode: 'BR',
    });
    tx.accVoucherHeader.update.mockResolvedValue(updated);

    const result = await updateAccountVoucherHeader(
      tx as unknown as Prisma.TransactionClient,
      existing.avhVoucherId,
      makeUpdatePayload({
        avhBranchId: OTHER_BRANCH_ID,
        avhVoucherTypeId: 99,
      }),
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.accVoucherHeader.update).toHaveBeenCalledWith({
      where: {
        avhVoucherId: existing.avhVoucherId,
      },
      data: expect.objectContaining({
        avhBranchId: OTHER_BRANCH_ID,
        avhVoucherTypeId: 99,
        avhVoucherNo: BigInt(3),
        avhVoucherSlno: BigInt(8),
        avhVoucherRefno: 'BR-8',
        avhBillRefno: 'BR-8',
        avhUpdatedOn: expect.any(Date),
      }),
    });
    expect(result.avhVoucherNo).toBe(BigInt(3));
    expect(result.avhVoucherRefno).toBe('BR-8');
    expect(result.avhBillRefno).toBe('BR-8');
  });

  it('rejects buildAccountVoucherHeaderUpdateInput when a root prisma client is passed', async () => {
    await expect(
      buildAccountVoucherHeaderUpdateInput(
        prisma as unknown as PrismaService,
        makeRecord().avhVoucherId,
        makeUpdatePayload(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when updating a voucher header that does not exist or is deleted', async () => {
    tx.accVoucherHeader.findFirst.mockResolvedValue(null);

    await expect(
      updateAccountVoucherHeader(
        tx as unknown as Prisma.TransactionClient,
        makeRecord().avhVoucherId,
        makeUpdatePayload(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('soft deletes a voucher header and marks it cancelled', async () => {
    const existing = makeRecord();
    const deleted = makeRecord({
      avhIsActive: false,
      avhIsDeleted: true,
      avhVoucherStatus: VoucherStatus.CANCELLED,
      avhStatusOn: new Date('2026-03-28T12:00:00.000Z'),
      avhStatusBy: USER_ID,
      avhCancelReason: 'Duplicate voucher',
      avhUpdatedOn: new Date('2026-03-28T12:00:00.000Z'),
      avhUpdatedBy: USER_ID,
    });

    tx.accVoucherHeader.findFirst.mockResolvedValue(existing);
    tx.accVoucherHeader.update.mockResolvedValue(deleted);

    const result = await softDeleteAccountVoucherHeader(
      prisma as unknown as PrismaService,
      existing.avhVoucherId,
      {
        avhUpdatedBy: USER_ID,
        avhCancelReason: 'Duplicate voucher',
      },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.accVoucherHeader.update).toHaveBeenCalledWith({
      where: {
        avhVoucherId: existing.avhVoucherId,
      },
      data: expect.objectContaining({
        avhIsActive: false,
        avhIsDeleted: true,
        avhVoucherStatus: VoucherStatus.CANCELLED,
        avhStatusOn: expect.any(Date),
        avhStatusBy: USER_ID,
        avhCancelReason: 'Duplicate voucher',
        avhUpdatedOn: expect.any(Date),
        avhUpdatedBy: USER_ID,
      }),
    });
    expect(result.avhIsDeleted).toBe(true);
    expect(result.avhVoucherStatus).toBe(VoucherStatus.CANCELLED);
  });
});
