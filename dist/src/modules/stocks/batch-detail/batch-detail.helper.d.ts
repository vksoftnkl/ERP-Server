import { Prisma } from '@prisma/client';
import type { StockErrorDetail } from '../stock-voucher/types/stock-voucher.types';
export declare const BATCH_DETAIL_ID_NAMESPACE = "8c3d5e21-7a4f-4b90-9e16-2f5a0d7c4b38";
export declare function foldBatchNo(batchNo: string): string;
export declare function batchDetailId(companyId: string, batchNo: string): string;
export interface BatchDetailLine {
    lineNo: number;
    splitNo?: number;
    sizeId?: string | null;
    colourId?: string | null;
    model?: string | null;
}
export interface BatchDetailSource {
    companyId: string;
    accYear: string;
    srcDocType: string;
    srcDocId: string;
    actor: string | null;
}
export declare function syncBatchDetails(tx: Prisma.TransactionClient, source: BatchDetailSource, lines: readonly BatchDetailLine[], numbered: ReadonlySet<number>): Promise<void>;
export declare function softDeleteBatchDetailsOf(tx: Prisma.TransactionClient, srcDocId: string, actor: string | null): Promise<void>;
export declare function unknownSizesAndColours(client: Pick<Prisma.TransactionClient, '$queryRaw'>, companyId: string, lines: readonly Pick<BatchDetailLine, 'sizeId' | 'colourId'>[], fieldOf?: (index: number, column: 'sizeId' | 'colourId') => string): Promise<StockErrorDetail[]>;
export interface BatchDetailView {
    sizeId: string | null;
    sizeName: string | null;
    colourId: string | null;
    colourName: string | null;
    model: string | null;
}
export declare function batchDetailsFor(client: Pick<Prisma.TransactionClient, '$queryRaw'>, companyId: string, lines: readonly {
    itemId: string | null | undefined;
    batchNo: string | null | undefined;
}[]): Promise<Map<string, BatchDetailView>>;
export declare function batchDetailKey(itemId: string, batchNo: string): string;
export declare function withBatchDetails<T extends Record<string, unknown>>(client: Pick<Prisma.TransactionClient, '$queryRaw'>, companyId: string, prefix: string, rows: readonly T[]): Promise<(T & Record<string, string | null>)[]>;
