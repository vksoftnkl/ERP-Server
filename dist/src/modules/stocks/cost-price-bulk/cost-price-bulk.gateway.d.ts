import { Prisma } from '@prisma/client';
import type { LeftOutReason } from './types/cost-price-bulk.types';
type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;
export interface CostBulkFilter {
    companyId: string;
    branchId: string;
    groupId?: string;
    itemCategoryId?: string;
    brandId?: string;
    sectionId?: string;
    supplierId?: string;
    profitType?: string;
    priceListOnly?: boolean;
    itemId?: string;
    itemIds?: readonly string[];
}
export interface CostBulkUnitRecord {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    barcode: string | null;
    itemIsActive: boolean;
    itemIsBatchBased: boolean;
    presetName: string | null;
    presetTracks: boolean;
    uomId: string;
    unitName: string | null;
    unitSlno: number;
    toBase: Prisma.Decimal;
    unitFactor: Prisma.Decimal;
    parentUomId: string | null;
    parentUnitName: string | null;
    parentToBase: Prisma.Decimal | null;
    ipmId: string | null;
    priceBranchId: string | null;
    companyShared: boolean;
    profitType: string | null;
    roundOff: Prisma.Decimal | null;
    costPrice: Prisma.Decimal | null;
    costWot: Prisma.Decimal | null;
    maxPrice: Prisma.Decimal | null;
    minPrice: Prisma.Decimal | null;
    priceA: Prisma.Decimal | null;
    priceB: Prisma.Decimal | null;
    priceC: Prisma.Decimal | null;
    priceD: Prisma.Decimal | null;
    wotA: Prisma.Decimal | null;
    wotB: Prisma.Decimal | null;
    wotC: Prisma.Decimal | null;
    wotD: Prisma.Decimal | null;
    markupA: Prisma.Decimal | null;
    markupB: Prisma.Decimal | null;
    markupC: Prisma.Decimal | null;
    markupD: Prisma.Decimal | null;
    updatedOn: string | null;
    rowToken: string | null;
    scheduledFrom: string | null;
    hasQtySlabs: boolean;
}
export interface CostBulkGridPage {
    rows: CostBulkUnitRecord[];
    total: number;
    totalItems: number;
}
export interface CostBulkLeftOutRecord {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    uomId: string | null;
    unitName: string | null;
    presetName: string | null;
    reason: LeftOutReason;
}
export interface CostBulkLevelInfo {
    level: 1 | 2 | 3 | 4;
    name: string;
    active: boolean;
}
export interface CostBulkLeftOutPage {
    rows: CostBulkLeftOutRecord[];
    total: number;
    counts: Record<LeftOutReason, number>;
}
export interface CostBulkLockedRecord {
    ipmId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitName: string | null;
    usable: boolean;
    current: boolean;
    itemIsActive: boolean;
    itemIsBatchBased: boolean;
    presetTracks: boolean;
    isChain: boolean;
    companyShared: boolean;
    rowToken: string;
    costPrice: Prisma.Decimal;
    maxPrice: Prisma.Decimal;
    minPrice: Prisma.Decimal;
    profitType: string;
    priceA: Prisma.Decimal;
    priceB: Prisma.Decimal;
    priceC: Prisma.Decimal;
    priceD: Prisma.Decimal;
}
export declare function rowTokenSql(alias: string): Prisma.Sql;
export declare class CostPriceBulkGateway {
    private unitsStatement;
    listGrid(client: Client, filter: CostBulkFilter, page: {
        limit: number;
        offset: number;
    }): Promise<CostBulkGridPage>;
    listLeftOut(client: Client, filter: CostBulkFilter, limit: number): Promise<CostBulkLeftOutPage>;
    findItem(client: Client, companyId: string, branchId: string, itemId: string): Promise<{
        itemId: string;
        itemCode: string | null;
        itemName: string;
        isActive: boolean;
        isBatchBased: boolean;
        presetName: string | null;
        presetTracks: boolean;
    } | null>;
    readRowsForSave(tx: Client, companyId: string, branchId: string, ipmIds: readonly string[], lock: boolean): Promise<Map<string, CostBulkLockedRecord>>;
    levels(client: Client): Promise<CostBulkLevelInfo[]>;
    today(client: Client): Promise<string>;
}
export {};
