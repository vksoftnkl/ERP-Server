export enum StockTrackingType {
   NONE = 'NONE',
  MRP ="MRP",
  BATCH = 'BATCH',
}

export enum StockTxnType {
  OPENING = 'OPENING',
  PURCHASE = 'PURCHASE',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  SALE = 'SALE',
  SALES_RETURN = 'SALES_RETURN',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  PRODUCTION_IN = 'PRODUCTION_IN',
  CONSUMPTION = 'CONSUMPTION',
  DAMAGE = 'DAMAGE',
  EXPIRED = 'EXPIRED',
}

export interface ItemStockLedger {
  stlId: string;
  stlAccYear: string;
  stlCompanyId: string;
  stlBranchId: string;
  stlGodownId: string;
  stlVoucherId: string;
  stlVoucherDate: Date;
  stlLineNo: number;
  stlSplitNo: number;
  stlVoucherTypeId: number;
  stlTxnType: StockTxnType;
  stlStockEffect: number;
  stlDocDate: Date;
  stlPostedOn: Date;
  stlDocRefNo: string | null;
  stlItemId: string;
  stlTrackingType: StockTrackingType;
  stlUomId: string;
  stlBaseUomId: string;
  stlConversionFactor: number;
  stlBatchId: string | null;
  stlBatchNo: string | null;
  stlMfgDate: Date | null;
  stlExpiryDate: Date | null;
  stlQty: number;
  stlBaseQty: number;
  stlFreeQty: number;
  stlFreeBaseQty: number;
  stlStockRate: number;
  stlStockValue: number;
  stlLandedCostRate: number;
  stlLandedCostValue: number;
  stlDocRateWot: number;
  stlDocAmountWot: number;
  stlNarration: string | null;
  stlIsActive: boolean;
  stlIsDeleted: boolean;
  stlSyncedOn: Date | null;
  stlCreatedOn: Date;
  stlCreatedBy: string | null;
}

export enum ItemStockBalanceTrackingType {
  NONE = 'NONE',
  MRP ="MRP",
  BATCH = 'BATCH',
}

export enum ItemStockBucket {
  SALEABLE = 'SALEABLE',
  DAMAGED = 'DAMAGED',
  EXPIRED = 'EXPIRED',
  HOLD = 'HOLD',
  RETURN = 'RETURN',
}

export interface ItemStockBalance {
  isbId: string;
  isbAccYear: string;
  isbCompanyId: string;
  isbBranchId: string;
  isbGodownId: string;
  isbItemId: string;
  isbUnitId: string;
  isbTrackingType: ItemStockBalanceTrackingType;
  isbStockBucket: ItemStockBucket;
  isbOpeningQty: number;
  isbInQty: number;
  isbOutQty: number;
  isbClosingQty: number;
  isbOpeningFreeQty: number;
  isbFreeInQty: number;
  isbFreeOutQty: number;
  isbFreeClosingQty: number;
  isbReservedQty: number;
  isbTransitQty: number;
  isbAvailableQty: number;
  isbOpeningAvgRate: number;
  isbAvgStockRate: number;
  isbOpeningValue: number;
  isbStockValue: number;
  isbLastInDate: Date | null;
  isbLastOutDate: Date | null;
  isbSyncDate: Date | null;
  isbCreatedOn: Date;
  isbCreatedBy: string | null;
  isbUpdatedOn: Date | null;
  isbUpdatedBy: string | null;
}
