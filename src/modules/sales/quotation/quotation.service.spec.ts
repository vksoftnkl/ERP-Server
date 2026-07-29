import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccVoucherSeq, Prisma, SaleChargeDetail, SaleQuotation } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ChargeMethod } from '../../master/charge-master/types/charge-enum';
import { QuotationService } from './quotation.service';
import { SaveQuotationDto } from './dto/save-quotation.dto';

const QUOTE_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const TENANT_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const CHARGE_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fe07';
const CD_ID = '019c6f6c-be87-7a11-8905-36092c46fe08';
const OTHER_CD_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const SEQ_ID = '019c6f6c-be87-7a11-8905-36092c46fe0a';
const ACC_YEAR = '2026-2027';
// The quotation voucher type, and the counter it stands at before a save: the
// next quotation therefore takes number 42 → 'quo00042'.
const QUOTATION_VCHR_TYPE_ID = 21;
const SEQ_LAST_NO = 41n;

const makeSequence = (overrides: Partial<AccVoucherSeq> = {}): AccVoucherSeq =>
  ({
    id: SEQ_ID,
    vchrTypeId: QUOTATION_VCHR_TYPE_ID,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    accYear: ACC_YEAR,
    deviceId: null,
    deviceCode: 'MAIN',
    periodKey: ACC_YEAR,
    lastNo: SEQ_LAST_NO,
    voucherPrefix: 'quo',
    companyCode: 'ABC123',
    branchCode: null,
    voucherSuffix: null,
    noWidth: 5,
    lastRefno: null,
    isActive: true,
    isDeleted: false,
    createdOn: new Date('2026-07-28T10:00:00.000Z'),
    createdBy: null,
    modifiedOn: null,
    modifiedBy: null,
    ...overrides,
  }) as AccVoucherSeq;

const makeQuotation = (overrides: Partial<SaleQuotation> = {}): SaleQuotation =>
  ({
    sqId: QUOTE_ID,
    sqCompanyId: COMPANY_ID,
    sqBranchId: BRANCH_ID,
    sqTenantId: TENANT_ID,
    sqAccYear: ACC_YEAR,
    sqPriceLevel: 1,
    sqQuoteSlno: 42n,
    sqQuoteRefno: 'Q-1',
    sqCustName: 'Acme',
    sqUserId: USER_ID,
    sqStatus: 'DRAFT',
    sqIsDeleted: false,
    sqCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    sqCreatedBy: USER_ID,
    sqModifiedOn: null,
    sqModifiedBy: null,
    sqQuoteDatetime: new Date('2026-07-28T10:00:00.000Z'),
    sqSyncDate: null,
    ...overrides,
  }) as unknown as SaleQuotation;

const makeCharge = (overrides: Partial<SaleChargeDetail> = {}): SaleChargeDetail =>
  ({
    cdId: CD_ID,
    cdDocType: 'QUOTATION',
    cdDocId: QUOTE_ID,
    cdSlno: 1,
    cdCompId: COMPANY_ID,
    cdBranchId: BRANCH_ID,
    cdAccYear: ACC_YEAR,
    cdVoucherNo: 42n,
    cdChgId: CHARGE_ID,
    cdChgName: 'Freight',
    cdRole: 'FREIGHT',
    cdMethod: 'FIXED',
    cdType: 'ADD',
    cdApplyOn: 'FLAT',
    cdLedgerCode: LEDGER_ID,
    cdLandingCost: false,
    cdCostAlloc: null,
    cdBeforeTax: false,
    cdTaxApl: false,
    cdSepPost: false,
    cdUnit: null,
    cdQtyVal: null,
    cdWeight: null,
    cdRate: new Prisma.Decimal('0.0000'),
    cdAmount: new Prisma.Decimal('500.0000'),
    cdTaxCode: null,
    cdHsn: null,
    cdTaxPerc: null,
    cdTaxAmt: null,
    cdSgstPerc: null,
    cdSgstAmt: null,
    cdCgstPerc: null,
    cdCgstAmt: null,
    cdIgstPerc: null,
    cdIgstAmt: null,
    cdCessPerc: null,
    cdCessAmt: null,
    cdNetAmt: new Prisma.Decimal('500.0000'),
    cdRemarks: null,
    cdIsActive: true,
    cdIsDeleted: false,
    cdSyncDate: null,
    cdCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    cdCreatedBy: USER_ID,
    cdModifiedOn: null,
    cdModifiedBy: null,
    ...overrides,
  }) as SaleChargeDetail;

