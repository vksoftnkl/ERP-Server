import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AccTenderDetail,
  AccVoucherSeq,
  Prisma,
  TransactionChargeDetail,
  SaleOrder,
  SaleOrderAdvanceAlloc,
  SaleOrderItem,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { SaleOrderService } from './sale-order.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { SaveSaleOrderItemDto } from './dto/save-sale-order-item.dto';

const SALE_ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46fb01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fb02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fb03';
const TENANT_ID = '019c6f6c-be87-7a11-8905-36092c46fb04';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fb05';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46fb06';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46fb07';
const CHARGE_ID = '019c6f6c-be87-7a11-8905-36092c46fb08';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fb09';
const TENDER_ID = '019c6f6c-be87-7a11-8905-36092c46fb0c';
const TENDER_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fb0d';
const LINE_A_ID = '019c6f6c-be87-7a11-8905-36092c46fb10';
const LINE_B_ID = '019c6f6c-be87-7a11-8905-36092c46fb11';
const ITEM_MASTER_ID = '019c6f6c-be87-7a11-8905-36092c46fb12';
const ITEM_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fb13';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fb14';
const SEQ_ID = '019c6f6c-be87-7a11-8905-36092c46fb16';
const ADVANCE_ID = '019c6f6c-be87-7a11-8905-36092c46fb17';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fb18';
const OTHER_ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46fb19';
// so_salesman_id is a uuid[]: an order can be credited to more than one person.
const SALESMAN_A_ID = '019c6f6c-be87-7a11-8905-36092c46fb1a';
const SALESMAN_B_ID = '019c6f6c-be87-7a11-8905-36092c46fb1b';
const ACC_YEAR = '2026-2027';
// The sales-order voucher type, and the counter it stands at before a save: the
// next order therefore takes number 101 → 'sor00101'.
const SALE_ORDER_VCHR_TYPE_ID = 4;
const SEQ_LAST_NO = 100n;
const SALE_ORDER_SLNO = SEQ_LAST_NO + 1n;
const SALE_ORDER_REFNO = 'sor00101';

const makeSequence = (overrides: Partial<AccVoucherSeq> = {}): AccVoucherSeq =>
  ({
    id: SEQ_ID,
    vchrTypeId: SALE_ORDER_VCHR_TYPE_ID,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    accYear: ACC_YEAR,
    deviceId: null,
    deviceCode: 'MAIN',
    periodKey: ACC_YEAR,
    lastNo: SEQ_LAST_NO,
    voucherPrefix: 'sor',
    companyCode: 'ABC123',
    branchCode: 'BR001',
    voucherSuffix: null,
    noWidth: 5,
    lastRefno: null,
    isActive: true,
    isDeleted: false,
    createdOn: new Date('2026-08-08T10:00:00.000Z'),
    createdBy: null,
    modifiedOn: null,
    modifiedBy: null,
    ...overrides,
  }) as AccVoucherSeq;

const makeOrder = (overrides: Partial<SaleOrder> = {}): SaleOrder =>
  ({
    soId: SALE_ORDER_ID,
    soCompanyId: COMPANY_ID,
    soBranchId: BRANCH_ID,
    soTenantId: TENANT_ID,
    soAccYear: ACC_YEAR,
    soSessionId: null,
    soDeviceId: DEVICE_ID,
    soDocType: 'SALES_ORDER',
    soOrderType: 'CASH',
    soPriceLevel: 1,
    soOrderSlno: SALE_ORDER_SLNO,
    soOrderRefno: SALE_ORDER_REFNO,
    soOrderDate: new Date('2026-08-08T00:00:00.000Z'),
    soCustId: CUST_ID,
    soCustName: 'Acme',
    soUserId: USER_ID,
    soStatus: 'DRAFT',
    soAdvancePolicy: 'NONE',
    soAdvancePerc: new Prisma.Decimal('0.0000'),
    soAdvanceRequired: new Prisma.Decimal('0.00'),
    soAdvanceRecdAmt: new Prisma.Decimal('0.00'),
    soAdvanceAdjustedAmt: new Prisma.Decimal('0.00'),
    soAdvanceRefundAmt: new Prisma.Decimal('0.00'),
    soAdvanceForfeitAmt: new Prisma.Decimal('0.00'),
    soAdvanceBalanceAmt: new Prisma.Decimal('0.00'),
    soIsDeleted: false,
    soCreatedOn: new Date('2026-08-08T10:00:00.000Z'),
    soCreatedBy: USER_ID,
    soModifiedOn: null,
    soModifiedBy: null,
    soOrderDatetime: new Date('2026-08-08T10:00:00.000Z'),
    soSyncDate: null,
    ...overrides,
  }) as unknown as SaleOrder;

