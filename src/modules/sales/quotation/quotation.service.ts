import { Injectable } from '@nestjs/common';
import { Prisma, TransactionChargeDetail, SaleQuotation, SaleQuotationItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveQuotationChargeDto } from './dto/save-quotation-charge.dto';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import { SaveQuotationItemDto } from './dto/save-quotation-item.dto';
import {
  QUOTATION_CHARGE_DOC_TYPE,
  QUOTATION_STATUS_SRC_DOC_TYPE,
  QUOTATION_STATUS_SRC_MODULE,
  QuotationChargePayload,
  QuotationErrorDetail,
  QuotationErrorResponse,
  QuotationItemPayload,
  QuotationPayload,
} from './types/quotation-api.types';
import {
  CHARGE_DETAIL_VALUE_GUARDS,
  ChargeDetailGuardedValues,
} from '../../master/charge-master/types/charge-master-api.types';
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
  TxnStatusEvent,
  appendTxnStatusLog,
} from 'src/common/txn-status-log/txn-status-log.helper';
// accounts.acc_voucher_types row "Quo" / Sales Quotation. Its numbering format
// (prefix / suffix / width / reset frequency) seeds the acc_voucher_seq row the
// quotation numbers are drawn from.
const QUOTATION_VCHR_TYPE_ID = 2;
const QUOTATION_TABLE_NAME = 'sale_quotation';
const QUOTATION_ITEM_TABLE_NAME = 'sale_quotation_item';
const QUOTATION_CHARGE_TABLE_NAME = 'txn_charge_detail';
const QUOTATION_AUDIT_SCREEN_NAME = 'Sale Quotation';
// Names the status STEP recorded on public.txn_status_log for each member of
// ck_sq_status. The constraint is still live on the column (unlike sale_bill's
// ck_sb_*, dropped in 20260731070026), so this maps a status the DB already
// validated onto the event vocabulary the trail reports on — it is not a guard.
// DRAFT is REOPENED because the only way to reach it from another status is to
// pull the quotation back for editing; a quotation CREATED as DRAFT never gets
// here (see toStatusEvent).
const QUOTATION_STATUS_EVENTS: Readonly<Record<string, TxnStatusEvent>> = {
  DRAFT: TxnStatusEvent.REOPENED,
  SENT: TxnStatusEvent.SENT,
  ACCEPTED: TxnStatusEvent.ACCEPTED,
  REJECTED: TxnStatusEvent.REJECTED,
  EXPIRED: TxnStatusEvent.EXPIRED,
  CONVERTED: TxnStatusEvent.CONVERTED,
  CANCELLED: TxnStatusEvent.CANCELLED,
};
// tsl_to_status on the delete step. Unlike a bill, deleting a quotation does NOT
// move sq_status — so the trail says the document left play without claiming the
// column says something it does not.
const QUOTATION_DELETED_STATUS = 'DELETED';
const QUOTATION_DELETE_REASON = 'Quotation deleted';
const QUOTATION_OPTIONAL_FIELDS = [
  'sqSessionId',
  'sqCategoryId',
  'sqDocType',
  'sqUsrRefno',
  'sqQuoteDate',
  'sqQuoteDatetime',
  'sqValidUntil',
  'sqValidityDays',
  'sqRevisionNo',
  // sqParentQuoteId / sqParentAccYear are deliberately absent: they are a pair
  // (ck_sq_parent_pair) and applyParentRevision owns both.
  'sqSrcDocType',
  'sqSrcDocId',
  'sqSrcDocRefno',
  'sqSrcDocDate',
  'sqCustId',
  'sqCustAreaId',
  'sqCustAddr',
  'sqCustPlace',
  'sqCustPhone',
  'sqCustEmail',
  'sqCustGstin',
  'sqCustGstType',
  'sqCustStcd',
  'sqPosStcd',
  'sqStateName',
  'sqContactPerson',
  'sqContactPhone',
  'sqHasLoad',
  'sqHasUnload',
  'sqHasFreight',
  'sqHasPromo',
  'sqHasComm',
  'sqSalesmanId',
  'sqAgentId',
  'sqTotItems',
  'sqTotWeight',
  'sqTotBags',
  'sqGrossAmt',
  'sqItemDisc',
  'sqSplDisc',
  'sqSchDisc',
  'sqBillSchDisc',
  'sqAddlDisc1',
  'sqAddlDisc2',
  'sqTaxableAmt',
  'sqCgstAmt',
  'sqSgstAmt',
  'sqIgstAmt',
  'sqCessAmt',
  'sqTaxAmt',
  'sqFreightAmt',
  'sqLoadAmt',
  'sqUnloadAmt',
  'sqOtherAmt1',
  'sqOtherAmt2',
  'sqRoundOff',
  'sqQuoteAmt',
  'sqTotalCost',
  'sqMarginAmt',
  'sqMarginPerc',
  'sqPaymentTerms',
  'sqDeliveryTerms',
  'sqTermsConditions',
  'sqStatus',
  'sqSentOn',
  'sqAcceptedOn',
  'sqRejectedOn',
  'sqRejectReason',
  'sqConvertedDocType',
  'sqConvertedDocId',
  'sqConvertedOn',
  'sqApprovedOn',
  'sqApprovedBy',
  'sqCancelledOn',
  'sqCancelledBy',
  'sqCancelReason',
  'sqMrpSavings',
  'sqMrpSavingsPerc',
  'sqPrintCount',
  'sqDeviceType',
  'sqDeviceId',
  'sqRemarks',
  'sqFreightCalcType',
  'sqLoadingCalcType',
  'sqDiscAlterBase',
];
// Line-item fields copied straight through when present on the payload. The
// scope keys (quote/company/branch/tenant/accYear/lineNo/priceLevel) are set
// explicitly from the parent, so they are intentionally excluded here.
const QUOTATION_ITEM_OPTIONAL_FIELDS = [
  'sqiSrcDocType',
  'sqiSrcItemId',
  'sqiSrcUnitId',
  'sqiSrcDocRefno',
  'sqiSrcItemQty',
  'sqiHsnCode',
  'sqiEanCode',
  'sqiBatchNo',
  'sqiBatchDate',
  'sqiExpiryDate',
  'sqiIsTaxIncl',
  'sqiIsPromo',
  'sqiIsFree',
  'sqiFreeType',
  'sqiIsService',
  'sqiCaseQty',
  'sqiBillQty',
  'sqiLengthQty',
  'sqiNetQty',
  'sqiWeightQty',
  'sqiAvailableStock',
  'sqiRate',
  'sqiRatePreTax',
  'sqiItemDiscPerc',
  'sqiItemDiscQty',
  'sqiItemDiscAmt',
  'sqiSplDiscPerc',
  'sqiSplDiscQty',
  'sqiSplDiscAmt',
  'sqiSchDiscPerc',
  'sqiSchDiscQty',
  'sqiSchDiscAmt',
  'sqiBillSchPerc',
  'sqiBillSchQty',
  'sqiBillSchAmt',
  'sqiAddlDisc1Perc',
  'sqiAddlDisc1Amt',
  'sqiAddlDisc2Perc',
  'sqiAddlDisc2Amt',
  'sqiCashDiscPerc',
  'sqiCashDiscAmt',
  'sqiGrossAmt',
  'sqiTaxableAmt',
  'sqiTaxPerc',
  'sqiTaxAmt',
  'sqiCgstPerc',
  'sqiCgstAmt',
  'sqiSgstPerc',
  'sqiSgstAmt',
  'sqiIgstPerc',
  'sqiIgstAmt',
  'sqiCessPerc',
  'sqiCessPerUnit',
  'sqiCessAmt',
  'sqiAcessPerc',
  'sqiAcessPerUnit',
  'sqiAcessAmt',
  'sqiFreightQty',
  'sqiFreightAmt',
  'sqiLoadQty',
  'sqiLoadAmt',
  'sqiUnloadQty',
  'sqiUnloadAmt',
  'sqiRoundOff',
  'sqiNetAmt',
  'sqiCostPrice',
  'sqiMaxPrice',
  'sqiMinPrice',
  'sqiActPrice',
  'sqiQuotePrice',
  'sqiItemProfit',
  'sqiCostPreTax',
  'sqiQuotePreTax',
  'sqiProfitPreTax',
  'sqiMrpSavings',
  'sqiMrpSavingsPerc',
  'sqiSchemeId',
  'sqiSchemeName',
  'sqiRemarks',
  'sqiNetGross',
  'sqiChrgBeforeTax',
  'sqiChrgAfterTax',
  'sqiToBaseFactor',
  'sqiRateDiff',
  'sqiHasFreight',
  'sqiItemSize',
];
// Charge-line fields copied straight through when present on the payload. The
// scope keys (docType/docId/comp/branch/accYear/slno) and the two required
// references (cdChgId / cdLedgerCode) are set explicitly, so they are
// intentionally excluded here.
const QUOTATION_CHARGE_OPTIONAL_FIELDS = [
  'cdChgName',
  'cdRole',
  'cdMethod',
  'cdType',
  'cdApplyOn',
  'cdLandingCost',
  'cdCostAlloc',
  'cdBeforeTax',
  'cdTaxApl',
  'cdSepPost',
  'cdUnit',
  'cdQtyVal',
  'cdWeight',
  'cdRate',
  'cdAmount',
  'cdTaxCode',
  'cdHsn',
  'cdTaxPerc',
  'cdTaxAmt',
  'cdSgstPerc',
  'cdSgstAmt',
  'cdCgstPerc',
  'cdCgstAmt',
  'cdIgstPerc',
  'cdIgstAmt',
  'cdCessPerc',
  'cdCessAmt',
  'cdNetAmt',
  'cdRemarks',
  'cdIsActive',
];
// Every date / timestamptz column reachable from the payload. JSON carries them
// as ISO strings, Prisma wants Date objects, so each one is converted on the way
// in (and a malformed value comes back as a 400 naming the field).
const QUOTATION_DATE_FIELDS = [
  'sqQuoteDate',
  'sqQuoteDatetime',
  'sqValidUntil',
  'sqSrcDocDate',
  'sqSentOn',
  'sqAcceptedOn',
  'sqRejectedOn',
  'sqConvertedOn',
  'sqApprovedOn',
  'sqCancelledOn',
];
const QUOTATION_ITEM_DATE_FIELDS = ['sqiBatchDate', 'sqiExpiryDate'];
function toDateOrNull(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const dateValue = new Date(value as string);
  if (Number.isNaN(dateValue.getTime())) {
    throwSalesBadRequest<QuotationErrorDetail, QuotationErrorResponse>('Validation failed', [
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
const QUOTATION_DATE_TRANSFORMS = buildDateTransforms(QUOTATION_DATE_FIELDS);
const QUOTATION_ITEM_DATE_TRANSFORMS = buildDateTransforms(QUOTATION_ITEM_DATE_FIELDS);
// The immutable scope inherited by every line from its parent quotation.
interface QuotationScope {
  sqId: string;
  sqCompanyId: string;
  sqBranchId: string;
  sqTenantId: string | null;
  sqAccYear: string;
  sqPriceLevel: number;
  sqQuoteSlno: bigint;
}
type QuotationWriteClient = SalesWriteClient;
// The unique indexes a quotation write can trip, besides ux_sq_quote_no on the
// reference number. Postgres names the offending index and Prisma passes that
// name through as P2002 meta.target, which is the only way to tell them apart —
// see describeDuplicate below.
const QUOTATION_SLNO_INDEX = 'ux_sq_slno';
const QUOTATION_ITEM_LINE_INDEX = 'ux_sqi_quote_line';
// P2002's meta.target is the index name on Postgres, but an array of column
// names on other connectors — both are flattened to one searchable string.
function uniqueConstraintTarget(error: unknown): string {
  const target = (error as { meta?: { target?: unknown } } | null)?.meta?.target;
  if (Array.isArray(target)) {
    return target.join(',');
  }
  return typeof target === 'string' ? target : '';
}
// Only populated when the item was fetched with the item/unit joins (getById);
// create/update paths pass plain SaleQuotationItem rows where these are absent.
type SaleQuotationItemWithNames = SaleQuotationItem & {
  item?: {
    itemNameEn: string;
    itemBatchConfig: number;
    itemGroupId: string;
    itemBrandId: string | null;
    itemSectionId: string | null;
    itemCategoryId: string | null;
  } | null;
  itemUnitConversion?: { unit: { unit_name: string; unit_decimal_count: number } } | null;
};
// Same idea for the header's master ids: custArea/salesman come from the
// getById joins, `agent` from the extra lookup below (sq_agent_id has no FK).
// Absent on the create/update paths, which pass a plain SaleQuotation row.
type SaleQuotationWithNames = SaleQuotation & {
  custArea?: { armName: string; armDistanceKm: number | null } | null;
  salesman?: { empName: string } | null;
  agent?: { saName: string } | null;
};
@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveQuotationDto: SaveQuotationDto): Promise<QuotationPayload> {
    if (saveQuotationDto.sqId) {
      return this.updateQuotation(saveQuotationDto);
    }
    return this.createQuotation(saveQuotationDto);
  }
  async getById(
    sqId: string,
    sqCompanyId: string,
    sqBranchId: string,
    sqAccYear: string,
  ): Promise<QuotationPayload> {
    const record = await this.prisma.saleQuotation.findFirst({
      where: {
        sqId,
        sqCompanyId,
        sqBranchId,
        sqAccYear,
        sqIsDeleted: false,
      },
      include: {
        items: {
          where: { sqiIsDeleted: false },
          orderBy: { sqiLineNo: 'asc' },
          include: {
            item: {
              select: {
                itemNameEn: true,
                itemBatchConfig: true,
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
        custArea: { select: { armName: true, armDistanceKm: true } },
        salesman: { select: { empName: true } },
      },
    });
    if (!record) {
      throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
        'Quotation not found',
        'sqId',
        `No active quotation found with id ${sqId}`,
      );
    }
    // txn_charge_detail is polymorphic (no FK to sale_quotation), so the
    // applied charges are fetched by discriminator rather than by `include`.
    const charges = await this.findCharges(this.prisma, sqId);
    const agent = await this.findAgent(record.sqAgentId);
    return this.toPayload({ ...record, charges, agent });
  }
  async softDelete(
    sqId: string,
    sqCompanyId: string,
    sqBranchId: string,
    sqAccYear: string,
  ): Promise<{ sqId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleQuotation.findFirst({
        where: {
          sqId,
          sqCompanyId,
          sqBranchId,
          sqAccYear,
          sqIsDeleted: false,
        },
      });
      if (!existing) {
        throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
          'Quotation not found',
          'sqId',
          `No active quotation found with id ${sqId}`,
        );
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const result = await tx.saleQuotation.updateMany({
        where: {
          sqId,
          sqCompanyId,
          sqBranchId,
          sqAccYear,
          sqIsDeleted: false,
        },
        data: {
          sqIsDeleted: true,
          sqModifiedOn: modifiedOn,
          sqModifiedBy: actor,
        },
      });
      if (result.count === 0) {
        throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
          'Quotation not found',
          'sqId',
          `No active quotation found with id ${sqId}`,
        );
      }
      // Cascade the soft delete to the quotation's line items so no line stays
      // active while the header is logically deleted.
      await tx.saleQuotationItem.updateMany({
        where: {
          sqiQuoteId: sqId,
          // A line always carries its header's year, so naming it here keeps
          // the write inside the one partition instead of scanning them all.
          sqiAccYear: sqAccYear,
          sqiIsDeleted: false,
        },
        data: {
          sqiIsDeleted: true,
          sqiModifiedOn: modifiedOn,
          sqiModifiedBy: actor,
        },
      });
      // Same cascade for the applied charges — an active charge line must never
      // outlive the document it was charged on.
      await tx.transactionChargeDetail.updateMany({
        where: {
          cdDocType: QUOTATION_CHARGE_DOC_TYPE,
          cdDocId: sqId,
          cdIsDeleted: false,
        },
        data: {
          cdIsDeleted: true,
          cdModifiedOn: modifiedOn,
          cdModifiedBy: actor,
        },
      });
      // Closes the quotation's status trail. Deleting one does NOT move
      // sq_status the way deleting a bill does, so the step is logged as DELETED
      // rather than claiming a CANCELLED the column never took.
      await this.logStatusStep(
        tx,
        existing,
        {
          event: TxnStatusEvent.DELETED,
          fromStatus: existing.sqStatus,
          toStatus: QUOTATION_DELETED_STATUS,
          remarks: existing.sqCancelReason ?? QUOTATION_DELETE_REASON,
        },
        actor,
        modifiedOn,
      );
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        sqIsDeleted: true,
        sqModifiedOn: modifiedOn,
        sqModifiedBy: actor,
      });
      await this.auditLogService.logEntityChange(
        {
          // A soft delete is logged as 'cancel', the way every other module logs
          // one: audit.audit_log_action has no 'delete' member, so
          // AuditLogService.normalizeAction answers 400 for it.
          action: 'cancel',
          tableName: QUOTATION_TABLE_NAME,
          screenName: QUOTATION_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: sqId,
          displayName: existing.sqQuoteRefno || sqId,
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: 'Quotation soft deleted',
        },
        tx,
      );
      return {
        sqId,
        deleted: true,
      };
    });
  }
  private async createQuotation(saveQuotationDto: SaveQuotationDto): Promise<QuotationPayload> {
    const normalizedCustName = normalizeRequiredText<QuotationErrorDetail, QuotationErrorResponse>(
      saveQuotationDto.sqCustName ?? '',
      'sqCustName',
    );
    const now = new Date();
    const createdBy = resolveActor(
      saveQuotationDto.sqCreatedBy,
      this.requestContextService.getUserId(),
    );
    const quoteDate = saveQuotationDto.sqQuoteDate ? new Date(saveQuotationDto.sqQuoteDate) : now;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Voucher type 21 numbers the document: the running number consumed from
        // accounts.acc_voucher_seq becomes sqQuoteSlno and its printable form
        // becomes sqQuoteRefno. Both are server-assigned — the voucher type is
        // AUTO-numbered with manual numbers disallowed, so whatever the client
        // sent for either field is ignored.
        const quoteNumber = await allocateVoucherNumber(tx, {
          vchrTypeId: QUOTATION_VCHR_TYPE_ID,
          companyId: saveQuotationDto.sqCompanyId,
          branchId: saveQuotationDto.sqBranchId,
          accYear: saveQuotationDto.sqAccYear,
          documentDate: quoteDate,
        });
        const data: Prisma.SaleQuotationUncheckedCreateInput = {
          sqCompanyId: saveQuotationDto.sqCompanyId,
          sqBranchId: saveQuotationDto.sqBranchId,
          sqTenantId: saveQuotationDto.sqTenantId,
          sqAccYear: saveQuotationDto.sqAccYear,
          sqPriceLevel: saveQuotationDto.sqPriceLevel,
          sqQuoteSlno: quoteNumber.lastNo,
          sqQuoteRefno: quoteNumber.refno,
          sqQuoteDate: quoteDate,
          sqCustName: normalizedCustName,
          sqUserId: saveQuotationDto.sqUserId,
          sqCreatedOn: now,
          sqCreatedBy: createdBy,
          sqStatus: saveQuotationDto.sqStatus || 'DRAFT',
        };
        this.applyOptionalFields(data, saveQuotationDto);
        this.applyParentRevision(data, saveQuotationDto, saveQuotationDto.sqAccYear);
        data.sqCustName = normalizedCustName;
        data.sqQuoteDate = quoteDate;
        const created = await tx.saleQuotation.create({ data });
        const scope: QuotationScope = {
          sqId: created.sqId,
          sqCompanyId: created.sqCompanyId,
          sqBranchId: created.sqBranchId,
          sqTenantId: created.sqTenantId,
          sqAccYear: created.sqAccYear,
          sqPriceLevel: created.sqPriceLevel,
          sqQuoteSlno: created.sqQuoteSlno,
        };
        const items = await this.syncItems(tx, scope, saveQuotationDto.items, createdBy);
        const charges = await this.syncCharges(tx, scope, saveQuotationDto.charges, createdBy);
        // Opens the quotation's status trail: from nothing to whatever it was
        // created as (DRAFT unless the payload said otherwise).
        await this.logStatusStep(
          tx,
          created,
          {
            event: this.toStatusEvent(null, created.sqStatus),
            fromStatus: null,
            toStatus: created.sqStatus,
          },
          createdBy,
          now,
        );
        const payload = this.toPayload({ ...created, items, charges });
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: QUOTATION_TABLE_NAME,
            screenName: QUOTATION_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: payload.sqId,
            displayName: payload.sqQuoteRefno || payload.sqId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Quotation created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      const duplicate = await this.describeDuplicate(error);
      throwOnUniqueConstraintError<QuotationErrorDetail, QuotationErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  private async updateQuotation(saveQuotationDto: SaveQuotationDto): Promise<QuotationPayload> {
    const sqId = saveQuotationDto.sqId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleQuotation.findFirst({
          where: {
            sqId,
            sqIsDeleted: false,
          },
        });
        if (!existing) {
          throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
            'Quotation not found',
            'sqId',
            `No active quotation found with id ${sqId}`,
          );
        }
        const now = new Date();
        const modifiedBy = resolveActor(
          saveQuotationDto.sqModifiedBy,
          this.requestContextService.getUserId(),
        );
        const data: Prisma.SaleQuotationUncheckedUpdateInput = {
          sqModifiedOn: now,
          sqModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveQuotationDto);
        this.applyParentRevision(data, saveQuotationDto, existing.sqAccYear);
        // `sqCustName` is required on create, so it is not in the optional
        // allowlist `applyOptionalFields` copies from — which left an update
        // silently discarding a renamed customer while still answering 201.
        // Applied here with the same normalization create uses, and only when
        // the client actually sent the field, so an omitted one is left as-is
        // like every other absent field.
        if (saveQuotationDto.sqCustName !== undefined) {
          data.sqCustName = normalizeRequiredText<QuotationErrorDetail, QuotationErrorResponse>(
            saveQuotationDto.sqCustName,
            'sqCustName',
          );
        }
        // sale_quotation is partitioned by sq_acc_year, so its primary key —
        // and every unique lookup — is the (id, year) pair. The year comes
        // from the stored row, never from the payload: a save must not be able
        // to aim an update at a different partition than the one it read.
        const updated = await tx.saleQuotation.update({
          where: { sqId_sqAccYear: { sqId, sqAccYear: existing.sqAccYear } },
          data,
        });
        const scope: QuotationScope = {
          sqId: updated.sqId,
          sqCompanyId: updated.sqCompanyId,
          sqBranchId: updated.sqBranchId,
          sqTenantId: updated.sqTenantId,
          sqAccYear: updated.sqAccYear,
          sqPriceLevel: updated.sqPriceLevel,
          sqQuoteSlno: updated.sqQuoteSlno,
        };
        const items = await this.syncItems(tx, scope, saveQuotationDto.items, modifiedBy);
        const charges = await this.syncCharges(tx, scope, saveQuotationDto.charges, modifiedBy);
        // A status STEP, not the save itself: an edit that leaves sqStatus alone
        // adds no row to the trail.
        if (updated.sqStatus !== existing.sqStatus) {
          await this.logStatusStep(
            tx,
            updated,
            {
              event: this.toStatusEvent(existing.sqStatus, updated.sqStatus),
              fromStatus: existing.sqStatus,
              toStatus: updated.sqStatus,
            },
            modifiedBy,
            now,
          );
        }
        const payload = this.toPayload({ ...updated, items, charges });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: QUOTATION_TABLE_NAME,
            screenName: QUOTATION_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: sqId,
            displayName: payload.sqQuoteRefno || payload.sqId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.sqModifiedBy || payload.sqCreatedBy,
            notes: 'Quotation updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      const duplicate = await this.describeDuplicate(error);
      throwOnUniqueConstraintError<QuotationErrorDetail, QuotationErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  // Reconciles the quotation's line items with the payload array:
  //   - a line carrying sqiId updates that existing line
  //   - a line without sqiId is created
  //   - an existing line absent from the array is soft deleted
  // Passing `undefined` (property omitted) leaves the current lines untouched.
  //
  // Order matters, and it is the reason the payload is resolved and validated in
  // full before the first write: ux_sqi_quote_line is unique on
  // (sqi_quote_id, sqi_line_no) over the ACTIVE lines only, so which rows are
  // still active when an insert lands decides whether Postgres rejects it. A
  // client re-posting its grid without sqiId used to insert line 1 while the old
  // line 1 was still active — the update failed with a duplicate-key error that
  // surfaced as a 409 about the quotation reference number.
  private async syncItems(
    tx: QuotationWriteClient,
    scope: QuotationScope,
    inputItems: SaveQuotationItemDto[] | undefined,
    actorId: string,
  ): Promise<SaleQuotationItem[]> {
    const existing = await tx.saleQuotationItem.findMany({
      where: { sqiQuoteId: scope.sqId, sqiAccYear: scope.sqAccYear, sqiIsDeleted: false },
      orderBy: { sqiLineNo: 'asc' },
    });
    if (inputItems === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((item) => [item.sqiId, item]));
    const now = new Date();
    // Line numbers first: an entry keeps the number it sent, otherwise it takes
    // its position in the array.
    const resolvedItems = inputItems.map((inputItem, index) => ({
      inputItem,
      lineNo: inputItem.sqiLineNo ?? index + 1,
    }));
    const seenLineNos = new Set<number>();
    const keptIds = new Set<string>();
    for (const { inputItem, lineNo } of resolvedItems) {
      if (seenLineNos.has(lineNo)) {
        throwSalesConflict<QuotationErrorDetail, QuotationErrorResponse>(
          'Duplicate quotation line number is not allowed',
          [
            {
              field: 'sqiLineNo',
              message: `A quotation line already exists with line number ${lineNo}`,
            },
          ],
        );
      }
      seenLineNos.add(lineNo);
      if (inputItem.sqiId) {
        if (!existingMap.has(inputItem.sqiId)) {
          throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
            'Quotation item not found',
            'sqiId',
            `No active quotation line found with id ${inputItem.sqiId} on this quotation`,
          );
        }
        keptIds.add(inputItem.sqiId);
      }
    }
    // Retire the lines the payload dropped before inserting anything: leaving
    // them active would hold their line numbers against the replacements.
    await this.softDeleteItems(
      tx,
      existing.filter((item) => !keptIds.has(item.sqiId)),
      actorId,
      now,
    );
    // The surviving lines can still be in each other's way when the payload
    // reorders them (1↔2 renumbers through a state where both rows want 2), so
    // they are parked above every number the payload asks for and renumbered
    // down from there. Skipped when no survivor changes number, which is the
    // usual edit.
    const reordersItems = resolvedItems.some(
      ({ inputItem, lineNo }) =>
        inputItem.sqiId !== undefined && existingMap.get(inputItem.sqiId)?.sqiLineNo !== lineNo,
    );
    if (reordersItems && keptIds.size > 0) {
      await tx.saleQuotationItem.updateMany({
        where: { sqiId: { in: [...keptIds] }, sqiAccYear: scope.sqAccYear },
        data: { sqiLineNo: { increment: Math.max(...seenLineNos) + 1 } },
      });
    }
    const persisted: SaleQuotationItem[] = [];
    for (const { inputItem, lineNo } of resolvedItems) {
      if (inputItem.sqiId) {
        // Present — the validation pass above already rejected an id that is not
        // an active line on this quotation.
        const existingItem = existingMap.get(inputItem.sqiId)!;
        const updateData: Prisma.SaleQuotationItemUncheckedUpdateInput = {
          sqiLineNo: lineNo,
          sqiItemId: inputItem.sqiItemId ?? existingItem.sqiItemId,
          sqiItemUnitId: inputItem.sqiItemUnitId ?? existingItem.sqiItemUnitId,
          sqiPriceLevel: inputItem.sqiPriceLevel ?? scope.sqPriceLevel,
          sqiModifiedOn: now,
          sqiModifiedBy: resolveActor(inputItem.sqiModifiedBy, actorId),
        };
        applyPresentFields(
          updateData,
          inputItem,
          QUOTATION_ITEM_OPTIONAL_FIELDS,
          QUOTATION_ITEM_DATE_TRANSFORMS,
        );
        const updated = await tx.saleQuotationItem.update({
          where: {
            sqiId_sqiAccYear: { sqiId: inputItem.sqiId, sqiAccYear: existingItem.sqiAccYear },
          },
          data: updateData,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: QUOTATION_ITEM_TABLE_NAME,
            screenName: QUOTATION_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.sqiId,
            displayName: `Line ${updated.sqiLineNo}`,
            originalRecord: this.toItemPayload(existingItem),
            modifiedRecord: this.toItemPayload(updated),
            userId: resolveActor(inputItem.sqiModifiedBy, actorId),
            notes: 'Quotation item updated',
          },
          tx,
        );
        persisted.push(updated);
        continue;
      }
      const createData: Prisma.SaleQuotationItemUncheckedCreateInput = {
        sqiQuoteId: scope.sqId,
        sqiCompanyId: inputItem.sqiCompanyId ?? scope.sqCompanyId,
        sqiBranchId: inputItem.sqiBranchId ?? scope.sqBranchId,
        sqiTenantId: inputItem.sqiTenantId ?? scope.sqTenantId,
        // Taken from the header, not the payload: sqi_acc_year is the line's
        // partition key and the second half of fk_sqi_quote, so a line that
        // disagrees with its header cannot be stored at all.
        sqiAccYear: scope.sqAccYear,
        sqiLineNo: lineNo,
        sqiItemId: this.requireItemField(inputItem.sqiItemId, 'sqiItemId'),
        sqiItemUnitId: this.requireItemField(inputItem.sqiItemUnitId, 'sqiItemUnitId'),
        sqiPriceLevel: inputItem.sqiPriceLevel ?? scope.sqPriceLevel,
        sqiCreatedOn: now,
        sqiCreatedBy: resolveActor(inputItem.sqiCreatedBy, actorId),
      };
      applyPresentFields(
        createData,
        inputItem,
        QUOTATION_ITEM_OPTIONAL_FIELDS,
        QUOTATION_ITEM_DATE_TRANSFORMS,
      );
      const created = await tx.saleQuotationItem.create({ data: createData });
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: QUOTATION_ITEM_TABLE_NAME,
          screenName: QUOTATION_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: created.sqiId,
          displayName: `Line ${created.sqiLineNo}`,
          originalRecord: null,
          modifiedRecord: this.toItemPayload(created),
          userId: created.sqiCreatedBy,
          notes: 'Quotation item created',
        },
        tx,
      );
      persisted.push(created);
    }
    return persisted.sort((left, right) => left.sqiLineNo - right.sqiLineNo);
  }
  // Retires the lines the payload no longer carries. Called before the payload
  // is written so the freed line numbers are available to the replacements.
  private async softDeleteItems(
    tx: QuotationWriteClient,
    removed: SaleQuotationItem[],
    actorId: string,
    now: Date,
  ): Promise<void> {
    for (const removedItem of removed) {
      const deleted = await tx.saleQuotationItem.update({
        where: {
          sqiId_sqiAccYear: { sqiId: removedItem.sqiId, sqiAccYear: removedItem.sqiAccYear },
        },
        data: {
          sqiIsDeleted: true,
          sqiModifiedOn: now,
          sqiModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: QUOTATION_ITEM_TABLE_NAME,
          screenName: QUOTATION_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: deleted.sqiId,
          displayName: `Line ${removedItem.sqiLineNo}`,
          originalRecord: this.toItemPayload(removedItem),
          modifiedRecord: this.toItemPayload(deleted),
          userId: actorId,
          notes: 'Quotation item soft deleted',
        },
        tx,
      );
    }
  }
  // Resolves the index Postgres blamed to the name this module knows it by.
  // Both quotation tables are partitioned, so a violation is reported against
  // the PARTITION's index, whose name is auto-generated, truncated to 63 chars
  // and positional — ux_sq_quote_no and ux_sq_slno come back as
  // `sale_quotation_2026_2027_sq_company_id_sq_branch_id_sq_acc__idx` and
  // `..._sq_acc_idx1`, telling apart only by a trailing digit that depends on
  // the order the indexes happened to be created in. pg_inherits maps the
  // child index back to its parent, which is stable. Falls back to the
  // reported name (an unpartitioned table, or a connector that reports column
  // names instead) and to the refno branch below if the lookup fails.
  private async resolveDuplicateIndex(error: unknown): Promise<string> {
    const reported = uniqueConstraintTarget(error);
    if (!reported) {
      return '';
    }
    try {
      const rows = await this.prisma.$queryRaw<{ parentIndex: string }[]>`
        SELECT parent.relname AS "parentIndex"
        FROM pg_class child
        JOIN pg_inherits inh ON inh.inhrelid = child.oid
        JOIN pg_class parent ON parent.oid = inh.inhparent
        WHERE child.relname = ${reported}
      `;
      return rows[0]?.parentIndex ?? reported;
    } catch {
      return reported;
    }
  }
  // Names the duplicate a P2002 actually is. Every unique violation used to be
  // reported as a duplicate reference number, which pointed callers at the
  // voucher number — a field neither save path lets the client set and the
  // update path never rewrites — when the real clash was a line number.
  private async describeDuplicate(
    error: unknown,
  ): Promise<{ message: string; errors: QuotationErrorDetail[] }> {
    const target = await this.resolveDuplicateIndex(error);
    if (target.includes(QUOTATION_ITEM_LINE_INDEX)) {
      return {
        message: 'Duplicate quotation line number is not allowed',
        errors: [
          {
            field: 'sqiLineNo',
            message: 'Another active line on this quotation already uses this line number',
          },
        ],
      };
    }
    if (target.includes(QUOTATION_SLNO_INDEX)) {
      return {
        message: 'Quotation already exists',
        errors: [
          {
            field: 'sqQuoteSlno',
            message: 'Duplicate quotation serial number is not allowed',
          },
        ],
      };
    }
    // ux_sq_quote_no, and the fallback for a connector that reports no target.
    return {
      message: 'Quotation already exists',
      errors: [
        {
          field: 'sqQuoteRefno',
          message: 'Duplicate quotation reference number is not allowed',
        },
      ],
    };
  }
  private requireItemField(value: string | undefined, field: string): string {
    if (!value) {
      throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
        `${field} is required for a new quotation line`,
        field,
        `${field} must be provided when creating a quotation line`,
      );
    }
    return value;
  }
  // The quotation's applied charges, newest reconciliation order (cdSlno). No
  // relation exists to follow: txn_charge_detail is keyed by the
  // (cdDocType, cdDocId) discriminator pair, which is also its only index.
  private findCharges(
    client: QuotationWriteClient,
    sqId: string,
  ): Promise<TransactionChargeDetail[]> {
    return client.transactionChargeDetail.findMany({
      where: {
        cdDocType: QUOTATION_CHARGE_DOC_TYPE,
        cdDocId: sqId,
        cdIsDeleted: false,
      },
      orderBy: { cdSlno: 'asc' },
    });
  }
  // sq_agent_id carries no FK to sale_agents (see migration
  // 20260708130000_add_sale_quotation_master_fkeys), so the agent name cannot
  // come from an `include` and is looked up on its own. Soft-deleted agents are
  // still resolved: the quotation must keep displaying the agent it was raised
  // under even after that master row is retired.
  private async findAgent(saId: string | null): Promise<{ saName: string } | null> {
    if (!saId) {
      return null;
    }
    return this.prisma.saleAgent.findUnique({
      where: { saId },
      select: { saName: true },
    });
  }
  // Reconciles the quotation's applied charges with the payload array, exactly
  // as syncItems does for the line items:
  //   - a charge carrying cdId updates that existing charge line
  //   - a charge without cdId is created
  //   - an existing charge absent from the array is soft deleted
  // Passing `undefined` (property omitted) leaves the current charges untouched.
  private async syncCharges(
    tx: QuotationWriteClient,
    scope: QuotationScope,
    inputCharges: SaveQuotationChargeDto[] | undefined,
    actorId: string,
  ): Promise<TransactionChargeDetail[]> {
    const existing = await this.findCharges(tx, scope.sqId);
    if (inputCharges === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((charge) => [charge.cdId, charge]));
    const keptIds = new Set<string>();
    const seenSlnos = new Set<number>();
    const now = new Date();
    const persisted: TransactionChargeDetail[] = [];
    for (const [index, inputCharge] of inputCharges.entries()) {
      const slno = inputCharge.cdSlno ?? index + 1;
      if (seenSlnos.has(slno)) {
        throwSalesConflict<QuotationErrorDetail, QuotationErrorResponse>(
          'Duplicate quotation charge line number is not allowed',
          [
            {
              field: 'cdSlno',
              message: `A quotation charge already exists with line number ${slno}`,
            },
          ],
        );
      }
      seenSlnos.add(slno);
      const existingCharge = inputCharge.cdId ? existingMap.get(inputCharge.cdId) : undefined;
      if (inputCharge.cdId && !existingCharge) {
        throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
          'Quotation charge not found',
          'cdId',
          `No active quotation charge found with id ${inputCharge.cdId} on this quotation`,
        );
      }
      this.ensureChargeValuesAreAllowed(inputCharge, existingCharge);
      if (existingCharge) {
        const updateData: Prisma.TransactionChargeDetailUncheckedUpdateInput = {
          cdSlno: slno,
          cdChgId: inputCharge.cdChgId ?? existingCharge.cdChgId,
          cdLedgerCode: inputCharge.cdLedgerCode ?? existingCharge.cdLedgerCode,
          cdModifiedOn: now,
          cdModifiedBy: resolveActor(inputCharge.cdModifiedBy, actorId),
        };
        applyPresentFields(updateData, inputCharge, QUOTATION_CHARGE_OPTIONAL_FIELDS);
        if (inputCharge.cdVoucherNo !== undefined) {
          updateData.cdVoucherNo = this.toVoucherNo(inputCharge.cdVoucherNo);
        }
        // txn_charge_detail is partitioned by cd_acc_year, so a charge line is
        // addressed by (cdId, cdAccYear), never by the id alone.
        const updated = await tx.transactionChargeDetail.update({
          where: {
            cdId_cdAccYear: { cdId: existingCharge.cdId, cdAccYear: existingCharge.cdAccYear },
          },
          data: updateData,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: QUOTATION_CHARGE_TABLE_NAME,
            screenName: QUOTATION_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.cdId,
            displayName: updated.cdChgName || `Charge ${updated.cdSlno ?? slno}`,
            originalRecord: this.toChargePayload(existingCharge),
            modifiedRecord: this.toChargePayload(updated),
            userId: resolveActor(inputCharge.cdModifiedBy, actorId),
            notes: 'Quotation charge updated',
          },
          tx,
        );
        keptIds.add(updated.cdId);
        persisted.push(updated);
        continue;
      }
      const createData: Prisma.TransactionChargeDetailUncheckedCreateInput = {
        cdDocType: QUOTATION_CHARGE_DOC_TYPE,
        cdDocId: scope.sqId,
        cdSlno: slno,
        cdCompId: inputCharge.cdCompId ?? scope.sqCompanyId,
        cdBranchId: inputCharge.cdBranchId ?? scope.sqBranchId,
        cdAccYear: inputCharge.cdAccYear ?? scope.sqAccYear,
        cdVoucherNo:
          inputCharge.cdVoucherNo === undefined
            ? scope.sqQuoteSlno
            : this.toVoucherNo(inputCharge.cdVoucherNo),
        cdChgId: this.requireChargeField(inputCharge.cdChgId, 'cdChgId'),
        cdLedgerCode: this.requireChargeField(inputCharge.cdLedgerCode, 'cdLedgerCode'),
        cdCreatedOn: now,
        cdCreatedBy: resolveActor(inputCharge.cdCreatedBy, actorId),
      };
      applyPresentFields(createData, inputCharge, QUOTATION_CHARGE_OPTIONAL_FIELDS);
      const created = await tx.transactionChargeDetail.create({ data: createData });
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: QUOTATION_CHARGE_TABLE_NAME,
          screenName: QUOTATION_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: created.cdId,
          displayName: created.cdChgName || `Charge ${created.cdSlno ?? slno}`,
          originalRecord: null,
          modifiedRecord: this.toChargePayload(created),
          userId: created.cdCreatedBy ?? actorId,
          notes: 'Quotation charge created',
        },
        tx,
      );
      keptIds.add(created.cdId);
      persisted.push(created);
    }
    // Any previously active charge not present in the payload is soft deleted.
    const removed = existing.filter((charge) => !keptIds.has(charge.cdId));
    for (const removedCharge of removed) {
      const deleted = await tx.transactionChargeDetail.update({
        where: {
          cdId_cdAccYear: { cdId: removedCharge.cdId, cdAccYear: removedCharge.cdAccYear },
        },
        data: {
          cdIsDeleted: true,
          cdModifiedOn: now,
          cdModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: QUOTATION_CHARGE_TABLE_NAME,
          screenName: QUOTATION_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: deleted.cdId,
          displayName: removedCharge.cdChgName || `Charge ${removedCharge.cdSlno ?? ''}`.trim(),
          originalRecord: this.toChargePayload(removedCharge),
          modifiedRecord: this.toChargePayload(deleted),
          userId: actorId,
          notes: 'Quotation charge soft deleted',
        },
        tx,
      );
    }
    return persisted.sort((left, right) => (left.cdSlno ?? 0) - (right.cdSlno ?? 0));
  }
  private requireChargeField(value: string | undefined, field: string): string {
    if (!value) {
      throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
        `${field} is required for a new quotation charge`,
        field,
        `${field} must be provided when creating a quotation charge`,
      );
    }
    return value;
  }
  // cd_voucher_no is a bigint column but JSON carries it as a number/string.
  private toVoucherNo(value: string | number | null): bigint | null {
    if (value === null || value === '') {
      return null;
    }
    return BigInt(value);
  }
  // Mirrors the DB CHECK constraints on txn_charge_detail (ck_cd_doc_type /
  // ck_cd_type / ck_cd_method / ck_cd_apply_on / ck_cd_cost_alloc, migration
  // 20260728140000, plus ck_cd_tax_apl from 20260728130000) so a bad value comes
  // back as a 400 with the offending field instead of a raw Postgres 23514.
  // cdDocType is set by the service, not the payload, so only the snapshot
  // columns are read off the request; on update the stored row supplies the
  // values the payload did not send, since the constraint judges the merged row.
  private ensureChargeValuesAreAllowed(
    inputCharge: SaveQuotationChargeDto,
    existingCharge: TransactionChargeDetail | undefined,
  ): void {
    const values: ChargeDetailGuardedValues = {
      cdDocType: QUOTATION_CHARGE_DOC_TYPE,
      cdRole: inputCharge.cdRole,
      cdMethod: inputCharge.cdMethod,
      cdType: inputCharge.cdType,
      cdApplyOn: inputCharge.cdApplyOn,
      cdCostAlloc: inputCharge.cdCostAlloc,
    };
    const details: QuotationErrorDetail[] = [];
    for (const guard of CHARGE_DETAIL_VALUE_GUARDS) {
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
    const taxApl = inputCharge.cdTaxApl ?? existingCharge?.cdTaxApl ?? false;
    const beforeTax = inputCharge.cdBeforeTax ?? existingCharge?.cdBeforeTax ?? false;
    if (taxApl && beforeTax) {
      details.push({
        field: 'cdTaxApl',
        message:
          'cdTaxApl and cdBeforeTax are mutually exclusive: a charge is either taxed at the item rate or carries its own GST',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<QuotationErrorDetail, QuotationErrorResponse>(
        'Invalid quotation charge value',
        details,
      );
    }
  }
  // One row on public.txn_status_log per status STEP — the quotation's trail is
  // the ordered set of them, and sq_status is only ever the CURRENT state.
  // Written inside the caller's transaction, so the step commits with the write
  // that caused it: a quotation that says REJECTED with nothing saying who
  // rejected it is what this prevents.
  //
  // Only a step is logged. An ordinary save that leaves sqStatus where it was
  // adds nothing here — what changed field by field is audit.audit_log's job.
  private async logStatusStep(
    tx: Prisma.TransactionClient,
    quotation: SaleQuotation,
    step: {
      event: TxnStatusEvent;
      fromStatus: string | null;
      // Normally the quotation's own sqStatus; the delete path is the exception
      // (see QUOTATION_DELETED_STATUS).
      toStatus: string;
      remarks?: string | null;
    },
    actor: string,
    changedOn: Date,
  ): Promise<void> {
    await appendTxnStatusLog(tx, {
      companyId: quotation.sqCompanyId,
      branchId: quotation.sqBranchId,
      tenantId: quotation.sqTenantId,
      // The quotation's own year, not today's: txn_status_log is partitioned by
      // it, exactly like sale_quotation.
      accYear: quotation.sqAccYear,
      srcModule: QUOTATION_STATUS_SRC_MODULE,
      srcDocType: QUOTATION_STATUS_SRC_DOC_TYPE,
      srcDocId: quotation.sqId,
      srcDocRefno: quotation.sqQuoteRefno,
      event: step.event,
      fromStatus: step.fromStatus,
      toStatus: step.toStatus,
      changedOn,
      changedBy: actor,
      // ck_tsl_reason_required wants one on a CANCELLED / REJECTED step; the
      // quotation's own reason is it, and the helper falls back rather than
      // failing the save.
      remarks: step.remarks ?? quotation.sqCancelReason,
      // Free text on the quotation (a device CODE in practice), a device_master
      // uuid on the log — the helper resolves it either way round.
      deviceId: quotation.sqDeviceId,
      sessionId: quotation.sqSessionId,
    });
  }
  // Names the step for reporting ("what was sent / accepted / lost this month"),
  // where tslToStatus alone would only say where each document ended up.
  private toStatusEvent(fromStatus: string | null, toStatus: string): TxnStatusEvent {
    if (fromStatus === null) {
      // First row of the trail. Whether the quotation was born DRAFT or was
      // saved straight into a later status is what tslToStatus says.
      return TxnStatusEvent.CREATED;
    }
    return QUOTATION_STATUS_EVENTS[toStatus] ?? TxnStatusEvent.STATUS_CHANGED;
  }
  private applyOptionalFields(
    data: Prisma.SaleQuotationUncheckedCreateInput | Prisma.SaleQuotationUncheckedUpdateInput,
    dto: SaveQuotationDto,
  ): void {
    applyPresentFields(data, dto, QUOTATION_OPTIONAL_FIELDS, QUOTATION_DATE_TRANSFORMS);
  }
  // sale_quotation is partitioned by sq_acc_year, so the revision self-link
  // (fk_sq_parent) addresses the parent's COMPOSITE key and the parent's year
  // has to travel with its id — ck_sq_parent_pair rejects one without the
  // other. A revision normally sits in the same year as the quote it revises,
  // which is what the client gets when it sends only sqParentQuoteId; a
  // cross-year parent has to name its year explicitly.
  private applyParentRevision(
    data: Prisma.SaleQuotationUncheckedCreateInput | Prisma.SaleQuotationUncheckedUpdateInput,
    dto: SaveQuotationDto,
    accYear: string,
  ): void {
    if (dto.sqParentQuoteId === undefined) {
      return;
    }
    if (dto.sqParentQuoteId === null) {
      data.sqParentQuoteId = null;
      data.sqParentAccYear = null;
      return;
    }
    data.sqParentQuoteId = dto.sqParentQuoteId;
    data.sqParentAccYear = dto.sqParentAccYear ?? accYear;
  }
  private toPayload(
    record: SaleQuotationWithNames & {
      items?: SaleQuotationItemWithNames[];
      charges?: TransactionChargeDetail[];
    },
  ): QuotationPayload {
    const {
      sqCreatedOn,
      sqModifiedOn,
      sqQuoteDatetime,
      sqSyncDate,
      sqQuoteSlno,
      items,
      charges,
      custArea,
      salesman,
      agent,
      ...rest
    } = record;
    return {
      ...rest,
      sqCustAreaName: custArea?.armName ?? null,
      sqCustAreaDistanceKm: custArea?.armDistanceKm ?? null,
      sqSalesmanName: salesman?.empName ?? null,
      sqAgentName: agent?.saName ?? null,
      sqCreatedOn: sqCreatedOn?.toISOString(),
      sqModifiedOn: sqModifiedOn?.toISOString() ?? null,
      sqQuoteDatetime: sqQuoteDatetime?.toISOString(),
      sqSyncDate: sqSyncDate?.toISOString() ?? null,
      // bigint column — stringified here for the same reason cdVoucherNo is:
      // JSON has no bigint and res.json() throws on one.
      sqQuoteSlno: sqQuoteSlno.toString(),
      items: items ? items.map((item) => this.toItemPayload(item)) : [],
      charges: charges ? charges.map((charge) => this.toChargePayload(charge)) : [],
    };
  }
  private toChargePayload(record: TransactionChargeDetail): QuotationChargePayload {
    const { cdCreatedOn, cdModifiedOn, cdSyncDate, cdVoucherNo, ...rest } = record;
    return {
      ...rest,
      cdCreatedOn: cdCreatedOn?.toISOString(),
      cdModifiedOn: cdModifiedOn?.toISOString() ?? null,
      cdSyncDate: cdSyncDate?.toISOString() ?? null,
      cdVoucherNo: cdVoucherNo?.toString() ?? null,
    };
  }
  private toItemPayload(record: SaleQuotationItemWithNames): QuotationItemPayload {
    const { sqiCreatedOn, sqiModifiedOn, sqiSyncDate, item, itemUnitConversion, ...rest } = record;
    return {
      ...rest,
      sqiCreatedOn: sqiCreatedOn?.toISOString(),
      sqiModifiedOn: sqiModifiedOn?.toISOString() ?? null,
      sqiSyncDate: sqiSyncDate?.toISOString() ?? null,
      sqiItemName: item?.itemNameEn ?? null,
      sqiUnitName: itemUnitConversion?.unit.unit_name ?? null,
      sqiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
      sqiBatchConfig: item?.itemBatchConfig ?? null,
      sqiGroupId: item?.itemGroupId ?? null,
      sqiBrandId: item?.itemBrandId ?? null,
      sqiSectionId: item?.itemSectionId ?? null,
      sqiCategoryId: item?.itemCategoryId ?? null,
    };
  }
}
