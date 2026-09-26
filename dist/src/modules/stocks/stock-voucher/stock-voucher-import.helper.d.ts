import { PrismaService } from "../../../database/prisma/prisma.service";
import type { SaveStockVoucherItemDto } from './dto/save-stock-voucher-item.dto';
import type { StockErrorDetail } from './types/stock-voucher.types';
export interface ImportScope {
    companyId: string;
    branchId: string;
    defaultGodownId: string;
}
export interface ImportResult {
    lines: SaveStockVoucherItemDto[];
    errors: StockErrorDetail[];
    rowsRead: number;
}
export declare function resolveImportedLines(prisma: PrismaService, csvText: string, scope: ImportScope): Promise<ImportResult>;
