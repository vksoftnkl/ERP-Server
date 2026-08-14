import { Injectable } from '@nestjs/common';
import { Prisma, SaleBill, SaleBillItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBillDto } from './dto/save-bill.dto';
import { SaveBillItemDto } from './dto/save-bill-item.dto';
import {
  BILL_CHARGE_AUDIT,
  BILL_CHARGE_DOC_TYPE,
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
import { deleteBillPosting, postBillToAccounts, syncBillPosting } from './bill-posting.helper';
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
const BILL_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
// The status a soft-deleted bill is left in, and the reason recorded with it
// when the bill carries none of its own (sb_cancel_reason is VarChar(250)).
const BILL_STATUS_CANCELLED = 'CANCELLED';
const BILL_DELETE_CANCEL_REASON = 'Bill deleted';
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
  { field: 'sbStatus', allowed: BILL_STATUSES, nullable: false },
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
  'sbStatus',
  'sbPostedOn',
  'sbPostedVoucherId',
  'sbApprovedOn',
  'sbApprovedBy',
  'sbCancelledOn',
  'sbCancelledBy',
  'sbCancelReason',
  'sbVersionNo',
  'sbPrintCount',
];
// Line-item fields copied straight through when present on the payload. The
// scope keys (bill/company/branch/tenant/accYear/lineNo/priceLevel), the three
// fields required for a new line (sbiItemId, sbiItemUnitId, sbiGodownId) and
// the nullable sbiStockId are set explicitly, so they are excluded here.
const BILL_ITEM_OPTIONAL_FIELDS = [
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
  'sbBillDate',
  'sbBillDatetime',
  'sbDueDate',
  'sbSrcDocDate',
  'sbPostedOn',
  'sbApprovedOn',
  'sbCancelledOn',
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
  sbCustId: string;
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
  } | null;
  itemUnitConversion?: { unit: { unit_name: string; unit_decimal_count: number } } | null;
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
  ) {}
  async save(saveBillDto: SaveBillDto): Promise<BillPayload> {
    this.ensureBillValuesAreAllowed(saveBillDto);
    if (saveBillDto.sbId) {
      return this.updateBill(saveBillDto);
    }
    return this.createBill(saveBillDto);
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
    const godownNameById = await this.resolveGodownNames(record.items);
    return this.toPayload({ ...record, charges, tenders }, godownNameById);
  }
  async softDelete(
    sbId: string,
    sbCompanyId: string,
    sbBranchId: string,
    sbAccYear: string,
  ): Promise<{ sbId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleBill.findFirst({
        where: {
          sbId,
          sbCompanyId,
          sbBranchId,
          sbAccYear,
          sbIsDeleted: false,
        },
      });
      if (!existing) {
        throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
          'Bill not found',
          'sbId',
          `No active bill found with id ${sbId}`,
        );
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // A deleted bill is a cancelled bill: the status moves with the flag so
      // anything reading sbStatus rather than sbIsDeleted still sees a document
      // that is out of play, and the cancellation columns say who did it and
      // when.
      const headerChanges = {
        sbStatus: BILL_STATUS_CANCELLED,
        sbCancelledOn: modifiedOn,
        sbCancelledBy: actor,
        sbCancelReason: existing.sbCancelReason ?? BILL_DELETE_CANCEL_REASON,
        sbIsDeleted: true,
        sbModifiedOn: modifiedOn,
        sbModifiedBy: actor,
      };
      const result = await tx.saleBill.updateMany({
        where: {
          sbId,
          sbCompanyId,
          sbBranchId,
          sbAccYear,
          sbIsDeleted: false,
        },
        data: headerChanges,
      });
      if (result.count === 0) {
        throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
          'Bill not found',
          'sbId',
          `No active bill found with id ${sbId}`,
        );
      }
      // Read before the cascade flags them: these lines name the order lines
      // that have to get their quantity back, and a moment later nothing active
      // will say so.
      const items = await tx.saleBillItem.findMany({
        where: {
          sbiBillId: sbId,
          sbiAccYear: sbAccYear,
          sbiIsDeleted: false,
        },
      });
      // Cascade the soft delete to the bill's line items so no line stays active
      // while the header is logically deleted.
      await tx.saleBillItem.updateMany({
        where: {
          sbiBillId: sbId,
          // sale_bill_item is partitioned by sbi_acc_year like its header, so
          // the year is passed down to keep the cascade on one partition.
          sbiAccYear: sbAccYear,
          sbiIsDeleted: false,
        },
        data: {
          sbiIsDeleted: true,
          sbiModifiedOn: modifiedOn,
          sbiModifiedBy: actor,
        },
      });
      // ... and hands the quantity back to the sale order lines it was drawing
      // down. The header already says sbIsDeleted / CANCELLED at this point, so
      // the order's recompute no longer counts a single one of these lines. The
      // header's own reference goes along too, so an order this bill named but
      // drew nothing from is re-derived as well.
      await this.saleOrderService.syncOrderFulfilment(
        tx,
        { refs: [...this.toOrderHeaderRefs(existing), ...this.toOrderLineRefs(items)] },
        actor,
        modifiedOn,
      );
      // Same cascade for the applied charges — an active charge line must never
      // outlive the document it was charged on.
      await this.chargeDetailService.softDeleteDocumentCharges(
        tx,
        BILL_CHARGE_DOC_TYPE,
        sbId,
        actor,
        modifiedOn,
      );
      // ... and for the tendered money, so no payment line stays active against
      // a bill that no longer exists.
      await this.tenderDetailService.softDeleteDocumentTenders(
        tx,
        BILL_TENDER_SRC_MODULE,
        BILL_TENDER_SRC_DOC_TYPE,
        sbId,
        actor,
        modifiedOn,
      );
      // ... and out of the books, in the same transaction. Only a bill that was
      // POSTED has anything in accounts; for anything else this is a no-op. A
      // bill with money already settled against its receivable is refused here
      // rather than deleted, so the transaction rolls back untouched.
      await deleteBillPosting(tx, existing, actor, modifiedOn);
      const cancelled = { ...existing, ...headerChanges };
      // Closes the bill's status trail. A delete IS a cancellation here, so it
      // is logged as one, with the reason the header was left carrying — which
      // ck_tsl_reason_required demands of a CANCELLED step.
      await this.logStatusChange(tx, cancelled, existing.sbStatus, actor, modifiedOn);
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload(cancelled);
      await this.auditLogService.logEntityChange(
        {
          // A soft delete is logged as 'cancel', the way every other module logs
          // one: audit.audit_log_action has no 'delete' member, so
          // AuditLogService.normalizeAction answers 400 for it.
          action: 'cancel',
          tableName: BILL_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: sbId,
          displayName: existing.sbBillRefno || sbId,
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: 'Bill soft deleted',
        },
        tx,
      );
      return {
        sbId,
        deleted: true,
      };
    });
  }
  private async createBill(saveBillDto: SaveBillDto): Promise<BillPayload> {
    const normalizedCustName = normalizeRequiredText<BillErrorDetail, BillErrorResponse>(
      saveBillDto.sbCustName ?? '',
      'sbCustName',
    );
    const now = new Date();
    const createdBy = resolveActor(saveBillDto.sbCreatedBy, this.requestContextService.getUserId());
    const billDate = saveBillDto.sbBillDate ? new Date(saveBillDto.sbBillDate) : now;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Voucher type 22 numbers the document: the running number consumed from
        // accounts.acc_voucher_seq becomes sbBillSlno and its printable form
        // becomes sbBillRefno. Both are server-assigned — the voucher type is
        // AUTO-numbered with manual numbers disallowed, so whatever the client
        // sent for either field is ignored.
        const billNumber = await allocateVoucherNumber(tx, {
          vchrTypeId: BILL_VCHR_TYPE_ID,
          companyId: saveBillDto.sbCompanyId,
          branchId: saveBillDto.sbBranchId,
          accYear: saveBillDto.sbAccYear,
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
          sbStatus: saveBillDto.sbStatus || 'DRAFT',
        };
        this.applyOptionalFields(data, saveBillDto);
        data.sbCustName = normalizedCustName;
        data.sbBillDate = billDate;
        const created = await tx.saleBill.create({ data });
        const scope: BillScope = {
          sbId: created.sbId,
          sbCompanyId: created.sbCompanyId,
          sbBranchId: created.sbBranchId,
          sbTenantId: created.sbTenantId,
          sbAccYear: created.sbAccYear,
          sbPriceLevel: created.sbPriceLevel,
          sbBillSlno: created.sbBillSlno,
          sbBillDate: created.sbBillDate,
          sbCustId: created.sbCustId,
          sbUserId: created.sbUserId,
          sbSessionId: created.sbSessionId,
          sbDeviceId: created.sbDeviceId,
        };
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
          this.toTenderScope(scope),
          saveBillDto.tenders,
          createdBy,
          BILL_TENDER_AUDIT,
        );
        // A bill created straight into POSTED goes into the books in the same
        // transaction: one accounts.acc_voucher_header and, when it carries a
        // value, one accounts.acc_bills receivable. A bill created as DRAFT is
        // not posted here — it has no accounting effect until it is posted.
        let posted = created;
        if (created.sbStatus === BILL_STATUS_POSTED) {
          const postingResult = await postBillToAccounts(
            tx,
            created,
            BILL_VCHR_TYPE_ID,
            createdBy,
            now,
          );
          posted = await tx.saleBill.update({
            where: { sbId_sbAccYear: { sbId: created.sbId, sbAccYear: created.sbAccYear } },
            data: {
              sbPostedVoucherId: postingResult.voucherId,
              sbPostedOn: postingResult.postedOn,
            },
          });
        }
        // Draws the billed quantity down off the sale order lines these lines
        // came from, plus the order the header itself names. Run after the lines
        // are written so the rows this very save inserted are part of the sum
        // the order re-derives, and inside the same transaction so an order can
        // never claim a delivery from a bill that rolled back. A bill that names
        // no order at all is a no-op.
        await this.saleOrderService.syncOrderFulfilment(
          tx,
          { refs: [...this.toOrderHeaderRefs(posted), ...this.toOrderLineRefs(items)] },
          createdBy,
          now,
        );
        // Opens the bill's status trail: from nothing to whatever it was
        // created as (DRAFT, or POSTED when it went straight into the books).
        await this.logStatusChange(tx, posted, null, createdBy, now);
        const payload = this.toPayload({ ...posted, items, charges, tenders });
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
        return payload;
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
  private async updateBill(saveBillDto: SaveBillDto): Promise<BillPayload> {
    const sbId = saveBillDto.sbId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleBill.findFirst({
          where: {
            sbId,
            sbIsDeleted: false,
          },
        });
        if (!existing) {
          throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
            'Bill not found',
            'sbId',
            `No active bill found with id ${sbId}`,
          );
        }
        const now = new Date();
        const modifiedBy = resolveActor(
          saveBillDto.sbModifiedBy,
          this.requestContextService.getUserId(),
        );
        const data: Prisma.SaleBillUncheckedUpdateInput = {
          sbModifiedOn: now,
          sbModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveBillDto);
        const updated = await tx.saleBill.update({
          where: { sbId_sbAccYear: { sbId: existing.sbId, sbAccYear: existing.sbAccYear } },
          data,
        });
        const scope: BillScope = {
          sbId: updated.sbId,
          sbCompanyId: updated.sbCompanyId,
          sbBranchId: updated.sbBranchId,
          sbTenantId: updated.sbTenantId,
          sbAccYear: updated.sbAccYear,
          sbPriceLevel: updated.sbPriceLevel,
          sbBillSlno: updated.sbBillSlno,
          sbBillDate: updated.sbBillDate,
          sbCustId: updated.sbCustId,
          sbUserId: updated.sbUserId,
          sbSessionId: updated.sbSessionId,
          sbDeviceId: updated.sbDeviceId,
        };
        // Which order lines the bill pointed at BEFORE this save. Read here
        // because syncItems is about to overwrite them: a line the payload drops
        // — or repoints at a different order line — has to hand the abandoned
        // line its quantity back, and after the write there is nothing left
        // saying which line that was.
        const priorItems = await tx.saleBillItem.findMany({
          // Exactly the filter syncItems is about to reconcile against, year
          // included or not — a line whose sbiAccYear the payload overrode must
          // not fall out of the release set.
          where: { sbiBillId: sbId, sbiIsDeleted: false },
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
          this.toTenderScope(scope),
          saveBillDto.tenders,
          modifiedBy,
          BILL_TENDER_AUDIT,
        );
        // Accounts follow the bill's status, in this same transaction: posting a
        // DRAFT writes the voucher and receivable, saving an already-posted bill
        // re-syncs them, and moving it out of POSTED cancels the voucher and
        // retires the receivable.
        const posting = await syncBillPosting(tx, updated, BILL_VCHR_TYPE_ID, modifiedBy, now);
        // sbPostedVoucherId / sbPostedOn are in BILL_OPTIONAL_FIELDS, so the
        // payload can carry them — but the posting result is what decides what
        // they say. Written back only when they actually differ, so an ordinary
        // DRAFT save does not pay for a second update.
        let posted = updated;
        if (
          updated.sbPostedVoucherId !== posting.voucherId ||
          updated.sbPostedOn?.getTime() !== posting.postedOn?.getTime()
        ) {
          posted = await tx.saleBill.update({
            where: { sbId_sbAccYear: { sbId: updated.sbId, sbAccYear: updated.sbAccYear } },
            data: {
              sbPostedVoucherId: posting.voucherId,
              sbPostedOn: posting.postedOn,
            },
          });
        }
        // Re-derives the fulfilment of every order this bill touches, on both
        // sides of the edit: what it points at now, and what it pointed at
        // before — headers included, so an edit that repoints sb_src_doc_id
        // leaves the order it walked away from re-derived rather than frozen at
        // the state this bill last put it in. Run after the posting sync because
        // only a POSTED bill counts towards an order — moving this bill out of
        // POSTED is exactly what releases its quantity back to soi_pending_qty.
        await this.saleOrderService.syncOrderFulfilment(
          tx,
          {
            refs: [
              ...this.toOrderHeaderRefs(existing),
              ...this.toOrderHeaderRefs(posted),
              ...this.toOrderLineRefs(priorItems),
              ...this.toOrderLineRefs(items),
            ],
          },
          modifiedBy,
          now,
        );
        // A status STEP, not the save itself: an edit that leaves sbStatus alone
        // adds no row to the trail.
        if (posted.sbStatus !== existing.sbStatus) {
          await this.logStatusChange(tx, posted, existing.sbStatus, modifiedBy, now);
        }
        const payload = this.toPayload({ ...posted, items, charges, tenders });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BILL_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: sbId,
            displayName: payload.sbBillRefno || payload.sbId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.sbModifiedBy || payload.sbCreatedBy,
            notes: 'Bill updated',
          },
          tx,
        );
        return payload;
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
      sbStatus: dto.sbStatus,
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
  private requireItemField(value: string | undefined, field: string): string {
    if (!value) {
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        `${field} is required for a new bill line`,
        field,
        `${field} must be provided when creating a bill line`,
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
  private toTenderScope(scope: BillScope): TenderDocumentScope {
    return {
      tdSrcModule: BILL_TENDER_SRC_MODULE,
      tdSrcDocType: BILL_TENDER_SRC_DOC_TYPE,
      tdSrcDocId: scope.sbId,
      tdCompanyId: scope.sbCompanyId,
      tdBranchId: scope.sbBranchId,
      tdTenantId: scope.sbTenantId,
      tdAccYear: scope.sbAccYear,
      tdDocDate: scope.sbBillDate,
      tdPartyLedgerId: scope.sbCustId,
      tdUserId: scope.sbUserId,
      tdSessionId: scope.sbSessionId,
      tdDeviceId: scope.sbDeviceId,
      tdDrCr: BILL_TENDER_DR_CR,
    };
  }
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
      // ck_tsl_reason_required wants one on a cancellation; the bill's own
      // reason is it, and the helper falls back rather than failing the save.
      remarks: remarks ?? bill.sbCancelReason,
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
  // One batched read of the godown names the bill's lines point at, keyed by
  // gdl_id. Empty on the create/update paths, which do not resolve display
  // names — see toItemPayload.
  private async resolveGodownNames(
    items: readonly Pick<SaleBillItem, 'sbiGodownId'>[] = [],
  ): Promise<Map<string, string>> {
    const godownIds = [...new Set(items.map((item) => item.sbiGodownId))];
    if (godownIds.length === 0) {
      return new Map();
    }
    const godowns = await this.prisma.godownLocation.findMany({
      where: { gdlId: { in: godownIds } },
      select: { gdlId: true, gdlName: true },
    });
    return new Map(godowns.map((godown) => [godown.gdlId, godown.gdlName]));
  }
  private toPayload(
    record: SaleBill & {
      items?: SaleBillItemWithNames[];
      // Already shaped by ChargeDetailService / TenderDetailService — the bill
      // passes them through.
      charges?: BillChargePayload[];
      tenders?: BillTenderPayload[];
    },
    godownNameById: Map<string, string> = new Map(),
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
      items: items ? items.map((item) => this.toItemPayload(item, godownNameById)) : [],
      charges: charges ?? [],
      tenders: tenders ?? [],
    };
  }
  private toItemPayload(
    record: SaleBillItemWithNames,
    godownNameById: Map<string, string> = new Map(),
  ): BillItemPayload {
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
      sbiGodownName: godownNameById.get(record.sbiGodownId) ?? null,
    };
  }
}
