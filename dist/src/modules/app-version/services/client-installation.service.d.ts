import { type ClientPlatform, type IdentifiedClientInfo } from '../../../common/client-info/client-info';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { InstallationSummaryQueryDto, ListInstallationsQueryDto } from '../dto/support-query.dto';
export interface InstallationSighting {
    client: IdentifiedClientInfo;
    companyId: string | null;
    branchId: string | null;
    userId: string;
    actor: string;
    ip: string | null;
}
export interface InstallationRow {
    id: string;
    companyId: string;
    branchId: string | null;
    userId: string;
    userName: string | null;
    deviceId: string;
    platform: string;
    build: number | null;
    version: string | null;
    commit: string | null;
    os: string | null;
    ip: string | null;
    firstSeen: string;
    lastSeen: string;
    lastLogin: string | null;
    isActive: boolean;
    createdOn: string;
    createdBy: string | null;
    modifiedOn: string | null;
    modifiedBy: string | null;
}
export interface PlatformInstallationSummary {
    platform: ClientPlatform;
    activeDays: number;
    activeInstallations: number;
    oldestActiveBuild: number | null;
    newestActiveBuild: number | null;
    latestRelease: {
        build: number;
        version: string;
        severity: string;
    } | null;
    upToDate: number;
    behind: number;
    builds: {
        build: number | null;
        installations: number;
        lastSeen: string | null;
    }[];
}
export declare class ClientInstallationService {
    private readonly prisma;
    private readonly logger;
    private readonly lastRefreshWrite;
    constructor(prisma: PrismaService);
    recordLogin(sighting: InstallationSighting): Promise<boolean>;
    recordRefresh(sighting: InstallationSighting): Promise<boolean>;
    list(query: ListInstallationsQueryDto): Promise<{
        total: number;
        rows: InstallationRow[];
    }>;
    summary(query: InstallationSummaryQueryDto): Promise<PlatformInstallationSummary[]>;
    private write;
    private rememberRefresh;
}
