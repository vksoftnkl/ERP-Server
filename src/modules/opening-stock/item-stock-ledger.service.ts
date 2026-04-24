import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ItemStockLedger as PrismaItemStockLedger, Prisma } from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { generateNextBatchNo } from '../../common/utils/batch-number.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  OpeningStockDetailPayload,
  OpeningStockDocumentPayload,
  OpeningStockHeaderPayload,
} from './types/opening-stock-api.types';
import { ItemStockBucket, StockTxnType } from './types/item-stock.types';

const ITEM_BATCH_STATUS_VALUES = ['ACTIVE', 'CLOSED', 'BLOCKED'] as const;
const ITEM_BATCH_STATUS_SET = new Set<(typeof ITEM_BATCH_STATUS_VALUES)[number]>(
  ITEM_BATCH_STATUS_VALUES,
);
const ITEM_STOCK_BUCKET_VALUES = Object.values(ItemStockBucket) as ItemStockBucket[];
const ITEM_STOCK_BUCKET_SET = new Set<ItemStockBucket>(ITEM_STOCK_BUCKET_VALUES);
const ITEM_BATCH_STOCK_STATE_SELECT = Prisma.validator<Prisma.ItemBatchStockSelect>()({
  ibsId: true,
  ibsAccYear: true,
  ibsCompanyId: true,
  ibsBranchId: true,
  ibsGodownId: true,
  ibsItemId: true,
  ibsUnitId: true,
  ibsBatchId: true,
  ibsBatchNo: true,
  ibsMfgDate: true,
  ibsExpiryDate: true,
  ibsMrp: true,
  ibsOpeningQty: true,
  ibsInQty: true,
  ibsOutQty: true,
  ibsClosingQty: true,
  ibsOpeningFreeQty: true,
  ibsFreeInQty: true,
  ibsFreeOutQty: true,
  ibsFreeClosingQty: true,
  ibsReservedQty: true,
  ibsAvailableQty: true,
  ibsOpeningAvgRate: true,
  ibsAvgStockRate: true,
  ibsOpeningValue: true,
  ibsStockValue: true,
  ibsLastInDate: true,
  ibsLastOutDate: true,
});
const ITEM_STOCK_BALANCE_STATE_SELECT = Prisma.validator<Prisma.ItemStockBalanceSelect>()({
  isbId: true,
  isbAccYear: true,
  isbCompanyId: true,
  isbBranchId: true,
  isbGodownId: true,
  isbItemId: true,
  isbUnitId: true,
  isbOpeningQty: true,
  isbInQty: true,
  isbOutQty: true,
  isbClosingQty: true,
  isbOpeningFreeQty: true,
  isbFreeInQty: true,
  isbFreeOutQty: true,
  isbFreeClosingQty: true,
  isbReservedQty: true,
  isbTransitQty: true,
  isbAvailableQty: true,
  isbOpeningAvgRate: true,
  isbAvgStockRate: true,
  isbOpeningValue: true,
  isbStockValue: true,
  isbOpeningAvgRateWot: true,
  isbAvgStockRateWot: true,
  isbOpeningValueWot: true,
  isbStockValueWot: true,
  isbLastInDate: true,
  isbLastOutDate: true,
});

