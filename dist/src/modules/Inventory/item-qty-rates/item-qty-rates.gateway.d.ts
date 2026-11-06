import { ItemPriceMaster, ItemQtyPrice, Prisma } from '@prisma/client';
type Client = Pick<Prisma.TransactionClient, '$queryRaw' | 'itemPriceMaster' | 'itemQtyPrice' | 'itemMaster'>;
export interface QtyRatesUnitRecord {
    uomId: string;
    unitName: string | null;
    unitSlno: number;
    toBase: Prisma.Decimal;
    unitFactor: Prisma.Decimal;
    parentUomId: string | null;
    parentUnitName: string | null;
    parentToBase: Prisma.Decimal | null;
}
export interface QtyRatesLevelRecord {
    level: number;
    name: string;
    short: string | null;
    active: boolean;
}
export declare class ItemQtyRatesGateway {
    lockItem(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, itemId: string): Promise<void>;
    levels(client: Pick<Prisma.TransactionClient, '$queryRaw'>): Promise<QtyRatesLevelRecord[]>;
    units(client: Pick<Prisma.TransactionClient, '$queryRaw'>, itemId: string): Promise<QtyRatesUnitRecord[]>;
    priceRows(client: Pick<Prisma.TransactionClient, 'itemPriceMaster'>, itemId: string, companyId: string, branchId: string): Promise<ItemPriceMaster[]>;
    liveSlabs(client: Pick<Prisma.TransactionClient, 'itemQtyPrice'>, itemId: string): Promise<ItemQtyPrice[]>;
    barcode(client: Pick<Prisma.TransactionClient, 'itemMaster'>, itemId: string): Promise<string | null>;
    groupAndBrand(client: Pick<Prisma.TransactionClient, '$queryRaw'>, itemId: string): Promise<{
        groupName: string | null;
        brandName: string | null;
    }>;
    today(client: Pick<Prisma.TransactionClient, '$queryRaw'>): Promise<string>;
}
export type { Client as QtyRatesClient };
