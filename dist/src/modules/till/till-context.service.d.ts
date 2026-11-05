import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { type MenuRight, type MenuRights } from '../../common/posting/rights';
import { AppSettingValueService } from '../settings/appSettings/app-setting-value.service';
import { type TillSettings } from './till.settings';
export declare const isUuid: (value: string | null | undefined) => value is string;
export interface TillCaller {
    userId: string;
    actorName: string;
    deviceId: string | null;
}
export declare class TillContextService {
    private readonly prisma;
    private readonly requestContext;
    private readonly appSettings;
    constructor(prisma: PrismaService, requestContext: RequestContextService, appSettings: AppSettingValueService);
    caller(client?: Prisma.TransactionClient): Promise<TillCaller>;
    settings(scope: {
        companyId: string;
        branchId: string;
        deviceId?: string | null;
        userId?: string | null;
    }): Promise<TillSettings>;
    requireRight(menuId: number, right: MenuRight, action: string): Promise<MenuRights>;
    rights(menuId: number): Promise<MenuRights>;
}
