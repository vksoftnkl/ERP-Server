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
import { PriceBucketGateway, type BucketPriceCandidate, type RowCost } from './price-bucket.gateway';
import { type BelowCostPolicy, type ItemTaxRate, type PagedResult, type SellingPriceProblem, type SellingPriceRow, type SellingPriceSaveResult, type SellingPriceScheduleCancelResult, type SellingPriceScheduleRow } from './types/selling-price-bulk.types';
import { PriceMasterWriter, type PriceCandidateWrite } from '../../Inventory/item-price-log/price-master-writer.service';
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
export interface PreparedBulkSave {
    dto: SaveSellingPriceBulkDto;
    actor: string;
    from: string;
    scheduledFrom: string | undefined;
    costs: RowCost[];
    candidates: PriceCandidateWrite[];
    resolutions: ScopeResolution[];
    problems: SellingPriceProblem[];
    belowCost: SellingPriceProblem[];
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
    prepareBulk(tx: Prisma.TransactionClient, dto: SaveSellingPriceBulkDto, ctx: {
        actor: string;
        policy: BelowCostPolicy;
    }): Promise<PreparedBulkSave>;
    confirmResult(prepared: PreparedBulkSave, policy: BelowCostPolicy): SellingPriceSaveResult;
    writeBulkInTx(tx: Prisma.TransactionClient, prepared: PreparedBulkSave, opts: {
        confirmed: boolean;
        via: string | null;
        policy: BelowCostPolicy;
    }): Promise<SellingPriceSaveResult>;
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
            minPrice?: number | null;
        }[];
    }): Promise<Map<string, {
        result: 'UPDATED' | 'KEPT_NEWER' | 'NONE';
        note: string | null;
    }>>;
    currentMinPrices(tx: Prisma.TransactionClient, companyId: string, branchId: string, rows: ReadonlyArray<{
        itemId: string;
        uomId: string;
        mrp: number | null;
    }>): Promise<(Prisma.Decimal | null)[]>;
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
    assertCanEditPrices(): Promise<void>;
    describeOriginMenu(menuId: number): Promise<string>;
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
