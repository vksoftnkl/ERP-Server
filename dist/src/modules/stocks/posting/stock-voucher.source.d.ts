import { Prisma } from '@prisma/client';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import type { StockVoucherSourceInput } from './stock-line-source';
export declare class StockVoucherSource {
    private readonly input;
    readonly srcModule: "STOCK";
    readonly srcDocType: "STOCK_VOUCHER";
    constructor(input: StockVoucherSourceInput);
    get svhId(): string;
    get accYear(): string;
    get srcDocId(): string;
    get companyId(): string;
    get branchId(): string;
    get rules(): StockVoucherTypeRules;
    docDatetime(tx: Prisma.TransactionClient): Promise<Date | null>;
    godownIds(tx: Prisma.TransactionClient): Promise<string[]>;
}