const makeItem = (overrides: Partial<SaleOrderItem> = {}): SaleOrderItem =>
  ({
    soiId: LINE_A_ID,
    soiOrderId: SALE_ORDER_ID,
    soiCompanyId: COMPANY_ID,
    soiBranchId: BRANCH_ID,
    soiTenantId: TENANT_ID,
    soiAccYear: ACC_YEAR,
    soiLineNo: 1,
    soiItemId: ITEM_MASTER_ID,
    soiItemUnitId: ITEM_UNIT_ID,
    soiGodownId: null,
    soiPriceLevel: 1,
    soiOrderQty: new Prisma.Decimal('10.000'),
    soiDeliveredQty: new Prisma.Decimal('0.000'),
    soiCancelledQty: new Prisma.Decimal('0.000'),
    soiPendingQty: new Prisma.Decimal('10.000'),
    soiReservedQty: new Prisma.Decimal('0.000'),
    soiIsDeleted: false,
    soiSyncDate: null,
    soiCreatedOn: new Date('2026-08-08T10:00:00.000Z'),
    soiCreatedBy: USER_ID,
    soiModifiedOn: null,
    soiModifiedBy: null,
    ...overrides,
  }) as unknown as SaleOrderItem;

const makeAdvance = (overrides: Partial<SaleOrderAdvanceAlloc> = {}): SaleOrderAdvanceAlloc =>
  ({
    soaId: ADVANCE_ID,
    soaCompanyId: COMPANY_ID,
    soaBranchId: BRANCH_ID,
    soaTenantId: TENANT_ID,
    soaAccYear: ACC_YEAR,
    soaOrderId: SALE_ORDER_ID,
    soaOrderAccYear: ACC_YEAR,
    soaOrderRefno: SALE_ORDER_REFNO,
    soaTenderId: null,
    soaTenderAccYear: null,
    soaAllocType: 'REFUNDED',
    soaAllocDate: new Date('2026-08-08T00:00:00.000Z'),
    soaAmount: new Prisma.Decimal('500.00'),
    soaBillId: null,
    soaBillAccYear: null,
    soaBillRefno: null,
    soaTargetOrderId: null,
    soaTargetAccYear: null,
    soaRefundTenderId: null,
    soaRefundMode: 'CASH',
    soaVoucherId: null,
    soaLedgerId: null,
    soaRemarks: null,
    soaApprovedBy: null,
    soaIsDeleted: false,
    soaSyncDate: null,
    soaCreatedOn: new Date('2026-08-08T10:00:00.000Z'),
    soaCreatedBy: USER_ID,
    soaModifiedOn: null,
    soaModifiedBy: null,
    ...overrides,
  }) as SaleOrderAdvanceAlloc;

const makeCharge = (overrides: Partial<TransactionChargeDetail> = {}): TransactionChargeDetail =>
  ({
    cdId: '019c6f6c-be87-7a11-8905-36092c46fb0a',
    cdDocType: 'ORDER',
    cdDocId: SALE_ORDER_ID,
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
    cdAmount: new Prisma.Decimal('100.0000'),
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
    cdNetAmt: new Prisma.Decimal('100.0000'),
    cdRemarks: null,
    cdIsActive: true,
    cdIsDeleted: false,
    cdSyncDate: null,
    cdCreatedOn: new Date('2026-08-08T10:00:00.000Z'),
    cdCreatedBy: USER_ID,
    cdModifiedOn: null,
    cdModifiedBy: null,
    ...overrides,
  }) as TransactionChargeDetail;

const makeTender = (overrides: Partial<AccTenderDetail> = {}): AccTenderDetail =>
  ({
    tdId: '019c6f6c-be87-7a11-8905-36092c46fb0b',
    tdCompanyId: COMPANY_ID,
    tdBranchId: BRANCH_ID,
    tdTenantId: TENANT_ID,
    tdAccYear: ACC_YEAR,
    tdSrcModule: 'SALES',
    tdSrcDocType: 'SALES_ORDER',
    tdSrcDocId: SALE_ORDER_ID,
    tdRowNo: 1,
    tdDocDate: new Date('2026-08-08T00:00:00.000Z'),
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
    tdDeviceId: DEVICE_ID,
    tdUserId: USER_ID,
    tdNotes: null,
    tdIsDeleted: false,
    tdSyncDate: null,
    tdCreatedOn: new Date('2026-08-08T10:00:00.000Z'),
    tdCreatedBy: USER_ID,
    tdModifiedOn: null,
    tdModifiedBy: null,
    ...overrides,
  }) as AccTenderDetail;