const baseDto = (overrides: Partial<SaveQuotationDto> = {}): SaveQuotationDto =>
  ({
    sqCompanyId: COMPANY_ID,
    sqBranchId: BRANCH_ID,
    sqTenantId: TENANT_ID,
    sqAccYear: ACC_YEAR,
    sqPriceLevel: 1,
    sqQuoteSlno: 42,
    sqQuoteRefno: 'Q-1',
    sqCustName: 'Acme',
    sqUserId: USER_ID,
    ...overrides,
  }) as SaveQuotationDto;

type QuotationCreateArgs = { data: Prisma.SaleQuotationUncheckedCreateInput };
type ChargeCreateArgs = { data: Prisma.SaleChargeDetailUncheckedCreateInput };
type ChargeUpdateArgs = {
  where: { cdId: string };
  data: Prisma.SaleChargeDetailUncheckedUpdateInput;
};
type SequenceUpdateArgs = {
  where: { id: string };
  data: Prisma.AccVoucherSeqUncheckedUpdateInput;
};

type PrismaMock = {
  saleQuotation: {
    create: jest.Mock<Promise<SaleQuotation>, [QuotationCreateArgs]>;
    findFirst: jest.Mock<Promise<SaleQuotation | null>, unknown[]>;
    update: jest.Mock<Promise<SaleQuotation>, unknown[]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  saleQuotationItem: {
    findMany: jest.Mock<Promise<never[]>, unknown[]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  saleChargeDetail: {
    findMany: jest.Mock<Promise<SaleChargeDetail[]>, unknown[]>;
    create: jest.Mock<Promise<SaleChargeDetail>, [ChargeCreateArgs]>;
    update: jest.Mock<Promise<SaleChargeDetail>, [ChargeUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  // Reached through allocateVoucherNumber on the create path.
  accVoucherType: {
    findFirst: jest.Mock<Promise<unknown>, unknown[]>;
  };
  accVoucherSeq: {
    findFirst: jest.Mock<Promise<AccVoucherSeq | null>, unknown[]>;
    create: jest.Mock<Promise<AccVoucherSeq>, [{ data: Prisma.AccVoucherSeqUncheckedCreateInput }]>;
    update: jest.Mock<Promise<AccVoucherSeq>, [SequenceUpdateArgs]>;
  };
  company: {
    findFirst: jest.Mock<Promise<{ compCode: string | null } | null>, unknown[]>;
  };
  branchMaster: {
    findFirst: jest.Mock<Promise<{ brCode: string | null } | null>, unknown[]>;
  };
  $queryRaw: jest.Mock<Promise<unknown>, unknown[]>;
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

// expect.objectContaining() is typed `any`; wrapping it keeps the nested
// matchers below out of no-unsafe-assignment's way.
const containing = (value: Record<string, unknown>): unknown => expect.objectContaining(value);

const makePrismaMock = (): PrismaMock => {
  const prisma: PrismaMock = {
    saleQuotation: {
      // Prisma accepts a number for a BigInt column on write but always reads
      // one back as a bigint — the scope the charge lines inherit.
      create: jest.fn(({ data }: QuotationCreateArgs) =>
        Promise.resolve(
          makeQuotation({
            ...(data as unknown as Partial<SaleQuotation>),
            sqQuoteSlno: BigInt(data.sqQuoteSlno as number),
          }),
        ),
      ),
      findFirst: jest.fn(() => Promise.resolve(makeQuotation())),
      update: jest.fn(() => Promise.resolve(makeQuotation())),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    saleQuotationItem: {
      findMany: jest.fn(() => Promise.resolve([])),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    saleChargeDetail: {
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn(({ data }: ChargeCreateArgs) =>
        Promise.resolve(makeCharge(data as unknown as Partial<SaleChargeDetail>)),
      ),
      update: jest.fn(({ where, data }: ChargeUpdateArgs) =>
        Promise.resolve(
          makeCharge({
            ...(data as unknown as Partial<SaleChargeDetail>),
            cdId: where.cdId,
          }),
        ),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    accVoucherType: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          vchrTypeId: QUOTATION_VCHR_TYPE_ID,
          vchrNoPrefix: 'quo',
          vchrNoSuffix: null,
          vchrNoWidth: 5,
          vchrResetFreq: 'YEARLY',
        }),
      ),
    },
    accVoucherSeq: {
      findFirst: jest.fn(() => Promise.resolve(makeSequence())),
      create: jest.fn(({ data }: { data: Prisma.AccVoucherSeqUncheckedCreateInput }) =>
        Promise.resolve(makeSequence(data as unknown as Partial<AccVoucherSeq>)),
      ),
      // Mirrors Postgres: the first call increments the counter and returns the
      // consumed number, the second only stamps the printable refno onto it.
      update: jest.fn(({ data }: SequenceUpdateArgs) => {
        const increment = (data.lastNo as { increment?: number } | undefined)?.increment;
        return Promise.resolve(
          makeSequence(
            increment === undefined
              ? { lastRefno: data.lastRefno as string }
              : { lastNo: SEQ_LAST_NO + BigInt(increment) },
          ),
        );
      }),
    },
    company: {
      findFirst: jest.fn(() => Promise.resolve({ compCode: 'ABC123' })),
    },
    branchMaster: {
      findFirst: jest.fn(() => Promise.resolve({ brCode: null })),
    },
    $queryRaw: jest.fn(() => Promise.resolve([{ locked: 1 }])),
    $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
  };
  return prisma;
};

describe('QuotationService — applied charges', () => {
  let service: QuotationService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };

  beforeEach(() => {
    prisma = makePrismaMock();
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    service = new QuotationService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  it('creates charge lines under the QUOTATION discriminator, defaulting the parent scope', async () => {
    await service.save(
      baseDto({
        charges: [{ cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdChgName: 'Freight' }],
      }),
    );

    expect(prisma.saleChargeDetail.create).toHaveBeenCalledTimes(1);
    expect(prisma.saleChargeDetail.create.mock.calls[0][0].data).toMatchObject({
      cdDocType: 'QUOTATION',
      cdDocId: QUOTE_ID,
      cdSlno: 1,
      cdCompId: COMPANY_ID,
      cdBranchId: BRANCH_ID,
      cdAccYear: ACC_YEAR,
      cdVoucherNo: 42n,
      cdChgId: CHARGE_ID,
      cdLedgerCode: LEDGER_ID,
      cdChgName: 'Freight',
    });
    expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'sale_charge_detail', action: 'New' }),
      expect.anything(),
    );
  });

  it('leaves existing charges untouched when the charges property is omitted', async () => {
    prisma.saleChargeDetail.findMany.mockResolvedValue([makeCharge()]);

    const payload = await service.save(baseDto({ sqId: QUOTE_ID }));

    expect(prisma.saleChargeDetail.create).not.toHaveBeenCalled();
    expect(prisma.saleChargeDetail.update).not.toHaveBeenCalled();
    expect(payload.charges).toHaveLength(1);
  });

  it('updates a charge carrying cdId, creates one without, and soft deletes the omitted rest', async () => {
    prisma.saleChargeDetail.findMany.mockResolvedValue([
      makeCharge(),
      makeCharge({ cdId: OTHER_CD_ID, cdSlno: 2, cdChgName: 'Loading' }),
    ]);

    await service.save(
      baseDto({
        sqId: QUOTE_ID,
        charges: [
          { cdId: CD_ID, cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdAmount: 750 },
          { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdChgName: 'Packing' },
        ],
      }),
    );

    expect(prisma.saleChargeDetail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdId: CD_ID },
        data: containing({ cdSlno: 1, cdAmount: 750 }),
      }),
    );
    expect(prisma.saleChargeDetail.create).toHaveBeenCalledTimes(1);
    expect(prisma.saleChargeDetail.create.mock.calls[0][0].data).toMatchObject({
      cdSlno: 2,
      cdChgName: 'Packing',
    });
    // OTHER_CD_ID was absent from the payload → soft deleted.
    expect(prisma.saleChargeDetail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdId: OTHER_CD_ID },
        data: containing({ cdIsDeleted: true }),
      }),
    );
  });

  it('rejects a cdId that does not belong to this quotation', async () => {
    prisma.saleChargeDetail.findMany.mockResolvedValue([]);

    await expect(
      service.save(
        baseDto({
          sqId: QUOTE_ID,
          charges: [{ cdId: CD_ID, cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID }],
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate cdSlno within one payload', async () => {
    await expect(
      service.save(
        baseDto({
          charges: [
            { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdSlno: 1 },
            { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdSlno: 1 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a value outside the ck_cd_method set before it reaches Postgres', async () => {
    // Forced past ChargeMethod: the DTO's @IsEnum stops this on the HTTP path,
    // this asserts the service guard catches it for any other caller.
    const notAMethod = 'SLAB' as unknown as ChargeMethod;
    await expect(
      service.save(
        baseDto({
          charges: [{ cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdMethod: notAMethod }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.saleChargeDetail.create).not.toHaveBeenCalled();
  });

  it('rejects cdTaxApl together with cdBeforeTax (ck_cd_tax_apl)', async () => {
    await expect(
      service.save(
        baseDto({
          charges: [
            { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdTaxApl: true, cdBeforeTax: true },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('judges the merged row on update, so a stored flag still trips ck_cd_tax_apl', async () => {
    prisma.saleChargeDetail.findMany.mockResolvedValue([makeCharge({ cdBeforeTax: true })]);

    await expect(
      service.save(
        baseDto({
          sqId: QUOTE_ID,
          charges: [{ cdId: CD_ID, cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdTaxApl: true }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the active charges on getById with cdVoucherNo serialized as a string', async () => {
    prisma.saleChargeDetail.findMany.mockResolvedValue([makeCharge()]);

    const payload = await service.getById(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    expect(prisma.saleChargeDetail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdDocType: 'QUOTATION', cdDocId: QUOTE_ID, cdIsDeleted: false },
        orderBy: { cdSlno: 'asc' },
      }),
    );
    expect(payload.charges?.[0].cdVoucherNo).toBe('42');
    expect(payload.charges?.[0].cdCreatedOn).toBe('2026-07-28T10:00:00.000Z');
  });

  it('cascades the header soft delete to the applied charges', async () => {
    await service.softDelete(QUOTE_ID);

    expect(prisma.saleChargeDetail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdDocType: 'QUOTATION', cdDocId: QUOTE_ID, cdIsDeleted: false },
        data: containing({ cdIsDeleted: true }),
      }),
    );
  });
});

describe('QuotationService — quotation numbering', () => {
  let service: QuotationService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new QuotationService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn(() => Promise.resolve(undefined)) } as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  it('numbers a new quotation from the voucher type 21 sequence', async () => {
    await service.save(baseDto({ sqQuoteSlno: undefined, sqQuoteRefno: undefined }));

    expect(prisma.accVoucherSeq.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vchrTypeId: QUOTATION_VCHR_TYPE_ID,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          accYear: ACC_YEAR,
          deviceCode: 'MAIN',
          // YEARLY reset → the accounting year is the period bucket.
          periodKey: ACC_YEAR,
        },
      }),
    );
    expect(prisma.saleQuotation.create.mock.calls[0][0].data).toMatchObject({
      sqQuoteSlno: 42n,
      sqQuoteRefno: 'quo00042',
    });
  });

  it('consumes the number atomically and stamps it back as the sequence last refno', async () => {
    await service.save(baseDto());

    expect(prisma.accVoucherSeq.update).toHaveBeenNthCalledWith(1, {
      where: { id: SEQ_ID },
      data: { lastNo: { increment: 1 } },
    });
    expect(prisma.accVoucherSeq.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: SEQ_ID },
        data: containing({ lastRefno: 'quo00042' }),
      }),
    );
  });

  it('ignores a client-supplied slno and refno — voucher type 21 forbids manual numbers', async () => {
    await service.save(baseDto({ sqQuoteSlno: 7, sqQuoteRefno: 'HAND-WRITTEN' }));

    expect(prisma.saleQuotation.create.mock.calls[0][0].data).toMatchObject({
      sqQuoteSlno: 42n,
      sqQuoteRefno: 'quo00042',
    });
  });

  it('creates the sequence row on first use, seeded from the voucher type format', async () => {
    prisma.accVoucherSeq.findFirst.mockResolvedValue(null);

    await service.save(baseDto());

    expect(prisma.accVoucherSeq.create.mock.calls[0][0].data).toMatchObject({
      vchrTypeId: QUOTATION_VCHR_TYPE_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: ACC_YEAR,
      deviceCode: 'MAIN',
      periodKey: ACC_YEAR,
      lastNo: 0n,
      voucherPrefix: 'quo',
      voucherSuffix: null,
      noWidth: 5,
      companyCode: 'ABC123',
      branchCode: null,
    });
  });

  it('refuses to number against a deactivated sequence rather than silently reviving it', async () => {
    prisma.accVoucherSeq.findFirst.mockResolvedValue(makeSequence({ isActive: false }));

    await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.saleQuotation.create).not.toHaveBeenCalled();
  });

  it('leaves the number alone on update — the refno is immutable after create', async () => {
    await service.save(baseDto({ sqId: QUOTE_ID, sqQuoteRefno: 'HAND-WRITTEN' }));

    expect(prisma.accVoucherSeq.update).not.toHaveBeenCalled();
    const { data } = prisma.saleQuotation.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data).not.toHaveProperty('sqQuoteRefno');
    expect(data).not.toHaveProperty('sqQuoteSlno');
  });
});
