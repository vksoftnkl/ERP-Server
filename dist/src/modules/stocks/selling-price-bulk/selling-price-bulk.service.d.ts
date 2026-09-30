import { Prisma } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { AppSettingValueService } from "../../settings/appSettings/app-setting-value.service";
import { ListSellingPriceQueryDto } from './dto/list-selling-price-query.dto';
import { PriceBucketsQueryDto } from './dto/price-buckets-query.dto';
import { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import { type ScopeResolution } from './selling-price-scope.helper';
import { PriceBucketGateway, type BucketPriceCandidate } from './price-bucket.gateway';
import { type ItemTaxRate, type PagedResult, type SellingPriceRow, type SellingPriceSaveResult } from './types/selling-price-bulk.types';
export interface AppliedBucketPrice {
    ipmId: string;
    before: Prisma.JsonObject | null;
    lineNo: number;
    itemName: string;
}
export declare class SellingPriceBulkService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContext;
    private readonly appSettingValueService;
    private readonly gateway;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContext: RequestContextService, appSettingValueService: AppSettingValueService, gateway: PriceBucketGateway);
    listPrices(queryDto: ListSellingPriceQueryDto): Promise<PagedResult<SellingPriceRow>>;
    listBuckets(itemId: string, queryDto: PriceBucketsQueryDto): Promise<SellingPriceRow[]>;
    saveBulk(dto: SaveSellingPriceBulkDto): Promise<SellingPriceSaveResult>;
    buildSaveMessage(result: SellingPriceSaveResult): string;
    applyBucketPrice(tx: Prisma.TransactionClient, candidate: BucketPriceCandidate, scope: ScopeResolution): Promise<AppliedBucketPrice>;
    private auditWrites;
    private assertScopeAllowed;
    private resolveBelowCostPolicy;
    private rowScopeOf;
    private assertUnitsBelong;
    private assertOneRowPerBucket;
    private toCandidate;
    private toGridRows;
    private throwProblems;
    resolveItemTaxRates(tx: Pick<Prisma.TransactionClient, 'itemMaster' | 'itemTaxHistory' | 'taxRateMaster'>, itemIds: readonly string[], asOf?: Date): Promise<Map<string, ItemTaxRate>>;
}
