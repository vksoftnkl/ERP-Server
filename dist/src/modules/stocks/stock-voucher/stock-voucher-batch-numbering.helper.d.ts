import { Prisma } from '@prisma/client';
import type { SaveStockVoucherItemDto } from './dto/save-stock-voucher-item.dto';
export declare const AUTO_BATCH_NO_SETTING = "stock.auto_batch_no";
export declare const BATCH_VOUCHER_TYPE_CODE = "BATCH";
export interface AutoBatchNoScope {
    companyId: string;
    branchId: string;
    accYear: string;
    docDate: string;
    svhId?: string | null;
}
type AutoBatchLine = Pick<SaveStockVoucherItemDto, 'sviId' | 'itemId' | 'batchNo'>;
export declare function assignAutoBatchNumbers<T extends AutoBatchLine>(tx: Prisma.TransactionClient, scope: AutoBatchNoScope, lines: readonly T[]): Promise<{
    lines: T[];
    numbered: Set<number>;
}>;
export declare function autoBatchNoIsOn(tx: Prisma.TransactionClient, companyId: string, branchId: string): Promise<boolean>;
export {};