const baseDto = (overrides: Partial<SaveSaleOrderDto> = {}): SaveSaleOrderDto =>
  ({
    soCompanyId: COMPANY_ID,
    soBranchId: BRANCH_ID,
    soTenantId: TENANT_ID,
    soAccYear: ACC_YEAR,
    soDeviceId: DEVICE_ID,
    soPriceLevel: 1,
    soCustId: CUST_ID,
    soCustName: 'Acme',
    soUserId: USER_ID,
    ...overrides,
  }) as SaveSaleOrderDto;

type SaleOrderCreateArgs = { data: Prisma.SaleOrderUncheckedCreateInput };
type SaleOrderUpdateArgs = {
  where: { soId_soAccYear: { soId: string; soAccYear: string } };
  data: Prisma.SaleOrderUncheckedUpdateInput;
};
type ItemCreateArgs = { data: Prisma.SaleOrderItemUncheckedCreateInput };
type ItemUpdateArgs = {
  where: { soiId_soiAccYear: { soiId: string; soiAccYear: string } };
  data: Prisma.SaleOrderItemUncheckedUpdateInput;
};
type AdvanceCreateArgs = { data: Prisma.SaleOrderAdvanceAllocUncheckedCreateInput };
type AdvanceUpdateArgs = {
  where: { soaId_soaAccYear: { soaId: string; soaAccYear: string } };
  data: Prisma.SaleOrderAdvanceAllocUncheckedUpdateInput;
};
type SequenceUpdateArgs = {
  where: { id: string };
  data: Prisma.AccVoucherSeqUncheckedUpdateInput;
};

