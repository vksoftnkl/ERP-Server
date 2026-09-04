import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AccTenderDetail,
  AccVoucherSeq,
  Prisma,
  TransactionChargeDetail,
  SaleOrder,
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
import { CHEQUE_TENDER_TYPE_ID } from './order-pdc-posting.helper';

// The status trail writes to public.txn_status_log and resolves the device
// against fixed.device_master — two models this suite's hand-rolled prisma mock
// deliberately does not carry. The helper has its own tests; what matters here
// is which step cancelOpenLines asks for, so only that one export is replaced.
jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(() => Promise.resolve({})),
}));
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { appendTxnStatusLog } = jest.requireMock<{ appendTxnStatusLog: jest.Mock }>(
  '../../../common/txn-status-log/txn-status-log.helper',
);

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
// The receipt raised for an order's tendered money runs on its own voucher type
// and its own counter, so it reads 'arc00101' where the order reads 'sor00101'.
const ORDER_ADVANCE_VCHR_TYPE_ID = 5;
const ADVANCE_REFNO = 'arc00101';
const ADVANCE_SEQ_ID = '019c6f6c-be87-7a11-8905-36092c46fb1c';
const ADVANCE_SEQUENCE = {
  id: ADVANCE_SEQ_ID,
  vchrTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
  voucherPrefix: 'arc',
};
// The customer-advance liability ledger an order credits, the surcharge ledger a
// card tender credits, and the accounting rows the receipt writes.
const ADVANCE_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fb1d';
const SURCHARGE_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fb1e';
// What a tender LINE snapshotted for itself (td_surcharge_ledger_id), which is
// deliberately not the one its tender master names today.
const LINE_SURCHARGE_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fb25';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46fb1f';
const VOUCHER_LINE_ID = '019c6f6c-be87-7a11-8905-36092c46fb20';
// The acc_bill_balance ADVANCE row the receipt leaves outstanding.
const ADVANCE_BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fb21';
// A cheque tender (accounts.acc_tender_types.ttm_type_id = 5) and what it opens
// in accounts.acc_pdc_register.
const CHEQUE_TENDER_ROW_ID = '019c6f6c-be87-7a11-8905-36092c46fb22';
const BANK_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fb23';
const PDC_ID = '019c6f6c-be87-7a11-8905-36092c46fb24';
const CHEQUE_NO = '458812';

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
    soOrderAmt: new Prisma.Decimal('10000.00'),
    soRoundOff: new Prisma.Decimal('0.00'),
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

// soi_pending_qty and soi_line_status are GENERATED ALWAYS ... STORED since
// migration 20260814060000: Postgres recomputes both from soi_net_qty and the
// two settled quantities on every write, so the fixture does the same. A test
// cannot pin them to something the three quantities do not say, which is exactly
// the guarantee the real column gives.
const withGeneratedColumns = (row: Record<string, unknown>): Record<string, unknown> => {
  const qty = (value: unknown) => Number(value ?? 0);
  const net = qty(row.soiNetQty);
  const delivered = qty(row.soiDeliveredQty);
  const cancelled = qty(row.soiCancelledQty);
  const pending = Math.round((net - delivered - cancelled) * 1000) / 1000;
  const status =
    net <= 0
      ? 'PENDING'
      : pending <= 0 && delivered <= 0
        ? 'CANCELLED'
        : pending <= 0
          ? 'DELIVERED'
          : delivered + cancelled > 0
            ? 'PARTIAL'
            : 'PENDING';
  return { ...row, soiPendingQty: new Prisma.Decimal(pending.toFixed(3)), soiLineStatus: status };
};

const makeItem = (overrides: Partial<SaleOrderItem> = {}): SaleOrderItem =>
  withGeneratedColumns({
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
    // The BILLABLE quantity, which is what soi_pending_qty is generated from.
    soiNetQty: new Prisma.Decimal('10.000'),
    soiDeliveredQty: new Prisma.Decimal('0.000'),
    soiCancelledQty: new Prisma.Decimal('0.000'),
    soiReservedQty: new Prisma.Decimal('0.000'),
    soiIsDeleted: false,
    soiSyncDate: null,
    soiCreatedOn: new Date('2026-08-08T10:00:00.000Z'),
    soiCreatedBy: USER_ID,
    soiModifiedOn: null,
    soiModifiedBy: null,
    ...overrides,
    // The billable quantity follows the ordered one unless a test says
    // otherwise — the same default a line created through the API gets.
    ...(overrides.soiOrderQty !== undefined && overrides.soiNetQty === undefined
      ? { soiNetQty: overrides.soiOrderQty }
      : {}),
  }) as unknown as SaleOrderItem;

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
type SequenceUpdateArgs = {
  where: { id: string };
  data: Prisma.AccVoucherSeqUncheckedUpdateInput;
};
type VoucherTypeFindArgs = { where: { vchrTypeId: number } };
// What order-advance-posting.helper.ts selects when it looks for the receipt an
// order is already posted through (ux_avh_src).
type LiveVoucher = {
  avhVoucherId: string;
  avhAccYear: string;
  avhVoucherNo: bigint | null;
  avhVoucherRefno: string | null;
  avhVoucherDate: Date;
  avhPostedOn: Date | null;
};
// ... and what it selects from the ADVANCE row that outstanding money leaves in
// accounts.acc_bill_balance.
type AdvanceBill = {
  ablId: string;
  ablAccYear: string;
  ablDocRefno: string;
  ablAllocAmount: Prisma.Decimal;
  ablDiscAmount: Prisma.Decimal;
  ablWriteoffAmount: Prisma.Decimal;
};
const makeAdvanceBill = (overrides: Partial<AdvanceBill> = {}): AdvanceBill => ({
  ablId: ADVANCE_BILL_ID,
  ablAccYear: ACC_YEAR,
  ablDocRefno: SALE_ORDER_REFNO,
  ablAllocAmount: new Prisma.Decimal('0.00'),
  ablDiscAmount: new Prisma.Decimal('0.00'),
  ablWriteoffAmount: new Prisma.Decimal('0.00'),
  ...overrides,
});
// ... and what order-pdc-posting.helper.ts selects from the cheque register
// rows an order's tender lines already opened.
type StoredPdcRow = {
  apdId: string;
  apdAccYear: string;
  apdTenderId: string;
  apdInstrumentNo: string;
  apdStatus: string;
};
const makePdcRow = (overrides: Partial<StoredPdcRow> = {}): StoredPdcRow => ({
  apdId: PDC_ID,
  apdAccYear: ACC_YEAR,
  apdTenderId: CHEQUE_TENDER_ROW_ID,
  apdInstrumentNo: CHEQUE_NO,
  apdStatus: 'HELD',
  ...overrides,
});
// A cheque tender line: type 5, with the instrument columns the register needs.
const makeChequeTender = (overrides: Partial<AccTenderDetail> = {}): AccTenderDetail =>
  makeTender({
    tdId: CHEQUE_TENDER_ROW_ID,
    tdTenderTypeId: CHEQUE_TENDER_TYPE_ID,
    tdRefNo: CHEQUE_NO,
    tdInstrumentDate: new Date('2026-09-08T00:00:00.000Z'),
    tdBankName: 'HDFC Bank',
    tdSettleLedgerId: BANK_LEDGER_ID,
    tdIsPdc: true,
    ...overrides,
  });

