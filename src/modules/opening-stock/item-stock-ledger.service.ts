import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  ItemStockBalance as PrismaItemStockBalance,
  ItemStockLedger as PrismaItemStockLedger,
  Prisma as PrismaNamespace,
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

      await tx.itemStockLedger.deleteMany({
        where: {
          stlVoucherId: document.header.avh_voucher_id,
        },
      });

      if (previousDocument) {
        await this.deleteBalanceRowsForDocument(tx, previousDocument);
      }

      const itemStockLedger = await Promise.all(
        document.details.map((detail, index) =>
          tx.itemStockLedger.create({
            data: this.buildLedgerCreateInput(document.header, detail, index, actorUserId, now),
          }),
        ),
      );

      const balanceInputs = this.buildBalanceCreateInputs(document.header, document.details, actorUserId, now);

      const itemStockBalance = await Promise.all(
        balanceInputs.map((data) => {
          const stockBucket = data.isbStockBucket ?? ItemStockBucket.SALEABLE;

          return tx.itemStockBalance.upsert({
            where: {
              isbAccYear_isbCompanyId_isbBranchId_isbGodownId_isbItemId_isbUnitId_isbStockBucket: {
                isbAccYear: data.isbAccYear,
                isbCompanyId: data.isbCompanyId,
                isbBranchId: data.isbBranchId,
                isbGodownId: data.isbGodownId,
                isbItemId: data.isbItemId,
                isbUnitId: data.isbUnitId,
                isbStockBucket: stockBucket,
              },
            },
            create: {
              ...data,
              isbStockBucket: stockBucket,
            },
            update: {
              isbTrackingType: data.isbTrackingType,
              isbOpeningQty: data.isbOpeningQty,
              isbInQty: data.isbInQty,
              isbOutQty: data.isbOutQty,
              isbClosingQty: data.isbClosingQty,
              isbOpeningFreeQty: data.isbOpeningFreeQty,
              isbFreeInQty: data.isbFreeInQty,
              isbFreeOutQty: data.isbFreeOutQty,
              isbFreeClosingQty: data.isbFreeClosingQty,
              isbReservedQty: data.isbReservedQty,
              isbTransitQty: data.isbTransitQty,
              isbAvailableQty: data.isbAvailableQty,
              isbOpeningAvgRate: data.isbOpeningAvgRate,
              isbAvgStockRate: data.isbAvgStockRate,
              isbOpeningValue: data.isbOpeningValue,
              isbStockValue: data.isbStockValue,
              isbLastInDate: data.isbLastInDate,
              isbLastOutDate: data.isbLastOutDate,
              isbSyncDate: data.isbSyncDate,
              isbUpdatedOn: data.isbUpdatedOn,
              isbUpdatedBy: data.isbUpdatedBy,
            },
          });
        }),
      );

      return {
        itemStockLedger,
        itemStockBalance,
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
      stlPostedOn: this.parseOptionalDate(header.osh_updated_on ?? header.osh_created_on, 'header.osh_created_on') ?? now,
      stlDocRefNo: header.osh_ref_no ?? header.osh_voucher_no ?? null,
      stlItemId: detail.osl_item_id,
      stlTrackingType: this.toStockTrackingType(detail.osl_tracking_type),
      stlUomId: detail.osl_unit_id,
      stlBaseUomId: detail.osl_base_uom_id ?? detail.osl_unit_id,
      stlConversionFactor: conversionFactor,
      stlBatchId: null,
      stlBatchNo: detail.osl_batch_no ?? null,
      stlMfgDate: this.parseOptionalDate(detail.osl_mfg_date, `details[${index}].osl_mfg_date`),
      stlExpiryDate: this.parseOptionalDate(
        detail.osl_expiry_date,
        `details[${index}].osl_expiry_date`,
      ),
      stlQty: detail.osl_qty ?? 0,
      stlBaseQty: detail.osl_base_qty ?? 0,
      stlFreeQty: freeQty,
      stlFreeBaseQty: this.roundQuantity(freeQty * conversionFactor),
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

  private buildBalanceCreateInputs(
    header: OpeningStockHeaderPayload,
    details: OpeningStockDetailPayload[],
    actorUserId: string | null,
    now: Date,
  ): Prisma.ItemStockBalanceUncheckedCreateInput[] {
    const grouped = new Map<string, OpeningStockDetailPayload[]>();

    for (const detail of details) {
      const stockBucket = ItemStockBucket.SALEABLE;
      const key = [
        detail.osl_acc_year,
        detail.osl_company_id,
        detail.osl_branch_id,
        detail.osl_godown_id,
        detail.osl_item_id,
        detail.osl_unit_id,
        stockBucket,
      ].join('|');
      const existing = grouped.get(key) ?? [];
      existing.push(detail);
      grouped.set(key, existing);
    }

    return Array.from(grouped.values()).map((group) =>
      this.buildBalanceCreateInput(header, group, actorUserId, now),
    );
  }

  private buildBalanceCreateInput(
    header: OpeningStockHeaderPayload,
    details: OpeningStockDetailPayload[],
    actorUserId: string | null,
    now: Date,
  ): Prisma.ItemStockBalanceUncheckedCreateInput {
    const [firstDetail] = details;
    const openingQty = this.roundQuantity(
      details.reduce((sum, detail) => sum + (detail.osl_qty ?? 0), 0),
    );
    const openingFreeQty = this.roundQuantity(
      details.reduce((sum, detail) => sum + (detail.osl_free_qty ?? 0), 0),
    );
    const openingValue = this.roundAmount(
      details.reduce((sum, detail) => sum + (detail.osl_stock_value ?? 0), 0),
    );
    const averageRate = openingQty === 0 ? 0 : this.roundRate(openingValue / openingQty);

    return {
      isbAccYear: firstDetail.osl_acc_year,
      isbCompanyId: firstDetail.osl_company_id,
      isbBranchId: firstDetail.osl_branch_id,
      isbGodownId: firstDetail.osl_godown_id,
      isbItemId: firstDetail.osl_item_id,
      isbUnitId: firstDetail.osl_unit_id,
      isbTrackingType: this.toBalanceTrackingType(firstDetail.osl_tracking_type),
      isbStockBucket: ItemStockBucket.SALEABLE,
      isbOpeningQty: openingQty,
      isbInQty: 0,
      isbOutQty: 0,
      isbClosingQty: openingQty,
      isbOpeningFreeQty: openingFreeQty,
      isbFreeInQty: 0,
      isbFreeOutQty: 0,
      isbFreeClosingQty: openingFreeQty,
      isbReservedQty: 0,
      isbTransitQty: 0,
      isbAvailableQty: openingQty,
      isbOpeningAvgRate: averageRate,
      isbAvgStockRate: averageRate,
      isbOpeningValue: openingValue,
      isbStockValue: openingValue,
      isbLastInDate: this.parseOptionalDate(header.osh_voucher_date, 'header.osh_voucher_date'),
      isbLastOutDate: null,
      isbSyncDate: null,
      isbCreatedOn:
        this.parseOptionalDate(header.osh_created_on, 'header.osh_created_on') ?? now,
      isbCreatedBy: header.osh_created_by ?? actorUserId,
      isbUpdatedOn: this.parseOptionalDate(header.osh_updated_on, 'header.osh_updated_on'),
      isbUpdatedBy: header.osh_updated_by ?? null,
    };
  }

  private async deleteBalanceRowsForDocument(
    tx: Prisma.TransactionClient,
    document: OpeningStockDocumentPayload,
  ): Promise<void> {
    const uniqueScopes = new Map<
      string,
      PrismaNamespace.ItemStockBalanceWhereInput
    >();

    for (const detail of document.details) {
      const scope = {
        isbAccYear: detail.osl_acc_year,
        isbCompanyId: detail.osl_company_id,
        isbBranchId: detail.osl_branch_id,
        isbGodownId: detail.osl_godown_id,
        isbItemId: detail.osl_item_id,
        isbUnitId: detail.osl_unit_id,
        isbStockBucket: ItemStockBucket.SALEABLE,
      };
      uniqueScopes.set(Object.values(scope).join('|'), scope);
    }

    if (uniqueScopes.size === 0) {
      return;
    }

    await tx.itemStockBalance.deleteMany({
      where: {
        OR: Array.from(uniqueScopes.values()),
      },
    });
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
