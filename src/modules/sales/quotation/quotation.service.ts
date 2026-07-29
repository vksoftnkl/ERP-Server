import { Injectable } from '@nestjs/common';
import { Prisma, SaleChargeDetail, SaleQuotation, SaleQuotationItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveQuotationChargeDto } from './dto/save-quotation-charge.dto';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import { SaveQuotationItemDto } from './dto/save-quotation-item.dto';
import {
  QUOTATION_CHARGE_DOC_TYPE,
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
const QUOTATION_TABLE_NAME = 'sale_quotation';
const QUOTATION_ITEM_TABLE_NAME = 'sale_quotation_item';
const QUOTATION_CHARGE_TABLE_NAME = 'sale_charge_detail';
const QUOTATION_AUDIT_SCREEN_NAME = 'Sale Quotation';
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
  'sqParentQuoteId',
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
// Only populated when the item was fetched with the item/unit joins (getById);
// create/update paths pass plain SaleQuotationItem rows where these are absent.
type SaleQuotationItemWithNames = SaleQuotationItem & {
  item?: { itemNameEn: string } | null;
  itemUnitConversion?: { unit: { unit_name: string } } | null;
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
            item: { select: { itemNameEn: true } },
            itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
          },
        },
      },
    });
    if (!record) {
      throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
        'Quotation not found',
        'sqId',
        `No active quotation found with id ${sqId}`,
      );
    }
    // sale_charge_detail is polymorphic (no FK to sale_quotation), so the
    // applied charges are fetched by discriminator rather than by `include`.
    const charges = await this.findCharges(this.prisma, sqId);
    return this.toPayload({ ...record, charges });
  }
  async softDelete(sqId: string): Promise<{ sqId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
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
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const result = await tx.saleQuotation.updateMany({
        where: {
          sqId,
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
      await tx.saleChargeDetail.updateMany({
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
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        sqIsDeleted: true,
        sqModifiedOn: modifiedOn,
        sqModifiedBy: actor,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'delete',
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
    const normalizedRefno = normalizeRequiredText<QuotationErrorDetail, QuotationErrorResponse>(
      saveQuotationDto.sqQuoteRefno ?? '',
      'sqQuoteRefno',
    );
    const now = new Date();
    const createdBy = resolveActor(
      saveQuotationDto.sqCreatedBy,
      this.requestContextService.getUserId(),
    );
    const quoteDate = saveQuotationDto.sqQuoteDate ? new Date(saveQuotationDto.sqQuoteDate) : now;
    const data: Prisma.SaleQuotationUncheckedCreateInput = {
      sqCompanyId: saveQuotationDto.sqCompanyId,
      sqBranchId: saveQuotationDto.sqBranchId,
      sqTenantId: saveQuotationDto.sqTenantId,
      sqAccYear: saveQuotationDto.sqAccYear,
      sqPriceLevel: saveQuotationDto.sqPriceLevel,
      sqQuoteSlno: saveQuotationDto.sqQuoteSlno,
      sqQuoteRefno: normalizedRefno,
      sqQuoteDate: quoteDate,
      sqCustName: normalizedCustName,
      sqUserId: saveQuotationDto.sqUserId,
      sqCreatedOn: now,
      sqCreatedBy: createdBy,
      sqStatus: saveQuotationDto.sqStatus || 'DRAFT',
    };
    this.applyOptionalFields(data, saveQuotationDto);
    data.sqCustName = normalizedCustName;
    data.sqQuoteRefno = normalizedRefno;
    data.sqQuoteDate = quoteDate;
    try {
      return await this.prisma.$transaction(async (tx) => {
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
      throwOnUniqueConstraintError<QuotationErrorDetail, QuotationErrorResponse>(
        error,
        'Quotation already exists',
        [
          {
            field: 'sqQuoteRefno',
            message: 'Duplicate quotation reference number is not allowed',
          },
        ],
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
        const updated = await tx.saleQuotation.update({
          where: { sqId },
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
      throwOnUniqueConstraintError<QuotationErrorDetail, QuotationErrorResponse>(
        error,
        'Quotation already exists',
        [
          {
            field: 'sqQuoteRefno',
            message: 'Duplicate quotation reference number is not allowed',
          },
        ],
      );
      throw error;
    }
  }
  // Reconciles the quotation's line items with the payload array:
  //   - a line carrying sqiId updates that existing line
  //   - a line without sqiId is created
  //   - an existing line absent from the array is soft deleted
  // Passing `undefined` (property omitted) leaves the current lines untouched.
  private async syncItems(
    tx: QuotationWriteClient,
    scope: QuotationScope,
    inputItems: SaveQuotationItemDto[] | undefined,
    actorId: string,
  ): Promise<SaleQuotationItem[]> {
    const existing = await tx.saleQuotationItem.findMany({
      where: { sqiQuoteId: scope.sqId, sqiIsDeleted: false },
      orderBy: { sqiLineNo: 'asc' },
    });
    if (inputItems === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((item) => [item.sqiId, item]));
    const keptIds = new Set<string>();
    const seenLineNos = new Set<number>();
    const now = new Date();
    const persisted: SaleQuotationItem[] = [];
    for (const [index, inputItem] of inputItems.entries()) {
      const lineNo = inputItem.sqiLineNo ?? index + 1;
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
        const existingItem = existingMap.get(inputItem.sqiId);
        if (!existingItem) {
          throwSalesNotFound<QuotationErrorDetail, QuotationErrorResponse>(
            'Quotation item not found',
            'sqiId',
            `No active quotation line found with id ${inputItem.sqiId} on this quotation`,
          );
        }
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
          where: { sqiId: inputItem.sqiId },
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
        keptIds.add(updated.sqiId);
        persisted.push(updated);
        continue;
      }
      const createData: Prisma.SaleQuotationItemUncheckedCreateInput = {
        sqiQuoteId: scope.sqId,
        sqiCompanyId: inputItem.sqiCompanyId ?? scope.sqCompanyId,
        sqiBranchId: inputItem.sqiBranchId ?? scope.sqBranchId,
        sqiTenantId: inputItem.sqiTenantId ?? scope.sqTenantId,
        sqiAccYear: inputItem.sqiAccYear ?? scope.sqAccYear,
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
      keptIds.add(created.sqiId);
      persisted.push(created);
    }
    // Any previously active line not present in the payload is soft deleted.
    const removed = existing.filter((item) => !keptIds.has(item.sqiId));
    for (const removedItem of removed) {
      const deleted = await tx.saleQuotationItem.update({
        where: { sqiId: removedItem.sqiId },
        data: {
          sqiIsDeleted: true,
          sqiModifiedOn: now,
          sqiModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'delete',
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
    return persisted.sort((left, right) => left.sqiLineNo - right.sqiLineNo);
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
  // relation exists to follow: sale_charge_detail is keyed by the
  // (cdDocType, cdDocId) discriminator pair, which is also its only index.
  private findCharges(client: QuotationWriteClient, sqId: string): Promise<SaleChargeDetail[]> {
    return client.saleChargeDetail.findMany({
      where: {
        cdDocType: QUOTATION_CHARGE_DOC_TYPE,
        cdDocId: sqId,
        cdIsDeleted: false,
      },
      orderBy: { cdSlno: 'asc' },
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
  ): Promise<SaleChargeDetail[]> {
    const existing = await this.findCharges(tx, scope.sqId);
    if (inputCharges === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((charge) => [charge.cdId, charge]));
    const keptIds = new Set<string>();
    const seenSlnos = new Set<number>();
    const now = new Date();
    const persisted: SaleChargeDetail[] = [];
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
        const updateData: Prisma.SaleChargeDetailUncheckedUpdateInput = {
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
        const updated = await tx.saleChargeDetail.update({
          where: { cdId: existingCharge.cdId },
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
      const createData: Prisma.SaleChargeDetailUncheckedCreateInput = {
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
      const created = await tx.saleChargeDetail.create({ data: createData });
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
      const deleted = await tx.saleChargeDetail.update({
        where: { cdId: removedCharge.cdId },
        data: {
          cdIsDeleted: true,
          cdModifiedOn: now,
          cdModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'delete',
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
  // Mirrors the DB CHECK constraints on sale_charge_detail (ck_cd_doc_type /
  // ck_cd_type / ck_cd_method / ck_cd_apply_on / ck_cd_cost_alloc, migration
  // 20260728140000, plus ck_cd_tax_apl from 20260728130000) so a bad value comes
  // back as a 400 with the offending field instead of a raw Postgres 23514.
  // cdDocType is set by the service, not the payload, so only the snapshot
  // columns are read off the request; on update the stored row supplies the
  // values the payload did not send, since the constraint judges the merged row.
  private ensureChargeValuesAreAllowed(
    inputCharge: SaveQuotationChargeDto,
    existingCharge: SaleChargeDetail | undefined,
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
  private applyOptionalFields(
    data: Prisma.SaleQuotationUncheckedCreateInput | Prisma.SaleQuotationUncheckedUpdateInput,
    dto: SaveQuotationDto,
  ): void {
    applyPresentFields(data, dto, QUOTATION_OPTIONAL_FIELDS, QUOTATION_DATE_TRANSFORMS);
  }
  private toPayload(
    record: SaleQuotation & {
      items?: SaleQuotationItemWithNames[];
      charges?: SaleChargeDetail[];
    },
  ): QuotationPayload {
    const { sqCreatedOn, sqModifiedOn, sqQuoteDatetime, sqSyncDate, items, charges, ...rest } =
      record;
    return {
      ...rest,
      sqCreatedOn: sqCreatedOn?.toISOString(),
      sqModifiedOn: sqModifiedOn?.toISOString() ?? null,
      sqQuoteDatetime: sqQuoteDatetime?.toISOString(),
      sqSyncDate: sqSyncDate?.toISOString() ?? null,
      items: items ? items.map((item) => this.toItemPayload(item)) : [],
      charges: charges ? charges.map((charge) => this.toChargePayload(charge)) : [],
    };
  }
  private toChargePayload(record: SaleChargeDetail): QuotationChargePayload {
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
    };
  }
}
