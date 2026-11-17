import { Prisma, type ItemPriceMaster } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { type PriceCallerScope, type ResolvedPrice } from '../../modules/Inventory/items-price-master/price-resolver';
import { ListMobileItemsQueryDto } from './dto/mobile-item.dto';
import type { MobileItemListPayload, MobileItemOptions } from './types/mobile-item-api.types';
type Num = Prisma.Decimal | string | number;
export declare const MOBILE_HIDDEN_PRICE_LEVEL = 7;
export declare function moneyText(value: Num | null | undefined): string | null;
export declare function qty3(value: Prisma.Decimal): number;
export declare function unitPriceAnswer<R extends ItemPriceMaster>(unitRows: readonly R[], onDate: string, caller: PriceCallerScope): ResolvedPrice<R> | null;
export declare class MobileItemService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    options(): Promise<MobileItemOptions>;
    list(q: ListMobileItemsQueryDto): Promise<MobileItemListPayload>;
    private toItem;
    private toUnit;
}
export {};
