import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SaleBill, SaleBillItem, SaleChargeDetail } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
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
const LINE_A_ID = '019c6f6c-be87-7a11-8905-36092c46fa10';
const LINE_B_ID = '019c6f6c-be87-7a11-8905-36092c46fa11';
const ITEM_MASTER_ID = '019c6f6c-be87-7a11-8905-36092c46fa12';
const ITEM_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fa13';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fa14';
const STOCK_ID = '019c6f6c-be87-7a11-8905-36092c46fa15';
const ACC_YEAR = '2026-2027';

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
    sbBillSlno: 101n,
    sbBillRefno: 'B-101',
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
    sbBillSlno: 101,
    sbBillRefno: 'B-101',
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
    service = new BillService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  describe('create', () => {
    it('takes sbBillSlno / sbBillRefno straight from the payload — no server sequence', async () => {
      const payload = await service.save(baseDto());

      expect(prisma.saleBill.create).toHaveBeenCalledTimes(1);
      expect(prisma.saleBill.create.mock.calls[0][0].data).toMatchObject({
        sbBillSlno: 101n,
        sbBillRefno: 'B-101',
        sbCustId: CUST_ID,
        sbCustName: 'Acme',
      });
      expect(payload.sbBillSlno).toBe('101');
      expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'sale_bill', action: 'New' }),
        expect.anything(),
      );
    });

    it('rejects a non-numeric sbBillSlno', async () => {
      await expect(service.save(baseDto({ sbBillSlno: 'not-a-number' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
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
        cdVoucherNo: 101n,
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
                itemBatchConfig: 0,
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
    it('cascades the soft delete to line items and applied charges', async () => {
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