type PrismaMock = {
  saleOrder: {
    create: jest.Mock<Promise<SaleOrder>, [SaleOrderCreateArgs]>;
    findFirst: jest.Mock<Promise<SaleOrder | null>, unknown[]>;
    update: jest.Mock<Promise<SaleOrder>, [SaleOrderUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  saleOrderItem: {
    findMany: jest.Mock<Promise<SaleOrderItem[]>, unknown[]>;
    findFirst: jest.Mock<Promise<SaleOrderItem | null>, unknown[]>;
    create: jest.Mock<Promise<SaleOrderItem>, [ItemCreateArgs]>;
    update: jest.Mock<Promise<SaleOrderItem>, [ItemUpdateArgs]>;
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
    // Only read when a tender charges a surcharge: the receipt credits it to the
    // tender's own surcharge ledger.
    findMany: jest.Mock<
      Promise<{ tndId: string; tndName: string; tndSurchargeLedgerId: string | null }[]>,
      unknown[]
    >;
  };
  accTenderType: { findFirst: jest.Mock<Promise<{ ttmTypeId: number } | null>, unknown[]> };
  accVoucherType: { findFirst: jest.Mock<Promise<unknown>, [VoucherTypeFindArgs]> };
  // The advance receipt raised for the order's tendered money.
  accVoucherHeader: {
    findFirst: jest.Mock<Promise<LiveVoucher | null>, unknown[]>;
    findMany: jest.Mock<Promise<{ avhVoucherId: string; avhAccYear: string }[]>, unknown[]>;
    create: jest.Mock<Promise<{ avhVoucherId: string }>, unknown[]>;
    update: jest.Mock<Promise<unknown>, unknown[]>;
  };
  accVoucher: {
    create: jest.Mock<Promise<{ avId: string }>, unknown[]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  // The ADVANCE outstanding the receipt leaves behind: the customer's credit
  // with us until an invoice eats it.
  accBillBalance: {
    findFirst: jest.Mock<Promise<AdvanceBill | null>, unknown[]>;
    findMany: jest.Mock<Promise<AdvanceBill[]>, unknown[]>;
    create: jest.Mock<Promise<{ ablId: string }>, unknown[]>;
    update: jest.Mock<Promise<unknown>, unknown[]>;
    // The pending-amount read: abl_pending_amount totalled over the rows raised
    // against one source document.
    aggregate: jest.Mock<Promise<{ _sum: { ablPendingAmount: Prisma.Decimal | null } }>, unknown[]>;
  };
  // Only counted: a real settlement against the advance is what stops it being
  // edited down or taken back out.
  accBillAdjustment: { count: jest.Mock<Promise<number>, unknown[]> };
  // The cheque register: one row per tender line of type 5.
  accPdcRegister: {
    findMany: jest.Mock<Promise<StoredPdcRow[]>, unknown[]>;
    create: jest.Mock<Promise<{ apdId: string }>, unknown[]>;
    update: jest.Mock<Promise<unknown>, unknown[]>;
  };
  accVoucherSeq: {
    findFirst: jest.Mock<Promise<AccVoucherSeq | null>, [VoucherTypeFindArgs]>;
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
      // Only cancelOpenLines reads a single line, and only to tell a caller who
      // sent a line id which order it belongs to. Nothing found by default.
      findFirst: jest.fn(() => Promise.resolve(null as SaleOrderItem | null)),
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
      findMany: jest.fn(() =>
        Promise.resolve([
          { tndId: TENDER_ID, tndName: 'Cash', tndSurchargeLedgerId: SURCHARGE_LEDGER_ID },
        ]),
      ),
    },
    accTenderType: { findFirst: jest.fn(() => Promise.resolve({ ttmTypeId: 1 })) },
    // Two document types draw numbers in one order save: the order itself (SOr)
    // and, when money was tendered, the advance receipt (ARc).
    accVoucherType: {
      findFirst: jest.fn(({ where }: VoucherTypeFindArgs) =>
        Promise.resolve(
          where.vchrTypeId === ORDER_ADVANCE_VCHR_TYPE_ID
            ? {
                vchrTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
                vchrNoPrefix: 'arc',
                vchrNoSuffix: null,
                vchrNoWidth: 5,
                vchrResetFreq: 'YEARLY',
              }
            : {
                vchrTypeId: SALE_ORDER_VCHR_TYPE_ID,
                vchrNoPrefix: 'sor',
                vchrNoSuffix: null,
                vchrNoWidth: 5,
                vchrResetFreq: 'YEARLY',
              },
        ),
      ),
    },
    accVoucherHeader: {
      // No live receipt by default — the order has not been posted before.
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn(() => Promise.resolve({ avhVoucherId: VOUCHER_ID })),
      update: jest.fn(() => Promise.resolve({})),
    },
    accVoucher: {
      create: jest.fn(() => Promise.resolve({ avId: VOUCHER_LINE_ID })),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    accBillBalance: {
      // No outstanding advance by default — the order has not taken money before.
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([] as AdvanceBill[])),
      create: jest.fn(() => Promise.resolve({ ablId: ADVANCE_BILL_ID })),
      update: jest.fn(() => Promise.resolve({})),
      // ... so nothing is pending against it either. Prisma answers a null _sum
      // when the filter matches no row at all.
      aggregate: jest.fn(() =>
        Promise.resolve({ _sum: { ablPendingAmount: null as Prisma.Decimal | null } }),
      ),
    },
    accBillAdjustment: { count: jest.fn(() => Promise.resolve(0)) },
    accPdcRegister: {
      // No instrument registered by default — the order has taken no cheque
      // before.
      findMany: jest.fn(() => Promise.resolve([] as StoredPdcRow[])),
      create: jest.fn(() => Promise.resolve({ apdId: PDC_ID })),
      update: jest.fn(() => Promise.resolve({})),
    },
    accVoucherSeq: {
      findFirst: jest.fn(({ where }: VoucherTypeFindArgs) =>
        Promise.resolve(
          makeSequence(where.vchrTypeId === ORDER_ADVANCE_VCHR_TYPE_ID ? ADVANCE_SEQUENCE : {}),
        ),
      ),
      create: jest.fn(({ data }: { data: Prisma.AccVoucherSeqUncheckedCreateInput }) =>
        Promise.resolve(makeSequence(data as unknown as Partial<AccVoucherSeq>)),
      ),
      // Mirrors Postgres: the first call increments the counter and returns the
      // consumed number, the second only stamps the printable refno onto it.
      // The row is identified by id, which is how the receipt's counter stays
      // distinct from the order's.
      update: jest.fn(({ where, data }: SequenceUpdateArgs) => {
        const row = where.id === ADVANCE_SEQ_ID ? ADVANCE_SEQUENCE : {};
        const increment = (data.lastNo as { increment?: number } | undefined)?.increment;
        return Promise.resolve(
          makeSequence({
            ...row,
            ...(increment === undefined
              ? { lastRefno: data.lastRefno as string }
              : { lastNo: SEQ_LAST_NO + BigInt(increment) }),
          }),
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
    appendTxnStatusLog.mockClear();
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

    // soi_pending_qty is GENERATED from soi_net_qty − delivered − cancelled, so
    // the save writes none of it. What it does supply is the billable quantity a
    // client that keyed only an ordered quantity left out — without it the line
    // would sit at net 0, with nothing to deliver and the first bill against it
    // reading as an over-delivery.
    it('defaults the billable quantity from the ordered one and never writes the derived ones', async () => {
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
          soiNetQty: 10,
        }),
      });
      const created = prisma.saleOrderItem.create.mock.calls[0][0].data;
      expect(created).not.toHaveProperty('soiPendingQty');
      expect(created).not.toHaveProperty('soiLineStatus');
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

  // accounts.acc_voucher_header + accounts.acc_vouchers, raised from the order's
  // acc_tender_detail rows. The tender rows are read back out of the database by
  // the posting step, so these drive prisma.accTenderDetail.findMany rather than
  // the payload's tenders[] array.
  describe('advance receipt posting', () => {
    const liveVoucher = {
      avhVoucherId: VOUCHER_ID,
      avhAccYear: ACC_YEAR,
      avhVoucherNo: 101n,
      avhVoucherRefno: ADVANCE_REFNO,
      avhVoucherDate: new Date('2026-08-08T10:00:00.000Z'),
      avhPostedOn: new Date('2026-08-08T10:00:00.000Z'),
    };

    it('posts nothing when the order took no money', async () => {
      await service.save(baseDto());
      expect(prisma.accVoucherHeader.create).not.toHaveBeenCalled();
      expect(prisma.accVoucher.create).not.toHaveBeenCalled();
    });

    it('raises a POSTED receipt on its own voucher type for the tendered money', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await service.save(baseDto({ soAdvanceLedgerId: ADVANCE_LEDGER_ID }));
      expect(prisma.accVoucherHeader.create).toHaveBeenCalledTimes(1);
      expect(prisma.accVoucherHeader.create.mock.calls[0][0]).toMatchObject({
        data: containing({
          avhVoucherTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
          avhVoucherRefno: ADVANCE_REFNO,
          // ux_avh_src: the order is the source document, which is what stops it
          // being posted twice.
          avhSrcModule: 'SALES',
          avhSrcDocType: 'SALES_ORDER',
          avhSrcDocId: SALE_ORDER_ID,
          avhDocRefno: SALE_ORDER_REFNO,
          avhPartyId: CUST_ID,
          avhOppositeLedgerId: ADVANCE_LEDGER_ID,
          avhVoucherStatus: 'POSTED',
          // The doc_* block is the ORDER's value ...
          avhDocAmount: new Prisma.Decimal('10000.00'),
          avhRoundOff: new Prisma.Decimal('0.00'),
          // ... while the totals are what the receipt actually moves
          // (ck_avh_balanced).
          avhTotalDebit: new Prisma.Decimal('500.00'),
          avhTotalCredit: new Prisma.Decimal('500.00'),
        }),
      });
    });

    it('writes the double entry and stamps the voucher onto the tender rows', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await service.save(baseDto({ soAdvanceLedgerId: ADVANCE_LEDGER_ID }));
      expect(prisma.accVoucher.create).toHaveBeenCalledTimes(2);
      expect(prisma.accVoucher.create.mock.calls[0][0]).toMatchObject({
        data: containing({
          avVoucherId: VOUCHER_ID,
          avRowNo: 1,
          avDrCr: 'DR',
          avLedgerId: TENDER_LEDGER_ID,
          avOppLedgerId: ADVANCE_LEDGER_ID,
          avAmount: new Prisma.Decimal('500.00'),
        }),
      });
      expect(prisma.accVoucher.create.mock.calls[1][0]).toMatchObject({
        data: containing({
          avRowNo: 2,
          avDrCr: 'CR',
          avLedgerId: ADVANCE_LEDGER_ID,
          avOppLedgerId: TENDER_LEDGER_ID,
          avAmount: new Prisma.Decimal('500.00'),
        }),
      });
      expect(prisma.accTenderDetail.updateMany).toHaveBeenCalledWith(
        containing({ data: { tdVoucherId: VOUCHER_ID } }),
      );
    });

    it('credits a surcharge to the tender master its own surcharge ledger', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({
          tdAmount: new Prisma.Decimal('500.00'),
          tdSurchargeAmt: new Prisma.Decimal('10.00'),
          tdTotalAmt: new Prisma.Decimal('510.00'),
        }),
      ]);
      await service.save(baseDto({ soAdvanceLedgerId: ADVANCE_LEDGER_ID }));
      expect(prisma.accVoucher.create).toHaveBeenCalledTimes(3);
      expect(prisma.accVoucher.create.mock.calls[2][0]).toMatchObject({
        data: containing({
          avRowNo: 3,
          avDrCr: 'CR',
          avLedgerId: SURCHARGE_LEDGER_ID,
          avAmount: new Prisma.Decimal('10.00'),
        }),
      });
      // The tender ledger takes the whole of it.
      expect(prisma.accVoucher.create.mock.calls[0][0]).toMatchObject({
        data: containing({ avDrCr: 'DR', avAmount: new Prisma.Decimal('510.00') }),
      });
    });

    // The line's own snapshot is what the operator actually tendered against, so
    // it answers ahead of the master — a master repointed since the order was
    // taken must not move money the customer paid last month.
    it("credits the surcharge to the line's own ledger snapshot over the master's", async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({
          tdAmount: new Prisma.Decimal('500.00'),
          tdSurchargeAmt: new Prisma.Decimal('10.00'),
          tdSurchargeLedgerId: LINE_SURCHARGE_LEDGER_ID,
          tdTotalAmt: new Prisma.Decimal('510.00'),
        }),
      ]);
      await service.save(baseDto({ soAdvanceLedgerId: ADVANCE_LEDGER_ID }));
      expect(prisma.accVoucher.create).toHaveBeenCalledTimes(3);
      expect(prisma.accVoucher.create.mock.calls[2][0]).toMatchObject({
        data: containing({
          avRowNo: 3,
          avDrCr: 'CR',
          avLedgerId: LINE_SURCHARGE_LEDGER_ID,
          avOppLedgerId: TENDER_LEDGER_ID,
          avAmount: new Prisma.Decimal('10.00'),
        }),
      });
    });

    it('refuses a surcharge whose tender master names no surcharge ledger', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({
          tdSurchargeAmt: new Prisma.Decimal('10.00'),
          tdTotalAmt: new Prisma.Decimal('510.00'),
        }),
      ]);
      prisma.accTenderMaster.findMany.mockResolvedValue([
        { tndId: TENDER_ID, tndName: 'Cash', tndSurchargeLedgerId: null },
      ]);
      await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
    });

    // ck_av_self: a line cannot debit and credit the same ledger.
    it('refuses a tender paid into the very ledger it would be credited to', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({ tdTenderLedgerId: ADVANCE_LEDGER_ID }),
      ]);
      await expect(
        service.save(baseDto({ soAdvanceLedgerId: ADVANCE_LEDGER_ID })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('re-syncs the existing receipt on update instead of raising a second one', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({
          tdAmount: new Prisma.Decimal('750.00'),
          tdTotalAmt: new Prisma.Decimal('750.00'),
        }),
      ]);
      await service.save(baseDto({ soId: SALE_ORDER_ID }));
      expect(prisma.accVoucherHeader.create).not.toHaveBeenCalled();
      expect(prisma.accVoucherHeader.update.mock.calls[0][0]).toMatchObject({
        data: containing({
          // The order is unchanged, so its face is; the tendered money moved.
          avhDocAmount: new Prisma.Decimal('10000.00'),
          avhTotalDebit: new Prisma.Decimal('750.00'),
          avhTotalCredit: new Prisma.Decimal('750.00'),
        }),
      });
      // The old lines are retired, by voucher, before the rebuilt ones are
      // inserted — ux_av_voucher_row ignores deleted rows, so row 1 is free
      // again. invocationCallOrder proves the soft delete really does come
      // first; a rebuild that inserted first would collide on the index.
      expect(prisma.accVoucher.updateMany).toHaveBeenCalledWith(
        containing({
          where: containing({ avVoucherId: VOUCHER_ID, avIsDeleted: false }),
          data: containing({ avIsDeleted: true, avIsActive: false }),
        }),
      );
      expect(prisma.accVoucher.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.accVoucher.create.mock.invocationCallOrder[0],
      );
      // The rebuilt lines hang off the SAME header id, renumbered from 1.
      expect(prisma.accVoucher.create).toHaveBeenCalledTimes(2);
      expect(prisma.accVoucher.create.mock.calls[0][0]).toMatchObject({
        data: containing({
          avVoucherId: VOUCHER_ID,
          avRowNo: 1,
          avDrCr: 'DR',
          avAmount: new Prisma.Decimal('750.00'),
        }),
      });
      expect(prisma.accVoucher.create.mock.calls[1][0]).toMatchObject({
        data: containing({ avVoucherId: VOUCHER_ID, avRowNo: 2, avDrCr: 'CR' }),
      });
      // ... and the header keeps its identity: no new number is drawn for it.
      expect(prisma.accVoucher.create.mock.calls[0][0]).toMatchObject({
        data: containing({ avVoucherNo: 101n, avVoucherRefno: ADVANCE_REFNO }),
      });
    });

    // A surcharge added by the edit is nothing special: the lines are rebuilt
    // from the current tenders, so the third line appears on the re-sync exactly
    // as it would have on a first post.
    it('writes the surcharge line when an update adds one to a posted receipt', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({
          tdAmount: new Prisma.Decimal('500.00'),
          tdSurchargeAmt: new Prisma.Decimal('10.00'),
          tdSurchargeLedgerId: LINE_SURCHARGE_LEDGER_ID,
          tdTotalAmt: new Prisma.Decimal('510.00'),
        }),
      ]);
      await service.save(baseDto({ soId: SALE_ORDER_ID, soAdvanceLedgerId: ADVANCE_LEDGER_ID }));
      expect(prisma.accVoucherHeader.create).not.toHaveBeenCalled();
      // ck_avh_balanced: the surcharge rides in the totals on both sides.
      expect(prisma.accVoucherHeader.update.mock.calls[0][0]).toMatchObject({
        data: containing({
          avhTotalDebit: new Prisma.Decimal('510.00'),
          avhTotalCredit: new Prisma.Decimal('510.00'),
        }),
      });
      expect(prisma.accVoucher.create).toHaveBeenCalledTimes(3);
      expect(prisma.accVoucher.create.mock.calls[1][0]).toMatchObject({
        data: containing({
          avRowNo: 2,
          avDrCr: 'CR',
          avLedgerId: ADVANCE_LEDGER_ID,
          avAmount: new Prisma.Decimal('500.00'),
        }),
      });
      expect(prisma.accVoucher.create.mock.calls[2][0]).toMatchObject({
        data: containing({
          // Same header, renumbered from 1 — not a second receipt.
          avVoucherId: VOUCHER_ID,
          avRowNo: 3,
          avDrCr: 'CR',
          avLedgerId: LINE_SURCHARGE_LEDGER_ID,
          avAmount: new Prisma.Decimal('10.00'),
        }),
      });
    });

    it('cancels the receipt when the last tender is gone', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accTenderDetail.findMany.mockResolvedValue([]);
      await service.save(baseDto({ soId: SALE_ORDER_ID }));
      expect(prisma.accVoucherHeader.update.mock.calls[0][0]).toMatchObject({
        data: containing({
          avhVoucherStatus: 'CANCELLED',
          // ck_avh_cancel: a cancellation must say why.
          avhCancelReason: 'Sale order no longer holds tendered money',
        }),
      });
      expect(prisma.accTenderDetail.updateMany).toHaveBeenCalledWith(
        containing({ data: { tdVoucherId: null } }),
      );
    });

    it('cancels the receipt when the order itself is cancelled', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await service.save(baseDto({ soId: SALE_ORDER_ID, soStatus: 'CANCELLED' }));
      expect(prisma.accVoucherHeader.update.mock.calls[0][0]).toMatchObject({
        data: containing({ avhVoucherStatus: 'CANCELLED' }),
      });
      expect(prisma.accVoucher.create).not.toHaveBeenCalled();
    });

    it('retires the receipt and its lines when the order is soft deleted', async () => {
      prisma.accVoucherHeader.findMany.mockResolvedValue([
        { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR },
      ]);
      await service.softDelete(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(prisma.accVoucher.updateMany).toHaveBeenCalledWith(
        containing({ data: containing({ avIsDeleted: true }) }),
      );
      expect(prisma.accVoucherHeader.update.mock.calls[0][0]).toMatchObject({
        data: containing({
          avhVoucherStatus: 'CANCELLED',
          avhCancelReason: 'Sale order deleted',
          avhIsDeleted: true,
        }),
      });
    });
  });

  // accounts.acc_bill_balance — the bill side of the same money. The voucher
  // says it moved; this row says the customer holds a credit with us that no
  // invoice has eaten yet, which is what the ageing report and the adjustment
  // screen actually read.
  describe('advance outstanding (acc_bill_balance)', () => {
    const liveVoucher = {
      avhVoucherId: VOUCHER_ID,
      avhAccYear: ACC_YEAR,
      avhVoucherNo: 101n,
      avhVoucherRefno: ADVANCE_REFNO,
      avhVoucherDate: new Date('2026-08-08T10:00:00.000Z'),
      avhPostedOn: new Date('2026-08-08T10:00:00.000Z'),
    };

    it('opens an ADVANCE outstanding row for the money the order holds', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await service.save(baseDto({ soAdvanceRecdAmt: 500 }));
      expect(prisma.accBillBalance.create).toHaveBeenCalledTimes(1);
      expect(prisma.accBillBalance.create.mock.calls[0][0]).toMatchObject({
        data: containing({
          ablBillType: 'ADVANCE',
          // The customer's money, held: the party is in credit, the opposite of
          // an invoice's receivable.
          ablDrCr: 'CR',
          ablPartyId: CUST_ID,
          // ck_abl_src_doc — the row names the order it was taken against.
          ablSrcModule: 'SALES',
          ablSrcDocType: 'SALES_ORDER',
          ablSrcDocId: SALE_ORDER_ID,
          ablSrcAccYear: ACC_YEAR,
          // ck_abl_voucher: the receipt that opened it, and its type.
          ablVoucherId: VOUCHER_ID,
          ablVoucherTypeId: ORDER_ADVANCE_VCHR_TYPE_ID,
          ablVoucherRefno: ADVANCE_REFNO,
          // No bill number to quote — the order is what it is known by.
          ablDocRefno: SALE_ORDER_REFNO,
          ablBillAmount: new Prisma.Decimal('500.00'),
          ablAllocAmount: new Prisma.Decimal('0.00'),
        }),
      });
    });

    it('opens nothing when the order took no money', async () => {
      await service.save(baseDto({ soAdvanceRecdAmt: 0 }));
      expect(prisma.accBillBalance.create).not.toHaveBeenCalled();
    });

    // so_advance_recd_amt is fed from the tenders, so an omitted roll-up is not
    // a claim that nothing was taken.
    it('falls back to the tenders — without the surcharge — when the payload states no received amount', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({
          tdAmount: new Prisma.Decimal('500.00'),
          tdSurchargeAmt: new Prisma.Decimal('10.00'),
          tdTotalAmt: new Prisma.Decimal('510.00'),
        }),
      ]);
      await service.save(baseDto());
      // 510 hit the tender ledger, but the surcharge is the company's income —
      // only 500 is the customer's credit.
      expect(prisma.accBillBalance.create.mock.calls[0][0]).toMatchObject({
        data: containing({ ablBillAmount: new Prisma.Decimal('500.00') }),
      });
    });

    // abl_pending_amount is bill − alloc − disc − writeoff, so seeding the
    // allocation with what has already been used leaves the outstanding equal to
    // the order's own so_advance_balance_amt.
    it('seeds the allocation with the advance already refunded', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await service.save(baseDto({ soAdvanceRecdAmt: 500, soAdvanceRefundAmt: 100 }));
      expect(prisma.accBillBalance.create.mock.calls[0][0]).toMatchObject({
        data: containing({
          ablBillAmount: new Prisma.Decimal('500.00'),
          ablAllocAmount: new Prisma.Decimal('100.00'),
        }),
      });
    });

    it('moves the existing outstanding on update instead of opening a second one', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accBillBalance.findFirst.mockResolvedValue(makeAdvanceBill());
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeTender({
          tdAmount: new Prisma.Decimal('750.00'),
          tdTotalAmt: new Prisma.Decimal('750.00'),
        }),
      ]);
      await service.save(baseDto({ soId: SALE_ORDER_ID, soAdvanceRecdAmt: 750 }));
      expect(prisma.accBillBalance.create).not.toHaveBeenCalled();
      expect(prisma.accBillBalance.update.mock.calls[0][0]).toMatchObject({
        // Partitioned by abl_acc_year: pk_acc_bill_balance is the pair.
        where: { ablId_ablAccYear: { ablId: ADVANCE_BILL_ID, ablAccYear: ACC_YEAR } },
        data: containing({ ablBillAmount: new Prisma.Decimal('750.00') }),
      });
    });

    it('retires the outstanding when the last tender is gone', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accBillBalance.findMany.mockResolvedValue([makeAdvanceBill()]);
      prisma.accTenderDetail.findMany.mockResolvedValue([]);
      await service.save(baseDto({ soId: SALE_ORDER_ID }));
      expect(prisma.accBillBalance.update.mock.calls[0][0]).toMatchObject({
        where: { ablId_ablAccYear: { ablId: ADVANCE_BILL_ID, ablAccYear: ACC_YEAR } },
        data: containing({ ablIsDeleted: true, ablIsActive: false }),
      });
    });

    // A receipt allocated against the advance would be left pointing at a row
    // that no longer exists.
    it('refuses to take back an advance already settled in accounts', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accBillBalance.findMany.mockResolvedValue([makeAdvanceBill()]);
      prisma.accBillAdjustment.count.mockResolvedValue(1);
      prisma.accTenderDetail.findMany.mockResolvedValue([]);
      await expect(service.save(baseDto({ soId: SALE_ORDER_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // ... but a refunded advance carries a seeded allocation and no adjustment,
    // and must still be able to go.
    it('retires an advance whose allocation is only the refund it was seeded with', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accBillBalance.findMany.mockResolvedValue([
        makeAdvanceBill({ ablAllocAmount: new Prisma.Decimal('500.00') }),
      ]);
      prisma.accTenderDetail.findMany.mockResolvedValue([]);
      await service.save(baseDto({ soId: SALE_ORDER_ID }));
      expect(prisma.accBillBalance.update.mock.calls[0][0]).toMatchObject({
        data: containing({ ablIsDeleted: true }),
      });
    });

    it('retires the outstanding when the order is soft deleted', async () => {
      prisma.accVoucherHeader.findMany.mockResolvedValue([
        { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR },
      ]);
      prisma.accBillBalance.findMany.mockResolvedValue([makeAdvanceBill()]);
      await service.softDelete(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(prisma.accBillBalance.update.mock.calls[0][0]).toMatchObject({
        where: { ablId_ablAccYear: { ablId: ADVANCE_BILL_ID, ablAccYear: ACC_YEAR } },
        data: containing({ ablIsDeleted: true, ablIsActive: false }),
      });
    });
  });

  // Tender type 5 is CHEQUE, and a cheque is an instrument the company holds
  // until the bank says otherwise — so it also opens a row in
  // accounts.acc_pdc_register (order-pdc-posting.helper.ts).
  describe('cheque register (acc_pdc_register)', () => {
    const liveVoucher = {
      avhVoucherId: VOUCHER_ID,
      avhAccYear: ACC_YEAR,
      avhVoucherNo: 101n,
      avhVoucherRefno: ADVANCE_REFNO,
      avhVoucherDate: new Date('2026-08-08T10:00:00.000Z'),
      avhPostedOn: new Date('2026-08-08T10:00:00.000Z'),
    };

    it('registers nothing when the money came in some other way', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await service.save(baseDto());
      expect(prisma.accPdcRegister.create).not.toHaveBeenCalled();
    });

    it('registers a cheque tender against the receipt that took it', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeChequeTender()]);
      await service.save(baseDto({ soAdvanceLedgerId: ADVANCE_LEDGER_ID }));
      expect(prisma.accPdcRegister.create).toHaveBeenCalledTimes(1);
      expect(prisma.accPdcRegister.create.mock.calls[0][0]).toMatchObject({
        data: containing({
          apdCompanyId: COMPANY_ID,
          apdBranchId: BRANCH_ID,
          // Received in the order's year, which is the register's partition key.
          apdAccYear: ACC_YEAR,
          apdTraType: 'R',
          apdPartyId: CUST_ID,
          apdInstrumentType: 'CHEQUE',
          apdInstrumentNo: CHEQUE_NO,
          apdInstrumentDate: new Date('2026-09-08T00:00:00.000Z'),
          apdAmount: new Prisma.Decimal('500.00'),
          apdBankName: 'HDFC Bank',
          apdBankLedgerId: BANK_LEDGER_ID,
          apdStatus: 'HELD',
          // ck_apd_posting: the advance receipt is raised the day the cheque
          // arrives, so the row is ON_RECEIPT and names its voucher.
          apdPostingMode: 'ON_RECEIPT',
          apdVoucherId: VOUCHER_ID,
          apdVoucherAccYear: ACC_YEAR,
          apdTenderId: CHEQUE_TENDER_ROW_ID,
        }),
      });
    });

    it('re-syncs the registered cheque on update instead of registering a second one', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accPdcRegister.findMany.mockResolvedValue([makePdcRow()]);
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeChequeTender({
          tdAmount: new Prisma.Decimal('750.00'),
          tdTotalAmt: new Prisma.Decimal('750.00'),
        }),
      ]);
      await service.save(baseDto({ soId: SALE_ORDER_ID }));
      expect(prisma.accPdcRegister.create).not.toHaveBeenCalled();
      expect(prisma.accPdcRegister.update.mock.calls[0][0]).toMatchObject({
        where: { apdId_apdAccYear: { apdId: PDC_ID, apdAccYear: ACC_YEAR } },
        data: containing({ apdAmount: new Prisma.Decimal('750.00'), apdInstrumentNo: CHEQUE_NO }),
      });
    });

    it('cancels the register row when the cheque is no longer tendered', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accPdcRegister.findMany.mockResolvedValue([makePdcRow()]);
      // The order now settles in cash: the tender row is a different line, so
      // the cheque's register row has nothing behind it any more.
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await service.save(baseDto({ soId: SALE_ORDER_ID }));
      expect(prisma.accPdcRegister.update.mock.calls[0][0]).toMatchObject({
        where: { apdId_apdAccYear: { apdId: PDC_ID, apdAccYear: ACC_YEAR } },
        // ck_apd_cancelled wants a reason; the row stays for audit and
        // ux_apd_instrument frees the cheque number again.
        data: containing({ apdStatus: 'CANCELLED', apdIsActive: false }),
      });
      expect(prisma.accPdcRegister.update.mock.calls[0][0]).not.toMatchObject({
        data: containing({ apdIsDeleted: true }),
      });
    });

    it('cancels and retires the register row when the order is soft deleted', async () => {
      prisma.accVoucherHeader.findMany.mockResolvedValue([
        { avhVoucherId: VOUCHER_ID, avhAccYear: ACC_YEAR },
      ]);
      prisma.accTenderDetail.findMany.mockResolvedValue([makeChequeTender()]);
      prisma.accPdcRegister.findMany.mockResolvedValue([makePdcRow()]);
      await service.softDelete(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR);
      expect(prisma.accPdcRegister.update.mock.calls[0][0]).toMatchObject({
        data: containing({ apdStatus: 'CANCELLED', apdIsDeleted: true, apdIsActive: false }),
      });
    });

    it('refuses a cheque tender with no cheque number', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeChequeTender({ tdRefNo: null })]);
      await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accPdcRegister.create).not.toHaveBeenCalled();
    });

    it('refuses a cheque tender with no cheque date', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeChequeTender({ tdInstrumentDate: null }),
      ]);
      await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
    });

    // ck_apd_dates: an instrument cannot mature before the day it arrived.
    it('refuses a cheque dated before the order', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeChequeTender({ tdInstrumentDate: new Date('2026-08-07T00:00:00.000Z') }),
      ]);
      await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
    });

    // ux_apd_instrument: one cheque number per customer per year.
    it('refuses the same cheque tendered twice on one order', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeChequeTender(),
        makeChequeTender({ tdId: LINE_B_ID, tdRowNo: 2 }),
      ]);
      await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accPdcRegister.create).not.toHaveBeenCalled();
    });

    it('refuses a cheque already registered for the customer elsewhere', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValue([makeChequeTender()]);
      // Nothing hanging off this order's own tenders, but the number is taken
      // by an instrument that came in on another document.
      prisma.accPdcRegister.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makePdcRow({ apdTenderId: LINE_A_ID })]);
      await expect(service.save(baseDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accPdcRegister.create).not.toHaveBeenCalled();
    });

    // Everything past HELD belongs to the PDC screen: the deposit slip, the
    // clearing voucher and the bounce charges all hang off these columns.
    it('refuses to change a cheque the bank has already seen', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accPdcRegister.findMany.mockResolvedValue([makePdcRow({ apdStatus: 'DEPOSITED' })]);
      prisma.accTenderDetail.findMany.mockResolvedValue([
        makeChequeTender({ tdTotalAmt: new Prisma.Decimal('750.00') }),
      ]);
      await expect(service.save(baseDto({ soId: SALE_ORDER_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.accPdcRegister.update).not.toHaveBeenCalled();
    });

    it('refuses to drop a cheque the bank has already cleared', async () => {
      prisma.accVoucherHeader.findFirst.mockResolvedValue(liveVoucher);
      prisma.accPdcRegister.findMany.mockResolvedValue([makePdcRow({ apdStatus: 'CLEARED' })]);
      prisma.accTenderDetail.findMany.mockResolvedValue([makeTender()]);
      await expect(service.save(baseDto({ soId: SALE_ORDER_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
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

    // so_advance_status dropped NOT NULL in migration 20260810150000, and
    // ck_so_advance_status is an `= ANY (...)` test that a NULL satisfies — so an
    // explicit null is a legal "no advance state yet", not a missing field.
    it('accepts a null soAdvanceStatus and stores it', async () => {
      await service.save(baseDto({ soAdvanceStatus: null }));
      expect(prisma.saleOrder.create).toHaveBeenCalledWith({
        data: containing({ soAdvanceStatus: null }),
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

    // Judged against the BILLABLE quantity, which is what the generated
    // soi_pending_qty is computed from — a payload that cuts it below what the
    // line has already delivered would make the column negative, and
    // ck_soi_qty_signs would answer with a constraint name the client cannot act
    // on. The 400 names soiNetQty instead.
    it('judges the quantity balance against the merged line on update', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(makeOrder());
      const line = makeItem({
        soiOrderQty: new Prisma.Decimal('10.000'),
        soiDeliveredQty: new Prisma.Decimal('4.000'),
      });
      prisma.saleOrderItem.findMany.mockResolvedValue([line]);
      // Payload cuts the billable quantity below what was already delivered.
      await expect(
        service.save(
          baseDto({
            soId: SALE_ORDER_ID,
            items: [{ soiId: LINE_A_ID, soiNetQty: 3 } as SaveSaleOrderItemDto],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Raising it instead is written straight through, and the DB re-derives
      // what is left pending off it.
      await service.save(
        baseDto({
          soId: SALE_ORDER_ID,
          items: [{ soiId: LINE_A_ID, soiNetQty: 12 } as SaveSaleOrderItemDto],
        }),
      );
      expect(prisma.saleOrderItem.update).toHaveBeenCalledWith(
        containing({
          where: { soiId_soiAccYear: { soiId: LINE_A_ID, soiAccYear: ACC_YEAR } },
          data: containing({ soiNetQty: 12 }),
        }),
      );
      const updated = prisma.saleOrderItem.update.mock.calls.at(-1)![0].data;
      expect(updated).not.toHaveProperty('soiPendingQty');
    });
  });

  describe('getById', () => {
    it('answers 404 when nothing active matches', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);
      await expect(
        service.getById(SALE_ORDER_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the order with items and resolved names', async () => {
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

  describe('getSrcDocPendingAmount', () => {
    it('totals abl_pending_amount over the live rows raised against the source document', async () => {
      prisma.accBillBalance.aggregate.mockResolvedValue({
        _sum: { ablPendingAmount: new Prisma.Decimal('5000.00') },
      });
      const result = await service.getSrcDocPendingAmount('SALES_ORDER', SALE_ORDER_ID, ACC_YEAR);
      expect(result).toEqual({ ablPendingAmount: 5000 });
      expect(prisma.accBillBalance.aggregate).toHaveBeenCalledWith({
        _sum: { ablPendingAmount: true },
        where: {
          ablSrcDocType: 'SALES_ORDER',
          ablSrcDocId: SALE_ORDER_ID,
          ablSrcAccYear: ACC_YEAR,
          ablIsDeleted: false,
        },
      });
    });

    it('filters on the source tuple alone, never on the bill year', async () => {
      await service.getSrcDocPendingAmount('SALES_ORDER', SALE_ORDER_ID, ACC_YEAR);
      // A bill stays in the partition of the year it was RAISED in, so an
      // advance adjusted in a later FY must still be found by its order year.
      const [args] = prisma.accBillBalance.aggregate.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(args.where).not.toHaveProperty('ablAccYear');
    });

    it('normalises the doc type the way cancel-lines normalises its module', async () => {
      await service.getSrcDocPendingAmount(' sales-order ', SALE_ORDER_ID, ACC_YEAR);
      expect(prisma.accBillBalance.aggregate).toHaveBeenCalledWith(
        containing({ where: containing({ ablSrcDocType: 'SALES_ORDER' }) }),
      );
    });

    it('answers 0 for a document with no bill row rather than 404', async () => {
      const result = await service.getSrcDocPendingAmount('SALES_ORDER', SALE_ORDER_ID, ACC_YEAR);
      expect(result).toEqual({ ablPendingAmount: 0 });
    });

    it('rejects an empty doc type instead of matching every row that has none', async () => {
      await expect(
        service.getSrcDocPendingAmount('   ', SALE_ORDER_ID, ACC_YEAR),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accBillBalance.aggregate).not.toHaveBeenCalled();
    });

    it('rejects a malformed accounting year instead of reading it back as nothing pending', async () => {
      await expect(
        service.getSrcDocPendingAmount('SALES_ORDER', SALE_ORDER_ID, '2026'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accBillBalance.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('cascades the soft delete to items, charges and tenders', async () => {
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

  describe('cancelOpenLines', () => {
    // The last saleOrderItem.update issued for a given line, which is what the
    // row ends up holding.
    const lineUpdate = (soiId: string): Prisma.SaleOrderItemUncheckedUpdateInput | undefined => {
      const call = prisma.saleOrderItem.update.mock.calls
        .filter(([args]) => args.where.soiId_soiAccYear.soiId === soiId)
        .pop();
      return call?.[0].data;
    };
    const headerUpdate = (): Record<string, unknown> =>
      (prisma.saleOrder.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data;

    it('moves a fully open line into cancelled and settles the order', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiOrderQty: new Prisma.Decimal('10.000'),
          soiDeliveredQty: new Prisma.Decimal('0.000'),
          soiCancelledQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('10.000'),
          soiNetAmt: new Prisma.Decimal('1000.00'),
        } as Partial<SaleOrderItem>),
      ]);
      const result = await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {
        soiCancelReason: 'Customer withdrew the balance',
      });
      // Only the cancelled quantity is written: moving pending into it is what
      // drives the two GENERATED columns, which the DB answers back with.
      expect(lineUpdate(LINE_A_ID)).toEqual(containing({ soiCancelledQty: 10 }));
      expect(result.lines).toEqual([containing({ soiCancelledQty: 10, soiLineStatus: 'CANCELLED' })]);
      expect(headerUpdate()).toEqual(
        containing({
          soStatus: 'CANCELLED',
          soFulfilStatus: 'CANCELLED',
          soCancelledAmt: 1000,
          soPendingAmt: 0,
        }),
      );
      expect(result).toEqual(
        containing({ cancelledLines: 1, cancelledQty: 10, soFulfilStatus: 'CANCELLED' }),
      );
      // The status move is a step in the trail, carrying the caller's reason —
      // sale_order has no cancellation column to hold it.
      expect(appendTxnStatusLog).toHaveBeenCalledWith(
        expect.anything(),
        containing({
          srcModule: 'SALES',
          srcDocType: 'SALES_ORDER',
          srcDocId: SALE_ORDER_ID,
          accYear: ACC_YEAR,
          event: 'CANCELLED',
          fromStatus: 'DRAFT',
          toStatus: 'CANCELLED',
          remarks: 'Customer withdrew the balance',
        }),
      );
    });

    // The one reason the caller states lands in both places: the line column
    // and the trail step asserted above.
    it('writes soiCancelReason on every line it closes out, and only when given', async () => {
      const openLine = {
        soiOrderQty: new Prisma.Decimal('10.000'),
        soiDeliveredQty: new Prisma.Decimal('0.000'),
        soiCancelledQty: new Prisma.Decimal('0.000'),
        soiPendingQty: new Prisma.Decimal('10.000'),
        soiNetAmt: new Prisma.Decimal('1000.00'),
      } as Partial<SaleOrderItem>;
      prisma.saleOrderItem.findMany.mockResolvedValue([makeItem(openLine)]);
      await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {
        soiCancelReason: 'Item discontinued',
      });
      expect(lineUpdate(LINE_A_ID)).toEqual(
        containing({ soiCancelReason: 'Item discontinued', soiCancelledQty: 10 }),
      );
      expect(appendTxnStatusLog).toHaveBeenCalledWith(
        expect.anything(),
        containing({ remarks: 'Item discontinued' }),
      );
      // Omitted, the column is left alone rather than blanked — a line
      // cancelled earlier keeps the reason it was given then.
      prisma.saleOrderItem.update.mockClear();
      prisma.saleOrderItem.findMany.mockResolvedValue([makeItem(openLine)]);
      await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      expect(lineUpdate(LINE_A_ID)).not.toHaveProperty('soiCancelReason');
    });

    // Ordered 10, delivered 2, so the remaining 8 is written off. Nothing is
    // outstanding on the line afterwards, so it is one of so_delivered_items and
    // the order — its only line — is COMPLETED rather than left at PARTIAL
    // waiting on 8 units nobody is going to deliver.
    it('settles a part-delivered line and completes the order', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiOrderQty: new Prisma.Decimal('10.000'),
          soiDeliveredQty: new Prisma.Decimal('2.000'),
          soiCancelledQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('8.000'),
          soiNetAmt: new Prisma.Decimal('1000.00'),
          soiBilledAmt: new Prisma.Decimal('200.00'),
        } as Partial<SaleOrderItem>),
      ]);
      const result = await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      expect(lineUpdate(LINE_A_ID)).toEqual(containing({ soiCancelledQty: 8 }));
      expect(result.lines).toEqual([containing({ soiLineStatus: 'PARTIAL' })]);
      expect(headerUpdate()).toEqual(
        containing({
          soStatus: 'COMPLETED',
          soFulfilStatus: 'COMPLETED',
          // 8 of 10 units of a 1000.00 line.
          soCancelledAmt: 800,
          soPendingAmt: 0,
          soBilledAmt: 200,
          // Delivered 2 and wrote off the rest: the line has nothing left to
          // settle, so it counts.
          soDeliveredItems: 1,
        }),
      );
      expect(result).toEqual(containing({ cancelledLines: 1, cancelledQty: 8 }));
    });

    // so_delivered_items is every SETTLED line: the one that shipped whole and
    // the one this call writes off both stop being outstanding, so the order has
    // nothing left and reads COMPLETED. The delivered line is not rewritten.
    it('counts delivered and cancelled lines alike in soDeliveredItems', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiId: LINE_A_ID,
          soiLineNo: 1,
          soiOrderQty: new Prisma.Decimal('10.000'),
          soiDeliveredQty: new Prisma.Decimal('10.000'),
          soiCancelledQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('0.000'),
          soiLineStatus: 'DELIVERED',
          soiNetAmt: new Prisma.Decimal('1000.00'),
        } as Partial<SaleOrderItem>),
        makeItem({
          soiId: LINE_B_ID,
          soiLineNo: 2,
          soiOrderQty: new Prisma.Decimal('5.000'),
          soiDeliveredQty: new Prisma.Decimal('0.000'),
          soiCancelledQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('5.000'),
          soiNetAmt: new Prisma.Decimal('500.00'),
        } as Partial<SaleOrderItem>),
      ]);
      const result = await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      expect(lineUpdate(LINE_A_ID)).toBeUndefined();
      expect(lineUpdate(LINE_B_ID)).toEqual(containing({ soiCancelledQty: 5 }));
      expect(headerUpdate()).toEqual(
        containing({
          soStatus: 'COMPLETED',
          soFulfilStatus: 'COMPLETED',
          soTotItems: 2,
          soDeliveredItems: 2,
          soCancelledAmt: 500,
        }),
      );
      expect(result.cancelledLines).toBe(1);
    });

    // PUT, so a repeat must be a no-op rather than a second cancellation.
    it('is idempotent: a second call finds nothing open and writes no line', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiOrderQty: new Prisma.Decimal('10.000'),
          soiDeliveredQty: new Prisma.Decimal('0.000'),
          soiCancelledQty: new Prisma.Decimal('10.000'),
          soiPendingQty: new Prisma.Decimal('0.000'),
          soiLineStatus: 'CANCELLED',
          soiNetAmt: new Prisma.Decimal('1000.00'),
        } as Partial<SaleOrderItem>),
      ]);
      prisma.saleOrder.findFirst.mockResolvedValue(makeOrder({ soStatus: 'CANCELLED' }));
      const result = await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      expect(result).toEqual(containing({ cancelledLines: 0, cancelledQty: 0, lines: [] }));
      expect(prisma.saleOrderItem.update).not.toHaveBeenCalled();
      // The header caches are still reconciled — they were caller-stated until
      // this endpoint existed — but nothing moved, so soStatus is unchanged and
      // the trail gains no second row.
      expect(headerUpdate()).toEqual(containing({ soStatus: 'CANCELLED', soCancelledAmt: 1000 }));
      expect(appendTxnStatusLog).not.toHaveBeenCalled();
    });

    // soi_pending_qty and soi_line_status are GENERATED (migration
    // 20260814060000): naming either in the statement is a Postgres 428C9, not a
    // redundant assignment, so the cancel writes the cancelled quantity alone and
    // lets the derivation follow.
    it('never names the generated columns in the statement it writes', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({ soiCancelledQty: new Prisma.Decimal('6.000') } as Partial<SaleOrderItem>),
      ]);
      await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      expect(prisma.saleOrderItem.update).toHaveBeenCalled();
      for (const [args] of prisma.saleOrderItem.update.mock.calls) {
        expect(args.data).toHaveProperty('soiCancelledQty');
        expect(args.data).not.toHaveProperty('soiPendingQty');
        expect(args.data).not.toHaveProperty('soiLineStatus');
      }
    });

    // Nothing open and nothing ever cancelled: the order is COMPLETED, and that
    // is the one outcome that stamps so_completed_on.
    it('settles a fully delivered order as COMPLETED and stamps soCompletedOn', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiOrderQty: new Prisma.Decimal('10.000'),
          soiDeliveredQty: new Prisma.Decimal('10.000'),
          soiCancelledQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('0.000'),
          soiLineStatus: 'DELIVERED',
          soiNetAmt: new Prisma.Decimal('1000.00'),
          soiBilledAmt: new Prisma.Decimal('1000.00'),
        } as Partial<SaleOrderItem>),
      ]);
      await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      expect(headerUpdate()).toEqual(
        containing({
          soStatus: 'COMPLETED',
          soFulfilStatus: 'COMPLETED',
          soDeliveredItems: 1,
          soCancelledAmt: 0,
          soBilledAmt: 1000,
          soCompletedOn: expect.any(Date),
        }),
      );
    });

    it('rejects a source module that names neither SALES nor an order doc type before touching the database', async () => {
      await expect(
        service.cancelOpenLines('PURCHASE', SALE_ORDER_ID, ACC_YEAR, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleOrder.findFirst).not.toHaveBeenCalled();
    });

    // A bill and a delivery challan are documents of their own, each with its
    // own endpoints. Reaching an order's lines through THIS one is the mistake
    // the guard exists to catch, so neither token gets past it.
    it.each(['SALE_BILL', 'BILL', 'DELIVERY_CHALLAN', 'DC'])(
      'refuses %s as a source module',
      async (srcModule) => {
        await expect(
          service.cancelOpenLines(srcModule, SALE_ORDER_ID, ACC_YEAR, {}),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.saleOrder.findFirst).not.toHaveBeenCalled();
      },
    );

    // The sales line screen holds the order as the source tuple it stores, whose
    // discriminator is the doc type, so it forwards SALES_ORDER where the
    // parameter is named for the module. BOOKING and CUSTOM_ORDER are the same
    // path from a screen whose order carries either so_doc_type. All name this
    // document, so all are honoured.
    it.each(['SALES_ORDER', 'BOOKING', 'CUSTOM_ORDER'])(
      'accepts the %s doc-type spelling of the source module',
      async (srcModule) => {
        prisma.saleOrderItem.findMany.mockResolvedValue([
          makeItem({
            soiOrderQty: new Prisma.Decimal('10.000'),
            soiDeliveredQty: new Prisma.Decimal('0.000'),
            soiCancelledQty: new Prisma.Decimal('0.000'),
            soiPendingQty: new Prisma.Decimal('10.000'),
            soiNetAmt: new Prisma.Decimal('1000.00'),
          } as Partial<SaleOrderItem>),
        ]);
        const result = await service.cancelOpenLines(srcModule, SALE_ORDER_ID, ACC_YEAR, {});
        expect(result).toEqual(containing({ cancelledLines: 1, soFulfilStatus: 'CANCELLED' }));
      },
    );

    it('answers 404 when nothing active matches the source tuple', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);
      await expect(
        service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // The calling screen has the order LINE in front of it, so soi_id is the
    // nearer id to hand — and naming a line means that line only. Its open
    // sibling is what keeps the order PARTIAL rather than settling it.
    it('cancels only the named line when srcDocId is a line id', async () => {
      // Nothing matches as an order id; the line lookup then resolves the order.
      prisma.saleOrder.findFirst.mockResolvedValueOnce(null);
      prisma.saleOrderItem.findFirst.mockResolvedValue(
        makeItem({ soiId: LINE_A_ID, soiOrderId: SALE_ORDER_ID, soiLineNo: 1 }),
      );
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiId: LINE_A_ID,
          soiLineNo: 1,
          soiOrderQty: new Prisma.Decimal('10.000'),
          soiDeliveredQty: new Prisma.Decimal('0.000'),
          soiCancelledQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('10.000'),
          soiNetAmt: new Prisma.Decimal('1000.00'),
        } as Partial<SaleOrderItem>),
        makeItem({
          soiId: LINE_B_ID,
          soiLineNo: 2,
          soiOrderQty: new Prisma.Decimal('5.000'),
          soiDeliveredQty: new Prisma.Decimal('0.000'),
          soiCancelledQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('5.000'),
          soiNetAmt: new Prisma.Decimal('500.00'),
        } as Partial<SaleOrderItem>),
      ]);

      const result = await service.cancelOpenLines('SALES', LINE_A_ID, ACC_YEAR, {
        soiCancelReason: 'Line withdrawn',
      });

      expect(lineUpdate(LINE_A_ID)).toEqual(
        containing({ soiCancelledQty: 10, soiCancelReason: 'Line withdrawn' }),
      );
      expect(result.lines).toEqual([containing({ soiLineStatus: 'CANCELLED' })]);
      // The sibling is wide open and stays that way.
      expect(lineUpdate(LINE_B_ID)).toBeUndefined();
      expect(result).toEqual(
        containing({
          soId: SALE_ORDER_ID,
          cancelledLines: 1,
          cancelledQty: 10,
          soCancelledAmt: 1000,
          soPendingAmt: 500,
        }),
      );
      // One line of two is settled, so the order is PARTIAL — but so_status is
      // left alone, because a line still outstanding means nothing here may
      // claim the order itself is finished.
      expect(headerUpdate()).toEqual(
        containing({
          soFulfilStatus: 'PARTIAL',
          soDeliveredItems: 1,
          soTotItems: 2,
          soCancelledAmt: 1000,
          soPendingAmt: 500,
        }),
      );
      expect(headerUpdate()).not.toHaveProperty('soStatus');
      expect(appendTxnStatusLog).not.toHaveBeenCalled();
      // Addressed by the line, but the header it writes is still the order's.
      expect(prisma.saleOrder.updateMany).toHaveBeenCalledWith(
        containing({ where: containing({ soId: SALE_ORDER_ID }) }),
      );
      expect(prisma.saleOrderItem.findMany).toHaveBeenCalledWith(
        containing({ where: containing({ soiOrderId: SALE_ORDER_ID }) }),
      );
    });

    // A line id that resolves to nothing is as much a 404 as an unknown order —
    // the soft-deleted ones included, which the lookup filters out.
    it('answers 404 when srcDocId matches neither an order nor a line', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(null);
      prisma.saleOrderItem.findFirst.mockResolvedValue(null);
      await expect(
        service.cancelOpenLines('SALES', LINE_A_ID, ACC_YEAR, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.saleOrder.updateMany).not.toHaveBeenCalled();
    });

    // The calling screen spells the doc type with a space; it names the same
    // document, so it is honoured rather than bounced.
    it('accepts a spaced or hyphenated source module', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({ soiPendingQty: new Prisma.Decimal('10.000') } as Partial<SaleOrderItem>),
      ]);
      await expect(
        service.cancelOpenLines('sales order', SALE_ORDER_ID, ACC_YEAR, {}),
      ).resolves.toEqual(containing({ cancelledLines: 1 }));
      await expect(
        service.cancelOpenLines('Sales-Order', SALE_ORDER_ID, ACC_YEAR, {}),
      ).resolves.toEqual(containing({ cancelledLines: 1 }));
    });

    it('refuses to cancel an order outright while it still holds an advance', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(
        makeOrder({ soAdvanceBalanceAmt: new Prisma.Decimal('250.00') }),
      );
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiDeliveredQty: new Prisma.Decimal('0.000'),
          soiPendingQty: new Prisma.Decimal('10.000'),
        } as Partial<SaleOrderItem>),
      ]);
      await expect(
        service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleOrderItem.update).not.toHaveBeenCalled();
      expect(prisma.saleOrder.updateMany).not.toHaveBeenCalled();
    });

    // The guard is narrowed, not a blanket copy of softDelete's: money held
    // against an order that DID deliver is legitimate.
    it('allows a part-delivered cancel even while an advance balance is held', async () => {
      prisma.saleOrder.findFirst.mockResolvedValue(
        makeOrder({ soAdvanceBalanceAmt: new Prisma.Decimal('250.00') }),
      );
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({
          soiOrderQty: new Prisma.Decimal('10.000'),
          soiDeliveredQty: new Prisma.Decimal('2.000'),
          soiPendingQty: new Prisma.Decimal('8.000'),
        } as Partial<SaleOrderItem>),
      ]);
      const result = await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      // COMPLETED, not CANCELLED: the guard only refuses an order that never
      // delivered anything, and this one shipped 2 of 10 before the rest was
      // written off.
      expect(result.soFulfilStatus).toBe('COMPLETED');
      expect(prisma.saleOrderItem.update).toHaveBeenCalled();
    });

    it('logs the header cancel and each line it closed', async () => {
      prisma.saleOrderItem.findMany.mockResolvedValue([
        makeItem({ soiPendingQty: new Prisma.Decimal('10.000') } as Partial<SaleOrderItem>),
      ]);
      await service.cancelOpenLines('SALES', SALE_ORDER_ID, ACC_YEAR, {});
      expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
        containing({ action: 'update', tableName: 'sale_order_item', pk: LINE_A_ID }),
        expect.anything(),
      );
      expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
        containing({ action: 'cancel', tableName: 'sale_order', pk: SALE_ORDER_ID }),
        expect.anything(),
      );
    });
  });
});
