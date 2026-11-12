import type { Request } from 'express';
import { AppUpdateInfoDto, CheckUpdateQueryDto } from './dto/check-update.dto';
import { CreateReleaseDto, ListReleasesQueryDto, ReleaseKeyParamsDto, ReleaseResponseDto, UpdateReleaseDto } from './dto/release.dto';
import { InstallationSummaryQueryDto, LegacyUsageQueryDto, ListInstallationsQueryDto } from './dto/support-query.dto';
import { AppUpdateService } from './services/app-update.service';
import { ClientInstallationService, type InstallationRow, type PlatformInstallationSummary } from './services/client-installation.service';
import { LegacyUsageService, type LegacyUsageRow } from './services/legacy-usage.service';
export declare class AppVersionController {
    private readonly updates;
    private readonly installations;
    private readonly legacyUsage;
    constructor(updates: AppUpdateService, installations: ClientInstallationService, legacyUsage: LegacyUsageService);
    check(query: CheckUpdateQueryDto, request: Request): Promise<AppUpdateInfoDto>;
    createRelease(dto: CreateReleaseDto, request: Request): Promise<ReleaseResponseDto>;
    updateRelease(params: ReleaseKeyParamsDto, dto: UpdateReleaseDto, request: Request): Promise<ReleaseResponseDto>;
    listReleases(query: ListReleasesQueryDto): Promise<ReleaseResponseDto[]>;
    listInstallations(query: ListInstallationsQueryDto): Promise<{
        total: number;
        rows: InstallationRow[];
    }>;
    installationSummary(query: InstallationSummaryQueryDto): Promise<PlatformInstallationSummary[]>;
    legacyUsageList(query: LegacyUsageQueryDto): Promise<LegacyUsageRow[]>;
}
