import { Injectable, Logger } from '@nestjs/common';
import type { ClientInstallation, Prisma } from '@prisma/client';
import {
  CLIENT_PLATFORMS,
  type ClientPlatform,
  type IdentifiedClientInfo,
} from '../../../common/client-info/client-info';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { REFRESH_RECORD_INTERVAL_MS } from '../app-version.constants';
import type {
  InstallationSummaryQueryDto,
  ListInstallationsQueryDto,
} from '../dto/support-query.dto';

/** One sighting of a client: who, where, and which build. */
export interface InstallationSighting {
  client: IdentifiedClientInfo;
  /** cin_company_id is NOT NULL: a user with no company is not recorded. */
  companyId: string | null;
  branchId: string | null;
  userId: string;
  /** The login name, for cin_created_by / cin_modified_by. */
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
  /** Installations seen within activeDays. */
  activeInstallations: number;
  /** The oldest build still in use: the floor a legacy field must outlive. */
  oldestActiveBuild: number | null;
  newestActiveBuild: number | null;
  latestRelease: { build: number; version: string; severity: string } | null;
  upToDate: number;
  behind: number;
  builds: { build: number | null; installations: number; lastSeen: string | null }[];
}

const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_ACTIVE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The refresh throttle forgets entries past the window once it holds this many. */
const THROTTLE_PRUNE_AT = 10_000;

/**
 * public.client_installation: one row per (company, user, device, platform),
 * upserted on ux_cin_device.
 *
 * Login always writes. A token refresh writes at most once per 10 minutes per
 * device. The throttle is kept in this process's memory, so N API processes
 * write at most N times per window, which is cheap. Callers never let a failure
 * here reach the user (ClientTrackingService wraps every call).
 */
@Injectable()
export class ClientInstallationService {
  private readonly logger = new Logger(ClientInstallationService.name);
  private readonly lastRefreshWrite = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /** Login: always written. false = skipped (the user has no company). */
  recordLogin(sighting: InstallationSighting): Promise<boolean> {
    return this.write(sighting, 'login');
  }

  /** Refresh: false = skipped (written for this device less than 10 minutes ago, or no company). */
  async recordRefresh(sighting: InstallationSighting): Promise<boolean> {
    const key = installationKey(sighting);
    const now = Date.now();
    const last = this.lastRefreshWrite.get(key);
    if (last !== undefined && now - last < REFRESH_RECORD_INTERVAL_MS) {
      return false;
    }
    // Claimed before the write, so two refreshes racing in do not both write.
    this.rememberRefresh(key, now);
    return this.write(sighting, 'refresh');
  }

  async list(
    query: ListInstallationsQueryDto,
  ): Promise<{ total: number; rows: InstallationRow[] }> {
    const where: Prisma.ClientInstallationWhereInput = {
      cinIsDeleted: false,
      ...(query.platform !== undefined && { cinPlatform: query.platform }),
      ...(query.build !== undefined && { cinBuild: query.build }),
      ...(query.companyId !== undefined && { cinCompanyId: query.companyId }),
      ...(query.userId !== undefined && { cinUserId: query.userId }),
      ...(query.deviceId !== undefined && { cinDeviceId: query.deviceId }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.clientInstallation.count({ where }),
      this.prisma.clientInstallation.findMany({
        where,
        orderBy: [{ cinLastSeen: 'desc' }, { cinId: 'asc' }],
        take: query.limit ?? DEFAULT_LIST_LIMIT,
        skip: query.offset ?? 0,
      }),
    ]);
    const userIds = [...new Set(rows.map((row) => row.cinUserId))];
    const users =
      userIds.length === 0
        ? []
        : await this.prisma.userMaster.findMany({
            where: { usrId: { in: userIds } },
            select: { usrId: true, usrLoginName: true },
          });
    const nameOf = new Map(users.map((user) => [user.usrId, user.usrLoginName]));
    return { total, rows: rows.map((row) => toInstallationRow(row, nameOf.get(row.cinUserId))) };
  }

