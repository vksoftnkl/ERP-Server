import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AppRelease, Prisma } from '@prisma/client';
import type { ClientPlatform } from '../../../common/client-info/client-info';
import { isUniqueConstraintError } from '../../../common/utils/module-shared.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RELEASE_SEVERITIES, SEVERITY_RANK, type ReleaseSeverity } from '../app-version.constants';
import type { AppUpdateInfoDto } from '../dto/check-update.dto';
import type { CreateReleaseDto, ReleaseResponseDto, UpdateReleaseDto } from '../dto/release.dto';
import { AppVersionErrorCode, appVersionErrorBody } from '../types/app-version-error-codes';
import { AppVersionStateStore } from './app-version-state.store';
import { BuildPolicyService } from './build-policy.service';

/**
 * public.app_release: "is a newer build available?", plus release
 * create / update / yank.
 *
 * A live release = arl_is_deleted = false AND arl_is_active = true. Only live
 * releases are offered or listed. A yanked one (arl_is_deleted = true) keeps
 * its build number (ux_arl_platform_build is not partial), so the number can't
 * be reused by mistake. PATCH isDeleted:false restores it.
 */
@Injectable()
export class AppUpdateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: AppVersionStateStore,
    private readonly policies: BuildPolicyService,
  ) {}

  /**
   * The update notice for a client on `currentBuild`. severity = the most urgent
   * of ALL the live builds above it, so a critical 11 is not hidden behind a
   * normal 12. Read-only: checking never records anything.
   */
  async check(platform: ClientPlatform, currentBuild: number): Promise<AppUpdateInfoDto> {
    const live = liveReleasesOf(platform);
    const [missed, latest] = await Promise.all([
      this.prisma.appRelease.findMany({
        where: { ...live, arlBuild: { gt: currentBuild } },
        select: { arlSeverity: true },
      }),
      this.prisma.appRelease.findFirst({ where: live, orderBy: { arlBuild: 'desc' } }),
    ]);
    const updateAvailable = missed.length > 0;
    return {
      platform,
      currentBuild,
      updateAvailable,
      severity: updateAvailable ? mostUrgent(missed.map((row) => row.arlSeverity)) : null,
      latestBuild: latest?.arlBuild ?? null,
      latestVersion: latest?.arlVersion ?? null,
      downloadUrl: latest?.arlDownloadUrl ?? null,
      notes: latest?.arlNotes ?? null,
      releasedAt: latest ? latest.arlReleasedAt.toISOString() : null,
      missedBuilds: missed.length,
    };
  }

  /** Live releases; `includeDeleted` (Step 4) adds yanked and inactive ones. */
  async listReleases(
    platform?: ClientPlatform,
    includeDeleted = false,
  ): Promise<ReleaseResponseDto[]> {
    const where: Prisma.AppReleaseWhereInput = includeDeleted
      ? platform
        ? { arlPlatform: platform }
        : {}
      : platform
        ? liveReleasesOf(platform)
        : { arlIsDeleted: false, arlIsActive: true };
    const rows = await this.prisma.appRelease.findMany({
      where,
      orderBy: [{ arlPlatform: 'asc' }, { arlBuild: 'desc' }],
    });
    return rows.map(toReleaseResponse);
  }

  /**
   * Registers a build. 409 when:
   *   - the platform + build is already registered, yanked or not
   *     (APP_RELEASE_BUILD_EXISTS);
   *   - the build is LOWER than a build clients of the platform already run
   *     (APP_RELEASE_BUILD_TOO_LOW). Such a release would be offered to nobody,
   *     so it means a wrong number, e.g. a CI counter that was reset.
   * A build between existing releases is accepted, because CI jobs can finish
   * out of order.
   *
   * Step 4 (E3) `setExpected`: in the same transaction, the build becomes the
   * platform's expected build here (enforce untouched; a policy row set by
   * hand is kept, reported as expectedBuildSet: false).
   */
  async createRelease(dto: CreateReleaseDto, actor: string): Promise<ReleaseResponseDto> {
    const existing = await this.prisma.appRelease.findUnique({
      where: { arlPlatform_arlBuild: { arlPlatform: dto.platform, arlBuild: dto.build } },
      select: { arlIsDeleted: true },
    });
    if (existing) {
      throw buildExists(dto.platform, dto.build, existing.arlIsDeleted);
    }
    const inUse = await this.prisma.clientInstallation.aggregate({
      where: { cinPlatform: dto.platform, cinIsDeleted: false, cinBuild: { not: null } },
      _max: { cinBuild: true },
    });
    const highestInUse = inUse._max.cinBuild;
    if (highestInUse !== null && dto.build < highestInUse) {
      throw new ConflictException(
        appVersionErrorBody(
          `Build ${dto.build} is lower than build ${highestInUse}, which ${dto.platform} clients already run`,
          'build',
          AppVersionErrorCode.RELEASE_BUILD_TOO_LOW,
        ),
      );
    }
    const now = new Date();
    const setExpected = dto.setExpected === true;
    try {
      const { row, expectedBuildSet } = await this.prisma.$transaction(async (tx) => {
        const created = await tx.appRelease.create({
          data: {
            arlPlatform: dto.platform,
            arlBuild: dto.build,
            arlVersion: dto.version,
            arlCommit: blankToNull(dto.commit),
            arlSeverity: dto.severity ?? 'normal',
            arlNotes: blankToNull(dto.notes),
            arlDownloadUrl: blankToNull(dto.downloadUrl),
            arlReleasedAt: dto.releasedAt ? new Date(dto.releasedAt) : now,
            arlCreatedOn: now,
            arlCreatedBy: actor,
          },
        });
        const expected = setExpected
          ? await this.state.setExpectedBuild(
              tx,
              dto.platform,
              dto.build,
              blankToNull(dto.downloadUrl),
              actor,
            )
          : null;
        return { row: created, expectedBuildSet: expected };
      });
      if (expectedBuildSet !== null) {
        await this.policies.reload();
        return { ...toReleaseResponse(row), expectedBuildSet };
      }
      return toReleaseResponse(row);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        // Two registrations of the same build raced; the other one won.
        throw buildExists(dto.platform, dto.build, false);
      }
      throw error;
    }
  }

  /**
   * Changes the fields sent and leaves the rest. Finds the row even when it is
   * yanked, so `isDeleted: false` can restore it.
   */
  async updateRelease(
    platform: ClientPlatform,
    build: number,
    dto: UpdateReleaseDto,
    actor: string,
  ): Promise<ReleaseResponseDto> {
    const where = { arlPlatform_arlBuild: { arlPlatform: platform, arlBuild: build } };
    const row = await this.prisma.appRelease.findUnique({ where });
    if (!row) {
      throw new NotFoundException(
        appVersionErrorBody(
          `No ${platform} release with build ${build}`,
          'build',
          AppVersionErrorCode.RELEASE_NOT_FOUND,
        ),
      );
    }
    // dto.x !== undefined, never `dto.x ?? …`: with ES2022 class fields every
    // declared property is present, so "sent" has to be judged by value.
    const data: Prisma.AppReleaseUpdateInput = {};
    if (dto.version !== undefined && dto.version !== null) data.arlVersion = dto.version;
    if (dto.commit !== undefined) data.arlCommit = blankToNull(dto.commit);
    if (dto.severity !== undefined && dto.severity !== null) data.arlSeverity = dto.severity;
    if (dto.notes !== undefined) data.arlNotes = blankToNull(dto.notes);
    if (dto.downloadUrl !== undefined) data.arlDownloadUrl = blankToNull(dto.downloadUrl);
    if (dto.releasedAt !== undefined && dto.releasedAt !== null) {
      data.arlReleasedAt = new Date(dto.releasedAt);
    }
    if (dto.isActive !== undefined && dto.isActive !== null) data.arlIsActive = dto.isActive;
    if (dto.isDeleted !== undefined && dto.isDeleted !== null) data.arlIsDeleted = dto.isDeleted;
    if (Object.keys(data).length === 0) {
      return toReleaseResponse(row);
    }
    const updated = await this.prisma.appRelease.update({
      where,
      data: { ...data, arlModifiedOn: new Date(), arlModifiedBy: actor },
    });
    return toReleaseResponse(updated);
  }
}

