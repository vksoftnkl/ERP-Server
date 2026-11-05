import { PrismaService } from "../../../database/prisma/prisma.service";
import { type Tx } from '../common/purchase-doc.helpers';
export declare const SISTER: {
    readonly ALREADY_PULLED: "SISTER_BILL_ALREADY_PULLED";
    readonly ITEM_NOT_SHARED: "ITEM_NOT_SHARED";
    readonly NOT_A_SISTER_BILL: "SISTER_BILL_INVALID";
    readonly SUPPLIER_MISMATCH: "SISTER_SUPPLIER_MISMATCH";
    readonly SALE_BILL_PULLED: "SALE_BILL_PULLED_BY_SISTER";
};
export declare class SisterBillListQueryDto {
    companyId: string;
    branchId: string;
}
export declare class SisterBillLinesQueryDto extends SisterBillListQueryDto {
    sbId: string;
    accYear: string;
}
type Raw = Record<string, unknown>;
export declare class PurchaseSisterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private get db();
    list(q: SisterBillListQueryDto): Promise<{
        sbId: unknown;
        accYear: unknown;
        refno: unknown;
        billDate: string | null;
        amount: unknown;
        items: unknown;
        sisterCompanyId: unknown;
        sisterCompanyName: unknown;
        sisterGstin: unknown;
        supplierId: string | null;
        supplierName: string | null;
        blocked: string | null;
    }[]>;
    lines(q: SisterBillLinesQueryDto): Promise<{
        bill: Raw;
        lines: Raw[];
    }>;
}
export declare function recordSisterPull(tx: Tx, a: {
    companyId: string;
    supplierId: string;
    piId: string;
    accYear: string;
}, lines: {
    lineNo: number;
    itemId: string;
    sisterSaleItemId?: string;
    sisterSaleItemAccYear?: string;
}[]): Promise<void>;
export declare function assertSaleBillNotPulled(db: Tx, sbId: string): Promise<void>;
export declare class PurchaseSisterController {
    private readonly service;
    constructor(service: PurchaseSisterService);
    list(q: SisterBillListQueryDto): Promise<{
        success: boolean;
        message: string;
        data: {
            sbId: unknown;
            accYear: unknown;
            refno: unknown;
            billDate: string | null;
            amount: unknown;
            items: unknown;
            sisterCompanyId: unknown;
            sisterCompanyName: unknown;
            sisterGstin: unknown;
            supplierId: string | null;
            supplierName: string | null;
            blocked: string | null;
        }[];
    }>;
    lines(q: SisterBillLinesQueryDto): Promise<{
        success: boolean;
        message: string;
        data: {
            bill: Raw;
            lines: Raw[];
        };
    }>;
}
export {};