export type CreatedItemStockPosting = {
  itemStockLedger: PrismaItemStockLedger[];
  itemStockBalance: StockBalanceStateRow[];
  itemBatchStock: BatchStockStateRow[];
};
type StockMovementInput = {
  accYear: string;
  companyId: string;
  branchId: string;
  godownId: string;
  itemId: string;
  unitId: string;
  trackingType: Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'];
  stockBucket: ItemStockBucket;
  movementType: StockTxnType;
  qty: number;
  freeQty: number;
  inwardValue: number;
  inwardValueWot: number;
  legacyInwardValue?: number;
  legacyInwardValueWot?: number;
  txnDate: Date;
  batchId?: string | null;
  batchNo?: string | null;
  batchDate?: Date | null;
  mfgDate?: Date | null;
  expiryDate?: Date | null;
  mrp?: number;
  barcode?: string | null;
};
type StockEngineState = {
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  openingFreeQty: number;
  freeInQty: number;
  freeOutQty: number;
  freeClosingQty: number;
  reservedQty: number;
  transitQty: number;
  availableQty: number;
  openingAvgRate: number;
  avgStockRate: number;
  openingValue: number;
  stockValue: number;
  openingAvgRateWot: number;
  avgStockRateWot: number;
  openingValueWot: number;
  stockValueWot: number;
  lastInDate: Date | null;
  lastOutDate: Date | null;
};
type BatchScopeReference = {
  companyId: string;
  branchId: string;
  godownId: string;
  itemId: string;
  unitId: string;
};
type ResolvedBatchIdentity = {
  batchId: string;
  batchNo: string;
};
type BatchScopeEntry = ResolvedBatchIdentity & {
  batchNoKey: string;
};
type BatchMasterIdentity = {
  btmId: string;
  btmBatchNo: string;
};
type BatchStockStateRow = Prisma.ItemBatchStockGetPayload<{
  select: typeof ITEM_BATCH_STOCK_STATE_SELECT;
}>;
type StockBalanceStateRow = Prisma.ItemStockBalanceGetPayload<{
  select: typeof ITEM_STOCK_BALANCE_STATE_SELECT;
}>;
type BatchResolutionContext = {
  batchScopeEntriesByKey: Map<string, BatchScopeEntry[]>;
  batchMasterNosByItemKey: Map<string, string[]>;
  batchMastersById: Map<string, BatchMasterIdentity | null>;
};
@Injectable()
export class ItemStockLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async syncFromOpeningStockDocument(
    tx: Prisma.TransactionClient,
    document: OpeningStockDocumentPayload,
    previousDocument?: OpeningStockDocumentPayload,
  ): Promise<CreatedItemStockPosting> {
    if (document.details.length === 0) {
      throw new BadRequestException('Opening stock response must contain at least one detail row');
    }
    const actorUserId =
      document.header.osh_updated_by ??
      document.header.osh_created_by ??
      document.header.osh_user_id ??
      this.requestContextService.getUserId();
    try {
      const now = new Date();
      const resolvedPreviousDocument = previousDocument
        ? await this.resolveBatchIdsForDocument(tx, previousDocument, actorUserId, now, false)
        : undefined;
      const resolvedDocument = await this.resolveBatchIdsForDocument(
        tx,
        document,
        actorUserId,
        now,
        true,
      );
      const reverseMovements = resolvedPreviousDocument
        ? this.buildOpeningStockMovements(resolvedPreviousDocument, -1)
        : [];
      const currentMovements = resolvedDocument.header.osh_is_deleted
        ? []
        : this.buildOpeningStockMovements(resolvedDocument, 1);
      await tx.itemStockLedger.deleteMany({
        where: {
          stlVoucherId: document.header.avh_voucher_id,
        },
      });
      const itemStockLedger = await Promise.all(
        resolvedDocument.details.map((detail, index) =>
          tx.itemStockLedger.create({
            data: this.buildLedgerCreateInput(
              resolvedDocument.header,
              detail,
              index,
              actorUserId,
              now,
            ),
          }),
        ),
      );
      const { itemStockBalance, itemBatchStock } = await this.applyStockMovements(
        tx,
        [...reverseMovements, ...currentMovements],
        actorUserId,
        now,
      );
      return {
        itemStockLedger,
        itemStockBalance,
        itemBatchStock,
      };
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private buildLedgerCreateInput(
    header: OpeningStockHeaderPayload,
    detail: OpeningStockDetailPayload,
    index: number,
    actorUserId: string | null,
    now: Date,
  ): Prisma.ItemStockLedgerUncheckedCreateInput {
    const voucherDate = this.parseRequiredDate(header.osh_voucher_date, 'header.osh_voucher_date');
    const createdOn =
      this.parseOptionalDate(detail.osl_created_on, `details[${index}].osl_created_on`) ?? now;
    const freeQty = detail.osl_free_qty ?? 0;
    const conversionFactor = detail.osl_conv_factor ?? 1;
    const freeBaseQty = this.roundQuantity(freeQty * conversionFactor);
    const isDeleted = header.osh_is_deleted || detail.osl_is_deleted;
    return {
      stlAccYear: detail.osl_acc_year,
      stlCompanyId: detail.osl_company_id,
      stlBranchId: detail.osl_branch_id,
      stlGodownId: detail.osl_godown_id,
      stlVoucherId: detail.osl_voucher_id,
      stlVoucherDate: voucherDate,
      stlLineNo: detail.osl_line_no ?? index + 1,
      stlSplitNo: 1,
      stlVoucherTypeId: header.avh_voucher_type_id,
      stlTxnType: StockTxnType.OPENING,
      stlStockEffect: 1,
      stlDocDate: voucherDate,
      stlPostedOn:
        this.parseOptionalDate(
          header.osh_updated_on ?? header.osh_created_on,
          'header.osh_created_on',
        ) ?? now,
      stlDocRefNo: header.osh_ref_no ?? header.osh_voucher_no ?? null,
      stlItemId: detail.osl_item_id,
      stlTrackingType: this.toStockTrackingType(detail.osl_tracking_type),
      stlUomId: detail.osl_unit_id,
      stlBaseUomId: detail.osl_base_uom_id ?? detail.osl_unit_id,
      stlConversionFactor: conversionFactor,
      stlBatchId: detail.osl_batch_id ?? null,
      stlBatchNo: detail.osl_batch_no ?? null,
      stlMfgDate: this.parseOptionalDate(detail.osl_mfg_date, `details[${index}].osl_mfg_date`),
      stlExpiryDate: this.parseOptionalDate(
        detail.osl_expiry_date,
        `details[${index}].osl_expiry_date`,
      ),
      stlQty: detail.osl_qty ?? 0,
      stlBaseQty: detail.osl_base_qty ?? 0,
      stlFreeQty: freeQty,
      stlFreeBaseQty: freeBaseQty,
      stlStockRate: detail.osl_cost_rate ?? 0,
      stlStockValue: detail.osl_stock_value ?? 0,
      stlLandedCostRate: detail.osl_cost_rate_wot ?? 0,
      stlLandedCostValue: detail.osl_stock_value_wot ?? 0,
      stlDocRateWot: detail.osl_cost_rate_wot ?? 0,
      stlDocAmountWot: detail.osl_stock_value_wot ?? 0,
      stlNarration: detail.osl_remarks ?? header.osh_narration ?? null,
      stlIsActive: isDeleted ? false : detail.osl_is_active,
      stlIsDeleted: isDeleted,
      stlSyncedOn: null,
      stlCreatedOn: createdOn,
      stlCreatedBy: detail.osl_created_by ?? actorUserId,
    };
  }
  private buildOpeningStockMovements(
    document: OpeningStockDocumentPayload,
    direction: 1 | -1,
  ): StockMovementInput[] {
    const txnDate = this.parseRequiredDate(
      document.header.osh_voucher_date,
      'header.osh_voucher_date',
    );
    return document.details
      .filter((detail) => !detail.osl_is_deleted)
      .map((detail) => {
        const conversionFactor = detail.osl_conv_factor ?? 1;
        const qty = this.roundQuantity(
          (detail.osl_base_qty ?? (detail.osl_qty ?? 0) * conversionFactor) * direction,
        );
        const freeQty = this.roundQuantity(
          (detail.osl_free_qty ?? 0) * conversionFactor * direction,
        );
        const inwardValue = this.roundAmount(
          (detail.osl_stock_value ?? (detail.osl_cost_rate ?? 0) * (detail.osl_qty ?? 0)) *
            direction,
        );
        const inwardValueWot = this.roundAmount(
          (detail.osl_stock_value_wot ?? (detail.osl_cost_rate_wot ?? 0) * (detail.osl_qty ?? 0)) *
            direction,
        );
        const legacyInwardValue = this.roundAmount(
          (detail.osl_stock_value_wot ?? (detail.osl_cost_rate_wot ?? 0) * (detail.osl_qty ?? 0)) *
            direction,
        );
        const legacyInwardValueWot = this.roundAmount(
          (detail.osl_stock_value ?? (detail.osl_cost_rate ?? 0) * (detail.osl_qty ?? 0)) *
            direction,
        );
        return {
          accYear: detail.osl_acc_year,
          companyId: detail.osl_company_id,
          branchId: detail.osl_branch_id,
          godownId: detail.osl_godown_id,
          itemId: detail.osl_item_id,
          unitId: detail.osl_base_uom_id ?? detail.osl_unit_id,
          trackingType: this.toBalanceTrackingType(detail.osl_tracking_type),
          stockBucket: this.normalizeStockBucket(ItemStockBucket.SALEABLE, 'movement.stockBucket'),
          movementType: StockTxnType.OPENING,
          qty,
          freeQty,
          inwardValue,
          inwardValueWot,
          legacyInwardValue,
          legacyInwardValueWot,
          txnDate,
          batchId: detail.osl_batch_id ?? null,
          batchNo: detail.osl_batch_no ?? null,
          batchDate: this.parseOptionalDate(detail.osl_batch_date, 'detail.osl_batch_date'),
          mfgDate: this.parseOptionalDate(detail.osl_mfg_date, 'detail.osl_mfg_date'),
          expiryDate: this.parseOptionalDate(detail.osl_expiry_date, 'detail.osl_expiry_date'),
          mrp: detail.osl_mrp_rate ?? 0,
          barcode: detail.osl_barcode ?? null,
        };
      });
  }
  private async resolveBatchIdsForDocument(
    tx: Prisma.TransactionClient,
    document: OpeningStockDocumentPayload,
    actorUserId: string | null,
    now: Date,
    persistResolvedBatchIds = false,
  ): Promise<OpeningStockDocumentPayload> {
    const resolutionContext: BatchResolutionContext = {
      batchScopeEntriesByKey: new Map<string, BatchScopeEntry[]>(),
      batchMasterNosByItemKey: new Map<string, string[]>(),
      batchMastersById: new Map<string, BatchMasterIdentity | null>(),
    };
    const details: OpeningStockDocumentPayload['details'] = [];
    for (const detail of document.details) {
      const trackingType = this.toBalanceTrackingType(detail.osl_tracking_type);
      if (!this.isBatchManagedTrackingType(trackingType)) {
        details.push(detail);
        continue;
      }
      const resolvedBatch = await this.resolveOrCreateBatchIdentity(
        tx,
        detail,
        actorUserId,
        now,
        resolutionContext,
      );
      const hasBatchIdChanged = detail.osl_batch_id !== resolvedBatch.batchId;
      const hasBatchNoChanged = detail.osl_batch_no !== resolvedBatch.batchNo;
      if (persistResolvedBatchIds && (hasBatchIdChanged || hasBatchNoChanged)) {
        await tx.openingStockDetail.update({
          where: { oslId: detail.osl_id },
          data: {
            oslBatchId: resolvedBatch.batchId,
            oslBatchNo: resolvedBatch.batchNo,
            oslUpdatedOn: now,
            oslUpdatedBy: actorUserId,
          },
        });
      }
      details.push({
        ...detail,
        osl_batch_id: resolvedBatch.batchId,
        osl_batch_no: resolvedBatch.batchNo,
      });
    }
    return {
      ...document,
      details,
    };
  }
  private async resolveOrCreateBatchIdentity(
    tx: Prisma.TransactionClient,
    detail: OpeningStockDetailPayload,
    actorUserId: string | null,
    now: Date,
    resolutionContext: BatchResolutionContext,
  ): Promise<ResolvedBatchIdentity> {
    const scope = this.buildBatchScopeReference(detail);
    const scopeEntries = await this.getBatchScopeEntries(tx, scope, resolutionContext);
    const requestedBatchNo = this.normalizeBatchNo(detail.osl_batch_no);
    const requestedBatchNoKey = requestedBatchNo
      ? this.normalizeBatchNoKey(requestedBatchNo)
      : null;

    if (requestedBatchNoKey) {
      const scopedBatch = scopeEntries.find((entry) => entry.batchNoKey === requestedBatchNoKey);
      if (scopedBatch && detail.osl_batch_id && scopedBatch.batchId !== detail.osl_batch_id) {
        throw new ConflictException(
          `Batch no "${requestedBatchNo}" already exists for the selected company, branch, godown, item, and unit`,
        );
      }
      if (!detail.osl_batch_id && scopedBatch) {
        return scopedBatch;
      }
    }

    if (detail.osl_batch_id) {
      const scopedBatch = scopeEntries.find((entry) => entry.batchId === detail.osl_batch_id);
      if (scopedBatch) {
        if (requestedBatchNoKey && scopedBatch.batchNoKey !== requestedBatchNoKey) {
          throw new ConflictException(
            `Batch id "${detail.osl_batch_id}" is already linked to batch no "${scopedBatch.batchNo}" for the selected company, branch, godown, item, and unit`,
          );
        }
        return scopedBatch;
      }
      const existingBatchMaster = await this.getBatchMasterById(
        tx,
        detail.osl_batch_id,
        resolutionContext,
      );
      if (!existingBatchMaster) {
        if (!requestedBatchNo) {
          throw new BadRequestException(
            `Batch id "${detail.osl_batch_id}" does not exist for the requested stock movement`,
          );
        }
        const resolvedIdentity = {
          batchId: detail.osl_batch_id,
          batchNo: requestedBatchNo,
        };
        this.registerBatchScopeEntry(resolutionContext, scope, resolvedIdentity);
        return resolvedIdentity;
      }
      const resolvedBatchNo = this.normalizeBatchNo(existingBatchMaster.btmBatchNo);
      if (!resolvedBatchNo) {
        throw new BadRequestException(
          `Batch id "${detail.osl_batch_id}" does not have a valid saved batch no`,
        );
      }
      if (
        requestedBatchNoKey &&
        this.normalizeBatchNoKey(resolvedBatchNo) !== requestedBatchNoKey
      ) {
        throw new ConflictException(
          `Batch id "${detail.osl_batch_id}" is already linked to batch no "${resolvedBatchNo}"`,
        );
      }
      const resolvedIdentity = {
        batchId: existingBatchMaster.btmId,
        batchNo: resolvedBatchNo,
      };
      this.registerBatchScopeEntry(resolutionContext, scope, resolvedIdentity);
      return resolvedIdentity;
    }

    let batchNo = requestedBatchNo;
    if (!batchNo) {
      const existingBatchNos = [
        ...(await this.getBatchMasterNosForItem(tx, detail, resolutionContext)),
        ...scopeEntries.map((entry) => entry.batchNo),
      ];
      batchNo = generateNextBatchNo(existingBatchNos);
    }

    const existingBatch = await tx.itemBatchMaster.findFirst({
      where: {
        btmCompanyId: detail.osl_company_id,
        btmItemId: detail.osl_item_id,
        btmBatchNo: {
          equals: batchNo,
          mode: 'insensitive',
        },
      },
      orderBy: {
        btmCreatedOn: 'desc',
      },
      select: {
        btmId: true,
        btmBatchNo: true,
      },
    });
    if (existingBatch) {
      const resolvedIdentity = {
        batchId: existingBatch.btmId,
        batchNo: this.normalizeBatchNo(existingBatch.btmBatchNo) ?? batchNo,
      };
      this.registerBatchScopeEntry(resolutionContext, scope, resolvedIdentity);
      return resolvedIdentity;
    }
    const batchDate = this.parseOptionalDate(detail.osl_batch_date, 'detail.osl_batch_date');
    const mfgDate = this.parseOptionalDate(detail.osl_mfg_date, 'detail.osl_mfg_date');
    const expiryDate = this.parseOptionalDate(detail.osl_expiry_date, 'detail.osl_expiry_date');
    const physicalQty = this.roundQuantity(
      (detail.osl_base_qty ?? (detail.osl_qty ?? 0) * (detail.osl_conv_factor ?? 1)) +
        (detail.osl_free_qty ?? 0) * (detail.osl_conv_factor ?? 1),
    );
    const lastPurchaseRateWot =
      physicalQty > 0 ? this.roundRate((detail.osl_stock_value_wot ?? 0) / physicalQty) : 0;
    const batchStatus = this.normalizeBatchStatus('ACTIVE', 'btmStatus');
    const createdBatch = await tx.itemBatchMaster.create({
      data: {
        btmCompanyId: detail.osl_company_id,
        btmItemId: detail.osl_item_id,
        btmBaseUnitId: detail.osl_base_uom_id ?? detail.osl_unit_id,
        btmBatchNo: batchNo,
        btmBatchDate: batchDate,
        btmMfgDate: mfgDate,
        btmExpiryDate: expiryDate,
        btmMrp: detail.osl_mrp_rate ?? 0,
        btmLastPurchaseRateWot: lastPurchaseRateWot,
        btmLastSaleRateWot: 0,
        btmBarcode: detail.osl_barcode ?? null,
        btmStatus: batchStatus,
        btmCreatedOn: now,
        btmCreatedBy: actorUserId,
        btmUpdatedOn: now,
        btmUpdatedBy: actorUserId,
      },
      select: {
        btmId: true,
        btmBatchNo: true,
      },
    });
    resolutionContext.batchMastersById.set(createdBatch.btmId, createdBatch);
    const batchMasterNosKey = this.buildBatchMasterNosKey(
      detail.osl_company_id,
      detail.osl_item_id,
    );
    const knownBatchNos = resolutionContext.batchMasterNosByItemKey.get(batchMasterNosKey);
    if (knownBatchNos) {
      knownBatchNos.push(batchNo);
    }
    const resolvedIdentity = {
      batchId: createdBatch.btmId,
      batchNo,
    };
    this.registerBatchScopeEntry(resolutionContext, scope, resolvedIdentity);
    return resolvedIdentity;
  }
  private buildBatchScopeReference(detail: OpeningStockDetailPayload): BatchScopeReference {
    return {
      companyId: detail.osl_company_id,
      branchId: detail.osl_branch_id,
      godownId: detail.osl_godown_id,
      itemId: detail.osl_item_id,
      unitId: detail.osl_base_uom_id ?? detail.osl_unit_id,
    };
  }
  private buildBatchScopeCacheKey(scope: BatchScopeReference): string {
    return [scope.companyId, scope.branchId, scope.godownId, scope.itemId, scope.unitId].join('|');
  }
  private buildBatchMasterNosKey(companyId: string, itemId: string): string {
    return [companyId, itemId].join('|');
  }
  private async getBatchScopeEntries(
    tx: Prisma.TransactionClient,
    scope: BatchScopeReference,
    resolutionContext: BatchResolutionContext,
  ): Promise<BatchScopeEntry[]> {
    const cacheKey = this.buildBatchScopeCacheKey(scope);
    const cached = resolutionContext.batchScopeEntriesByKey.get(cacheKey);
    if (cached) {
      return cached;
    }
    const rows = await tx.itemBatchStock.findMany({
      where: {
        ibsCompanyId: scope.companyId,
        ibsBranchId: scope.branchId,
        ibsGodownId: scope.godownId,
        ibsItemId: scope.itemId,
        ibsUnitId: scope.unitId,
      },
      select: {
        ibsBatchId: true,
        ibsBatchNo: true,
      },
    });
    const entries = rows.flatMap((row) => {
      const batchNo = this.normalizeBatchNo(row.ibsBatchNo);
      if (!batchNo) {
        return [];
      }
      return [
        {
          batchId: row.ibsBatchId,
          batchNo,
          batchNoKey: this.normalizeBatchNoKey(batchNo),
        },
      ];
    });
    resolutionContext.batchScopeEntriesByKey.set(cacheKey, entries);
    return entries;
  }
  private registerBatchScopeEntry(
    resolutionContext: BatchResolutionContext,
    scope: BatchScopeReference,
    batch: ResolvedBatchIdentity,
  ): void {
    const cacheKey = this.buildBatchScopeCacheKey(scope);
    const batchNoKey = this.normalizeBatchNoKey(batch.batchNo);
    const entries = resolutionContext.batchScopeEntriesByKey.get(cacheKey) ?? [];
    const existingEntry = entries.find(
      (entry) => entry.batchId === batch.batchId || entry.batchNoKey === batchNoKey,
    );
    if (existingEntry) {
      existingEntry.batchId = batch.batchId;
      existingEntry.batchNo = batch.batchNo;
      existingEntry.batchNoKey = batchNoKey;
    } else {
      entries.push({
        batchId: batch.batchId,
        batchNo: batch.batchNo,
        batchNoKey,
      });
    }
    resolutionContext.batchScopeEntriesByKey.set(cacheKey, entries);
  }
  private async getBatchMasterNosForItem(
    tx: Prisma.TransactionClient,
    detail: OpeningStockDetailPayload,
    resolutionContext: BatchResolutionContext,
  ): Promise<string[]> {
    const cacheKey = this.buildBatchMasterNosKey(detail.osl_company_id, detail.osl_item_id);
    const cached = resolutionContext.batchMasterNosByItemKey.get(cacheKey);
    if (cached) {
      return cached;
    }
    const rows = await tx.itemBatchMaster.findMany({
      where: {
        btmCompanyId: detail.osl_company_id,
        btmItemId: detail.osl_item_id,
      },
      select: {
        btmBatchNo: true,
      },
    });
    const batchNos = rows
      .map((row) => this.normalizeBatchNo(row.btmBatchNo))
      .filter((value): value is string => Boolean(value));
    resolutionContext.batchMasterNosByItemKey.set(cacheKey, batchNos);
    return batchNos;
  }
  private async getBatchMasterById(
    tx: Prisma.TransactionClient,
    batchId: string,
    resolutionContext: BatchResolutionContext,
  ): Promise<BatchMasterIdentity | null> {
    if (resolutionContext.batchMastersById.has(batchId)) {
      return resolutionContext.batchMastersById.get(batchId) ?? null;
    }
    const batchMaster = await tx.itemBatchMaster.findUnique({
      where: {
        btmId: batchId,
      },
      select: {
        btmId: true,
        btmBatchNo: true,
      },
    });
    resolutionContext.batchMastersById.set(batchId, batchMaster ?? null);
    return batchMaster ?? null;
  }
  private normalizeBatchNo(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : null;
  }
  private normalizeBatchNoKey(value: string): string {
    return value.trim().toLowerCase();
  }
  private async applyStockMovements(
    tx: Prisma.TransactionClient,
    movements: StockMovementInput[],
    actorUserId: string | null,
    now: Date,
  ): Promise<Pick<CreatedItemStockPosting, 'itemStockBalance' | 'itemBatchStock'>> {
    const stockBalances = new Map<string, StockBalanceStateRow>();
    const batchStocks = new Map<string, BatchStockStateRow>();
    for (const movement of movements) {
      const normalizedMovement = this.normalizeStockMovement(movement);
      if (this.isBatchManagedTrackingType(normalizedMovement.trackingType)) {
        if (!normalizedMovement.batchId) {
          throw new BadRequestException(
            'Batch-managed stock movement requires batch id for BATCH or MRP tracking',
          );
        }
        const batchRow = await this.applyBatchMovement(tx, normalizedMovement, actorUserId, now);
        if (batchRow) {
          batchStocks.set(this.buildBatchScopeKey(normalizedMovement), batchRow);
        }
        const summaryRow = await this.rollupBatchToItemSummary(
          tx,
          normalizedMovement,
          actorUserId,
          now,
        );
        if (summaryRow) {
          stockBalances.set(this.buildSummaryScopeKey(normalizedMovement), summaryRow);
        }
        continue;
      }
      const summaryRow = await this.applySummaryMovement(tx, normalizedMovement, actorUserId, now);
      stockBalances.set(this.buildSummaryScopeKey(normalizedMovement), summaryRow);
    }
    return {
      itemStockBalance: Array.from(stockBalances.values()),
      itemBatchStock: Array.from(batchStocks.values()),
    };
  }
  private async applySummaryMovement(
    tx: Prisma.TransactionClient,
    movement: StockMovementInput,
    actorUserId: string | null,
    now: Date,
  ): Promise<StockBalanceStateRow> {
    const where = {
      isbAccYear_isbCompanyId_isbBranchId_isbGodownId_isbItemId_isbUnitId_isbStockBucket: {
        isbAccYear: movement.accYear,
        isbCompanyId: movement.companyId,
        isbBranchId: movement.branchId,
        isbGodownId: movement.godownId,
        isbItemId: movement.itemId,
        isbUnitId: movement.unitId,
        isbStockBucket: movement.stockBucket,
      },
    } as const;
    const existing = await tx.itemStockBalance.findUnique({
      where,
      select: ITEM_STOCK_BALANCE_STATE_SELECT,
    });
    const nextState = this.applyMovementToState(
      existing ? this.toStateFromStockBalance(existing) : this.createEmptyState(),
      movement,
    );
    return tx.itemStockBalance.upsert({
      where,
      create: this.buildStockBalanceCreateInput(movement, nextState, actorUserId, now),
      update: this.buildStockBalanceUpdateInput(movement, nextState, actorUserId, now),
      select: ITEM_STOCK_BALANCE_STATE_SELECT,
    });
  }
  private async applyBatchMovement(
    tx: Prisma.TransactionClient,
    movement: StockMovementInput,
    actorUserId: string | null,
    now: Date,
  ): Promise<BatchStockStateRow | null> {
    const where = {
      ibsAccYear_ibsCompanyId_ibsBranchId_ibsGodownId_ibsItemId_ibsBatchId_ibsStockBucket: {
        ibsAccYear: movement.accYear,
        ibsCompanyId: movement.companyId,
        ibsBranchId: movement.branchId,
        ibsGodownId: movement.godownId,
        ibsItemId: movement.itemId,
        ibsBatchId: movement.batchId!,
        ibsStockBucket: movement.stockBucket,
      },
    } as const;
    const existing = await tx.itemBatchStock.findUnique({
      where,
      select: ITEM_BATCH_STOCK_STATE_SELECT,
    });
    if (!existing && this.isReverseOpeningMovement(movement)) {
      return null;
    }
    const nextState = this.applyMovementToState(
      existing ? this.toStateFromBatchStock(existing) : this.createEmptyState(),
      movement,
    );
    this.assertValidBatchStockWrite(movement, nextState);
    return tx.itemBatchStock.upsert({
      where,
      create: this.buildBatchStockCreateInput(movement, nextState, actorUserId, now),
      update: this.buildBatchStockUpdateInput(movement, nextState, actorUserId, now),
      select: ITEM_BATCH_STOCK_STATE_SELECT,
    });
  }
  private isReverseOpeningMovement(movement: StockMovementInput): boolean {
    return (
      movement.movementType === StockTxnType.OPENING &&
      (movement.qty < 0 || movement.freeQty < 0 || movement.inwardValue < 0)
    );
  }
  private async rollupBatchToItemSummary(
    tx: Prisma.TransactionClient,
    movement: StockMovementInput,
    actorUserId: string | null,
    now: Date,
  ): Promise<StockBalanceStateRow | null> {
    const where = {
      isbAccYear_isbCompanyId_isbBranchId_isbGodownId_isbItemId_isbUnitId_isbStockBucket: {
        isbAccYear: movement.accYear,
        isbCompanyId: movement.companyId,
        isbBranchId: movement.branchId,
        isbGodownId: movement.godownId,
        isbItemId: movement.itemId,
        isbUnitId: movement.unitId,
        isbStockBucket: movement.stockBucket,
      },
    } as const;
    const [existingSummary, batchRows] = await Promise.all([
      tx.itemStockBalance.findUnique({
        where,
        select: ITEM_STOCK_BALANCE_STATE_SELECT,
      }),
      tx.itemBatchStock.findMany({
        where: {
          ibsAccYear: movement.accYear,
          ibsCompanyId: movement.companyId,
          ibsBranchId: movement.branchId,
          ibsGodownId: movement.godownId,
          ibsItemId: movement.itemId,
          ibsUnitId: movement.unitId,
          ibsStockBucket: movement.stockBucket,
        },
        select: ITEM_BATCH_STOCK_STATE_SELECT,
      }),
    ]);
    if (!existingSummary && batchRows.length === 0) {
      return null;
    }
    const nextState = this.mergeSummaryWotValuation(
      this.aggregateBatchStates(batchRows),
      this.resolveBatchSummaryWotState(existingSummary, movement),
    );
    return tx.itemStockBalance.upsert({
      where,
      create: this.buildStockBalanceCreateInput(movement, nextState, actorUserId, now),
      update: this.buildStockBalanceUpdateInput(movement, nextState, actorUserId, now),
      select: ITEM_STOCK_BALANCE_STATE_SELECT,
    });
  }
  private aggregateBatchStates(rows: BatchStockStateRow[]): StockEngineState {
    const state = this.createEmptyState();
    for (const row of rows) {
      state.openingQty = this.roundQuantity(state.openingQty + this.toNumber(row.ibsOpeningQty));
      state.inQty = this.roundQuantity(state.inQty + this.toNumber(row.ibsInQty));
      state.outQty = this.roundQuantity(state.outQty + this.toNumber(row.ibsOutQty));
      state.openingFreeQty = this.roundQuantity(
        state.openingFreeQty + this.toNumber(row.ibsOpeningFreeQty),
      );
      state.freeInQty = this.roundQuantity(state.freeInQty + this.toNumber(row.ibsFreeInQty));
      state.freeOutQty = this.roundQuantity(state.freeOutQty + this.toNumber(row.ibsFreeOutQty));
      state.reservedQty = this.roundQuantity(state.reservedQty + this.toNumber(row.ibsReservedQty));
      state.openingValue = this.roundAmount(
        state.openingValue + this.toNumber(row.ibsOpeningValue),
      );
      state.stockValue = this.roundAmount(state.stockValue + this.toNumber(row.ibsStockValue));
      state.lastInDate = this.maxDate(state.lastInDate, row.ibsLastInDate);
      state.lastOutDate = this.maxDate(state.lastOutDate, row.ibsLastOutDate);
    }
    return this.recalculateState(state);
  }
  private applyMovementToState(
    currentState: StockEngineState,
    movement: StockMovementInput,
  ): StockEngineState {
    const nextState: StockEngineState = { ...currentState };
    const category = this.getMovementCategory(movement.movementType);
    const qty = this.roundQuantity(movement.qty);
    const freeQty = this.roundQuantity(movement.freeQty);
    const physicalQty = this.roundQuantity(qty + freeQty);
    const inwardValue = this.resolveMovementValue(
      movement,
      movement.inwardValue,
      currentState.openingValue,
      currentState.stockValue,
      movement.legacyInwardValue,
    );
    const inwardValueWot = this.resolveMovementValue(
      movement,
      movement.inwardValueWot,
      currentState.openingValueWot,
      currentState.stockValueWot,
      movement.legacyInwardValueWot,
      true,
    );
    if (category === 'OPENING') {
      nextState.openingQty = this.roundQuantity(nextState.openingQty + qty);
      nextState.openingFreeQty = this.roundQuantity(nextState.openingFreeQty + freeQty);
      nextState.openingValue = this.roundAmount(nextState.openingValue + inwardValue);
      nextState.stockValue = this.roundAmount(nextState.stockValue + inwardValue);
      nextState.openingValueWot = this.roundAmount(nextState.openingValueWot + inwardValueWot);
      nextState.stockValueWot = this.roundAmount(nextState.stockValueWot + inwardValueWot);
      nextState.lastInDate = this.maxDate(nextState.lastInDate, movement.txnDate);
      return this.recalculateState(nextState);
    }
    if (category === 'INWARD') {
      nextState.inQty = this.roundQuantity(nextState.inQty + qty);
      nextState.freeInQty = this.roundQuantity(nextState.freeInQty + freeQty);
      nextState.stockValue = this.roundAmount(nextState.stockValue + inwardValue);
      nextState.stockValueWot = this.roundAmount(nextState.stockValueWot + inwardValueWot);
      nextState.lastInDate = this.maxDate(nextState.lastInDate, movement.txnDate);
      return this.recalculateState(nextState);
    }
    const physicalClosingBefore = this.getPhysicalClosingQty(currentState);
    if (physicalQty > physicalClosingBefore) {
      throw new BadRequestException(
        `Insufficient stock for item ${movement.itemId}. Required ${physicalQty}, available ${physicalClosingBefore}`,
      );
    }
    const issueRate = currentState.avgStockRate;
    const issueRateWot = currentState.avgStockRateWot;
    const outwardValue = this.roundAmount(physicalQty * issueRate);
    const outwardValueWot = this.roundAmount(physicalQty * issueRateWot);
    nextState.outQty = this.roundQuantity(nextState.outQty + qty);
    nextState.freeOutQty = this.roundQuantity(nextState.freeOutQty + freeQty);
    nextState.stockValue = this.roundAmount(nextState.stockValue - outwardValue);
    nextState.stockValueWot = this.roundAmount(nextState.stockValueWot - outwardValueWot);
    nextState.lastOutDate = this.maxDate(nextState.lastOutDate, movement.txnDate);
    return this.recalculateState(nextState);
  }
  private recalculateState(state: StockEngineState): StockEngineState {
    const nextState: StockEngineState = {
      ...state,
      openingQty: this.sanitizeQty(state.openingQty),
      inQty: this.sanitizeQty(state.inQty),
      outQty: this.sanitizeQty(state.outQty),
      openingFreeQty: this.sanitizeQty(state.openingFreeQty),
      freeInQty: this.sanitizeQty(state.freeInQty),
      freeOutQty: this.sanitizeQty(state.freeOutQty),
      reservedQty: this.sanitizeQty(state.reservedQty),
      transitQty: this.sanitizeQty(state.transitQty),
      openingValue: this.sanitizeAmount(state.openingValue),
      stockValue: this.sanitizeAmount(state.stockValue),
      openingValueWot: this.sanitizeAmount(state.openingValueWot),
      stockValueWot: this.sanitizeAmount(state.stockValueWot),
      openingAvgRate: this.roundRate(state.openingAvgRate),
      avgStockRate: this.roundRate(state.avgStockRate),
      openingAvgRateWot: this.roundRate(state.openingAvgRateWot),
      avgStockRateWot: this.roundRate(state.avgStockRateWot),
      closingQty: 0,
      freeClosingQty: 0,
      availableQty: 0,
    };
    nextState.closingQty = this.sanitizeQty(
      nextState.openingQty + nextState.inQty - nextState.outQty,
    );
    nextState.freeClosingQty = this.sanitizeQty(
      nextState.openingFreeQty + nextState.freeInQty - nextState.freeOutQty,
    );
    if (nextState.reservedQty > nextState.closingQty) {
      throw new BadRequestException(
        `Reserved qty ${nextState.reservedQty} cannot exceed closing qty ${nextState.closingQty}`,
      );
    }
    nextState.availableQty = this.sanitizeQty(nextState.closingQty - nextState.reservedQty);
    const physicalOpeningQty = this.getPhysicalOpeningQty(nextState);
    if (physicalOpeningQty > 0) {
      nextState.openingAvgRate = this.roundRate(nextState.openingValue / physicalOpeningQty);
      nextState.openingAvgRateWot = this.roundRate(nextState.openingValueWot / physicalOpeningQty);
    } else {
      nextState.openingAvgRate = 0;
      nextState.openingValue = 0;
      nextState.openingAvgRateWot = 0;
      nextState.openingValueWot = 0;
    }
    const physicalClosingQty = this.getPhysicalClosingQty(nextState);
    if (physicalClosingQty > 0) {
      nextState.avgStockRate = this.roundRate(nextState.stockValue / physicalClosingQty);
      nextState.avgStockRateWot = this.roundRate(nextState.stockValueWot / physicalClosingQty);
    } else {
      nextState.avgStockRate = 0;
      nextState.stockValue = 0;
      nextState.avgStockRateWot = 0;
      nextState.stockValueWot = 0;
    }
    return nextState;
  }
  private getMovementCategory(movementType: StockTxnType): 'OPENING' | 'INWARD' | 'OUTWARD' {
    switch (movementType) {
      case StockTxnType.OPENING:
        return 'OPENING';
      case StockTxnType.PURCHASE:
      case StockTxnType.SALES_RETURN:
      case StockTxnType.TRANSFER_IN:
      case StockTxnType.ADJUSTMENT_IN:
      case StockTxnType.PRODUCTION_IN:
        return 'INWARD';
      case StockTxnType.PURCHASE_RETURN:
      case StockTxnType.SALE:
      case StockTxnType.TRANSFER_OUT:
      case StockTxnType.ADJUSTMENT_OUT:
      case StockTxnType.CONSUMPTION:
      case StockTxnType.DAMAGE:
      case StockTxnType.EXPIRED:
        return 'OUTWARD';
      default:
        return 'OUTWARD';
    }
  }
  private createEmptyState(): StockEngineState {
    return {
      openingQty: 0,
      inQty: 0,
      outQty: 0,
      closingQty: 0,
      openingFreeQty: 0,
      freeInQty: 0,
      freeOutQty: 0,
      freeClosingQty: 0,
      reservedQty: 0,
      transitQty: 0,
      availableQty: 0,
      openingAvgRate: 0,
      avgStockRate: 0,
      openingValue: 0,
      stockValue: 0,
      openingAvgRateWot: 0,
      avgStockRateWot: 0,
      openingValueWot: 0,
      stockValueWot: 0,
      lastInDate: null,
      lastOutDate: null,
    };
  }
  private resolveMovementValue(
    movement: StockMovementInput,
    primaryValue: number,
    currentOpeningValue: number,
    currentStockValue: number,
    fallbackValue?: number,
    fallbackToZero = false,
  ): number {
    const inwardValue = this.roundAmount(primaryValue);
    if (movement.movementType !== StockTxnType.OPENING || inwardValue >= 0) {
      return inwardValue;
    }
    const grossOpeningValue = this.roundAmount(currentOpeningValue + inwardValue);
    const grossStockValue = this.roundAmount(currentStockValue + inwardValue);
    if (grossOpeningValue >= 0 && grossStockValue >= 0) {
      return inwardValue;
    }
    if (fallbackValue !== undefined) {
      const legacyInwardValue = this.roundAmount(fallbackValue);
      const legacyOpeningValue = this.roundAmount(currentOpeningValue + legacyInwardValue);
      const legacyStockValue = this.roundAmount(currentStockValue + legacyInwardValue);
      if (legacyOpeningValue >= 0 && legacyStockValue >= 0) {
        return legacyInwardValue;
      }
    }
    return fallbackToZero ? 0 : inwardValue;
  }
  private toStateFromStockBalance(row: StockBalanceStateRow): StockEngineState {
    return {
      openingQty: this.toNumber(row.isbOpeningQty),
      inQty: this.toNumber(row.isbInQty),
      outQty: this.toNumber(row.isbOutQty),
      closingQty: this.toNumber(row.isbClosingQty),
      openingFreeQty: this.toNumber(row.isbOpeningFreeQty),
      freeInQty: this.toNumber(row.isbFreeInQty),
      freeOutQty: this.toNumber(row.isbFreeOutQty),
      freeClosingQty: this.toNumber(row.isbFreeClosingQty),
      reservedQty: this.toNumber(row.isbReservedQty),
      transitQty: this.toNumber(row.isbTransitQty),
      availableQty: this.toNumber(row.isbAvailableQty),
      openingAvgRate: this.toNumber(row.isbOpeningAvgRate),
      avgStockRate: this.toNumber(row.isbAvgStockRate),
      openingValue: this.toNumber(row.isbOpeningValue),
      stockValue: this.toNumber(row.isbStockValue),
      openingAvgRateWot: this.toNumber(row.isbOpeningAvgRateWot),
      avgStockRateWot: this.toNumber(row.isbAvgStockRateWot),
      openingValueWot: this.toNumber(row.isbOpeningValueWot),
      stockValueWot: this.toNumber(row.isbStockValueWot),
      lastInDate: row.isbLastInDate,
      lastOutDate: row.isbLastOutDate,
    };
  }
  private toStateFromBatchStock(row: BatchStockStateRow): StockEngineState {
    return {
      openingQty: this.toNumber(row.ibsOpeningQty),
      inQty: this.toNumber(row.ibsInQty),
      outQty: this.toNumber(row.ibsOutQty),
      closingQty: this.toNumber(row.ibsClosingQty),
      openingFreeQty: this.toNumber(row.ibsOpeningFreeQty),
      freeInQty: this.toNumber(row.ibsFreeInQty),
      freeOutQty: this.toNumber(row.ibsFreeOutQty),
      freeClosingQty: this.toNumber(row.ibsFreeClosingQty),
      reservedQty: this.toNumber(row.ibsReservedQty),
      transitQty: 0,
      availableQty: this.toNumber(row.ibsAvailableQty),
      openingAvgRate: this.toNumber(row.ibsOpeningAvgRate),
      avgStockRate: this.toNumber(row.ibsAvgStockRate),
      openingValue: this.toNumber(row.ibsOpeningValue),
      stockValue: this.toNumber(row.ibsStockValue),
      openingAvgRateWot: 0,
      avgStockRateWot: 0,
      openingValueWot: 0,
      stockValueWot: 0,
      lastInDate: row.ibsLastInDate,
      lastOutDate: row.ibsLastOutDate,
    };
  }

  private mergeSummaryWotValuation(
    baseState: StockEngineState,
    wotState: StockEngineState,
  ): StockEngineState {
    return this.recalculateState({
      ...baseState,
      openingAvgRateWot: wotState.openingAvgRateWot,
      avgStockRateWot: wotState.avgStockRateWot,
      openingValueWot: wotState.openingValueWot,
      stockValueWot: wotState.stockValueWot,
    });
  }
  private resolveBatchSummaryWotState(
    existingSummary: StockBalanceStateRow | null,
    movement: StockMovementInput,
  ): StockEngineState {
    if (existingSummary) {
      return this.applyMovementToState(this.toStateFromStockBalance(existingSummary), movement);
    }
    if (this.isReverseOpeningMovement(movement)) {
      return this.createEmptyState();
    }
    return this.applyMovementToState(this.createEmptyState(), movement);
  }
  private buildStockBalanceCreateInput(
    movement: StockMovementInput,
    state: StockEngineState,
    actorUserId: string | null,
    now: Date,
  ): Prisma.ItemStockBalanceUncheckedCreateInput {
    return {
      isbAccYear: movement.accYear,
      isbCompanyId: movement.companyId,
      isbBranchId: movement.branchId,
      isbGodownId: movement.godownId,
      isbItemId: movement.itemId,
      isbUnitId: movement.unitId,
      isbTrackingType: movement.trackingType,
      isbStockBucket: movement.stockBucket,
      isbOpeningQty: state.openingQty,
      isbInQty: state.inQty,
      isbOutQty: state.outQty,
      isbClosingQty: state.closingQty,
      isbOpeningFreeQty: state.openingFreeQty,
      isbFreeInQty: state.freeInQty,
      isbFreeOutQty: state.freeOutQty,
      isbFreeClosingQty: state.freeClosingQty,
      isbReservedQty: state.reservedQty,
      isbTransitQty: state.transitQty,
      isbAvailableQty: state.availableQty,
      isbOpeningAvgRate: state.openingAvgRate,
      isbAvgStockRate: state.avgStockRate,
      isbOpeningValue: state.openingValue,
      isbStockValue: state.stockValue,
      isbOpeningAvgRateWot: state.openingAvgRateWot,
      isbAvgStockRateWot: state.avgStockRateWot,
      isbOpeningValueWot: state.openingValueWot,
      isbStockValueWot: state.stockValueWot,
      isbLastInDate: state.lastInDate,
      isbLastOutDate: state.lastOutDate,
      isbSyncDate: null,
      isbCreatedOn: now,
      isbCreatedBy: actorUserId,
      isbUpdatedOn: now,
      isbUpdatedBy: actorUserId,
    };
  }
  private buildStockBalanceUpdateInput(
    movement: StockMovementInput,
    state: StockEngineState,
    actorUserId: string | null,
    now: Date,
  ): Prisma.ItemStockBalanceUncheckedUpdateInput {
    return {
      isbTrackingType: movement.trackingType,
      isbOpeningQty: state.openingQty,
      isbInQty: state.inQty,
      isbOutQty: state.outQty,
      isbClosingQty: state.closingQty,
      isbOpeningFreeQty: state.openingFreeQty,
      isbFreeInQty: state.freeInQty,
      isbFreeOutQty: state.freeOutQty,
      isbFreeClosingQty: state.freeClosingQty,
      isbReservedQty: state.reservedQty,
      isbTransitQty: state.transitQty,
      isbAvailableQty: state.availableQty,
      isbOpeningAvgRate: state.openingAvgRate,
      isbAvgStockRate: state.avgStockRate,
      isbOpeningValue: state.openingValue,
      isbStockValue: state.stockValue,
      isbOpeningAvgRateWot: state.openingAvgRateWot,
      isbAvgStockRateWot: state.avgStockRateWot,
      isbOpeningValueWot: state.openingValueWot,
      isbStockValueWot: state.stockValueWot,
      isbLastInDate: state.lastInDate,
      isbLastOutDate: state.lastOutDate,
      isbSyncDate: null,
      isbUpdatedOn: now,
      isbUpdatedBy: actorUserId,
    };
  }
  private buildBatchStockCreateInput(
    movement: StockMovementInput,
    state: StockEngineState,
    actorUserId: string | null,
    now: Date,
  ): Prisma.ItemBatchStockUncheckedCreateInput {
    return {
      ibsAccYear: movement.accYear,
      ibsCompanyId: movement.companyId,
      ibsBranchId: movement.branchId,
      ibsGodownId: movement.godownId,
      ibsItemId: movement.itemId,
      ibsUnitId: movement.unitId,
      ibsBatchId: movement.batchId!,
      ibsBatchNo: movement.batchNo ?? null,
      ibsSerialNo: null,
      ibsMfgDate: movement.mfgDate ?? null,
      ibsExpiryDate: movement.expiryDate ?? null,
      ibsMrp: this.roundRate(movement.mrp ?? 0),
      ibsStockBucket: movement.stockBucket,
      ibsOpeningQty: state.openingQty,
      ibsInQty: state.inQty,
      ibsOutQty: state.outQty,
      ibsClosingQty: state.closingQty,
      ibsOpeningFreeQty: state.openingFreeQty,
      ibsFreeInQty: state.freeInQty,
      ibsFreeOutQty: state.freeOutQty,
      ibsFreeClosingQty: state.freeClosingQty,
      ibsReservedQty: state.reservedQty,
      ibsAvailableQty: state.availableQty,
      ibsOpeningAvgRate: state.openingAvgRate,
      ibsAvgStockRate: state.avgStockRate,
      ibsOpeningValue: state.openingValue,
      ibsStockValue: state.stockValue,
      ibsLastInDate: state.lastInDate,
      ibsLastOutDate: state.lastOutDate,
      ibsIsActive: true,
      ibsIsDeleted: false,
      ibsCreatedOn: now,
      ibsCreatedBy: actorUserId,
      ibsUpdatedOn: now,
      ibsUpdatedBy: actorUserId,
    };
  }
  private buildBatchStockUpdateInput(
    movement: StockMovementInput,
    state: StockEngineState,
    actorUserId: string | null,
    now: Date,
  ): Prisma.ItemBatchStockUncheckedUpdateInput {
    return {
      ibsUnitId: movement.unitId,
      ibsBatchNo: movement.batchNo ?? null,
      ibsMfgDate: movement.mfgDate ?? null,
      ibsExpiryDate: movement.expiryDate ?? null,
      ibsMrp: this.roundRate(movement.mrp ?? 0),
      ibsOpeningQty: state.openingQty,
      ibsInQty: state.inQty,
      ibsOutQty: state.outQty,
      ibsClosingQty: state.closingQty,
      ibsOpeningFreeQty: state.openingFreeQty,
      ibsFreeInQty: state.freeInQty,
      ibsFreeOutQty: state.freeOutQty,
      ibsFreeClosingQty: state.freeClosingQty,
      ibsReservedQty: state.reservedQty,
      ibsAvailableQty: state.availableQty,
      ibsOpeningAvgRate: state.openingAvgRate,
      ibsAvgStockRate: state.avgStockRate,
      ibsOpeningValue: state.openingValue,
      ibsStockValue: state.stockValue,
      ibsLastInDate: state.lastInDate,
      ibsLastOutDate: state.lastOutDate,
      ibsIsActive: true,
      ibsIsDeleted: false,
      ibsUpdatedOn: now,
      ibsUpdatedBy: actorUserId,
    };
  }
  private buildSummaryScopeKey(movement: StockMovementInput): string {
    return [
      movement.accYear,
      movement.companyId,
      movement.branchId,
      movement.godownId,
      movement.itemId,
      movement.unitId,
      movement.stockBucket,
    ].join('|');
  }
  private buildBatchScopeKey(movement: StockMovementInput): string {
    return [
      movement.accYear,
      movement.companyId,
      movement.branchId,
      movement.godownId,
      movement.itemId,
      movement.unitId,
      movement.batchId ?? '',
      movement.stockBucket,
    ].join('|');
  }
  private getPhysicalOpeningQty(state: StockEngineState): number {
    return this.roundQuantity(state.openingQty + state.openingFreeQty);
  }
  private getPhysicalClosingQty(state: StockEngineState): number {
    return this.roundQuantity(state.closingQty + state.freeClosingQty);
  }
  private maxDate(current: Date | null, candidate: Date | null): Date | null {
    if (!current) {
      return candidate ?? null;
    }
    if (!candidate) {
      return current;
    }
    return current.getTime() >= candidate.getTime() ? current : candidate;
  }
  private assertValidBatchStockWrite(movement: StockMovementInput, state: StockEngineState): void {
    this.normalizeStockBucket(movement.stockBucket, 'itemBatchStock.ibsStockBucket');
    this.assertValidBatchStockDates(movement.mfgDate ?? null, movement.expiryDate ?? null);
    this.assertNonNegativeQuantity(state.openingQty, 'itemBatchStock.ibsOpeningQty');
    this.assertNonNegativeQuantity(state.inQty, 'itemBatchStock.ibsInQty');
    this.assertNonNegativeQuantity(state.outQty, 'itemBatchStock.ibsOutQty');
    this.assertNonNegativeQuantity(state.closingQty, 'itemBatchStock.ibsClosingQty');
    this.assertNonNegativeQuantity(state.openingFreeQty, 'itemBatchStock.ibsOpeningFreeQty');
    this.assertNonNegativeQuantity(state.freeInQty, 'itemBatchStock.ibsFreeInQty');
    this.assertNonNegativeQuantity(state.freeOutQty, 'itemBatchStock.ibsFreeOutQty');
    this.assertNonNegativeQuantity(state.freeClosingQty, 'itemBatchStock.ibsFreeClosingQty');
    this.assertNonNegativeQuantity(state.reservedQty, 'itemBatchStock.ibsReservedQty');
    this.assertNonNegativeQuantity(state.availableQty, 'itemBatchStock.ibsAvailableQty');
    this.assertNonNegativeAmount(state.openingValue, 'itemBatchStock.ibsOpeningValue');
    this.assertNonNegativeAmount(state.stockValue, 'itemBatchStock.ibsStockValue');
    this.assertNonNegativeRate(state.openingAvgRate, 'itemBatchStock.ibsOpeningAvgRate');
    this.assertNonNegativeRate(state.avgStockRate, 'itemBatchStock.ibsAvgStockRate');
    this.assertNonNegativeRate(movement.mrp ?? 0, 'itemBatchStock.ibsMrp');
    const expectedClosingQty = this.roundQuantity(state.openingQty + state.inQty - state.outQty);
    if (this.roundQuantity(state.closingQty) !== expectedClosingQty) {
      throw new BadRequestException(
        'itemBatchStock.ibsClosingQty must equal ibsOpeningQty + ibsInQty - ibsOutQty',
      );
    }
    const expectedFreeClosingQty = this.roundQuantity(
      state.openingFreeQty + state.freeInQty - state.freeOutQty,
    );
    if (this.roundQuantity(state.freeClosingQty) !== expectedFreeClosingQty) {
      throw new BadRequestException(
        'itemBatchStock.ibsFreeClosingQty must equal ibsOpeningFreeQty + ibsFreeInQty - ibsFreeOutQty',
      );
    }
    const expectedAvailableQty = this.roundQuantity(state.closingQty - state.reservedQty);
    if (this.roundQuantity(state.availableQty) !== expectedAvailableQty) {
      throw new BadRequestException(
        'itemBatchStock.ibsAvailableQty must equal ibsClosingQty - ibsReservedQty',
      );
    }
  }
  private assertValidBatchStockDates(mfgDate: Date | null, expiryDate: Date | null): void {
    if (mfgDate && expiryDate && expiryDate.getTime() < mfgDate.getTime()) {
      throw new BadRequestException(
        'itemBatchStock.ibsExpiryDate must be greater than or equal to itemBatchStock.ibsMfgDate',
      );
    }
  }
  private assertNonNegativeQuantity(value: number, field: string): void {
    if (this.roundQuantity(value) < 0) {
      throw new BadRequestException(`${field} must be greater than or equal to 0`);
    }
  }
  private assertNonNegativeRate(value: number, field: string): void {
    if (this.roundRate(value) < 0) {
      throw new BadRequestException(`${field} must be greater than or equal to 0`);
    }
  }
  private assertNonNegativeAmount(value: number, field: string): void {
    if (this.roundAmount(value) < 0) {
      throw new BadRequestException(`${field} must be greater than or equal to 0`);
    }
  }
  private normalizeStockMovement(movement: StockMovementInput): StockMovementInput {
    return {
      ...movement,
      stockBucket: this.normalizeStockBucket(movement.stockBucket, 'movement.stockBucket'),
    };
  }
  private normalizeBatchStatus(
    value: string | null | undefined,
    field: string,
  ): (typeof ITEM_BATCH_STATUS_VALUES)[number] {
    const normalized = value?.trim().toUpperCase();
    const candidate = normalized as (typeof ITEM_BATCH_STATUS_VALUES)[number] | undefined;
    if (!candidate || !ITEM_BATCH_STATUS_SET.has(candidate)) {
      throw new BadRequestException(
        `${field} must be one of: ${ITEM_BATCH_STATUS_VALUES.join(', ')}`,
      );
    }
    return candidate;
  }
  private normalizeStockBucket(value: string | null | undefined, field: string): ItemStockBucket {
    const normalized = value?.trim().toUpperCase();
    const candidate = normalized as ItemStockBucket | undefined;
    if (!candidate || !ITEM_STOCK_BUCKET_SET.has(candidate)) {
      throw new BadRequestException(
        `${field} must be one of: ${ITEM_STOCK_BUCKET_VALUES.join(', ')}`,
      );
    }
    return candidate;
  }
  private toStockTrackingType(
    value: string | null | undefined,
  ): Prisma.ItemStockLedgerUncheckedCreateInput['stlTrackingType'] {
    const normalized = value?.trim().toUpperCase();
    const trackingType: Prisma.ItemStockLedgerUncheckedCreateInput['stlTrackingType'] = (
      normalized === 'BATCH' ? 'BATCH' : normalized === 'MRP' ? 'MRP' : 'NONE'
    ) as Prisma.ItemStockLedgerUncheckedCreateInput['stlTrackingType'];
    return trackingType;
  }
  private toBalanceTrackingType(
    value: string | null | undefined,
  ): Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'] {
    const normalized = value?.trim().toUpperCase();
    const trackingType: Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'] = (
      normalized === 'BATCH' ? 'BATCH' : normalized === 'MRP' ? 'MRP' : 'NONE'
    ) as Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'];
    return trackingType;
  }
  private isBatchManagedTrackingType(
    trackingType: Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'],
  ): boolean {
    return trackingType === 'BATCH' || trackingType === 'MRP';
  }
  private roundQuantity(value: number): number {
    return Number(value.toFixed(6));
  }
  private roundRate(value: number): number {
    return Number(value.toFixed(6));
  }
  private roundAmount(value: number): number {
    return Number(value.toFixed(2));
  }
  private sanitizeQty(value: number): number {
    const rounded = this.roundQuantity(value);
    return Math.abs(rounded) < 0.000001 ? 0 : rounded;
  }
  private sanitizeAmount(value: number): number {
    const rounded = this.roundAmount(value);
    return Math.abs(rounded) < 0.01 ? 0 : rounded;
  }
  private toNumber(value: Prisma.Decimal | number | null | undefined): number {
    if (value === undefined || value === null) {
      return 0;
    }
    return Number(value);
  }
  private parseRequiredDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date string`);
    }
    return parsed;
  }
  private parseOptionalDate(value: string | null | undefined, field: string): Date | null {
    if (value === undefined || value === null) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date string`);
    }
    return parsed;
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        'Duplicate item stock ledger or item stock balance rows are not allowed',
      );
    }
    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        'One or more referenced ids do not exist for the requested stock posting',
      );
    }
  }
  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2002';
  }
  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2003';
  }
}