function liveReleasesOf(platform: ClientPlatform): Prisma.AppReleaseWhereInput {
  return { arlPlatform: platform, arlIsDeleted: false, arlIsActive: true };
}

export function mostUrgent(severities: readonly string[]): ReleaseSeverity {
  let best: ReleaseSeverity = 'normal';
  for (const value of severities) {
    const severity = (RELEASE_SEVERITIES as readonly string[]).includes(value)
      ? (value as ReleaseSeverity)
      : 'normal';
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[best]) {
      best = severity;
    }
  }
  return best;
}

function buildExists(platform: string, build: number, yanked: boolean): ConflictException {
  return new ConflictException(
    appVersionErrorBody(
      yanked
        ? `${platform} build ${build} was registered and yanked; restore it with PATCH isDeleted:false`
        : `${platform} build ${build} is already registered`,
      'build',
      AppVersionErrorCode.RELEASE_BUILD_EXISTS,
    ),
  );
}

function blankToNull(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function toReleaseResponse(row: AppRelease): ReleaseResponseDto {
  return {
    id: row.arlId,
    platform: row.arlPlatform,
    build: row.arlBuild,
    version: row.arlVersion,
    commit: row.arlCommit,
    severity: row.arlSeverity,
    notes: row.arlNotes,
    downloadUrl: row.arlDownloadUrl,
    releasedAt: row.arlReleasedAt.toISOString(),
    isActive: row.arlIsActive,
    isDeleted: row.arlIsDeleted,
    createdOn: row.arlCreatedOn.toISOString(),
    createdBy: row.arlCreatedBy,
    modifiedOn: row.arlModifiedOn ? row.arlModifiedOn.toISOString() : null,
    modifiedBy: row.arlModifiedBy,
  };
}
