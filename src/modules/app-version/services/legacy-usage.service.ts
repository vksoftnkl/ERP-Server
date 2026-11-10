import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { AppLegacyUsage, Prisma } from '@prisma/client';
import type { ClientInfo } from '../../../common/client-info/client-info';
import { isUniqueConstraintError } from '../../../common/utils/module-shared.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  LEGACY_FLUSH_INTERVAL_MS,
  LEGACY_MAX_PENDING_KEYS,
  LEGACY_UNKNOWN_BUILD,
  SYSTEM_ACTOR,
  type LegacyUsagePlatform,
} from '../app-version.constants';
import type { LegacyUsageQueryDto } from '../dto/support-query.dto';

interface PendingCount {
  name: string;
  platform: LegacyUsagePlatform;
  build: number;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface LegacyUsageRow {
  id: string;
  name: string;
  platform: string;
  build: number;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

/**
 * public.app_legacy_usage: how often a legacy request field is still used, per
 * platform + build. A field can be removed once no build still in use counts
 * against it (compare with installations/summary → oldestActiveBuild).
 *
 *   legacyUsage.record('auth.login.app_version', clientInfoOf(request));
 *
 * record() only bumps a counter in memory, so it is safe on a hot path and never
 * throws. Every minute the counters are added onto their rows (one upsert per
 * field + platform + build). A failed write keeps its counts for the next
 * minute. A shutdown writes what is left.
 */
@Injectable()
export class LegacyUsageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LegacyUsageService.name);
  private pending = new Map<string, PendingCount>();
  private droppedKeys = 0;
  private timer: NodeJS.Timeout | null = null;
  /** Flushes run one after another, never two at once. */
  private flushChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, LEGACY_FLUSH_INTERVAL_MS);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  /** Counts `count` uses of a legacy field by this client. Missing platform / build count as unknown. */
  record(name: string, client?: ClientInfo | null, count = 1): void {
    try {
      const field = typeof name === 'string' ? name.trim().slice(0, 100) : '';
      const times = Math.floor(count);
      if (!field || !Number.isFinite(times) || times < 1) {
        return;
      }
      const now = new Date();
      this.merge({
        name: field,
        platform: client?.platform ?? 'unknown',
        build: client?.build ?? LEGACY_UNKNOWN_BUILD,
        count: times,
        firstSeen: now,
        lastSeen: now,
      });
    } catch {
      // Counting must never touch the request that triggered it.
    }
  }

  /** Writes every pending counter now. Resolves to the number of rows written; never rejects. */
  flush(): Promise<number> {
    const run = this.flushChain.then(() => this.flushOnce());
    this.flushChain = run.catch(() => undefined);
    return run.catch(() => 0);
  }

  /** Flushes first, so the answer includes the last minute. */
  async list(query: LegacyUsageQueryDto): Promise<LegacyUsageRow[]> {
    await this.flush();
    const where: Prisma.AppLegacyUsageWhereInput = {
      aluIsDeleted: false,
      ...(query.name !== undefined &&
        query.name.trim() !== '' && {
          aluName: { contains: query.name.trim(), mode: 'insensitive' },
        }),
      ...(query.platform !== undefined && { aluPlatform: query.platform }),
      ...(query.build !== undefined && { aluBuild: query.build }),
    };
    const rows = await this.prisma.appLegacyUsage.findMany({
      where,
      orderBy: [{ aluName: 'asc' }, { aluPlatform: 'asc' }, { aluBuild: 'asc' }],
    });
    return rows.map(toLegacyUsageRow);
  }

  /** Counters held in memory and not yet written (tests and diagnostics). */
  pendingCount(): number {
    return this.pending.size;
  }

  private async flushOnce(): Promise<number> {
    if (this.pending.size === 0) {
      return 0;
    }
    const batch = [...this.pending.values()];
    this.pending = new Map();
    let written = 0;
    for (let index = 0; index < batch.length; index += 1) {
      try {
        await this.write(batch[index]);
        written += 1;
      } catch (error: unknown) {
        // Most likely the database is unreachable: stop, keep this one and
        // the rest, and try again on the next tick.
        batch.slice(index).forEach((entry) => this.merge(entry));
        this.logger.warn(
          `Legacy usage: ${batch.length - index} counter(s) kept for the next flush: ${describe(error)}`,
        );
        break;
      }
    }
    if (this.droppedKeys > 0) {
      this.logger.warn(
        `Legacy usage: ${this.droppedKeys} new counter(s) dropped (over ${LEGACY_MAX_PENDING_KEYS} pending)`,
      );
      this.droppedKeys = 0;
    }
    return written;
  }

  private async write(entry: PendingCount, isRetry = false): Promise<void> {
    const now = new Date();
    try {
      await this.prisma.appLegacyUsage.upsert({
        where: {
          aluName_aluPlatform_aluBuild: {
            aluName: entry.name,
            aluPlatform: entry.platform,
            aluBuild: entry.build,
          },
        },
        create: {
          aluName: entry.name,
          aluPlatform: entry.platform,
          aluBuild: entry.build,
          aluCount: entry.count,
          aluFirstSeen: entry.firstSeen,
          aluLastSeen: entry.lastSeen,
          aluCreatedOn: now,
          aluCreatedBy: SYSTEM_ACTOR,
        },
        update: {
          aluCount: { increment: entry.count },
          aluLastSeen: entry.lastSeen,
          aluModifiedOn: now,
          aluModifiedBy: SYSTEM_ACTOR,
        },
      });
    } catch (error: unknown) {
      // Another API process created the row between our read and insert: the
      // second try takes the update path.
      if (!isRetry && isUniqueConstraintError(error)) {
        await this.write(entry, true);
        return;
      }
      throw error;
    }
  }

  private merge(entry: PendingCount): void {
    const key = `${entry.name}\u0000${entry.platform}\u0000${entry.build}`;
    const held = this.pending.get(key);
    if (held) {
      held.count += entry.count;
      if (entry.firstSeen < held.firstSeen) held.firstSeen = entry.firstSeen;
      if (entry.lastSeen > held.lastSeen) held.lastSeen = entry.lastSeen;
      return;
    }
    if (this.pending.size >= LEGACY_MAX_PENDING_KEYS) {
      this.droppedKeys += 1;
      return;
    }
    this.pending.set(key, { ...entry });
  }
}

function toLegacyUsageRow(row: AppLegacyUsage): LegacyUsageRow {
  return {
    id: row.aluId,
    name: row.aluName,
    platform: row.aluPlatform,
    build: row.aluBuild,
    count: row.aluCount,
    firstSeen: row.aluFirstSeen.toISOString(),
    lastSeen: row.aluLastSeen.toISOString(),
  };
}

function describe(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
