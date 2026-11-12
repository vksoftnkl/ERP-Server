import { type ClientInfo } from '../../../common/client-info/client-info';
import type { AppUpdateInfoDto } from '../dto/check-update.dto';
import { AppUpdateService } from './app-update.service';
import { ClientInstallationService } from './client-installation.service';
import { LegacyUsageService } from './legacy-usage.service';
export interface SessionTrackingContext {
    client: ClientInfo | null | undefined;
    userId: string;
    userName: string;
    companyId: string | null;
    branchId: string | null;
    ip: string | null;
}
export declare class ClientTrackingService {
    private readonly installations;
    private readonly updates;
    private readonly legacyUsage;
    private readonly logger;
    constructor(installations: ClientInstallationService, updates: AppUpdateService, legacyUsage: LegacyUsageService);
    onLogin(context: SessionTrackingContext): Promise<AppUpdateInfoDto | null>;
    onRefresh(context: SessionTrackingContext): Promise<void>;
    legacyField(name: string, client: ClientInfo | null | undefined): void;
    private guard;
    private warn;
}
