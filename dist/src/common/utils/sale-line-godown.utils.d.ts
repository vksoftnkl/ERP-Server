import { Prisma } from '@prisma/client';
export type SaleGodownReader = Pick<Prisma.TransactionClient, 'branchMaster' | 'godownLocation' | 'itemPriceMaster'>;
export type SaleGodown = {
    gdlId: string;
    gdlName: string;
    gdlNegativeStock: boolean;
};
export type SaleGodownLine = {
    itemId: string;
    iucId: string;
};
export declare const saleGodownKey: (line: SaleGodownLine) => string;
export declare function branchDefaultGodownId(prisma: SaleGodownReader, branchId: string): Promise<string | null>;
export declare function resolveDefaultSaleGodowns(prisma: SaleGodownReader, branchId: string, lines: readonly SaleGodownLine[]): Promise<Map<string, SaleGodown | null>>;
export declare function saleLineAllowsNegativeStock(item: {
    itemIsService: boolean;
    itemAllowNegStock: boolean;
}, godownAllowsNegStock: boolean | null | undefined, companyAllowsNegStock: boolean | null | undefined): boolean;
