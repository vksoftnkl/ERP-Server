import { Injectable } from '@nestjs/common';
import { Prisma, SaleQuotation, SaleQuotationItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import { SaveQuotationItemDto } from './dto/save-quotation-item.dto';
import {
  QuotationErrorDetail,
  QuotationErrorResponse,
  QuotationItemPayload,
  QuotationPayload,
} from './types/quotation-api.types';
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesConflict,
  throwSalesNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const QUOTATION_TABLE_NAME = 'sale_quotation';
const QUOTATION_ITEM_TABLE_NAME = 'sale_quotation_item';
const QUOTATION_AUDIT_SCREEN_NAME = 'Sale Quotation';
const QUOTATION_OPTIONAL_FIELDS = [
  'sqSessionId',
  'sqCategoryId',
  'sqDocType',
  'sqUsrRefno',
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
  'sqRejectReason',
  'sqCancelReason',
  'sqMrpSavings',
  'sqMrpSavingsPerc',
  'sqRemarks',
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
];
// The immutable scope inherited by every line from its parent quotation.
interface QuotationScope {
  sqId: string;
  sqCompanyId: string;
  sqBranchId: string;
  sqTenantId: string;
  sqAccYear: string;
  sqPriceLevel: number;
}
type QuotationWriteClient = SalesWriteClient;
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
  async getById(sqId: string): Promise<QuotationPayload> {
    const record = await this.prisma.saleQuotation.findFirst({
      where: {
        sqId,
        sqIsDeleted: false,
      },
      include: {
        items: {
          where: { sqiIsDeleted: false },
          orderBy: { sqiLineNo: 'asc' },
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
    return this.toPayload(record);
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
        };
        const items = await this.syncItems(tx, scope, saveQuotationDto.items, createdBy);
        const payload = this.toPayload({ ...created, items });
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
        };
        const items = await this.syncItems(tx, scope, saveQuotationDto.items, modifiedBy);
        const payload = this.toPayload({ ...updated, items });
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
        applyPresentFields(updateData, inputItem, QUOTATION_ITEM_OPTIONAL_FIELDS);
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
      applyPresentFields(createData, inputItem, QUOTATION_ITEM_OPTIONAL_FIELDS);
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
  private applyOptionalFields(
    data: Prisma.SaleQuotationUncheckedCreateInput | Prisma.SaleQuotationUncheckedUpdateInput,
    dto: SaveQuotationDto,
  ): void {
    applyPresentFields(data, dto, QUOTATION_OPTIONAL_FIELDS);
  }
  private toPayload(record: SaleQuotation & { items?: SaleQuotationItem[] }): QuotationPayload {
    const { sqCreatedOn, sqModifiedOn, sqQuoteDatetime, sqSyncDate, items, ...rest } = record;
    return {
      ...rest,
      sqCreatedOn: sqCreatedOn?.toISOString(),
      sqModifiedOn: sqModifiedOn?.toISOString() ?? null,
      sqQuoteDatetime: sqQuoteDatetime?.toISOString(),
      sqSyncDate: sqSyncDate?.toISOString() ?? null,
      items: items ? items.map((item) => this.toItemPayload(item)) : [],
    };
  }
  private toItemPayload(record: SaleQuotationItem): QuotationItemPayload {
    const { sqiCreatedOn, sqiModifiedOn, sqiSyncDate, ...rest } = record;
    return {
      ...rest,
      sqiCreatedOn: sqiCreatedOn?.toISOString(),
      sqiModifiedOn: sqiModifiedOn?.toISOString() ?? null,
      sqiSyncDate: sqiSyncDate?.toISOString() ?? null,
    };
  }
}