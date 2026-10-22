import { HttpException } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { allocateVoucherNumber } from '../../../common/Sequence/voucher-sequence.helper';
import { resolveDefaultSaleGodowns } from '../../../common/utils/sale-line-godown.utils';
import { assertTaxRateRefs } from '../../Inventory/tax-rate-master/utils/tax-rate-reference.helper';
import { readPdcChequeDetails } from '../posting/pdc-register.helper';
import {
  OrderAdvancePostingSyncResult,
  deleteOrderAdvancePosting,
  readOrderAdvanceBalance,
  syncOrderAdvancePosting,
} from './order-advance-posting.helper';
import { SaleOrderService } from './sale-order.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { SaveSaleOrderItemDto } from './dto/save-sale-order-item.dto';

// Everything this suite does not model is replaced at the module: the number
// series, the till-session lookup, the tax-rate guard, the default-godown read,
// the cheque register (the posting unit's) and the advance receipt (its own
// suite). What is left is the order service's own rules.
jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../../common/Sequence/voucher-sequence.helper', () => ({
  ...jest.requireActual<object>('../../../common/Sequence/voucher-sequence.helper'),
  allocateVoucherNumber: jest.fn(() => Promise.resolve({ lastNo: 101n, refno: 'sor00101' })),
}));
jest.mock('../../till/till-session-id', () => ({
  tillSessionIdOrNull: jest.fn((_tx: unknown, id: string | null | undefined) =>
    Promise.resolve(id),
  ),
}));
jest.mock('../../Inventory/tax-rate-master/utils/tax-rate-reference.helper', () => ({
  ...jest.requireActual<object>('../../Inventory/tax-rate-master/utils/tax-rate-reference.helper'),
  assertTaxRateRefs: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../common/utils/sale-line-godown.utils', () => ({
  ...jest.requireActual<object>('../../../common/utils/sale-line-godown.utils'),
  resolveDefaultSaleGodowns: jest.fn(() => Promise.resolve(new Map())),
}));
jest.mock('../posting/pdc-register.helper', () => ({
  ...jest.requireActual<object>('../posting/pdc-register.helper'),
  readPdcChequeDetails: jest.fn(() => Promise.resolve(new Map())),
}));
jest.mock('./order-advance-posting.helper', () => ({
  ...jest.requireActual<object>('./order-advance-posting.helper'),
  syncOrderAdvancePosting: jest.fn(),
  readOrderAdvanceBalance: jest.fn(),
  deleteOrderAdvancePosting: jest.fn(),
}));

const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46a601';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a602';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46a603';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46a604';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46a605';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a606';
const LINE_1 = '019c6f6c-be87-7a11-8905-36092c46a611';
const LINE_2 = '019c6f6c-be87-7a11-8905-36092c46a612';
const UNKNOWN_LINE = '019c6f6c-be87-7a11-8905-36092c46a6ff';
const ITEM_A = '019c6f6c-be87-7a11-8905-36092c46a621';
const ITEM_B = '019c6f6c-be87-7a11-8905-36092c46a622';
const UNIT = '019c6f6c-be87-7a11-8905-36092c46a623';
const GODOWN = '019c6f6c-be87-7a11-8905-36092c46a624';
const DEFAULT_GODOWN = '019c6f6c-be87-7a11-8905-36092c46a625';
const ACC_YEAR = '2026-2027';
const D = (value: string | number) => new Prisma.Decimal(value);

const UNCHANGED: OrderAdvancePostingSyncResult = {
  action: 'unchanged',
  voucherId: null,
  billId: null,
  pdcIds: [],
  totalAmount: null,
  postedOn: null,
};