type PrismaMock = {
  saleOrder: {
    create: jest.Mock<Promise<SaleOrder>, [SaleOrderCreateArgs]>;
    findFirst: jest.Mock<Promise<SaleOrder | null>, unknown[]>;
    update: jest.Mock<Promise<SaleOrder>, [SaleOrderUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  saleOrderItem: {
    findMany: jest.Mock<Promise<SaleOrderItem[]>, unknown[]>;
    create: jest.Mock<Promise<SaleOrderItem>, [ItemCreateArgs]>;
    update: jest.Mock<Promise<SaleOrderItem>, [ItemUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  saleOrderAdvanceAlloc: {
    findMany: jest.Mock<Promise<SaleOrderAdvanceAlloc[]>, unknown[]>;
    create: jest.Mock<Promise<SaleOrderAdvanceAlloc>, [AdvanceCreateArgs]>;
    update: jest.Mock<Promise<SaleOrderAdvanceAlloc>, [AdvanceUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  transactionChargeDetail: {
    findMany: jest.Mock<Promise<TransactionChargeDetail[]>, unknown[]>;
    create: jest.Mock<Promise<TransactionChargeDetail>, [{ data: Record<string, unknown> }]>;
    update: jest.Mock<Promise<TransactionChargeDetail>, unknown[]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  accTenderDetail: {
    findMany: jest.Mock<Promise<AccTenderDetail[]>, unknown[]>;
    create: jest.Mock<Promise<AccTenderDetail>, [{ data: Record<string, unknown> }]>;
    update: jest.Mock<Promise<AccTenderDetail>, unknown[]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  chargeMaster: { findFirst: jest.Mock<Promise<{ chgId: string } | null>, unknown[]> };
  accLedgerMaster: {
    findFirst: jest.Mock<Promise<{ ledName: string } | null>, unknown[]>;
    findMany: jest.Mock<Promise<{ ledId: string; ledName: string }[]>, unknown[]>;
  };
  accTenderMaster: {
    findFirst: jest.Mock<
      Promise<{ tndName: string; tndTypeId: number; tndLedgerId: string } | null>,
      unknown[]
    >;
  };
  accTenderType: { findFirst: jest.Mock<Promise<{ ttmTypeId: number } | null>, unknown[]> };
  accVoucherType: { findFirst: jest.Mock<Promise<unknown>, unknown[]> };
  accVoucherSeq: {
    findFirst: jest.Mock<Promise<AccVoucherSeq | null>, unknown[]>;
    create: jest.Mock<Promise<AccVoucherSeq>, [{ data: Prisma.AccVoucherSeqUncheckedCreateInput }]>;
    update: jest.Mock<Promise<AccVoucherSeq>, [SequenceUpdateArgs]>;
  };
  company: {
    findFirst: jest.Mock<Promise<{ compCode: string | null } | null>, unknown[]>;
    findMany: jest.Mock<Promise<{ compId: string; compName: string }[]>, unknown[]>;
  };
  branchMaster: {
    findFirst: jest.Mock<Promise<{ brCode: string | null } | null>, unknown[]>;
    findMany: jest.Mock<Promise<{ brId: string; brName: string }[]>, unknown[]>;
  };
  employeeMaster: {
    findMany: jest.Mock<Promise<{ empId: string; empName: string }[]>, unknown[]>;
  };
  userMaster: {
    findMany: jest.Mock<Promise<{ usrId: string; usrDisplayName: string }[]>, unknown[]>;
  };
  godownLocation: {
    findMany: jest.Mock<Promise<{ gdlId: string; gdlName: string }[]>, unknown[]>;
  };
  $queryRaw: jest.Mock<Promise<unknown>, unknown[]>;
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

// expect.objectContaining() is typed `any`; wrapping it keeps the nested
// matchers below out of no-unsafe-assignment's way.
const containing = (value: Record<string, unknown>): unknown => expect.objectContaining(value);

const makePrismaMock = (): PrismaMock => {
  const prisma: PrismaMock = {
    saleOrder: {
      // Prisma accepts a number for a BigInt column on write but always reads
      // one back as a bigint.
      create: jest.fn(({ data }: SaleOrderCreateArgs) =>
        Promise.resolve(
          makeOrder({
            ...(data as unknown as Partial<SaleOrder>),
            soOrderSlno: BigInt(data.soOrderSlno as bigint),
          }),
        ),
      ),
      findFirst: jest.fn(() => Promise.resolve(makeOrder())),
      update: jest.fn(({ data }: SaleOrderUpdateArgs) =>
        Promise.resolve(makeOrder(data as unknown as Partial<SaleOrder>)),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    saleOrderItem: {
      findMany: jest.fn(() => Promise.resolve([] as SaleOrderItem[])),
      create: jest.fn(({ data }: ItemCreateArgs) =>
        Promise.resolve(makeItem(data as unknown as Partial<SaleOrderItem>)),
      ),
      update: jest.fn(({ where, data }: ItemUpdateArgs) =>
        Promise.resolve(
          makeItem({
            ...(data as unknown as Partial<SaleOrderItem>),
            soiId: where.soiId_soiAccYear.soiId,
          }),
        ),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    saleOrderAdvanceAlloc: {
      findMany: jest.fn(() => Promise.resolve([] as SaleOrderAdvanceAlloc[])),
      create: jest.fn(({ data }: AdvanceCreateArgs) =>
        Promise.resolve(makeAdvance(data as unknown as Partial<SaleOrderAdvanceAlloc>)),
      ),
      update: jest.fn(({ where, data }: AdvanceUpdateArgs) =>
        Promise.resolve(
          makeAdvance({
            ...(data as unknown as Partial<SaleOrderAdvanceAlloc>),
            soaId: where.soaId_soaAccYear.soaId,
          }),
        ),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    transactionChargeDetail: {
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCharge(data as Partial<TransactionChargeDetail>)),
      ),
      update: jest.fn(() => Promise.resolve(makeCharge())),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    accTenderDetail: {
      findMany: jest.fn(() => Promise.resolve([] as AccTenderDetail[])),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeTender(data as Partial<AccTenderDetail>)),
      ),
      update: jest.fn(() => Promise.resolve(makeTender())),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    chargeMaster: { findFirst: jest.fn(() => Promise.resolve({ chgId: CHARGE_ID })) },
    accLedgerMaster: {
      findFirst: jest.fn(() => Promise.resolve({ ledName: 'Freight Inward' })),
      // The tender lines' party ledger — acc_ledger_master mirrors the customer
      // row under the same id, so the party ledger of a tender IS cusId.
      findMany: jest.fn(() => Promise.resolve([{ ledId: CUST_ID, ledName: 'Acme' }])),
    },
    accTenderMaster: {
      findFirst: jest.fn(() =>
        Promise.resolve({ tndName: 'Cash', tndTypeId: 1, tndLedgerId: TENDER_LEDGER_ID }),
      ),
    },
    accTenderType: { findFirst: jest.fn(() => Promise.resolve({ ttmTypeId: 1 })) },
    accVoucherType: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          vchrTypeId: SALE_ORDER_VCHR_TYPE_ID,
          vchrNoPrefix: 'sor',
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
      findMany: jest.fn(() => Promise.resolve([{ compId: COMPANY_ID, compName: 'Acme Traders' }])),
    },
    branchMaster: {
      findFirst: jest.fn(() => Promise.resolve({ brCode: 'BR001' })),
      findMany: jest.fn(() => Promise.resolve([{ brId: BRANCH_ID, brName: 'Main Branch' }])),
    },
    employeeMaster: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { empId: SALESMAN_A_ID, empName: 'Ravi Kumar' },
          { empId: SALESMAN_B_ID, empName: 'Priya S' },
        ]),
      ),
    },
    userMaster: {
      findMany: jest.fn(() => Promise.resolve([{ usrId: USER_ID, usrDisplayName: 'Counter 1' }])),
    },
    godownLocation: {
      findMany: jest.fn(() => Promise.resolve([{ gdlId: GODOWN_ID, gdlName: 'Main Godown' }])),
    },
    $queryRaw: jest.fn(() => Promise.resolve([{ locked: 1 }])),
    $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
  };
  return prisma;
};

describe('SaleOrderService', () => {
  let service: SaleOrderService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };

  beforeEach(() => {
    prisma = makePrismaMock();
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    const requestContextService = {
      getUserId: () => USER_ID,
    } as unknown as RequestContextService;
    service = new SaleOrderService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      requestContextService,
      // The real collaborators, not stubs: the charge/tender lines an order
      // saves go through them, so these tests assert on what they write to
      // prisma.transactionChargeDetail / prisma.accTenderDetail.
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
    it('allocates the order number from the voucher sequence and ignores client numbers', async () => {
      const result = await service.save(
        baseDto({ soOrderSlno: 999, soOrderRefno: 'CLIENT-SENT' } as Partial<SaveSaleOrderDto>),
      );
      expect(prisma.accVoucherSeq.update).toHaveBeenCalledWith(
        containing({ data: containing({ lastNo: { increment: 1 } }) }),
      );
      expect(prisma.saleOrder.create).toHaveBeenCalledWith({
        data: containing({
          soOrderSlno: SALE_ORDER_SLNO,
          soOrderRefno: SALE_ORDER_REFNO,
          soStatus: 'DRAFT',
        }),
      });
      expect(result.soOrderSlno).toBe(SALE_ORDER_SLNO.toString());
      expect(result.soOrderRefno).toBe(SALE_ORDER_REFNO);
    });

    it('creates a line deriving the pending quantity from ordered − delivered − cancelled', async () => {
      await service.save(
        baseDto({
          items: [
            {
              soiItemId: ITEM_MASTER_ID,
              soiItemUnitId: ITEM_UNIT_ID,
              soiOrderQty: 10,
              soiDeliveredQty: 0,
              soiCancelledQty: 2,
            },
          ],
        }),
      );
      expect(prisma.saleOrderItem.create).toHaveBeenCalledWith({
        data: containing({
          soiOrderId: SALE_ORDER_ID,
          soiAccYear: ACC_YEAR,
          soiLineNo: 1,
          soiPendingQty: 8,
        }),
      });
    });

    it('rejects a stated pending quantity that breaks the balance', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                soiItemId: ITEM_MASTER_ID,
                soiItemUnitId: ITEM_UNIT_ID,
                soiOrderQty: 10,
                soiPendingQty: 3,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleOrderItem.create).not.toHaveBeenCalled();
    });

    it('rejects delivered + cancelled exceeding the ordered quantity', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                soiItemId: ITEM_MASTER_ID,
                soiItemUnitId: ITEM_UNIT_ID,
                soiOrderQty: 5,
                soiDeliveredQty: 4,
                soiCancelledQty: 3,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a reservation larger than the ordered quantity', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              {
                soiItemId: ITEM_MASTER_ID,
                soiItemUnitId: ITEM_UNIT_ID,
                soiOrderQty: 5,
                soiReservedQty: 6,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate line numbers within one payload', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              { soiItemId: ITEM_MASTER_ID, soiItemUnitId: ITEM_UNIT_ID, soiLineNo: 1 },
              { soiItemId: ITEM_MASTER_ID, soiItemUnitId: ITEM_UNIT_ID, soiLineNo: 1 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('derives the advance balance when the payload moves the components without it', async () => {
      await service.save(baseDto({ soAdvanceRecdAmt: 500, soAdvanceRefundAmt: 100 }));
      expect(prisma.saleOrder.create).toHaveBeenCalledWith({
        data: containing({ soAdvanceBalanceAmt: 400 }),
      });
    });

    it('rejects a stated advance balance that breaks the equation', async () => {
      await expect(
        service.save(baseDto({ soAdvanceRecdAmt: 500, soAdvanceBalanceAmt: 450 })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a PERC advance policy without a percentage', async () => {
      await expect(service.save(baseDto({ soAdvancePolicy: 'PERC' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('scopes a tender line to SALES / SALES_ORDER with the order as the document', async () => {
      await service.save(baseDto({ tenders: [{ tdTenderId: TENDER_ID, tdAmount: 500 }] }));
      expect(prisma.accTenderDetail.create).toHaveBeenCalledWith({
        data: containing({
          tdSrcModule: 'SALES',
          tdSrcDocType: 'SALES_ORDER',
          tdSrcDocId: SALE_ORDER_ID,
          tdPartyLedgerId: CUST_ID,
          tdDeviceId: DEVICE_ID,
          tdDrCr: 'DR',
        }),
      });
    });

    it('scopes a charge line to the ORDER discriminator', async () => {
      await service.save(
        baseDto({
          charges: [{ cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, cdAmount: 100 }],
        }),
      );
      expect(prisma.transactionChargeDetail.create).toHaveBeenCalledWith({
        data: containing({
          cdDocType: 'ORDER',
          cdDocId: SALE_ORDER_ID,
          cdCompId: COMPANY_ID,
        }),
      });
    });
  });

  describe('advance allocations', () => {
    it('creates a REFUNDED allocation scoped to the parent order', async () => {
      await service.save(
        baseDto({
          advances: [
            {
              soaAllocType: 'REFUNDED',
              soaAllocDate: '2026-08-08',
              soaAmount: 500,
              soaRefundMode: 'CASH',
            },
          ],
        }),
      );
      expect(prisma.saleOrderAdvanceAlloc.create).toHaveBeenCalledWith({
        data: containing({
          soaOrderId: SALE_ORDER_ID,
          soaOrderAccYear: ACC_YEAR,
          soaAccYear: ACC_YEAR,
          soaAllocType: 'REFUNDED',
          soaAmount: 500,
        }),
      });
    });

    it('rejects an ADJUSTED allocation that names no bill', async () => {
      await expect(
        service.save(
          baseDto({
            advances: [{ soaAllocType: 'ADJUSTED', soaAllocDate: '2026-08-08', soaAmount: 500 }],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a REFUNDED allocation that names a bill', async () => {
      await expect(
        service.save(
          baseDto({
            advances: [
              {
                soaAllocType: 'REFUNDED',
                soaAllocDate: '2026-08-08',
                soaAmount: 500,
                soaBillId: BILL_ID,
                soaBillAccYear: ACC_YEAR,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a TRANSFERRED allocation targeting the order itself', async () => {
      await expect(
        service.save(
          baseDto({
            soId: SALE_ORDER_ID,
            advances: [
              {
                soaAllocType: 'TRANSFERRED',
                soaAllocDate: '2026-08-08',
                soaAmount: 500,
                soaTargetOrderId: SALE_ORDER_ID,
                soaTargetAccYear: ACC_YEAR,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a tender reference without its accounting year', async () => {
      await expect(
        service.save(
          baseDto({
            advances: [
              {
                soaAllocType: 'REFUNDED',
                soaAllocDate: '2026-08-08',
                soaAmount: 500,
                soaTenderId: TENDER_ID,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an allocation naming another order', async () => {
      await expect(
        service.save(
          baseDto({
            advances: [
              {
                soaAllocType: 'REFUNDED',
                soaAllocDate: '2026-08-08',
                soaAmount: 500,
                soaOrderId: OTHER_ORDER_ID,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-positive amount', async () => {
      await expect(
        service.save(
          baseDto({
            advances: [{ soaAllocType: 'REFUNDED', soaAllocDate: '2026-08-08', soaAmount: 0 }],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('soft deletes an existing allocation the payload no longer carries', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(makeOrder());
      prisma.saleOrderAdvanceAlloc.findMany.mockResolvedValue([makeAdvance()]);
      await service.save(baseDto({ soId: SALE_ORDER_ID, advances: [] }));
      expect(prisma.saleOrderAdvanceAlloc.update).toHaveBeenCalledWith(
        containing({
          where: { soaId_soaAccYear: { soaId: ADVANCE_ID, soaAccYear: ACC_YEAR } },
          data: containing({ soaIsDeleted: true }),
        }),
      );
    });
  });

  describe('value guards (mirrors of the DB CHECK constraints)', () => {
    it.each([
      ['soDocType', 'WHOLESALE'],
      ['soOrderType', 'BARTER'],
      ['soPriority', 'ASAP'],
      ['soDeliveryMode', 'DRONE'],
      ['soStatus', 'POSTED'],
      ['soFulfilStatus', 'DONE'],
      ['soPayStatus', 'SETTLED'],
      ['soAdvancePolicy', 'HALF'],
      ['soAdvanceStatus', 'HELD'],
    ])('rejects a bad %s', async (field, value) => {
      await expect(
        service.save(baseDto({ [field]: value } as Partial<SaveSaleOrderDto>)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleOrder.create).not.toHaveBeenCalled();
    });

    it('rejects a bad soiFreeType and soiLineStatus on a line', async () => {
      await expect(
        service.save(
          baseDto({
            items: [
              { soiItemId: ITEM_MASTER_ID, soiItemUnitId: ITEM_UNIT_ID, soiFreeType: 'GIFT' },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.save(
          baseDto({
            items: [
              { soiItemId: ITEM_MASTER_ID, soiItemUnitId: ITEM_UNIT_ID, soiLineStatus: 'SHIPPED' },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts every allowed status value', async () => {
      await service.save(baseDto({ soStatus: 'CONFIRMED', soDocType: 'BOOKING' }));
      expect(prisma.saleOrder.create).toHaveBeenCalledWith({
        data: containing({ soStatus: 'CONFIRMED', soDocType: 'BOOKING' }),
      });
    });
  });

  describe('update', () => {
    it('updates through the compound key resolved from the loaded row', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(makeOrder());
      await service.save(baseDto({ soId: SALE_ORDER_ID, soRemarks: 'changed' }));
      expect(prisma.saleOrder.update).toHaveBeenCalledWith(
        containing({
          where: { soId_soAccYear: { soId: SALE_ORDER_ID, soAccYear: ACC_YEAR } },
          data: containing({ soRemarks: 'changed' }),
        }),
      );
      // An update never renumbers: the voucher sequence stays untouched.
      expect(prisma.accVoucherSeq.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown or deleted order', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);
      await expect(service.save(baseDto({ soId: SALE_ORDER_ID }))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('soft deletes a line the payload no longer carries and parks reordered survivors', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(makeOrder());
      const lineA = makeItem({ soiId: LINE_A_ID, soiLineNo: 1 });
      const lineB = makeItem({ soiId: LINE_B_ID, soiLineNo: 2 });
      prisma.saleOrderItem.findMany.mockResolvedValue([lineA, lineB]);
      await service.save(
        baseDto({
          soId: SALE_ORDER_ID,
          // B moves to line 1; A is gone. Updating lines resend no item/unit —
          // the DTO marks them required for NEW lines only, hence the cast.
          items: [{ soiId: LINE_B_ID, soiLineNo: 1 } as SaveSaleOrderItemDto],
        }),
      );
      // A soft deleted first, freeing its number...
      expect(prisma.saleOrderItem.update).toHaveBeenCalledWith(
        containing({
          where: { soiId_soiAccYear: { soiId: LINE_A_ID, soiAccYear: ACC_YEAR } },
          data: containing({ soiIsDeleted: true }),
        }),
      );
      // ...then the survivor parked above every requested number...
      expect(prisma.saleOrderItem.updateMany).toHaveBeenCalledWith(
        containing({
          where: containing({ soiId: { in: [LINE_B_ID] } }),
          data: { soiLineNo: { increment: 2 } },
        }),
      );
      // ...and renumbered down to its final slot.
      expect(prisma.saleOrderItem.update).toHaveBeenCalledWith(
        containing({
          where: { soiId_soiAccYear: { soiId: LINE_B_ID, soiAccYear: ACC_YEAR } },
          data: containing({ soiLineNo: 1 }),
        }),
      );
    });

    it('judges the quantity balance against the merged line on update', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(makeOrder());
      const line = makeItem({
        soiOrderQty: new Prisma.Decimal('10.000'),
        soiDeliveredQty: new Prisma.Decimal('4.000'),
        soiPendingQty: new Prisma.Decimal('6.000'),
      });
      prisma.saleOrderItem.findMany.mockResolvedValue([line]);
      // Payload halves the order quantity below what was already delivered.
      await expect(
        service.save(
          baseDto({
            soId: SALE_ORDER_ID,
            items: [{ soiId: LINE_A_ID, soiOrderQty: 3 } as SaveSaleOrderItemDto],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Raising it instead re-derives the pending cache.
      await service.save(
        baseDto({
          soId: SALE_ORDER_ID,
          items: [{ soiId: LINE_A_ID, soiOrderQty: 12 } as SaveSaleOrderItemDto],
        }),
      );
      expect(prisma.saleOrderItem.update).toHaveBeenCalledWith(
        containing({
          where: { soiId_soiAccYear: { soiId: LINE_A_ID, soiAccYear: ACC_YEAR } },
          data: containing({ soiOrderQty: 12, soiPendingQty: 8 }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('answers 404 when nothing active matches', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);
      await expect(
        service.getById(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the order with items, advances and resolved names', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue({
        ...makeOrder({ soSalesmanId: [SALESMAN_A_ID, SALESMAN_B_ID] }),
        items: [
          {
            ...makeItem({ soiGodownId: GODOWN_ID, soiSalesmanId: SALESMAN_B_ID }),
            item: {
              itemNameEn: 'Cement 50kg',
              itemGroupId: ITEM_MASTER_ID,
              itemBrandId: null,
              itemSectionId: null,
              itemCategoryId: null,
            },
            itemUnitConversion: { unit: { unit_name: 'BAG', unit_decimal_count: 0 } },
          },
        ],
      } as unknown as SaleOrder);
      prisma.saleOrderAdvanceAlloc.findMany.mockResolvedValue([makeAdvance()]);
      const result = await service.getById(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(result.items).toHaveLength(1);
      expect(result.items![0]).toEqual(
        containing({
          soiItemName: 'Cement 50kg',
          soiUnitName: 'BAG',
          soiGodownName: 'Main Godown',
          soiCompanyName: 'Acme Traders',
          soiBranchName: 'Main Branch',
          soiSalesmanName: 'Priya S',
        }),
      );
      expect(result.advances).toHaveLength(1);
      expect(result.advances![0]).toEqual(
        containing({
          soaAllocType: 'REFUNDED',
          soaCompanyName: 'Acme Traders',
          soaBranchName: 'Main Branch',
        }),
      );
      expect(result.soOrderSlno).toBe(SALE_ORDER_SLNO.toString());
      expect(result.soCompanyName).toBe('Acme Traders');
      expect(result.soBranchName).toBe('Main Branch');
      // Parallel to the uuid[] it labels, in the same order.
      expect(result.soSalesmanName).toEqual(['Ravi Kumar', 'Priya S']);
    });

    it('labels the charge and tender lines with their own master names', async () => {
      prisma.transactionChargeDetail.findMany.mockResolvedValue([makeCharge()]);
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      const result = await service.getById(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(result.charges![0]).toEqual(
        containing({ cdCompName: 'Acme Traders', cdBranchName: 'Main Branch' }),
      );
      expect(result.tenders![0]).toEqual(
        containing({
          tdCompanyName: 'Acme Traders',
          tdPartyLedgerName: 'Acme',
          tdUserName: 'Counter 1',
        }),
      );
    });

    it('leaves a name null when the master row is gone', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      prisma.employeeMaster.findMany.mockResolvedValue([]);
      prisma.saleOrder.findFirst.mockResolvedValue(
        makeOrder({ soSalesmanId: [SALESMAN_A_ID] }) as unknown as SaleOrder,
      );
      const result = await service.getById(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(result.soCompanyName).toBeNull();
      expect(result.soSalesmanName).toEqual([null]);
    });
  });

  describe('softDelete', () => {
    it('cascades the soft delete to items, charges, tenders and advances', async () => {
      const result = await service.softDelete(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(result).toEqual({ soId: SALE_ORDER_ID, deleted: true });
      expect(prisma.saleOrder.updateMany).toHaveBeenCalledWith(
        containing({
          data: containing({ soIsDeleted: true, soStatus: 'CANCELLED' }),
        }),
      );
      expect(prisma.saleOrderItem.updateMany).toHaveBeenCalledWith(
        containing({
          where: containing({ soiOrderId: SALE_ORDER_ID, soiAccYear: ACC_YEAR }),
          data: containing({ soiIsDeleted: true }),
        }),
      );
      expect(prisma.transactionChargeDetail.updateMany).toHaveBeenCalledWith(
        containing({
          where: containing({ cdDocType: 'ORDER', cdDocId: SALE_ORDER_ID }),
          data: containing({ cdIsDeleted: true, cdIsActive: false }),
        }),
      );
      expect(prisma.accTenderDetail.updateMany).toHaveBeenCalledWith(
        containing({
          where: containing({
            tdSrcModule: 'SALES',
            tdSrcDocType: 'SALES_ORDER',
            tdSrcDocId: SALE_ORDER_ID,
          }),
          data: containing({ tdIsDeleted: true }),
        }),
      );
      expect(prisma.saleOrderAdvanceAlloc.updateMany).toHaveBeenCalledWith(
        containing({
          where: containing({ soaOrderId: SALE_ORDER_ID, soaOrderAccYear: ACC_YEAR }),
          data: containing({ soaIsDeleted: true }),
        }),
      );
    });

    it('refuses to delete an order still holding an advance balance', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(
        makeOrder({ soAdvanceBalanceAmt: new Prisma.Decimal('250.00') }),
      );
      await expect(
        service.softDelete(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleOrder.updateMany).not.toHaveBeenCalled();
    });

    it('answers 404 when nothing active matches', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);
      await expect(
        service.softDelete(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
