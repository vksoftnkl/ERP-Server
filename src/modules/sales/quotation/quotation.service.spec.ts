import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AccVoucherSeq,
  Prisma,
  TransactionChargeDetail,
  SaleQuotation,
  SaleQuotationItem,
} from '@prisma/client';
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
const LINE_A_ID = '019c6f6c-be87-7a11-8905-36092c46fe10';
const LINE_B_ID = '019c6f6c-be87-7a11-8905-36092c46fe11';
const ITEM_MASTER_ID = '019c6f6c-be87-7a11-8905-36092c46fe12';
const ITEM_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fe13';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46fe0b';
const SALESMAN_ID = '019c6f6c-be87-7a11-8905-36092c46fe0c';
const AGENT_ID = '019c6f6c-be87-7a11-8905-36092c46fe0d';
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

const makeCharge = (overrides: Partial<TransactionChargeDetail> = {}): TransactionChargeDetail =>
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
  }) as TransactionChargeDetail;

const makeItem = (overrides: Partial<SaleQuotationItem> = {}): SaleQuotationItem =>
  ({
    sqiId: LINE_A_ID,
    sqiQuoteId: QUOTE_ID,
    sqiCompanyId: COMPANY_ID,
    sqiBranchId: BRANCH_ID,
    sqiTenantId: TENANT_ID,
    sqiAccYear: ACC_YEAR,
    sqiLineNo: 1,
    sqiItemId: ITEM_MASTER_ID,
    sqiItemUnitId: ITEM_UNIT_ID,
    sqiPriceLevel: 1,
    sqiIsDeleted: false,
    sqiSyncDate: null,
    sqiCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    sqiCreatedBy: USER_ID,
    sqiModifiedOn: null,
    sqiModifiedBy: null,
    ...overrides,
  }) as unknown as SaleQuotationItem;

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
type ItemCreateArgs = { data: Prisma.SaleQuotationItemUncheckedCreateInput };
type ItemUpdateArgs = {
  where: { sqiId: string };
  data: Prisma.SaleQuotationItemUncheckedUpdateInput;
};
type ChargeCreateArgs = { data: Prisma.TransactionChargeDetailUncheckedCreateInput };
type ChargeUpdateArgs = {
  where: { cdId_cdAccYear: { cdId: string; cdAccYear: string } };
  data: Prisma.TransactionChargeDetailUncheckedUpdateInput;
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
    findMany: jest.Mock<Promise<SaleQuotationItem[]>, unknown[]>;
    create: jest.Mock<Promise<SaleQuotationItem>, [ItemCreateArgs]>;
    update: jest.Mock<Promise<SaleQuotationItem>, [ItemUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  transactionChargeDetail: {
    findMany: jest.Mock<Promise<TransactionChargeDetail[]>, unknown[]>;
    create: jest.Mock<Promise<TransactionChargeDetail>, [ChargeCreateArgs]>;
    update: jest.Mock<Promise<TransactionChargeDetail>, [ChargeUpdateArgs]>;
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
  // sq_agent_id has no FK, so getById resolves the agent name on its own.
  saleAgent: {
    findUnique: jest.Mock<Promise<{ saName: string } | null>, unknown[]>;
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
      findMany: jest.fn(() => Promise.resolve([] as SaleQuotationItem[])),
      create: jest.fn(({ data }: ItemCreateArgs) =>
        Promise.resolve(makeItem(data as unknown as Partial<SaleQuotationItem>)),
      ),
      update: jest.fn(({ where, data }: ItemUpdateArgs) =>
        Promise.resolve(
          makeItem({
            ...(data as unknown as Partial<SaleQuotationItem>),
            sqiId: where.sqiId,
          }),
        ),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    transactionChargeDetail: {
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn(({ data }: ChargeCreateArgs) =>
        Promise.resolve(makeCharge(data as unknown as Partial<TransactionChargeDetail>)),
      ),
      update: jest.fn(({ where, data }: ChargeUpdateArgs) =>
        Promise.resolve(
          makeCharge({
            ...(data as unknown as Partial<TransactionChargeDetail>),
            cdId: where.cdId_cdAccYear.cdId,
            cdAccYear: where.cdId_cdAccYear.cdAccYear,
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
    saleAgent: {
      findUnique: jest.fn(() => Promise.resolve({ saName: 'Agent One' })),
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

    expect(prisma.transactionChargeDetail.create).toHaveBeenCalledTimes(1);
    expect(prisma.transactionChargeDetail.create.mock.calls[0][0].data).toMatchObject({
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
      expect.objectContaining({ tableName: 'txn_charge_detail', action: 'New' }),
      expect.anything(),
    );
  });

  it('leaves existing charges untouched when the charges property is omitted', async () => {
    prisma.transactionChargeDetail.findMany.mockResolvedValue([makeCharge()]);

    const payload = await service.save(baseDto({ sqId: QUOTE_ID }));

    expect(prisma.transactionChargeDetail.create).not.toHaveBeenCalled();
    expect(prisma.transactionChargeDetail.update).not.toHaveBeenCalled();
    expect(payload.charges).toHaveLength(1);
  });

  it('updates a charge carrying cdId, creates one without, and soft deletes the omitted rest', async () => {
    prisma.transactionChargeDetail.findMany.mockResolvedValue([
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

    expect(prisma.transactionChargeDetail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdId_cdAccYear: { cdId: CD_ID, cdAccYear: ACC_YEAR } },
        data: containing({ cdSlno: 1, cdAmount: 750 }),
      }),
    );
    expect(prisma.transactionChargeDetail.create).toHaveBeenCalledTimes(1);
    expect(prisma.transactionChargeDetail.create.mock.calls[0][0].data).toMatchObject({
      cdSlno: 2,
      cdChgName: 'Packing',
    });
    // OTHER_CD_ID was absent from the payload → soft deleted.
    expect(prisma.transactionChargeDetail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdId_cdAccYear: { cdId: OTHER_CD_ID, cdAccYear: ACC_YEAR } },
        data: containing({ cdIsDeleted: true }),
      }),
    );
  });

  it('rejects a cdId that does not belong to this quotation', async () => {
    prisma.transactionChargeDetail.findMany.mockResolvedValue([]);

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
    expect(prisma.transactionChargeDetail.create).not.toHaveBeenCalled();
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
    prisma.transactionChargeDetail.findMany.mockResolvedValue([makeCharge({ cdBeforeTax: true })]);

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
    prisma.transactionChargeDetail.findMany.mockResolvedValue([makeCharge()]);

    const payload = await service.getById(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    expect(prisma.transactionChargeDetail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdDocType: 'QUOTATION', cdDocId: QUOTE_ID, cdIsDeleted: false },
        orderBy: { cdSlno: 'asc' },
      }),
    );
    expect(payload.charges?.[0].cdVoucherNo).toBe('42');
    expect(payload.charges?.[0].cdCreatedOn).toBe('2026-07-28T10:00:00.000Z');
  });

  it('resolves the area, salesman and agent names on getById', async () => {
    prisma.saleQuotation.findFirst.mockResolvedValue(
      makeQuotation({
        sqCustAreaId: AREA_ID,
        sqSalesmanId: SALESMAN_ID,
        sqAgentId: AGENT_ID,
        custArea: { armName: 'North Zone', armDistanceKm: 12 },
        salesman: { empName: 'Ravi Kumar' },
      } as unknown as Partial<SaleQuotation>),
    );

    const payload = await service.getById(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    expect(prisma.saleQuotation.findFirst).toHaveBeenCalledWith(
      containing({
        include: containing({
          custArea: { select: { armName: true, armDistanceKm: true } },
          salesman: { select: { empName: true } },
        }),
      }),
    );
    // sq_agent_id has no FK, so its name comes from a separate lookup.
    expect(prisma.saleAgent.findUnique).toHaveBeenCalledWith({
      where: { saId: AGENT_ID },
      select: { saName: true },
    });
    expect(payload.sqCustAreaName).toBe('North Zone');
    expect(payload.sqCustAreaDistanceKm).toBe(12);
    expect(payload.sqSalesmanName).toBe('Ravi Kumar');
    expect(payload.sqAgentName).toBe('Agent One');
    // The joined relations themselves must not leak into the payload.
    expect(payload).not.toHaveProperty('custArea');
    expect(payload).not.toHaveProperty('salesman');
    expect(payload).not.toHaveProperty('agent');
  });

  it('leaves the master names null when the header carries no area/salesman/agent', async () => {
    const payload = await service.getById(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    expect(prisma.saleAgent.findUnique).not.toHaveBeenCalled();
    expect(payload.sqCustAreaName).toBeNull();
    expect(payload.sqCustAreaDistanceKm).toBeNull();
    expect(payload.sqSalesmanName).toBeNull();
    expect(payload.sqAgentName).toBeNull();
  });

  it('resolves the item and unit master attributes on each line on getById', async () => {
    const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46fe20';
    const BRAND_ID = '019c6f6c-be87-7a11-8905-36092c46fe21';
    const SECTION_ID = '019c6f6c-be87-7a11-8905-36092c46fe22';
    const CATEGORY_ID = '019c6f6c-be87-7a11-8905-36092c46fe23';
    prisma.saleQuotation.findFirst.mockResolvedValue(
      makeQuotation({
        items: [
          {
            ...makeItem(),
            item: {
              itemNameEn: 'Cement OPC 53',
              itemBatchConfig: 2,
              itemGroupId: GROUP_ID,
              itemBrandId: BRAND_ID,
              itemSectionId: SECTION_ID,
              itemCategoryId: CATEGORY_ID,
            },
            itemUnitConversion: { unit: { unit_name: 'BAG', unit_decimal_count: 3 } },
          },
        ],
      } as unknown as Partial<SaleQuotation>),
    );

    const payload = await service.getById(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    const line = payload.items?.[0];
    expect(line?.sqiItemName).toBe('Cement OPC 53');
    expect(line?.sqiUnitName).toBe('BAG');
    expect(line?.sqiDecimalCount).toBe(3);
    expect(line?.sqiBatchConfig).toBe(2);
    expect(line?.sqiGroupId).toBe(GROUP_ID);
    expect(line?.sqiBrandId).toBe(BRAND_ID);
    expect(line?.sqiSectionId).toBe(SECTION_ID);
    expect(line?.sqiCategoryId).toBe(CATEGORY_ID);
    // The joined relations themselves must not leak into the line payload.
    expect(line).not.toHaveProperty('item');
    expect(line).not.toHaveProperty('itemUnitConversion');
  });

  it('leaves the line master attributes null when the item/unit joins came back empty', async () => {
    prisma.saleQuotation.findFirst.mockResolvedValue(
      makeQuotation({ items: [makeItem()] } as unknown as Partial<SaleQuotation>),
    );

    const line = (await service.getById(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).items?.[0];

    expect(line?.sqiDecimalCount).toBeNull();
    expect(line?.sqiBatchConfig).toBeNull();
    expect(line?.sqiGroupId).toBeNull();
    expect(line?.sqiBrandId).toBeNull();
    expect(line?.sqiSectionId).toBeNull();
    expect(line?.sqiCategoryId).toBeNull();
  });

  it("logs soft deletes as 'cancel', the action audit.audit_log_action actually has", async () => {
    prisma.saleQuotationItem.findMany.mockResolvedValue([
      makeItem({ sqiId: LINE_A_ID, sqiLineNo: 1 }),
    ]);
    prisma.transactionChargeDetail.findMany.mockResolvedValue([makeCharge()]);

    // Drops the line and the charge, then retires the header.
    await service.save(baseDto({ sqId: QUOTE_ID, items: [], charges: [] }));
    await service.softDelete(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    // 'delete' is not a member of the enum: AuditLogService.normalizeAction
    // answers 400 'Unsupported audit action: delete' instead of writing the row,
    // which failed the whole save it was logging.
    const auditActions = (auditLogService.logEntityChange.mock.calls as [{ action: string }][]).map(
      ([entry]) => entry.action,
    );
    expect(auditActions).toContain('cancel');
    expect(auditActions).not.toContain('delete');
  });

  it('cascades the header soft delete to the applied charges', async () => {
    await service.softDelete(QUOTE_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    expect(prisma.transactionChargeDetail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cdDocType: 'QUOTATION', cdDocId: QUOTE_ID, cdIsDeleted: false },
        data: containing({ cdIsDeleted: true }),
      }),
    );
  });
});

// ux_sqi_quote_line is unique on (sqi_quote_id, sqi_line_no) over the ACTIVE
// lines, so an update that writes the payload before retiring what it replaces
// collides with itself. These cover the ordering that keeps it from happening.
describe('QuotationService — line item reconciliation on update', () => {
  let service: QuotationService;
  let prisma: PrismaMock;

  const activeLines = () => [
    makeItem({ sqiId: LINE_A_ID, sqiLineNo: 1 }),
    makeItem({ sqiId: LINE_B_ID, sqiLineNo: 2 }),
  ];
  const newLine = () => ({ sqiItemId: ITEM_MASTER_ID, sqiItemUnitId: ITEM_UNIT_ID });
  const firstCallOrder = (mock: jest.Mock): number => mock.mock.invocationCallOrder[0];
  const lastCallOrder = (mock: jest.Mock): number =>
    mock.mock.invocationCallOrder[mock.mock.invocationCallOrder.length - 1];

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new QuotationService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn(() => Promise.resolve(undefined)) } as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  it('retires the replaced lines before inserting a re-posted grid, freeing their line numbers', async () => {
    prisma.saleQuotationItem.findMany.mockResolvedValue(activeLines());

    await service.save(baseDto({ sqId: QUOTE_ID, items: [newLine(), newLine()] }));

    // sale_quotation_item is partitioned by sqi_acc_year, so a line is
    // addressed by the (id, year) pair its primary key now is.
    expect(prisma.saleQuotationItem.update).toHaveBeenCalledWith(
      containing({
        where: { sqiId_sqiAccYear: { sqiId: LINE_A_ID, sqiAccYear: ACC_YEAR } },
        data: containing({ sqiIsDeleted: true }),
      }),
    );
    expect(prisma.saleQuotationItem.update).toHaveBeenCalledWith(
      containing({
        where: { sqiId_sqiAccYear: { sqiId: LINE_B_ID, sqiAccYear: ACC_YEAR } },
        data: containing({ sqiIsDeleted: true }),
      }),
    );
    // Both soft deletes land before the first insert reuses line number 1.
    expect(lastCallOrder(prisma.saleQuotationItem.update)).toBeLessThan(
      firstCallOrder(prisma.saleQuotationItem.create),
    );
    expect(prisma.saleQuotationItem.create.mock.calls.map(([{ data }]) => data.sqiLineNo)).toEqual([
      1, 2,
    ]);
  });

  it('parks the surviving lines above every requested number when the payload reorders them', async () => {
    prisma.saleQuotationItem.findMany.mockResolvedValue(activeLines());

    await service.save(
      baseDto({
        sqId: QUOTE_ID,
        items: [
          { ...newLine(), sqiId: LINE_B_ID, sqiLineNo: 1 },
          { ...newLine(), sqiId: LINE_A_ID, sqiLineNo: 2 },
        ],
      }),
    );

    // Swapping 1 and 2 renumbers through a state where both rows want the same
    // number unless they are moved out of the index's way first.
    expect(prisma.saleQuotationItem.updateMany).toHaveBeenCalledWith({
      where: { sqiId: { in: [LINE_B_ID, LINE_A_ID] }, sqiAccYear: ACC_YEAR },
      data: { sqiLineNo: { increment: 3 } },
    });
    expect(firstCallOrder(prisma.saleQuotationItem.updateMany)).toBeLessThan(
      firstCallOrder(prisma.saleQuotationItem.update),
    );
  });

  it('skips the parking pass when the payload keeps every line where it is', async () => {
    prisma.saleQuotationItem.findMany.mockResolvedValue(activeLines());

    await service.save(
      baseDto({
        sqId: QUOTE_ID,
        items: [
          { ...newLine(), sqiId: LINE_A_ID, sqiLineNo: 1 },
          { ...newLine(), sqiId: LINE_B_ID, sqiLineNo: 2 },
        ],
      }),
    );

    expect(prisma.saleQuotationItem.updateMany).not.toHaveBeenCalled();
  });

  it('reports a line-number clash as one rather than as a duplicate reference number', async () => {
    prisma.saleQuotationItem.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: 'ux_sqi_quote_line' },
      }),
    );

    const error = (await service
      .save(baseDto({ sqId: QUOTE_ID, items: [newLine()] }))
      .catch((caught: unknown) => caught)) as ConflictException;

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual(
      containing({
        message: 'Duplicate quotation line number is not allowed',
        errors: [containing({ field: 'sqiLineNo' })],
      }),
    );
  });

  // sale_quotation_item is partitioned, so Postgres blames the PARTITION's
  // index — an auto-generated, truncated name that contains neither
  // "ux_sqi_quote_line" nor anything else worth matching on. The service asks
  // pg_inherits which parent index it belongs to before deciding.
  it('resolves a partition-local index name back to the parent index it belongs to', async () => {
    const partitionIndex = 'sale_quotation_item_2026_2027_sqi_quote_id_sqi_acc_year_sqi_idx';
    prisma.$queryRaw.mockResolvedValue([{ parentIndex: 'ux_sqi_quote_line' }]);
    prisma.saleQuotationItem.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: partitionIndex },
      }),
    );

    const error = (await service
      .save(baseDto({ sqId: QUOTE_ID, items: [newLine()] }))
      .catch((caught: unknown) => caught)) as ConflictException;

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual(
      containing({
        message: 'Duplicate quotation line number is not allowed',
        errors: [containing({ field: 'sqiLineNo' })],
      }),
    );
  });

  it('never renumbers the quotation on update — the refno and slno stay put', async () => {
    prisma.saleQuotationItem.findMany.mockResolvedValue(activeLines());

    await service.save(baseDto({ sqId: QUOTE_ID, sqQuoteRefno: 'CLIENT-1', items: [newLine()] }));

    // No number is drawn from the sequence, and the client's refno is dropped
    // rather than written over the one the quotation was created with.
    expect(prisma.accVoucherSeq.update).not.toHaveBeenCalled();
    const [[updateArgs]] = prisma.saleQuotation.update.mock.calls as unknown as [
      [{ data: Record<string, unknown> }],
    ];
    expect(updateArgs.data).not.toHaveProperty('sqQuoteRefno');
    expect(updateArgs.data).not.toHaveProperty('sqQuoteSlno');
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

  // sq_quote_slno is bigint. Handing the raw bigint back made res.json() throw
  // once the save transaction had already committed, so the caller saw a 500 for
  // a quotation that was written — the payload has to survive JSON.stringify.
  it('serializes sqQuoteSlno as a string so the response is JSON-encodable', async () => {
    const payload = await service.save(baseDto());

    expect(payload.sqQuoteSlno).toBe('42');
    expect(() => JSON.stringify(payload)).not.toThrow();
  });
});
