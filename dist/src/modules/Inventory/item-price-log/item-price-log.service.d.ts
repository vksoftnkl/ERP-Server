import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { GetItemPriceLogQueryDto, ItemPriceHistoryQueryDto, ItemPriceLogFilterDto, ItemPriceLogGapsQueryDto, ListItemPriceLogQueryDto } from './dto/item-price-log-query.dto';
import { type PriceChangeAction, type PriceChangeApp, type PriceChangeSource, type PriceRowSnapshot, type PriceTable } from './types/price-change-log.types';
export interface PriceLogRow {
    ipclId: string;
    changedOn: string;
    day: string;
    changeSetId: string;
    priceTable: PriceTable;
    rowId: string;
    action: PriceChangeAction;
    source: PriceChangeSource;
    menuId: number | null;
    companyId: string | null;
    branchId: string | null;
    branchName: string | null;
    itemId: string;
    itemCode: string | null;
    itemName: string | null;
    unitId: string | null;
    unitName: string | null;
    godownId: string | null;
    godownName: string | null;
    partyId: string | null;
    partyName: string | null;
    priceLevel: number | null;
    priceLevelName: string | null;
    bucketMrp: number | null;
    bucketSp: number | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    userId: string | null;
    userName: string | null;
    deviceId: string | null;
    deviceName: string | null;
    ip: string | null;
    app: PriceChangeApp | null;
    reason: string | null;
    changed: string[];
    changedLabels: string[];
    fields: PriceLogField[];
    oldPriceA: number | null;
    newPriceA: number | null;
    oldMrp: number | null;
    newMrp: number | null;
    oldCost: number | null;
    newCost: number | null;
    oldSlabPrice: number | null;
    newSlabPrice: number | null;
    slabFromQty: number | null;
    slabToQty: number | null;
    changePct: number | null;
}
export interface PriceLogField {
    column: string;
    label: string;
    before: unknown;
    after: unknown;
}
export interface PriceLogDetail extends PriceLogRow {
    before: PriceRowSnapshot | null;
    after: PriceRowSnapshot | null;
}
export interface PriceLogDay {
    day: string;
    changes: number;
    priceChanges: number;
    slabChanges: number;
    items: number;
    users: number;
    saves: number;
}
export interface PriceLogGap {
    priceTable: PriceTable;
    rowId: string;
    itemId: string;
    reason: 'NOT_LOGGED' | 'DIFFERS';
}
export interface PriceLogGaps {
    since: string | null;
    total: number;
    priceRows: number;
    slabRows: number;
    sample: PriceLogGap[];
}
export declare class ItemPriceLogService {
    private readonly prisma;
    private readonly requestContext;
    constructor(prisma: PrismaService, requestContext: RequestContextService);
    list(q: ListItemPriceLogQueryDto): Promise<{
        items: PriceLogRow[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    get(q: GetItemPriceLogQueryDto): Promise<PriceLogDetail>;
    days(q: ItemPriceLogFilterDto): Promise<PriceLogDay[]>;
    itemHistory(q: ItemPriceHistoryQueryDto): Promise<PriceLogRow[]>;
    gaps(q: ItemPriceLogGapsQueryDto): Promise<PriceLogGaps>;
    private assertCanView;
    private assertRange;
    private filterSql;
}
