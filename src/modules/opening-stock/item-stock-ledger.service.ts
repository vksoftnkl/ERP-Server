import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  ItemBatchStock as PrismaItemBatchStock,
  ItemStockBalance as PrismaItemStockBalance,
  ItemStockLedger as PrismaItemStockLedger,
  Prisma,
} from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  OpeningStockDetailPayload,
  OpeningStockDocumentPayload,
  OpeningStockHeaderPayload,
} from './types/opening-stock-api.types';
import {
  ItemStockBucket,
  StockTxnType,
} from './types/item-stock.types';
export type CreatedItemStockPosting = {
  itemStockLedger: PrismaItemStockLedger[];
  itemStockBalance: PrismaItemStockBalance[];
  itemBatchStock: PrismaItemBatchStock[];
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
      const currentMovements = this.buildOpeningStockMovements(resolvedDocument, 1);
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
      stlIsActive: detail.osl_is_active,
      stlIsDeleted: detail.osl_is_deleted,
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
    return document.details.map((detail) => {
      const conversionFactor = detail.osl_conv_factor ?? 1;
      const qty = this.roundQuantity(
        (detail.osl_base_qty ?? (detail.osl_qty ?? 0) * conversionFactor) * direction,
      );
      const freeQty = this.roundQuantity(
        ((detail.osl_free_qty ?? 0) * conversionFactor) * direction,
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
        stockBucket: ItemStockBucket.SALEABLE,
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
    const details = await Promise.all(
      document.details.map(async (detail) => {
        if (this.toBalanceTrackingType(detail.osl_tracking_type) !== 'BATCH') {
          return detail;
        }
        const batchId = await this.resolveOrCreateBatchId(tx, detail, actorUserId, now);
        if (persistResolvedBatchIds && detail.osl_batch_id !== batchId) {
          await tx.openingStockDetail.update({
            where: { oslId: detail.osl_id },
            data: {
              oslBatchId: batchId,
              oslUpdatedOn: now,
              oslUpdatedBy: actorUserId,
            },
          });
        }
        return {
          ...detail,
          osl_batch_id: batchId,
        };
      }),
    );
    return {
      ...document,
      details,
    };
  }
  private async resolveOrCreateBatchId(
    tx: Prisma.TransactionClient,
    detail: OpeningStockDetailPayload,
    actorUserId: string | null,
    now: Date,
  ): Promise<string> {
    if (detail.osl_batch_id) {
      return detail.osl_batch_id;
    }
    const batchNo = detail.osl_batch_no?.trim();
    if (!batchNo) {
      throw new BadRequestException(
        'Batch-tracked stock movement requires batch no when batch id is not provided',
      );
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
    });
    if (existingBatch) {
      return existingBatch.btmId;
    }
    const batchDate = this.parseOptionalDate(detail.osl_batch_date, 'detail.osl_batch_date');
    const mfgDate = this.parseOptionalDate(detail.osl_mfg_date, 'detail.osl_mfg_date');
    const expiryDate = this.parseOptionalDate(detail.osl_expiry_date, 'detail.osl_expiry_date');
    const physicalQty = this.roundQuantity(
      (detail.osl_base_qty ?? (detail.osl_qty ?? 0) * (detail.osl_conv_factor ?? 1)) +
        (detail.osl_free_qty ?? 0) * (detail.osl_conv_factor ?? 1),
    );
    const lastPurchaseRateWot =
      physicalQty > 0
        ? this.roundRate((detail.osl_stock_value_wot ?? 0) / physicalQty)
        : 0;
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
        btmStatus: 'ACTIVE',
        btmCreatedOn: now,
        btmCreatedBy: actorUserId,
        btmUpdatedOn: now,
        btmUpdatedBy: actorUserId,
      },
    });
    return createdBatch.btmId;
  }
  private async applyStockMovements(
    tx: Prisma.TransactionClient,
    movements: StockMovementInput[],
    actorUserId: string | null,
    now: Date,
  ): Promise<Pick<CreatedItemStockPosting, 'itemStockBalance' | 'itemBatchStock'>> {
    const stockBalances = new Map<string, PrismaItemStockBalance>();
    const batchStocks = new Map<string, PrismaItemBatchStock>();
    for (const movement of movements) {
      if (movement.trackingType === 'BATCH') {
        if (!movement.batchId) {
          throw new BadRequestException('Batch-tracked stock movement requires batch id');
        }
        const batchRow = await this.applyBatchMovement(tx, movement, actorUserId, now);
        if (batchRow) {
          batchStocks.set(this.buildBatchScopeKey(movement), batchRow);
        }
        const summaryRow = await this.rollupBatchToItemSummary(tx, movement, actorUserId, now);
        if (summaryRow) {
          stockBalances.set(this.buildSummaryScopeKey(movement), summaryRow);
        }
        continue;
      }
      const summaryRow = await this.applySummaryMovement(tx, movement, actorUserId, now);
      stockBalances.set(this.buildSummaryScopeKey(movement), summaryRow);
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
  ): Promise<PrismaItemStockBalance> {
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
    const existing = await tx.itemStockBalance.findUnique({ where });
    const nextState = this.applyMovementToState(
      existing ? this.toStateFromStockBalance(existing) : this.createEmptyState(),
      movement,
    );
    return tx.itemStockBalance.upsert({
      where,
      create: this.buildStockBalanceCreateInput(movement, nextState, actorUserId, now),
      update: this.buildStockBalanceUpdateInput(movement, nextState, actorUserId, now),
    });
  }
  private async applyBatchMovement(
    tx: Prisma.TransactionClient,
    movement: StockMovementInput,
    actorUserId: string | null,
    now: Date,
  ): Promise<PrismaItemBatchStock | null> {
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
    const existing = await tx.itemBatchStock.findUnique({ where });
    if (!existing && this.isReverseOpeningMovement(movement)) {
      return null;
    }
    const nextState = this.applyMovementToState(
      existing ? this.toStateFromBatchStock(existing) : this.createEmptyState(),
      movement,
    );
    return tx.itemBatchStock.upsert({
      where,
      create: this.buildBatchStockCreateInput(movement, nextState, actorUserId, now),
      update: this.buildBatchStockUpdateInput(movement, nextState, actorUserId, now),
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
  ): Promise<PrismaItemStockBalance | null> {
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
      tx.itemStockBalance.findUnique({ where }),
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
    });
  }
  private aggregateBatchStates(rows: PrismaItemBatchStock[]): StockEngineState {
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
      state.reservedQty = this.roundQuantity(
        state.reservedQty + this.toNumber(row.ibsReservedQty),
      );
      state.openingValue = this.roundAmount(
        state.openingValue + this.toNumber(row.ibsOpeningValue),
      );
      state.stockValue = this.roundAmount(
        state.stockValue + this.toNumber(row.ibsStockValue),
      );
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
      nextState.openingValueWot = this.roundAmount(
        nextState.openingValueWot + inwardValueWot,
      );
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
      nextState.openingAvgRateWot = this.roundRate(
        nextState.openingValueWot / physicalOpeningQty,
      );
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
  private getMovementCategory(
    movementType: StockTxnType,
  ): 'OPENING' | 'INWARD' | 'OUTWARD' {
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
  private toStateFromStockBalance(row: PrismaItemStockBalance): StockEngineState {
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
  private toStateFromBatchStock(row: PrismaItemBatchStock): StockEngineState {
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
    existingSummary: PrismaItemStockBalance | null,
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
  private toStockTrackingType(
    value: string | null | undefined,
  ): Prisma.ItemStockLedgerUncheckedCreateInput['stlTrackingType'] {
    const normalized = value?.trim().toUpperCase();
    const trackingType: Prisma.ItemStockLedgerUncheckedCreateInput['stlTrackingType'] =
      (normalized === 'BATCH' ? 'BATCH' : normalized === 'MRP' ? 'MRP' : 'NONE') as
        Prisma.ItemStockLedgerUncheckedCreateInput['stlTrackingType'];
    return trackingType;
  }
  private toBalanceTrackingType(
    value: string | null | undefined,
  ): Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'] {
    const normalized = value?.trim().toUpperCase();
    const trackingType: Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'] =
      (normalized === 'BATCH' ? 'BATCH' : normalized === 'MRP' ? 'MRP' : 'NONE') as
        Prisma.ItemStockBalanceUncheckedCreateInput['isbTrackingType'];
    return trackingType;
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