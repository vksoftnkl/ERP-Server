import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { type SalesRight } from './sales.guards';
import { type SalesSettings } from './sales.settings';
import type { RightsBlock } from './types/posting.types';
export interface SalesCallContext {
    userId: string;
    actor: string;
    settings: SalesSettings;
    cogsMode: 'PERPETUAL' | 'PERIODIC';
    rights: RightsBlock;
}
export declare class SalesContextService {
    private readonly prisma;
    private readonly requestContext;
    private readonly appSettings;
    constructor(prisma: PrismaService, requestContext: RequestContextService, appSettings: AppSettingValueService);
    actor(): string;
    resolve(scope: {
        companyId: string;
        branchId: string;
        deviceId?: string | null;
    }, menuId: number, client?: Prisma.TransactionClient): Promise<SalesCallContext>;
    settings(companyId: string, branchId: string, deviceId?: string | null): Promise<SalesSettings>;
    setting(companyId: string, branchId: string, key: string): Promise<string | null>;
    rights(menuId: number, client?: Prisma.TransactionClient): Promise<RightsBlock>;
    hasRight(ctx: SalesCallContext, right: SalesRight): boolean;
}