const orderRow = (overrides: Partial<SaleOrder> = {}): SaleOrder =>
  ({
    soId: ORDER_ID,
    soCompanyId: COMPANY_ID,
    soBranchId: BRANCH_ID,
    soTenantId: null,
    soAccYear: ACC_YEAR,
    soDeviceId: DEVICE_ID,
    soPriceLevel: 1,
    soOrderSlno: 101n,
    soOrderRefno: 'sor00101',
    soOrderDate: new Date('2026-10-18T00:00:00.000Z'),
    soCustId: CUST_ID,
    soCustName: 'Ravi Stores',
    soUserId: USER_ID,
    soSessionId: null,
    soStatus: 'DRAFT',
    soSalesmanId: [],
    soAdvancePolicy: 'NONE',
    soAdvancePerc: D(0),
    soAdvanceRequired: D(0),
    soAdvanceRecdAmt: D(0),
    soAdvanceAdjustedAmt: D(0),
    soAdvanceRefundAmt: D(0),
    soAdvanceForfeitAmt: D(0),
    soAdvanceBalanceAmt: D(0),
    soAdvanceStatus: 'NONE',
    soCreatedOn: new Date('2026-10-18T05:00:00.000Z'),
    soModifiedOn: null,
    soOrderDatetime: new Date('2026-10-18T05:00:00.000Z'),
    soSyncDate: null,
    ...overrides,
  }) as SaleOrder;

const lineRow = (overrides: Partial<SaleOrderItem> = {}): SaleOrderItem =>
  ({
    soiId: LINE_1,
    soiOrderId: ORDER_ID,
    soiCompanyId: COMPANY_ID,
    soiBranchId: BRANCH_ID,
    soiAccYear: ACC_YEAR,
    soiLineNo: 1,
    soiItemId: ITEM_A,
    soiItemUnitId: UNIT,
    soiGodownId: null,
    soiSalesmanId: null,
    soiOrderQty: D('10'),
    soiNetQty: D('10'),
    soiDeliveredQty: D('0'),
    soiCancelledQty: D('0'),
    soiReservedQty: D('0'),
    soiCreatedOn: new Date('2026-10-18T05:00:00.000Z'),
    soiModifiedOn: null,
    soiSyncDate: null,
    ...overrides,
  }) as SaleOrderItem;

const createDto = (overrides: Partial<SaveSaleOrderDto> = {}): SaveSaleOrderDto => ({
  soCompanyId: COMPANY_ID,
  soBranchId: BRANCH_ID,
  soAccYear: ACC_YEAR,
  soDeviceId: DEVICE_ID,
  soPriceLevel: 1,
  soCustId: CUST_ID,
  soCustName: 'Ravi Stores',
  soUserId: USER_ID,
  ...overrides,
});

const updateDto = (overrides: Partial<SaveSaleOrderDto> = {}): SaveSaleOrderDto =>
  ({ soId: ORDER_ID, ...overrides }) as SaveSaleOrderDto;

const newLine = (overrides: Partial<SaveSaleOrderItemDto> = {}): SaveSaleOrderItemDto => ({
  soiItemId: ITEM_A,
  soiItemUnitId: UNIT,
  soiOrderQty: 10,
  ...overrides,
});

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

/** The (field, code) pairs of a refusal, in the order they were collected. */
const codesOf = (body: unknown) =>
  (body as { errors: Array<{ field: string; code: string }> }).errors.map(({ field, code }) => ({
    field,
    code,
  }));

type PrismaMock = {
  saleOrder: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
  saleOrderItem: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  company: { findMany: jest.Mock };
  branchMaster: { findMany: jest.Mock };
  employeeMaster: { findMany: jest.Mock };
  accLedgerMaster: { findMany: jest.Mock };
  userMaster: { findMany: jest.Mock };
  godownLocation: { findMany: jest.Mock };
  accBillBalance: { aggregate: jest.Mock };
  $transaction: jest.Mock;
};

