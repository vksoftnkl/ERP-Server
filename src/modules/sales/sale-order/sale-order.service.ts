import { Injectable } from '@nestjs/common';
import { Prisma, SaleOrder, SaleOrderAdvanceAlloc, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { SaveSaleOrderItemDto } from './dto/save-sale-order-item.dto';
import { SaveSaleOrderAdvanceDto } from './dto/save-sale-order-advance.dto';
import {
  SALE_ORDER_CHARGE_AUDIT,
  SALE_ORDER_CHARGE_DOC_TYPE,
  SALE_ORDER_TENDER_AUDIT,
  SALE_ORDER_TENDER_DR_CR,
  SALE_ORDER_TENDER_SRC_DOC_TYPE,
  SALE_ORDER_TENDER_SRC_MODULE,
  SaleOrderAdvancePayload,
  SaleOrderChargePayload,
  SaleOrderErrorDetail,
  SaleOrderErrorResponse,
  SaleOrderItemPayload,
  SaleOrderPayload,
  SaleOrderTenderPayload,
} from './types/sale-order-api.types';
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
// accounts.acc_voucher_types row "SOr" / Sales Order (seeded by
// prisma/seed/Acc_Voucher_Types_Sale_Order.sql). Its numbering format
// (prefix / width / reset frequency) seeds the acc_voucher_seq row the order
// numbers are drawn from.
const SALE_ORDER_VCHR_TYPE_ID = 4;
const SALE_ORDER_TABLE_NAME = 'sale_order';
const SALE_ORDER_ITEM_TABLE_NAME = 'sale_order_item';
const SALE_ORDER_ADVANCE_TABLE_NAME = 'sale_order_advance_alloc';
const SALE_ORDER_AUDIT_SCREEN_NAME = 'Sale Order';
// Allowed-value sets mirroring the DB CHECK constraints on sale_order /
// sale_order_item / sale_order_advance_alloc (migration 20260808132323). Unlike
// sale_bill — whose ck_sb_* constraints were dropped before ever being applied —
// these constraints EXIST in the database; the mirrors below are so a bad value
// comes back as a 400 naming the field instead of a raw Postgres 23514, with
// the DB as the backstop.
const SALE_ORDER_DOC_TYPES = ['SALES_ORDER', 'BOOKING', 'CUSTOM_ORDER'] as const;
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
const SALE_ORDER_ITEM_LINE_STATUSES = ['PENDING', 'PARTIAL', 'DELIVERED', 'CANCELLED'] as const;
const SALE_ORDER_ADVANCE_ALLOC_TYPES = ['ADJUSTED', 'REFUNDED', 'FORFEITED', 'TRANSFERRED'] as const;
const SALE_ORDER_ADVANCE_REFUND_MODES = [
  'CASH',
  'BANK',
  'UPI',
  'CARD',
  'CREDIT_NOTE',
  'ADJUSTMENT',
] as const;
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
  'soiPendingQty',
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
  'soiLineStatus',
  'soiSalesmanId',
  'soiSchemeId',
  'soiSchemeName',
  'soiRemarks',
];
// Advance-allocation fields copied straight through when present on the
// payload. The scope keys (company/branch/tenant/accYear and the order pair)
// and the three fields required for a new row (soaAllocType, soaAllocDate,
// soaAmount) are set explicitly, so they are excluded here.
const SALE_ORDER_ADVANCE_OPTIONAL_FIELDS = [
  'soaOrderRefno',
  'soaTenderId',
  'soaTenderAccYear',
  'soaBillId',
  'soaBillAccYear',
  'soaBillRefno',
  'soaTargetOrderId',
  'soaTargetAccYear',
  'soaRefundTenderId',
  'soaRefundMode',
  'soaVoucherId',
  'soaLedgerId',
  'soaRemarks',
  'soaApprovedBy',
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
// The immutable scope inherited by every line / charge / tender / advance row
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
// charges, tenders and advances — nulls dropped, so an all-null column costs no
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
  ) { }
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
    // The advance allocations ARE this module's rows, read directly. The FK
    // pair keys them to the order's own year, so both columns are matched.
    const advances = await this.prisma.saleOrderAdvanceAlloc.findMany({
      where: {
        soaOrderId: soId,
        soaOrderAccYear: soAccYear,
        soaIsDeleted: false,
      },
      orderBy: [{ soaAllocDate: 'asc' }, { soaCreatedOn: 'asc' }],
    });
    const advancePayloads = advances.map((advance) => this.toAdvancePayload(advance));
    // The remaining ids — the godown, the company / branch / salesman columns on
    // the header and its lines, and the company / party ledger / user the charge
    // and tender rows carry — have no FK to ride an `include` on, so they are
    // resolved in one batched lookup per master over the ids this order uses.
    const names = await this.resolveDisplayNames(record, charges, tenders, advancePayloads);
    return this.toPayload(
      {
        ...record,
        charges,
        tenders,
        advances: advancePayloads,
      },
      names,
    );
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
      // fact (sale_order carries no cancellation columns of its own); until a
      // status-trail writer exists, the audit log entry below is the record.
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
      // ... and for the advance allocations this module owns itself.
      await tx.saleOrderAdvanceAlloc.updateMany({
        where: {
          soaOrderId: soId,
          soaOrderAccYear: soAccYear,
          soaIsDeleted: false,
        },
        data: {
          soaIsDeleted: true,
          soaModifiedOn: modifiedOn,
          soaModifiedBy: actor,
        },
      });
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
        const advances = await this.syncAdvances(tx, scope, saveOrderDto.advances, createdBy);
        const payload = this.toPayload({ ...created, items, charges, tenders, advances });
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
        const advances = await this.syncAdvances(tx, scope, saveOrderDto.advances, modifiedBy);
        const payload = this.toPayload({ ...updated, items, charges, tenders, advances });
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
  // Reconciles the order's advance allocations with the payload array, the same
  // shape as every other nested sync: soaId → update, no soaId → create, an
  // existing row absent from the array → soft deleted, property omitted →
  // untouched. These rows are owned by this module (no separate owner service),
  // so the reconciliation and the ck_soa_* mirrors live here.
  private async syncAdvances(
    tx: SaleOrderWriteClient,
    scope: SaleOrderScope,
    inputAdvances: SaveSaleOrderAdvanceDto[] | undefined,
    actorId: string,
  ): Promise<SaleOrderAdvancePayload[]> {
    const existing = await tx.saleOrderAdvanceAlloc.findMany({
      where: { soaOrderId: scope.soId, soaOrderAccYear: scope.soAccYear, soaIsDeleted: false },
      orderBy: [{ soaAllocDate: 'asc' }, { soaCreatedOn: 'asc' }],
    });
    if (inputAdvances === undefined) {
      return existing.map((advance) => this.toAdvancePayload(advance));
    }
    const existingMap = new Map(existing.map((advance) => [advance.soaId, advance]));
    const keptIds = new Set<string>();
    const now = new Date();
    for (const inputAdvance of inputAdvances) {
      if (inputAdvance.soaId) {
        if (!existingMap.has(inputAdvance.soaId)) {
          throwSalesNotFound<SaleOrderErrorDetail, SaleOrderErrorResponse>(
            'Order advance allocation not found',
            'soaId',
            `No active advance allocation found with id ${inputAdvance.soaId} on this order`,
          );
        }
        keptIds.add(inputAdvance.soaId);
      }
    }
    // Retire the rows the payload dropped before writing the replacements.
    for (const removed of existing.filter((advance) => !keptIds.has(advance.soaId))) {
      const deleted = await tx.saleOrderAdvanceAlloc.update({
        where: {
          soaId_soaAccYear: { soaId: removed.soaId, soaAccYear: removed.soaAccYear },
        },
        data: {
          soaIsDeleted: true,
          soaModifiedOn: now,
          soaModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SALE_ORDER_ADVANCE_TABLE_NAME,
          screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: deleted.soaId,
          displayName: `${removed.soaAllocType} ${removed.soaAmount}`,
          originalRecord: this.toAdvancePayload(removed),
          modifiedRecord: this.toAdvancePayload(deleted),
          userId: actorId,
          notes: 'Order advance allocation soft deleted',
        },
        tx,
      );
    }
    const persisted: SaleOrderAdvancePayload[] = [];
    for (const inputAdvance of inputAdvances) {
      // The allocation always belongs to the parent order: a payload naming a
      // different order (or year) is refused, the mirror of the charge module's
      // document-immutability rule.
      this.ensureAdvanceTargetsThisOrder(inputAdvance, scope);
      if (inputAdvance.soaId) {
        const existingAdvance = existingMap.get(inputAdvance.soaId)!;
        this.ensureAdvanceValuesAreAllowed(inputAdvance, existingAdvance, scope);
        const updateData: Prisma.SaleOrderAdvanceAllocUncheckedUpdateInput = {
          soaModifiedOn: now,
          soaModifiedBy: resolveActor(inputAdvance.soaModifiedBy, actorId),
        };
        if (inputAdvance.soaAllocType !== undefined) {
          updateData.soaAllocType = inputAdvance.soaAllocType;
        }
        if (inputAdvance.soaAllocDate !== undefined) {
          updateData.soaAllocDate = toDateOrNull(inputAdvance.soaAllocDate, 'soaAllocDate')!;
        }
        if (inputAdvance.soaAmount !== undefined) {
          updateData.soaAmount = inputAdvance.soaAmount;
        }
        applyPresentFields(updateData, inputAdvance, SALE_ORDER_ADVANCE_OPTIONAL_FIELDS);
        const updated = await tx.saleOrderAdvanceAlloc.update({
          where: {
            soaId_soaAccYear: {
              soaId: inputAdvance.soaId,
              soaAccYear: existingAdvance.soaAccYear,
            },
          },
          data: updateData,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SALE_ORDER_ADVANCE_TABLE_NAME,
            screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.soaId,
            displayName: `${updated.soaAllocType} ${updated.soaAmount}`,
            originalRecord: this.toAdvancePayload(existingAdvance),
            modifiedRecord: this.toAdvancePayload(updated),
            userId: resolveActor(inputAdvance.soaModifiedBy, actorId),
            notes: 'Order advance allocation updated',
          },
          tx,
        );
        persisted.push(this.toAdvancePayload(updated));
        continue;
      }
      this.ensureAdvanceValuesAreAllowed(inputAdvance, undefined, scope);
      const createData: Prisma.SaleOrderAdvanceAllocUncheckedCreateInput = {
        soaCompanyId: inputAdvance.soaCompanyId ?? scope.soCompanyId,
        soaBranchId: inputAdvance.soaBranchId ?? scope.soBranchId,
        soaTenantId: inputAdvance.soaTenantId ?? scope.soTenantId,
        // The year of the APPLICATION — usually the order's own, but an advance
        // taken in March is routinely adjusted in April, so the payload may say
        // otherwise. Immutable after create, like every other partition key.
        soaAccYear: inputAdvance.soaAccYear ?? scope.soAccYear,
        soaOrderId: scope.soId,
        soaOrderAccYear: scope.soAccYear,
        soaAllocType: this.requireItemField(inputAdvance.soaAllocType, 'soaAllocType'),
        soaAllocDate: toDateOrNull(
          this.requireItemField(inputAdvance.soaAllocDate, 'soaAllocDate'),
          'soaAllocDate',
        )!,
        soaAmount: inputAdvance.soaAmount ?? 0,
        soaCreatedOn: now,
        soaCreatedBy: resolveActor(inputAdvance.soaCreatedBy, actorId),
      };
      applyPresentFields(createData, inputAdvance, SALE_ORDER_ADVANCE_OPTIONAL_FIELDS);
      const created = await tx.saleOrderAdvanceAlloc.create({ data: createData });
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: SALE_ORDER_ADVANCE_TABLE_NAME,
          screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: created.soaId,
          displayName: `${created.soaAllocType} ${created.soaAmount}`,
          originalRecord: null,
          modifiedRecord: this.toAdvancePayload(created),
          userId: created.soaCreatedBy,
          notes: 'Order advance allocation created',
        },
        tx,
      );
      persisted.push(this.toAdvancePayload(created));
    }
    return persisted;
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
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid order value', details);
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
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid order value', details);
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
  // ck_soi_line_status / ck_soi_qty_signs / ck_soi_reserved / ck_soi_size,
  // migration 20260808132323), judged on the FINAL resolved values. The
  // quantity balance (ck_soi_qty_balance) is handled separately by
  // applyDerivedItemQuantities, which derives the pending quantity when the
  // payload does not carry it.
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
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid order item value', details);
    }
  }
  // ck_soi_qty_balance: every ordered unit is delivered, cancelled or still
  // pending. When the payload carries soiPendingQty the equation is judged and
  // a mismatch is a 400; when it does not, the pending quantity is DERIVED as
  // ordered − delivered − cancelled — a new line starts fully pending without
  // the client having to restate the obvious, and an edit that moves the
  // ordered quantity keeps the caches consistent.
  private applyDerivedItemQuantities(
    data: Prisma.SaleOrderItemUncheckedCreateInput | Prisma.SaleOrderItemUncheckedUpdateInput,
    inputItem: SaveSaleOrderItemDto,
    existingItem: SaleOrderItem | undefined,
  ): void {
    const orderQty = asNumber(merged(inputItem.soiOrderQty, existingItem?.soiOrderQty));
    const deliveredQty = asNumber(merged(inputItem.soiDeliveredQty, existingItem?.soiDeliveredQty));
    const cancelledQty = asNumber(merged(inputItem.soiCancelledQty, existingItem?.soiCancelledQty));
    const expectedPending = orderQty - deliveredQty - cancelledQty;
    if (inputItem.soiPendingQty !== undefined) {
      const pendingQty = asNumber(inputItem.soiPendingQty);
      if (Math.abs(orderQty - (deliveredQty + cancelledQty + pendingQty)) > QTY_EPSILON) {
        throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid order item value', [
          {
            field: 'soiPendingQty',
            message:
              'soiOrderQty must equal soiDeliveredQty + soiCancelledQty + soiPendingQty ' +
              '(ck_soi_qty_balance); omit soiPendingQty to have it derived',
          },
        ]);
      }
      return;
    }
    if (expectedPending < -QTY_EPSILON) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid order item value', [
        {
          field: 'soiOrderQty',
          message:
            'soiDeliveredQty + soiCancelledQty must not exceed soiOrderQty (ck_soi_qty_balance)',
        },
      ]);
    }
    // Rounded to the milli-unit exactly as the numeric(15,3) column stores it.
    const derived = Math.round(expectedPending * 1000) / 1000;
    // Only written when it differs from what the row would otherwise hold, so
    // an update that touches no quantity writes no quantity.
    const currentPending = existingItem ? asNumber(existingItem.soiPendingQty) : 0;
    if (!existingItem || Math.abs(currentPending - derived) > QTY_EPSILON) {
      data.soiPendingQty = derived;
    }
  }
  // The allocation always belongs to the parent order — a payload naming a
  // different order or year is refused rather than silently rewritten, the
  // mirror of the charge module's document-immutability rule.
  private ensureAdvanceTargetsThisOrder(inputAdvance: SaveSaleOrderAdvanceDto, scope: SaleOrderScope): void {
    const details: SaleOrderErrorDetail[] = [];
    if (inputAdvance.soaOrderId !== undefined && inputAdvance.soaOrderId !== scope.soId) {
      details.push({
        field: 'soaOrderId',
        message: 'soaOrderId must be omitted or match the order being saved',
      });
    }
    if (
      inputAdvance.soaOrderAccYear !== undefined &&
      inputAdvance.soaOrderAccYear !== scope.soAccYear
    ) {
      details.push({
        field: 'soaOrderAccYear',
        message: 'soaOrderAccYear must be omitted or match the order being saved',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid order advance value', details);
    }
  }
  // Mirrors the DB CHECK constraints on sale_order_advance_alloc
  // (ck_soa_alloc_type / ck_soa_refund_mode / ck_soa_amount / ck_soa_target /
  // ck_soa_no_self_transfer / ck_soa_tender_pair), judged on the FINAL resolved
  // values — a row cannot be replayed into the ledger unambiguously unless each
  // allocation type names its target, and only its own target.
  private ensureAdvanceValuesAreAllowed(
    inputAdvance: SaveSaleOrderAdvanceDto,
    existingAdvance: SaleOrderAdvanceAlloc | undefined,
    scope: SaleOrderScope,
  ): void {
    const details: SaleOrderErrorDetail[] = [];
    const allocType = merged(inputAdvance.soaAllocType, existingAdvance?.soaAllocType);
    if (
      !allocType ||
      !(SALE_ORDER_ADVANCE_ALLOC_TYPES as readonly string[]).includes(allocType)
    ) {
      details.push({
        field: 'soaAllocType',
        message: `soaAllocType must be one of: ${SALE_ORDER_ADVANCE_ALLOC_TYPES.join(', ')}`,
      });
    }
    const refundMode = merged(inputAdvance.soaRefundMode, existingAdvance?.soaRefundMode);
    if (
      refundMode !== null &&
      refundMode !== undefined &&
      !(SALE_ORDER_ADVANCE_REFUND_MODES as readonly string[]).includes(refundMode)
    ) {
      details.push({
        field: 'soaRefundMode',
        message: `soaRefundMode must be one of: ${SALE_ORDER_ADVANCE_REFUND_MODES.join(', ')}`,
      });
    }
    const amount = asNumber(merged(inputAdvance.soaAmount, existingAdvance?.soaAmount));
    if (amount <= 0) {
      details.push({
        field: 'soaAmount',
        message: 'soaAmount must be greater than 0 (ck_soa_amount)',
      });
    }
    const billId = merged(inputAdvance.soaBillId, existingAdvance?.soaBillId);
    const billAccYear = merged(inputAdvance.soaBillAccYear, existingAdvance?.soaBillAccYear);
    const targetOrderId = merged(
      inputAdvance.soaTargetOrderId,
      existingAdvance?.soaTargetOrderId,
    );
    const targetAccYear = merged(
      inputAdvance.soaTargetAccYear,
      existingAdvance?.soaTargetAccYear,
    );
    // Each allocation type must name its target, and only its own target
    // (ck_soa_target).
    if (allocType === 'ADJUSTED') {
      if (!billId || !billAccYear) {
        details.push({
          field: 'soaBillId',
          message: 'An ADJUSTED allocation must name soaBillId and soaBillAccYear',
        });
      }
      if (targetOrderId) {
        details.push({
          field: 'soaTargetOrderId',
          message: 'An ADJUSTED allocation must not name a target order',
        });
      }
    } else if (allocType === 'TRANSFERRED') {
      if (!targetOrderId || !targetAccYear) {
        details.push({
          field: 'soaTargetOrderId',
          message: 'A TRANSFERRED allocation must name soaTargetOrderId and soaTargetAccYear',
        });
      }
      if (billId) {
        details.push({
          field: 'soaBillId',
          message: 'A TRANSFERRED allocation must not name a bill',
        });
      }
    } else if (allocType === 'REFUNDED' || allocType === 'FORFEITED') {
      if (billId || targetOrderId) {
        details.push({
          field: allocType === 'REFUNDED' ? 'soaRefundTenderId' : 'soaAllocType',
          message: `A ${allocType} allocation must not name a bill or a target order`,
        });
      }
    }
    // ck_soa_no_self_transfer: money cannot be moved onto the order it came
    // from.
    if (targetOrderId && targetOrderId === scope.soId) {
      details.push({
        field: 'soaTargetOrderId',
        message: 'soaTargetOrderId must not be the order the advance was taken against',
      });
    }
    // ck_soa_tender_pair: the tender reference travels as a pair or not at all.
    const tenderId = merged(inputAdvance.soaTenderId, existingAdvance?.soaTenderId);
    const tenderAccYear = merged(
      inputAdvance.soaTenderAccYear,
      existingAdvance?.soaTenderAccYear,
    );
    if ((tenderId === null) !== (tenderAccYear === null)) {
      details.push({
        field: 'soaTenderId',
        message: 'soaTenderId and soaTenderAccYear must be sent together (ck_soa_tender_pair)',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<SaleOrderErrorDetail, SaleOrderErrorResponse>('Invalid order advance value', details);
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
    advances: readonly SaleOrderAdvancePayload[],
  ): Promise<SaleOrderNameMaps> {
    const items = record.items ?? [];
    const companyIds = distinctIds([
      record.soCompanyId,
      ...items.map((item) => item.soiCompanyId),
      ...charges.map((charge) => charge.cdCompId),
      ...tenders.map((tender) => tender.tdCompanyId),
      ...advances.map((advance) => advance.soaCompanyId),
    ]);
    const branchIds = distinctIds([
      record.soBranchId,
      ...items.map((item) => item.soiBranchId),
      ...charges.map((charge) => charge.cdBranchId),
      ...advances.map((advance) => advance.soaBranchId),
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
      // passes them through. The advances are this module's own payload.
      charges?: SaleOrderChargePayload[];
      tenders?: SaleOrderTenderPayload[];
      advances?: SaleOrderAdvancePayload[];
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
      advances,
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
      advances: (advances ?? []).map((advance) => this.withAdvanceNames(advance, names)),
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
  private toAdvancePayload(record: SaleOrderAdvanceAlloc): SaleOrderAdvancePayload {
    const { soaCreatedOn, soaModifiedOn, soaSyncDate, ...rest } = record;
    return {
      ...rest,
      soaCreatedOn: soaCreatedOn?.toISOString(),
      soaModifiedOn: soaModifiedOn?.toISOString() ?? null,
      soaSyncDate: soaSyncDate?.toISOString() ?? null,
    };
  }
  // The charge / tender / advance rows are already shaped by the time they get
  // here — by their owning module for the first two, by toAdvancePayload for the
  // third — so the names are layered on rather than built in.
  private withAdvanceNames(
    payload: SaleOrderAdvancePayload,
    names: SaleOrderNameMaps,
  ): SaleOrderAdvancePayload {
    return {
      ...payload,
      soaCompanyName: names.companyNameById.get(payload.soaCompanyId) ?? null,
      soaBranchName: names.branchNameById.get(payload.soaBranchId) ?? null,
    };
  }
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
