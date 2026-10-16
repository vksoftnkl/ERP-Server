import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { type OpeningWriteClient } from './opening-balance.guards';
import { SaveOpeningBalanceDto } from './dto/save-opening-balance.dto';
import { ListOpeningBalanceQueryDto } from './dto/list-opening-balance-query.dto';
import { OpeningDrCr, type OpeningBalanceDeletePayload, type OpeningBalanceListPayload, type OpeningBalanceSavePayload, type TrialBalancePayload } from './types/opening-balance-api.types';
export declare class OpeningBalanceService {
    private readonly prisma;
    private readonly requestContextService;
    private readonly appSettings;
    constructor(prisma: PrismaService, requestContextService: RequestContextService, appSettings: AppSettingValueService);
    list(query: ListOpeningBalanceQueryDto): Promise<OpeningBalanceListPayload>;
    trialBalance(query: ListOpeningBalanceQueryDto): Promise<TrialBalancePayload>;
    save(dto: SaveOpeningBalanceDto): Promise<OpeningBalanceSavePayload>;
    private assertInventoryNotOpenedHere;
    softDelete(opId: string, accYear: string): Promise<OpeningBalanceDeletePayload>;
    closingByLedger(client: OpeningWriteClient, companyId: string, branchId: string | null, accYear: string): Promise<Map<string, {
        amount: Prisma.Decimal;
        drCr: OpeningDrCr;
    }>>;
    private scopeWhere;
    private toRow;
    private summarise;
    private requireAccYear;
    private assertRowsAreWritable;
    private assertBillWiseRowsOnlyEcho;
    billTotalsByOpening(client: OpeningWriteClient, accYear: string, opIds: readonly string[]): Promise<Map<string, Prisma.Decimal>>;
    private resolveSource;
    private deleteAbsentRows;
    private createOpening;
}