describe('SaleOrderService — save, delete and read paths the older suite skips', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let charges: {
    syncDocumentCharges: jest.Mock;
    getByDocument: jest.Mock;
    softDeleteDocumentCharges: jest.Mock;
  };
  let tenders: {
    syncDocumentTenders: jest.Mock;
    findDocumentTenders: jest.Mock;
    getByDocument: jest.Mock;
    softDeleteDocumentTenders: jest.Mock;
  };
  let service: SaleOrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(syncOrderAdvancePosting).mockResolvedValue(UNCHANGED);
    jest.mocked(readOrderAdvanceBalance).mockResolvedValue(null);
    jest.mocked(deleteOrderAdvancePosting).mockResolvedValue({
      voucherIds: [],
      billIds: [],
      pdcIds: [],
    });
    prisma = {
      saleOrder: {
        create: jest.fn(({ data }: { data: Partial<SaleOrder> }) =>
          Promise.resolve(orderRow({ ...data, soId: ORDER_ID })),
        ),
        update: jest.fn(({ data }: { data: Partial<SaleOrder> }) =>
          Promise.resolve(orderRow({ ...data })),
        ),
        findFirst: jest.fn(() => Promise.resolve(orderRow())),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      saleOrderItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: { data: Partial<SaleOrderItem> }) =>
          Promise.resolve(lineRow({ ...data, soiId: LINE_2 })),
        ),
        update: jest.fn(({ data }: { data: Partial<SaleOrderItem> }) =>
          Promise.resolve(lineRow({ ...data })),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      company: { findMany: jest.fn().mockResolvedValue([]) },
      branchMaster: { findMany: jest.fn().mockResolvedValue([]) },
      employeeMaster: { findMany: jest.fn().mockResolvedValue([]) },
      accLedgerMaster: { findMany: jest.fn().mockResolvedValue([]) },
      userMaster: { findMany: jest.fn().mockResolvedValue([]) },
      godownLocation: { findMany: jest.fn().mockResolvedValue([]) },
      accBillBalance: { aggregate: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    charges = {
      syncDocumentCharges: jest.fn().mockResolvedValue([]),
      getByDocument: jest.fn().mockResolvedValue([]),
      softDeleteDocumentCharges: jest.fn().mockResolvedValue(undefined),
    };
    tenders = {
      syncDocumentTenders: jest.fn().mockResolvedValue([]),
      findDocumentTenders: jest.fn().mockResolvedValue([]),
      getByDocument: jest.fn().mockResolvedValue([]),
      softDeleteDocumentTenders: jest.fn().mockResolvedValue(undefined),
    };
    service = new SaleOrderService(
      prisma as unknown as PrismaService,
      audit as never,
      { getUserId: () => USER_ID } as never,
      charges as never,
      tenders as never,
    );
  });

  /** What the second saleOrder.update (the roll-up restatement) wrote, if any. */
  const rollupWrite = (call: number) =>
    (prisma.saleOrder.update.mock.calls[call]?.[0] as { data: Record<string, unknown> } | undefined)
      ?.data;

  describe('advance roll-up guards (ck_so_advance_*)', () => {
    it('refuses every negative roll-up, each on its own field, in one 400 before numbering', async () => {
      const refusal = await refusalOf(
        service.save(
          createDto({
            soAdvanceRequired: -10,
            soAdvanceRefundAmt: -1,
            soAdvanceForfeitAmt: -2,
          }),
        ),
      );

      expect(refusal.status).toBe(400);
      expect(codesOf(refusal.body)).toEqual([
        { field: 'soAdvanceRequired', code: 'SALE_ORDER_NEGATIVE_VALUE' },
        { field: 'soAdvanceRefundAmt', code: 'SALE_ORDER_NEGATIVE_VALUE' },
        { field: 'soAdvanceForfeitAmt', code: 'SALE_ORDER_NEGATIVE_VALUE' },
      ]);
      expect(jest.mocked(allocateVoucherNumber)).not.toHaveBeenCalled();
      expect(prisma.saleOrder.create).not.toHaveBeenCalled();
    });

    it('refuses roll-ups that use more than was received when the balance is left to derive', async () => {
      const refusal = await refusalOf(
        service.save(
          createDto({
            soAdvanceRecdAmt: 100,
            soAdvanceAdjustedAmt: 80,
            soAdvanceRefundAmt: 30,
          }),
        ),
      );

      expect(refusal.status).toBe(400);
      expect(codesOf(refusal.body)).toEqual([
        { field: 'soAdvanceBalanceAmt', code: 'SALE_ORDER_ADVANCE_OVERUSED' },
      ]);
    });

    it('refuses a negative stated balance as negative and as off the equation', async () => {
      const refusal = await refusalOf(service.save(createDto({ soAdvanceBalanceAmt: -5 })));

      expect(codesOf(refusal.body)).toEqual([
        { field: 'soAdvanceBalanceAmt', code: 'SALE_ORDER_NEGATIVE_VALUE' },
        { field: 'soAdvanceBalanceAmt', code: 'SALE_ORDER_ADVANCE_BALANCE_MISMATCH' },
      ]);
    });

    it('judges the equation in decimals, so 0.3 − 0.1 − 0.2 is exactly a zero balance', async () => {
      await service.save(
        createDto({
          soAdvanceRecdAmt: '0.3',
          soAdvanceAdjustedAmt: '0.1',
          soAdvanceRefundAmt: '0.2',
          soAdvanceBalanceAmt: 0,
        }),
      );

      expect(prisma.saleOrder.create).toHaveBeenCalledTimes(1);
    });

    it('refuses a FIXED policy with no required amount', async () => {
      const refusal = await refusalOf(service.save(createDto({ soAdvancePolicy: 'FIXED' })));

      expect(codesOf(refusal.body)).toEqual([
        { field: 'soAdvanceRequired', code: 'SALE_ORDER_ADVANCE_AMOUNT_REQUIRED' },
      ]);
    });

    it('judges an update against the stored roll-ups the payload leaves out', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soAdvanceRecdAmt: D('100.00') }));

      const refusal = await refusalOf(service.save(updateDto({ soAdvanceAdjustedAmt: 150 })));

      expect(codesOf(refusal.body)).toEqual([
        { field: 'soAdvanceBalanceAmt', code: 'SALE_ORDER_ADVANCE_OVERUSED' },
      ]);
      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
    });

    it('holds a stored FIXED policy to the required amount an update clears', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(
        orderRow({ soAdvancePolicy: 'FIXED', soAdvanceRequired: D('500.00') }),
      );

      const refusal = await refusalOf(service.save(updateDto({ soAdvanceRequired: 0 })));

      expect(codesOf(refusal.body)).toEqual([
        { field: 'soAdvanceRequired', code: 'SALE_ORDER_ADVANCE_AMOUNT_REQUIRED' },
      ]);
    });

    it('answers an update of an order that is gone with a 404 before judging anything', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(updateDto({ soAdvanceRequired: -1 })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'soId', code: 'SALES_NOT_FOUND' }] },
      });
    });
  });

  describe('date fields', () => {
    it('refuses a malformed header date, naming the field, before the header is written', async () => {
      const refusal = await refusalOf(service.save(createDto({ soDeliveryDate: 'next tuesday' })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'soDeliveryDate', code: 'SALE_ORDER_INVALID_DATE' }] },
      });
      expect(prisma.saleOrder.create).not.toHaveBeenCalled();
    });

    it('clears a date sent as an empty string and converts an ISO one', async () => {
      await service.save(
        createDto({ soDeliveryDate: '', soValidUntil: '2026-11-01T00:00:00.000Z' }),
      );

      const { data } = prisma.saleOrder.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data.soDeliveryDate).toBeNull();
      expect(data.soValidUntil).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    });

    it('refuses a malformed line date, naming the line field', async () => {
      const refusal = await refusalOf(
        service.save(createDto({ items: [newLine({ soiDeliveryDate: '31/12/2026' })] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'soiDeliveryDate', code: 'SALE_ORDER_INVALID_DATE' }] },
      });
      expect(prisma.saleOrderItem.create).not.toHaveBeenCalled();
    });
  });

  describe('line guards (ck_soi_*)', () => {
    const lineRefusal = (line: Partial<SaveSaleOrderItemDto>) =>
      refusalOf(service.save(createDto({ items: [newLine(line)] })));

    it('refuses a blank size, which ck_soi_size would', async () => {
      const refusal = await lineRefusal({ soiSize: '   ' });

      expect(codesOf(refusal.body)).toEqual([{ field: 'soiSize', code: 'SALE_ORDER_SIZE_BLANK' }]);
    });

    it('lets a size be null', async () => {
      await service.save(createDto({ items: [newLine({ soiSize: null })] }));

      expect(prisma.saleOrderItem.create).toHaveBeenCalledTimes(1);
    });

    it('refuses negative quantities, each on its own field', async () => {
      const refusal = await lineRefusal({
        soiOrderQty: -1,
        soiDeliveredQty: -2,
        soiCancelledQty: -3,
        soiPendingQty: -4,
      });

      expect(refusal.status).toBe(400);
      expect(codesOf(refusal.body)).toEqual([
        { field: 'soiOrderQty', code: 'SALE_ORDER_NEGATIVE_VALUE' },
        { field: 'soiDeliveredQty', code: 'SALE_ORDER_NEGATIVE_VALUE' },
        { field: 'soiCancelledQty', code: 'SALE_ORDER_NEGATIVE_VALUE' },
        { field: 'soiPendingQty', code: 'SALE_ORDER_NEGATIVE_VALUE' },
        // An unreserved line still holds more (0) than a negative order quantity.
        { field: 'soiReservedQty', code: 'SALE_ORDER_RESERVED_OUT_OF_RANGE' },
      ]);
    });

    it('refuses a negative reservation', async () => {
      const refusal = await lineRefusal({ soiReservedQty: -1 });

      expect(codesOf(refusal.body)).toEqual([
        { field: 'soiReservedQty', code: 'SALE_ORDER_RESERVED_OUT_OF_RANGE' },
      ]);
    });

    it.each(['soiItemId', 'soiItemUnitId'] as const)(
      'refuses a new line without %s',
      async (field) => {
        const refusal = await lineRefusal({ [field]: undefined });

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field, code: 'SALES_LINE_FIELD_REQUIRED' }] },
        });
      },
    );

    it('accepts a stated pending quantity that equals the derived one, and never writes it', async () => {
      await service.save(
        createDto({
          items: [newLine({ soiOrderQty: 10, soiDeliveredQty: 4, soiPendingQty: 6 })],
        }),
      );

      const { data } = prisma.saleOrderItem.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      // The billable quantity defaults to the ordered one, rounded at the column.
      expect(data.soiNetQty).toEqual(D('10'));
      expect(data).not.toHaveProperty('soiPendingQty');
      expect(data).not.toHaveProperty('soiLineStatus');
    });

    it('refuses an update naming a line that is not on this order', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([lineRow()]);

      const refusal = await refusalOf(
        service.save(updateDto({ items: [{ soiId: UNKNOWN_LINE } as SaveSaleOrderItemDto] })),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'soiId', code: 'SALES_LINE_NOT_FOUND' }] },
      });
      // Refused before any line is retired or written.
      expect(prisma.saleOrderItem.update).not.toHaveBeenCalled();
      expect(prisma.saleOrderItem.create).not.toHaveBeenCalled();
    });

    it('leaves the lines alone when an update omits items', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([lineRow()]);

      const payload = await service.save(updateDto({ soRemarks: 'Call first' }));

      expect(jest.mocked(assertTaxRateRefs)).not.toHaveBeenCalled();
      expect(prisma.saleOrderItem.update).not.toHaveBeenCalled();
      expect(prisma.saleOrderItem.create).not.toHaveBeenCalled();
      expect(payload.items).toEqual([expect.objectContaining({ soiId: LINE_1 })]);
    });

    it('checks the line tax rates before writing a line', async () => {
      await service.save(createDto({ items: [newLine({ soiTaxId: 'tax-1' })] }));

      expect(jest.mocked(assertTaxRateRefs)).toHaveBeenCalledWith(
        prisma,
        expect.anything(),
        'Invalid order item tax rate',
      );
      expect(jest.mocked(assertTaxRateRefs).mock.invocationCallOrder[0]).toBeLessThan(
        prisma.saleOrderItem.create.mock.invocationCallOrder[0],
      );
    });
  });

  describe('advance roll-ups restated from the books', () => {
    const live = (billAmount: string, pendingAmount: string) =>
      jest.mocked(readOrderAdvanceBalance).mockResolvedValue({
        billAmount: D(billAmount),
        pendingAmount: D(pendingAmount),
      });

    it('writes what the ADVANCE row holds back onto a header the screen sent at 0', async () => {
      live('1000.00', '1000.00');

      await service.save(createDto());

      expect(rollupWrite(0)).toEqual({
        soAdvanceRecdAmt: D('1000.00'),
        soAdvanceAdjustedAmt: D('0.00'),
        soAdvanceBalanceAmt: D('1000.00'),
        soAdvanceStatus: 'RECEIVED',
      });
    });

    it('calls an advance short of what the order required PARTIAL', async () => {
      live('1000.00', '1000.00');

      await service.save(createDto({ soAdvancePolicy: 'FIXED', soAdvanceRequired: 2500 }));

      expect(rollupWrite(0)).toMatchObject({ soAdvanceStatus: 'PARTIAL' });
    });

    it.each([
      ['REFUNDED', { soAdvanceRefundAmt: 1000 }, '0.00'],
      ['FORFEITED', { soAdvanceForfeitAmt: 1000 }, '0.00'],
      ['ADJUSTED', {}, '1000.00'],
    ])(
      'names a spent advance %s after where the money went',
      async (status, givenBack, adjusted) => {
        live('1000.00', '0.00');

        await service.save(createDto({ soAdvanceRecdAmt: 1000, ...givenBack }));

        expect(rollupWrite(0)).toEqual({
          soAdvanceRecdAmt: D('1000.00'),
          soAdvanceAdjustedAmt: D(adjusted),
          soAdvanceBalanceAmt: D('0.00'),
          soAdvanceStatus: status,
        });
      },
    );

    it('writes nothing when the header already says what the books say', async () => {
      live('1000.00', '1000.00');

      await service.save(createDto({ soAdvanceRecdAmt: 1000, soAdvanceStatus: 'RECEIVED' }));

      expect(prisma.saleOrder.update).not.toHaveBeenCalled();
    });

    it('lets re-sent tenders, not the stale stored figure, decide what is held on an update', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(
        orderRow({ soAdvanceRecdAmt: D('100.00'), soAdvanceBalanceAmt: D('100.00') }),
      );
      prisma.saleOrder.update.mockImplementation(({ data }: { data: Partial<SaleOrder> }) =>
        Promise.resolve(
          orderRow({ soAdvanceRecdAmt: D('100.00'), soAdvanceBalanceAmt: D('100.00'), ...data }),
        ),
      );

      await service.save(updateDto({ tenders: [] }));

      const [, source] = jest.mocked(syncOrderAdvancePosting).mock.calls[0];
      expect(source.soAdvanceRecdAmt).toEqual(D(0));
    });

    it('tells the books the received amount an update states', async () => {
      await service.save(updateDto({ tenders: [], soAdvanceRecdAmt: 300 }));

      const [, source] = jest.mocked(syncOrderAdvancePosting).mock.calls[0];
      expect(source.soAdvanceRecdAmt).toBe(300);
    });

    it('zeroes the roll-ups of a live order whose last tender went', async () => {
      const held = {
        soStatus: 'CONFIRMED',
        soAdvanceRecdAmt: D('500.00'),
        soAdvanceBalanceAmt: D('500.00'),
        soAdvanceStatus: 'RECEIVED',
      };
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow(held));
      prisma.saleOrder.update.mockImplementation(({ data }: { data: Partial<SaleOrder> }) =>
        Promise.resolve(orderRow({ ...held, ...data })),
      );
      jest.mocked(syncOrderAdvancePosting).mockResolvedValue({ ...UNCHANGED, action: 'cancelled' });

      await service.save(updateDto({ tenders: [] }));

      expect(rollupWrite(1)).toEqual({
        soAdvanceRecdAmt: D(0),
        soAdvanceAdjustedAmt: D(0),
        soAdvanceBalanceAmt: D(0),
        soAdvanceStatus: 'NONE',
      });
    });

    it('keeps what a cancelled order stated when its receipt goes', async () => {
      const cancelled = {
        soStatus: 'CANCELLED',
        soAdvanceRecdAmt: D('500.00'),
        soAdvanceRefundAmt: D('500.00'),
        soAdvanceStatus: 'REFUNDED',
      };
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow(cancelled));
      prisma.saleOrder.update.mockImplementation(({ data }: { data: Partial<SaleOrder> }) =>
        Promise.resolve(orderRow({ ...cancelled, ...data })),
      );
      jest.mocked(syncOrderAdvancePosting).mockResolvedValue({ ...UNCHANGED, action: 'cancelled' });

      await service.save(updateDto({ tenders: [] }));

      // Only the edit itself; no restatement.
      expect(prisma.saleOrder.update).toHaveBeenCalledTimes(1);
    });

    it("hands the books each cheque row's payload details by the id it was saved under", async () => {
      const cheque = { drawerName: 'K. Arun', bankBranch: 'Anna Nagar', ifsc: null, micr: null };
      tenders.syncDocumentTenders.mockResolvedValue([
        { tdId: 'td-chq', tdRowNo: 1, tdTenderTypeId: 5 },
        { tdId: 'td-cash', tdRowNo: 2, tdTenderTypeId: 1 },
      ]);
      tenders.findDocumentTenders.mockResolvedValue([
        { tdId: 'td-chq', tdRowNo: 1, tdTenderTypeId: 5 },
        { tdId: 'td-cash', tdRowNo: 2, tdTenderTypeId: 1 },
      ]);

      await service.save(
        updateDto({
          soAdvanceRecdAmt: 0,
          tenders: [{ tdId: 'td-chq', cheque }, { tdId: 'td-cash' }],
        }),
      );

      const [, , passed] = jest.mocked(syncOrderAdvancePosting).mock.calls[0];
      expect(passed).toEqual([
        { tdId: 'td-chq', tdRowNo: 1, tdTenderTypeId: 5, cheque },
        // A row that sent no cheque object keeps whatever the register holds.
        { tdId: 'td-cash', tdRowNo: 2, tdTenderTypeId: 1 },
      ]);
    });
  });

  describe('softDelete', () => {
    const remove = () => service.softDelete(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);

    it('refuses while the live ADVANCE row still holds money the header cache says is gone', async () => {
      jest.mocked(readOrderAdvanceBalance).mockResolvedValue({
        billAmount: D('200.00'),
        pendingAmount: D('200.00'),
      });

      const refusal = await refusalOf(remove());

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'soAdvanceBalanceAmt', code: 'SALE_ORDER_ADVANCE_HELD' }] },
      });
      expect(prisma.saleOrder.updateMany).not.toHaveBeenCalled();
    });

    it('lets the live row overrule a stale header balance', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(orderRow({ soAdvanceBalanceAmt: D('500.00') }));
      jest.mocked(readOrderAdvanceBalance).mockResolvedValue({
        billAmount: D('500.00'),
        pendingAmount: D('0.00'),
      });

      await expect(remove()).resolves.toEqual({ soId: ORDER_ID, deleted: true });
    });

    it('answers 404 when the order goes between the read and the write', async () => {
      prisma.saleOrder.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(remove());

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'soId', code: 'SALES_NOT_FOUND' }] },
      });
      expect(jest.mocked(deleteOrderAdvancePosting)).not.toHaveBeenCalled();
    });

    it('marks the order CANCELLED as well as deleted and takes its books with it', async () => {
      await remove();

      expect(prisma.saleOrder.updateMany).toHaveBeenCalledWith({
        where: {
          soId: ORDER_ID,
          soCompanyId: COMPANY_ID,
          soBranchId: BRANCH_ID,
          soAccYear: ACC_YEAR,
          soIsDeleted: false,
        },
        data: expect.objectContaining({ soStatus: 'CANCELLED', soIsDeleted: true }) as object,
      });
      expect(jest.mocked(deleteOrderAdvancePosting)).toHaveBeenCalledWith(
        prisma,
        { soId: ORDER_ID, soCompanyId: COMPANY_ID, soAccYear: ACC_YEAR },
        USER_ID,
        expect.any(Date),
      );
      // audit_log_action has no 'delete'.
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cancel', pk: ORDER_ID }),
        prisma,
      );
    });
  });

  describe('getById', () => {
    const get = () => service.getById(ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
    const itemJoin = (
      overrides: { itemIsService?: boolean; itemAllowNegStock?: boolean } = {},
    ) => ({
      itemNameEn: 'Cement 50kg',
      itemGroupId: ITEM_B,
      itemBrandId: null,
      itemSectionId: null,
      itemCategoryId: null,
      itemIsService: false,
      itemAllowNegStock: false,
      ...overrides,
    });
    const withLines = (items: unknown[]) =>
      prisma.saleOrder.findFirst.mockResolvedValue({ ...orderRow(), items });
    const company = (compNegStkApl: boolean, compIsDeleted = false) =>
      prisma.company.findMany.mockResolvedValue([
        { compId: COMPANY_ID, compName: 'Acme', compNegStkApl, compIsDeleted },
      ]);

    it('gives a cheque tender its register details and every other tender null', async () => {
      const detail = {
        drawerName: 'K. Arun',
        bankBranch: 'Anna Nagar',
        ifsc: 'KVBL0001',
        micr: null,
      };
      tenders.getByDocument.mockResolvedValue([
        { tdId: 'td-chq', tdTenderTypeId: 5, tdCompanyId: COMPANY_ID },
        { tdId: 'td-cash', tdTenderTypeId: 1, tdCompanyId: COMPANY_ID },
      ]);
      jest.mocked(readPdcChequeDetails).mockResolvedValue(new Map([['td-chq', detail]]));

      const result = await get();

      expect(jest.mocked(readPdcChequeDetails)).toHaveBeenCalledWith(prisma, ['td-chq']);
      expect(tenders.getByDocument).toHaveBeenCalledWith('SALES', 'SALES_ORDER', ORDER_ID);
      expect(result.tenders?.map((t) => (t as { cheque: unknown }).cheque)).toEqual([detail, null]);
    });

    it('blocks a line below zero only when its godown, the company and the item all say no', async () => {
      withLines([
        { ...lineRow({ soiGodownId: GODOWN }), item: itemJoin() },
        {
          ...lineRow({ soiId: LINE_2, soiLineNo: 2, soiGodownId: GODOWN }),
          item: itemJoin({ itemIsService: true }),
        },
      ]);
      company(false);
      prisma.godownLocation.findMany.mockResolvedValue([
        { gdlId: GODOWN, gdlName: 'Main', gdlNegativeStock: false },
      ]);

      const result = await get();

      expect(result.items?.map((line) => line.soiAllowNegativeStock)).toEqual([false, true]);
      expect(result.items?.[0]).toMatchObject({ soiGodownName: 'Main' });
      // Every line has a godown of its own, so there is no default to look up.
      expect(jest.mocked(resolveDefaultSaleGodowns)).toHaveBeenCalledWith(prisma, BRANCH_ID, []);
    });

    it('lets the company switch alone allow it', async () => {
      withLines([{ ...lineRow({ soiGodownId: GODOWN }), item: itemJoin() }]);
      company(true);
      prisma.godownLocation.findMany.mockResolvedValue([
        { gdlId: GODOWN, gdlName: 'Main', gdlNegativeStock: false },
      ]);

      const result = await get();

      expect(result.items?.[0].soiAllowNegativeStock).toBe(true);
    });

    it('judges a line with no godown by the godown a bill line of that item would default to', async () => {
      withLines([{ ...lineRow(), item: itemJoin() }]);
      company(false);
      jest
        .mocked(resolveDefaultSaleGodowns)
        .mockResolvedValue(
          new Map([
            [
              `${ITEM_A}|${UNIT}`,
              { gdlId: DEFAULT_GODOWN, gdlName: 'Back', gdlNegativeStock: false },
            ],
          ]),
        );

      const result = await get();

      expect(jest.mocked(resolveDefaultSaleGodowns)).toHaveBeenCalledWith(prisma, BRANCH_ID, [
        { itemId: ITEM_A, iucId: UNIT },
      ]);
      expect(result.items?.[0]).toMatchObject({
        soiAllowNegativeStock: false,
        // The default only judges; the line still names no godown.
        soiGodownName: null,
      });
    });

    it('treats a retired company as no answer, which leaves the line allowed', async () => {
      withLines([{ ...lineRow({ soiGodownId: GODOWN }), item: itemJoin() }]);
      company(false, true);
      prisma.godownLocation.findMany.mockResolvedValue([
        { gdlId: GODOWN, gdlName: 'Main', gdlNegativeStock: false },
      ]);

      const result = await get();

      expect(result.items?.[0].soiAllowNegativeStock).toBe(true);
    });

    it('answers null when the item join was not made', async () => {
      withLines([lineRow()]);

      const result = await get();

      expect(result.items?.[0].soiAllowNegativeStock).toBeNull();
    });
  });

  describe('getSrcDocPendingAmount', () => {
    it('rounds the summed pending amount half-up to the paisa the column keeps', async () => {
      prisma.accBillBalance.aggregate.mockResolvedValue({
        _sum: { ablPendingAmount: D('12.345') },
      });

      await expect(
        service.getSrcDocPendingAmount('SALES_ORDER', ORDER_ID, ACC_YEAR),
      ).resolves.toEqual({ ablPendingAmount: 12.35 });
    });
  });
});
