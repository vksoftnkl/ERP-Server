import { Prisma } from '@prisma/client';
import { AppSettingValueService } from "../../settings/appSettings/app-setting-value.service";
import { type BucketKey } from './price-resolver';
export declare const DEFAULT_PRICE_LEVEL_SETTING_KEY = "sales.default_price_level";
export interface PriceBucketSource {
    companyId: string | null;
    branchId: string | null;
    maxPrice: number;
    prices: readonly [number, number, number, number];
}
type ReadClient = Pick<Prisma.TransactionClient, '$queryRaw' | 'itemMaster'>;
export declare function todayIso(now?: Date): string;
export declare class PriceBucketService {
    private readonly appSettingValueService;
    constructor(appSettingValueService: AppSettingValueService);
    deriveBuckets(client: ReadClient, itemId: string, rows: readonly PriceBucketSource[], onDate?: string): Promise<BucketKey[]>;
    rekeyItem(tx: Prisma.TransactionClient, itemId: string): Promise<number>;
    private defaultPriceLevel;
}
export declare function toBucketSource(row: {
    ipmCompanyId: string | null;
    ipmBranchId: string | null;
    ipmMaxPrice: Prisma.Decimal | number;
    ipmSalesPriceA: Prisma.Decimal | number;
    ipmSalesPriceB: Prisma.Decimal | number;
    ipmSalesPriceC: Prisma.Decimal | number;
    ipmSalesPriceD: Prisma.Decimal | number;
}): PriceBucketSource;
export {};
