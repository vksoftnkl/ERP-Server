import { Injectable } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { SaveSaleOrderItemDto } from './dto/save-sale-order-item.dto';
import {
  SALE_ORDER_CANCEL_SRC_MODULES,
  SALE_ORDER_CHARGE_AUDIT,
  SALE_ORDER_CHARGE_DOC_TYPE,
  SALE_ORDER_DOC_TYPES,
  SALE_ORDER_SRC_DOC_TYPE,
  SALE_ORDER_STATUS_SRC_DOC_TYPE,
  SALE_ORDER_STATUS_SRC_MODULE,
  SALE_ORDER_TENDER_AUDIT,
  SALE_ORDER_TENDER_DR_CR,
  SALE_ORDER_TENDER_SRC_DOC_TYPE,
  SALE_ORDER_TENDER_SRC_MODULE,
  SaleOrderCancelLinesResult,
  SaleOrderCancelledLine,
  SaleOrderChargePayload,
  SaleOrderErrorDetail,
  SaleOrderErrorResponse,
  SaleOrderFulfilledLine,
  SaleOrderFulfilmentResult,
  SaleOrderItemPayload,
  SaleOrderLineRef,
  SaleOrderPayload,
  SaleOrderSrcDocFields,
  SaleOrderSrcDocPendingAmount,
  SaleOrderTenderPayload,
} from './types/sale-order-api.types';
// Which sale bills draw quantity down off an order line. Imported rather than
// restated so the two modules can never disagree about what "billed" means; the
// dependency only points this way, so it adds no cycle to the sale-bill module
// that calls syncOrderFulfilment.
import { BILL_STATUS_POSTED } from '../bill/types/bill-api.types';
import { CancelSaleOrderLinesDto } from './dto/cancel-sale-order-lines.dto';
import {
  TxnStatusEvent,
  appendTxnStatusLog,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { ChargeDocumentScope } from '../../master/charge-detail/types/charge-detail-api.types';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDocumentScope } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import {
  DEFAULT_ACTOR,
  PresentFieldTransform,
  SalesWriteClient,
  applyPresentFields,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
import {
  OrderAdvancePostingSyncResult,
  deleteOrderAdvancePosting,
  syncOrderAdvancePosting,
} from './order-advance-posting.helper';
// accounts.acc_voucher_types row "SOr" / Sales Order (seeded by
// prisma/seed/Acc_Voucher_Types_Sale_Order.sql). Its numbering format
// (prefix / width / reset frequency) seeds the acc_voucher_seq row the order
// numbers are drawn from.
const SALE_ORDER_VCHR_TYPE_ID = 4;
const SALE_ORDER_TABLE_NAME = 'sale_order';
const SALE_ORDER_ITEM_TABLE_NAME = 'sale_order_item';
const SALE_ORDER_AUDIT_SCREEN_NAME = 'Sale Order';
// Allowed-value sets mirroring the DB CHECK constraints on sale_order /
// sale_order_item (migration 20260808132323). Unlike
// sale_bill — whose ck_sb_* constraints were dropped before ever being applied —
// these constraints EXIST in the database; the mirrors below are so a bad value
// comes back as a 400 naming the field instead of a raw Postgres 23514, with
// the DB as the backstop.
//
// ck_so_doc_type's mirror is the one exception to "defined here": the cancel
// endpoint's srcModule vocabulary is built from it, so SALE_ORDER_DOC_TYPES
// lives in the types file where both readers can see it.
const SALE_ORDER_TYPES = ['CASH', 'CREDIT'] as const;
const SALE_ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const SALE_ORDER_DELIVERY_MODES = [
  'STORE_PICKUP',
  'HOME_DELIVERY',
  'SHIP_FROM_STORE',
  'COURIER',
  'TRANSPORT',
] as const;
const SALE_ORDER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'PARTIAL',
  'COMPLETED',
  'CANCELLED',
  'CLOSED',
  'EXPIRED',
] as const;
// The status a soft-deleted order is left in. sale_order has no cancellation
// columns of its own — who cancelled and why is public.txn_status_log's fact —
// so the status move is all the header records.
const SALE_ORDER_STATUS_CANCELLED = 'CANCELLED';
const SALE_ORDER_FULFIL_STATUSES = ['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED'] as const;
const SALE_ORDER_PAY_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'] as const;
const SALE_ORDER_ADVANCE_POLICIES = ['NONE', 'FIXED', 'PERC', 'FULL'] as const;
const SALE_ORDER_ADVANCE_STATUSES = [
  'NONE',
  'PENDING',
  'PARTIAL',
  'RECEIVED',
  'ADJUSTED',
  'REFUNDED',
  'FORFEITED',
] as const;
const SALE_ORDER_ITEM_FREE_TYPES = ['SCHEME', 'SAMPLE', 'REPLACEMENT'] as const;
// ck_soi_line_status. No code picks between these any more — soi_line_status is
// GENERATED from the three quantities (migration 20260814060000), so the CASE in
// the DB is the only place the choice is made and every path reads the value
// back off the row it just wrote. The vocabulary is still stated here because a
// payload may carry the column and gets told when it names something that is not
// one of these.
const SALE_ORDER_ITEM_LINE_STATUSES = ['PENDING', 'PARTIAL', 'DELIVERED', 'CANCELLED'] as const;
// Header fulfilment states the recompute can land on. COMPLETED / PARTIAL are
// shared with ck_so_status, which is why the same tokens serve both columns.
const SALE_ORDER_FULFIL_PENDING = 'PENDING';
const SALE_ORDER_FULFIL_PARTIAL = 'PARTIAL';
const SALE_ORDER_FULFIL_COMPLETED = 'COMPLETED';
const SALE_ORDER_FULFIL_CANCELLED = 'CANCELLED';
// The remark carried by a status step a BILL drove. ck_tsl_reason_required
// wants one on a CANCELLED step, and an order whose status moved because a bill
// was raised or retired against it has no reason of its own to give.
const SALE_ORDER_FULFIL_STATUS_REMARK = 'Order fulfilment recomputed from its sale bills';
// One order a fulfilment recompute has to visit, with every reference the
// calling document made to it folded into a single visit: the line numbers it
// named, and the field names each rejection should be worded from.
type OrderFulfilmentTarget = {
  soId: string;
  soAccYear: string;
  lineNos: Set<number>;
  fields: SaleOrderSrcDocFields;
  // Null when the order was reached only by a header reference — nothing named
  // a line, so no unknown-line rejection can arise to need the name.
  lineNoField: string | null;
};
// Every acc-year column in the database is char(9) in the `YYYY-YYYY` form —
// ck_abl_src_acc_year enforces it on the column this pattern guards. Checked at
// the edge so a malformed year answers 400 naming the field, rather than
// matching no row and reading back as a perfectly innocent "nothing pending".
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const SALE_ORDER_VALUE_GUARDS = [
  { field: 'soDocType', allowed: SALE_ORDER_DOC_TYPES, nullable: false },
  { field: 'soOrderType', allowed: SALE_ORDER_TYPES, nullable: false },
  { field: 'soPriority', allowed: SALE_ORDER_PRIORITIES, nullable: false },
  { field: 'soDeliveryMode', allowed: SALE_ORDER_DELIVERY_MODES, nullable: false },
  { field: 'soStatus', allowed: SALE_ORDER_STATUSES, nullable: false },
  { field: 'soFulfilStatus', allowed: SALE_ORDER_FULFIL_STATUSES, nullable: false },
  { field: 'soPayStatus', allowed: SALE_ORDER_PAY_STATUSES, nullable: false },
  { field: 'soAdvancePolicy', allowed: SALE_ORDER_ADVANCE_POLICIES, nullable: false },
  // Nullable since migration 20260810150000: so_advance_status dropped NOT NULL,
  // and ck_so_advance_status is an `= ANY (...)` test, which a NULL satisfies.
  // A payload that explicitly sends null means "no advance state yet".
  { field: 'soAdvanceStatus', allowed: SALE_ORDER_ADVANCE_STATUSES, nullable: true },
] as const satisfies ReadonlyArray<{
  field: string;
  allowed: readonly string[];
  nullable: boolean;
}>;
type SaleOrderGuardedField = (typeof SALE_ORDER_VALUE_GUARDS)[number]['field'];
type SaleOrderGuardedValues = Partial<Record<SaleOrderGuardedField, string | null | undefined>>;
// Tolerances for the cross-field equations mirrored from the DB: the CHECKs
// compare round(x, 2) / round(x, 3) exactly, so the app-side judgment allows
// only float noise below the last kept digit.
const AMOUNT_EPSILON = 0.005; // numeric(15,2) columns
const QTY_EPSILON = 0.0005; // numeric(15,3) columns
// Header fields copied straight through when present on the payload. The
// partition/scope keys (soCompanyId, soBranchId, soTenantId, soAccYear,
// soPriceLevel, soUserId) and the server-assigned number (soOrderSlno /
// soOrderRefno) are intentionally excluded — see the README's "Order numbering"
// section.
const SALE_ORDER_OPTIONAL_FIELDS = [
  'soSessionId',
  'soDeviceId',
  'soDocType',
  'soOrderType',
  'soUsrRefno',
  'soOrderDate',
  'soOrderDatetime',
  'soDeliveryDate',
  'soDeliverySlot',
  'soPriority',
  'soValidUntil',
  'soSrcDocType',
  'soSrcDocId',
  'soSrcDocAccYear',
  'soSrcDocRefno',
  'soSrcDocDate',
  'soDeliveryMode',
  'soCustId',
  'soCustName',
  'soCustAddr',
  'soCustPlace',
  'soCustPin',
  'soCustPhone',
  'soCustEmail',
  'soCustGstin',
  'soCustGstType',
  'soCustStcd',
  'soPosStcd',
  'soStateName',
  'soContactPerson',
  'soContactPhone',
  'soShipName',
  'soShipAddr',
  'soShipPlace',
  'soShipPin',
  'soShipPhone',
  'soShipStcd',
  'soShipLandmark',
  'soShipLat',
  'soShipLng',
  'soHasLoad',
  'soHasUnload',
  'soHasFreight',
  'soHasPromo',
  'soHasComm',
  'soHasLoyalty',
  'soSalesmanId',
  'soAgentId',
  'soAgentCommPerc',
  'soAgentCommAmt',
  'soPackedId',
  'soTotItems',
  'soDeliveredItems',
  'soTotWeight',
  'soTotBags',
  'soGrossAmt',
  'soItemDisc',
  'soSplDisc',
  'soSchDisc',
  'soBillSchDisc',
  'soAddlDisc1',
  'soAddlDisc2',
  'soCashDiscPerc',
  'soCashDisc',
  'soTaxableAmt',
  'soCgstAmt',
  'soSgstAmt',
  'soIgstAmt',
  'soCessAmt',
  'soTaxAmt',
  'soFreightAmt',
  'soLoadAmt',
  'soUnloadAmt',
  'soOtherAmt1',
  'soOtherAmt2',
  'soRoundOff',
  'soOrderAmt',
  'soTotalCost',
  'soMarginAmt',
  'soMarginAmtWot',
  'soMarginPerc',
  'soMarginPercWot',
  'soMrpSavings',
  'soMrpSavingsPerc',
  'soAdvancePolicy',
  'soAdvancePerc',
  'soAdvanceRequired',
  'soAdvanceDueDate',
  'soIsAdvanceMandatory',
  'soAdvanceLedgerId',
  'soAdvanceRecdAmt',
  'soAdvanceAdjustedAmt',
  'soAdvanceRefundAmt',
  'soAdvanceForfeitAmt',
  'soAdvanceBalanceAmt',
  'soAdvanceStatus',
  'soAdvanceRecdOn',
  'soPayMode',
  'soSurchargeAmt',
  'soTenderAmt',
  'soRefundAmt',
  'soPayStatus',
  'soBilledAmt',
  'soCancelledAmt',
  'soPendingAmt',
  'soFulfilStatus',
  'soLastBilledOn',
  'soCompletedOn',
  'soPaymentTerms',
  'soDeliveryTerms',
  'soTermsConditions',
  'soRemarks',
  'soFreightCalcType',
  'soLoadingCalcType',
  'soDiscAlterBase',
  'soRoundOffStep',
  'soStatus',
  'soVersionNo',
  'soPrintCount',
];
// Line-item fields copied straight through when present on the payload. The
// scope keys (order/company/branch/tenant/accYear/lineNo/priceLevel) and the
// two fields required for a new line (soiItemId, soiItemUnitId) are set
// explicitly, so they are excluded here.
//
// soiPendingQty and soiLineStatus are excluded for a different reason: since
// migration 20260814060000 the DB DERIVES both (GENERATED ALWAYS ... STORED),
// and Postgres answers 428C9 to any statement that names a generated column.
// The payload may still carry them — a client round-tripping a GET response
// does — and they are validated below, but they are never written.
const SALE_ORDER_ITEM_OPTIONAL_FIELDS = [
  'soiSrcDocType',
  'soiSrcDocId',
  'soiSrcDocAccYear',
  'soiSrcDocRefno',
  'soiSrcLineNo',
  'soiToBaseFactor',
  'soiHsnCode',
  'soiEanCode',
  'soiSize',
  'soiSizeUom',
  'soiGodownId',
  'soiIsReserved',
  'soiReservedQty',
  'soiReserveExpiresOn',
  'soiIsTaxIncl',
  'soiIsPromo',
  'soiIsFree',
  'soiFreeType',
  'soiIsService',
  'soiHasFreight',
  'soiCaseQty',
  'soiOrderQty',
  'soiLengthQty',
  'soiNetQty',
  'soiWeightQty',
  'soiAvailableStock',
  'soiDeliveredQty',
  'soiCancelledQty',
  'soiBilledAmt',
  'soiRate',
  'soiRatePreTax',
  'soiRateDiff',
  'soiActPrice',
  'soiMaxPrice',
  'soiMinPrice',
  'soiCostPrice',
  'soiCostPreTax',
  'soiIsRateLocked',
  'soiItemDiscPerc',
  'soiItemDiscQty',
  'soiItemDiscAmt',
  'soiSplDiscPerc',
  'soiSplDiscQty',
  'soiSplDiscAmt',
  'soiSchDiscPerc',
  'soiSchDiscQty',
  'soiSchDiscAmt',
  'soiBillSchPerc',
  'soiBillSchQty',
  'soiBillSchAmt',
  'soiAddlDisc1Perc',
  'soiAddlDisc1Amt',
  'soiAddlDisc2Perc',
  'soiAddlDisc2Amt',
  'soiCashDiscPerc',
  'soiCashDiscAmt',
  'soiGrossAmt',
  'soiNetGross',
  'soiChrgBeforeTax',
  'soiChrgAfterTax',
  'soiTaxableAmt',
  'soiTaxPerc',
  'soiTaxAmt',
  'soiCgstPerc',
  'soiCgstAmt',
  'soiSgstPerc',
  'soiSgstAmt',
  'soiIgstPerc',
  'soiIgstAmt',
  'soiCessPerc',
  'soiCessPerUnit',
  'soiCessAmt',
  'soiAcessPerc',
  'soiAcessPerUnit',
  'soiAcessAmt',
  'soiFreightQty',
  'soiFreightAmt',
  'soiLoadQty',
  'soiLoadAmt',
  'soiUnloadQty',
  'soiUnloadAmt',
  'soiRoundOff',
  'soiNetAmt',
  'soiSoldPrice',
  'soiSoldPreTax',
  'soiItemProfit',
  'soiProfitPreTax',
  'soiMrpSavings',
  'soiMrpSavingsPerc',
  'soiDeliveryDate',
  'soiSalesmanId',
  'soiSchemeId',
  'soiSchemeName',
  'soiRemarks',
];
// Every date / timestamptz column reachable from the payload. JSON carries them
// as ISO strings, Prisma wants Date objects, so each one is converted on the way
// in (and a malformed value comes back as a 400 naming the field).
const SALE_ORDER_DATE_FIELDS = [
  'soOrderDate',
  'soOrderDatetime',
  'soDeliveryDate',
  'soValidUntil',
  'soSrcDocDate',
  'soAdvanceDueDate',
  'soAdvanceRecdOn',
  'soLastBilledOn',
  'soCompletedOn',
];
const SALE_ORDER_ITEM_DATE_FIELDS = ['soiReserveExpiresOn', 'soiDeliveryDate'];
function toDateOrNull(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const dateValue = new Date(value as string);
  if (Number.isNaN(dateValue.getTime())) {
    throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Validation failed', [
      {
        field,
        message: `${field} must be a valid ISO date`,
      },
    ]);
  }
  return dateValue;
}
function buildDateTransforms(
  fields: readonly string[],
): Partial<Record<string, PresentFieldTransform>> {
  return Object.fromEntries(
    fields.map((field) => [field, (value: unknown) => toDateOrNull(value, field)]),
  );
}
const SALE_ORDER_DATE_TRANSFORMS = buildDateTransforms(SALE_ORDER_DATE_FIELDS);
const SALE_ORDER_ITEM_DATE_TRANSFORMS = buildDateTransforms(SALE_ORDER_ITEM_DATE_FIELDS);
// Payload values arrive as string | number, existing rows carry Prisma.Decimal;
// the cross-field equations below need plain numbers. null/undefined → 0, which
// matches every DEFAULT 0 column involved.
function asNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
// Rounded to the last digit the column actually stores, so a computed value
// never carries float noise into a numeric(15,3) / numeric(15,2) column and the
// DB's own round(x, n) comparisons agree with ours.
function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}
function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}
// payload-first, falling back to the existing row: the merged value the DB
// would actually end up with, which is what the mirrored CHECKs must judge.
// Two type parameters because the two sides differ — the payload carries
// string | number where the stored row carries Prisma.Decimal.
function merged<T, U>(
  inputValue: T | undefined,
  existingValue: U | undefined | null,
): T | U | null {
  if (inputValue !== undefined) {
    return inputValue;
  }
  return existingValue === undefined ? null : existingValue;
}
// The immutable scope inherited by every line / charge / tender row
// from its parent order. The last five are only read by the tender lines, which
// snapshot the document's date, party and capture context (acc_tender_detail
// has no FK back to sale_order to join them from).
interface SaleOrderScope {
  soId: string;
  soCompanyId: string;
  soBranchId: string;
  soTenantId: string | null;
  soAccYear: string;
  soPriceLevel: number;
  soOrderSlno: bigint;
  soOrderDate: Date;
  soCustId: string;
  soUserId: string;
  soSessionId: string | null;
  soDeviceId: string;
}
type SaleOrderWriteClient = SalesWriteClient;
// Only populated when the item was fetched with the item/unit joins (getById);
// create/update paths pass plain SaleOrderItem rows where these are absent.
type SaleOrderItemWithNames = SaleOrderItem & {
  item?: {
    itemNameEn: string;
    itemGroupId: string;
    itemBrandId: string | null;
    itemSectionId: string | null;
    itemCategoryId: string | null;
  } | null;
  itemUnitConversion?: { unit: { unit_name: string; unit_decimal_count: number } } | null;
};
// The master names the GET response labels its id columns with. None of these
// ids has an FK to hang an `include` off — sale_order declares no relation for
// its company / branch / salesman columns, and the charge / tender rows are
// polymorphic — so every map is filled by one batched findMany over the
// distinct ids the order actually carries. Empty on the create/update paths,
// which resolve no display names (see toItemPayload).
interface SaleOrderNameMaps {
  companyNameById: Map<string, string>;
  branchNameById: Map<string, string>;
  employeeNameById: Map<string, string>;
  ledgerNameById: Map<string, string>;
  userNameById: Map<string, string>;
  godownNameById: Map<string, string>;
}
const EMPTY_NAME_MAPS: SaleOrderNameMaps = {
  companyNameById: new Map(),
  branchNameById: new Map(),
  employeeNameById: new Map(),
  ledgerNameById: new Map(),
  userNameById: new Map(),
  godownNameById: new Map(),
};
// The distinct, present ids out of a column gathered across header, lines,
// charges and tenders — nulls dropped, so an all-null column costs no
// query at all.
function distinctIds(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => !!value))];
}
@Injectable()
export class SaleOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    // txn_charge_detail is owned by the charge-detail module: the order hands
    // it the charges[] array and its own scope rather than writing that table
    // itself, so both entry points share one set of guards and one audit trail.
    private readonly chargeDetailService: ChargeDetailService,
    // Same arrangement for acc_tender_detail and the tenders[] array — the
    // advance money the customer handed over against the order.
    private readonly tenderDetailService: TenderDetailService,
  ) {}
  async save(saveOrderDto: SaveSaleOrderDto): Promise<SaleOrderPayload> {
    this.ensureOrderValuesAreAllowed(saveOrderDto);
    if (saveOrderDto.soId) {
      return this.updateOrder(saveOrderDto);
    }
    return this.createOrder(saveOrderDto);
  }
  async getById(
    soId: string,
    soCompanyId: string,
    soBranchId: string,
    soAccYear: string,
  ): Promise<SaleOrderPayload> {
    const record = await this.prisma.saleOrder.findFirst({
      where: {
        soId,
        soCompanyId,
        soBranchId,
        soAccYear,
        soIsDeleted: false,
      },
      include: {
        items: {
          where: { soiIsDeleted: false },
          orderBy: { soiLineNo: 'asc' },
          include: {
            item: {
              select: {
                itemNameEn: true,
                itemGroupId: true,
                itemBrandId: true,
                itemSectionId: true,
                itemCategoryId: true,
              },
            },
            itemUnitConversion: {
              select: { unit: { select: { unit_name: true, unit_decimal_count: true } } },
            },
          },
        },
      },
    });
    if (!record) {
      throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Order not found',
        'soId',
        `No active order found with id ${soId}`,
      );
    }
    // txn_charge_detail is polymorphic (no FK to sale_order), so the applied
    // charges are fetched by discriminator rather than by `include` — through
    // the charge-detail module, which also resolves each line's ledger name.
    const charges = await this.chargeDetailService.getByDocument(SALE_ORDER_CHARGE_DOC_TYPE, soId);
    // acc_tender_detail is polymorphic for the same reason, and read the same
    // way — through its own module, which resolves each line's tender and
    // ledger names.
    const tenders = await this.tenderDetailService.getByDocument(
      SALE_ORDER_TENDER_SRC_MODULE,
      SALE_ORDER_TENDER_SRC_DOC_TYPE,
      soId,
    );
    // The remaining ids — the godown, the company / branch / salesman columns on
    // the header and its lines, and the company / party ledger / user the charge
    // and tender rows carry — have no FK to ride an `include` on, so they are
    // resolved in one batched lookup per master over the ids this order uses.
    const names = await this.resolveDisplayNames(record, charges, tenders);
    return this.toPayload(
      {
        ...record,
        charges,
        tenders,
      },
      names,
    );
  }
  /// What accounts.acc_bill_balance still has outstanding against ONE source
  /// document, addressed by the (abl_src_doc_type, abl_src_doc_id,
  /// abl_src_acc_year) tuple the bill row carries. For a sale order that is its
  /// ADVANCE row's abl_pending_amount: money the customer handed over that no
  /// invoice has eaten yet, which is what an order or bill screen shows as the
  /// advance still available to adjust.
  ///
  /// Read off acc_bill_balance rather than off the header's
  /// so_advance_balance_amt, because the two answer different questions. The
  /// header column is a cache this module writes on save; abl_pending_amount is
  /// a GENERATED column (bill − alloc − disc − writeoff) that moves the moment
  /// an acc_bill_adjustment lands, with no save on the order at all. Accounts
  /// settle against the bill row, so the bill row is what a "how much is left"
  /// question has to be asked of.
  ///
  /// No acc-year filter on the bill itself: a bill lives in the partition of the
  /// year it was RAISED in and is never carried forward, which is not
  /// necessarily the year of the document it points at (an advance adjusted in
  /// the next FY is the ordinary case). So only the source tuple is filtered on
  /// and the read rides ix_abl_src_doc across every partition — the same
  /// reasoning the party credit summary is built on.
  ///
  /// Summed, not read as a single row: an order carries at most one live
  /// ADVANCE row today, but every row against one source document sits on the
  /// same side of the books (an order's advances are all CR), so the total is
  /// the amount outstanding however many rows there turn out to be.
  ///
  /// A document with no row answers 0, not 404. An order that took no advance —
  /// or one whose advance has been adjusted away in full — is an ordinary
  /// state, and a screen asking "how much is left" wants the zero.
  async getSrcDocPendingAmount(
    ablSrcDocType: string,
    ablSrcDocId: string,
    ablSrcAccYear: string,
  ): Promise<SaleOrderSrcDocPendingAmount> {
    // Normalised the way cancelOpenLines normalises its srcModule, and for the
    // same reason: the stored discriminators are uppercase underscore tokens, so
    // 'sales order' and 'Sales-Order' both name SALES_ORDER rather than silently
    // matching nothing.
    const srcDocType = (ablSrcDocType ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (!srcDocType) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Invalid source document type',
        [
          {
            field: 'ablSrcDocType',
            message: `ablSrcDocType is required — the document discriminator the bill row carries, e.g. ${SALE_ORDER_DOC_TYPES.join(', ')}`,
          },
        ],
      );
    }
    const srcAccYear = (ablSrcAccYear ?? '').trim();
    if (!ACC_YEAR_PATTERN.test(srcAccYear)) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Invalid accounting year',
        [
          {
            field: 'ablSrcAccYear',
            message: 'ablSrcAccYear must be in the YYYY-YYYY form, e.g. 2026-2027',
          },
        ],
      );
    }
    const totals = await this.prisma.accBillBalance.aggregate({
      _sum: { ablPendingAmount: true },
      where: {
        ablSrcDocType: srcDocType,
        ablSrcDocId,
        ablSrcAccYear: srcAccYear,
        // A retired advance is money that is no longer held; ux_abl_doc_refno
        // skips deleted rows for the same reason.
        ablIsDeleted: false,
      },
    });
    // _sum is null when nothing matched, which asNumber turns into the 0 this
    // answers with. Rounded to the two decimals abl_pending_amount stores, so
    // the JSON number can never carry float noise the column does not have.
    return { ablPendingAmount: roundAmount(asNumber(totals._sum.ablPendingAmount)) };
  }
  async softDelete(
    soId: string,
    soCompanyId: string,
    soBranchId: string,
    soAccYear: string,
  ): Promise<{ soId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleOrder.findFirst({
        where: {
          soId,
          soCompanyId,
          soBranchId,
          soAccYear,
          soIsDeleted: false,
        },
      });
      if (!existing) {
        throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
          'Order not found',
          'soId',
          `No active order found with id ${soId}`,
        );
      }
      // Money the company still HOLDS blocks the delete: an order whose advance
      // balance is not zero must first refund, forfeit or transfer what it took
      // (which also updates the roll-ups), or the liability would vanish from
      // every list while the customer's money stays in the till.
      if (asNumber(existing.soAdvanceBalanceAmt) > 0) {
        throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
          'Order holds an unsettled advance',
          [
            {
              field: 'soAdvanceBalanceAmt',
              message:
                'The order still holds an advance balance; refund, forfeit or transfer it before deleting',
            },
          ],
        );
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // A deleted order is a cancelled order: the status moves with the flag so
      // anything reading soStatus rather than soIsDeleted still sees a document
      // that is out of play. Who cancelled it and why is public.txn_status_log's
      // fact (sale_order carries no cancellation columns of its own). This path
      // does not append a trail step yet — cancelOpenLines is the only writer so
      // far — so the audit log entry below is this operation's record.
      const headerChanges = {
        soStatus: SALE_ORDER_STATUS_CANCELLED,
        soIsDeleted: true,
        soModifiedOn: modifiedOn,
        soModifiedBy: actor,
      };
      const result = await tx.saleOrder.updateMany({
        where: {
          soId,
          soCompanyId,
          soBranchId,
          soAccYear,
          soIsDeleted: false,
        },
        data: headerChanges,
      });
      if (result.count === 0) {
        throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
          'Order not found',
          'soId',
          `No active order found with id ${soId}`,
        );
      }
      // Cascade the soft delete to the order's line items so no line stays
      // active while the header is logically deleted.
      await tx.saleOrderItem.updateMany({
        where: {
          soiOrderId: soId,
          // sale_order_item is partitioned by soi_acc_year like its header, so
          // the year is passed down to keep the cascade on one partition.
          soiAccYear: soAccYear,
          soiIsDeleted: false,
        },
        data: {
          soiIsDeleted: true,
          soiModifiedOn: modifiedOn,
          soiModifiedBy: actor,
        },
      });
      // Same cascade for the applied charges — an active charge line must never
      // outlive the document it was charged on.
      await this.chargeDetailService.softDeleteDocumentCharges(
        tx,
        SALE_ORDER_CHARGE_DOC_TYPE,
        soId,
        actor,
        modifiedOn,
      );
      // ... and for the tendered money, so no payment line stays active against
      // an order that no longer exists.
      await this.tenderDetailService.softDeleteDocumentTenders(
        tx,
        SALE_ORDER_TENDER_SRC_MODULE,
        SALE_ORDER_TENDER_SRC_DOC_TYPE,
        soId,
        actor,
        modifiedOn,
      );
      // ... and for the accounting rows the tendered money raised: the advance
      // receipt in accounts.acc_voucher_header and its acc_vouchers ledger
      // lines. Nothing may keep pointing at a document that is gone.
      await deleteOrderAdvancePosting(tx, { soId, soCompanyId, soAccYear }, actor, modifiedOn);
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({ ...existing, ...headerChanges });
      await this.auditLogService.logEntityChange(
        {
          // A soft delete is logged as 'cancel', the way every other module logs
          // one: audit.audit_log_action has no 'delete' member, so
          // AuditLogService.normalizeAction answers 400 for it.
          action: 'cancel',
          tableName: SALE_ORDER_TABLE_NAME,
          screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: soId,
          displayName: existing.soOrderRefno || soId,
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: 'Order soft deleted',
        },
        tx,
      );
      return {
        soId,
        deleted: true,
      };
    });
  }
  // Closes out an order's remaining quantity: every still-open line addressed
  // has its pending quantity moved into cancelled, and the header roll-ups are
  // recomputed from what ALL the lines then say.
  //
  // The order is addressed the way a DOWNSTREAM document holds it — the
  // (srcModule, srcDocId, srcAccYear) tuple a sale bill carries in
  // sb_src_doc_type / sb_src_doc_id — because the screen that calls this is the
  // sales line, which knows the order only as its source. srcAccYear is the
  // accounting year both tables are partitioned by, so no company / branch is
  // needed to address one row unambiguously; both are read off the record.
  //
  // srcDocId is either id, and which one decides the SCOPE:
  //   so_id  — the whole order: every open line closes out.
  //   soi_id — that one line, its siblings left alone.
  // The screen calling this has the order line in front of it, so soi_id is
  // often the nearer id to hand; the header is tried first and the line lookup
  // only runs when nothing matched, so the common path still costs one read.
  //
  // Idempotent by construction: a second call finds nothing open, writes
  // nothing and answers 0. That is what makes PUT the honest verb here.
  //
  // This is the first server-side writer of the soi_delivered_qty /
  // soi_cancelled_qty / soi_pending_qty caches — until now they were whatever
  // the client last posted.
  async cancelOpenLines(
    srcModule: string,
    srcDocId: string,
    srcAccYear: string,
    cancelDto: CancelSaleOrderLinesDto,
  ): Promise<SaleOrderCancelLinesResult> {
    // A sale order is only ever reachable from SALES, and the sales line screen
    // addresses it by the source tuple it stores — whose discriminator is the
    // doc type (SALES_ORDER, or BOOKING / CUSTOM_ORDER for those orders), not
    // the module. Every one of them names this document, so all are accepted;
    // anything else — a bill, a delivery challan — gets a 400 naming the field
    // rather than cancelling an order the caller did not mean to address.
    //
    // Separators are normalised before matching, so 'sales order' and
    // 'Sales-Order' land on SALES_ORDER: the word the caller means is the same
    // one either way, and a screen that spells it with a space is not making
    // the kind of mistake this guard exists to catch.
    const normalisedModule = (srcModule ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (!SALE_ORDER_CANCEL_SRC_MODULES.includes(normalisedModule)) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid source module', [
        {
          field: 'srcModule',
          message: `srcModule must be one of ${SALE_ORDER_CANCEL_SRC_MODULES.join(', ')} for a sales order`,
        },
      ]);
    }
    return this.prisma.$transaction(async (tx) => {
      let existing = await tx.saleOrder.findFirst({
        where: {
          soId: srcDocId,
          soAccYear: srcAccYear,
          soIsDeleted: false,
        },
      });
      // Null means srcDocId was not an order id — the other thing it is allowed
      // to be is one of the order's own line ids, which narrows the call to that
      // line. A soft-deleted line is not addressable: there is nothing left on
      // it to cancel, and resolving through it would silently widen the call to
      // its order.
      let targetLineId: string | null = null;
      if (!existing) {
        const line = await tx.saleOrderItem.findFirst({
          where: { soiId: srcDocId, soiAccYear: srcAccYear, soiIsDeleted: false },
          select: { soiId: true, soiOrderId: true },
        });
        if (line) {
          targetLineId = line.soiId;
          existing = await tx.saleOrder.findFirst({
            where: {
              soId: line.soiOrderId,
              soAccYear: srcAccYear,
              soIsDeleted: false,
            },
          });
        }
      }
      if (!existing) {
        throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
          'Order not found',
          'srcDocId',
          `No active order or order line found with id ${srcDocId} in accounting year ${srcAccYear}`,
        );
      }
      // Read once, and always the WHOLE order: the same rows drive both the
      // per-line writes and the header recompute, and the recompute needs the
      // lines this call does not touch just as much as the ones it does — which
      // is the whole point when a single line was named.
      const lines = await tx.saleOrderItem.findMany({
        where: {
          soiOrderId: existing.soId,
          // sale_order_item is partitioned by soi_acc_year like its header, so
          // the year keeps the read on one partition.
          soiAccYear: srcAccYear,
          soiIsDeleted: false,
        },
        orderBy: { soiLineNo: 'asc' },
      });
      const now = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // What each line will hold once this call is done: the open ones this call
      // addresses with their pending quantity moved across, the rest exactly as
      // they are. A line the caller did not name is 'the rest' even when it is
      // wide open — it still counts towards the header roll-ups below, which is
      // how a one-line cancel leaves the order PARTIAL rather than settled.
      const settledLines = lines.map((line) => {
        const delivered = asNumber(line.soiDeliveredQty);
        const billedAmt = asNumber(line.soiBilledAmt);
        const pending = asNumber(line.soiPendingQty);
        if (pending <= QTY_EPSILON || (targetLineId !== null && line.soiId !== targetLineId)) {
          return {
            line,
            delivered,
            cancelled: asNumber(line.soiCancelledQty),
            pending,
            billedAmt,
            moved: 0,
          };
        }
        return {
          line,
          delivered,
          cancelled: roundQty(asNumber(line.soiCancelledQty) + pending),
          pending: 0,
          billedAmt,
          moved: roundQty(pending),
        };
      });
      const rollup = this.summariseOrderLines(settledLines);
      // softDelete refuses outright on an unsettled advance. Here that would be
      // too blunt — money held against an order that DID deliver is legitimate,
      // and this call is not retiring the document. What must not happen is the
      // order going fully CANCELLED while the customer's money is still in the
      // till: refund, forfeit or transfer it first, which also moves the
      // roll-up. It is also what keeps the advance posting honest, see below.
      if (
        rollup.fulfilStatus === SALE_ORDER_FULFIL_CANCELLED &&
        asNumber(existing.soAdvanceBalanceAmt) > 0
      ) {
        throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
          'Order holds an unsettled advance',
          [
            {
              field: 'soAdvanceBalanceAmt',
              message:
                'The order still holds an advance balance; refund, forfeit or transfer it before ' +
                'cancelling the remaining quantity',
            },
          ],
        );
      }
      // Only soi_cancelled_qty is written: soi_pending_qty and soi_line_status
      // are GENERATED columns since migration 20260814060000, so moving the
      // pending quantity into cancelled IS what drives pending to zero and the
      // status to CANCELLED / PARTIAL. Naming either of them in the statement
      // would be a 428C9 rather than a redundant assignment.
      //
      // A loop rather than updateMany: soi_cancelled_qty += soi_pending_qty is a
      // column-to-column increment (Prisma's { increment } takes a literal). The
      // rows are already in memory and an order's line count is UI-bounded, so
      // the round trips are cheap; if that ever stops being true the escape
      // hatch is one raw UPDATE over the whole order.
      //
      // soi_reserved_qty is deliberately left alone: ck_soi_reserved only caps
      // it at soi_order_qty, which does not move here, and releasing a
      // reservation is inventory's decision rather than this endpoint's.
      const cancelledLines: SaleOrderCancelledLine[] = [];
      // One reason, both places it belongs: soi_cancel_reason on each line this
      // call closes out, and the status-trail step below. Omitted is not the
      // same as cleared — the key is left off the update entirely when the
      // caller said nothing, so a line cancelled in an earlier call keeps the
      // reason it was given then.
      const cancelReason = cancelDto?.soiCancelReason;
      for (const settled of settledLines) {
        if (settled.moved <= 0) {
          continue;
        }
        const { line } = settled;
        const lineChanges = {
          soiCancelledQty: settled.cancelled,
          ...(cancelReason !== undefined ? { soiCancelReason: cancelReason } : {}),
          soiModifiedOn: now,
          soiModifiedBy: actor,
        };
        const updated = await tx.saleOrderItem.update({
          where: { soiId_soiAccYear: { soiId: line.soiId, soiAccYear: line.soiAccYear } },
          data: lineChanges,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SALE_ORDER_ITEM_TABLE_NAME,
            screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: line.soiId,
            displayName: `${existing.soOrderRefno || existing.soId} #${line.soiLineNo}`,
            originalRecord: this.toItemPayload(line),
            modifiedRecord: this.toItemPayload(updated),
            userId: actor,
            notes: 'Order line cancelled',
          },
          tx,
        );
        cancelledLines.push({
          soiId: line.soiId,
          soiLineNo: line.soiLineNo,
          soiCancelledQty: settled.moved,
          // Read back off the row the write returned rather than predicted here:
          // the DB is what decides this column now, so what the caller is told is
          // what the row actually holds.
          soiLineStatus: updated.soiLineStatus,
        });
      }
      // The header caches are recomputed even when nothing was cancelled: they
      // were caller-stated until this endpoint existed, so a repeat call is
      // also the cheapest way to get them back in step with the lines.
      const headerChanges: Prisma.SaleOrderUncheckedUpdateInput = {
        soBilledAmt: rollup.billedAmt,
        soCancelledAmt: rollup.cancelledAmt,
        soPendingAmt: rollup.pendingAmt,
        soTotItems: rollup.totItems,
        soDeliveredItems: rollup.deliveredItems,
        soFulfilStatus: rollup.fulfilStatus,
        soModifiedOn: now,
        soModifiedBy: actor,
      };
      // A still-open order keeps whatever it was (DRAFT / CONFIRMED): only a
      // settled one has a header status the lines can dictate. Note the
      // vocabularies differ — ck_so_status has no DELIVERED and
      // ck_soi_line_status has no COMPLETED.
      const soStatus = rollup.headerStatus ?? existing.soStatus;
      if (rollup.headerStatus) {
        headerChanges.soStatus = rollup.headerStatus;
      }
      // so_completed_on means completed, not closed: a cancelled order's
      // timestamp is the status trail's row, not this column. Only set once.
      if (rollup.fulfilStatus === SALE_ORDER_FULFIL_COMPLETED && !existing.soCompletedOn) {
        headerChanges.soCompletedOn = now;
      }
      const result = await tx.saleOrder.updateMany({
        where: {
          soId: existing.soId,
          soAccYear: srcAccYear,
          // Re-asserted rather than trusted from the read above: a concurrent
          // delete between the two is what this catches.
          soIsDeleted: false,
        },
        data: headerChanges,
      });
      if (result.count === 0) {
        throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
          'Order not found',
          'srcDocId',
          `No active order found with id ${existing.soId} in accounting year ${srcAccYear}`,
        );
      }
      // Only a real status MOVE is a step in the trail, the same rule the
      // quotation module follows: a call that cancels nothing, or one that
      // leaves an already-partial order partial, has nothing to say here. What
      // changed field by field is audit.audit_log's job.
      if (soStatus !== existing.soStatus) {
        await this.logStatusStep(
          tx,
          existing,
          {
            event: TxnStatusEvent.CANCELLED,
            fromStatus: existing.soStatus,
            toStatus: soStatus,
            remarks: cancelReason,
          },
          actor,
          now,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({ ...existing, ...headerChanges } as SaleOrder);
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SALE_ORDER_TABLE_NAME,
          screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: existing.soId,
          displayName: existing.soOrderRefno || existing.soId,
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: targetLineId
            ? `Order line cancelled (${cancelledLines.length})`
            : `Order open lines cancelled (${cancelledLines.length})`,
        },
        tx,
      );
      // The advance posting is deliberately NOT touched. The order is not being
      // deleted and its receipt in accounts.acc_voucher_header is a real one, so
      // deleteOrderAdvancePosting would be wrong here. Be aware of the knock-on:
      // once so_status is CANCELLED, the next save runs syncOrderAdvancePosting,
      // which cancels the advance receipt, and ensureNotPreviouslyCancelled then
      // blocks re-posting it for good. The advance guard above is what keeps
      // that safe — the header can only reach CANCELLED here when the balance is
      // already zero.
      return {
        soId: existing.soId,
        soAccYear: existing.soAccYear,
        soStatus,
        soFulfilStatus: rollup.fulfilStatus,
        cancelledLines: cancelledLines.length,
        cancelledQty: roundQty(
          cancelledLines.reduce((total, line) => total + line.soiCancelledQty, 0),
        ),
        soCancelledAmt: rollup.cancelledAmt,
        soPendingAmt: rollup.pendingAmt,
        lines: cancelledLines,
      };
    });
  }
  // The header roll-ups, derived from what the lines will hold once the cancel
  // has been applied. sale_order carries no quantity columns of its own — only
  // line COUNTS and amounts — so the quantities are only ever summed here to
  // decide the two status columns.
  //
  // Nothing in the DB enforces these: sale_order's CHECK set covers the status
  // vocabularies and the advance equations, and stops there. The invariant is
  // this method's, which is why it is stated in one place.
  //
  // The quantities and the billed amount are passed in rather than read off
  // `line`: both callers hold values the row does not yet carry — the cancel
  // path has moved pending into cancelled, the bill path has just re-summed
  // delivered — and summing the stored column would answer with the state the
  // caller is in the middle of replacing.
  private summariseOrderLines(
    settledLines: {
      line: SaleOrderItem;
      // The BILLABLE quantity — soi_net_qty, the same base soi_pending_qty is
      // generated from — as the line will hold it once the caller's write lands,
      // which is not line.soiNetQty on a line an over-delivery just revised
      // upwards. Left off by the cancel path, which never moves it.
      netQty?: number;
      delivered: number;
      cancelled: number;
      pending: number;
      billedAmt: number;
    }[],
  ): {
    billedAmt: number;
    cancelledAmt: number;
    pendingAmt: number;
    totItems: number;
    deliveredItems: number;
    fulfilStatus: string;
    headerStatus: string | null;
  } {
    let totalBilledAmt = 0;
    let cancelledAmt = 0;
    let pendingAmt = 0;
    let deliveredItems = 0;
    let deliveredQty = 0;
    let cancelledQty = 0;
    let pendingQty = 0;
    for (const { line, netQty: settledQty, delivered, cancelled, pending, billedAmt } of
      settledLines) {
      const netQty = settledQty ?? asNumber(line.soiNetQty);
      // soi_net_amt is the only line-level money covering the whole line (after
      // discount, tax and the per-line charges), so the cancelled / pending
      // split is taken pro-rata from it. A zero-quantity line contributes
      // nothing rather than dividing by zero.
      const unitShare = netQty > 0 ? asNumber(line.soiNetAmt) / netQty : 0;
      cancelledAmt += cancelled * unitShare;
      pendingAmt += pending * unitShare;
      // soi_billed_amt is a maintained cache, so it is summed as-is rather than
      // re-derived from soi_delivered_qty: a bill that priced differently from
      // the order must not be silently overwritten with the order's own rate.
      totalBilledAmt += billedAmt;
      deliveredQty += delivered;
      cancelledQty += cancelled;
      pendingQty += pending;
      // so_delivered_items counts FULLY delivered lines, the column's literal
      // meaning — a line that delivered 2 of 10 and cancelled the rest is
      // closed, but it is not one of these.
      if (netQty > 0 && Math.abs(delivered - netQty) <= QTY_EPSILON) {
        deliveredItems += 1;
      }
    }
    return {
      billedAmt: roundAmount(totalBilledAmt),
      cancelledAmt: roundAmount(cancelledAmt),
      pendingAmt: roundAmount(pendingAmt),
      totItems: settledLines.length,
      deliveredItems,
      ...this.deriveOrderStatus(deliveredQty, cancelledQty, pendingQty),
    };
  }
  // ck_so_fulfil_status: PENDING / PARTIAL / COMPLETED / CANCELLED.
  // headerStatus is null when the order is still open, meaning "leave so_status
  // alone" — a DRAFT that still has pending quantity is not something a cancel
  // of some other line should promote.
  private deriveOrderStatus(
    deliveredQty: number,
    cancelledQty: number,
    pendingQty: number,
  ): { fulfilStatus: string; headerStatus: string | null } {
    const delivered = deliveredQty > QTY_EPSILON;
    if (pendingQty > QTY_EPSILON) {
      return {
        fulfilStatus: delivered ? SALE_ORDER_FULFIL_PARTIAL : SALE_ORDER_FULFIL_PENDING,
        headerStatus: null,
      };
    }
    // Nothing left pending: the order is settled one way or another.
    if (!delivered) {
      // Every ordered unit was written off — including the degenerate empty
      // order, which has nothing left to deliver either.
      return {
        fulfilStatus: SALE_ORDER_FULFIL_CANCELLED,
        headerStatus: SALE_ORDER_STATUS_CANCELLED,
      };
    }
    if (cancelledQty <= QTY_EPSILON) {
      return {
        fulfilStatus: SALE_ORDER_FULFIL_COMPLETED,
        headerStatus: SALE_ORDER_FULFIL_COMPLETED,
      };
    }
    // Part delivered, the rest written off.
    return {
      fulfilStatus: SALE_ORDER_FULFIL_PARTIAL,
      headerStatus: SALE_ORDER_FULFIL_PARTIAL,
    };
  }
  // Re-derives the fulfilment caches — soi_delivered_qty / soi_billed_amt, and
  // through them the GENERATED soi_pending_qty / soi_line_status, then the header
  // roll-ups — from the bills standing against the order. The sale-bill module calls this inside its own
  // save / delete transaction, once its lines are written, handing over every
  // order line the bill touches: the ones it points at NOW plus the ones it
  // pointed at BEFORE the save, because a line the payload drops or repoints has
  // to give the abandoned order line its quantity back.
  //
  // RECOMPUTED, never incremented. sale_bill_item is the truth (the comment on
  // soi_delivered_qty says so), so every affected line is re-summed from
  // scratch. That is what makes the call idempotent — a repeat save, a re-post,
  // a retried transaction all land on the same numbers — and it repairs caches
  // that were whatever the client last posted, which until now is all they were.
  //
  // Only a POSTED bill counts. A draft is still being keyed and may never become
  // a document; taking a bill out of POSTED, cancelling it or deleting it
  // releases its quantity back into soi_pending_qty on the very next call.
  //
  // soi_cancelled_qty is deliberately untouched: writing off what a customer no
  // longer wants is the cancel endpoint's decision, not a bill's. This method
  // only ever moves quantity between delivered and pending — with one exception,
  // an over-delivery, which raises soi_order_qty; see the settlement below.
  //
  // References come at two grains, and both end up at the same place. A bill
  // line carries the order LINE's own id in sbi_src_doc_id, which addresses one
  // sale_order_item row by itself; the bill HEADER carries the ORDER's id in
  // sb_src_doc_id, which names no line and asks only for the order to be
  // re-derived. resolveOrderRefs turns either into the same (order, line number)
  // pair, so a bill that fills in only its header still leaves the order's
  // status telling the truth.
  async syncOrderFulfilment(
    tx: Prisma.TransactionClient,
    request: { refs: SaleOrderLineRef[] },
    actor: string,
    now: Date,
  ): Promise<SaleOrderFulfilmentResult[]> {
    if (request.refs.length === 0) {
      return [];
    }
    const targets = await this.resolveOrderRefs(tx, request.refs);
    const results: SaleOrderFulfilmentResult[] = [];
    for (const order of targets) {
      results.push(await this.syncOneOrderFulfilment(tx, order, actor, now));
    }
    return results;
  }
  // Every reference the calling document made, resolved to the orders they
  // actually name and grouped one entry per order — so a bill that points at
  // four lines of one order recomputes it once, and a header reference collapses
  // into that same recompute rather than adding a second.
  //
  // srcDocId is looked up as an ORDER id and as an order LINE id, the pair of
  // grains PUT /cancel-lines already accepts on the same tuple. Both lookups run
  // as one `in` read per accounting year rather than a pair per reference: a
  // bill converting a twenty-line order would otherwise pay forty round trips to
  // learn what two tell it.
  //
  // Deliberately BEFORE the per-order FOR UPDATE lock, because it is only a
  // mapping from ids to ids. A line soft-deleted in the window between this read
  // and that lock resolves to a line number the locked read no longer finds, and
  // comes back as the unknown-line 400 below — a rejection, never a wrong
  // number.
  private async resolveOrderRefs(
    tx: Prisma.TransactionClient,
    refs: SaleOrderLineRef[],
  ): Promise<OrderFulfilmentTarget[]> {
    // sale_order and sale_order_item are both partitioned by the accounting
    // year, so the reads are grouped by it: one partition each, never a scan
    // across every year the database holds.
    const byYear = new Map<string, SaleOrderLineRef[]>();
    for (const ref of refs) {
      const forYear = byYear.get(ref.srcAccYear) ?? [];
      forYear.push(ref);
      byYear.set(ref.srcAccYear, forYear);
    }
    const byOrder = new Map<string, OrderFulfilmentTarget>();
    for (const [srcAccYear, yearRefs] of byYear) {
      const srcDocIds = [...new Set(yearRefs.map((ref) => ref.srcDocId))];
      const [orders, orderLines] = await Promise.all([
        tx.saleOrder.findMany({
          where: { soId: { in: srcDocIds }, soAccYear: srcAccYear, soIsDeleted: false },
          select: { soId: true },
        }),
        // A soft-deleted line is not addressable: there is nothing left on it to
        // draw down, and resolving through it would silently widen the reference
        // to its whole order — the same rule the cancel endpoint follows.
        tx.saleOrderItem.findMany({
          where: { soiId: { in: srcDocIds }, soiAccYear: srcAccYear, soiIsDeleted: false },
          select: { soiId: true, soiOrderId: true, soiLineNo: true },
        }),
      ]);
      const orderIds = new Set(orders.map((order) => order.soId));
      const lineById = new Map(orderLines.map((line) => [line.soiId, line]));
      for (const ref of yearRefs) {
        // The line grain first: an id that is a live order line is one, and no
        // uuid is ever both. Its own line number is what it resolves to, so the
        // recompute below never has to care which grain it arrived as.
        const line = lineById.get(ref.srcDocId);
        const soId = line ? line.soiOrderId : orderIds.has(ref.srcDocId) ? ref.srcDocId : null;
        // A 400, not a 404, and for the same reason the unknown-line rejection
        // below is one: the document being saved is the BILL, and a reference on
        // its payload that addresses no order is a bad field on that payload,
        // not a missing bill. Answered as a 404 this was indistinguishable in
        // the access log from an unrouted POST /bills/create, which is exactly
        // how it was first misread.
        if (soId === null) {
          throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Order not found', [
            {
              field: ref.fields.docId,
              message:
                `No active order or order line found with id ${ref.srcDocId} in accounting ` +
                `year ${srcAccYear}. ${ref.fields.docId} takes the sale order LINE's soi_id ` +
                `(or the order's so_id with ${ref.fields.lineNo ?? 'a line number'}), and ` +
                `${ref.fields.accYear} takes that order's OWN accounting year, not the bill's.`,
            },
          ]);
        }
        const soLineNo = line ? line.soiLineNo : ref.soLineNo;
        const key = `${soId}|${srcAccYear}`;
        const entry = byOrder.get(key) ?? {
          soId,
          soAccYear: srcAccYear,
          lineNos: new Set<number>(),
          // Whichever reference reached this order first words a rejection about
          // the order itself; either one is true, and the first is the one the
          // caller listed first.
          fields: ref.fields,
          lineNoField: null,
        };
        if (soLineNo !== null) {
          entry.lineNos.add(soLineNo);
          // Only a reference that named a line can produce an unknown-line
          // rejection, so that message is worded from a reference that has one.
          entry.lineNoField = entry.lineNoField ?? ref.fields.lineNo ?? null;
        }
        byOrder.set(key, entry);
      }
    }
    return [...byOrder.values()];
  }
  private async syncOneOrderFulfilment(
    tx: Prisma.TransactionClient,
    target: OrderFulfilmentTarget,
    actor: string,
    now: Date,
  ): Promise<SaleOrderFulfilmentResult> {
    const { soId, soAccYear, lineNos, fields } = target;
    // Serialises concurrent recomputes of ONE order, and is taken before
    // anything is read. Two bills posted against the same order line in
    // overlapping transactions would otherwise each re-sum sale_bill_item
    // without seeing the other's uncommitted line, and whichever committed
    // second would write a delivered total that silently misses the first.
    // Holding the header row makes the second wait; by the time it reads, READ
    // COMMITTED gives its statement a snapshot that already includes the first.
    //
    // A bill racing PUT /cancel-lines is a different story and is deliberately
    // left to the database: that one ends in a ck_soi_qty_balance violation, so
    // the losing transaction rolls back with an error rather than committing a
    // wrong number.
    await tx.$queryRaw`
      SELECT so_id
        FROM sales.sale_order
       WHERE so_id = ${soId}::uuid
         AND so_acc_year = ${soAccYear}::bpchar
         FOR UPDATE`;
    const order = await tx.saleOrder.findFirst({
      where: { soId, soAccYear, soIsDeleted: false },
    });
    // Reachable two ways, and a 400 for both. Either the order was soft-deleted
    // in the window between resolveOrderRefs and this lock, or the reference
    // arrived at a LINE whose parent order is already deleted — resolveOrderRefs
    // filters deleted lines but reads soi_order_id straight off a live one. Both
    // are the payload naming an order that cannot be billed, same as above.
    if (!order) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Order not found', [
        {
          field: fields.docId,
          message: `No active order found with id ${soId} in accounting year ${soAccYear}`,
        },
      ]);
    }
    // Every line, not just the referenced ones: the header roll-up below needs
    // the lines this call does NOT touch just as much as the ones it does.
    const lines = await tx.saleOrderItem.findMany({
      where: {
        soiOrderId: soId,
        // sale_order_item is partitioned by soi_acc_year like its header, so the
        // year keeps the read on one partition.
        soiAccYear: soAccYear,
        soiIsDeleted: false,
      },
      orderBy: { soiLineNo: 'asc' },
    });
    const lineByNo = new Map(lines.map((line) => [line.soiLineNo, line]));
    // A reference to a line that is not on the order is the caller's mistake,
    // not an empty recompute: answering 200 would leave the operator looking at
    // a bill that says it delivered an order which never moved.
    const unknownLineNos = [...lineNos]
      .filter((lineNo) => !lineByNo.has(lineNo))
      .sort((left, right) => left - right);
    if (unknownLineNos.length > 0) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Unknown order line', [
        {
          // Non-null wherever this can fire: a line number only ever reached
          // the target from a reference that carries the column it came out of.
          field: target.lineNoField ?? fields.docId,
          message:
            `Order ${order.soOrderRefno || soId} has no active line numbered ` +
            unknownLineNos.join(', '),
        },
      ]);
    }
    // Everything billed against this order, from every POSTED bill in ANY
    // accounting year — an order taken in one year is routinely billed in the
    // next — which is why this filters on sbi_src_doc_year (the ORDER's year)
    // and not on the bill line's own partition key. The relation filter is what
    // keeps a draft, a cancelled and a deleted bill out of the sum.
    //
    // Both grains are swept up in one read: bill lines that stored a soi_id and
    // bill lines (or headers) that stored the so_id. A bill written before the
    // line grain existed and one written after it therefore sum together, which
    // is what stops an order's delivered quantity depending on which client
    // keyed which delivery.
    const lineIds = lines.map((line) => line.soiId);
    const billedItems = await tx.saleBillItem.findMany({
      where: {
        sbiSrcDocType: SALE_ORDER_SRC_DOC_TYPE,
        sbiSrcDocId: { in: [soId, ...lineIds] },
        sbiSrcDocYear: soAccYear,
        sbiIsDeleted: false,
        bill: { sbStatus: BILL_STATUS_POSTED, sbIsDeleted: false },
      },
      select: {
        sbiSrcDocId: true,
        sbiSrcDocLineNo: true,
        sbiNetQty: true,
        sbiNetAmt: true,
      },
    });
    const lineNoById = new Map(lines.map((line) => [line.soiId, line.soiLineNo]));
    // Summed per ORDER line, not per bill line: one order line routinely becomes
    // several bill lines — a batch split within one bill, or a part delivery
    // spread across several.
    const billedByLineNo = new Map<number, { qty: number; amt: number }>();
    for (const item of billedItems) {
      // The id first, exactly as the reference was resolved: a bill line holding
      // a soi_id has already said which line it drew down, and its
      // sbi_src_doc_line_no — sent or not — decides nothing.
      const lineNo = lineNoById.get(item.sbiSrcDocId ?? '') ?? item.sbiSrcDocLineNo;
      if (lineNo === null) {
        // Names the order but not a line of it, so there is nothing to draw
        // down. sale_bill also carries a header-level sb_src_doc_id, and a
        // client that fills only that in lands here.
        continue;
      }
      const total = billedByLineNo.get(lineNo) ?? { qty: 0, amt: 0 };
      // sbi_net_qty, not sbi_bill_qty: the quantity in the order line's own
      // terms — what soi_delivered_qty and soi_net_qty are counted in — after the
      // bill line has resolved its case / length / pack into them.
      total.qty += asNumber(item.sbiNetQty);
      total.amt += asNumber(item.sbiNetAmt);
      billedByLineNo.set(lineNo, total);
    }
    const settledLines = lines.map((line) => {
      const stored = {
        line,
        netQty: asNumber(line.soiNetQty),
        delivered: asNumber(line.soiDeliveredQty),
        cancelled: asNumber(line.soiCancelledQty),
        pending: asNumber(line.soiPendingQty),
        billedAmt: asNumber(line.soiBilledAmt),
        changed: false,
      };
      // Recomputed for the lines this call was handed AND for any line that
      // still carries billed quantity. The second set is what hands a line its
      // quantity back when the bill that consumed it is edited to point
      // elsewhere. Every other line keeps exactly what it holds — a quantity
      // cancelled by hand is not this method's to reinterpret.
      if (!lineNos.has(line.soiLineNo) && !billedByLineNo.has(line.soiLineNo)) {
        return stored;
      }
      const billed = billedByLineNo.get(line.soiLineNo) ?? { qty: 0, amt: 0 };
      const delivered = roundQty(billed.qty);
      const billedAmt = roundAmount(billed.amt);
      const cancelled = stored.cancelled;
      // soi_pending_qty is GENERATED as net − delivered − cancelled, so pending
      // is not written and not decided here: this mirrors the DB's expression
      // only to know what the row will hold, which the header roll-up needs
      // before the write returns.
      let netQty = stored.netQty;
      let pending = roundQty(netQty - delivered - cancelled);
      if (pending < -QTY_EPSILON) {
        // More went out than the line ever had to give — the customer took the
        // extra at the counter, or the order was keyed short. The bill is the
        // record of what physically moved, so the LINE is revised up to it rather
        // than the delivery being refused: soi_net_qty becomes what is settled
        // and nothing is left pending. Only ever upwards, and only from a bill
        // that over-delivers; a bill for LESS than the line carried leaves the
        // shortfall sitting in soi_pending_qty, which is what a part delivery is.
        //
        // soi_order_qty is deliberately not touched: it is what the customer
        // asked for, in the unit they asked for it in, and no longer takes part
        // in the fulfilment identity. Without this the generated pending would go
        // negative and ck_soi_qty_signs would refuse the write.
        netQty = roundQty(delivered + cancelled);
        pending = 0;
      }
      // Only float noise can be left below zero once the branch above has run.
      const pendingQty = Math.max(pending, 0);
      return {
        line,
        netQty,
        delivered,
        cancelled,
        pending: pendingQty,
        billedAmt,
        // The three written columns are what decide the two generated ones, so
        // comparing them is the whole test: a line whose net / delivered / billed
        // amount all still stand cannot have a stale pending or status either.
        changed:
          Math.abs(netQty - stored.netQty) > QTY_EPSILON ||
          Math.abs(delivered - stored.delivered) > QTY_EPSILON ||
          Math.abs(billedAmt - stored.billedAmt) > AMOUNT_EPSILON,
      };
    });
    const fulfilledLines: SaleOrderFulfilledLine[] = [];
    for (const settled of settledLines) {
      if (!settled.changed) {
        continue;
      }
      const { line } = settled;
      const updated = await tx.saleOrderItem.update({
        where: { soiId_soiAccYear: { soiId: line.soiId, soiAccYear: line.soiAccYear } },
        data: {
          // Unchanged on all but an over-delivered line, and sent every time
          // regardless: it is the base soi_pending_qty is generated from, so it
          // belongs in the same statement as the delivered quantity it is
          // balanced against — the row the CHECK sees is the finished one.
          soiNetQty: settled.netQty,
          soiDeliveredQty: settled.delivered,
          soiBilledAmt: settled.billedAmt,
          soiModifiedOn: now,
          soiModifiedBy: actor,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: SALE_ORDER_ITEM_TABLE_NAME,
          screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: line.soiId,
          displayName: `${order.soOrderRefno || order.soId} #${line.soiLineNo}`,
          originalRecord: this.toItemPayload(line),
          modifiedRecord: this.toItemPayload(updated),
          userId: actor,
          notes: 'Order line fulfilment recomputed from its bills',
        },
        tx,
      );
      fulfilledLines.push({
        soiId: line.soiId,
        soiLineNo: line.soiLineNo,
        soiNetQty: settled.netQty,
        soiDeliveredQty: settled.delivered,
        soiCancelledQty: settled.cancelled,
        // The two generated columns come off the row the write returned, not off
        // the prediction above: what the caller is told is what the DB derived.
        soiPendingQty: asNumber(updated.soiPendingQty),
        soiBilledAmt: settled.billedAmt,
        soiLineStatus: updated.soiLineStatus,
      });
    }
    const rollup = this.summariseOrderLines(settledLines);
    // A still-open order keeps whatever it was (DRAFT / CONFIRMED): only a
    // settled one has a header status its lines can dictate.
    const soStatus = rollup.headerStatus ?? order.soStatus;
    // The header is only rewritten when it has something new to say. A draft
    // bill saved over and over against the same order reaches here every time,
    // and must not leave an audit row and a bumped so_modified_on each time.
    const headerChanged =
      fulfilledLines.length > 0 ||
      Math.abs(rollup.billedAmt - asNumber(order.soBilledAmt)) > AMOUNT_EPSILON ||
      Math.abs(rollup.cancelledAmt - asNumber(order.soCancelledAmt)) > AMOUNT_EPSILON ||
      Math.abs(rollup.pendingAmt - asNumber(order.soPendingAmt)) > AMOUNT_EPSILON ||
      rollup.totItems !== order.soTotItems ||
      rollup.deliveredItems !== order.soDeliveredItems ||
      rollup.fulfilStatus !== order.soFulfilStatus ||
      soStatus !== order.soStatus;
    if (!headerChanged) {
      return {
        soId,
        soAccYear,
        soStatus: order.soStatus,
        soFulfilStatus: order.soFulfilStatus,
        lines: [],
      };
    }
    const headerChanges: Prisma.SaleOrderUncheckedUpdateInput = {
      soBilledAmt: rollup.billedAmt,
      soCancelledAmt: rollup.cancelledAmt,
      soPendingAmt: rollup.pendingAmt,
      soTotItems: rollup.totItems,
      soDeliveredItems: rollup.deliveredItems,
      soFulfilStatus: rollup.fulfilStatus,
      soModifiedOn: now,
      soModifiedBy: actor,
    };
    if (rollup.headerStatus) {
      headerChanges.soStatus = rollup.headerStatus;
    }
    // so_completed_on means completed, not closed, and is only ever set once —
    // the same rule the cancel path follows.
    if (rollup.fulfilStatus === SALE_ORDER_FULFIL_COMPLETED && !order.soCompletedOn) {
      headerChanges.soCompletedOn = now;
    }
    const result = await tx.saleOrder.updateMany({
      where: {
        soId,
        soAccYear,
        // Re-asserted rather than trusted from the read above: a concurrent
        // delete between the two is what this catches.
        soIsDeleted: false,
      },
      data: headerChanges,
    });
    if (result.count === 0) {
      throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Order not found',
        fields.docId,
        `No active order found with id ${soId} in accounting year ${soAccYear}`,
      );
    }
    // Only a real status MOVE is a step in the trail — an edit that leaves the
    // order PARTIAL has nothing to say here. What changed field by field is
    // audit.audit_log's job.
    if (soStatus !== order.soStatus) {
      await this.logStatusStep(
        tx,
        order,
        {
          // The chain's own word for it: the order became the next document.
          // A recompute that RETIRES a bill can move the status back the other
          // way; that is the same fact read in reverse and carries the same
          // event, with the remark saying which direction it went.
          event:
            soStatus === SALE_ORDER_STATUS_CANCELLED
              ? TxnStatusEvent.CANCELLED
              : TxnStatusEvent.CONVERTED,
          fromStatus: order.soStatus,
          toStatus: soStatus,
          remarks: SALE_ORDER_FULFIL_STATUS_REMARK,
        },
        actor,
        now,
      );
    }
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: SALE_ORDER_TABLE_NAME,
        screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
        screenType: 'transaction',
        pk: order.soId,
        displayName: order.soOrderRefno || order.soId,
        originalRecord: this.toPayload(order),
        modifiedRecord: this.toPayload({ ...order, ...headerChanges } as SaleOrder),
        userId: actor,
        notes: `Order fulfilment recomputed from its bills (${fulfilledLines.length} line(s))`,
      },
      tx,
    );
    return {
      soId,
      soAccYear,
      soStatus,
      soFulfilStatus: rollup.fulfilStatus,
      lines: fulfilledLines,
    };
  }
  // One step of the order's history in public.txn_status_log. so_status is only
  // ever the CURRENT state; the trail is the ordered set of moves that got it
  // there. Written inside the caller's transaction, so the step commits with the
  // write that caused it — an order that says CANCELLED with nothing saying who
  // cancelled it is what this prevents.
  private async logStatusStep(
    tx: Prisma.TransactionClient,
    order: SaleOrder,
    step: {
      event: TxnStatusEvent;
      fromStatus: string | null;
      toStatus: string;
      remarks?: string | null;
    },
    actor: string,
    changedOn: Date,
  ): Promise<void> {
    await appendTxnStatusLog(tx, {
      companyId: order.soCompanyId,
      branchId: order.soBranchId,
      tenantId: order.soTenantId,
      // The order's own year, not today's: txn_status_log is partitioned by it,
      // exactly like sale_order.
      accYear: order.soAccYear,
      srcModule: SALE_ORDER_STATUS_SRC_MODULE,
      srcDocType: SALE_ORDER_STATUS_SRC_DOC_TYPE,
      srcDocId: order.soId,
      srcDocRefno: order.soOrderRefno,
      event: step.event,
      fromStatus: step.fromStatus,
      toStatus: step.toStatus,
      changedOn,
      changedBy: actor,
      // ck_tsl_reason_required wants one on a CANCELLED step. sale_order has no
      // cancellation columns to fall back on — the caller's reason is all there
      // is — and the helper substitutes rather than failing the write.
      remarks: step.remarks,
      deviceId: order.soDeviceId,
      sessionId: order.soSessionId,
    });
  }
  private async createOrder(saveOrderDto: SaveSaleOrderDto): Promise<SaleOrderPayload> {
    const normalizedCustName = normalizeRequiredText<SaleOrderErrorDetail, SaleOrderErrorResponse>(
      saveOrderDto.soCustName ?? '',
      'soCustName',
    );
    this.ensureAdvanceRollupsAreConsistent(saveOrderDto, undefined);
    const now = new Date();
    const createdBy = resolveActor(
      saveOrderDto.soCreatedBy,
      this.requestContextService.getUserId(),
    );
    const orderDate = saveOrderDto.soOrderDate ? new Date(saveOrderDto.soOrderDate) : now;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Voucher type 4 numbers the document: the running number consumed from
        // accounts.acc_voucher_seq becomes soOrderSlno and its printable form
        // becomes soOrderRefno. Both are server-assigned — the voucher type is
        // AUTO-numbered with manual numbers disallowed, so whatever the client
        // sent for either field is ignored.
        const orderNumber = await allocateVoucherNumber(tx, {
          vchrTypeId: SALE_ORDER_VCHR_TYPE_ID,
          companyId: saveOrderDto.soCompanyId,
          branchId: saveOrderDto.soBranchId,
          accYear: saveOrderDto.soAccYear,
          documentDate: orderDate,
        });
        const data: Prisma.SaleOrderUncheckedCreateInput = {
          soCompanyId: saveOrderDto.soCompanyId,
          soBranchId: saveOrderDto.soBranchId,
          soTenantId: saveOrderDto.soTenantId,
          soAccYear: saveOrderDto.soAccYear,
          soDeviceId: saveOrderDto.soDeviceId,
          soPriceLevel: saveOrderDto.soPriceLevel,
          soOrderSlno: orderNumber.lastNo,
          soOrderRefno: orderNumber.refno,
          soOrderDate: orderDate,
          soCustId: saveOrderDto.soCustId,
          soCustName: normalizedCustName,
          soUserId: saveOrderDto.soUserId,
          soCreatedOn: now,
          soCreatedBy: createdBy,
          soStatus: saveOrderDto.soStatus || 'DRAFT',
        };
        this.applyOptionalFields(data, saveOrderDto);
        data.soCustName = normalizedCustName;
        data.soOrderDate = orderDate;
        // The balance roll-up is derived when the payload does not carry it —
        // see ensureAdvanceRollupsAreConsistent.
        if (saveOrderDto.soAdvanceBalanceAmt === undefined) {
          data.soAdvanceBalanceAmt = this.deriveAdvanceBalance(saveOrderDto, undefined);
        }
        const created = await tx.saleOrder.create({ data });
        const scope: SaleOrderScope = {
          soId: created.soId,
          soCompanyId: created.soCompanyId,
          soBranchId: created.soBranchId,
          soTenantId: created.soTenantId,
          soAccYear: created.soAccYear,
          soPriceLevel: created.soPriceLevel,
          soOrderSlno: created.soOrderSlno,
          soOrderDate: created.soOrderDate,
          soCustId: created.soCustId,
          soUserId: created.soUserId,
          soSessionId: created.soSessionId,
          soDeviceId: created.soDeviceId,
        };
        const items = await this.syncItems(tx, scope, saveOrderDto.items, createdBy);
        const charges = await this.chargeDetailService.syncDocumentCharges(
          tx,
          this.toChargeScope(scope),
          saveOrderDto.charges,
          createdBy,
          SALE_ORDER_CHARGE_AUDIT,
        );
        const tenders = await this.tenderDetailService.syncDocumentTenders(
          tx,
          this.toTenderScope(scope),
          saveOrderDto.tenders,
          createdBy,
          SALE_ORDER_TENDER_AUDIT,
        );
        // The tendered money is now stored; posting it is what puts it in the
        // ledgers. On create there is never a live receipt, so this always
        // either creates one or does nothing.
        await this.syncAdvanceVoucher(tx, created, createdBy, now);
        const payload = this.toPayload({ ...created, items, charges, tenders });
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SALE_ORDER_TABLE_NAME,
            screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: payload.soId,
            displayName: payload.soOrderRefno || payload.soId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Order created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      const duplicate = this.describeDuplicate(error);
      throwOnUniqueConstraintError<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  private async updateOrder(saveOrderDto: SaveSaleOrderDto): Promise<SaleOrderPayload> {
    const soId = saveOrderDto.soId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleOrder.findFirst({
          where: {
            soId,
            soIsDeleted: false,
          },
        });
        if (!existing) {
          throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
            'Order not found',
            'soId',
            `No active order found with id ${soId}`,
          );
        }
        this.ensureAdvanceRollupsAreConsistent(saveOrderDto, existing);
        const now = new Date();
        const modifiedBy = resolveActor(
          saveOrderDto.soModifiedBy,
          this.requestContextService.getUserId(),
        );
        const data: Prisma.SaleOrderUncheckedUpdateInput = {
          soModifiedOn: now,
          soModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveOrderDto);
        // Keep the derived balance in step when the payload moves any of the
        // four components without restating the balance itself.
        if (
          saveOrderDto.soAdvanceBalanceAmt === undefined &&
          (saveOrderDto.soAdvanceRecdAmt !== undefined ||
            saveOrderDto.soAdvanceAdjustedAmt !== undefined ||
            saveOrderDto.soAdvanceRefundAmt !== undefined ||
            saveOrderDto.soAdvanceForfeitAmt !== undefined)
        ) {
          data.soAdvanceBalanceAmt = this.deriveAdvanceBalance(saveOrderDto, existing);
        }
        const updated = await tx.saleOrder.update({
          where: { soId_soAccYear: { soId: existing.soId, soAccYear: existing.soAccYear } },
          data,
        });
        const scope: SaleOrderScope = {
          soId: updated.soId,
          soCompanyId: updated.soCompanyId,
          soBranchId: updated.soBranchId,
          soTenantId: updated.soTenantId,
          soAccYear: updated.soAccYear,
          soPriceLevel: updated.soPriceLevel,
          soOrderSlno: updated.soOrderSlno,
          soOrderDate: updated.soOrderDate,
          soCustId: updated.soCustId,
          soUserId: updated.soUserId,
          soSessionId: updated.soSessionId,
          soDeviceId: updated.soDeviceId,
        };
        const items = await this.syncItems(tx, scope, saveOrderDto.items, modifiedBy);
        const charges = await this.chargeDetailService.syncDocumentCharges(
          tx,
          this.toChargeScope(scope),
          saveOrderDto.charges,
          modifiedBy,
          SALE_ORDER_CHARGE_AUDIT,
        );
        const tenders = await this.tenderDetailService.syncDocumentTenders(
          tx,
          this.toTenderScope(scope),
          saveOrderDto.tenders,
          modifiedBy,
          SALE_ORDER_TENDER_AUDIT,
        );
        // Brings the receipt in line with whatever the edit did to the tenders:
        // creates one for money just taken, re-syncs an existing one, or cancels
        // it when the last tender is gone or the order was cancelled.
        await this.syncAdvanceVoucher(tx, updated, modifiedBy, now);
        const payload = this.toPayload({ ...updated, items, charges, tenders });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SALE_ORDER_TABLE_NAME,
            screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: soId,
            displayName: payload.soOrderRefno || payload.soId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.soModifiedBy || payload.soCreatedBy,
            notes: 'Order updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      const duplicate = this.describeDuplicate(error);
      throwOnUniqueConstraintError<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  // Reconciles the order's line items with the payload array:
  //   - a line carrying soiId updates that existing line
  //   - a line without soiId is created
  //   - an existing line absent from the array is soft deleted
  // Passing `undefined` (property omitted) leaves the current lines untouched.
  //
  // Order matters, for the same reason as the bill/quotation modules — and here
  // the dance is load-bearing rather than precautionary: ux_soi_order_line is a
  // real partial unique index in the DB. The replaced lines are soft deleted
  // first (freeing their line numbers — the index ignores deleted rows), and
  // surviving lines the payload reorders are parked above every requested
  // number before being renumbered down, so a 1<->2 swap never passes through a
  // state where both rows want the same number.
  private async syncItems(
    tx: SaleOrderWriteClient,
    scope: SaleOrderScope,
    inputItems: SaveSaleOrderItemDto[] | undefined,
    actorId: string,
  ): Promise<SaleOrderItem[]> {
    const existing = await tx.saleOrderItem.findMany({
      where: { soiOrderId: scope.soId, soiIsDeleted: false },
      orderBy: { soiLineNo: 'asc' },
    });
    if (inputItems === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((item) => [item.soiId, item]));
    const now = new Date();
    // Line numbers first: an entry keeps the number it sent, otherwise it takes
    // its position in the array.
    const resolvedItems = inputItems.map((inputItem, index) => ({
      inputItem,
      lineNo: inputItem.soiLineNo ?? index + 1,
    }));
    const seenLineNos = new Set<number>();
    const keptIds = new Set<string>();
    for (const { inputItem, lineNo } of resolvedItems) {
      if (seenLineNos.has(lineNo)) {
        throwSalesConflict<SaleOrderErrorDetail, SaleOrderErrorResponse>(
          'Duplicate order line number is not allowed',
          [
            {
              field: 'soiLineNo',
              message: `An order line already exists with line number ${lineNo}`,
            },
          ],
        );
      }
      seenLineNos.add(lineNo);
      if (inputItem.soiId) {
        if (!existingMap.has(inputItem.soiId)) {
          throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
            'Order item not found',
            'soiId',
            `No active order line found with id ${inputItem.soiId} on this order`,
          );
        }
        keptIds.add(inputItem.soiId);
      }
    }
    // Retire the lines the payload dropped before inserting anything: leaving
    // them active would hold their line numbers against the replacements.
    await this.softDeleteItems(
      tx,
      existing.filter((item) => !keptIds.has(item.soiId)),
      actorId,
      now,
    );
    // The surviving lines can still be in each other's way when the payload
    // reorders them (1<->2 renumbers through a state where both rows want 2),
    // so they are parked above every number the payload asks for and
    // renumbered down from there. Skipped when no survivor changes number,
    // which is the usual edit.
    const reordersItems = resolvedItems.some(
      ({ inputItem, lineNo }) =>
        inputItem.soiId !== undefined && existingMap.get(inputItem.soiId)?.soiLineNo !== lineNo,
    );
    if (reordersItems && keptIds.size > 0) {
      await tx.saleOrderItem.updateMany({
        where: { soiId: { in: [...keptIds] } },
        data: { soiLineNo: { increment: Math.max(...seenLineNos) + 1 } },
      });
    }
    const persisted: SaleOrderItem[] = [];
    for (const { inputItem, lineNo } of resolvedItems) {
      if (inputItem.soiId) {
        // Present — the validation pass above already rejected an id that is not
        // an active line on this order.
        const existingItem = existingMap.get(inputItem.soiId)!;
        this.ensureOrderItemValuesAreAllowed(inputItem, existingItem);
        const updateData: Prisma.SaleOrderItemUncheckedUpdateInput = {
          soiLineNo: lineNo,
          soiItemId: inputItem.soiItemId ?? existingItem.soiItemId,
          soiItemUnitId: inputItem.soiItemUnitId ?? existingItem.soiItemUnitId,
          soiPriceLevel: inputItem.soiPriceLevel ?? scope.soPriceLevel,
          soiModifiedOn: now,
          soiModifiedBy: resolveActor(inputItem.soiModifiedBy, actorId),
        };
        applyPresentFields(
          updateData,
          inputItem,
          SALE_ORDER_ITEM_OPTIONAL_FIELDS,
          SALE_ORDER_ITEM_DATE_TRANSFORMS,
        );
        this.applyDerivedItemQuantities(updateData, inputItem, existingItem);
        const updated = await tx.saleOrderItem.update({
          where: {
            soiId_soiAccYear: { soiId: inputItem.soiId, soiAccYear: existingItem.soiAccYear },
          },
          data: updateData,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SALE_ORDER_ITEM_TABLE_NAME,
            screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.soiId,
            displayName: `Line ${updated.soiLineNo}`,
            originalRecord: this.toItemPayload(existingItem),
            modifiedRecord: this.toItemPayload(updated),
            userId: resolveActor(inputItem.soiModifiedBy, actorId),
            notes: 'Order item updated',
          },
          tx,
        );
        persisted.push(updated);
        continue;
      }
      this.ensureOrderItemValuesAreAllowed(inputItem, undefined);
      const createData: Prisma.SaleOrderItemUncheckedCreateInput = {
        soiOrderId: scope.soId,
        soiCompanyId: inputItem.soiCompanyId ?? scope.soCompanyId,
        soiBranchId: inputItem.soiBranchId ?? scope.soBranchId,
        soiTenantId: inputItem.soiTenantId ?? scope.soTenantId,
        soiAccYear: inputItem.soiAccYear ?? scope.soAccYear,
        soiLineNo: lineNo,
        soiItemId: this.requireItemField(inputItem.soiItemId, 'soiItemId'),
        soiItemUnitId: this.requireItemField(inputItem.soiItemUnitId, 'soiItemUnitId'),
        soiPriceLevel: inputItem.soiPriceLevel ?? scope.soPriceLevel,
        soiCreatedOn: now,
        soiCreatedBy: resolveActor(inputItem.soiCreatedBy, actorId),
      };
      applyPresentFields(
        createData,
        inputItem,
        SALE_ORDER_ITEM_OPTIONAL_FIELDS,
        SALE_ORDER_ITEM_DATE_TRANSFORMS,
      );
      this.applyDerivedItemQuantities(createData, inputItem, undefined);
      const created = await tx.saleOrderItem.create({ data: createData });
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: SALE_ORDER_ITEM_TABLE_NAME,
          screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: created.soiId,
          displayName: `Line ${created.soiLineNo}`,
          originalRecord: null,
          modifiedRecord: this.toItemPayload(created),
          userId: created.soiCreatedBy,
          notes: 'Order item created',
        },
        tx,
      );
      persisted.push(created);
    }
    return persisted.sort((left, right) => left.soiLineNo - right.soiLineNo);
  }
  // Retires the lines the payload no longer carries. Called before the payload
  // is written so the freed line numbers are available to the replacements.
  private async softDeleteItems(
    tx: SaleOrderWriteClient,
    removed: SaleOrderItem[],
    actorId: string,
    now: Date,
  ): Promise<void> {
    for (const removedItem of removed) {
      const deleted = await tx.saleOrderItem.update({
        where: {
          soiId_soiAccYear: { soiId: removedItem.soiId, soiAccYear: removedItem.soiAccYear },
        },
        data: {
          soiIsDeleted: true,
          soiModifiedOn: now,
          soiModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SALE_ORDER_ITEM_TABLE_NAME,
          screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: deleted.soiId,
          displayName: `Line ${removedItem.soiLineNo}`,
          originalRecord: this.toItemPayload(removedItem),
          modifiedRecord: this.toItemPayload(deleted),
          userId: actorId,
          notes: 'Order item soft deleted',
        },
        tx,
      );
    }
  }
  // Posts the order's tendered money to accounts, or brings an already-posted
  // receipt back in line with it.
  //
  // The tender rows are re-read here rather than taken from what
  // syncDocumentTenders answered: that method returns display payloads (decimals
  // as numbers) and returns the STORED lines untouched when the save omitted the
  // tenders array, whereas the books need the current rows as Prisma decimals
  // either way.
  //
  // Runs inside the save's own transaction, so an order and the receipt behind
  // its advance commit or roll back together.
  private async syncAdvanceVoucher(
    tx: SaleOrderWriteClient,
    order: SaleOrder,
    actor: string,
    now: Date,
  ): Promise<OrderAdvancePostingSyncResult> {
    const tenders = await this.tenderDetailService.findDocumentTenders(
      tx,
      SALE_ORDER_TENDER_SRC_MODULE,
      SALE_ORDER_TENDER_SRC_DOC_TYPE,
      order.soId,
    );
    return syncOrderAdvancePosting(tx, order, tenders, actor, now);
  }
  // Names the duplicate a P2002 actually is. sale_order DOES define unique
  // indexes (ux_so_slno per device, ux_so_order_no per branch/year — both
  // partial, both DB-only) and sale_order_item has ux_soi_order_line — but the
  // tables are PARTITIONED, so Postgres reports the violation against the
  // partition-local index (e.g. sale_order_2026_2027_so_company_id_..._idx4),
  // whose auto-generated name is truncated at 63 chars and positional. The
  // header's two indexes truncate to the same prefix, so they cannot be told
  // apart by name — only the line index (a different table) can.
  private describeDuplicate(error: unknown): { message: string; errors: SaleOrderErrorDetail[] } {
    const target = (error as { meta?: { target?: unknown } } | null)?.meta?.target;
    const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '');
    if (targetText.includes('sale_order_item')) {
      return {
        message: 'Duplicate order line number is not allowed',
        errors: [
          {
            field: 'soiLineNo',
            message: 'An order line already exists with this line number',
          },
        ],
      };
    }
    return {
      message: 'Order number already exists',
      errors: [
        {
          field: 'soOrderRefno',
          message:
            'An order already exists with this order number in this company/branch/year scope',
        },
      ],
    };
  }
  // Mirrors the single-column DB CHECK constraints on sale_order (ck_so_doc_type
  // / ck_so_order_type / ck_so_priority / ck_so_delivery_mode / ck_so_status /
  // ck_so_fulfil_status / ck_so_pay_status / ck_so_advance_policy /
  // ck_so_advance_status, migration 20260808132323) so a bad value comes back as
  // a 400 with the offending field instead of a raw Postgres 23514. Only the
  // fields present on the payload are checked — an update that omits a field
  // leaves whatever is already stored untouched, so there is nothing new to
  // validate.
  private ensureOrderValuesAreAllowed(dto: SaveSaleOrderDto): void {
    const values: SaleOrderGuardedValues = {
      soDocType: dto.soDocType,
      soOrderType: dto.soOrderType,
      soPriority: dto.soPriority,
      soDeliveryMode: dto.soDeliveryMode,
      soStatus: dto.soStatus,
      soFulfilStatus: dto.soFulfilStatus,
      soPayStatus: dto.soPayStatus,
      soAdvancePolicy: dto.soAdvancePolicy,
      soAdvanceStatus: dto.soAdvanceStatus,
    };
    const details: SaleOrderErrorDetail[] = [];
    for (const guard of SALE_ORDER_VALUE_GUARDS) {
      const value = values[guard.field];
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        if (!guard.nullable) {
          details.push({ field: guard.field, message: `${guard.field} is required` });
        }
        continue;
      }
      if (!(guard.allowed as readonly string[]).includes(value)) {
        details.push({
          field: guard.field,
          message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
        });
      }
    }
    if (details.length > 0) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Invalid order value',
        details,
      );
    }
  }
  // Mirrors the cross-field advance CHECKs on the header (ck_so_advance_amounts
  // / ck_so_advance_balance / ck_so_advance_policy_input), judged on the FINAL
  // resolved values — the payload's, falling back to the existing row's on
  // update — the same way the bill module judges ck_sbi_batch_split. The
  // balance itself is special-cased: when the payload does not carry it, it is
  // DERIVED from the other four (see deriveAdvanceBalance) rather than judged,
  // so an ordinary save never trips the equation by omission.
  private ensureAdvanceRollupsAreConsistent(
    dto: SaveSaleOrderDto,
    existing: SaleOrder | undefined,
  ): void {
    const details: SaleOrderErrorDetail[] = [];
    const recd = asNumber(merged(dto.soAdvanceRecdAmt, existing?.soAdvanceRecdAmt));
    const adjusted = asNumber(merged(dto.soAdvanceAdjustedAmt, existing?.soAdvanceAdjustedAmt));
    const refund = asNumber(merged(dto.soAdvanceRefundAmt, existing?.soAdvanceRefundAmt));
    const forfeit = asNumber(merged(dto.soAdvanceForfeitAmt, existing?.soAdvanceForfeitAmt));
    const required = asNumber(merged(dto.soAdvanceRequired, existing?.soAdvanceRequired));
    const amounts: Array<[string, number]> = [
      ['soAdvanceRequired', required],
      ['soAdvanceRecdAmt', recd],
      ['soAdvanceAdjustedAmt', adjusted],
      ['soAdvanceRefundAmt', refund],
      ['soAdvanceForfeitAmt', forfeit],
    ];
    for (const [field, amount] of amounts) {
      if (amount < 0) {
        details.push({ field, message: `${field} must not be negative` });
      }
    }
    const expectedBalance = recd - adjusted - refund - forfeit;
    if (dto.soAdvanceBalanceAmt !== undefined) {
      const balance = asNumber(dto.soAdvanceBalanceAmt);
      if (balance < 0) {
        details.push({
          field: 'soAdvanceBalanceAmt',
          message: 'soAdvanceBalanceAmt must not be negative',
        });
      }
      if (Math.abs(balance - expectedBalance) > AMOUNT_EPSILON) {
        details.push({
          field: 'soAdvanceBalanceAmt',
          message:
            'soAdvanceBalanceAmt must equal soAdvanceRecdAmt − soAdvanceAdjustedAmt − ' +
            'soAdvanceRefundAmt − soAdvanceForfeitAmt (ck_so_advance_balance)',
        });
      }
    } else if (expectedBalance < -AMOUNT_EPSILON) {
      // The derived balance would be negative, which ck_so_advance_amounts
      // rejects: more money was used than was ever received.
      details.push({
        field: 'soAdvanceBalanceAmt',
        message:
          'The advance roll-ups use more than was received: received − adjusted − refunded − ' +
          'forfeited must not be negative',
      });
    }
    // A percentage policy needs a percentage; a fixed one needs an amount.
    const policy = merged(dto.soAdvancePolicy, existing?.soAdvancePolicy) ?? 'NONE';
    const perc = asNumber(merged(dto.soAdvancePerc, existing?.soAdvancePerc));
    if (policy === 'PERC' && perc <= 0) {
      details.push({
        field: 'soAdvancePerc',
        message: "soAdvancePerc must be greater than 0 when soAdvancePolicy is 'PERC'",
      });
    }
    if (policy === 'FIXED' && required <= 0) {
      details.push({
        field: 'soAdvanceRequired',
        message: "soAdvanceRequired must be greater than 0 when soAdvancePolicy is 'FIXED'",
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Invalid order value',
        details,
      );
    }
  }
  // What the company still holds = taken − used − given back − kept, rounded to
  // the paisa exactly as ck_so_advance_balance demands.
  private deriveAdvanceBalance(dto: SaveSaleOrderDto, existing: SaleOrder | undefined): number {
    const recd = asNumber(merged(dto.soAdvanceRecdAmt, existing?.soAdvanceRecdAmt));
    const adjusted = asNumber(merged(dto.soAdvanceAdjustedAmt, existing?.soAdvanceAdjustedAmt));
    const refund = asNumber(merged(dto.soAdvanceRefundAmt, existing?.soAdvanceRefundAmt));
    const forfeit = asNumber(merged(dto.soAdvanceForfeitAmt, existing?.soAdvanceForfeitAmt));
    return Math.round((recd - adjusted - refund - forfeit) * 100) / 100;
  }
  // Mirrors the DB CHECK constraints on sale_order_item (ck_soi_free_type /
  // ck_soi_line_status / ck_soi_qty_signs / ck_soi_reserved / ck_soi_size),
  // judged on the FINAL resolved values. The fulfilment identity — what is left
  // pending — is handled separately by applyDerivedItemQuantities, since
  // migration 20260814060000 made soi_pending_qty a generated column.
  private ensureOrderItemValuesAreAllowed(
    inputItem: SaveSaleOrderItemDto,
    existingItem: SaleOrderItem | undefined,
  ): void {
    const details: SaleOrderErrorDetail[] = [];
    if (inputItem.soiFreeType !== undefined && inputItem.soiFreeType !== null) {
      if (!(SALE_ORDER_ITEM_FREE_TYPES as readonly string[]).includes(inputItem.soiFreeType)) {
        details.push({
          field: 'soiFreeType',
          message: `soiFreeType must be one of: ${SALE_ORDER_ITEM_FREE_TYPES.join(', ')}`,
        });
      }
    }
    // soi_line_status is generated, so a payload value is never written — but a
    // client sending one that is not even in the vocabulary has misunderstood
    // the column, and is told so rather than having it quietly dropped.
    if (inputItem.soiLineStatus !== undefined) {
      if (
        inputItem.soiLineStatus === null ||
        !(SALE_ORDER_ITEM_LINE_STATUSES as readonly string[]).includes(inputItem.soiLineStatus)
      ) {
        details.push({
          field: 'soiLineStatus',
          message: `soiLineStatus must be one of: ${SALE_ORDER_ITEM_LINE_STATUSES.join(', ')}`,
        });
      }
    }
    // ck_soi_size: NULL is allowed, a blank string is not. The DTO already
    // trims, so anything left is either null or has content.
    if (inputItem.soiSize !== undefined && inputItem.soiSize !== null) {
      if (inputItem.soiSize.trim().length === 0) {
        details.push({
          field: 'soiSize',
          message: 'soiSize must not be blank; omit it or send null instead',
        });
      }
    }
    const orderQty = asNumber(merged(inputItem.soiOrderQty, existingItem?.soiOrderQty));
    const deliveredQty = asNumber(merged(inputItem.soiDeliveredQty, existingItem?.soiDeliveredQty));
    const cancelledQty = asNumber(merged(inputItem.soiCancelledQty, existingItem?.soiCancelledQty));
    const reservedQty = asNumber(merged(inputItem.soiReservedQty, existingItem?.soiReservedQty));
    for (const [field, qty] of [
      ['soiOrderQty', orderQty],
      ['soiDeliveredQty', deliveredQty],
      ['soiCancelledQty', cancelledQty],
    ] as Array<[string, number]>) {
      if (qty < 0) {
        details.push({ field, message: `${field} must not be negative` });
      }
    }
    if (inputItem.soiPendingQty !== undefined && asNumber(inputItem.soiPendingQty) < 0) {
      details.push({ field: 'soiPendingQty', message: 'soiPendingQty must not be negative' });
    }
    if (reservedQty < 0 || reservedQty > orderQty + QTY_EPSILON) {
      details.push({
        field: 'soiReservedQty',
        message: 'soiReservedQty must be between 0 and soiOrderQty (ck_soi_reserved)',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Invalid order item value',
        details,
      );
    }
  }
  // The fulfilment identity, now that the DB owns it: soi_pending_qty is
  // GENERATED as soi_net_qty − delivered − cancelled (migration
  // 20260814060000), so nothing here writes it. What is left is to keep a
  // payload from producing a row Postgres would refuse, and to word the refusal
  // in the client's own field names rather than as a raw ck_soi_qty_signs
  // violation.
  //
  // soi_net_qty is the BILLABLE quantity — the one soi_delivered_qty is summed
  // against from sbi_net_qty — so a new line that says only how much was ordered
  // is given the same number to be billed against. Without it the line would sit
  // at net 0 with nothing pending, and the first bill against it would be an
  // over-delivery.
  private applyDerivedItemQuantities(
    data: Prisma.SaleOrderItemUncheckedCreateInput | Prisma.SaleOrderItemUncheckedUpdateInput,
    inputItem: SaveSaleOrderItemDto,
    existingItem: SaleOrderItem | undefined,
  ): void {
    const orderQty = asNumber(merged(inputItem.soiOrderQty, existingItem?.soiOrderQty));
    if (!existingItem && inputItem.soiNetQty === undefined) {
      data.soiNetQty = orderQty;
    }
    const netQty =
      inputItem.soiNetQty !== undefined
        ? asNumber(inputItem.soiNetQty)
        : existingItem
          ? asNumber(existingItem.soiNetQty)
          : orderQty;
    const deliveredQty = asNumber(merged(inputItem.soiDeliveredQty, existingItem?.soiDeliveredQty));
    const cancelledQty = asNumber(merged(inputItem.soiCancelledQty, existingItem?.soiCancelledQty));
    // Rounded to the milli-unit exactly as the numeric(15,3) column stores it,
    // which is also how the generated column rounds.
    const derivedPending = Math.round((netQty - deliveredQty - cancelledQty) * 1000) / 1000;
    if (derivedPending < -QTY_EPSILON) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Invalid order item value',
        [
          {
            field: 'soiNetQty',
            message:
              'soiDeliveredQty + soiCancelledQty must not exceed soiNetQty ' +
              '(soi_pending_qty is derived from the three and ck_soi_qty_signs keeps it positive)',
          },
        ],
      );
    }
    // A payload that carries the derived column is not refused for carrying it —
    // a client round-tripping a GET response does — but it IS told when the
    // number it sent is not the number the row will hold, rather than saving
    // something that silently disagrees with what it displayed.
    if (
      inputItem.soiPendingQty !== undefined &&
      Math.abs(asNumber(inputItem.soiPendingQty) - derivedPending) > QTY_EPSILON
    ) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        'Invalid order item value',
        [
          {
            field: 'soiPendingQty',
            message:
              'soiPendingQty is derived by the database as soiNetQty − soiDeliveredQty − ' +
              'soiCancelledQty and cannot be set; omit it or send the derived value',
          },
        ],
      );
    }
  }
  private requireItemField(value: string | undefined, field: string): string {
    if (!value) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>(
        `${field} is required for a new entry`,
        [
          {
            field,
            message: `${field} must be provided when creating this entry`,
          },
        ],
      );
    }
    return value;
  }
  // The order's applied charges as the charge-detail module wants them: its
  // lines carry the ORDER discriminator, and every charge inherits the header's
  // company / branch / accounting year and defaults its cdVoucherNo to the
  // order's own number.
  private toChargeScope(scope: SaleOrderScope): ChargeDocumentScope {
    return {
      cdDocType: SALE_ORDER_CHARGE_DOC_TYPE,
      cdDocId: scope.soId,
      cdCompId: scope.soCompanyId,
      cdBranchId: scope.soBranchId,
      cdAccYear: scope.soAccYear,
      cdVoucherNo: scope.soOrderSlno,
    };
  }
  // The same for the tendered money: an order's tenders are SALES / SALES_ORDER
  // rows pointing at soId, dated with the order, raised against the customer's
  // ledger and captured by the order's own user / session / device.
  //
  // td_party_ledger_id takes soCustId: a customer row and its account ledger
  // share one primary key (CustomerService mirrors every customer into
  // acc_ledger_master under the same id), so the order's customer IS the ledger
  // the money is owed by. A line may still name a different party ledger, and
  // the tender module verifies whichever id it gets.
  private toTenderScope(scope: SaleOrderScope): TenderDocumentScope {
    return {
      tdSrcModule: SALE_ORDER_TENDER_SRC_MODULE,
      tdSrcDocType: SALE_ORDER_TENDER_SRC_DOC_TYPE,
      tdSrcDocId: scope.soId,
      tdCompanyId: scope.soCompanyId,
      tdBranchId: scope.soBranchId,
      tdTenantId: scope.soTenantId,
      tdAccYear: scope.soAccYear,
      tdDocDate: scope.soOrderDate,
      tdPartyLedgerId: scope.soCustId,
      tdUserId: scope.soUserId,
      tdSessionId: scope.soSessionId,
      // td_device_id is free text on the tender side; the order's device uuid
      // is passed through as its string form.
      tdDeviceId: scope.soDeviceId,
      tdDrCr: SALE_ORDER_TENDER_DR_CR,
    };
  }
  private applyOptionalFields(
    data: Prisma.SaleOrderUncheckedCreateInput | Prisma.SaleOrderUncheckedUpdateInput,
    dto: SaveSaleOrderDto,
  ): void {
    applyPresentFields(data, dto, SALE_ORDER_OPTIONAL_FIELDS, SALE_ORDER_DATE_TRANSFORMS);
  }
  // One batched read of the godown names the order's lines point at, keyed by
  // gdl_id. soi_godown_id is nullable (a reservation is optional), so null
  // entries are skipped. Empty on the create/update paths, which do not resolve
  // display names — see toItemPayload.
  private async resolveGodownNames(
    items: readonly Pick<SaleOrderItem, 'soiGodownId'>[] = [],
  ): Promise<Map<string, string>> {
    const godownIds = [
      ...new Set(
        items
          .map((item) => item.soiGodownId)
          .filter((godownId): godownId is string => godownId !== null),
      ),
    ];
    if (godownIds.length === 0) {
      return new Map();
    }
    const godowns = await this.prisma.godownLocation.findMany({
      where: { gdlId: { in: godownIds } },
      select: { gdlId: true, gdlName: true },
    });
    return new Map(godowns.map((godown) => [godown.gdlId, godown.gdlName]));
  }
  // One batched read per master over every id the order and its children point
  // at, run concurrently. An id column that is empty across the whole document
  // (no salesman on any line, no tenders at all) issues no query.
  private async resolveDisplayNames(
    record: SaleOrder & { items?: SaleOrderItemWithNames[] },
    charges: readonly SaleOrderChargePayload[],
    tenders: readonly SaleOrderTenderPayload[],
  ): Promise<SaleOrderNameMaps> {
    const items = record.items ?? [];
    const companyIds = distinctIds([
      record.soCompanyId,
      ...items.map((item) => item.soiCompanyId),
      ...charges.map((charge) => charge.cdCompId),
      ...tenders.map((tender) => tender.tdCompanyId),
    ]);
    const branchIds = distinctIds([
      record.soBranchId,
      ...items.map((item) => item.soiBranchId),
      ...charges.map((charge) => charge.cdBranchId),
    ]);
    // so_salesman_id is a uuid[] (an order can be credited to several people),
    // soi_salesman_id a single uuid; both point at settings.employee_master.
    const employeeIds = distinctIds([
      ...(record.soSalesmanId ?? []),
      ...items.map((item) => item.soiSalesmanId),
    ]);
    const ledgerIds = distinctIds(tenders.map((tender) => tender.tdPartyLedgerId));
    const userIds = distinctIds(tenders.map((tender) => tender.tdUserId));
    const [companies, branches, employees, ledgers, users, godownNameById] = await Promise.all([
      companyIds.length
        ? this.prisma.company.findMany({
            where: { compId: { in: companyIds } },
            select: { compId: true, compName: true },
          })
        : [],
      branchIds.length
        ? this.prisma.branchMaster.findMany({
            where: { brId: { in: branchIds } },
            select: { brId: true, brName: true },
          })
        : [],
      employeeIds.length
        ? this.prisma.employeeMaster.findMany({
            where: { empId: { in: employeeIds } },
            select: { empId: true, empName: true },
          })
        : [],
      ledgerIds.length
        ? this.prisma.accLedgerMaster.findMany({
            where: { ledId: { in: ledgerIds } },
            select: { ledId: true, ledName: true },
          })
        : [],
      userIds.length
        ? this.prisma.userMaster.findMany({
            where: { usrId: { in: userIds } },
            select: { usrId: true, usrDisplayName: true },
          })
        : [],
      this.resolveGodownNames(items),
    ]);
    return {
      companyNameById: new Map(companies.map((company) => [company.compId, company.compName])),
      branchNameById: new Map(branches.map((branch) => [branch.brId, branch.brName])),
      employeeNameById: new Map(employees.map((employee) => [employee.empId, employee.empName])),
      ledgerNameById: new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName])),
      userNameById: new Map(users.map((user) => [user.usrId, user.usrDisplayName])),
      godownNameById,
    };
  }
  private toPayload(
    record: SaleOrder & {
      items?: SaleOrderItemWithNames[];
      // Already shaped by ChargeDetailService / TenderDetailService — the order
      // passes them through.
      charges?: SaleOrderChargePayload[];
      tenders?: SaleOrderTenderPayload[];
    },
    names: SaleOrderNameMaps = EMPTY_NAME_MAPS,
  ): SaleOrderPayload {
    const {
      soCreatedOn,
      soModifiedOn,
      soOrderDatetime,
      soSyncDate,
      soOrderSlno,
      items,
      charges,
      tenders,
      ...rest
    } = record;
    return {
      ...rest,
      soCreatedOn: soCreatedOn?.toISOString(),
      soModifiedOn: soModifiedOn?.toISOString() ?? null,
      soOrderDatetime: soOrderDatetime?.toISOString(),
      soSyncDate: soSyncDate?.toISOString() ?? null,
      // bigint column — stringified here for the same reason cdVoucherNo is:
      // JSON has no bigint and res.json() throws on one.
      soOrderSlno: soOrderSlno?.toString() ?? null,
      soCompanyName: names.companyNameById.get(rest.soCompanyId) ?? null,
      soBranchName: names.branchNameById.get(rest.soBranchId) ?? null,
      // Parallel to the uuid[] it labels, so position n of one is position n of
      // the other. A partially-built record (an audit original) may not carry
      // the column at all, which stays null rather than becoming [].
      soSalesmanName: Array.isArray(rest.soSalesmanId)
        ? rest.soSalesmanId.map((salesmanId) => names.employeeNameById.get(salesmanId) ?? null)
        : null,
      items: items ? items.map((item) => this.toItemPayload(item, names)) : [],
      charges: (charges ?? []).map((charge) => this.withChargeNames(charge, names)),
      tenders: (tenders ?? []).map((tender) => this.withTenderNames(tender, names)),
    };
  }
  private toItemPayload(
    record: SaleOrderItemWithNames,
    names: SaleOrderNameMaps = EMPTY_NAME_MAPS,
  ): SaleOrderItemPayload {
    const { soiCreatedOn, soiModifiedOn, soiSyncDate, item, itemUnitConversion, ...rest } = record;
    return {
      ...rest,
      soiCreatedOn: soiCreatedOn?.toISOString(),
      soiModifiedOn: soiModifiedOn?.toISOString() ?? null,
      soiSyncDate: soiSyncDate?.toISOString() ?? null,
      soiItemName: item?.itemNameEn ?? null,
      soiUnitName: itemUnitConversion?.unit.unit_name ?? null,
      soiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
      soiGroupId: item?.itemGroupId ?? null,
      soiBrandId: item?.itemBrandId ?? null,
      soiSectionId: item?.itemSectionId ?? null,
      soiCategoryId: item?.itemCategoryId ?? null,
      soiGodownName: record.soiGodownId
        ? (names.godownNameById.get(record.soiGodownId) ?? null)
        : null,
      soiCompanyName: names.companyNameById.get(record.soiCompanyId) ?? null,
      soiBranchName: names.branchNameById.get(record.soiBranchId) ?? null,
      soiSalesmanName: record.soiSalesmanId
        ? (names.employeeNameById.get(record.soiSalesmanId) ?? null)
        : null,
    };
  }
  // The charge / tender rows are already shaped by their owning module by the
  // time they get here, so the names are layered on rather than built in.
  private withChargeNames(
    payload: SaleOrderChargePayload,
    names: SaleOrderNameMaps,
  ): SaleOrderChargePayload {
    return {
      ...payload,
      cdCompName: names.companyNameById.get(payload.cdCompId) ?? null,
      cdBranchName: names.branchNameById.get(payload.cdBranchId) ?? null,
    };
  }
  private withTenderNames(
    payload: SaleOrderTenderPayload,
    names: SaleOrderNameMaps,
  ): SaleOrderTenderPayload {
    return {
      ...payload,
      tdCompanyName: names.companyNameById.get(payload.tdCompanyId) ?? null,
      tdPartyLedgerName: names.ledgerNameById.get(payload.tdPartyLedgerId) ?? null,
      tdUserName: names.userNameById.get(payload.tdUserId) ?? null,
    };
  }
}
