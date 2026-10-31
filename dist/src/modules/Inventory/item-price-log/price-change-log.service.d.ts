import { Prisma } from '@prisma/client';
import { RequestContextService } from "../../../common/request-context/request-context.service";
import type { PriceChangeApp, PriceChangeEntry, PriceRowSnapshot, PriceTable } from './types/price-change-log.types';
type Client = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
export declare class PriceChangeLogService {
    private readonly requestContext;
    private readonly changeSets;
    constructor(requestContext: RequestContextService);
    snapshot(tx: Client, table: PriceTable, ids: readonly string[]): Promise<Map<string, PriceRowSnapshot>>;
    record(tx: Client, entry: PriceChangeEntry): Promise<boolean>;
    private changeSetOf;
    private resolveChangeSet;
}
export declare function appOf(userId: string | null, deviceType: string | null): PriceChangeApp;
export {};
