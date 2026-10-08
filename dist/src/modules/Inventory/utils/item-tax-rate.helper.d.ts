import { Prisma } from '@prisma/client';
export interface ItemTaxRate {
    itemId: string;
    taxId: string | null;
    taxPerc: number;
    inclTax: boolean;
    hasCess: boolean;
}
export declare function resolveItemTaxRates(tx: Pick<Prisma.TransactionClient, 'itemMaster' | 'itemTaxHistory' | 'taxRateMaster'>, itemIds: readonly string[], asOf?: Date): Promise<Map<string, ItemTaxRate>>;
