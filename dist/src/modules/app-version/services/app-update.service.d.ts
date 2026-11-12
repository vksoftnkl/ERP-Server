import type { AppRelease } from '@prisma/client';
import type { ClientPlatform } from '../../../common/client-info/client-info';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { type ReleaseSeverity } from '../app-version.constants';
import type { AppUpdateInfoDto } from '../dto/check-update.dto';
import type { CreateReleaseDto, ReleaseResponseDto, UpdateReleaseDto } from '../dto/release.dto';
export declare class AppUpdateService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    check(platform: ClientPlatform, currentBuild: number): Promise<AppUpdateInfoDto>;
    listReleases(platform?: ClientPlatform): Promise<ReleaseResponseDto[]>;
    createRelease(dto: CreateReleaseDto, actor: string): Promise<ReleaseResponseDto>;
    updateRelease(platform: ClientPlatform, build: number, dto: UpdateReleaseDto, actor: string): Promise<ReleaseResponseDto>;
}
export declare function mostUrgent(severities: readonly string[]): ReleaseSeverity;
export declare function toReleaseResponse(row: AppRelease): ReleaseResponseDto;
