import { type StockBucket } from '../../stock-voucher/types/stock-voucher.types';
export declare const LOT_BY_BATCH_BUCKETS: readonly ["SALEABLE", "DAMAGED", "QUARANTINE", "EXPIRED", "SAMPLE", "ALL"];
export type LotByBatchBucket = StockBucket | 'ALL';
export declare class LotByBatchQueryDto {
    companyId: string;
    branchId: string;
    batchNo: string;
    includeEmpty?: boolean;
    bucket?: LotByBatchBucket;
    godownId?: string;
}
