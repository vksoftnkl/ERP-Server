import { Injectable } from '@nestjs/common';
import { Prisma, SaleBill, SaleBillItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBillDto } from './dto/save-bill.dto';
import { SaveBillItemDto } from './dto/save-bill-item.dto';
import { DeleteBillDto } from './dto/bill-lifecycle.dto';
import {
  BILL_CHARGE_AUDIT,
  BILL_CHARGE_DOC_TYPE,
  // The cancelled status, as the status trail names it. A bill only reaches it
  // through a save that sets sbStatus — POST /bills/delete no longer puts it
  // there, because that route cancels the ORDER behind the bill and leaves the
  // bill itself alone.
  BILL_STATUS_CANCELLED,
  BILL_STATUS_DRAFT,
  BILL_STATUS_POSTED,
  BILL_STATUS_SRC_DOC_TYPE,
  BILL_STATUS_SRC_MODULE,
  BILL_TENDER_AUDIT,
  BILL_TENDER_DR_CR,
  BILL_TENDER_SRC_DOC_TYPE,
  BILL_TENDER_SRC_MODULE,
  BillChargePayload,
  BillErrorDetail,
  BillErrorResponse,
  BillItemPayload,
  BillPayload,
  BillTenderPayload,
} from './types/bill-api.types';
import { SaleOrderService } from '../sale-order/sale-order.service';
import {
  SALE_ORDER_SRC_DOC_TYPE,
  SaleOrderLineRef,
  SaleOrderSrcDocFields,
} from '../sale-order/types/sale-order-api.types';
import { QuotationService } from '../quotation/quotation.service';
import {
  QUOTATION_SRC_DOC_TYPE,
  QuotationConversionRef,
} from '../quotation/types/quotation-api.types';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { ChargeDocumentScope } from '../../master/charge-detail/types/charge-detail-api.types';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDocumentScope } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { SaveTenderDetailDto } from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import {
  PresentFieldTransform,
  SalesWriteClient,
  applyPresentFields,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
// deleteBillPosting is deliberately NOT imported any more: POST /bills/delete
// stopped deleting the bill, so nothing in this module takes a bill back out of
// the books. The helper is left in place — it is the only implementation of
// that unwind, and whatever replaces the delete route will want it.
import { SaveBillAdjustmentDto } from './dto/save-bill-adjustment.dto';
import { SalesContextService } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { TransportBandService, type TransportBandInput } from '../posting/transport-band.service';
import { throwSalesLocked } from '../posting/sales.errors';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { num } from '../posting/sales-doc.utils';
import { BillReadService } from './bill-read.service';
import { encodeTempCreditTenders } from './bill-temp-credit';
import {
  TxnStatusEvent,
  appendTxnStatusLog,
} from 'src/common/txn-status-log/txn-status-log.helper';
// accounts.acc_voucher_types row "Bil" / Sales Bill. Its numbering format
// (prefix / suffix / width / reset frequency) seeds the acc_voucher_seq row the
// bill numbers are drawn from.
const BILL_VCHR_TYPE_ID = 3;
const BILL_TABLE_NAME = 'sale_bill';
const BILL_ITEM_TABLE_NAME = 'sale_bill_item';
const BILL_AUDIT_SCREEN_NAME = 'Sale Bill';
// Allowed-value sets for the header/line-item columns that used to be DB CHECK
// constraints (ck_sb_doc_type / ck_sb_bill_type / ck_sb_status /
// ck_sb_pay_status / ck_sb_return_status / ck_sbi_free_type — migration
// 20260731070026). The DB no longer enforces them; ensureBillValuesAreAllowed
// / ensureBillItemValuesAreAllowed below are now the only definition of what
// is allowed, so a bad value comes back as a 400 naming the field instead of a
// raw Postgres 23514.
const BILL_DOC_TYPES = ['TAX_INVOICE', 'BILL_OF_SUPPLY'] as const;
const BILL_TYPES = ['CASH', 'CREDIT'] as const;
const BILL_PAY_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'] as const;
const BILL_RETURN_STATUSES = ['PARTIAL', 'FULL'] as const;
const BILL_ITEM_FREE_TYPES = ['SCHEME', 'SAMPLE', 'REPLACEMENT'] as const;
// How this module names the source-doc columns a line carries, handed to the
// sale-order module so a rejection it raises (an unknown order line, an order
// that is not there) comes back naming the field the client actually sent
// instead of a token from that module's own vocabulary.
const BILL_ITEM_SRC_DOC_FIELDS: SaleOrderSrcDocFields = {
  docId: 'sbiSrcDocId',
  accYear: 'sbiSrcDocYear',
  lineNo: 'sbiSrcDocLineNo',
};
// ... and the same for the HEADER's own reference. sale_bill says which order
// the bill was raised against; it has no line-number column, because a header
// names the document and nothing finer.
const BILL_SRC_DOC_FIELDS: SaleOrderSrcDocFields = {
  docId: 'sbSrcDocId',
  accYear: 'sbSrcDocYear',
};
const BILL_VALUE_GUARDS = [
  { field: 'sbDocType', allowed: BILL_DOC_TYPES, nullable: false },
  { field: 'sbBillType', allowed: BILL_TYPES, nullable: false },
  { field: 'sbPayStatus', allowed: BILL_PAY_STATUSES, nullable: false },
  { field: 'sbReturnStatus', allowed: BILL_RETURN_STATUSES, nullable: true },
] as const satisfies ReadonlyArray<{
  field: string;
  allowed: readonly string[];
  nullable: boolean;
}>;
type BillGuardedField = (typeof BILL_VALUE_GUARDS)[number]['field'];
type BillGuardedValues = Partial<Record<BillGuardedField, string | null | undefined>>;
// Header fields copied straight through when present on the payload. The
// partition/scope keys (sbCompanyId, sbBranchId, sbAccYear, sbPriceLevel,
// sbUserId) and the server-assigned number (sbBillSlno / sbBillRefno) are
// intentionally excluded — see the README's "Bill numbering" section.
const BILL_OPTIONAL_FIELDS = [
  'sbSessionId',
  'sbCounterId',
  'sbDeviceType',
  'sbDeviceId',
  'sbDocType',
  'sbBillType',
  'sbCategoryId',
  'sbUsrRefno',
  'sbBillDate',
  'sbBillDatetime',
  'sbDueDays',
  'sbDueDate',
  'sbSrcDocType',
  'sbSrcDocId',
  'sbSrcDocRefno',
  'sbSrcDocDate',
  'sbSrcDocYear',
  'sbCustId',
  'sbCustName',
  'sbCustAddr',
  'sbCustPlace',
  'sbCustPin',
  'sbCustPhone',
  'sbCustGstin',
  'sbCustGstType',
  'sbCustStcd',
  'sbPosStcd',
  'sbStateName',
  'sbHasLoad',
  'sbHasUnload',
  'sbHasFreight',
  'sbHasPromo',
  'sbHasComm',
  'sbHasLoyalty',
  'sbSalesmanId',
  'sbAgentId',
  'sbAgentCommPerc',
  'sbAgentCommAmt',
  'sbDriverId',
  'sbLoadmanId',
  'sbPackedId',
  'sbSupervisorId',
  'sbVehicleId',
  'sbVehicleNo',
  'sbTotItems',
  'sbTotWeight',
  'sbTotBags',
  'sbGrossAmt',
  'sbItemDisc',
  'sbSplDisc',
  'sbSchDisc',
  'sbBillSchDisc',
  'sbAddlDisc1',
  'sbAddlDisc2',
  'sbCashDisc',
  'sbTaxableAmt',
  'sbCgstAmt',
  'sbSgstAmt',
  'sbIgstAmt',
  'sbCessAmt',
  'sbTaxAmt',
  'sbFreightAmt',
  'sbLoadAmt',
  'sbUnloadAmt',
  'sbOtherAmt1',
  'sbOtherAmt2',
  'sbRoundOff',
  'sbBillAmt',
  'sbTotalCost',
  'sbMarginAmt',
  'sbMarginAmtWot',
  'sbMarginPerc',
  'sbMrpSavings',
  'sbMrpSavingsPerc',
  'sbPayMode',
  'sbCreditAmt',
  'sbSurchargeAmt',
  'sbTenderAmt',
  'sbRefundAmt',
  'sbAdvanceAmt',
  'sbPaidAmt',
  'sbBalanceAmt',
  'sbPayStatus',
  'sbReturnedAmt',
  'sbReturnStatus',
  'sbPaymentTerms',
  'sbDeliveryTerms',
  'sbTermsConditions',
  'sbRemarks',
  'sbFreightCalcType',
  'sbLoadingCalcType',
  'sbDiscAlterBase',
  'sbRoundOffStep',
  'sbBillMode',
  'sbUsrRefdate',
  'sbCustPan',
  'sbForm60Ref',
  'sbLoyaltyMemberId',
  'sbTcsPerc',
  'sbTcsAmt',
  'sbHasDc',
  'sbApprovedOn',
  'sbApprovedBy',
  // sbPostedOn / sbCancelledOn / sbCancelledBy / sbCancelReason were dropped
  // by 20260921220000: WHEN, WHO and WHY a status changed live on
  // public.txn_status_log, one appended row per step.
  'sbVersionNo',
  'sbPrintCount',
];
// Line-item fields copied straight through when present on the payload. The
// scope keys (bill/company/branch/tenant/accYear/lineNo/priceLevel), the three
// fields required for a new line (sbiItemId, sbiItemUnitId, sbiGodownId) and
// the nullable sbiStockId are set explicitly, so they are excluded here.
const BILL_ITEM_OPTIONAL_FIELDS = [
  'sbiSrcItemId',
  'sbiBucket',
  'sbiLotId',
  'sbiPromoUsageId',
  'sbiSrcDocType',
  'sbiSrcDocId',
  'sbiSrcDocYear',
  'sbiSrcDocRefno',
  'sbiSrcDocLineNo',
  'sbiSrcItemQty',
  'sbiSrcFreeQty',
  'sbiToBaseFactor',
  'sbiHsnCode',
  'sbiEanCode',
  'sbiSize',
  'sbiSizeUom',
  'sbiBatchNo',
  'sbiBatchDate',
  'sbiExpiryDate',
  'sbiSerialNo',
  'sbiIsTaxIncl',
  'sbiIsPromo',
  'sbiIsFree',
  'sbiFreeType',
  'sbiIsService',
  'sbiHasFreight',
  'sbiCaseQty',
  'sbiBillQty',
  'sbiLengthQty',
  'sbiNetQty',
  'sbiWeightQty',
  'sbiAvailableStock',
  'sbiReturnQty',
  'sbiRate',
  'sbiRatePreTax',
  'sbiRateDiff',
  'sbiActPrice',
  'sbiMaxPrice',
  'sbiMinPrice',
  'sbiCostPrice',
  'sbiCostPreTax',
  'sbiItemDiscPerc',
  'sbiItemDiscQty',
  'sbiItemDiscAmt',
  'sbiSplDiscPerc',
  'sbiSplDiscQty',
  'sbiSplDiscAmt',
  'sbiSchDiscPerc',
  'sbiSchDiscQty',
  'sbiSchDiscAmt',
  'sbiBillSchPerc',
  'sbiBillSchQty',
  'sbiBillSchAmt',
  'sbiAddlDisc1Perc',
  'sbiAddlDisc1Amt',
  'sbiAddlDisc2Perc',
  'sbiAddlDisc2Amt',
  'sbiCashDiscPerc',
  'sbiCashDiscAmt',
  'sbiGrossAmt',
  'sbiNetGross',
  'sbiChrgBeforeTax',
  'sbiChrgAfterTax',
  'sbiTaxableAmt',
  'sbiTaxPerc',
  'sbiTaxAmt',
  'sbiCgstPerc',
  'sbiCgstAmt',
  'sbiSgstPerc',
  'sbiSgstAmt',
  'sbiIgstPerc',
  'sbiIgstAmt',
  'sbiCessPerc',
  'sbiCessPerUnit',
  'sbiCessAmt',
  'sbiAcessPerc',
  'sbiAcessPerUnit',
  'sbiAcessAmt',
  'sbiBatchConfig',
  'sbiFreightQty',
  'sbiFreightAmt',
  'sbiLoadQty',
  'sbiLoadAmt',
  'sbiUnloadQty',
  'sbiUnloadAmt',
  'sbiRoundOff',
  'sbiNetAmt',
  'sbiSoldPrice',
  'sbiSoldPreTax',
  'sbiItemProfit',
  'sbiProfitPreTax',
  'sbiMrpSavings',
  'sbiMrpSavingsPerc',
  'sbiSalesmanId',
  'sbiSchemeId',
  'sbiSchemeName',
  'sbiRemarks',
];
// Every date / timestamptz column reachable from the payload. JSON carries them
// as ISO strings, Prisma wants Date objects, so each one is converted on the way
// in (and a malformed value comes back as a 400 naming the field).
const BILL_DATE_FIELDS = [
  'sbUsrRefdate',
  'sbBillDate',
  'sbBillDatetime',
  'sbDueDate',
  'sbSrcDocDate',
  'sbApprovedOn',
];
const BILL_ITEM_DATE_FIELDS = ['sbiBatchDate', 'sbiExpiryDate'];
function toDateOrNull(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const dateValue = new Date(value as string);
  if (Number.isNaN(dateValue.getTime())) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Validation failed', [
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
const BILL_DATE_TRANSFORMS = buildDateTransforms(BILL_DATE_FIELDS);
const BILL_ITEM_DATE_TRANSFORMS = buildDateTransforms(BILL_ITEM_DATE_FIELDS);
// The immutable scope inherited by every line from its parent bill. The last
// five are only read by the tender lines, which snapshot the document's date,
// party and capture context (acc_tender_detail has no FK back to sale_bill to
// join them from).
interface BillScope {
  sbId: string;
  sbCompanyId: string;
  sbBranchId: string;
  sbTenantId: string | null;
  sbAccYear: string;
  sbPriceLevel: number;
  // Nullable since sb_bill_slno became nullable: a counter operating without a
  // number series yet saves the draft unnumbered.
  sbBillSlno: bigint | null;
  sbBillDate: Date;
  // Nullable since sb_cust_id became nullable: a walk-in bill carries only the
  // snapshotted sb_cust_name. Everything in accounts still needs a party — see
  // requireCustomerLedgerId.
  sbCustId: string | null;
  sbUserId: string;
  sbSessionId: string | null;
  sbDeviceId: string;
}
type BillWriteClient = SalesWriteClient;
// Only populated when the item was fetched with the item/unit joins (getById);
// create/update paths pass plain SaleBillItem rows where these are absent.
type SaleBillItemWithNames = SaleBillItem & {
  item?: {
    itemNameEn: string;
    itemGroupId: string;
    itemBrandId: string | null;
    itemSectionId: string | null;
    itemCategoryId: string | null;
    itemIsService: boolean;
    itemAllowNegStock: boolean;
  } | null;
  itemUnitConversion?: { unit: { unit_name: string; unit_decimal_count: number } } | null;
};
// One godown a line points at. gdl_negative_stock is the godown's half of the
// line's effective sbiAllowNegativeStock — see toItemPayload.
type LineGodown = { gdlName: string; gdlNegativeStock: boolean };
// What a line's read-only display fields need beyond the line row itself: the
// godowns the bill's lines point at and the company's negative-stock switch,
// both resolved once per GET. The create/update paths pass nothing and those
// fields come back null.
type BillLineContext = {
  godownById: Map<string, LineGodown>;
  companyAllowsNegStock: boolean | null;
};
const EMPTY_LINE_CONTEXT: BillLineContext = {
  godownById: new Map(),
  companyAllowsNegStock: null,
};
@Injectable()
export class BillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    // txn_charge_detail is owned by the charge-detail module: the bill hands it
    // the charges[] array and its own scope rather than writing that table
    // itself, so both entry points share one set of guards and one audit trail.
    private readonly chargeDetailService: ChargeDetailService,
    // Same arrangement for acc_tender_detail and the tenders[] array — the money
    // the customer actually handed over, captured while the bill is still a
    // draft and carried through to posting.
    private readonly tenderDetailService: TenderDetailService,
    // sale_order_item's fulfilment caches are the sale-order module's to write,
    // so a bill raised against an order hands it the lines it touched rather
    // than updating that table itself. The dependency only points this way —
    // nothing in the sale-order module reaches back into this one.
    private readonly saleOrderService: SaleOrderService,
    // Same arrangement for sale_quotation's conversion columns: a bill raised
    // from a quotation hands the reference over rather than writing that table
    // itself, and the quotation module never reaches back into this one.
    private readonly quotationService: QuotationService,
    // The transport band (public.txn_transport_detail) is written by the
    // posting layer's service so the bill, the challan and both returns keep
    // one writer and one lock-2 check.
    private readonly transportBand: TransportBandService,
    private readonly salesContext: SalesContextService,
    private readonly docBlocks: SalesDocBlocksService,
    private readonly billRead: BillReadService,
  ) {}
  /**
   * `POST /bills/create` — the DRAFT (HANDOVER §2.1).
   *
   * `sbStatus` in the body is IGNORED: a saved bill is a DRAFT, and only
   * `/bills/post` moves it. A POSTED id is refused with 409 SALES_BILL_POSTED
   * ("use /bills/amend"). The response is the `/get` shape.
   */
  async save(saveBillDto: SaveBillDto): Promise<BillPayload> {
    this.ensureBillValuesAreAllowed(saveBillDto);
    stripServerOwned(saveBillDto);
    const saved = saveBillDto.sbId
      ? await this.updateBill(saveBillDto)
      : await this.createBill(saveBillDto);
    return this.getById(saved.sbId, saved.sbCompanyId, saved.sbBranchId, saved.sbAccYear);
  }
  async getById(
    sbId: string,
    sbCompanyId: string,
    sbBranchId: string,
    sbAccYear: string,
  ): Promise<BillPayload> {
    const record = await this.prisma.saleBill.findFirst({
      where: {
        sbId,
        sbCompanyId,
        sbBranchId,
        sbAccYear,
        sbIsDeleted: false,
      },
      include: {
        items: {
          where: { sbiIsDeleted: false },
          orderBy: { sbiLineNo: 'asc' },
          include: {
            item: {
              select: {
                itemNameEn: true,
                itemGroupId: true,
                itemBrandId: true,
                itemSectionId: true,
                itemCategoryId: true,
                // Two of the three switches behind the line's effective
                // sbiAllowNegativeStock; see toItemPayload.
                itemIsService: true,
                itemAllowNegStock: true,
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
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        'Bill not found',
        'sbId',
        `No active bill found with id ${sbId}`,
      );
    }
    // txn_charge_detail is polymorphic (no FK to sale_bill), so the applied
    // charges are fetched by discriminator rather than by `include` — through
    // the charge-detail module, which also resolves each line's ledger name.
    const charges = await this.chargeDetailService.getByDocument(BILL_CHARGE_DOC_TYPE, sbId);
    // acc_tender_detail is polymorphic for the same reason, and read the same
    // way — through its own module, which resolves each line's tender and
    // ledger names.
    const tenders = await this.tenderDetailService.getByDocument(
      BILL_TENDER_SRC_MODULE,
      BILL_TENDER_SRC_DOC_TYPE,
      sbId,
    );
    // sbi_godown_id has no FK to inventory.godown_locations either, so the
    // godown name cannot ride along on the `include` the way sbiItemName does —
    // it is resolved in one batched lookup over the bill's distinct godowns.
    const [godownById, companyAllowsNegStock] = await Promise.all([
      this.resolveGodowns(record.items),
      this.resolveCompanyNegStock(record.sbCompanyId),
    ]);
    const payload = this.toPayload(
      { ...record, charges, tenders },
      { godownById, companyAllowsNegStock },
    );
    return this.billRead.decorate(record, payload);
  }

  /** The row itself, locked for the caller's transaction, or a 404. */
  async lockHeader(
    tx: Prisma.TransactionClient,
    keys: { sbId: string; sbCompanyId: string; sbBranchId: string; sbAccYear: string },
  ): Promise<SaleBill> {
    const rows = await tx.$queryRaw<{ sb_id: string }[]>`
      SELECT sb_id FROM sales.sale_bill
       WHERE sb_id = ${keys.sbId}::uuid AND sb_acc_year = ${keys.sbAccYear}::char(9)
         AND sb_company_id = ${keys.sbCompanyId}::uuid AND sb_branch_id = ${keys.sbBranchId}::uuid
         AND sb_is_deleted = false
       FOR UPDATE`;
    if (rows.length === 0) {
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        'Bill not found',
        'sbId',
        `No active bill found with id ${keys.sbId}`,
      );
    }
    const record = await tx.saleBill.findFirst({
      where: { sbId: keys.sbId, sbAccYear: keys.sbAccYear, sbIsDeleted: false },
    });
    return record!;
  }

  /** The bill's live lines, charges and tenders — what every verb reads. */
  async loadParts(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
  ): Promise<{
    items: SaleBillItem[];
    charges: BillChargePayload[];
    tenders: BillTenderPayload[];
  }> {
    const [items, charges, tenders] = await Promise.all([
      tx.saleBillItem.findMany({
        where: { sbiBillId: bill.sbId, sbiAccYear: bill.sbAccYear, sbiIsDeleted: false },
        orderBy: [{ sbiLineNo: 'asc' }, { sbiSplitNo: 'asc' }],
      }),
      this.chargeDetailService.getByDocument(BILL_CHARGE_DOC_TYPE, bill.sbId),
      this.tenderDetailService.getByDocument(
        BILL_TENDER_SRC_MODULE,
        BILL_TENDER_SRC_DOC_TYPE,
        bill.sbId,
      ),
    ]);
    return { items, charges, tenders };
  }
  /**
   * `POST /bills/delete` — DRAFT only (HANDOVER §2.6).
   *
   * A POSTED bill answers 409 SALES_BILL_POSTED ("use /bills/cancel"); the
   * order-cancel side effect this route used to carry lives on
   * `/sale-orders/cancel` now. Soft-deletes the header, its lines, its charges,
   * its tenders and its transport band, in one transaction.
   */
  async deleteDraft(dto: DeleteBillDto): Promise<{ sbId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.lockHeader(tx, dto);
      if (existing.sbStatus === BILL_STATUS_POSTED) {
        throwSalesLocked(
          'This bill is POSTED — use /bills/cancel',
          SALES_ERROR_CODES.BILL_POSTED,
          'sbId',
        );
      }
      if (existing.sbStatus === BILL_STATUS_CANCELLED) {
        throwSalesLocked(
          'This bill is CANCELLED and stays on record',
          SALES_ERROR_CODES.BILL_CANCELLED,
          'sbId',
        );
      }
      const items = await tx.saleBillItem.findMany({
        where: { sbiBillId: existing.sbId, sbiAccYear: existing.sbAccYear, sbiIsDeleted: false },
      });
      await this.softDeleteItems(tx, items, actor, now);
      const scope = this.toScope(existing);
      await this.chargeDetailService.syncDocumentCharges(
        tx,
        this.toChargeScope(scope),
        [],
        actor,
        BILL_CHARGE_AUDIT,
      );
      await this.tenderDetailService.syncDocumentTenders(
        tx,
        this.toTenderScope(scope, []),
        [],
        actor,
        BILL_TENDER_AUDIT,
      );
      await this.transportBand.remove(
        tx,
        { docType: 'SALE_BILL', docId: existing.sbId, accYear: existing.sbAccYear },
        actor,
      );
      await tx.saleBill.update({
        where: { sbId_sbAccYear: { sbId: existing.sbId, sbAccYear: existing.sbAccYear } },
        data: { sbIsDeleted: true, sbModifiedOn: now, sbModifiedBy: actor },
      });
      // A draft that referenced order lines hands their quantity back — only
      // POSTED bills count, so this is a no-op unless something was wrong.
      await this.saleOrderService.syncOrderFulfilment(
        tx,
        { refs: [...this.toOrderHeaderRefs(existing), ...this.toOrderLineRefs(items)] },
        actor,
        now,
      );
      await appendTxnStatusLog(tx, {
        companyId: existing.sbCompanyId,
        branchId: existing.sbBranchId,
        tenantId: existing.sbTenantId,
        accYear: existing.sbAccYear,
        srcModule: BILL_STATUS_SRC_MODULE,
        srcDocType: BILL_STATUS_SRC_DOC_TYPE,
        srcDocId: existing.sbId,
        srcDocRefno: existing.sbBillRefno,
        event: TxnStatusEvent.DELETED,
        fromStatus: existing.sbStatus,
        toStatus: existing.sbStatus,
        changedOn: now,
        changedBy: actor,
        deviceId: existing.sbDeviceId,
        sessionId: existing.sbSessionId,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BILL_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: existing.sbId,
          displayName: existing.sbBillRefno || existing.sbId,
          originalRecord: this.toPayload(existing),
          modifiedRecord: null,
          userId: actor,
          notes: 'Draft bill deleted',
        },
        tx,
      );
      return { sbId: existing.sbId, deleted: true as const };
    });
  }
  private toScope(bill: SaleBill): BillScope {
    return {
      sbId: bill.sbId,
      sbCompanyId: bill.sbCompanyId,
      sbBranchId: bill.sbBranchId,
      sbTenantId: bill.sbTenantId,
      sbAccYear: bill.sbAccYear,
      sbPriceLevel: bill.sbPriceLevel,
      sbBillSlno: bill.sbBillSlno,
      sbBillDate: bill.sbBillDate,
      sbCustId: bill.sbCustId,
      sbUserId: bill.sbUserId,
      sbSessionId: bill.sbSessionId,
      sbDeviceId: bill.sbDeviceId,
    };
  }
  private async createBill(saveBillDto: SaveBillDto): Promise<SaleBill> {
    const normalizedCustName = normalizeRequiredText<BillErrorDetail, BillErrorResponse>(
      saveBillDto.sbCustName ?? '',
      'sbCustName',
    );
    const now = new Date();
    const createdBy = resolveActor(saveBillDto.sbCreatedBy, this.requestContextService.getUserId());
    const billDate = saveBillDto.sbBillDate ? new Date(saveBillDto.sbBillDate) : now;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensurePosStateExists(tx, saveBillDto);
        // Voucher type 3 numbers the document: the running number consumed from
        // accounts.acc_voucher_seq becomes sbBillSlno and its printable form
        // sbBillRefno. Both are server-assigned. POS bills draw on the device's
        // own series; WHOLESALE shares the branch 'MAIN' counter.
        const settings = await this.salesContext.settings(
          saveBillDto.sbCompanyId,
          saveBillDto.sbBranchId,
        );
        const posSeries =
          (saveBillDto.sbBillMode ?? 'WHOLESALE') === 'POS' && settings.posSeriesPerDevice;
        const billNumber = await allocateVoucherNumber(tx, {
          vchrTypeId: BILL_VCHR_TYPE_ID,
          companyId: saveBillDto.sbCompanyId,
          branchId: saveBillDto.sbBranchId,
          accYear: saveBillDto.sbAccYear,
          deviceCode: posSeries ? saveBillDto.sbDeviceId : null,
          documentDate: billDate,
        });
        const data: Prisma.SaleBillUncheckedCreateInput = {
          sbCompanyId: saveBillDto.sbCompanyId,
          sbBranchId: saveBillDto.sbBranchId,
          sbTenantId: saveBillDto.sbTenantId,
          sbAccYear: saveBillDto.sbAccYear,
          sbCounterId: saveBillDto.sbCounterId,
          sbDeviceType: saveBillDto.sbDeviceType,
          sbDeviceId: saveBillDto.sbDeviceId,
          sbPriceLevel: saveBillDto.sbPriceLevel,
          sbBillSlno: billNumber.lastNo,
          sbBillRefno: billNumber.refno,
          sbBillDate: billDate,
          sbCustId: saveBillDto.sbCustId,
          sbCustName: normalizedCustName,
          sbUserId: saveBillDto.sbUserId,
          sbCreatedOn: now,
          sbCreatedBy: createdBy,
          // Server-owned: a saved bill is a DRAFT until /bills/post.
          sbStatus: BILL_STATUS_DRAFT,
          sbRevisionNo: 1,
        };
        this.applyOptionalFields(data, saveBillDto);
        data.sbCustName = normalizedCustName;
        data.sbBillDate = billDate;
        await this.applyCustomerSnapshot(tx, data, saveBillDto, settings.defaultCustomerId);
        const created = await tx.saleBill.create({ data });
        const scope = this.toScope(created);
        const items = await this.syncItems(tx, scope, saveBillDto.items, createdBy);
        const charges = await this.chargeDetailService.syncDocumentCharges(
          tx,
          this.toChargeScope(scope),
          saveBillDto.charges,
          createdBy,
          BILL_CHARGE_AUDIT,
        );
        const tenders = await this.tenderDetailService.syncDocumentTenders(
          tx,
          this.toTenderScope(scope, saveBillDto.tenders),
          encodeTempCreditTenders(saveBillDto.tenders),
          createdBy,
          BILL_TENDER_AUDIT,
        );
        // A DRAFT has no receivable yet, so the set-offs are only CHECKED here
        // (the credit exists, belongs to the party, covers the amount) and their
        // total is kept in sbAdvanceAmt; /bills/post writes the rows.
        await this.validateDraftAdjustments(tx, created, saveBillDto.adjustments);
        await this.writeTransportBand(tx, created, saveBillDto, createdBy, now);
        // Draws nothing off the order yet — only a POSTED bill counts — but the
        // recompute is idempotent and keeps the refs validated.
        await this.saleOrderService.syncOrderFulfilment(
          tx,
          { refs: [...this.toOrderHeaderRefs(created), ...this.toOrderLineRefs(items)] },
          createdBy,
          now,
        );
        await this.quotationService.syncQuotationConversion(
          tx,
          { refs: this.toQuotationRefs(created) },
          createdBy,
          now,
        );
        await this.logStatusChange(tx, created, null, createdBy, now, null);
        const payload = this.toPayload({ ...created, items, charges, tenders });
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: BILL_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: payload.sbId,
            displayName: payload.sbBillRefno || payload.sbId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Bill created',
          },
          tx,
        );
        return created;
      });
    } catch (error: unknown) {
      const duplicate = this.describeDuplicate(error);
      throwOnUniqueConstraintError<BillErrorDetail, BillErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  private async updateBill(saveBillDto: SaveBillDto): Promise<SaleBill> {
    const sbId = saveBillDto.sbId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleBill.findFirst({
          where: { sbId, sbIsDeleted: false },
        });
        if (!existing) {
          throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
            'Bill not found',
            'sbId',
            `No active bill found with id ${sbId}`,
          );
        }
        // Lock 1. A POSTED bill is corrected through /bills/amend, a CANCELLED
        // one not at all.
        if (existing.sbStatus === BILL_STATUS_POSTED) {
          throwSalesLocked(
            'This bill is POSTED — use /bills/amend',
            SALES_ERROR_CODES.BILL_POSTED,
            'sbId',
          );
        }
        if (existing.sbStatus === BILL_STATUS_CANCELLED) {
          throwSalesLocked(
            'This bill is CANCELLED and cannot be edited',
            SALES_ERROR_CODES.BILL_CANCELLED,
            'sbId',
          );
        }
        const now = new Date();
        const modifiedBy = resolveActor(
          saveBillDto.sbModifiedBy,
          this.requestContextService.getUserId(),
        );
        const { updated } = await this.applySaveInTx(tx, existing, saveBillDto, modifiedBy, now);
        return updated;
      });
    } catch (error: unknown) {
      const duplicate = this.describeDuplicate(error);
      throwOnUniqueConstraintError<BillErrorDetail, BillErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  /**
   * Apply a save payload to an existing DRAFT header inside the CALLER's
   * transaction. `/bills/create` (update) and `/bills/amend` both go through
   * here, so there is one definition of what editing a bill means.
   */
  async applySaveInTx(
    tx: Prisma.TransactionClient,
    existing: SaleBill,
    saveBillDto: SaveBillDto,
    modifiedBy: string,
    now: Date,
    opts: { notes?: string } = {},
  ): Promise<{ updated: SaleBill; items: SaleBillItem[] }> {
    const settings = await this.salesContext.settings(existing.sbCompanyId, existing.sbBranchId);
    const data: Prisma.SaleBillUncheckedUpdateInput = {
      sbModifiedOn: now,
      sbModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveBillDto);
    await this.ensurePosStateExists(tx, saveBillDto);
    await this.applyCustomerSnapshot(tx, data, saveBillDto, settings.defaultCustomerId);
    const updated = await tx.saleBill.update({
      where: { sbId_sbAccYear: { sbId: existing.sbId, sbAccYear: existing.sbAccYear } },
      data,
    });
    const scope = this.toScope(updated);
    // Which order lines the bill pointed at BEFORE this save, so a line the
    // payload drops hands its quantity back.
    const priorItems = await tx.saleBillItem.findMany({
      where: { sbiBillId: existing.sbId, sbiIsDeleted: false },
    });
    const items = await this.syncItems(tx, scope, saveBillDto.items, modifiedBy);
    const charges = await this.chargeDetailService.syncDocumentCharges(
      tx,
      this.toChargeScope(scope),
      saveBillDto.charges,
      modifiedBy,
      BILL_CHARGE_AUDIT,
    );
    const tenders = await this.tenderDetailService.syncDocumentTenders(
      tx,
      this.toTenderScope(scope, saveBillDto.tenders),
      encodeTempCreditTenders(saveBillDto.tenders),
      modifiedBy,
      BILL_TENDER_AUDIT,
    );
    await this.validateDraftAdjustments(tx, updated, saveBillDto.adjustments);
    await this.writeTransportBand(tx, updated, saveBillDto, modifiedBy, now);
    await this.saleOrderService.syncOrderFulfilment(
      tx,
      {
        refs: [
          ...this.toOrderHeaderRefs(existing),
          ...this.toOrderHeaderRefs(updated),
          ...this.toOrderLineRefs(priorItems),
          ...this.toOrderLineRefs(items),
        ],
      },
      modifiedBy,
      now,
    );
    await this.quotationService.syncQuotationConversion(
      tx,
      { refs: [...this.toQuotationRefs(existing), ...this.toQuotationRefs(updated)] },
      modifiedBy,
      now,
    );
    const payload = this.toPayload({ ...updated, items, charges, tenders });
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: BILL_TABLE_NAME,
        screenName: BILL_AUDIT_SCREEN_NAME,
        screenType: 'transaction',
        pk: existing.sbId,
        displayName: payload.sbBillRefno || payload.sbId,
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: modifiedBy,
        notes: opts.notes ?? 'Bill updated',
      },
      tx,
    );
    return { updated, items };
  }
  /**
   * HANDOVER §2.1: the walk-in customer keeps whatever `sbCust*` the client
   * typed; a listed customer's `sbCust*` are copied from the master unless
   * `custOverride`. The GSTIN copied here is what makes the sale B2B on the
   * register, so it is the master's, not a stale snapshot the till cached.
   */
  private async applyCustomerSnapshot(
    tx: Prisma.TransactionClient,
    data: Prisma.SaleBillUncheckedCreateInput | Prisma.SaleBillUncheckedUpdateInput,
    dto: SaveBillDto,
    walkInCustomerId: string | null,
  ): Promise<void> {
    const custId = dto.sbCustId;
    if (!custId || dto.custOverride || custId === walkInCustomerId) {
      return;
    }
    const cus = await tx.customer.findFirst({
      where: { cusId: custId },
      select: {
        cusName: true,
        cusAddr1: true,
        cusAddr2: true,
        cusAddr3: true,
        cusCity: true,
        cusPin: true,
        cusPhone1: true,
        cusGstNo: true,
        cusGstType: true,
        cusStateCode: true,
        cusStateName: true,
        cusPanNo: true,
      },
    });
    if (!cus) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Customer does not exist', [
        { field: 'sbCustId', message: `No customer found with id ${custId}` },
      ]);
    }
    const addr = [cus.cusAddr1, cus.cusAddr2, cus.cusAddr3].filter((a) => a?.trim()).join(', ');
    const d = data as Record<string, unknown>;
    d.sbCustName = cus.cusName ?? d.sbCustName;
    d.sbCustAddr = addr || null;
    d.sbCustPlace = cus.cusCity ?? null;
    d.sbCustPin = cus.cusPin ?? null;
    d.sbCustPhone = cus.cusPhone1 ?? null;
    d.sbCustGstin = cus.cusGstNo ?? null;
    d.sbCustGstType = cus.cusGstType ?? null;
    d.sbCustStcd = cus.cusStateCode ?? null;
    d.sbStateName = cus.cusStateName ?? null;
    if (dto.sbCustPan === undefined && cus.cusPanNo) {
      d.sbCustPan = cus.cusPanNo;
    }
  }
  /**
   * The flat `sbShip*` / `sbDispatch*` / `sbTransport*` fields of §2.1 become
   * the OUTWARD transport band. Nothing said → no row; a band that exists is
   * updated in place. Always writable on a DRAFT (no register yet).
   */
  private async writeTransportBand(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    dto: SaveBillDto,
    actor: string,
    now: Date,
  ): Promise<void> {
    const input = flatTransportOf(dto);
    if (!TransportBandService.hasContent(input)) {
      return;
    }
    await this.transportBand.write(
      tx,
      {
        docType: 'SALE_BILL',
        docId: bill.sbId,
        accYear: bill.sbAccYear,
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        docRefno: bill.sbBillRefno,
      },
      input,
      actor,
      { gdrId: bill.sbDocRegisterId, now },
    );
  }
  /**
   * A DRAFT carries no receivable, so its set-offs cannot be written yet. They
   * are CHECKED — the credit exists, is the party's, is a CR balance — and
   * their sum has to agree with sbAdvanceAmt, which is what /bills/post applies.
   */
  private async validateDraftAdjustments(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    adjustments: SaveBillAdjustmentDto[] | undefined,
  ): Promise<void> {
    if (adjustments === undefined || adjustments.length === 0) {
      return;
    }
    const partyId = this.requireCustomerLedgerId(bill.sbCustId, 'adjustments');
    let total = 0;
    for (const [index, adj] of adjustments.entries()) {
      const [credit] = await tx.$queryRaw<
        { abl_party_id: string; abl_dr_cr: string; abl_pending_amount: Prisma.Decimal | null }[]
      >`
        SELECT abl_party_id, abl_dr_cr, abl_pending_amount
          FROM accounts.acc_bill_balance
         WHERE abl_id = ${adj.againstBillId}::uuid AND abl_acc_year = ${adj.againstBillAccYear}::bpchar
           AND abl_company_id = ${bill.sbCompanyId}::uuid AND abl_is_deleted = false AND abl_is_active = true`;
      if (!credit || credit.abl_party_id !== partyId || credit.abl_dr_cr.trim() !== 'CR') {
        throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
          {
            field: `adjustments[${index}].againstBillId`,
            message: `No open credit ${adj.againstBillId} belongs to this customer`,
          },
        ]);
      }
      if (num(credit.abl_pending_amount) + 0.005 < num(adj.amount)) {
        throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
          {
            field: `adjustments[${index}].amount`,
            message: `Credit has only ${num(credit.abl_pending_amount)} pending`,
          },
        ]);
      }
      total += num(adj.amount);
    }
    const declared = num(bill.sbAdvanceAmt);
    if (Math.abs(declared - total) > 0.01) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
        {
          field: 'sbAdvanceAmt',
          message: `adjustments total ${total.toFixed(2)} but sbAdvanceAmt says ${declared.toFixed(2)}`,
        },
      ]);
    }
  }
  // Reconciles the bill's line items with the payload array:
  //   - a line carrying sbiId updates that existing line
  //   - a line without sbiId is created
  //   - an existing line absent from the array is soft deleted
  // Passing `undefined` (property omitted) leaves the current lines untouched.
  //
  // Order matters, for the same reason as the quotation module: the replaced
  // lines are soft deleted first (freeing their line numbers), and surviving
  // lines the payload reorders are parked above every requested number before
  // being renumbered down, so a 1<->2 swap never passes through a state where
  // both rows want the same number.
  private async syncItems(
    tx: BillWriteClient,
    scope: BillScope,
    inputItems: SaveBillItemDto[] | undefined,
    actorId: string,
  ): Promise<SaleBillItem[]> {
    const existing = await tx.saleBillItem.findMany({
      where: { sbiBillId: scope.sbId, sbiIsDeleted: false },
      orderBy: { sbiLineNo: 'asc' },
    });
    if (inputItems === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((item) => [item.sbiId, item]));
    const now = new Date();
    // Line numbers first: an entry keeps the number it sent, otherwise it takes
    // its position in the array.
    const resolvedItems = inputItems.map((inputItem, index) => ({
      inputItem,
      lineNo: inputItem.sbiLineNo ?? index + 1,
    }));
    const seenLineNos = new Set<number>();
    const keptIds = new Set<string>();
    for (const { inputItem, lineNo } of resolvedItems) {
      if (seenLineNos.has(lineNo)) {
        throwSalesConflict<BillErrorDetail, BillErrorResponse>(
          'Duplicate bill line number is not allowed',
          [
            {
              field: 'sbiLineNo',
              message: `A bill line already exists with line number ${lineNo}`,
            },
          ],
        );
      }
      seenLineNos.add(lineNo);
      if (inputItem.sbiId) {
        if (!existingMap.has(inputItem.sbiId)) {
          throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
            'Bill item not found',
            'sbiId',
            `No active bill line found with id ${inputItem.sbiId} on this bill`,
          );
        }
        keptIds.add(inputItem.sbiId);
      }
    }
    // Retire the lines the payload dropped before inserting anything: leaving
    // them active would hold their line numbers against the replacements.
    await this.softDeleteItems(
      tx,
      existing.filter((item) => !keptIds.has(item.sbiId)),
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
        inputItem.sbiId !== undefined && existingMap.get(inputItem.sbiId)?.sbiLineNo !== lineNo,
    );
    if (reordersItems && keptIds.size > 0) {
      await tx.saleBillItem.updateMany({
        where: { sbiId: { in: [...keptIds] } },
        data: { sbiLineNo: { increment: Math.max(...seenLineNos) + 1 } },
      });
    }
    const persisted: SaleBillItem[] = [];
    for (const { inputItem, lineNo } of resolvedItems) {
      if (inputItem.sbiId) {
        // Present — the validation pass above already rejected an id that is not
        // an active line on this bill.
        const existingItem = existingMap.get(inputItem.sbiId)!;
        this.ensureBillItemValuesAreAllowed(inputItem, existingItem);
        const updateData: Prisma.SaleBillItemUncheckedUpdateInput = {
          sbiLineNo: lineNo,
          sbiSplitNo: inputItem.sbiSplitNo ?? existingItem.sbiSplitNo,
          sbiItemId: inputItem.sbiItemId ?? existingItem.sbiItemId,
          sbiItemUnitId: inputItem.sbiItemUnitId ?? existingItem.sbiItemUnitId,
          sbiGodownId: inputItem.sbiGodownId ?? existingItem.sbiGodownId,
          sbiStockId: inputItem.sbiStockId ?? existingItem.sbiStockId,
          sbiPriceLevel: inputItem.sbiPriceLevel ?? scope.sbPriceLevel,
          sbiModifiedOn: now,
          sbiModifiedBy: resolveActor(inputItem.sbiModifiedBy, actorId),
        };
        applyPresentFields(
          updateData,
          inputItem,
          BILL_ITEM_OPTIONAL_FIELDS,
          BILL_ITEM_DATE_TRANSFORMS,
        );
        const updated = await tx.saleBillItem.update({
          where: {
            sbiId_sbiAccYear: { sbiId: inputItem.sbiId, sbiAccYear: existingItem.sbiAccYear },
          },
          data: updateData,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BILL_ITEM_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.sbiId,
            displayName: `Line ${updated.sbiLineNo}`,
            originalRecord: this.toItemPayload(existingItem),
            modifiedRecord: this.toItemPayload(updated),
            userId: resolveActor(inputItem.sbiModifiedBy, actorId),
            notes: 'Bill item updated',
          },
          tx,
        );
        persisted.push(updated);
        continue;
      }
      this.ensureBillItemValuesAreAllowed(inputItem, undefined);
      const createData: Prisma.SaleBillItemUncheckedCreateInput = {
        sbiBillId: scope.sbId,
        sbiCompanyId: inputItem.sbiCompanyId ?? scope.sbCompanyId,
        sbiBranchId: inputItem.sbiBranchId ?? scope.sbBranchId,
        sbiTenantId: inputItem.sbiTenantId ?? scope.sbTenantId,
        sbiAccYear: inputItem.sbiAccYear ?? scope.sbAccYear,
        sbiLineNo: lineNo,
        sbiSplitNo: inputItem.sbiSplitNo ?? 1,
        sbiItemId: this.requireItemField(inputItem.sbiItemId, 'sbiItemId'),
        sbiItemUnitId: this.requireItemField(inputItem.sbiItemUnitId, 'sbiItemUnitId'),
        sbiGodownId: this.requireItemField(inputItem.sbiGodownId, 'sbiGodownId'),
        // Nullable column: a line with no batch allocation is allowed.
        sbiStockId: inputItem.sbiStockId ?? null,
        sbiPriceLevel: inputItem.sbiPriceLevel ?? scope.sbPriceLevel,
        sbiCreatedOn: now,
        sbiCreatedBy: resolveActor(inputItem.sbiCreatedBy, actorId),
      };
      applyPresentFields(
        createData,
        inputItem,
        BILL_ITEM_OPTIONAL_FIELDS,
        BILL_ITEM_DATE_TRANSFORMS,
      );
      const created = await tx.saleBillItem.create({ data: createData });
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: BILL_ITEM_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: created.sbiId,
          displayName: `Line ${created.sbiLineNo}`,
          originalRecord: null,
          modifiedRecord: this.toItemPayload(created),
          userId: created.sbiCreatedBy,
          notes: 'Bill item created',
        },
        tx,
      );
      persisted.push(created);
    }
    return persisted.sort((left, right) => left.sbiLineNo - right.sbiLineNo);
  }
  // Retires the lines the payload no longer carries. Called before the payload
  // is written so the freed line numbers are available to the replacements.
  private async softDeleteItems(
    tx: BillWriteClient,
    removed: SaleBillItem[],
    actorId: string,
    now: Date,
  ): Promise<void> {
    for (const removedItem of removed) {
      const deleted = await tx.saleBillItem.update({
        where: {
          sbiId_sbiAccYear: { sbiId: removedItem.sbiId, sbiAccYear: removedItem.sbiAccYear },
        },
        data: {
          sbiIsDeleted: true,
          sbiModifiedOn: now,
          sbiModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BILL_ITEM_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: deleted.sbiId,
          displayName: `Line ${removedItem.sbiLineNo}`,
          originalRecord: this.toItemPayload(removedItem),
          modifiedRecord: this.toItemPayload(deleted),
          userId: actorId,
          notes: 'Bill item soft deleted',
        },
        tx,
      );
    }
  }
  // Names the duplicate a P2002 actually is. Unlike sale_quotation, sale_bill
  // defines no unique index on (company, branch, accYear, billRefno/billSlno) —
  // the numbers now come from the voucher sequence, whose own scope constraint
  // and advisory lock keep them unique (see the README) — so the only realistic
  // P2002 source is the partition-aware primary key itself, which should not
  // happen given sbId / sbiId are uuidv7-generated.
  private describeDuplicate(error: unknown): { message: string; errors: BillErrorDetail[] } {
    void error;
    return {
      message: 'Bill already exists',
      errors: [{ field: 'sbId', message: 'A bill with this id already exists' }],
    };
  }
  // Mirrors the DB CHECK constraints dropped from sale_bill (ck_sb_doc_type /
  // ck_sb_bill_type / ck_sb_status / ck_sb_pay_status / ck_sb_return_status,
  // migration 20260731070026) so a bad value comes back as a 400 with the
  // offending field instead of a raw Postgres 23514. Only the fields present on
  // the payload are checked — an update that omits a field leaves whatever is
  // already stored untouched, so there is nothing new to validate.
  private ensureBillValuesAreAllowed(dto: SaveBillDto): void {
    const values: BillGuardedValues = {
      sbDocType: dto.sbDocType,
      sbBillType: dto.sbBillType,
      sbPayStatus: dto.sbPayStatus,
      sbReturnStatus: dto.sbReturnStatus,
    };
    const details: BillErrorDetail[] = [];
    for (const guard of BILL_VALUE_GUARDS) {
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
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Invalid bill value', details);
    }
  }
  // sb_pos_stcd is the one header column with a foreign key to
  // fixed.state_codes (fk_sb_pos_state), and the place of supply is normally
  // copied off the customer master — whose own cus_state_code has no such key.
  // A customer carrying a code that is not a GST state code (e.g. 'TN' instead
  // of '33') therefore reached the insert and came back as a raw Postgres
  // 23503. It is checked here instead, so the answer names the field. Only a
  // value actually on the payload is checked: an update that omits sbPosStcd
  // leaves whatever is stored — already FK-valid — untouched.
  private async ensurePosStateExists(tx: BillWriteClient, dto: SaveBillDto): Promise<void> {
    if (!hasOwnProperty(dto, 'sbPosStcd')) {
      return;
    }
    const posStcd = dto.sbPosStcd;
    if (posStcd === undefined || posStcd === null) {
      return;
    }
    // Soft-deleted states still satisfy the FK, so they are accepted here too —
    // this guard mirrors what the database enforces, no more.
    const state = await tx.stateCode.findUnique({
      where: { stateCode: posStcd },
      select: { stateCode: true },
    });
    if (!state) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Place of supply does not exist', [
        {
          field: 'sbPosStcd',
          message: `No state found with code ${posStcd}`,
        },
      ]);
    }
  }
  // Mirrors the DB CHECK constraints dropped from sale_bill_item
  // (ck_sbi_free_type / ck_sbi_split_no / ck_sbi_batch_split, migration
  // 20260731070026). ck_sbi_split_no (sbi_split_no >= 1) is covered by the
  // @OptionalInteger(1) Min validator on SaveBillItemDto and is not repeated
  // here. ck_sbi_batch_split is a cross-field rule, so it is judged on the
  // FINAL resolved values — the payload's, falling back to the existing row's
  // on update — the same way the charge module judges cdTaxApl/cdBeforeTax.
  private ensureBillItemValuesAreAllowed(
    inputItem: SaveBillItemDto,
    existingItem: SaleBillItem | undefined,
  ): void {
    const details: BillErrorDetail[] = [];
    if (inputItem.sbiFreeType !== undefined && inputItem.sbiFreeType !== null) {
      if (!(BILL_ITEM_FREE_TYPES as readonly string[]).includes(inputItem.sbiFreeType)) {
        details.push({
          field: 'sbiFreeType',
          message: `sbiFreeType must be one of: ${BILL_ITEM_FREE_TYPES.join(', ')}`,
        });
      }
    }
    const splitNo =
      inputItem.sbiSplitNo !== undefined ? inputItem.sbiSplitNo : (existingItem?.sbiSplitNo ?? 1);
    const batchNo =
      inputItem.sbiBatchNo !== undefined
        ? inputItem.sbiBatchNo
        : (existingItem?.sbiBatchNo ?? null);
    if (splitNo !== 1 && !batchNo) {
      details.push({
        field: 'sbiBatchNo',
        message: 'sbiBatchNo is required when sbiSplitNo is not 1',
      });
    }
    // A sale-order reference is NOT checked for completeness here. A line that
    // names SALES_ORDER but omits any of sbi_src_doc_id / _year / _line_no is
    // saved as sent; toOrderLineRefs simply skips it, so the order it came from
    // keeps whatever fulfilment state it already had instead of the save being
    // rejected.
    if (details.length > 0) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Invalid bill item value', details);
    }
  }
  // The sale order lines a set of bill lines draws down. A line that names no
  // source document — a walk-in sale, which is most of them — or one that names
  // a source that is not a sale order contributes nothing, so a bill with none
  // of them never reaches the sale-order module at all.
  //
  // sbi_src_doc_year is CHAR(9) and comes back space-padded when a client sends
  // it short, so it is trimmed before being used as half of an order's primary
  // key.
  /** Every order reference this bill makes — header and lines — for the fulfilment recompute. */
  orderRefsOf(bill: SaleBill, items: SaleBillItem[]): SaleOrderLineRef[] {
    return [...this.toOrderHeaderRefs(bill), ...this.toOrderLineRefs(items)];
  }
  private toOrderLineRefs(items: SaleBillItem[]): SaleOrderLineRef[] {
    const refs: SaleOrderLineRef[] = [];
    for (const item of items) {
      // Both halves of a primary key or nothing. sbi_src_doc_id is normally the
      // soi_id of the order line the bill line came from, in which case it
      // addresses that line on its own and sbi_src_doc_line_no adds nothing; a
      // client that instead stored the so_id needs the line number with it. The
      // sale-order module tells the two apart, so neither is asked for here.
      if (
        item.sbiSrcDocType !== SALE_ORDER_SRC_DOC_TYPE ||
        !item.sbiSrcDocId ||
        !item.sbiSrcDocYear
      ) {
        continue;
      }
      refs.push({
        srcDocId: item.sbiSrcDocId,
        srcAccYear: item.sbiSrcDocYear.trim(),
        soLineNo: item.sbiSrcDocLineNo,
        fields: BILL_ITEM_SRC_DOC_FIELDS,
      });
    }
    return refs;
  }
  // The order the BILL ITSELF was raised against — sb_src_doc_type /
  // sb_src_doc_id / sb_src_doc_year, the header's own reference. It names no
  // line and so draws nothing down; what it asks for is that the order be
  // re-derived from its bills, which is what keeps so_status and
  // so_fulfil_status honest on a bill that fills in only its header.
  //
  // Returned as an array so a caller can spread it: a walk-in bill, or one
  // sourced from something that is not a sale order, contributes no reference
  // at all.
  private toOrderHeaderRefs(bill: SaleBill | null): SaleOrderLineRef[] {
    if (!bill || bill.sbSrcDocType !== SALE_ORDER_SRC_DOC_TYPE) {
      return [];
    }
    // Both halves of the order's primary key or nothing: an id without the year
    // it lives in addresses no row, and sale_order is partitioned by that year.
    if (!bill.sbSrcDocId || !bill.sbSrcDocYear) {
      return [];
    }
    return [
      {
        srcDocId: bill.sbSrcDocId,
        srcAccYear: bill.sbSrcDocYear.trim(),
        soLineNo: null,
        fields: BILL_SRC_DOC_FIELDS,
      },
    ];
  }
  // The quotation the bill was raised from — sb_src_doc_type / sb_src_doc_id /
  // sb_src_doc_year again, read with the other discriminator. The header is the
  // only grain that matters here: sq_converted_doc_id names one document, and a
  // quotation line has no conversion columns for a bill line to move, so
  // sbi_src_doc_* is not consulted. A bill converted from a quotation must
  // therefore say so on its HEADER or the quotation never learns of it.
  //
  // Returned as an array so a caller can spread it: a walk-in bill, or one
  // raised from a sale order instead, contributes no reference at all.
  private toQuotationRefs(bill: SaleBill | null): QuotationConversionRef[] {
    if (!bill || bill.sbSrcDocType !== QUOTATION_SRC_DOC_TYPE) {
      return [];
    }
    // Both halves of the quotation's primary key or nothing: sale_quotation is
    // partitioned by sq_acc_year, so an id without the year it lives in
    // addresses no row.
    if (!bill.sbSrcDocId || !bill.sbSrcDocYear) {
      return [];
    }
    return [
      {
        srcDocId: bill.sbSrcDocId,
        srcAccYear: bill.sbSrcDocYear.trim(),
        fields: BILL_SRC_DOC_FIELDS,
      },
    ];
  }
  // A missing required field is a 400. This answered 404 — the wrong helper —
  // so a bill line that left out sbiItemId / sbiItemUnitId / sbiGodownId came
  // back looking like an unrouted POST /bills/create rather than the field
  // rejection it is. The DTO marks all three @RequiredUuid, so this fires on the
  // update path, where an incoming line is only a partial and a NEW line on that
  // payload can still reach here without them.
  private requireItemField(value: string | undefined, field: string): string {
    if (!value) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>(
        `${field} is required for a new bill line`,
        [
          {
            field,
            message: `${field} must be provided when creating a bill line`,
          },
        ],
      );
    }
    return value;
  }
  // The bill's applied charges as the charge-detail module wants them: a bill
  // IS the tax invoice, so its lines carry the INVOICE discriminator, and every
  // charge inherits the header's company / branch / accounting year and
  // defaults its cdVoucherNo to the bill's own number.
  private toChargeScope(scope: BillScope): ChargeDocumentScope {
    return {
      cdDocType: BILL_CHARGE_DOC_TYPE,
      cdDocId: scope.sbId,
      cdCompId: scope.sbCompanyId,
      cdBranchId: scope.sbBranchId,
      cdAccYear: scope.sbAccYear,
      cdVoucherNo: scope.sbBillSlno,
    };
  }
  // The same for the tendered money: a bill's tenders are SALES / SALE_BILL rows
  // pointing at sbId, dated with the bill, raised against the customer's ledger
  // and captured by the bill's own user / session / device.
  //
  // td_party_ledger_id takes sbCustId: a customer row and its account ledger
  // share one primary key (CustomerService mirrors every customer into
  // acc_ledger_master under the same id), so the bill's customer IS the ledger
  // the money is owed by. A line may still name a different party ledger, and
  // the tender module verifies whichever id it gets.
  private toTenderScope(
    scope: BillScope,
    tenders: SaveTenderDetailDto[] | undefined,
  ): TenderDocumentScope {
    return {
      tdSrcModule: BILL_TENDER_SRC_MODULE,
      tdSrcDocType: BILL_TENDER_SRC_DOC_TYPE,
      tdSrcDocId: scope.sbId,
      tdCompanyId: scope.sbCompanyId,
      tdBranchId: scope.sbBranchId,
      tdTenantId: scope.sbTenantId,
      tdAccYear: scope.sbAccYear,
      tdDocDate: scope.sbBillDate,
      // Demanded only when there is money to file: syncDocumentTenders reads the
      // scope's party solely to stamp a line it writes, so a walk-in bill with
      // no tenders saves with a null party and no tender row to hang off it.
      tdPartyLedgerId:
        tenders === undefined || tenders.length === 0
          ? scope.sbCustId
          : this.requireCustomerLedgerId(scope.sbCustId, 'tenders'),
      tdUserId: scope.sbUserId,
      tdSessionId: scope.sbSessionId,
      tdDeviceId: scope.sbDeviceId,
      tdDrCr: BILL_TENDER_DR_CR,
    };
  }
  // Every accounting row a bill raises — the voucher's avh_party_id, the
  // receivable's abl_party_id, a tender's td_party_ledger_id, an adjustment's
  // abj_party_id — is NOT NULL, because each of them is money owed by or to
  // somebody. sb_cust_id is nullable, so a walk-in bill that names no customer
  // master row can be kept and edited but cannot carry any of them.
  //
  // `field` is whichever part of the payload asked for accounts, so the
  // operator is told what to drop rather than just that the save failed.
  private requireCustomerLedgerId(sbCustId: string | null, field: string): string {
    if (sbCustId === null) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
        {
          field,
          message:
            'This bill names no customer (sbCustId), so there is no account ledger to raise ' +
            'these rows against. Pick a customer, or drop them from the payload.',
        },
      ]);
    }
    return sbCustId;
  }
  // Posts the credits the customer already holds — order advances, sale-return
  // credit notes — against this bill's receivable.
  //
  // Runs after the posting sync, because the invoice's acc_bill_balance row is
  // half of every adjustment row and only exists once the bill is in the books.
  //
  // Absent is not empty (see SaveBillAdjustmentDto): omitting the key leaves the
  // existing settlement's rows alone, though the invoice's allocation is still
  // re-settled from them — sbPaidAmt may have changed on this save. A DRAFT
  // that was never posted stays a no-op rather than an error. Sending
  // adjustments for a bill that carries no receivable is not — there is
  // nothing to settle, and silently dropping the array would tell the operator
  // their credit was applied when it was not.
  // One row on public.txn_status_log per status STEP — the bill's trail is the
  // ordered set of them, and sb_status is only ever the CURRENT state. Written
  // inside the caller's transaction, so the step commits with the write that
  // caused it: a bill that says CANCELLED with nothing saying who cancelled it
  // is what this prevents.
  //
  // Only a step is logged. An ordinary save that leaves sbStatus where it was
  // adds nothing here — what changed field by field is audit.audit_log's job.
  private async logStatusChange(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    fromStatus: string | null,
    actor: string,
    changedOn: Date,
    remarks?: string | null,
  ): Promise<void> {
    await appendTxnStatusLog(tx, {
      companyId: bill.sbCompanyId,
      branchId: bill.sbBranchId,
      tenantId: bill.sbTenantId,
      // The bill's own year, not today's: txn_status_log is partitioned by it.
      accYear: bill.sbAccYear,
      srcModule: BILL_STATUS_SRC_MODULE,
      srcDocType: BILL_STATUS_SRC_DOC_TYPE,
      srcDocId: bill.sbId,
      srcDocRefno: bill.sbBillRefno,
      event: this.toStatusEvent(fromStatus, bill.sbStatus),
      fromStatus,
      toStatus: bill.sbStatus,
      changedOn,
      changedBy: actor,
      // ck_tsl_reason_required wants one on a cancellation. The bill no longer
      // carries a fallback copy (20260921220000 dropped sb_cancel_reason), so
      // this row IS the reason's only home — the caller must supply it, and the
      // helper falls back rather than failing the save.
      remarks,
      // Free text on the bill (a device CODE in practice), a device_master uuid
      // on the log — the helper resolves it either way round.
      deviceId: bill.sbDeviceId,
      sessionId: bill.sbSessionId,
    });
  }
  // Names the step for reporting ("what was posted / cancelled this month"),
  // where tslToStatus alone would only say where each document ended up.
  private toStatusEvent(fromStatus: string | null, toStatus: string): TxnStatusEvent {
    if (fromStatus === null) {
      // First row of the trail. Whether the bill was born DRAFT or straight into
      // POSTED is what tslToStatus says.
      return TxnStatusEvent.CREATED;
    }
    if (toStatus === BILL_STATUS_CANCELLED) {
      return TxnStatusEvent.CANCELLED;
    }
    if (toStatus === BILL_STATUS_POSTED) {
      return TxnStatusEvent.POSTED;
    }
    // Out of POSTED but still alive — the voucher is cancelled and the
    // receivable retired, the bill itself is not (see syncBillPosting).
    if (fromStatus === BILL_STATUS_POSTED) {
      return TxnStatusEvent.UNPOSTED;
    }
    return TxnStatusEvent.STATUS_CHANGED;
  }
  private applyOptionalFields(
    data: Prisma.SaleBillUncheckedCreateInput | Prisma.SaleBillUncheckedUpdateInput,
    dto: SaveBillDto,
  ): void {
    applyPresentFields(data, dto, BILL_OPTIONAL_FIELDS, BILL_DATE_TRANSFORMS);
  }
  // One batched read of the godowns the bill's lines point at, keyed by gdl_id.
  // Empty on the create/update paths, which do not resolve display names — see
  // toItemPayload.
  private async resolveGodowns(
    items: readonly Pick<SaleBillItem, 'sbiGodownId'>[] = [],
  ): Promise<Map<string, LineGodown>> {
    const godownIds = [...new Set(items.map((item) => item.sbiGodownId))];
    if (godownIds.length === 0) {
      return new Map();
    }
    const godowns = await this.prisma.godownLocation.findMany({
      where: { gdlId: { in: godownIds } },
      select: { gdlId: true, gdlName: true, gdlNegativeStock: true },
    });
    return new Map(
      godowns.map((godown) => [
        godown.gdlId,
        { gdlName: godown.gdlName, gdlNegativeStock: godown.gdlNegativeStock },
      ]),
    );
  }

  // company.comp_negstk_apl, the second of the three switches behind a line's
  // sbiAllowNegativeStock. A company row that is missing or retired is not a
  // "no" — the godown and the item still decide — so it answers null.
  private async resolveCompanyNegStock(companyId: string): Promise<boolean | null> {
    const company = await this.prisma.company.findFirst({
      where: { compId: companyId, compIsDeleted: false },
      select: { compNegStkApl: true },
    });
    return company?.compNegStkApl ?? null;
  }
  private toPayload(
    record: SaleBill & {
      items?: SaleBillItemWithNames[];
      // Already shaped by ChargeDetailService / TenderDetailService — the bill
      // passes them through.
      charges?: BillChargePayload[];
      tenders?: BillTenderPayload[];
    },
    lineContext: BillLineContext = EMPTY_LINE_CONTEXT,
  ): BillPayload {
    const {
      sbCreatedOn,
      sbModifiedOn,
      sbBillDatetime,
      sbSyncDate,
      sbBillSlno,
      items,
      charges,
      tenders,
      ...rest
    } = record;
    return {
      ...rest,
      sbCreatedOn: sbCreatedOn?.toISOString(),
      sbModifiedOn: sbModifiedOn?.toISOString() ?? null,
      sbBillDatetime: sbBillDatetime?.toISOString(),
      sbSyncDate: sbSyncDate?.toISOString() ?? null,
      // bigint column — stringified here for the same reason cdVoucherNo is:
      // JSON has no bigint and res.json() throws on one.
      sbBillSlno: sbBillSlno?.toString() ?? null,
      items: items ? items.map((item) => this.toItemPayload(item, lineContext)) : [],
      charges: charges ?? [],
      tenders: tenders ?? [],
    };
  }
  private toItemPayload(
    record: SaleBillItemWithNames,
    lineContext: BillLineContext = EMPTY_LINE_CONTEXT,
  ): BillItemPayload {
    const { godownById, companyAllowsNegStock } = lineContext;
    const { sbiCreatedOn, sbiModifiedOn, sbiSyncDate, item, itemUnitConversion, ...rest } = record;
    return {
      ...rest,
      sbiCreatedOn: sbiCreatedOn?.toISOString(),
      sbiModifiedOn: sbiModifiedOn?.toISOString() ?? null,
      sbiSyncDate: sbiSyncDate?.toISOString() ?? null,
      sbiItemName: item?.itemNameEn ?? null,
      sbiUnitName: itemUnitConversion?.unit.unit_name ?? null,
      sbiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
      sbiGroupId: item?.itemGroupId ?? null,
      sbiBrandId: item?.itemBrandId ?? null,
      sbiSectionId: item?.itemSectionId ?? null,
      sbiCategoryId: item?.itemCategoryId ?? null,
      sbiGodownName: godownById.get(record.sbiGodownId)?.gdlName ?? null,
      // The effective answer to "may this line go below zero", derived the same
      // way /item-price derives allow_negative_stock when the line is first
      // added (see item-price.lookup.ts): a service item always may, and
      // otherwise it is blocked only when the godown, the company AND the item
      // all say no. Unlike a quotation's, a bill line names its OWN godown, so
      // the godown half of the answer is that line's. Read-only and GET-only
      // like the fields above — null when the item join was not made.
      sbiAllowNegativeStock: item
        ? item.itemIsService ||
          !(
            godownById.get(record.sbiGodownId)?.gdlNegativeStock === false &&
            companyAllowsNegStock === false &&
            item.itemAllowNegStock === false
          )
        : null,
    };
  }
}

