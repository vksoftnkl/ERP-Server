import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AccTenderDetail,
  AccVoucherSeq,
  Prisma,
  SaleBill,
  SaleBillItem,
  SaleChargeDetail,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { BillService } from './bill.service';
import { SaveBillDto } from './dto/save-bill.dto';

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fa01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fa02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fa03';
const TENANT_ID = '019c6f6c-be87-7a11-8905-36092c46fa04';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fa05';
const COUNTER_ID = '019c6f6c-be87-7a11-8905-36092c46fa06';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46fa07';
const CHARGE_ID = '019c6f6c-be87-7a11-8905-36092c46fa08';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fa09';
const CD_ID = '019c6f6c-be87-7a11-8905-36092c46fa0a';
const OTHER_CD_ID = '019c6f6c-be87-7a11-8905-36092c46fa0b';
const TENDER_ID = '019c6f6c-be87-7a11-8905-36092c46fa0c';
const TENDER_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fa0d';
const TD_ID = '019c6f6c-be87-7a11-8905-36092c46fa0e';
const OTHER_TD_ID = '019c6f6c-be87-7a11-8905-36092c46fa0f';
const LINE_A_ID = '019c6f6c-be87-7a11-8905-36092c46fa10';
const LINE_B_ID = '019c6f6c-be87-7a11-8905-36092c46fa11';
const ITEM_MASTER_ID = '019c6f6c-be87-7a11-8905-36092c46fa12';
const ITEM_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fa13';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fa14';
const STOCK_ID = '019c6f6c-be87-7a11-8905-36092c46fa15';
const SEQ_ID = '019c6f6c-be87-7a11-8905-36092c46fa16';
const ACC_YEAR = '2026-2027';
// The bill voucher type, and the counter it stands at before a save: the next
// bill therefore takes number 101 → 'bil00101'.
const BILL_VCHR_TYPE_ID = 22;
const SEQ_LAST_NO = 100n;
const BILL_SLNO = SEQ_LAST_NO + 1n;
const BILL_REFNO = 'bil00101';