  /** Per platform: which builds were seen in the last `activeDays`, against the latest release. */
  async summary(query: InstallationSummaryQueryDto): Promise<PlatformInstallationSummary[]> {
    const activeDays = query.activeDays ?? DEFAULT_ACTIVE_DAYS;
    const since = new Date(Date.now() - activeDays * DAY_MS);
    const groups = await this.prisma.clientInstallation.groupBy({
      by: ['cinPlatform', 'cinBuild'],
      where: {
        cinIsDeleted: false,
        cinIsActive: true,
        cinLastSeen: { gte: since },
        ...(query.platform !== undefined && { cinPlatform: query.platform }),
      },
      _count: { _all: true },
      _max: { cinLastSeen: true },
    });
    const platforms: ClientPlatform[] = query.platform
      ? [query.platform]
      : CLIENT_PLATFORMS.filter((platform) => groups.some((g) => g.cinPlatform === platform));
    return Promise.all(
      platforms.map(async (platform) => {
        const latest = await this.prisma.appRelease.findFirst({
          where: { arlPlatform: platform, arlIsDeleted: false, arlIsActive: true },
          orderBy: { arlBuild: 'desc' },
          select: { arlBuild: true, arlVersion: true, arlSeverity: true },
        });
        const mine = groups
          .filter((g) => g.cinPlatform === platform)
          .sort((a, b) => (a.cinBuild ?? -1) - (b.cinBuild ?? -1));
        const known = mine.filter((g) => g.cinBuild !== null);
        const countOf = (list: typeof mine): number =>
          list.reduce((sum, g) => sum + g._count._all, 0);
        return {
          platform,
          activeDays,
          activeInstallations: countOf(mine),
          oldestActiveBuild: known.length > 0 ? known[0].cinBuild : null,
          newestActiveBuild: known.length > 0 ? known[known.length - 1].cinBuild : null,
          latestRelease: latest
            ? { build: latest.arlBuild, version: latest.arlVersion, severity: latest.arlSeverity }
            : null,
          upToDate: latest
            ? countOf(known.filter((g) => (g.cinBuild as number) >= latest.arlBuild))
            : 0,
          behind: latest
            ? countOf(known.filter((g) => (g.cinBuild as number) < latest.arlBuild))
            : 0,
          builds: mine.map((g) => ({
            build: g.cinBuild,
            installations: g._count._all,
            lastSeen: g._max.cinLastSeen ? g._max.cinLastSeen.toISOString() : null,
          })),
        };
      }),
    );
  }

  private async write(sighting: InstallationSighting, kind: 'login' | 'refresh'): Promise<boolean> {
    const { client, companyId } = sighting;
    if (!companyId) {
      this.logger.debug(`Not recorded: user ${sighting.userId} has no company`);
      return false;
    }
    const now = new Date();
    const deviceId = client.deviceId ?? 'unknown';
    const ip = sighting.ip ? sighting.ip.slice(0, 60) : null;
    const loginStamp = kind === 'login' ? { cinLastLogin: now } : {};
    await this.prisma.clientInstallation.upsert({
      where: {
        cinCompanyId_cinUserId_cinDeviceId_cinPlatform: {
          cinCompanyId: companyId,
          cinUserId: sighting.userId,
          cinDeviceId: deviceId,
          cinPlatform: client.platform,
        },
      },
      create: {
        cinCompanyId: companyId,
        cinBranchId: sighting.branchId,
        cinUserId: sighting.userId,
        cinDeviceId: deviceId,
        cinPlatform: client.platform,
        cinBuild: client.build,
        cinVersion: client.version,
        cinCommit: client.commit,
        cinOs: client.deviceOs,
        cinIp: ip,
        cinFirstSeen: now,
        cinLastSeen: now,
        ...loginStamp,
        cinCreatedOn: now,
        cinCreatedBy: sighting.actor,
      },
      update: {
        cinBuild: client.build,
        // Support details overwrite only when sent this time; an older value beats none.
        ...(sighting.branchId !== null && { cinBranchId: sighting.branchId }),
        ...(client.version !== null && { cinVersion: client.version }),
        ...(client.commit !== null && { cinCommit: client.commit }),
        ...(client.deviceOs !== null && { cinOs: client.deviceOs }),
        ...(ip !== null && { cinIp: ip }),
        cinLastSeen: now,
        ...loginStamp,
        // A device seen again is in use, whatever an earlier clean-up said.
        cinIsDeleted: false,
        cinModifiedOn: now,
        cinModifiedBy: sighting.actor,
      },
    });
    return true;
  }

  private rememberRefresh(key: string, now: number): void {
    if (this.lastRefreshWrite.size >= THROTTLE_PRUNE_AT) {
      for (const [entry, at] of this.lastRefreshWrite) {
        if (now - at >= REFRESH_RECORD_INTERVAL_MS) {
          this.lastRefreshWrite.delete(entry);
        }
      }
    }
    this.lastRefreshWrite.set(key, now);
  }
}

function installationKey(sighting: InstallationSighting): string {
  return [
    sighting.companyId ?? '-',
    sighting.userId,
    sighting.client.deviceId ?? 'unknown',
    sighting.client.platform,
  ].join('|');
}

function toInstallationRow(row: ClientInstallation, userName: string | undefined): InstallationRow {
  return {
    id: row.cinId,
    companyId: row.cinCompanyId,
    branchId: row.cinBranchId,
    userId: row.cinUserId,
    userName: userName ?? null,
    deviceId: row.cinDeviceId,
    platform: row.cinPlatform,
    build: row.cinBuild,
    version: row.cinVersion,
    commit: row.cinCommit,
    os: row.cinOs,
    ip: row.cinIp,
    firstSeen: row.cinFirstSeen.toISOString(),
    lastSeen: row.cinLastSeen.toISOString(),
    lastLogin: row.cinLastLogin ? row.cinLastLogin.toISOString() : null,
    isActive: row.cinIsActive,
    createdOn: row.cinCreatedOn.toISOString(),
    createdBy: row.cinCreatedBy,
    modifiedOn: row.cinModifiedOn ? row.cinModifiedOn.toISOString() : null,
    modifiedBy: row.cinModifiedBy,
  };
}