/** §10 — what the client sends that the server must IGNORE. */
function stripServerOwned(dto: SaveBillDto): void {
  const d = dto as unknown as Record<string, unknown>;
  for (const key of [
    'sbStatus',
    'sbPostedVoucherId',
    'sbDocRegisterId',
    'sbRevisionNo',
    'sbCogsAmt',
    'sbDeliveryStatus',
    'sbLoyaltyEarned',
    'sbLoyaltyRedeemed',
    'sbReturnedAmt',
    'sbReturnStatus',
    'sbBillSlno',
    'sbBillRefno',
  ]) {
    delete d[key];
  }
  for (const item of dto.items ?? []) {
    delete (item as unknown as Record<string, unknown>).sbiCogsAmt;
  }
}

/** The flat §2.1 fields → one OUTWARD band. */
export function flatTransportOf(dto: SaveBillDto): TransportBandInput {
  return {
    direction: 'OUTWARD',
    from: {
      godownId: dto.sbDispatchGodownId ?? null,
      branchId: dto.sbDispatchBranchId ?? null,
    },
    to: {
      addrId: dto.sbShipAddrId ?? null,
      name: dto.sbShipName ?? null,
      addr: dto.sbShipAddr ?? null,
      place: dto.sbShipPlace ?? null,
      pin: dto.sbShipPin ?? null,
      phone: dto.sbShipPhone ?? null,
      stcd: dto.sbShipStcd ?? null,
      gstin: dto.sbShipGstin ?? null,
    },
    mode: dto.sbTransportMode ?? null,
    transporterId: dto.sbTransporterId ?? null,
    transporterName: dto.sbTransporterName ?? null,
    transporterGstin: dto.sbTransporterGstin ?? null,
    lrNo: dto.sbLrNo ?? null,
    lrDate: dto.sbLrDate ?? null,
    distanceKm: dto.sbDistanceKm ?? null,
  };
}
