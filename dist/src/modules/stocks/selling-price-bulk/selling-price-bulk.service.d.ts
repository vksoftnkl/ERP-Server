import { Prisma } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { AppSettingValueService } from "../../settings/appSettings/app-setting-value.service";
import { ListSellingPriceQueryDto } from './dto/list-selling-price-query.dto';
import { PriceBucketsQueryDto } from './dto/price-buckets-query.dto';
import { PriceScheduleQueryDto } from './dto/price-schedule-query.dto';
import { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import { type ScopeResolution } from './selling-price-scope.helper';
import { PriceBucketGateway, type BucketPriceCandidate } from './price-bucket.gateway';
import { type ItemTaxRate, type PagedResult, type SellingPriceRow, type SellingPriceSaveResult, type SellingPriceScheduleCancelResult, type SellingPriceScheduleRow } from './types/selling-price-bulk.types';
import { PriceMasterWriter } from '../../Inventory/item-price-log/price-master-writer.service';
import { type PriceWriteOrigin } from '../../Inventory/item-price-log/types/price-change-log.types';
export interface AppliedBucketPrice {
    ipmId: string;
    before: Prisma.JsonObject | null;
    lineNo: number;
    itemName: string;
    closed?: {
        ipmId: string;
        before: Prisma.JsonObject | null;
    };
}
export declare class SellingPriceBulkService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContext;
    private readonly appSettingValueService;
    private readonly gateway;
    private readonly writer;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContext: RequestContextService, appSettingValueService: AppSettingValueService, gateway: PriceBucketGateway, writer: PriceMasterWriter);
    listPrices(queryDto: ListSellingPriceQueryDto): Promise<PagedResult<SellingPriceRow>>;
    listBuckets(itemId: string, queryDto: PriceBucketsQueryDto): Promise<SellingPriceRow[]>;
    saveBulk(dto: SaveSellingPriceBulkDto): Promise<SellingPriceSaveResult>;
    applyPurchasePrices(tx: Prisma.TransactionClient, args: {
        companyId: string;
        branchId: string;
        actor: string;
        billRef: string;
        businessTime: Date;
        rows: {
            key: string;
            itemId: string;
            uomId: string;
            mrp: number | null;
            levels: {
                level: number;
                price: number;
            }[];
        }[];
    }): Promise<Map<string, {
        result: 'UPDATED' | 'KEPT_NEWER' | 'NONE';
        note: string | null;
    }>>;
    buildSaveMessage(result: SellingPriceSaveResult): string;
    applyBucketPrice(tx: Prisma.TransactionClient, candidate: BucketPriceCandidate, scope: ScopeResolution, scheduledFrom?: string, origin?: PriceWriteOrigin): Promise<AppliedBucketPrice>;
    listSchedule(queryDto: PriceScheduleQueryDto): Promise<SellingPriceScheduleRow[]>;
    cancelSchedule(ipmId: string): Promise<SellingPriceScheduleCancelResult>;
    private auditWrites;
    private describeBucket;
    private describeRow;
    private resolveStartDay;
    private toSavedRow;
    private assertScopeAllowed;
    private assertCanEditPrices;
    private describeOriginMenu;
    private resolveBelowCostPolicy;
    private rowScopeOf;
    private assertUnitsBelong;
    private assertOneRowPerBucket;
    private toCandidate;
    private toGridRows;
    private toGridRow;
    private throwProblems;
    resolveItemTaxRates(tx: Pick<Prisma.TransactionClient, 'itemMaster' | 'itemTaxHistory' | 'taxRateMaster'>, itemIds: readonly string[], asOf?: Date): Promise<Map<string, ItemTaxRate>>;
}