const makeSequence = (overrides: Partial<AccVoucherSeq> = {}): AccVoucherSeq =>
  ({
    id: SEQ_ID,
    vchrTypeId: BILL_VCHR_TYPE_ID,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    accYear: ACC_YEAR,
    deviceId: null,
    deviceCode: 'MAIN',
    periodKey: ACC_YEAR,
    lastNo: SEQ_LAST_NO,
    voucherPrefix: 'bil',
    companyCode: 'ABC123',
    branchCode: 'BR001',
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

const makeBill = (overrides: Partial<SaleBill> = {}): SaleBill =>
  ({
    sbId: BILL_ID,
    sbCompanyId: COMPANY_ID,
    sbBranchId: BRANCH_ID,
    sbTenantId: TENANT_ID,
    sbAccYear: ACC_YEAR,
    sbCounterId: COUNTER_ID,
    sbDeviceType: 'POS',
    sbDeviceId: 'till-1',
    sbPriceLevel: 1,
    sbBillSlno: BILL_SLNO,
    sbBillRefno: BILL_REFNO,
    sbBillDate: new Date('2026-07-28T00:00:00.000Z'),
    sbCustId: CUST_ID,
    sbCustName: 'Acme',
    sbUserId: USER_ID,
    sbStatus: 'DRAFT',
    sbIsDeleted: false,
    sbCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    sbCreatedBy: USER_ID,
    sbModifiedOn: null,
    sbModifiedBy: null,
    sbBillDatetime: new Date('2026-07-28T10:00:00.000Z'),
    sbSyncDate: null,
    ...overrides,
  }) as unknown as SaleBill;

const makeCharge = (overrides: Partial<SaleChargeDetail> = {}): SaleChargeDetail =>
  ({
    cdId: CD_ID,
    cdDocType: 'INVOICE',
    cdDocId: BILL_ID,
    cdSlno: 1,
    cdCompId: COMPANY_ID,
    cdBranchId: BRANCH_ID,
    cdAccYear: ACC_YEAR,
    cdVoucherNo: 101n,
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

const makeTender = (overrides: Partial<AccTenderDetail> = {}): AccTenderDetail =>
  ({
    tdId: TD_ID,
    tdCompanyId: COMPANY_ID,
    tdBranchId: BRANCH_ID,
    tdTenantId: TENANT_ID,
    tdAccYear: ACC_YEAR,
    tdSrcModule: 'SALES',
    tdSrcDocType: 'SALE_BILL',
    tdSrcDocId: BILL_ID,
    tdRowNo: 1,
    tdDocDate: new Date('2026-07-28T00:00:00.000Z'),
    tdPartyLedgerId: CUST_ID,
    tdVoucherId: null,
    tdTenderId: TENDER_ID,
    tdTenderTypeId: 1,
    tdTenderLedgerId: TENDER_LEDGER_ID,
    tdDrCr: 'DR',
    tdAmount: new Prisma.Decimal('500.00'),
    tdSurchargePerc: new Prisma.Decimal('0.000'),
    tdSurchargeAmt: new Prisma.Decimal('0.00'),
    tdTotalAmt: new Prisma.Decimal('500.00'),
    tdReceivedAmt: new Prisma.Decimal('500.00'),
    tdChangeAmt: new Prisma.Decimal('0.00'),
    tdUnitsUsed: new Prisma.Decimal('0.0000'),
    tdConversionRate: new Prisma.Decimal('1.0000'),
    tdRefNo: null,
    tdAuthCode: null,
    tdCardLast4: null,
    tdBankName: null,
    tdPayerVpa: null,
    tdInstrumentDate: null,
    tdIsPdc: false,
    tdSettleStatus: 'NA',
    tdSettleLedgerId: null,
    tdExpectedSettleOn: null,
    tdSettledOn: null,
    tdSettleAmount: null,
    tdMdrAmt: new Prisma.Decimal('0.00'),
    tdSettleRefNo: null,
    tdSettleVoucherId: null,
    tdSessionId: null,
    tdDeviceId: 'till-1',
    tdUserId: USER_ID,
    tdNotes: null,
    tdIsDeleted: false,
    tdSyncDate: null,
    tdCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    tdCreatedBy: USER_ID,
    tdModifiedOn: null,
    tdModifiedBy: null,
    ...overrides,
  }) as AccTenderDetail;

const makeItem = (overrides: Partial<SaleBillItem> = {}): SaleBillItem =>
  ({
    sbiId: LINE_A_ID,
    sbiBillId: BILL_ID,
    sbiCompanyId: COMPANY_ID,
    sbiBranchId: BRANCH_ID,
    sbiTenantId: TENANT_ID,
    sbiAccYear: ACC_YEAR,
    sbiLineNo: 1,
    sbiSplitNo: 1,
    sbiItemId: ITEM_MASTER_ID,
    sbiItemUnitId: ITEM_UNIT_ID,
    sbiGodownId: GODOWN_ID,
    sbiStockId: STOCK_ID,
    sbiPriceLevel: 1,
    sbiIsDeleted: false,
    sbiSyncDate: null,
    sbiCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    sbiCreatedBy: USER_ID,
    sbiModifiedOn: null,
    sbiModifiedBy: null,
    ...overrides,
  }) as unknown as SaleBillItem;

const baseDto = (overrides: Partial<SaveBillDto> = {}): SaveBillDto =>
  ({
    sbCompanyId: COMPANY_ID,
    sbBranchId: BRANCH_ID,
    sbTenantId: TENANT_ID,
    sbAccYear: ACC_YEAR,
    sbCounterId: COUNTER_ID,
    sbDeviceType: 'POS',
    sbDeviceId: 'till-1',
    sbPriceLevel: 1,
    sbCustId: CUST_ID,
    sbCustName: 'Acme',
    sbUserId: USER_ID,
    ...overrides,
  }) as SaveBillDto;

type BillCreateArgs = { data: Prisma.SaleBillUncheckedCreateInput };
type BillUpdateArgs = {
  where: { sbId_sbAccYear: { sbId: string; sbAccYear: string } };
  data: Prisma.SaleBillUncheckedUpdateInput;
};
type ItemCreateArgs = { data: Prisma.SaleBillItemUncheckedCreateInput };
type ItemUpdateArgs = {
  where: { sbiId_sbiAccYear: { sbiId: string; sbiAccYear: string } };
  data: Prisma.SaleBillItemUncheckedUpdateInput;
};
type ChargeCreateArgs = { data: Prisma.SaleChargeDetailUncheckedCreateInput };
type ChargeUpdateArgs = {
  where: { cdId: string };
  data: Prisma.SaleChargeDetailUncheckedUpdateInput;
};
type TenderCreateArgs = { data: Prisma.AccTenderDetailUncheckedCreateInput };
// acc_tender_detail is partitioned by td_acc_year, so a single-row update
// addresses the compound key, the way sale_bill does.
type TenderUpdateArgs = {
  where: { tdId_tdAccYear: { tdId: string; tdAccYear: string } };
  data: Prisma.AccTenderDetailUncheckedUpdateInput;
};
type SequenceUpdateArgs = {
  where: { id: string };
  data: Prisma.AccVoucherSeqUncheckedUpdateInput;
};

type PrismaMock = {
  saleBill: {
    create: jest.Mock<Promise<SaleBill>, [BillCreateArgs]>;
    findFirst: jest.Mock<Promise<SaleBill | null>, unknown[]>;
    update: jest.Mock<Promise<SaleBill>, [BillUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  saleBillItem: {
    findMany: jest.Mock<Promise<SaleBillItem[]>, unknown[]>;
    create: jest.Mock<Promise<SaleBillItem>, [ItemCreateArgs]>;
    update: jest.Mock<Promise<SaleBillItem>, [ItemUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  saleChargeDetail: {
    findMany: jest.Mock<Promise<SaleChargeDetail[]>, unknown[]>;
    create: jest.Mock<Promise<SaleChargeDetail>, [ChargeCreateArgs]>;
    update: jest.Mock<Promise<SaleChargeDetail>, [ChargeUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  accTenderDetail: {
    findMany: jest.Mock<Promise<AccTenderDetail[]>, unknown[]>;
    create: jest.Mock<Promise<AccTenderDetail>, [TenderCreateArgs]>;
    update: jest.Mock<Promise<AccTenderDetail>, [TenderUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  // Read by ChargeDetailService, which owns the bill's charge lines: a charge
  // may only point at an active charge master / ledger.
  chargeMaster: { findFirst: jest.Mock<Promise<{ chgId: string } | null>, unknown[]> };
  accLedgerMaster: { findFirst: jest.Mock<Promise<{ ledName: string } | null>, unknown[]> };
  // Likewise for TenderDetailService and the bill's tender lines.
  accTenderMaster: {
    findFirst: jest.Mock<
      Promise<{ tndName: string; tndTypeId: number; tndLedgerId: string } | null>,
      unknown[]
    >;
  };
  accTenderType: { findFirst: jest.Mock<Promise<{ ttmTypeId: number } | null>, unknown[]> };
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
    saleBill: {
      // Prisma accepts a number for a BigInt column on write but always reads
      // one back as a bigint.
      create: jest.fn(({ data }: BillCreateArgs) =>
        Promise.resolve(
          makeBill({
            ...(data as unknown as Partial<SaleBill>),
            sbBillSlno: BigInt(data.sbBillSlno as number),
          }),
        ),
      ),
      findFirst: jest.fn(() => Promise.resolve(makeBill())),
      update: jest.fn(({ data }: BillUpdateArgs) =>
        Promise.resolve(makeBill(data as unknown as Partial<SaleBill>)),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    saleBillItem: {
      findMany: jest.fn(() => Promise.resolve([] as SaleBillItem[])),
      create: jest.fn(({ data }: ItemCreateArgs) =>
        Promise.resolve(makeItem(data as unknown as Partial<SaleBillItem>)),
      ),
      update: jest.fn(({ where, data }: ItemUpdateArgs) =>
        Promise.resolve(
          makeItem({
            ...(data as unknown as Partial<SaleBillItem>),
            sbiId: where.sbiId_sbiAccYear.sbiId,
          }),
        ),
      ),
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
    accTenderDetail: {
      findMany: jest.fn(() => Promise.resolve([] as AccTenderDetail[])),
      create: jest.fn(({ data }: TenderCreateArgs) =>
        Promise.resolve(makeTender(data as unknown as Partial<AccTenderDetail>)),
      ),
      update: jest.fn(({ where, data }: TenderUpdateArgs) =>
        Promise.resolve(
          makeTender({
            ...(data as unknown as Partial<AccTenderDetail>),
            tdId: where.tdId_tdAccYear.tdId,
          }),
        ),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    chargeMaster: { findFirst: jest.fn(() => Promise.resolve({ chgId: CHARGE_ID })) },
    accLedgerMaster: { findFirst: jest.fn(() => Promise.resolve({ ledName: 'Freight Inward' })) },
    accTenderMaster: {
      findFirst: jest.fn(() =>
        Promise.resolve({ tndName: 'Cash', tndTypeId: 1, tndLedgerId: TENDER_LEDGER_ID }),
      ),
    },
    accTenderType: { findFirst: jest.fn(() => Promise.resolve({ ttmTypeId: 1 })) },
    accVoucherType: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          vchrTypeId: BILL_VCHR_TYPE_ID,
          vchrNoPrefix: 'bil',
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
      findFirst: jest.fn(() => Promise.resolve({ brCode: 'BR001' })),
    },
    $queryRaw: jest.fn(() => Promise.resolve([{ locked: 1 }])),
    $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
  };
  return prisma;
};

describe('BillService', () => {
  let service: BillService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };

  beforeEach(() => {
    prisma = makePrismaMock();
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    const requestContextService = {
      getUserId: () => USER_ID,
    } as unknown as RequestContextService;
    service = new BillService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      requestContextService,
      // The real collaborator, not a stub: the charge lines a bill saves go
      // through it, so these tests assert on what it writes to
      // prisma.saleChargeDetail.
      new ChargeDetailService(
        prisma as unknown as PrismaService,
        auditLogService as unknown as AuditLogService,
        requestContextService,
      ),
      new TenderDetailService(
        prisma as unknown as PrismaService,
        auditLogService as unknown as AuditLogService,
        requestContextService,
      ),
    );
  });

  describe('create', () => {
    it('numbers the bill from the voucher sequence for voucher type 22', async () => {
      const payload = await service.save(baseDto());

      expect(prisma.saleBill.create).toHaveBeenCalledTimes(1);
      expect(prisma.saleBill.create.mock.calls[0][0].data).toMatchObject({
        sbBillSlno: BILL_SLNO,
        sbBillRefno: BILL_REFNO,
        sbCustId: CUST_ID,
        sbCustName: 'Acme',
      });
      expect(payload.sbBillSlno).toBe('101');
      expect(prisma.accVoucherSeq.findFirst).toHaveBeenCalledWith(
        containing({
          where: {
            vchrTypeId: BILL_VCHR_TYPE_ID,
            companyId: COMPANY_ID,
            branchId: BRANCH_ID,
            accYear: ACC_YEAR,
            deviceCode: 'MAIN',
            // YEARLY reset → the accounting year is the period bucket.
            periodKey: ACC_YEAR,
          },
        }),
      );
      expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'sale_bill', action: 'New' }),
        expect.anything(),
      );
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
          data: containing({ lastRefno: BILL_REFNO }),
        }),
      );
    });

    it('ignores a client-supplied slno and refno — voucher type 22 forbids manual numbers', async () => {
      await service.save(baseDto({ sbBillSlno: 7, sbBillRefno: 'HAND-WRITTEN' }));

      expect(prisma.saleBill.create.mock.calls[0][0].data).toMatchObject({
        sbBillSlno: BILL_SLNO,
        sbBillRefno: BILL_REFNO,
      });
    });

    it('creates the sequence row on first use, seeded from the voucher type format', async () => {
      prisma.accVoucherSeq.findFirst.mockResolvedValue(null);

      await service.save(baseDto());

      expect(prisma.accVoucherSeq.create.mock.calls[0][0].data).toMatchObject({
        vchrTypeId: BILL_VCHR_TYPE_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
        deviceCode: 'MAIN',
        periodKey: ACC_YEAR,
        lastNo: 0n,
        voucherPrefix: 'bil',
        voucherSuffix: null,
        noWidth: 5,
        companyCode: 'ABC123',
        branchCode: 'BR001',
      });
    });

    it('refuses to number against a deactivated sequence rather than silently reviving it', async () => {
      prisma.accVoucherSeq.findFirst.mockResolvedValue(makeSequence({ isActive: false }));

      await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleBill.create).not.toHaveBeenCalled();
    });

    it('creates a line item requiring sbiItemId, sbiItemUnitId, sbiGodownId and sbiStockId', async () => {
      await service.save(
        baseDto({
          items: [
            {
              sbiItemId: ITEM_MASTER_ID,
              sbiItemUnitId: ITEM_UNIT_ID,
              sbiGodownId: GODOWN_ID,
              sbiStockId: STOCK_ID,
            },
          ],
        }),
      );

      expect(prisma.saleBillItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.saleBillItem.create.mock.calls[0][0].data).toMatchObject({
        sbiBillId: BILL_ID,
        sbiLineNo: 1,
        sbiItemId: ITEM_MASTER_ID,
        sbiItemUnitId: ITEM_UNIT_ID,
        sbiGodownId: GODOWN_ID,
        sbiStockId: STOCK_ID,
      });
    });

    it('rejects a new line missing sbiGodownId', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiStockId: STOCK_ID,
              } as never,
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a duplicate sbiLineNo within one payload', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                sbiLineNo: 1,
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiGodownId: GODOWN_ID,
                sbiStockId: STOCK_ID,
              },
              {
                sbiLineNo: 1,
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiGodownId: GODOWN_ID,
                sbiStockId: STOCK_ID,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('updates a line carrying sbiId, creates one without, and soft deletes the omitted rest', async () => {
      prisma.saleBillItem.findMany.mockResolvedValue([
        makeItem(),
        makeItem({ sbiId: LINE_B_ID, sbiLineNo: 2 }),
      ]);

      await service.save(
        baseDto({
          sbId: BILL_ID,
          items: [
            {
              sbiId: LINE_A_ID,
              sbiItemId: ITEM_MASTER_ID,
              sbiItemUnitId: ITEM_UNIT_ID,
              sbiGodownId: GODOWN_ID,
              sbiStockId: STOCK_ID,
              sbiRate: 250,
            },
            {
              sbiItemId: ITEM_MASTER_ID,
              sbiItemUnitId: ITEM_UNIT_ID,
              sbiGodownId: GODOWN_ID,
              sbiStockId: STOCK_ID,
            },
          ],
        }),
      );

      expect(prisma.saleBillItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sbiId_sbiAccYear: { sbiId: LINE_A_ID, sbiAccYear: ACC_YEAR } },
          data: containing({ sbiLineNo: 1, sbiRate: 250 }),
        }),
      );
      expect(prisma.saleBillItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.saleBillItem.create.mock.calls[0][0].data).toMatchObject({ sbiLineNo: 2 });
      // LINE_B_ID was absent from the payload -> soft deleted via the compound key.
      expect(prisma.saleBillItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sbiId_sbiAccYear: { sbiId: LINE_B_ID, sbiAccYear: ACC_YEAR } },
          data: containing({ sbiIsDeleted: true }),
        }),
      );
    });

    it('leaves existing lines untouched when the items property is omitted', async () => {
      prisma.saleBillItem.findMany.mockResolvedValue([makeItem()]);

      const payload = await service.save(baseDto({ sbId: BILL_ID }));

      expect(prisma.saleBillItem.create).not.toHaveBeenCalled();
      expect(prisma.saleBillItem.update).not.toHaveBeenCalled();
      expect(payload.items).toHaveLength(1);
    });

    it('rejects an sbiId that does not belong to this bill', async () => {
      prisma.saleBillItem.findMany.mockResolvedValue([]);

      await expect(
        service.save(
          baseDto({
            sbId: BILL_ID,
            items: [
              {
                sbiId: LINE_A_ID,
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiGodownId: GODOWN_ID,
                sbiStockId: STOCK_ID,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates the header via the sbId_sbAccYear compound key', async () => {
      await service.save(baseDto({ sbId: BILL_ID, sbRemarks: 'Updated' }));

      expect(prisma.saleBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sbId_sbAccYear: { sbId: BILL_ID, sbAccYear: ACC_YEAR } },
          data: containing({ sbRemarks: 'Updated' }),
        }),
      );
    });

    it('never renumbers sbBillSlno / sbBillRefno on update', async () => {
      await service.save(baseDto({ sbId: BILL_ID, sbBillSlno: 999, sbBillRefno: 'B-999' }));

      const data = prisma.saleBill.update.mock.calls[0][0].data as Record<string, unknown>;
      expect(data).not.toHaveProperty('sbBillSlno');
      expect(data).not.toHaveProperty('sbBillRefno');
      // An update must not consume a number from the sequence either.
      expect(prisma.accVoucherSeq.update).not.toHaveBeenCalled();
    });
  });

  describe('applied charges', () => {
    it('creates charge lines under the INVOICE discriminator, defaulting the parent scope', async () => {
      await service.save(
        baseDto({
          charges: [{ cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdChgName: 'Freight' }],
        }),
      );

      expect(prisma.saleChargeDetail.create).toHaveBeenCalledTimes(1);
      expect(prisma.saleChargeDetail.create.mock.calls[0][0].data).toMatchObject({
        cdDocType: 'INVOICE',
        cdDocId: BILL_ID,
        cdSlno: 1,
        cdCompId: COMPANY_ID,
        cdBranchId: BRANCH_ID,
        cdAccYear: ACC_YEAR,
        cdVoucherNo: BILL_SLNO,
        cdChgId: CHARGE_ID,
        cdLedgerCode: LEDGER_ID,
        cdChgName: 'Freight',
      });
    });

    it('updates a charge carrying cdId, creates one without, and soft deletes the omitted rest', async () => {
      prisma.saleChargeDetail.findMany.mockResolvedValue([
        makeCharge(),
        makeCharge({ cdId: OTHER_CD_ID, cdSlno: 2, cdChgName: 'Loading' }),
      ]);

      await service.save(
        baseDto({
          sbId: BILL_ID,
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
      expect(prisma.saleChargeDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cdId: OTHER_CD_ID },
          data: containing({ cdIsDeleted: true }),
        }),
      );
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

    it('rejects a charge mapped to a soft-deleted ledger', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.save(baseDto({ charges: [{ cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID }] })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleChargeDetail.create).not.toHaveBeenCalled();
    });

    it('rejects a charge line pointing at another document', async () => {
      await expect(
        service.save(
          baseDto({
            sbId: BILL_ID,
            charges: [{ cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdDocId: OTHER_CD_ID }],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects cdTaxApl and cdBeforeTax set together', async () => {
      await expect(
        service.save(
          baseDto({
            charges: [
              {
                cdChgId: CHARGE_ID,
                cdLedgerCode: LEDGER_ID,
                cdTaxApl: true,
                cdBeforeTax: true,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('tendered amounts', () => {
    it('creates tender lines under SALES / SALE_BILL, defaulting the parent scope', async () => {
      await service.save(baseDto({ tenders: [{ tdTenderId: TENDER_ID, tdAmount: 500 }] }));

      expect(prisma.accTenderDetail.create).toHaveBeenCalledTimes(1);
      expect(prisma.accTenderDetail.create.mock.calls[0][0].data).toMatchObject({
        tdSrcModule: 'SALES',
        tdSrcDocType: 'SALE_BILL',
        tdSrcDocId: BILL_ID,
        tdRowNo: 1,
        tdCompanyId: COMPANY_ID,
        tdBranchId: BRANCH_ID,
        tdTenantId: TENANT_ID,
        tdAccYear: ACC_YEAR,
        // Money in on a sale, against the customer's own ledger, captured by
        // the bill's user / device.
        tdDrCr: 'DR',
        tdPartyLedgerId: CUST_ID,
        tdUserId: USER_ID,
        tdDeviceId: 'till-1',
        tdTenderId: TENDER_ID,
        tdAmount: 500,
      });
      // tdTenderTypeId / tdTenderLedgerId are snapshotted from the tender master
      // when the payload does not carry them.
      expect(prisma.accTenderDetail.create.mock.calls[0][0].data).toMatchObject({
        tdTenderTypeId: 1,
        tdTenderLedgerId: TENDER_LEDGER_ID,
      });
    });

    it('derives tdTotalAmt from tdAmount + tdSurchargeAmt', async () => {
      await service.save(
        baseDto({
          tenders: [{ tdTenderId: TENDER_ID, tdAmount: 500, tdSurchargeAmt: 12.345 }],
        }),
      );

      const { tdTotalAmt } = prisma.accTenderDetail.create.mock.calls[0][0].data;
      expect((tdTotalAmt as Prisma.Decimal).toString()).toBe('512.35');
    });

    it('rejects a tdTotalAmt that is not the sum of the parts', async () => {
      await expect(
        service.save(
          baseDto({
            tenders: [{ tdTenderId: TENDER_ID, tdAmount: 500, tdTotalAmt: 600 }],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an inactive tender master', async () => {
      prisma.accTenderMaster.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.save(baseDto({ tenders: [{ tdTenderId: TENDER_ID, tdAmount: 500 }] })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accTenderDetail.create).not.toHaveBeenCalled();
    });

    it('rejects change handed back that exceeds the cash received', async () => {
      await expect(
        service.save(
          baseDto({
            tenders: [
              { tdTenderId: TENDER_ID, tdAmount: 500, tdReceivedAmt: 500, tdChangeAmt: 600 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a tender carrying tdId via the compound key, and soft deletes the omitted rest', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender(),
        makeTender({ tdId: OTHER_TD_ID, tdRowNo: 2 }),
      ]);

      await service.save(
        baseDto({
          sbId: BILL_ID,
          tenders: [{ tdId: TD_ID, tdAmount: 750 }],
        }),
      );

      expect(prisma.accTenderDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tdId_tdAccYear: { tdId: TD_ID, tdAccYear: ACC_YEAR } },
          data: containing({ tdRowNo: 1, tdAmount: 750 }),
        }),
      );
      expect(prisma.accTenderDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tdId_tdAccYear: { tdId: OTHER_TD_ID, tdAccYear: ACC_YEAR } },
          data: containing({ tdIsDeleted: true }),
        }),
      );
    });

    it('leaves the stored tenders untouched when the property is omitted', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);

      const payload = await service.save(baseDto({ sbId: BILL_ID }));

      expect(prisma.accTenderDetail.create).not.toHaveBeenCalled();
      expect(prisma.accTenderDetail.update).not.toHaveBeenCalled();
      expect(payload.tenders).toHaveLength(1);
    });

    it('rejects a duplicate tdRowNo within one payload', async () => {
      await expect(
        service.save(
          baseDto({
            tenders: [
              { tdTenderId: TENDER_ID, tdRowNo: 1 },
              { tdTenderId: TENDER_ID, tdRowNo: 1 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a tender line pointing at another document', async () => {
      await expect(
        service.save(
          baseDto({
            tenders: [{ tdTenderId: TENDER_ID, tdSrcDocId: OTHER_CD_ID }],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('value guards (formerly DB CHECK constraints)', () => {
    it('rejects an sbStatus outside DRAFT/POSTED/CANCELLED', async () => {
      await expect(service.save(baseDto({ sbStatus: 'BOGUS' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an sbReturnStatus outside PARTIAL/FULL', async () => {
      await expect(service.save(baseDto({ sbReturnStatus: 'BOGUS' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts a null sbReturnStatus (nullable)', async () => {
      await expect(service.save(baseDto({ sbReturnStatus: null }))).resolves.toBeDefined();
    });

    it('rejects sbDocType explicitly set to null (NOT NULL, no DB constraint left to catch it)', async () => {
      await expect(service.save(baseDto({ sbDocType: null }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an sbiFreeType outside SCHEME/SAMPLE/REPLACEMENT', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiGodownId: GODOWN_ID,
                sbiStockId: STOCK_ID,
                sbiFreeType: 'BOGUS' as never,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects sbiSplitNo != 1 without an sbiBatchNo (ck_sbi_batch_split)', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiGodownId: GODOWN_ID,
                sbiStockId: STOCK_ID,
                sbiSplitNo: 2,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows sbiSplitNo != 1 when sbiBatchNo is provided', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiGodownId: GODOWN_ID,
                sbiStockId: STOCK_ID,
                sbiSplitNo: 2,
                sbiBatchNo: 'BATCH-1',
              },
            ],
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('judges ck_sbi_batch_split on the merged row on update, falling back to the stored sbiBatchNo', async () => {
      prisma.saleBillItem.findMany.mockResolvedValue([makeItem({ sbiBatchNo: 'BATCH-1' })]);

      await expect(
        service.save(
          baseDto({
            sbId: BILL_ID,
            items: [
              {
                sbiId: LINE_A_ID,
                sbiItemId: ITEM_MASTER_ID,
                sbiItemUnitId: ITEM_UNIT_ID,
                sbiGodownId: GODOWN_ID,
                sbiStockId: STOCK_ID,
                sbiSplitNo: 2,
              },
            ],
          }),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('getById', () => {
    it('resolves item/unit master names and returns them alongside the raw ids', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(
        makeBill({
          items: [
            {
              ...makeItem(),
              item: {
                itemNameEn: 'Widget',
                itemGroupId: 'group-1',
                itemBrandId: null,
                itemSectionId: null,
                itemCategoryId: null,
              },
              itemUnitConversion: { unit: { unit_name: 'PCS', unit_decimal_count: 0 } },
            },
          ],
        } as never),
      );

      const payload = await service.getById(BILL_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

      expect(payload.items?.[0]).toMatchObject({
        sbiItemId: ITEM_MASTER_ID,
        sbiItemName: 'Widget',
        sbiUnitName: 'PCS',
        sbiGroupId: 'group-1',
      });
    });

    it('throws not found when no active bill matches', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(null);

      await expect(
        service.getById(BILL_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('cascades the soft delete to line items, applied charges and tenders', async () => {
      const result = await service.softDelete(BILL_ID);

      expect(result).toEqual({ sbId: BILL_ID, deleted: true });
      expect(prisma.saleBill.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sbId: BILL_ID, sbIsDeleted: false },
          data: containing({ sbIsDeleted: true }),
        }),
      );
      expect(prisma.saleBillItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sbiBillId: BILL_ID, sbiIsDeleted: false },
          data: containing({ sbiIsDeleted: true }),
        }),
      );
      expect(prisma.saleChargeDetail.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cdDocType: 'INVOICE', cdDocId: BILL_ID, cdIsDeleted: false },
          data: containing({ cdIsDeleted: true }),
        }),
      );
      expect(prisma.accTenderDetail.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tdSrcModule: 'SALES',
            tdSrcDocType: 'SALE_BILL',
            tdSrcDocId: BILL_ID,
            tdIsDeleted: false,
          },
          data: containing({ tdIsDeleted: true }),
        }),
      );
      expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cancel', tableName: 'sale_bill' }),
        expect.anything(),
      );
    });

    it('throws not found when the bill is already deleted', async () => {
      prisma.saleBill.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(BILL_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
